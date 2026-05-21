#!/usr/bin/env npx tsx

/**
 * Credential-free AI contract tests.
 *
 * Validates endpoint guard behavior and response shapes without needing
 * a real Gemini/Ollama/OpenAI key. Uses the disabled provider and
 * unconfigured provider paths.
 */

import { strict as assert } from 'node:assert/strict';
import { createAiClient, extractAiSettings, getConfiguredProviders, probeAi, safeErrorMessage } from '../src/lib/ai/providers';
import { checkRateLimit, resetRateLimitStore } from '../src/lib/rateLimit';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  try {
    const result = fn();
    if (result instanceof Promise) {
      result.then(
        () => { passed++; console.log(`  ✓ ${name}`); },
        (error) => { failed++; console.error(`  ✗ ${name}\n    ${error.message}`); }
      );
    } else {
      passed++;
      console.log(`  ✓ ${name}`);
    }
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
  });

  test('createAiClient with openai-compatible and baseUrl returns configured enabled client', () => {
    const client = createAiClient({ provider: 'openai', baseUrl: 'http://localhost:8080/v1', apiKey: 'test-key' });
    assert.equal(client.info.id, 'openai-compatible');
    assert.equal(client.info.configured, true);
    assert.equal(client.info.enabled, true);
  });

  test('disabled client generateText throws an error', async () => {
    const client = createAiClient({ disabled: true });
    try {
      await client.generateText('test prompt');
      assert.fail('should have thrown');
    } catch (error: any) {
      assert.ok(error.message.includes('AI is disabled') || error.message.includes('disabled'), 'should mention disabled');
    }
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
    assert.ok(providers.length >= 5);
    for (const p of providers) {
      assert.equal(p.keysReturned, false, `${p.id} must return keysReturned: false`);
    }
  });

  // --- probeAi ---
  test('probeAi with disabled provider returns ok: true', async () => {
    const result = await probeAi({ disabled: true });
    assert.equal(result.ok, true);
    assert.equal(result.provider.enabled, false);
  });

  test('probeAi with unconfigured provider returns ok: true for disabled', async () => {
    const result = await probeAi({ provider: 'none' });
    assert.equal(result.ok, true);
    assert.equal(result.provider.enabled, false);
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

  console.log(`\n${passed}/${passed + failed} AI contract tests passed.\n`);
  if (failed > 0) process.exit(1);
}

run().catch(error => {
  console.error('Test suite error:', error);
  process.exit(1);
});
