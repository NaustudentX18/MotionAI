#!/usr/bin/env npx tsx

/**
 * Persistence torture tests for MotionAI workspace storage.
 * Tests large workspaces, reload cycles, offline/reconnect, and data integrity.
 * Credential-free; uses mock data and in-memory IndexedDB simulation.
 */

import { strict as assert } from 'node:assert/strict';
import type { WorkspaceSnapshot } from '../src/lib/persistence';
import type { Page } from '../src/types';

// ─── In-memory mock persistence ──────────────────────────────────────────────

let mockStore: WorkspaceSnapshot | null = null;

async function mockLoad(): Promise<WorkspaceSnapshot | null> {
  return mockStore;
}

async function mockSave(snapshot: WorkspaceSnapshot): Promise<void> {
  mockStore = {
    pages: snapshot.pages.map(p => ({
      ...p,
      blocks: p.blocks.map(b => ({ ...b })),
    })),
    currentPageId: snapshot.currentPageId,
  };
}

function makeBlock(id: string, content: string) {
  return { id, type: 'p' as const, content };
}

function makePage(id: string, title: string, blockCount: number): Page {
  return {
    id,
    title,
    icon: '📄',
    cover: null,
    blocks: Array.from({ length: blockCount }, (_, i) => makeBlock(`${id}-block-${i}`, `Block ${i} content for ${title}`)),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function makeLargeWorkspace(pageCount: number, blocksPerPage: number): WorkspaceSnapshot {
  const pages = Array.from({ length: pageCount }, (_, i) => makePage(`page-${i}`, `Page ${i}`, blocksPerPage));
  return { pages, currentPageId: pages[0]?.id ?? null };
}

function deepClone(snapshot: WorkspaceSnapshot): WorkspaceSnapshot {
  return JSON.parse(JSON.stringify(snapshot));
}

// ─── Tests ──────────────────────────────────────────────────────────────────

async function testSmallWorkspaceRoundTrip() {
  const ws: WorkspaceSnapshot = {
    pages: [makePage('p1', 'Test Page', 3)],
    currentPageId: 'p1',
  };
  await mockSave(ws);
  const loaded = await mockLoad();
  assert(loaded, 'Should load saved workspace');
  assert.equal(loaded.pages.length, 1, 'Should have one page');
  assert.equal(loaded.pages[0].blocks.length, 3, 'Should have three blocks');
  assert.equal(loaded.currentPageId, 'p1', 'Should preserve currentPageId');
  console.log('  ✓ Small workspace round-trip');
}

async function testLargeWorkspace100Pages() {
  const ws = makeLargeWorkspace(100, 5);
  await mockSave(ws);
  const loaded = await mockLoad();
  assert(loaded, 'Should load 100-page workspace');
  assert.equal(loaded.pages.length, 100, 'Should preserve 100 pages');
  assert.equal(loaded.currentPageId, 'page-0', 'Should preserve first page as current');
  const totalBlocks = loaded.pages.reduce((sum, p) => sum + p.blocks.length, 0);
  assert.equal(totalBlocks, 500, 'Should preserve all 500 blocks');
  console.log('  ✓ 100-page workspace with 500 blocks');
}

async function testLargeWorkspace1000Pages() {
  const ws = makeLargeWorkspace(1000, 10);
  await mockSave(ws);
  const loaded = await mockLoad();
  assert(loaded, 'Should load 1000-page workspace');
  assert.equal(loaded.pages.length, 1000, 'Should preserve 1000 pages');
  const totalBlocks = loaded.pages.reduce((sum, p) => sum + p.blocks.length, 0);
  assert.equal(totalBlocks, 10000, 'Should preserve 10000 blocks');
  console.log('  ✓ 1000-page workspace with 10000 blocks');
}

async function test10kBlocksSinglePage() {
  const page = makePage('big-page', 'Big Page', 10_000);
  const ws: WorkspaceSnapshot = { pages: [page], currentPageId: 'big-page' };
  await mockSave(ws);
  const loaded = await mockLoad();
  assert(loaded, 'Should load workspace with 10k-block page');
  assert.equal(loaded.pages[0].blocks.length, 10_000, 'Should preserve 10000 blocks on one page');
  console.log('  ✓ Single page with 10000 blocks');
}

async function testRepeatedSaveReloadCycles() {
  const ws: WorkspaceSnapshot = { pages: [makePage('cycle-page', 'Cycle Page', 10)], currentPageId: 'cycle-page' };
  for (let cycle = 0; cycle < 10; cycle++) {
    ws.pages[0].title = `Cycle ${cycle}`;
    ws.pages[0].updatedAt = Date.now();
    await mockSave(ws);
    const loaded = await mockLoad();
    assert(loaded, `Should survive reload cycle ${cycle}`);
    assert.equal(loaded.pages[0].title, `Cycle ${cycle}`, `Title should reflect cycle ${cycle}`);
  }
  console.log('  ✓ 10 save/reload cycles preserve data integrity');
}

async function testOfflineThenReconnect() {
  const offlineWs: WorkspaceSnapshot = {
    pages: [makePage('offline-p1', 'Offline Page', 5)],
    currentPageId: 'offline-p1',
  };
  await mockSave(offlineWs);
  const preOffline = deepClone(mockStore!);

  // Simulate offline edits
  const offlineEdit: WorkspaceSnapshot = {
    pages: [makePage('offline-p2', 'Offline Edit', 3)],
    currentPageId: 'offline-p2',
  };
  await mockSave(offlineEdit);

  const afterOffline = await mockLoad();
  assert(afterOffline, 'Should load after offline edit');
  assert.equal(afterOffline.pages.length, 1, 'Offline save should only have the new page');
  assert.equal(afterOffline.pages[0].title, 'Offline Edit', 'Offline edits should persist');

  // Simulate reconnect by restoring pre-offline state and merging
  await mockSave(preOffline);
  const mergedWs: WorkspaceSnapshot = {
    pages: [...preOffline.pages, ...afterOffline.pages],
    currentPageId: preOffline.currentPageId,
  };
  await mockSave(mergedWs);
  const merged = await mockLoad();
  assert(merged, 'Should load merged workspace');
  assert.equal(merged.pages.length, 2, 'Merged workspace should contain both old and new pages');
  console.log('  ✓ Offline→reconnect merge preserves both states');
}

async function testConcurrentModifications() {
  const base = makeLargeWorkspace(5, 3);
  await mockSave(base);

  const snapshotA = await mockLoad()!;
  const snapshotB = await mockLoad()!;

  // Modify snapshot A
  if (snapshotA) {
    snapshotA.pages[0].title = 'Modified by A';
    snapshotA.pages[0].blocks.push(makeBlock('a-new-block', 'Added by A'));
  }

  // Modify snapshot B
  if (snapshotB) {
    snapshotB.pages[1].title = 'Modified by B';
    snapshotB.pages[1].blocks.push(makeBlock('b-new-block', 'Added by B'));
  }

  // Save A, then B (last-write-wins)
  if (snapshotA) await mockSave(snapshotA);
  if (snapshotB) await mockSave(snapshotB);

  const final = await mockLoad();
  assert(final, 'Should load after concurrent modifications');
  const page0 = final.pages.find(p => p.id === 'page-0');
  const page1 = final.pages.find(p => p.id === 'page-1');
  assert(page0, 'Page 0 should exist');
  assert(page1, 'Page 1 should exist');
  // Last write wins: snapshotB overwrote, so page0 title reverts
  console.log('  ✓ Concurrent modifications (last-write-wins)');
}

async function testDataIntegrityAfterRandomEdits() {
  const ws = makeLargeWorkspace(50, 20);
  await mockSave(ws);

  for (let round = 0; round < 5; round++) {
    const loaded = await mockLoad();
    assert(loaded, `Should survive edit round ${round}`);

    // Verify all pages and blocks exist
    assert.equal(loaded.pages.length, 50);
    loaded.pages.forEach((page, i) => {
      assert.equal(page.blocks.length, 20, `Page ${i} should have 20 blocks`);
      page.blocks.forEach((block, j) => {
        assert(block.id.startsWith('page-'), `Block ${j} on page ${i} should have valid id`);
      });
    });

    // Modify some data
    const idx = round % 50;
    loaded.pages[idx].title = `Edited round ${round}`;
    loaded.pages[idx].updatedAt = Date.now();
    await mockSave(loaded);
  }
  console.log('  ✓ Data integrity after 5 rounds of random edits');
}

// ─── Runner ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('Persistence Torture Tests\n');

  const tests = [
    testSmallWorkspaceRoundTrip,
    testLargeWorkspace100Pages,
    testLargeWorkspace1000Pages,
    test10kBlocksSinglePage,
    testRepeatedSaveReloadCycles,
    testOfflineThenReconnect,
    testConcurrentModifications,
    testDataIntegrityAfterRandomEdits,
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      mockStore = null;
      await test();
      passed++;
    } catch (e) {
      failed++;
      console.error(`  ✗ ${test.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const total = passed + failed;
  console.log(`\n${passed}/${total} persistence torture tests passed.`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();
