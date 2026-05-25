#!/usr/bin/env npx tsx

/**
 * Level A import/export contract tests for MotionAI workspace backups.
 * These tests are credential-free and exercise only pure parsers/serializers.
 */

import { strict as assert } from 'node:assert/strict';
import type { WorkspaceSnapshot } from '../src/lib/persistence';
import { BLOCK_TYPES } from '../src/types';
import type { Block, BlockType, Page } from '../src/types';
import {
  WORKSPACE_EXPORT_MIME_TYPE,
  WORKSPACE_EXPORT_SCHEMA,
  UnsupportedWorkspaceSchemaVersionError,
  exportWorkspaceJson,
  importWorkspaceJson,
} from '../src/lib/workspaceImportExport';
import { WORKSPACE_SCHEMA_VERSION } from '../src/lib/workspaceSchema';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (error: any) {
    failed++;
    console.error(`  ✗ ${name}\n    ${error.stack ?? error.message}`);
  }
}

console.log('\nImport/Export Level A Tests\n');

function makeBlock(id: string, type: BlockType, content: string, overrides: Partial<Block> = {}): Block {
  return { id, type, content, ...overrides };
}

function makePage(id: string, title: string, blocks: Block[], overrides: Partial<Page> = {}): Page {
  return {
    id,
    title,
    icon: null,
    cover: null,
    blocks,
    createdAt: 1_779_360_000_000,
    updatedAt: 1_779_360_000_000,
    ...overrides,
  };
}

function makeSnapshot(): WorkspaceSnapshot {
  const page = makePage('page-1', 'Test Page', [
    makeBlock('block-1', 'h1', 'Heading'),
    makeBlock('block-2', 'todo', 'Task item', { checked: true, indentLevel: 1 }),
    makeBlock('block-3', 'code', 'const x = 1;', { language: 'typescript' }),
    makeBlock('block-4', 'p', 'Commented', {
      style: { bold: true, color: '#E03E3E' },
      comments: [{ id: 'c1', author: 'User', text: 'Great point', createdAt: 1_779_360_000_001 }],
    }),
    makeBlock('block-5', 'ai-summary', 'Summary content', { aiPrompt: 'summarize', aiContext: 'page' }),
  ], {
    icon: '🧪',
    cover: 'cover.png',
    pageType: 'block',
    reminderDate: '2026-05-25T09:30',
    versions: [
      { id: 'v1', timestamp: 1_779_360_000_002, title: 'Previous', blocks: [makeBlock('old-b1', 'p', 'Old')] },
    ],
  });
  return { pages: [page], currentPageId: 'page-1' };
}

// --- WorkspaceEnvelopeV1 export/import ---

test('exports a motionai.workspace JSON envelope with deterministic shape', () => {
  const exported = exportWorkspaceJson(makeSnapshot(), { exportedAt: '2026-05-22T00:00:00.000Z', source: 'test' });
  assert.equal(exported.mimeType, WORKSPACE_EXPORT_MIME_TYPE);
  assert.equal(exported.filename, 'motionai-workspace-2026-05-22T00-00-00Z.json');
  assert.ok(exported.body.endsWith('\n'));

  const parsed = JSON.parse(exported.body);
  assert.equal(parsed.schema, WORKSPACE_EXPORT_SCHEMA);
  assert.equal(parsed.schemaVersion, WORKSPACE_SCHEMA_VERSION);
  assert.equal(parsed.appName, 'MotionAI');
  assert.equal(parsed.source, 'test');
  assert.deepEqual(parsed.workspace, makeSnapshot());
});

test('round-trips a Level A workspace backup through replace mode', () => {
  const snapshot = makeSnapshot();
  const raw = exportWorkspaceJson(snapshot, { exportedAt: '2026-05-22T00:00:00.000Z', source: 'test' }).body;
  const imported = importWorkspaceJson(raw, { mode: 'replace' });
  assert.deepEqual(imported.snapshot, snapshot);
  assert.deepEqual(imported.warnings, []);
});

test('replace mode returns a recovery snapshot when existing workspace is supplied', () => {
  const existing: WorkspaceSnapshot = { pages: [makePage('existing', 'Existing', [makeBlock('existing-b1', 'p', 'Keep')])], currentPageId: 'existing' };
  const raw = exportWorkspaceJson(makeSnapshot(), { exportedAt: '2026-05-22T00:00:00.000Z', source: 'test' }).body;
  const imported = importWorkspaceJson(raw, { mode: 'replace', existing });
  assert.deepEqual(imported.recoverySnapshot, existing);
  assert.equal(imported.snapshot.currentPageId, 'page-1');
});

// --- Legacy and version safety ---

test('imports legacy bare snapshots with a validation warning', () => {
  const snapshot = makeSnapshot();
  const imported = importWorkspaceJson(JSON.stringify(snapshot), { mode: 'replace' });
  assert.deepEqual(imported.snapshot, snapshot);
  assert.equal(imported.warnings[0].code, 'legacy-bare-snapshot');
});

test('normalizes invalid legacy currentPageId to null with a warning', () => {
  const raw = JSON.stringify({ ...makeSnapshot(), currentPageId: 'missing-page' });
  const imported = importWorkspaceJson(raw, { mode: 'replace' });
  assert.equal(imported.snapshot.currentPageId, null);
  assert.ok(imported.warnings.some(warning => warning.code === 'current-page-missing'));
});

test('rejects future workspace schema versions with a typed error', () => {
  const raw = exportWorkspaceJson(makeSnapshot(), { exportedAt: '2026-05-22T00:00:00.000Z', source: 'test' }).body;
  const future = JSON.parse(raw);
  future.schemaVersion = WORKSPACE_SCHEMA_VERSION + 1;
  assert.throws(
    () => importWorkspaceJson(JSON.stringify(future), { mode: 'replace' }),
    UnsupportedWorkspaceSchemaVersionError,
  );
});

// --- Append safety and collision handling ---

test('append mode preserves existing workspace and appends imported pages', () => {
  const existing: WorkspaceSnapshot = { pages: [makePage('existing', 'Existing', [makeBlock('existing-b1', 'p', 'Keep')])], currentPageId: 'existing' };
  const raw = exportWorkspaceJson(makeSnapshot(), { exportedAt: '2026-05-22T00:00:00.000Z', source: 'test' }).body;
  const imported = importWorkspaceJson(raw, { mode: 'append', existing });
  assert.equal(imported.snapshot.pages.length, 2);
  assert.equal(imported.snapshot.pages[0].id, 'existing');
  assert.equal(imported.snapshot.pages[1].id, 'page-1');
  assert.equal(imported.snapshot.currentPageId, 'existing');
});

test('append mode repairs colliding page ids and keeps imported currentPageId valid', () => {
  const existing: WorkspaceSnapshot = { pages: [makePage('page-1', 'Existing Page', [makeBlock('existing-b1', 'p', 'Keep')])], currentPageId: null };
  const raw = exportWorkspaceJson(makeSnapshot(), { exportedAt: '2026-05-22T00:00:00.000Z', source: 'test' }).body;
  const imported = importWorkspaceJson(raw, { mode: 'append', existing });
  assert.equal(imported.snapshot.pages.length, 2);
  assert.equal(imported.snapshot.pages[0].id, 'page-1');
  assert.equal(imported.snapshot.pages[1].id, 'page-1-imported');
  assert.equal(imported.snapshot.currentPageId, 'page-1-imported');
  assert.ok(imported.warnings.some(warning => warning.code === 'page-id-collision'));
});

test('append mode rewrites imported parentId references when parent ids collide', () => {
  const existing: WorkspaceSnapshot = { pages: [makePage('parent', 'Existing Parent', [makeBlock('existing-b1', 'p', 'Keep')])], currentPageId: null };
  const snapshot: WorkspaceSnapshot = {
    pages: [
      makePage('parent', 'Imported Parent', [makeBlock('parent-b1', 'p', 'Parent')]),
      makePage('child', 'Imported Child', [makeBlock('child-b1', 'p', 'Child')], { parentId: 'parent' }),
    ],
    currentPageId: 'child',
  };
  const raw = exportWorkspaceJson(snapshot, { exportedAt: '2026-05-22T00:00:00.000Z', source: 'test' }).body;
  const imported = importWorkspaceJson(raw, { mode: 'append', existing });
  const child = imported.snapshot.pages.find(page => page.id === 'child');
  assert.equal(child?.parentId, 'parent-imported');
});

// --- No-secret and validation invariants ---

test('export refuses obvious provider keys and passphrase fields', () => {
  const snapshot = makeSnapshot();
  snapshot.pages[0].blocks[0].content = 'sk-123456789012345678901234567890';
  assert.throws(
    () => exportWorkspaceJson(snapshot, { exportedAt: '2026-05-22T00:00:00.000Z', source: 'test' }),
    /secret-like data/,
  );
});

test('export strips non-workspace runtime fields instead of serializing secrets', () => {
  const snapshot = { ...makeSnapshot(), accessToken: 'ya29.secret-token-value' } as WorkspaceSnapshot & { accessToken: string };
  const exported = exportWorkspaceJson(snapshot, { exportedAt: '2026-05-22T00:00:00.000Z', source: 'test' });
  assert.doesNotMatch(exported.body, /ya29\./);
  assert.equal(JSON.parse(exported.body).workspace.accessToken, undefined);
});

test('import rejects unsupported block types through schema validation', () => {
  const snapshot = makeSnapshot();
  snapshot.pages[0].blocks[0].type = 'unsupported-widget' as BlockType;
  const raw = JSON.stringify({
    schema: WORKSPACE_EXPORT_SCHEMA,
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    exportedAt: '2026-05-22T00:00:00.000Z',
    appName: 'MotionAI',
    source: 'test',
    workspace: snapshot,
  });
  assert.throws(
    () => importWorkspaceJson(raw, { mode: 'replace' }),
    /supported block type/,
  );
});

// --- Legacy block type round-trips still covered by Level A backups ---

for (const type of BLOCK_TYPES) {
  test(`${type} block round-trips inside workspace JSON`, () => {
    const snapshot: WorkspaceSnapshot = { pages: [makePage('page-1', 'Blocks', [makeBlock('block-1', type, `${type} content`)])], currentPageId: 'page-1' };
    const raw = exportWorkspaceJson(snapshot, { exportedAt: '2026-05-22T00:00:00.000Z', source: 'test' }).body;
    const imported = importWorkspaceJson(raw, { mode: 'replace' });
    assert.equal(imported.snapshot.pages[0].blocks[0].type, type);
    assert.equal(imported.snapshot.pages[0].blocks[0].content, `${type} content`);
  });
}

console.log(`\n${passed}/${passed + failed} import/export tests passed.\n`);
if (failed > 0) process.exit(1);
