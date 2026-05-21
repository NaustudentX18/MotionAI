/**
 * E2EE crypto module using Web Crypto API (SubtleCrypto)
 * Key is NEVER persisted — lost on page close.
 */

const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const ALGORITHM = 'AES-GCM';

export interface EncryptedData {
  ciphertext: string; // base64
  iv: string;         // base64
  salt: string;       // base64
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer as ArrayBuffer;
}

async function deriveKey(passphrase: string, salt: ArrayBuffer): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encrypt(plaintext: string, passphrase: string): Promise<EncryptedData> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(passphrase, salt.buffer as ArrayBuffer);

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoder.encode(plaintext)
  );

  return {
    ciphertext: arrayBufferToBase64(ciphertext),
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
    salt: arrayBufferToBase64(salt.buffer as ArrayBuffer),
  };
}

export async function decrypt(data: EncryptedData, passphrase: string): Promise<string> {
  const salt = base64ToArrayBuffer(data.salt);
  const iv = base64ToArrayBuffer(data.iv);
  const ciphertext = base64ToArrayBuffer(data.ciphertext);
  const key = await deriveKey(passphrase, salt);

  const plaintext = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext
  );

  const decoder = new TextDecoder();
  return decoder.decode(plaintext);
}

export function isEncryptedData(obj: unknown): obj is EncryptedData {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.ciphertext === 'string' &&
    typeof o.iv === 'string' &&
    typeof o.salt === 'string'
  );
}

// ─── Binary (Uint8Array) encryption ─────────────────────────────────────────

/**
 * Encrypt a Uint8Array (e.g. Y.Doc binary state) into EncryptedData.
 * The binary is base64-encoded before being handed to the string encrypt().
 */
export async function encryptBinary(data: Uint8Array, passphrase: string): Promise<EncryptedData> {
  // Convert Uint8Array to base64 string
  const base64 = btoa(String.fromCharCode(...data));
  return encrypt(base64, passphrase);
}

/**
 * Decrypt EncryptedData back into a Uint8Array.
 */
export async function decryptBinary(data: EncryptedData, passphrase: string): Promise<Uint8Array> {
  const base64 = await decrypt(data, passphrase);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
