#!/usr/bin/env npx tsx

/**
 * Credential-free reliability tests for large workspace snapshots.
 *
 * These tests exercise deterministic data generation, snapshot validation,
 * and persistence-like Y.Doc state invariants without browser APIs,
 * network calls, credentials, or external services.
 */

import { strict as assert } from 'node:assert/strict';
import * as Y from 'yjs';
import type { Block, BlockType, Page } from '../src/types';
import {
  addPageToYDoc,
  applyYDocState,
  deletePageFromYDoc,
  getYDocState,
  setCurrentPageIdInYDoc,
  snapshotToYDoc,
  updatePageInYDoc,
  yDocToSnapshot,
  type WorkspaceSnapshot,
} from '../src/lib/yjs';

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

console.log('\nReliability Snapshot Tests\n');

const BLOCK_TYPES: BlockType[] = [
  'p',
  'h1',
  'h2',
  'h3',
  'todo',
  'bullet',
  'divider',
  'callout',
  'quote',
  'ai-summary',
  'ai-draft',
  'ai-rewrite',
  'code',
  'image',
];

const LARGE_PAGE_COUNT = 96;
const BLOCKS_PER_PAGE = 32;
const BASE_TIME = 1_700_000_000_000;

function makeBlock(pageIndex: number, blockIndex: number): Block {
  const type = BLOCK_TYPES[(pageIndex + blockIndex) % BLOCK_TYPES.length];
  const id = `page-${pageIndex.toString().padStart(3, '0')}-block-${blockIndex.toString().padStart(3, '0')}`;
  const content = type === 'divider'
    ? ''
    : `Content ${pageIndex}/${blockIndex} — unicode ✓ line:${blockIndex}\n${'x'.repeat((blockIndex % 7) + 1)}`;

  const block: Block = { id, type, content };

  if (type === 'todo') block.checked = blockIndex % 2 === 0;
  if (type === 'code') block.language = blockIndex % 2 === 0 ? 'typescript' : 'markdown';
  if (blockIndex % 5 === 0) block.indentLevel = blockIndex % 4;
  if (blockIndex % 7 === 0) {
    block.style = {
      bold: true,
      italic: blockIndex % 14 === 0,
      color: '#37352F',
      backgroundColor: '#F7F6F3',
    };
  }
  if (blockIndex % 11 === 0) {
    block.comments = [
      {
        id: `${id}-comment-0`,
        author: 'Reliability Test',
        text: `Comment for ${id}`,
        createdAt: BASE_TIME + pageIndex * 1_000 + blockIndex,
      },
    ];
  }
  if (blockIndex % 13 === 0) {
    block.aiPrompt = `Summarize block ${id}`;
    block.aiContext = `Page ${pageIndex}`;
  }

  return block;
}

function makePage(pageIndex: number, blocksPerPage = BLOCKS_PER_PAGE): Page {
  const blocks = Array.from({ length: blocksPerPage }, (_, blockIndex) => makeBlock(pageIndex, blockIndex));
  return {
    id: `page-${pageIndex.toString().padStart(3, '0')}`,
    title: `Reliability Page ${pageIndex}`,
    icon: pageIndex % 3 === 0 ? '🧪' : null,
    cover: pageIndex % 4 === 0 ? `cover-${pageIndex}.png` : null,
    blocks,
    createdAt: BASE_TIME + pageIndex,
    updatedAt: BASE_TIME + pageIndex + 500,
    versions: pageIndex % 10 === 0
      ? [{ id: `version-${pageIndex}`, timestamp: BASE_TIME + pageIndex, title: `Reliability Page ${pageIndex}`, blocks: blocks.slice(0, 2) }]
      : undefined,
  };
}

function makeWorkspace(pageCount = LARGE_PAGE_COUNT, blocksPerPage = BLOCKS_PER_PAGE): WorkspaceSnapshot {
  const pages = Array.from({ length: pageCount }, (_, pageIndex) => makePage(pageIndex, blocksPerPage));
  return {
    pages,
    currentPageId: pages[Math.floor(pageCount / 2)]?.id ?? null,
  };
}

function canonicalSnapshot(snapshot: WorkspaceSnapshot): WorkspaceSnapshot {
  return JSON.parse(JSON.stringify(snapshot));
}

function validateWorkspaceSnapshot(snapshot: WorkspaceSnapshot): void {
  assert.ok(Array.isArray(snapshot.pages), 'pages must be an array');

  const pageIds = new Set<string>();
  let blockCount = 0;

  for (const page of snapshot.pages) {
    assert.equal(typeof page.id, 'string', 'page id must be a string');
    assert.ok(page.id.length > 0, 'page id must not be empty');
    assert.ok(!pageIds.has(page.id), `duplicate page id: ${page.id}`);
    pageIds.add(page.id);
    assert.equal(typeof page.title, 'string', `${page.id} title must be a string`);
    assert.ok(Array.isArray(page.blocks), `${page.id} blocks must be an array`);
    assert.equal(typeof page.createdAt, 'number', `${page.id} createdAt must be numeric`);
    assert.equal(typeof page.updatedAt, 'number', `${page.id} updatedAt must be numeric`);

    const blockIds = new Set<string>();
    for (const block of page.blocks) {
      blockCount++;
      assert.equal(typeof block.id, 'string', `${page.id} block id must be a string`);
      assert.ok(!blockIds.has(block.id), `duplicate block id in ${page.id}: ${block.id}`);
      blockIds.add(block.id);
      assert.ok(BLOCK_TYPES.includes(block.type), `${block.id} has unsupported block type ${block.type}`);
      assert.equal(typeof block.content, 'string', `${block.id} content must be a string`);
      if (block.checked !== undefined) assert.equal(typeof block.checked, 'boolean', `${block.id} checked must be boolean`);
      if (block.indentLevel !== undefined) {
        assert.ok(Number.isInteger(block.indentLevel), `${block.id} indentLevel must be integer`);
        assert.ok(block.indentLevel >= 0 && block.indentLevel <= 4, `${block.id} indentLevel must stay within editor bounds`);
      }
      if (block.comments) {
        for (const comment of block.comments) {
          assert.equal(typeof comment.id, 'string', `${block.id} comment id must be a string`);
          assert.equal(typeof comment.text, 'string', `${block.id} comment text must be a string`);
          assert.equal(typeof comment.createdAt, 'number', `${block.id} comment createdAt must be numeric`);
        }
      }
    }
  }

  if (snapshot.currentPageId !== null) {
    assert.ok(pageIds.has(snapshot.currentPageId), `currentPageId ${snapshot.currentPageId} must reference an existing page`);
  }
  assert.ok(blockCount > 0 || snapshot.pages.length === 0, 'non-empty workspaces should contain blocks');
}

function assertSameSnapshot(actual: WorkspaceSnapshot, expected: WorkspaceSnapshot): void {
  assert.deepEqual(canonicalSnapshot(actual), canonicalSnapshot(expected));
}

test('large workspace generator produces valid deterministic data', () => {
  const first = makeWorkspace();
  const second = makeWorkspace();
  validateWorkspaceSnapshot(first);
  assert.equal(first.pages.length, LARGE_PAGE_COUNT);
  assert.equal(first.pages.reduce((count, page) => count + page.blocks.length, 0), LARGE_PAGE_COUNT * BLOCKS_PER_PAGE);
  assert.equal(first.currentPageId, 'page-048');
  assertSameSnapshot(second, first);
});

test('large workspace JSON snapshot round-trips without shape loss', () => {
  const snapshot = makeWorkspace();
  const json = JSON.stringify(snapshot);
  assert.ok(json.length > 250_000, `expected a substantial serialized workspace, got ${json.length} bytes`);

  const parsed = JSON.parse(json) as WorkspaceSnapshot;
  validateWorkspaceSnapshot(parsed);
  assertSameSnapshot(parsed, snapshot);
});

test('Y.Doc snapshot conversion preserves large workspace invariants', () => {
  const snapshot = makeWorkspace();
  const doc = new Y.Doc();

  snapshotToYDoc(snapshot, doc);
  const restored = yDocToSnapshot(doc);

  validateWorkspaceSnapshot(restored);
  assertSameSnapshot(restored, snapshot);
});

test('encoded Y.Doc state can be applied to a fresh doc as a persistence-like snapshot', () => {
  const snapshot = makeWorkspace();
  const sourceDoc = new Y.Doc();
  const targetDoc = new Y.Doc();

  snapshotToYDoc(snapshot, sourceDoc);
  const encodedState = getYDocState(sourceDoc);
  assert.ok(encodedState.byteLength > 0, 'encoded Y.Doc state should not be empty');

  applyYDocState(encodedState, targetDoc);
  const restored = yDocToSnapshot(targetDoc);

  validateWorkspaceSnapshot(restored);
  assertSameSnapshot(restored, snapshot);
});

test('incremental page changes preserve current page and snapshot validity', () => {
  const snapshot = makeWorkspace(12, 8);
  const doc = new Y.Doc();
  snapshotToYDoc(snapshot, doc);

  const updatedPage: Page = {
    ...snapshot.pages[3],
    title: 'Updated Reliability Page',
    updatedAt: BASE_TIME + 99_999,
    blocks: [
      ...snapshot.pages[3].blocks,
      {
        id: 'page-003-block-extra',
        type: 'callout',
        content: 'Incremental update survived snapshot persistence.',
        style: { bold: true, backgroundColor: '#FFF8C5' },
      },
    ],
  };
  const addedPage = makePage(99, 6);

  updatePageInYDoc(updatedPage, doc);
  addPageToYDoc(addedPage, doc);
  deletePageFromYDoc('page-001', doc);
  setCurrentPageIdInYDoc(addedPage.id, doc);

  const expected: WorkspaceSnapshot = {
    pages: [
      snapshot.pages[0],
      snapshot.pages[2],
      updatedPage,
      ...snapshot.pages.slice(4),
      addedPage,
    ].sort((a, b) => a.createdAt - b.createdAt),
    currentPageId: addedPage.id,
  };

  const restored = yDocToSnapshot(doc);
  validateWorkspaceSnapshot(restored);
  assertSameSnapshot(restored, expected);
});

test('empty workspace snapshots stay valid through Y.Doc state persistence', () => {
  const snapshot: WorkspaceSnapshot = { pages: [], currentPageId: null };
  const sourceDoc = new Y.Doc();
  const targetDoc = new Y.Doc();

  snapshotToYDoc(snapshot, sourceDoc);
  applyYDocState(getYDocState(sourceDoc), targetDoc);
  const restored = yDocToSnapshot(targetDoc);

  validateWorkspaceSnapshot(restored);
  assertSameSnapshot(restored, snapshot);
});

console.log(`\n${passed}/${passed + failed} reliability tests passed.\n`);
if (failed > 0) process.exit(1);


// ─── Phase 1: Torture Tests ─────────────────────────────────────────────────
// These test the persistence system under extreme conditions.
// All are credential-free, using Y.Doc in-process snapshots.

const LARGE_1K_PAGE_COUNT = 1000;
const LONG_DOC_BLOCK_COUNT = 500;
const CYCLE_COUNT = 20;

test('1,000-page workspace round-trips through JSON without data loss', () => {
  const snapshot = makeWorkspace(LARGE_1K_PAGE_COUNT, 10);
  validateWorkspaceSnapshot(snapshot);
  assert.equal(snapshot.pages.length, LARGE_1K_PAGE_COUNT);

  const totalBlocks = snapshot.pages.reduce((sum, p) => sum + p.blocks.length, 0);
  assert.equal(totalBlocks, LARGE_1K_PAGE_COUNT * 10, 'must have 10,000 blocks');

  const json = JSON.stringify(snapshot);
  assert.ok(json.length > 800_000, `expected large serialized workspace, got ${json.length} bytes`);

  const parsed = JSON.parse(json) as WorkspaceSnapshot;
  validateWorkspaceSnapshot(parsed);
  assertSameSnapshot(parsed, snapshot);
});

test('1,000-page workspace survives Y.Doc encode/decode cycle', () => {
  const snapshot = makeWorkspace(LARGE_1K_PAGE_COUNT, 10);
  const sourceDoc = new Y.Doc();
  const targetDoc = new Y.Doc();

  const startTime = Date.now();
  snapshotToYDoc(snapshot, sourceDoc);
  const encoded = getYDocState(sourceDoc);
  applyYDocState(encoded, targetDoc);
  const restored = yDocToSnapshot(targetDoc);
  const elapsed = Date.now() - startTime;

  validateWorkspaceSnapshot(restored);
  assertSameSnapshot(restored, snapshot);
  console.log(`    1,000-page Y.Doc encode/decode: ${elapsed}ms (${(encoded.byteLength / 1024).toFixed(0)}KB)`);
});

test('long document with 500+ blocks survives round-trip with content integrity', () => {
  const longBlocks: Block[] = [];
  for (let i = 0; i < LONG_DOC_BLOCK_COUNT; i++) {
    const type: BlockType = i % 5 === 0 ? 'h2' : i % 13 === 0 ? 'divider' : 'p';
    const content = type === 'divider'
      ? ''
      : `Long document paragraph ${i + 1}/${LONG_DOC_BLOCK_COUNT}. ` +
        'This paragraph contains enough text to exercise real-world document rendering. '.repeat(3).trim();
    longBlocks.push({ id: `longdoc-block-${i.toString().padStart(4, '0')}`, type, content });
  }

  const page: Page = {
    id: 'long-document-page',
    title: 'Extremely Long Document for Stress Testing',
    icon: '📄',
    cover: null,
    blocks: longBlocks,
    createdAt: BASE_TIME,
    updatedAt: BASE_TIME + 1,
  };

  const snapshot: WorkspaceSnapshot = { pages: [page], currentPageId: 'long-document-page' };
  validateWorkspaceSnapshot(snapshot);

  // JSON round-trip
  const parsed = JSON.parse(JSON.stringify(snapshot)) as WorkspaceSnapshot;
  assertSameSnapshot(parsed, snapshot);

  // Y.Doc round-trip
  const doc = new Y.Doc();
  snapshotToYDoc(snapshot, doc);
  const restored = yDocToSnapshot(doc);
  validateWorkspaceSnapshot(restored);
  assertSameSnapshot(restored, snapshot);

  // Verify content integrity for a specific block
  const restoredLongDoc = restored.pages.find(p => p.id === 'long-document-page')!;
  const midBlock = restoredLongDoc.blocks.find(b => b.id === 'longdoc-block-0250')!;
  assert.ok(midBlock.content.includes('Long document paragraph 251'), 'content integrity check failed for mid-document block');
  assert.equal(midBlock.type, 'h2', 'block type formula: i%5===0 → h2 for i=250');
});

test('repeated save/load cycles maintain data integrity through 20 iterations', () => {
  const snapshot = makeWorkspace(48, 16);
  const doc = new Y.Doc();
  snapshotToYDoc(snapshot, doc);

  let currentState = getYDocState(doc);

  for (let cycle = 0; cycle < CYCLE_COUNT; cycle++) {
    const freshDoc = new Y.Doc();
    applyYDocState(currentState, freshDoc);
    const restored = yDocToSnapshot(freshDoc);

    validateWorkspaceSnapshot(restored);

    // Verify page count is stable
    assert.equal(restored.pages.length, 48, `cycle ${cycle}: page count changed`);

    // Verify current page is preserved
    if (cycle === 0) {
      assert.equal(restored.currentPageId, snapshot.currentPageId, `cycle ${cycle}: current page changed`);
    }

    // Re-encode for next cycle
    currentState = getYDocState(freshDoc);

    // Verify specific block content survived
    const page3 = restored.pages.find(p => p.id === 'page-003')!;
    assert.ok(page3, `cycle ${cycle}: page-003 exists`);
    assert.ok(page3.blocks.length > 0, `cycle ${cycle}: page-003 has blocks`);
    const block0 = page3.blocks[0];
    assert.ok(block0.content.includes('Content 3/0'), `cycle ${cycle}: block content preserved`);
  }

  console.log(`    20 save/load cycles completed: all data integrity checks passed`);
});

test('simulated offline/reconnect cycle preserves workspace state', () => {
  // Simulate: save workspace → clear Y.Doc → reload from encoded state → validate
  const snapshot = makeWorkspace(24, 12);
  const sourceDoc = new Y.Doc();
  snapshotToYDoc(snapshot, sourceDoc);

  // "Save" to encoded state (simulates IndexedDB/Y.Doc persistence)
  const savedState = getYDocState(sourceDoc);
  assert.ok(savedState.byteLength > 100, 'saved state must be non-trivial');

  // "Clear" the Y.Doc (simulates offline/disconnect)
  const clearedDoc = new Y.Doc();

  // "Reconnect" by applying saved state to fresh doc
  applyYDocState(savedState, clearedDoc);
  const restored = yDocToSnapshot(clearedDoc);

  validateWorkspaceSnapshot(restored);
  assertSameSnapshot(restored, snapshot);

  // Verify the current page is restored correctly
  assert.equal(restored.currentPageId, snapshot.currentPageId, 'current page ID preserved after offline/reconnect');
  assert.equal(restored.pages.length, 24, 'all pages restored after offline/reconnect');
});

test('cross-page block references survive persistence round-trip', () => {
  // Create pages with backlinks-style references in content
  const blockA1: Block = { id: 'ref-block-a1', type: 'p', content: 'Referencing [[Page-Two]] and [[Page-Three]] in content' };
  const blockA2: Block = { id: 'ref-block-a2', type: 'todo', content: 'TODO: link to [[Page-Three]]', checked: false };
  const blockB1: Block = { id: 'ref-block-b1', type: 'p', content: 'Back reference to [[Page-One]] from here' };
  const blockC1: Block = { id: 'ref-block-c1', type: 'bullet', content: '[[Page-One]] and [[Page-Two]] both reference me' };

  const pages: Page[] = [
    { id: 'page-one', title: 'Page One', icon: null, cover: null, blocks: [blockA1, blockA2], createdAt: BASE_TIME, updatedAt: BASE_TIME },
    { id: 'page-two', title: 'Page Two', icon: null, cover: null, blocks: [blockB1], createdAt: BASE_TIME + 1, updatedAt: BASE_TIME + 1 },
    { id: 'page-three', title: 'Page Three', icon: null, cover: null, blocks: [blockC1], createdAt: BASE_TIME + 2, updatedAt: BASE_TIME + 2 },
  ];

  const snapshot: WorkspaceSnapshot = { pages, currentPageId: 'page-one' };
  const doc = new Y.Doc();
  snapshotToYDoc(snapshot, doc);
  const restored = yDocToSnapshot(doc);

  validateWorkspaceSnapshot(restored);
  assertSameSnapshot(restored, snapshot);

  // Verify [[wiki-link]] syntax in content survived
  const restoredPage1 = restored.pages.find(p => p.id === 'page-one')!;
  assert.ok(restoredPage1.blocks[0].content.includes('[[Page-Two]]'), 'wiki-link syntax preserved in first block');
  assert.ok(restoredPage1.blocks[1].content.includes('[[Page-Three]]'), 'wiki-link syntax preserved in todo block');


  const restoredPage2 = restored.pages.find(p => p.id === 'page-two')!;
  assert.ok(restoredPage2.blocks[0].content.includes('[[Page-One]]'), 'back-reference syntax preserved');
});

console.log(`\n${passed}/${passed + failed} reliability tests passed.\n`);
if (failed > 0) process.exit(1);
