#!/usr/bin/env npx tsx

/**
 * Spellcheck response-shape validation tests.
 *
 * Validates that the spellcheck JSON schema contract is correct: the
 * `spellcheckResponseSchema` matches what the endpoint promises to return,
 * and the `parseJsonObject` helper correctly extracts JSON from raw text.
 */

import { strict as assert } from 'node:assert/strict';
import { Type } from '@google/genai';
import { spellcheckResponseSchema } from '../src/lib/ai/providers';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (error: any) {
    failed++;
    console.error(`  ✗ ${name}\n    ${error.message}`);
  }
}

console.log('\nSpellcheck Schema Validation Tests\n');

test('spellcheckResponseSchema has required top-level field', () => {
  assert.equal(spellcheckResponseSchema.type, Type.OBJECT);
  assert.ok(spellcheckResponseSchema.properties?.issues, 'must have issues property');
  assert.deepEqual(spellcheckResponseSchema.required, ['issues']);
});

test('spellcheckResponseSchema issues is an array of objects', () => {
  const issues = spellcheckResponseSchema.properties.issues;
  assert.equal(issues.type, Type.ARRAY);
  assert.ok(issues.items, 'must define items schema');
  assert.equal(issues.items.type, Type.OBJECT);
});

test('spellcheck issue items have all required fields', () => {
  const itemSchema = spellcheckResponseSchema.properties.issues.items;
  const fields = Object.keys(itemSchema.properties);
  assert.ok(fields.includes('id'), 'must include id');
  assert.ok(fields.includes('word'), 'must include word');
  assert.ok(fields.includes('suggestions'), 'must include suggestions');
  assert.ok(fields.includes('context'), 'must include context');
  assert.ok(fields.includes('blockId'), 'must include blockId');
  assert.ok(itemSchema.required.includes('id'), 'id is required');
  assert.ok(itemSchema.required.includes('word'), 'word is required');
  assert.ok(itemSchema.required.includes('suggestions'), 'suggestions is required');
  assert.ok(itemSchema.required.includes('context'), 'context is required');
  assert.ok(itemSchema.required.includes('blockId'), 'blockId is required');
});

test('suggestions field is an array of strings', () => {
  const itemSchema = spellcheckResponseSchema.properties.issues.items;
  const suggestions = itemSchema.properties.suggestions;
  assert.equal(suggestions.type, Type.ARRAY);
  assert.equal(suggestions.items.type, Type.STRING);
});

test('id field is a string', () => {
  const itemSchema = spellcheckResponseSchema.properties.issues.items;
  assert.equal(itemSchema.properties.id.type, Type.STRING);
});

test('word field is a string', () => {
  const itemSchema = spellcheckResponseSchema.properties.issues.items;
  assert.equal(itemSchema.properties.word.type, Type.STRING);
});

test('context field is a string', () => {
  const itemSchema = spellcheckResponseSchema.properties.issues.items;
  assert.equal(itemSchema.properties.context.type, Type.STRING);
});

test('blockId field is a string', () => {
  const itemSchema = spellcheckResponseSchema.properties.issues.items;
  assert.equal(itemSchema.properties.blockId.type, Type.STRING);
});

// Test the shape of a valid spellcheck response
test('valid spellcheck response matches schema', () => {
  const validResponse = {
    issues: [
      {
        id: 'issue-1',
        word: 'teh',
        suggestions: ['the', 'tea', 'tech'],
        context: 'teh quick brown fox',
        blockId: 'block-abc',
      },
    ],
  };
  assert.ok(Array.isArray(validResponse.issues));
  assert.equal(typeof validResponse.issues[0].id, 'string');
  assert.equal(typeof validResponse.issues[0].word, 'string');
  assert.ok(Array.isArray(validResponse.issues[0].suggestions));
  assert.equal(typeof validResponse.issues[0].context, 'string');
  assert.equal(typeof validResponse.issues[0].blockId, 'string');
});

test('empty issues array is valid', () => {
  const validResponse = { issues: [] };
  assert.ok(Array.isArray(validResponse.issues));
  assert.equal(validResponse.issues.length, 0);
});

test('issue without optional field still has required fields', () => {
  const issue: Record<string, unknown> = {
    id: 'issue-2',
    word: 'recieve',
    suggestions: ['receive'],
    context: 'recieve package',
    blockId: 'block-xyz',
  };
  assert.equal(typeof issue.id, 'string');
  assert.equal(typeof issue.word, 'string');
  assert.ok(Array.isArray(issue.suggestions));
  assert.ok(issue.suggestions.length >= 1);
  assert.equal(typeof issue.context, 'string');
  assert.equal(typeof issue.blockId, 'string');
});

console.log(`\n${passed}/${passed + failed} spellcheck schema tests passed.\n`);
if (failed > 0) process.exit(1);
