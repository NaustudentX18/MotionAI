/**
 * Authenticated fetch for MotionAI Express API routes.
 * Set VITE_MOTIONAI_API_SECRET at build time to match server MOTIONAI_API_SECRET.
 */

export function getMotionAiApiSecret(): string | undefined {
  const fromEnv = import.meta.env.VITE_MOTIONAI_API_SECRET;
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.trim();
  return undefined;
}

export function motionAiHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const secret = getMotionAiApiSecret();
  if (secret) {
    headers.set('x-motionai-secret', secret);
  }
  return headers;
}

export async function motionAiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const headers = motionAiHeaders(init?.headers);
  return fetch(input, { ...init, headers });
}
