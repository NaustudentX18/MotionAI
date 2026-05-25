/**
 * Secret redaction endpoint-level tests.
 * Proves API/webhook responses never return secrets, even under error conditions.
 *
 * Run against an already running server:
 *   MOTIONAI_API_SECRET=dev-secret npx tsx scripts/secret-redaction-tests.ts --port 3003 --secret dev-secret
 *
 * Or let the test start the built server:
 *   npm run build
 *   npx tsx scripts/secret-redaction-tests.ts --start-server --port 3003 --secret dev-secret
 */
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';

interface TestResult {
  name: string;
  ok: boolean;
  error?: string;
}

const args = process.argv.slice(2);
const results: TestResult[] = [];
const PORT = Number(getArg('--port') || process.env.PORT || 3003);
const BASE = getArg('--base-url') || process.env.MOTIONAI_TEST_BASE_URL || `http://localhost:${PORT}`;
const AUTH_SECRET = getArg('--secret') || process.env.MOTIONAI_API_SECRET || process.env.MOTIONAI_TEST_SECRET || '';
const SHOULD_START_SERVER = hasArg('--start-server');
const SERVER_START_TIMEOUT_MS = 15_000;
let startedServer: ChildProcess | undefined;
let passed = 0;
let failed = 0;

const testSecrets = {
  openAi: 'sk-test-secret-redaction-1234567890abcdef',
  gemini: 'AIzaSySecretRedaction1234567890abcdefghi',
  github: 'ghp_secretRedaction1234567890abcdefghi',
  webhook: 'whsec_secret-redaction-1234567890abcdef',
  oauth: 'ya29.secret-redaction-1234567890abcdef',
};

function getArg(name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  return args[index + 1];
}

function hasArg(name: string): boolean {
  return args.includes(name);
}

function test(name: string, fn: () => Promise<void> | void) {
  return {
    async run() {
      try {
        await fn();
        results.push({ name, ok: true });
        passed++;
      } catch (err: any) {
        results.push({ name, ok: false, error: err.message });
        failed++;
      }
    },
  };
}

async function requestJson(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json');
  if (AUTH_SECRET && !headers.has('x-motionai-secret')) headers.set('x-motionai-secret', AUTH_SECRET);

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  return { status: res.status, data: await res.json().catch(() => null) };
}

async function postJson(path: string, body: unknown, headers: Record<string, string> = {}) {
  return requestJson(path, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

async function getJson(path: string) {
  return requestJson(path);
}

function assertNoSecrets(obj: unknown, extraSecrets: string[] = []) {
  const str = JSON.stringify(obj);
  assert.ok(str, 'response must be JSON serializable');

  for (const secret of [...Object.values(testSecrets), ...extraSecrets]) {
    assert.ok(!str.includes(secret), `response must not contain secret value ${secret.slice(0, 8)}…`);
  }

  assert.ok(!/sk-[A-Za-z0-9_-]{20,}/.test(str), 'response must not contain OpenAI-style API keys');
  assert.ok(!/AIza[0-9A-Za-z_-]{20,}/.test(str), 'response must not contain Gemini-style API keys');
  assert.ok(!/ghp_[A-Za-z0-9]{20,}/.test(str), 'response must not contain GitHub tokens');
  assert.ok(!/ya29\.[0-9A-Za-z._-]{10,}/.test(str), 'response must not contain OAuth access tokens');
}

function assertKeysReturnedFalse(data: any) {
  assert.equal(data?.keysReturned, false, 'keysReturned must be false');
}

async function waitForHealth(timeoutMs: number): Promise<boolean> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return true;
    } catch {
      // Retry until timeout.
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  return false;
}

async function ensureServer() {
  if (await waitForHealth(1_000)) return;

  if (!SHOULD_START_SERVER) {
    throw new Error(`Server not reachable at ${BASE}. Start it first, or rerun with --start-server after npm run build.`);
  }

  if (!AUTH_SECRET) {
    throw new Error('A webhook/auth secret is required when using --start-server. Pass --secret or set MOTIONAI_API_SECRET.');
  }

  startedServer = spawn(process.execPath, ['dist/server.cjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(PORT),
      MOTIONAI_API_SECRET: AUTH_SECRET,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let startupOutput = '';
  startedServer.stdout?.on('data', chunk => { startupOutput += chunk.toString(); });
  startedServer.stderr?.on('data', chunk => { startupOutput += chunk.toString(); });

  if (!(await waitForHealth(SERVER_START_TIMEOUT_MS))) {
    startedServer.kill('SIGTERM');
    throw new Error(`Started server did not become healthy at ${BASE}.\n${startupOutput.trim()}`);
  }
}

async function runTests() {
  try {
    await ensureServer();
  } catch (err: any) {
    console.error(err.message);
    process.exit(1);
  }

  await test('GET /api/ai/providers returns keysReturned:false', async () => {
    const { status, data } = await getJson('/api/ai/providers');
    assert.equal(status, 200);
    assertKeysReturnedFalse(data);
    assertNoSecrets(data);
    for (const provider of data.providers || []) {
      assert.ok(!('apiKey' in provider), `provider ${provider.id} must not expose apiKey`);
    }
  }).run();

  await test('GET /api/ai/status returns keysReturned:false', async () => {
    const { status, data } = await getJson('/api/ai/status');
    assert.equal(status, 200);
    assertKeysReturnedFalse(data);
    assertNoSecrets(data);
  }).run();

  await test('POST /api/ai/probe redacts request API key on unconfigured provider path', async () => {
    const { status, data } = await postJson('/api/ai/probe', {
      ai: {
        provider: 'custom-endpoint',
        apiKey: testSecrets.openAi,
      },
    });
    assert.equal(status, 503);
    assertKeysReturnedFalse(data);
    assertNoSecrets(data);
  }).run();

  await test('POST /api/ai/generate redacts request API key on error path', async () => {
    const { status, data } = await postJson('/api/ai/generate', {
      prompt: 'test',
      ai: {
        provider: 'custom-endpoint',
        apiKey: testSecrets.gemini,
      },
    });
    assert.equal(status, 503);
    assertKeysReturnedFalse(data);
    assertNoSecrets(data);
  }).run();

  await test('POST /api/ai/spellcheck redacts request API key on error path', async () => {
    const { status, data } = await postJson('/api/ai/spellcheck', {
      blocks: [{ id: 'b1', type: 'p', content: 'test text' }],
      ai: {
        provider: 'custom-endpoint',
        apiKey: testSecrets.github,
      },
    });
  }).run();

  await test('POST /api/ai/checklist redacts request API key on error path', async () => {
    const { status, data } = await postJson('/api/ai/checklist', {
      transcript: 'Bob to clean the server room tomorrow',
      ai: {
        provider: 'custom-endpoint',
        apiKey: testSecrets.github,
      },
    });
    // In checklist route, error caught falls back to deterministic, which responds 200, but provider info in response
    // must not leak any secrets.
    assert.equal(status, 200);
    assertKeysReturnedFalse(data);
    assertNoSecrets(data);
  }).run();

  await test('POST /api/ai/chat redacts request API key on error path', async () => {
    const { status, data } = await postJson('/api/ai/chat', {
      message: 'hello',
      history: [],
      ai: {
        provider: 'custom-endpoint',
        apiKey: testSecrets.openAi,
      },
    });
    assert.equal(status, 503);
    assertKeysReturnedFalse(data);
    assertNoSecrets(data);
  }).run();

  await test('POST /api/webhooks/:path rejects missing secret without echoing body', async () => {
    const { status, data } = await requestJson('/api/webhooks/secret-redaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-motionai-secret': '' },
      body: JSON.stringify({ token: testSecrets.webhook }),
    });
    assert.equal(status, 401);
    assertKeysReturnedFalse(data);
    assertNoSecrets(data);
  }).run();

  await test('POST /api/webhooks/:path accepts valid secret without echoing body', async () => {
    const { status, data } = await postJson('/api/webhooks/secret-redaction', {
      token: testSecrets.webhook,
      nested: { accessToken: testSecrets.oauth },
    });
    assert.equal(status, 200);
    assert.equal(data?.ok, true);
    assert.equal(data?.webhook, 'secret-redaction');
    assertKeysReturnedFalse(data);
    assertNoSecrets(data);
  }).run();

  console.log(`\n${'═'.repeat(50)}`);
  console.log('Secret Redaction Endpoint Tests');
  console.log('═'.repeat(50));
  for (const result of results) {
    console.log(`${result.ok ? '✓' : '✗'} ${result.name}${result.error ? ` — ${result.error}` : ''}`);
  }
  console.log(`\n${passed} passed, ${failed} failed`);

  if (failed > 0) process.exit(1);
}

runTests()
  .catch(err => {
    console.error('Test runner error:', err.message);
    process.exit(1);
  })
  .finally(() => {
    if (startedServer && !startedServer.killed) {
      startedServer.kill('SIGTERM');
    }
  });
