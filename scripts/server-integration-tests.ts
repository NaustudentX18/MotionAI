/**
 * Server integration tests for auth and health endpoints.
 *
 * Skips gracefully when no test secret is configured.
 * Set MOTIONAI_TEST_SECRET or MOTIONAI_API_SECRET, or pass --secret.
 *
 *   MOTIONAI_TEST_SECRET=integration-test npx tsx scripts/server-integration-tests.ts --start-server
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';

interface HttpResponse {
  status: number;
  body: string;
  headers: http.IncomingHttpHeaders;
}

const args = process.argv.slice(2);
const PORT = Number(getArg('--port') || process.env.MOTIONAI_TEST_PORT || 3314);
const HOST = getArg('--host') || '127.0.0.1';
const BASE = getArg('--base-url') || process.env.MOTIONAI_TEST_BASE_URL || `http://${HOST}:${PORT}`;
const AUTH_SECRET = getArg('--secret') || process.env.MOTIONAI_TEST_SECRET || process.env.MOTIONAI_API_SECRET || '';
const SHOULD_START_SERVER = hasArg('--start-server') || Boolean(AUTH_SECRET);
const SERVER_START_TIMEOUT_MS = 20_000;

let startedServer: ChildProcess | undefined;

function getArg(name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  return args[index + 1];
}

function hasArg(name: string): boolean {
  return args.includes(name);
}

function request(
  method: string,
  path: string,
  options: {
    headers?: Record<string, string>;
    body?: string;
  } = {},
): Promise<HttpResponse> {
  const url = new URL(path, BASE);

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method,
        headers: options.headers,
      },
      res => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          resolve({
            status: res.statusCode || 0,
            body,
            headers: res.headers,
          });
        });
      },
    );

    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function waitForHealth(timeoutMs: number): Promise<boolean> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const res = await request('GET', '/api/health');
      if (res.status === 200) return true;
    } catch {
      // Retry until timeout.
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  return false;
}

async function ensureServer(): Promise<void> {
  if (!SHOULD_START_SERVER) {
    if (!(await waitForHealth(1_000))) {
      throw new Error(`Server not reachable at ${BASE}. Start it first or rerun with --start-server.`);
    }
    return;
  }

  if (!AUTH_SECRET) {
    throw new Error('A test secret is required to start the server. Set MOTIONAI_TEST_SECRET or pass --secret.');
  }

  startedServer = spawn('npx', ['tsx', 'server.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'test',
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

async function runTests(): Promise<void> {
  if (!AUTH_SECRET) {
    console.log('Skipping server integration tests (set MOTIONAI_TEST_SECRET or MOTIONAI_API_SECRET to run).');
    return;
  }

  await ensureServer();

  const health = await request('GET', '/api/health');
  assert.equal(health.status, 200, 'GET /api/health should return 200');
  const healthJson = JSON.parse(health.body);
  assert.equal(healthJson.ok, true, 'health payload should include ok:true');
  console.log('✓ GET /api/health returns 200');

  const uploadBody = JSON.stringify({
    name: 'test.png',
    type: 'image/png',
    data: Buffer.from('fake').toString('base64'),
  });
  const uploadUnauthorized = await request('POST', '/api/upload/image', {
    headers: { 'Content-Type': 'application/json' },
    body: uploadBody,
  });
  assert.equal(uploadUnauthorized.status, 401, 'POST /api/upload/image without secret should return 401');
  console.log('✓ POST /api/upload/image returns 401 without x-motionai-secret');

  const aiUnauthorized = await request('POST', '/api/ai/generate', {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'hello' }),
  });
  assert.equal(aiUnauthorized.status, 401, 'POST /api/ai/generate without secret should return 401');
  console.log('✓ POST /api/ai/generate returns 401 without x-motionai-secret');

  const authorized = await request('POST', '/api/ai/generate', {
    headers: {
      'Content-Type': 'application/json',
      'x-motionai-secret': AUTH_SECRET,
    },
    body: JSON.stringify({ prompt: 'hello', disabled: true }),
  });
  assert.notEqual(
    authorized.status,
    401,
    `authorized AI request should not be 401 (got ${authorized.status}: ${authorized.body.slice(0, 200)})`,
  );
  console.log(`✓ POST /api/ai/generate accepts valid x-motionai-secret (status ${authorized.status})`);
}

runTests()
  .then(() => {
    console.log('\nServer integration tests passed.');
  })
  .catch(err => {
    console.error('\nServer integration tests failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => {
    if (startedServer && !startedServer.killed) {
      startedServer.kill('SIGTERM');
    }
  });
