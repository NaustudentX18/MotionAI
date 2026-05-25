import { webcrypto } from 'node:crypto';
import {
  clearPin,
  getPinLockoutMs,
  hasPin,
  isLocked,
  lock,
  registerFailedPin,
  setPin,
  unlock,
  verifyPin,
} from '../src/lib/localAuth';

type StorageValue = string;

class MemoryStorage {
  private readonly values = new Map<string, StorageValue>();

  getItem(key: string): string | null {
    return this.values.has(key) ? this.values.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  clear(): void {
    this.values.clear();
  }
}

const local = new MemoryStorage();
const session = new MemoryStorage();

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: local,
});
Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  value: session,
});
Object.defineProperty(globalThis, 'crypto', {
  configurable: true,
  value: webcrypto,
});

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function expectRejects(fn: () => Promise<unknown>, message: string): Promise<void> {
  let rejected = false;
  try {
    await fn();
  } catch {
    rejected = true;
  }
  assert(rejected, message);
}

async function run(): Promise<void> {
  clearPin();
  assert(!hasPin(), 'PIN should be absent after clear');
  assert(!isLocked(), 'App should not be locked when no PIN is configured');

  await expectRejects(() => setPin('12345'), 'Short PIN should be rejected');
  await expectRejects(() => setPin('abcdef'), 'Non-numeric PIN should be rejected');

  await setPin('123456');
  assert(hasPin(), 'PIN should be configured after setPin');
  assert(isLocked(), 'Newly configured PIN should start locked');
  assert(!(await verifyPin('000000')), 'Wrong PIN must fail');
  assert(await verifyPin('123456'), 'Correct PIN must pass');

  const rawRecord = local.getItem('motionai_local_auth') ?? '';
  assert(!rawRecord.includes('123456'), 'Raw PIN must never be stored');
  assert(/"salt":/.test(rawRecord) && /"hash":/.test(rawRecord), 'Stored record should include salt and hash');

  unlock();
  assert(!isLocked(), 'Unlock should persist for the current session');
  lock();
  assert(isLocked(), 'Lock should clear the session unlock flag');

  const lockoutStart = Date.now();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    assert(registerFailedPin(lockoutStart) === 0, 'First four bad attempts should not lock out');
  }
  assert(registerFailedPin(lockoutStart) === 60_000, 'Fifth bad attempt should trigger a 60 second lockout');
  assert(getPinLockoutMs(lockoutStart + 30_000) === 30_000, 'Lockout countdown should report remaining time');
  assert(!(await verifyPin('123456')), 'PIN verification should fail closed during lockout');
  assert(getPinLockoutMs(lockoutStart + 60_001) === 0, 'Lockout should expire after its window');

  local.setItem('motionai_local_auth', '{not-valid-json');
  assert(!(await verifyPin('123456')), 'Malformed auth record should fail closed');

  clearPin();
  assert(!hasPin(), 'clearPin should remove configured PIN');

  console.log('✅ local auth tests passed');
}

run().catch(error => {
  console.error('❌ local auth tests failed');
  console.error(error);
  process.exit(1);
});
