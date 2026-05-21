/**
 * Sliding-window rate limiter for AI endpoints with optional file-backed persistence
 * so rate-limit state survives server restarts. Configurable via env vars:
 *   AI_RATE_LIMIT_WINDOW_MS  — window duration in ms (default 60_000)
 *   AI_RATE_LIMIT_MAX_REQS   — max requests per window per IP (default 30)
 *   AI_RATE_LIMIT_STORE_PATH — path to persistence file (optional; in-memory only if unset)
 */
import fs from 'node:fs';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

interface WindowEntry {
  windowStart: number;
  count: number;
}

const store = new Map<string, WindowEntry>();

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQS = 30;

function getWindowMs(): number {
  const env = Number(process.env.AI_RATE_LIMIT_WINDOW_MS);
  return Number.isFinite(env) && env > 0 ? Math.min(env, 3600_000) : DEFAULT_WINDOW_MS;
}

function getMaxReqs(): number {
  const env = Number(process.env.AI_RATE_LIMIT_MAX_REQS);
  return Number.isFinite(env) && env > 0 && env <= 1000 ? env : DEFAULT_MAX_REQS;
}

function getStorePath(): string | null {
  const p = process.env.AI_RATE_LIMIT_STORE_PATH;
  return p && p.trim() ? p.trim() : null;
}

function loadPersistedStore(): void {
  const path = getStorePath();
  if (!path) return;
  try {
    const raw = fs.readFileSync(path, 'utf-8');
    const data = JSON.parse(raw) as Record<string, WindowEntry>;
    const now = Date.now();
    for (const [ip, entry] of Object.entries(data)) {
      // Skip expired entries
      if (now - entry.windowStart < getWindowMs()) {
        store.set(ip, entry);
      }
    }
  } catch {
    // File doesn't exist or is corrupt — start fresh
  }
}

function persistStore(): void {
  const path = getStorePath();
  if (!path) return;
  try {
    const dir = path.substring(0, path.lastIndexOf('/'));
    if (dir && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const obj: Record<string, WindowEntry> = {};
    const now = Date.now();
    const windowMs = getWindowMs();
    for (const [ip, entry] of store.entries()) {
      if (now - entry.windowStart < windowMs) {
        obj[ip] = entry;
      }
    }
    fs.writeFileSync(path, JSON.stringify(obj, null, 2), 'utf-8');
  } catch {
    // Best-effort persistence; don't crash on write failure
  }
}

// Periodic persistence interval (every 30s)
let persistInterval: ReturnType<typeof setInterval> | null = null;

function startPersistInterval(): void {
  if (persistInterval) return;
  const path = getStorePath();
  if (!path) return;
  persistInterval = setInterval(persistStore, 30_000);
  // Unref so it doesn't keep the process alive
  persistInterval.unref();
}

// Load persisted state on module init
loadPersistedStore();
startPersistInterval();

export function checkRateLimit(ip: string): RateLimitResult {
  const windowMs = getWindowMs();
  const maxReqs = getMaxReqs();
  const now = Date.now();

  let entry = store.get(ip);

  // Reset if window has expired
  if (!entry || now - entry.windowStart >= windowMs) {
    entry = { windowStart: now, count: 0 };
    store.set(ip, entry);
  }

  entry.count += 1;
  const resetAt = entry.windowStart + windowMs;

  return {
    allowed: entry.count <= maxReqs,
    remaining: Math.max(0, maxReqs - entry.count),
    resetAt,
  };
}

/**
 * Express middleware factory for rate-limiting AI endpoints.
 */
import type { Request, Response, NextFunction } from 'express';

export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const result = checkRateLimit(ip);

  res.setHeader('X-RateLimit-Limit', String(getMaxReqs()));
  res.setHeader('X-RateLimit-Remaining', String(result.remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));

  if (!result.allowed) {
    res.status(429).json({
      error: 'Too many requests. Please wait before sending more AI requests.',
      retryAfterMs: Math.max(0, result.resetAt - Date.now()),
    });
    return;
  }

  next();
}

/** For testing: clear the rate-limit state */
export function resetRateLimitStore(): void {
  store.clear();
}

/** For testing: force a persist cycle */
export function flushPersistStore(): void {
  persistStore();
}

/** Graceful shutdown: write final state */
export function shutdownRateLimitStore(): void {
  if (persistInterval) {
    clearInterval(persistInterval);
    persistInterval = null;
  }
  persistStore();
}
