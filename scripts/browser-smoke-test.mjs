#!/usr/bin/env node
/**
 * Lightweight browser-free smoke test for MotionAI.
 * Starts the built server, probes key endpoints, and verifies
 * the app serves correctly. No Playwright dependency required.
 */
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import http from 'node:http';
import { resolve } from 'node:path';

const PORT = 3099;
const BASE = `http://localhost:${PORT}`;
const cwd = resolve(process.cwd());

let passed = 0;
let failed = 0;

function test(name, ok) {
  if (ok) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.error(`  ✗ ${name}`);
    failed++;
  }
}

async function fetchUrl(path) {
  return new Promise((resolve, reject) => {
    const req = http.get(`${BASE}${path}`, { timeout: 5000 }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf-8') }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function fetchUrlPost(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: 'localhost', port: PORT, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      timeout: 5000,
    };
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf-8') }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('=== MotionAI Browser Smoke Test ===\n');

  console.log('1. Starting server...');
  const env = { ...process.env, PORT: String(PORT), NODE_ENV: 'production', GEMINI_API_KEY: '', OPENAI_API_KEY: '', OLLAMA_API_KEY: '' };
  const serverProcess = spawn('node', ['dist/server.cjs'], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });

  let serverOutput = '';
  serverProcess.stdout.on('data', (d) => { serverOutput += d.toString(); });
  serverProcess.stderr.on('data', (d) => { serverOutput += d.toString(); });

  // Wait for server to start
  await new Promise((resolve) => setTimeout(resolve, 2000));
  for (let i = 0; i < 10; i++) {
    try { await fetchUrl('/'); break; }
    catch { await new Promise((r) => setTimeout(r, 1000)); }
  }

  console.log('\n2. Running smoke checks...\n');

  try {
    // Check index.html serves
    const indexRes = await fetchUrl('/');
    test('Serves index.html on GET /', indexRes.status === 200 && indexRes.body.includes('<html'));
    test('Content-Type is text/html for SPA fallback', (indexRes.headers['content-type'] || '').includes('text/html'));
    test('React root mount point exists', indexRes.body.includes('id="root"') || indexRes.body.includes("id='root'"));

    // Check API probe endpoint (POST)
    const probeRes = await fetchUrlPost('/api/ai/probe', {});
    test('AI probe endpoint returns 200', probeRes.status === 200);
    if (probeRes.status === 200) {
      const body = JSON.parse(probeRes.body);
      test('Probe response has provider info', body && typeof body.provider === 'object');
      test('Probe response hides API keys', body.keysReturned === false);
      test('Probe includes rate-limit headers', Boolean(probeRes.headers['x-ratelimit-limit']));
    }

    // Check generate endpoint guards
    const generateRes = await fetchUrlPost('/api/ai/generate', {});
    test('AI generate guards without key (503)', generateRes.status === 503);
    if (generateRes.status === 503) {
      const body = JSON.parse(generateRes.body);
      test('Generate response has keysReturned: false', body.keysReturned === false);
    }

    // Check spellcheck endpoint
    const spellRes = await fetchUrlPost('/api/ai/spellcheck', {});
    test('Spellcheck guards when AI unconfigured (503)', spellRes.status === 503);
      if (spellRes.status === 503) {
        const body = JSON.parse(spellRes.body);
        test('Spellcheck error is safe provider-unavailable message', body.error && /not configured|disabled/i.test(body.error));
      }

    // Check chat endpoint
    const chatRes = await fetchUrlPost('/api/ai/chat', {});
    test('Chat guards when AI unconfigured (503)', chatRes.status === 503);
      if (chatRes.status === 503) {
        const body = JSON.parse(chatRes.body);
        test('Chat error is safe provider-unavailable message', body.error && /not configured|disabled/i.test(body.error));
      }
  } catch (err) {
    console.error(`\n  ✗ Smoke test error: ${err.message}`);
    failed++;
  } finally {
    serverProcess.kill('SIGTERM');
    await once(serverProcess, 'close').catch(() => {});
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => { console.error('Smoke test error:', err); process.exit(1); });
