#!/usr/bin/env npx tsx

import { strict as assert } from 'node:assert/strict';
import type { Block, Page } from '../src/types';
import {
  WORKSPACE_APP_ID,
  WORKSPACE_SCHEMA_VERSION,
  assertValidWorkspaceSnapshot,
  createVersionedWorkspaceSnapshot,
  validateWorkspaceSnapshot,
} from '../src/lib/workspaceSchema';

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

function block(id: string, overrides: Partial<Block> = {}): Block {
  return { id, type: 'p', content: `content-${id}`, ...overrides };
}

function page(id: string, blocks: Block[] = [block(`${id}-b1`)], overrides: Partial<Page> = {}): Page {
  return {
    id,
    title: `Page ${id}`,
    icon: null,
    cover: null,
    blocks,
    createdAt: 1_779_360_000_000,
    updatedAt: 1_779_360_000_000,
    ...overrides,
  };
}

console.log('\nWorkspace Schema Contract Tests\n');

test('validates a minimal current workspace snapshot', () => {
  const result = validateWorkspaceSnapshot({ pages: [page('p1')], currentPageId: 'p1' });
  assert.equal(result.ok, true, result.errors.join('; '));
});

test('accepts legacy snapshots without schemaVersion', () => {
  const result = validateWorkspaceSnapshot({ pages: [], currentPageId: null });
  assert.equal(result.ok, true, result.errors.join('; '));
});

test('rejects unknown schema versions', () => {
  const result = validateWorkspaceSnapshot({ schemaVersion: 999, pages: [], currentPageId: null });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /schemaVersion/);
});

test('rejects currentPageId values that do not reference a page', () => {
  const result = validateWorkspaceSnapshot({ pages: [page('p1')], currentPageId: 'missing' });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /currentPageId/);
});

test('rejects duplicate page ids', () => {
  const result = validateWorkspaceSnapshot({ pages: [page('p1'), page('p1')], currentPageId: 'p1' });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /duplicates another page/);
});

test('rejects duplicate block ids on a page', () => {
  const result = validateWorkspaceSnapshot({ pages: [page('p1', [block('b1'), block('b1')])], currentPageId: 'p1' });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /duplicates another block/);
});

test('rejects unsupported block types', () => {
  const badBlock = { id: 'b1', type: 'database', content: '' };
  const result = validateWorkspaceSnapshot({ pages: [page('p1', [badBlock as Block])], currentPageId: 'p1' });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /supported block type/);
});

test('creates a versioned export wrapper only for valid snapshots', () => {
  const exported = createVersionedWorkspaceSnapshot({ pages: [page('p1')], currentPageId: 'p1' }, '2026-05-21T00:00:00.000Z');
  assert.equal(exported.schemaVersion, WORKSPACE_SCHEMA_VERSION);
  assert.equal(exported.app, WORKSPACE_APP_ID);
  assert.equal(exported.exportedAt, '2026-05-21T00:00:00.000Z');
});

test('assertValidWorkspaceSnapshot throws actionable errors', () => {
  assert.throws(
    () => assertValidWorkspaceSnapshot({ pages: 'not-pages', currentPageId: null }),
    /Invalid workspace snapshot: pages must be an array/
  );
});

console.log(`\n${passed}/${passed + failed} workspace schema tests passed.\n`);
if (failed > 0) process.exit(1);
