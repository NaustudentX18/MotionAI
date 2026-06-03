const ALLOW_REMOTE =
  typeof process !== 'undefined' && process.env?.AI_ALLOW_REMOTE_BASE_URLS === '1';

function ipVersion(hostname: string): 4 | 6 | 0 {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return 4;
  if (hostname.includes(':')) return 6;
  return 0;
}

export class SsrfBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SsrfBlockedError';
  }
}

function isHomelabHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map(part => Number(part));
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === '::1') return false;
  return (
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('::ffff:127.') ||
    normalized.startsWith('::ffff:10.') ||
    normalized.startsWith('::ffff:192.168.') ||
    normalized.startsWith('::ffff:169.254.') ||
    /^::ffff:172\.(1[6-9]|2\d|3[01])\./.test(normalized)
  );
}

function isPrivateHost(hostname: string): boolean {
  const version = ipVersion(hostname);
  if (version === 4) return isPrivateIpv4(hostname);
  if (version === 6) return isPrivateIpv6(hostname);
  return false;
}

export function isAllowedFetchUrl(url: string): boolean {
  try {
    assertAllowedFetchUrl(url);
    return true;
  } catch {
    return false;
  }
}

export function assertAllowedFetchUrl(url: string, context = 'outbound request'): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SsrfBlockedError(`Blocked ${context}: invalid URL.`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new SsrfBlockedError(`Blocked ${context}: only http(s) URLs are allowed.`);
  }

  const hostname = parsed.hostname;
  if (isHomelabHost(hostname)) return;

  if (isPrivateHost(hostname)) {
    throw new SsrfBlockedError(`Blocked ${context}: private or loopback addresses are not allowed.`);
  }

  if (!ALLOW_REMOTE) {
    throw new SsrfBlockedError(
      `Blocked ${context}: remote base URLs require AI_ALLOW_REMOTE_BASE_URLS=1. Local homelab endpoints (localhost / 127.0.0.1) remain allowed.`,
    );
  }
}
