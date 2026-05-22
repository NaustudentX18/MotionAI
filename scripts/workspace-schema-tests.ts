#!/usr/bin/env npx tsx

import { strict as assert } from 'node:assert/strict';
import { BLOCK_TYPES, PAGE_TYPES, type Block, type Page } from '../src/types';
import {
  WORKSPACE_APP_ID,
  WORKSPACE_SCHEMA_VERSION,
  assertValidWorkspaceSnapshot,
  createVersionedWorkspaceSnapshot,
  validateWorkspaceSnapshot,
} from '../src/lib/workspaceSchema';
import { createWorkspaceEnvelope, WORKSPACE_EXPORT_SCHEMA } from '../src/lib/workspaceImportExport';

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

test('accepts every runtime-supported block type, including database', () => {
  const blocks = BLOCK_TYPES.map((type, index) => block(`b-${index}`, { type }));
  const result = validateWorkspaceSnapshot({ pages: [page('p1', blocks)], currentPageId: 'p1' });
  assert.equal(result.ok, true, result.errors.join('; '));
});

test('accepts every runtime-supported page type', () => {
  for (const pageType of PAGE_TYPES) {
    const result = validateWorkspaceSnapshot({ pages: [page(`p-${pageType}`, [block(`b-${pageType}`)], { pageType })], currentPageId: `p-${pageType}` });
    assert.equal(result.ok, true, `${pageType}: ${result.errors.join('; ')}`);
  }
});

test('rejects unsupported block and page types', () => {
  const badBlock = { id: 'b1', type: 'unsupported-widget', content: '' };
  const badPage = page('p1', [badBlock as Block], { pageType: 'unsupported-page' as Page['pageType'] });
  const result = validateWorkspaceSnapshot({ pages: [badPage], currentPageId: 'p1' });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /supported block type/);
  assert.match(result.errors.join('\n'), /supported page type/);
});

test('creates a versioned export wrapper only for valid snapshots', () => {
  const exported = createVersionedWorkspaceSnapshot({ pages: [page('p1')], currentPageId: 'p1' }, '2026-05-21T00:00:00.000Z');
  assert.equal(exported.schemaVersion, WORKSPACE_SCHEMA_VERSION);
  assert.equal(exported.app, WORKSPACE_APP_ID);
  assert.equal(exported.exportedAt, '2026-05-21T00:00:00.000Z');
});

test('creates the durable motionai.workspace envelope shape', () => {
  const envelope = createWorkspaceEnvelope({ pages: [page('p1')], currentPageId: 'p1' }, { exportedAt: '2026-05-22T00:00:00.000Z', source: 'test' });
  assert.equal(envelope.schema, WORKSPACE_EXPORT_SCHEMA);
  assert.equal(envelope.schemaVersion, WORKSPACE_SCHEMA_VERSION);
  assert.equal(envelope.workspace.currentPageId, 'p1');
});

test('validates page versions and rejects corrupt version blocks', () => {
  const result = validateWorkspaceSnapshot({
    pages: [page('p1', [block('b1')], {
      versions: [{ id: 'v1', timestamp: 1_779_360_000_000, title: 'Old', blocks: [{ id: 'old-b1', type: 'not-real', content: '' } as unknown as Block] }],
    })],
    currentPageId: 'p1',
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /versions\[0\]\.blocks\[0\]\.type/);
});

test('assertValidWorkspaceSnapshot throws actionable errors', () => {
  assert.throws(
    () => assertValidWorkspaceSnapshot({ pages: 'not-pages', currentPageId: null }),
    /Invalid workspace snapshot: pages must be an array/
  );
});

console.log(`\n${passed}/${passed + failed} workspace schema tests passed.\n`);
if (failed > 0) process.exit(1);
