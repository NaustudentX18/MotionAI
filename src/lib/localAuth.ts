/**
 * localAuth.ts — Local PIN lock for MotionAI PWA.
 *
 * Security model:
 *  - Raw PIN is never stored.
 *  - A random 16-byte hex salt is generated per pin-set.
 *  - SHA-256(salt + pin) is computed via crypto.subtle and stored as hex.
 *  - Lock state lives in sessionStorage (cleared on tab/browser close).
 */

const LS_KEY = 'motionai_local_auth';
const SS_KEY = 'motionai_pin_unlocked';
const FAILURE_KEY = 'motionai_pin_failures';
const INACTIVITY_KEY = 'motionai_pin_inactivity_timeout_ms';
const MAX_FAILURES = 5;
const LOCKOUT_MS = 60_000;

export const INACTIVITY_TIMEOUT_OPTIONS_MS = [
  0,
  60_000,
  5 * 60_000,
  15 * 60_000,
  30 * 60_000,
] as const;

interface AuthRecord {
  salt: string;
  hash: string;
}

interface FailureRecord {
  count: number;
  lockoutUntil?: number;
}

/** Encode a Uint8Array to lowercase hex */
function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Compute SHA-256 of a plain string, return hex */
async function sha256(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', encoded);
  return toHex(buf);
}

/** Generate a cryptographically random 16-byte hex salt */
function generateSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toHex(bytes.buffer);
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** Returns true if a PIN has been configured */
export function hasPin(): boolean {
  return localStorage.getItem(LS_KEY) !== null;
}

/** Hash and store the PIN. Overwrites any existing PIN. */
export async function setPin(pin: string): Promise<void> {
  if (!/^\d{6}$/.test(pin)) {
    throw new Error('PIN must be exactly 6 digits');
  }
  const salt = generateSalt();
  const hash = await sha256(salt + pin);
  const record: AuthRecord = { salt, hash };
  localStorage.setItem(LS_KEY, JSON.stringify(record));
  sessionStorage.removeItem(SS_KEY);
}

/** Verify a candidate PIN. Returns true if correct. */
export async function verifyPin(pin: string): Promise<boolean> {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return false;
  if (getPinLockoutMs() > 0) return false;
  try {
    const record: AuthRecord = JSON.parse(raw);
    const candidate = await sha256(record.salt + pin);
    return candidate === record.hash;
  } catch {
    return false;
  }
}

/** Remove the stored PIN (disables lock) */
export function clearPin(): void {
  localStorage.removeItem(LS_KEY);
  localStorage.removeItem(INACTIVITY_KEY);
  sessionStorage.removeItem(SS_KEY);
  sessionStorage.removeItem(FAILURE_KEY);
}

/** Returns true if the app is currently locked */
export function isLocked(): boolean {
  return hasPin() && sessionStorage.getItem(SS_KEY) !== '1';
}

/** Lock the app (persists until unlocked in this session) */
export function lock(): void {
  sessionStorage.removeItem(SS_KEY);
}

/** Unlock the app for this session */
export function unlock(): void {
  sessionStorage.setItem(SS_KEY, '1');
  sessionStorage.removeItem(FAILURE_KEY);
}

/** Returns configured inactivity auto-lock timeout in milliseconds. 0 disables auto-lock. */
export function getInactivityTimeoutMs(): number {
  const raw = localStorage.getItem(INACTIVITY_KEY);
  if (!raw) return 0;
  const parsed = Number(raw);
  return INACTIVITY_TIMEOUT_OPTIONS_MS.includes(parsed as typeof INACTIVITY_TIMEOUT_OPTIONS_MS[number])
    ? parsed
    : 0;
}

/** Stores the inactivity auto-lock timeout. Requires a PIN and one of the supported options. */
export function setInactivityTimeoutMs(timeoutMs: number): void {
  if (!hasPin()) {
    throw new Error('Set a local PIN before enabling inactivity auto-lock');
  }
  if (!INACTIVITY_TIMEOUT_OPTIONS_MS.includes(timeoutMs as typeof INACTIVITY_TIMEOUT_OPTIONS_MS[number])) {
    throw new Error('Unsupported inactivity auto-lock timeout');
  }
  if (timeoutMs === 0) {
    localStorage.removeItem(INACTIVITY_KEY);
    return;
  }
  localStorage.setItem(INACTIVITY_KEY, String(timeoutMs));
}

function loadFailureRecord(): FailureRecord {
  try {
    const raw = sessionStorage.getItem(FAILURE_KEY);
    if (!raw) return { count: 0 };
    const parsed = JSON.parse(raw) as Partial<FailureRecord>;
    return {
      count: typeof parsed.count === 'number' ? parsed.count : 0,
      lockoutUntil: typeof parsed.lockoutUntil === 'number' ? parsed.lockoutUntil : undefined,
    };
  } catch {
    return { count: 0 };
  }
}

function saveFailureRecord(record: FailureRecord): void {
  sessionStorage.setItem(FAILURE_KEY, JSON.stringify(record));
}

/** Returns remaining PIN lockout time in milliseconds for this browser session. */
export function getPinLockoutMs(now = Date.now()): number {
  const record = loadFailureRecord();
  if (!record.lockoutUntil || record.lockoutUntil <= now) return 0;
  return record.lockoutUntil - now;
}

/** Records a failed unlock attempt and returns current lockout time in milliseconds. */
export function registerFailedPin(now = Date.now()): number {
  const record = loadFailureRecord();
  const nextCount = record.count + 1;
  const nextRecord: FailureRecord = { count: nextCount };
  if (nextCount >= MAX_FAILURES) {
    nextRecord.count = 0;
    nextRecord.lockoutUntil = now + LOCKOUT_MS;
  }
  saveFailureRecord(nextRecord);
  return getPinLockoutMs(now);
}

// ─── Auth State Versioning & Migration ──────────────────────────────────────

export const AUTH_STATE_VERSION = 1 as const;

interface VersionedAuthEnvelope<T = unknown> {
  version: number;
  data: T;
}

/**
 * Wraps auth state in a versioned envelope for forward-compatible migrations.
 */
export function wrapAuthState<T>(data: T): VersionedAuthEnvelope<T> {
  return { version: AUTH_STATE_VERSION, data };
}

/**
 * Reads raw auth state from localStorage and migrates it to the current version.
 * Handles unversioned (legacy) state gracefully.
 */
export function migrateAuthState<T>(raw: string | null): { data: T | null; version: number } {
  if (!raw) return { data: null, version: 0 };

  try {
    const parsed = JSON.parse(raw);

    // Check if it's already a versioned envelope
    if (typeof parsed === 'object' && parsed !== null && typeof parsed.version === 'number') {
      let version = parsed.version;
      let data = parsed.data as T;

      // Apply sequential migrations up to current version
      while (version < AUTH_STATE_VERSION) {
        const nextVersion = version + 1;
        const migrator = MIGRATORS[nextVersion];
        if (migrator) {
          data = migrator(data) as T;
        }
        version = nextVersion;
      }

      return { data, version };
    }

    // Legacy unversioned data — migrate from version 0 to current
    let data = parsed as T;
    for (let v = 1; v <= AUTH_STATE_VERSION; v++) {
      const migrator = MIGRATORS[v];
      if (migrator) {
        data = migrator(data) as T;
      }
    }

    return { data, version: AUTH_STATE_VERSION };
  } catch {
    return { data: null, version: 0 };
  }
}

// ─── Migration Registry ─────────────────────────────────────────────────────
// Keyed by target version. Each function transforms data from v-1 to v.

type MigratorFn = (prev: unknown) => unknown;

const MIGRATORS: Record<number, MigratorFn> = {
  // v0 → v1: Initial migration — data shape is unchanged, just versioned.
  1: (data: unknown) => data,
};

/**
 * Read and migrate the stored auth record. Returns null if none exists.
 */
export function getMigratedAuthRecord(): AuthRecord | null {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return null;
  const { data } = migrateAuthState<AuthRecord>(raw);
  return data;
}
