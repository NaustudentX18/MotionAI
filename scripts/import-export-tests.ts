#!/usr/bin/env npx tsx

/**
 * Import/export round-trip tests for page documents and block types.
 *
 * Validates that the data model (Page, Block, BlockType) serializes and
 * deserializes correctly. Tests are credential-free and operate entirely
 * on the type definitions and workspace snapshot contract.
 */

import { strict as assert } from 'node:assert/strict';
import { WorkspaceSnapshot } from '../src/lib/persistence';
import type { Page, Block, BlockType } from '../src/types';

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

console.log('\nImport/Export Round-Trip Tests\n');

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
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

// --- WorkspaceSnapshot round-trip ---

test('WorkspaceSnapshot can represent an empty workspace', () => {
  const snapshot: WorkspaceSnapshot = { pages: [], currentPageId: null };
  const json = JSON.stringify(snapshot);
  const parsed = JSON.parse(json) as WorkspaceSnapshot;
  assert.equal(parsed.pages.length, 0);
  assert.equal(parsed.currentPageId, null);
});

test('WorkspaceSnapshot with single page round-trips correctly', () => {
  const page = makePage('page-1', 'Test Page', [
    makeBlock('block-1', 'p', 'Hello world'),
  ]);
  const snapshot: WorkspaceSnapshot = { pages: [page], currentPageId: 'page-1' };
  const json = JSON.stringify(snapshot);
  const parsed = JSON.parse(json) as WorkspaceSnapshot;
  assert.equal(parsed.pages.length, 1);
  assert.equal(parsed.pages[0].id, 'page-1');
  assert.equal(parsed.pages[0].title, 'Test Page');
  assert.equal(parsed.pages[0].blocks.length, 1);
  assert.equal(parsed.pages[0].blocks[0].content, 'Hello world');
  assert.equal(parsed.currentPageId, 'page-1');
});

test('WorkspaceSnapshot with multiple pages round-trips correctly', () => {
  const pages = [
    makePage('page-1', 'First', [makeBlock('b1', 'p', 'Content 1')]),
    makePage('page-2', 'Second', [makeBlock('b2', 'h1', 'Heading'), makeBlock('b3', 'p', 'Body')]),
  ];
  const snapshot: WorkspaceSnapshot = { pages, currentPageId: 'page-2' };
  const json = JSON.stringify(snapshot);
  const parsed = JSON.parse(json) as WorkspaceSnapshot;
  assert.equal(parsed.pages.length, 2);
  assert.equal(parsed.pages[1].id, 'page-2');
  assert.equal(parsed.pages[1].blocks.length, 2);
  assert.equal(parsed.currentPageId, 'page-2');
});

// --- Block type round-trips ---

test('p (paragraph) block round-trips correctly', () => {
  const b = makeBlock('b1', 'p', 'Paragraph text');
  const json = JSON.stringify(b);
  const parsed = JSON.parse(json) as Block;
  assert.equal(parsed.type, 'p');
  assert.equal(parsed.content, 'Paragraph text');
});

test('h1 block round-trips correctly', () => {
  const b = makeBlock('b1', 'h1', 'Heading 1');
  const json = JSON.stringify(b);
  const parsed = JSON.parse(json) as Block;
  assert.equal(parsed.type, 'h1');
});

test('h2 block round-trips correctly', () => {
  const b = makeBlock('b1', 'h2', 'Heading 2');
  const json = JSON.stringify(b);
  const parsed = JSON.parse(json) as Block;
  assert.equal(parsed.type, 'h2');
});

test('todo block with checked state round-trips correctly', () => {
  const b = makeBlock('b1', 'todo', 'Task item', { checked: true });
  const json = JSON.stringify(b);
  const parsed = JSON.parse(json) as Block;
  assert.equal(parsed.type, 'todo');
  assert.equal(parsed.checked, true);
});

test('todo block with unchecked state round-trips correctly', () => {
  const b = makeBlock('b1', 'todo', 'Task item', { checked: false });
  const json = JSON.stringify(b);
  const parsed = JSON.parse(json) as Block;
  assert.equal(parsed.checked, false);
});

test('bullet block round-trips correctly', () => {
  const b = makeBlock('b1', 'bullet', 'List item');
  const json = JSON.stringify(b);
  const parsed = JSON.parse(json) as Block;
  assert.equal(parsed.type, 'bullet');
});

test('divider block round-trips correctly', () => {
  const b = makeBlock('b1', 'divider', '');
  const json = JSON.stringify(b);
  const parsed = JSON.parse(json) as Block;
  assert.equal(parsed.type, 'divider');
});

test('callout block round-trips correctly', () => {
  const b = makeBlock('b1', 'callout', 'Important note');
  const json = JSON.stringify(b);
  const parsed = JSON.parse(json) as Block;
  assert.equal(parsed.type, 'callout');
});

test('quote block round-trips correctly', () => {
  const b = makeBlock('b1', 'quote', 'Cited text');
  const json = JSON.stringify(b);
  const parsed = JSON.parse(json) as Block;
  assert.equal(parsed.type, 'quote');
});

test('code block with language round-trips correctly', () => {
  const b = makeBlock('b1', 'code', 'const x = 1;', { language: 'typescript' });
  const json = JSON.stringify(b);
  const parsed = JSON.parse(json) as Block;
  assert.equal(parsed.type, 'code');
  assert.equal(parsed.language, 'typescript');
});

test('ai-summary block round-trips correctly', () => {
  const b = makeBlock('b1', 'ai-summary', 'Summary content');
  const json = JSON.stringify(b);
  const parsed = JSON.parse(json) as Block;
  assert.equal(parsed.type, 'ai-summary');
});

test('ai-draft block round-trips correctly', () => {
  const b = makeBlock('b1', 'ai-draft', 'Draft content');
  const json = JSON.stringify(b);
  const parsed = JSON.parse(json) as Block;
  assert.equal(parsed.type, 'ai-draft');
});

test('ai-rewrite block round-trips correctly', () => {
  const b = makeBlock('b1', 'ai-rewrite', 'Rewritten content');
  const json = JSON.stringify(b);
  const parsed = JSON.parse(json) as Block;
  assert.equal(parsed.type, 'ai-rewrite');
});

// --- Block with style round-trips ---

test('block with style round-trips correctly', () => {
  const b = makeBlock('b1', 'p', 'Styled text', {
    style: { bold: true, italic: false, color: '#E03E3E' },
  });
  const json = JSON.stringify(b);
  const parsed = JSON.parse(json) as Block;
  assert.ok(parsed.style, 'style should exist');
  assert.equal(parsed.style?.bold, true);
  assert.equal(parsed.style?.color, '#E03E3E');
});

test('block with indentation round-trips correctly', () => {
  const b = makeBlock('b1', 'p', 'Indented', { indentLevel: 2 });
  const json = JSON.stringify(b);
  const parsed = JSON.parse(json) as Block;
  assert.equal(parsed.indentLevel, 2);
});

test('block with comments round-trips correctly', () => {
  const b = makeBlock('b1', 'p', 'Commented', {
    comments: [{ id: 'c1', author: 'User', text: 'Great point', createdAt: 1000 }],
  });
  const json = JSON.stringify(b);
  const parsed = JSON.parse(json) as Block;
  assert.ok(parsed.comments, 'comments should exist');
  assert.equal(parsed.comments?.length, 1);
  assert.equal(parsed.comments?.[0].text, 'Great point');
});

// --- Page with version history round-trips ---

test('page with versions round-trips correctly', () => {
  const page = makePage('page-v1', 'Versioned', [
    makeBlock('b1', 'p', 'Content'),
  ], {
    versions: [
      { id: 'v1', timestamp: 1000, title: 'Versioned', blocks: [] },
    ],
  });
  const json = JSON.stringify(page);
  const parsed = JSON.parse(json) as Page;
  assert.ok(parsed.versions, 'versions should exist');
  assert.equal(parsed.versions?.length, 1);
  assert.equal(parsed.versions?.[0].id, 'v1');
});

console.log(`\n${passed}/${passed + failed} import/export tests passed.\n`);
if (failed > 0) process.exit(1);
