#!/usr/bin/env npx tsx

/**
 * Credential-free AI contract tests.
 *
 * Validates endpoint guard behavior and response shapes without needing
 * a real Gemini/Ollama/OpenAI key. Uses disabled, unconfigured, local,
 * and custom endpoint provider paths.
 */

import { strict as assert } from 'node:assert/strict';
import {
  createAiClient,
  extractAiSettings,
  getConfiguredProviders,
  probeAi,
  providerUnavailableMessage,
  safeErrorMessage,
} from '../src/lib/ai/providers';
import { checkRateLimit, resetRateLimitStore } from '../src/lib/rateLimit';

const AI_ENV_KEYS = [
  'AI_PROVIDER',
  'GEMINI_API_KEY',
  'GEMINI_MODEL',
  'OPENAI_API_KEY',
  'OPENAI_BASE_URL',
  'OPENAI_MODEL',
  'OLLAMA_API_KEY',
  'OLLAMA_BASE_URL',
  'OLLAMA_MODEL',
  'LM_STUDIO_API_KEY',
  'LM_STUDIO_BASE_URL',
  'LM_STUDIO_MODEL',
  'VLLM_API_KEY',
  'VLLM_BASE_URL',
  'VLLM_MODEL',
  'CUSTOM_AI_API_KEY',
  'CUSTOM_AI_BASE_URL',
  'CUSTOM_AI_MODEL',
];
for (const key of AI_ENV_KEYS) delete process.env[key];

let passed = 0;
let failed = 0;
const tests: Array<{ name: string; fn: () => void | Promise<void> }> = [];

function test(name: string, fn: () => void | Promise<void>) {
  tests.push({ name, fn });
}

async function runTest(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (error: any) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${error.message}`);
  }
}

async function run() {
  console.log('\nAI Contract Tests\n');

  // --- creation: explicit disabled ---
  test('createAiClient with disabled:true returns disabled client', () => {
    const client = createAiClient({ disabled: true, provider: 'gemini', apiKey: 'fake-key' });
    assert.equal(client.info.id, 'disabled');
    assert.equal(client.info.enabled, false);
  });

  test('createAiClient with explicit disabled provider returns disabled client', () => {
    const client = createAiClient({ provider: 'none' });
    assert.equal(client.info.id, 'disabled');
    assert.equal(client.info.enabled, false);
  });

  test('createAiClient with provider none and explicit apiKey still returns disabled', () => {
    const client = createAiClient({ provider: 'off', apiKey: 'some-key' });
    assert.equal(client.info.id, 'disabled');
    assert.equal(client.info.enabled, false);
  });

  // --- creation: enabled/configured status ---
  test('createAiClient with gemini and apiKey returns configured enabled client', () => {
    const client = createAiClient({ provider: 'gemini', apiKey: 'test-key' });
    assert.equal(client.info.id, 'gemini');
    assert.equal(client.info.configured, true);
    assert.equal(client.info.enabled, true);
    assert.equal(client.info.keysReturned, false);
  });

  test('createAiClient with openai-compatible remote URL requires an apiKey', () => {
    const client = createAiClient({ provider: 'openai', baseUrl: 'https://api.openai.example/v1', model: 'test-model' });
    assert.equal(client.info.id, 'openai-compatible');
    assert.equal(client.info.configured, false);
    assert.match(providerUnavailableMessage(client.info), /API key/);
  });

  test('createAiClient with openai-compatible and baseUrl returns configured enabled client', () => {
    const client = createAiClient({ provider: 'openai', baseUrl: 'http://localhost:8080/v1', model: 'test-model', apiKey: 'test-key' });
    assert.equal(client.info.id, 'openai-compatible');
    assert.equal(client.info.configured, true);
    assert.equal(client.info.enabled, true);
  });

  test('createAiClient supports custom endpoint aliases without defaulting to hosted OpenAI', () => {
    const client = createAiClient({ provider: 'custom', baseUrl: 'http://localhost:9000/v1', model: 'custom-model' });
    assert.equal(client.info.id, 'custom-endpoint');
    assert.equal(client.info.label, 'Custom endpoint');
    assert.equal(client.info.configured, true);
    assert.equal(client.info.keysReturned, false);
  });

  test('custom endpoint unconfigured error is non-secret and actionable', () => {
    const secret = 'sk-custom-secret-12345';
    const client = createAiClient({ provider: 'custom-endpoint', apiKey: secret });
    const message = providerUnavailableMessage(client.info);
    assert.match(message, /Custom endpoint is not configured/);
    assert.ok(!message.includes(secret), 'unconfigured message must not include provided API key');
  });

  test('disabled client generateText throws an error', async () => {
    const client = createAiClient({ disabled: true });
    await assert.rejects(() => client.generateText('test prompt'), /disabled/i);
  });

  // --- extractAiSettings ---
  test('extractAiSettings extracts from flat body fields', () => {
    const settings = extractAiSettings({ provider: 'gemini', model: 'test-model', apiKey: 'test-key' });
    assert.equal(settings.provider, 'gemini');
    assert.equal(settings.model, 'test-model');
    assert.equal(settings.apiKey, 'test-key');
  });

  test('extractAiSettings extracts from nested ai object', () => {
    const settings = extractAiSettings({ ai: { provider: 'ollama', model: 'llama3' } });
    assert.equal(settings.provider, 'ollama');
    assert.equal(settings.model, 'llama3');
  });

  test('extractAiSettings extracts from nested settings object', () => {
    const settings = extractAiSettings({ settings: { provider: 'lmstudio', model: 'local-model' } });
    assert.equal(settings.provider, 'lmstudio');
    assert.equal(settings.model, 'local-model');
  });

  test('extractAiSettings extracts from nested providerConfig object', () => {
    const settings = extractAiSettings({ providerConfig: { provider: 'vllm', model: 'deepseek' } });
    assert.equal(settings.provider, 'vllm');
    assert.equal(settings.model, 'deepseek');
  });

  // --- getConfiguredProviders ---
  test('getConfiguredProviders returns all provider infos with keysReturned: false', () => {
    const providers = getConfiguredProviders();
    assert.ok(providers.length >= 7);
    assert.ok(providers.some(p => p.id === 'custom-endpoint'), 'custom endpoint should be listed');
    for (const p of providers) {
      assert.equal(p.keysReturned, false, `${p.id} must return keysReturned: false`);
      assert.ok(!('apiKey' in p), `${p.id} must not expose an apiKey field`);
    }
  });

  // --- probeAi ---
  test('probeAi with disabled provider returns ok: true', async () => {
    const result = await probeAi({ disabled: true });
    assert.equal(result.ok, true);
    assert.equal(result.provider.enabled, false);
    assert.equal(result.provider.keysReturned, false);
  });

  test('probeAi with unconfigured provider returns ok: true for disabled', async () => {
    const result = await probeAi({ provider: 'none' });
    assert.equal(result.ok, true);
    assert.equal(result.provider.enabled, false);
  });

  test('probeAi with unconfigured custom endpoint returns 503-safe shape', async () => {
    const secret = 'sk-custom-probe-secret-12345';
    const result = await probeAi({ provider: 'custom-endpoint', apiKey: secret });
    assert.equal(result.ok, false);
    assert.equal(result.provider.id, 'custom-endpoint');
    assert.equal(result.provider.keysReturned, false);
    assert.ok(!result.message.includes(secret), 'probe message must not include provided API key');
    assert.match(result.message, /base URL and model name/);
  });

  // --- safeErrorMessage ---
  test('safeErrorMessage redacts API keys from error messages', () => {
    const fakeKey = 'sk-' + 'proj-' + 'FakeKey12345';
    const sanitized = safeErrorMessage(new Error(`API key ${fakeKey} was rejected`), [fakeKey]);
    assert.ok(!sanitized.includes(fakeKey), 'API key should be redacted');
    assert.ok(sanitized.includes('[redacted]'), 'redacted placeholder should appear');
  });

  test('safeErrorMessage handles unknown error type gracefully', () => {
    const sanitized = safeErrorMessage(null);
    assert.equal(sanitized, 'Unknown AI provider error');
  });

  test('safeErrorMessage redacts inline key patterns', () => {
    const sanitized = safeErrorMessage(new Error('Authorization: Bearer token123'));
    assert.ok(sanitized.includes('Authorization=[redacted]'), 'bearer token should be redacted');
  });

  test('safeErrorMessage redacts custom endpoint secret extras', () => {
    const fakeKey = 'custom-secret-abc12345';
    const sanitized = safeErrorMessage(new Error(`upstream rejected ${fakeKey}`), [fakeKey]);
    assert.ok(!sanitized.includes(fakeKey), 'custom endpoint API key should be redacted');
  });

  // --- rateLimit ---
  test('checkRateLimit allows initial requests', () => {
    resetRateLimitStore();
    const result = checkRateLimit('127.0.0.1');
    assert.equal(result.allowed, true);
    assert.ok(result.remaining >= 0);
  });

  test('checkRateLimit sets response headers shape', () => {
    const result = checkRateLimit('127.0.0.2');
    assert.ok(typeof result.allowed === 'boolean');
    assert.ok(typeof result.remaining === 'number');
    assert.ok(typeof result.resetAt === 'number');
    assert.ok(result.resetAt > Date.now());
  });

  for (const { name, fn } of tests) {
    await runTest(name, fn);
  }

  console.log(`\n${passed}/${passed + failed} AI contract tests passed.\n`);
  if (failed > 0) process.exit(1);
}

run().catch(error => {
  console.error('Test suite error:', error);
  process.exit(1);
});
