#!/usr/bin/env npx tsx

/**
 * WebRTC offline resilience and CRDT convergence tests for MotionAI.
 *
 * Simulates WebRTC offline network disconnections, concurrent modifications,
 * network partitions, flapping network states, and validates that Y.js doc states
 * successfully converge once connection is re-established.
 */

import { strict as assert } from 'node:assert/strict';
import * as Y from 'yjs';
import type { Page, Block } from '../src/types';
import {
  addPageToYDoc,
  deletePageFromYDoc,
  updatePageInYDoc,
  snapshotToYDoc,
  yDocToSnapshot,
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
    console.error(`  ✗ ${name}\n    ${error.stack || error.message}`);
  }
}

console.log('\nWebRTC Resilience & Convergence Tests\n');

// Helper to check if two Y.Doc states are identical.
// The best way to check convergence is to make sure they return identical snapshots.
function assertConverged(docA: Y.Doc, docB: Y.Doc, message = 'Documents did not converge to the same state') {
  const snapA = yDocToSnapshot(docA);
  const snapB = yDocToSnapshot(docB);
  assert.deepEqual(snapA, snapB, message);
}

// ─── Network Simulator ───
class MockNetwork {
  private peers: Map<string, { doc: Y.Doc; handler: (update: Uint8Array, origin: any) => void }> = new Map();
  private offlinePeers: Set<string> = new Set();

  register(name: string, doc: Y.Doc) {
    const handler = (update: Uint8Array, origin: any) => {
      // Don't forward updates that we received from remote or our own simulator to avoid infinite loops
      if (origin === this) return;
      if (this.offlinePeers.has(name)) return;

      // Broadcast update to all other online peers
      for (const [otherName, other] of this.peers.entries()) {
        if (otherName !== name && !this.offlinePeers.has(otherName)) {
          Y.applyUpdate(other.doc, update, this);
        }
      }
    };

    doc.on('update', handler);
    this.peers.set(name, { doc, handler });
  }

  disconnect(name: string) {
    this.offlinePeers.add(name);
  }

  connect(name: string) {
    if (!this.offlinePeers.has(name)) return;
    this.offlinePeers.delete(name);

    // Sync state with all other online peers
    const peer = this.peers.get(name);
    if (!peer) return;

    for (const [otherName, other] of this.peers.entries()) {
      if (otherName !== name && !this.offlinePeers.has(otherName)) {
        // Sync peer -> other
        const stateVectorOther = Y.encodeStateVector(other.doc);
        const updateFromPeer = Y.encodeStateAsUpdate(peer.doc, stateVectorOther);
        Y.applyUpdate(other.doc, updateFromPeer, this);

        // Sync other -> peer
        const stateVectorPeer = Y.encodeStateVector(peer.doc);
        const updateFromOther = Y.encodeStateAsUpdate(other.doc, stateVectorPeer);
        Y.applyUpdate(peer.doc, updateFromOther, this);
      }
    }
  }

  cleanup() {
    for (const { doc, handler } of this.peers.values()) {
      doc.off('update', handler);
    }
    this.peers.clear();
    this.offlinePeers.clear();
  }
}

// ─── Test cases ───

test('online syncs edits immediately', () => {
  const net = new MockNetwork();
  const docA = new Y.Doc();
  const docB = new Y.Doc();
  net.register('A', docA);
  net.register('B', docB);

  snapshotToYDoc({ pages: [], currentPageId: null }, docA);
  snapshotToYDoc({ pages: [], currentPageId: null }, docB);

  const page: Page = {
    id: 'page-1',
    title: 'Initial Title',
    icon: null,
    cover: null,
    blocks: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  addPageToYDoc(page, docA);
  assertConverged(docA, docB, 'Doc B did not sync page addition immediately');

  net.cleanup();
});

test('offline disconnections prevent sync, and reconnection converges state', () => {
  const net = new MockNetwork();
  const docA = new Y.Doc();
  const docB = new Y.Doc();
  net.register('A', docA);
  net.register('B', docB);

  const page: Page = {
    id: 'page-1',
    title: 'Shared Title',
    icon: null,
    cover: null,
    blocks: [{ id: 'b1', type: 'p', content: 'hello' }],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  snapshotToYDoc({ pages: [page], currentPageId: 'page-1' }, docA);
  assertConverged(docA, docB);

  // Peer B goes offline
  net.disconnect('B');

  // Peer A makes changes
  const pageUpdateA = { ...page, title: 'Title modified by A' };
  updatePageInYDoc(pageUpdateA, docA);

  // Peer B is offline, so should not have received the update
  const snapBOffline = yDocToSnapshot(docB);
  assert.equal(snapBOffline.pages[0].title, 'Shared Title');

  // Peer B makes concurrent changes while offline
  const pageUpdateB = { ...page, icon: '🚀', updatedAt: Date.now() + 1000 };
  updatePageInYDoc(pageUpdateB, docB);

  // Reconnect Peer B
  net.connect('B');

  // Verify convergence
  assertConverged(docA, docB, 'Offline changes did not converge upon reconnection');

  // Since page updates overwrite the entire page map (Last-Writer-Wins),
  // one of the updates will win deterministically. Verify they have the same state.
  const snapFinal = yDocToSnapshot(docA);
  const convergedTitle = snapFinal.pages[0].title;
  const convergedIcon = snapFinal.pages[0].icon;

  // Assert that both documents have the exact same merged state
  assert.equal(yDocToSnapshot(docB).pages[0].title, convergedTitle);
  assert.equal(yDocToSnapshot(docB).pages[0].icon, convergedIcon);

  net.cleanup();
});

test('3-peer complex network partition (split-brain) convergence', () => {
  const net = new MockNetwork();
  const docA = new Y.Doc();
  const docB = new Y.Doc();
  const docC = new Y.Doc();
  net.register('A', docA);
  net.register('B', docB);
  net.register('C', docC);

  // All start synced
  const initialPage: Page = {
    id: 'page-shared',
    title: 'Root Page',
    icon: null,
    cover: null,
    blocks: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  snapshotToYDoc({ pages: [initialPage], currentPageId: 'page-shared' }, docA);
  assertConverged(docA, docB);
  assertConverged(docA, docC);

  // Disconnect A from the rest (A is isolated, B & C are connected)
  net.disconnect('A');

  // B & C make changes, they sync with each other but not A
  const pageB = {
    ...initialPage,
    blocks: [{ id: 'b1', type: 'p' as const, content: 'Block from B' }],
  };
  updatePageInYDoc(pageB, docB);
  assertConverged(docB, docC);
  assert.notDeepEqual(yDocToSnapshot(docA), yDocToSnapshot(docB));

  // Now disconnect B too (A is isolated, B is isolated, C is isolated)
  net.disconnect('B');

  // C makes an independent change while isolated
  const pageC = {
    ...yDocToSnapshot(docC).pages[0],
    title: 'Title edited by C',
  };
  updatePageInYDoc(pageC, docC);

  // A makes changes while isolated
  const pageA = {
    ...initialPage,
    blocks: [{ id: 'a1', type: 'h1' as const, content: 'Block from A' }],
  };
  updatePageInYDoc(pageA, docA);

  // Connect B back
  net.connect('B');
  // Connect A back
  net.connect('A');

  // Verify all three docs converged
  assertConverged(docA, docB);
  assertConverged(docB, docC);

  // Assert they all agree on the same title and blocks
  const finalSnapA = yDocToSnapshot(docA);
  const finalSnapB = yDocToSnapshot(docB);
  const finalSnapC = yDocToSnapshot(docC);

  assert.equal(finalSnapA.pages[0].title, finalSnapB.pages[0].title);
  assert.equal(finalSnapA.pages[0].title, finalSnapC.pages[0].title);

  net.cleanup();
});

test('flapping / highly intermittent network connection stress test', () => {
  const net = new MockNetwork();
  const docA = new Y.Doc();
  const docB = new Y.Doc();
  net.register('A', docA);
  net.register('B', docB);

  // Initialize
  snapshotToYDoc({ pages: [], currentPageId: null }, docA);

  const activePageIds = new Set<string>();

  for (let i = 0; i < 50; i++) {
    // Random network state toggling
    if (Math.random() < 0.5) {
      if (Math.random() < 0.5) {
        net.disconnect('A');
      } else {
        net.connect('A');
      }
    }
    if (Math.random() < 0.5) {
      if (Math.random() < 0.5) {
        net.disconnect('B');
      } else {
        net.connect('B');
      }
    }

    // Make a random modification on one of the docs
    const docToModify = Math.random() < 0.5 ? docA : docB;
    const snap = yDocToSnapshot(docToModify);

    const action = Math.random();
    if (action < 0.3 || snap.pages.length === 0) {
      // Add page
      const newId = `page-rand-${i}`;
      const page: Page = {
        id: newId,
        title: `Random Page ${i}`,
        icon: null,
        cover: null,
        blocks: [],
        createdAt: Date.now() + i,
        updatedAt: Date.now() + i,
      };
      addPageToYDoc(page, docToModify);
      activePageIds.add(newId);
    } else if (action < 0.7) {
      // Update random page
      const pageIndex = Math.floor(Math.random() * snap.pages.length);
      const page = snap.pages[pageIndex];
      const updatedPage = {
        ...page,
        title: `${page.title} (mod ${i})`,
        blocks: [...page.blocks, { id: `b-rand-${i}`, type: 'p' as const, content: `Random content ${i}` }],
      };
      updatePageInYDoc(updatedPage, docToModify);
    } else {
      // Delete random page
      const pageIndex = Math.floor(Math.random() * snap.pages.length);
      const pageId = snap.pages[pageIndex].id;
      deletePageFromYDoc(pageId, docToModify);
      activePageIds.delete(pageId);
    }
  }

  // Restore network and sync
  net.connect('A');
  net.connect('B');

  // Verify ultimate convergence
  assertConverged(docA, docB, 'Intermittent flapping failed to converge');

  net.cleanup();
});

console.log(`\n${passed}/${passed + failed} WebRTC resilience tests passed.\n`);
if (failed > 0) process.exit(1);
