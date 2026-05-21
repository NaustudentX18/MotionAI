/**
 * Yjs CRDT layer for MotionAI persistence.
 * Y.Doc is the source of truth; React state is derived from it.
 */

import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { WebrtcProvider } from 'y-webrtc';
import { Page, Block } from '../types';
import type { EncryptedData } from './crypto';
import { encryptBinary, decryptBinary } from './crypto';

export interface WorkspaceSnapshot {
  pages: Page[];
  currentPageId: string | null;
}

// Module-level singleton — initialized once
let ydoc: Y.Doc | null = null;
let persistence: IndexeddbPersistence | null = null;
const webrtcProviders = new Map<string, WebrtcProvider>();
let initialized = false;
let initPromise: Promise<void> | null = null;

// Encryption key — derived from passphrase, never persisted
let workspaceKey: string | null = null;

// Current workspace ID (for multi-workspace support)
let currentWorkspaceId: string | null = null;

const BASE_DB_NAME = 'motionai-ydoc';

/**
 * Set the encryption key (from E2EE passphrase).
 * Must be called before initYjs().
 */
export function setYjsKey(key: string): void {
  workspaceKey = key;
}

export function clearYjsKey(): void {
  workspaceKey = null;
}

export function getYjsKey(): string | null {
  return workspaceKey;
}

// ─── Y.Doc accessors ─────────────────────────────────────────────────────────

export function getYDoc(): Y.Doc {
  if (!ydoc) {
    ydoc = new Y.Doc();
  }
  return ydoc;
}

// ─── WebrtcProvider for peer collaboration ─────────────────────────────────────

const DEFAULT_ROOM = 'opennotion-collab';

export function getWebrtcProvider(roomName: string = DEFAULT_ROOM): WebrtcProvider {
  if (webrtcProviders.has(roomName)) return webrtcProviders.get(roomName)!;
  const doc = getYDoc();

  // Parse VITE_SIGNALING_URLS (comma-separated list of WebSocket URLs).
  // Falls back to the public Y.js signaling server only when the env var is unset.
  const raw = import.meta.env.VITE_SIGNALING_URLS as string | undefined;
  const signaling: string[] = raw
    ? raw.split(',').map((s) => s.trim()).filter(Boolean)
    : ['wss://signaling.yjs.dev'];

  const provider = new WebrtcProvider(roomName, doc, { signaling });
  webrtcProviders.set(roomName, provider);
  return provider;
}

// ─── Y.Doc structure helpers ─────────────────────────────────────────────────

function getPagesMap(doc: Y.Doc): Y.Map<Y.Map<unknown>> {
  return doc.getMap('pages') as Y.Map<Y.Map<unknown>>;
}

function getCurrentPageId(doc: Y.Doc): Y.Text {
  return doc.getText('currentPageId');
}

function yMapToPage(id: string, ymap: Y.Map<unknown>): Page {
  const blocksYArray = ymap.get('blocks') as Y.Array<Y.Map<unknown>> | undefined;
  const blocks: Block[] = [];

  if (blocksYArray) {
    blocksYArray.forEach((blockYMap: Y.Map<unknown>) => {
      blocks.push(yMapToBlock(blockYMap));
    });
  }

  return {
    id,
    title: (ymap.get('title') as string) ?? '',
    icon: (ymap.get('icon') as string | null) ?? null,
    cover: (ymap.get('cover') as string | null) ?? null,
    blocks,
    createdAt: (ymap.get('createdAt') as number) ?? Date.now(),
    updatedAt: (ymap.get('updatedAt') as number) ?? Date.now(),
    versions: (ymap.get('versions') as Page['versions']) ?? undefined,
  };
}

function yMapToBlock(ymap: Y.Map<unknown>): Block {
  const styleYMap = ymap.get('style') as Y.Map<unknown> | undefined;
  const commentsYArray = ymap.get('comments') as Y.Array<Y.Map<unknown>> | undefined;

  const style = styleYMap ? yMapToStyle(styleYMap) : undefined;
  const comments = commentsYArray
    ? commentsYArray.toArray().map((c: Y.Map<unknown>) => yMapToComment(c))
    : undefined;

  return {
    id: (ymap.get('id') as string) ?? '',
    type: (ymap.get('type') as Block['type']) ?? 'p',
    content: (ymap.get('content') as string) ?? '',
    checked: ymap.get('checked') as boolean | undefined,
    indentLevel: ymap.get('indentLevel') as number | undefined,
    style,
    comments,
    aiPrompt: ymap.get('aiPrompt') as string | undefined,
    aiContext: ymap.get('aiContext') as string | undefined,
    language: ymap.get('language') as string | undefined,
  };
}

function yMapToStyle(ymap: Y.Map<unknown>): Block['style'] {
  return {
    bold: ymap.get('bold') as boolean | undefined,
    italic: ymap.get('italic') as boolean | undefined,
    underline: ymap.get('underline') as boolean | undefined,
    color: ymap.get('color') as string | undefined,
    backgroundColor: ymap.get('backgroundColor') as string | undefined,
  };
}

function yMapToComment(ymap: Y.Map<unknown>): { id: string; author: string; text: string; createdAt: number } {
  return {
    id: (ymap.get('id') as string) ?? '',
    author: (ymap.get('author') as string) ?? '',
    text: (ymap.get('text') as string) ?? '',
    createdAt: (ymap.get('createdAt') as number) ?? Date.now(),
  };
}

// ─── Page → Y.Map conversion ────────────────────────────────────────────────

function pageToYMap(doc: Y.Doc, page: Page): Y.Map<unknown> {
  const ymap = new Y.Map<unknown>();

  ymap.set('id', page.id);
  ymap.set('title', page.title);
  ymap.set('icon', page.icon);
  ymap.set('cover', page.cover);
  ymap.set('createdAt', page.createdAt);
  ymap.set('updatedAt', page.updatedAt);
  if (page.versions) {
    ymap.set('versions', page.versions);
  }

  // Blocks as Y.Array of Y.Maps
  const blocksYArray = new Y.Array<Y.Map<unknown>>();
  for (const block of page.blocks) {
    blocksYArray.push([blockToYMap(doc, block)]);
  }
  ymap.set('blocks', blocksYArray);

  return ymap;
}

function blockToYMap(_doc: Y.Doc, block: Block): Y.Map<unknown> {
  const ymap = new Y.Map<unknown>();

  ymap.set('id', block.id);
  ymap.set('type', block.type);
  ymap.set('content', block.content);
  if (block.checked !== undefined) ymap.set('checked', block.checked);
  if (block.indentLevel !== undefined) ymap.set('indentLevel', block.indentLevel);
  if (block.aiPrompt !== undefined) ymap.set('aiPrompt', block.aiPrompt);
  if (block.aiContext !== undefined) ymap.set('aiContext', block.aiContext);
  if (block.language !== undefined) ymap.set('language', block.language);

  if (block.style) {
    const styleYMap = new Y.Map<unknown>();
    if (block.style.bold !== undefined) styleYMap.set('bold', block.style.bold);
    if (block.style.italic !== undefined) styleYMap.set('italic', block.style.italic);
    if (block.style.underline !== undefined) styleYMap.set('underline', block.style.underline);
    if (block.style.color !== undefined) styleYMap.set('color', block.style.color);
    if (block.style.backgroundColor !== undefined) styleYMap.set('backgroundColor', block.style.backgroundColor);
    ymap.set('style', styleYMap);
  }

  if (block.comments && block.comments.length > 0) {
    const commentsYArray = new Y.Array<Y.Map<unknown>>();
    for (const comment of block.comments) {
      const commentYMap = new Y.Map<unknown>();
      commentYMap.set('id', comment.id);
      commentYMap.set('author', comment.author);
      commentYMap.set('text', comment.text);
      commentYMap.set('createdAt', comment.createdAt);
      commentsYArray.push([commentYMap]);
    }
    ymap.set('comments', commentsYArray);
  }

  return ymap;
}

// ─── Full doc ↔ snapshot conversion ─────────────────────────────────────────

export function yDocToSnapshot(doc: Y.Doc): WorkspaceSnapshot {
  const pagesMap = getPagesMap(doc);
  const pages: Page[] = [];

  pagesMap.forEach((ymap, id) => {
    pages.push(yMapToPage(id, ymap));
  });

  // Sort by createdAt to maintain consistent order
  pages.sort((a, b) => a.createdAt - b.createdAt);

  const currentPageIdText = getCurrentPageId(doc);
  const currentPageId = currentPageIdText.toString() || null;

  return { pages, currentPageId };
}

export function snapshotToYDoc(snapshot: WorkspaceSnapshot, doc: Y.Doc): void {
  doc.transact(() => {
    const pagesMap = getPagesMap(doc);

    // Clear existing pages
    pagesMap.forEach((_, key) => {
      pagesMap.delete(key);
    });

    // Write new pages
    for (const page of snapshot.pages) {
      pagesMap.set(page.id, pageToYMap(doc, page));
    }

    // Write currentPageId
    const currentPageIdText = getCurrentPageId(doc);
    currentPageIdText.delete(0, currentPageIdText.length);
    if (snapshot.currentPageId) {
      currentPageIdText.insert(0, snapshot.currentPageId);
    }
  });
}

// ─── Incremental page update (avoids full re-serialization) ─────────────────

export function updatePageInYDoc(page: Page, doc?: Y.Doc): void {
  const d = doc ?? getYDoc();
  const pagesMap = getPagesMap(d);

  d.transact(() => {
    pagesMap.set(page.id, pageToYMap(d, page));
  });
}

export function deletePageFromYDoc(pageId: string, doc?: Y.Doc): void {
  const d = doc ?? getYDoc();
  const pagesMap = getPagesMap(d);

  d.transact(() => {
    pagesMap.delete(pageId);
  });
}

export function addPageToYDoc(page: Page, doc?: Y.Doc): void {
  const d = doc ?? getYDoc();
  const pagesMap = getPagesMap(d);

  d.transact(() => {
    pagesMap.set(page.id, pageToYMap(d, page));
  });
}

export function setCurrentPageIdInYDoc(currentPageId: string | null, doc?: Y.Doc): void {
  const d = doc ?? getYDoc();
  const currentPageIdText = getCurrentPageId(d);

  d.transact(() => {
    currentPageIdText.delete(0, currentPageIdText.length);
    if (currentPageId) {
      currentPageIdText.insert(0, currentPageId);
    }
  });
}

// ─── Raw state for encryption ────────────────────────────────────────────────

export function getYDocState(doc?: Y.Doc): Uint8Array {
  const d = doc ?? getYDoc();
  return Y.encodeStateAsUpdate(d);
}

export function applyYDocState(state: Uint8Array, doc?: Y.Doc): void {
  const d = doc ?? getYDoc();
  Y.applyUpdate(d, state);
}

// ─── Encrypted persistence ────────────────────────────────────────────────────

const DB_NAME_ENC = 'motionai-ydoc-encrypted';
const STORE_NAME_ENC = 'ydoc_encrypted';
const STATE_KEY = 'y_doc_state';

async function initEncryptedPersistence(
  doc: Y.Doc,
  key: string,
  legacySnapshot: WorkspaceSnapshot | null,
  workspaceId?: string
): Promise<void> {
  const dbName = workspaceId ? `${DB_NAME_ENC}-${workspaceId}` : DB_NAME_ENC;
  return new Promise<void>((resolve) => {
    const openReq = indexedDB.open(dbName, 1);

    openReq.onupgradeneeded = () => {
      const db = openReq.result;
      if (!db.objectStoreNames.contains(STORE_NAME_ENC)) {
        db.createObjectStore(STORE_NAME_ENC);
      }
    };

    openReq.onsuccess = async () => {
      const db = openReq.result;

      // Load existing encrypted state
      const tx = db.transaction(STORE_NAME_ENC, 'readonly');
      const getReq = tx.objectStore(STORE_NAME_ENC).get(STATE_KEY);

      getReq.onsuccess = async () => {
        const encryptedData = getReq.result as EncryptedData | undefined;

        if (encryptedData) {
          try {
            const state = await decryptBinary(encryptedData, key);
            Y.applyUpdate(doc, state);
          } catch (e) {
            // Wrong key or corrupted data — start fresh
            console.warn('Failed to decrypt Y.Doc state:', e);
          }
        } else if (legacySnapshot) {
          // First time with key: migrate from legacy snapshot
          snapshotToYDoc(legacySnapshot, doc);
        }

        // Persist future updates — encode full state on every local change
        const updateHandler = (_update: Uint8Array, origin: unknown) => {
          if (origin === 'remote') return; // Don't write remote updates back
          const fullState = Y.encodeStateAsUpdate(doc);
          encryptBinary(fullState, key)
            .then((enc) => {
              const wt = db.transaction(STORE_NAME_ENC, 'readwrite');
              wt.objectStore(STORE_NAME_ENC).put(enc, STATE_KEY);
            })
            .catch(console.error);
        };
        doc.on('update', updateHandler);

        initialized = true;
        resolve();
      };

      getReq.onerror = () => {
        initialized = true;
        resolve();
      };
    };

    openReq.onerror = () => {
      initialized = true;
      resolve();
    };
  });
}

// ─── Initialization ──────────────────────────────────────────────────────────

/**
 * Initialize the Y.Doc singleton and persistence.
 * Returns a promise that resolves when initial sync from IndexedDB is complete.
 *
 * When `key` is provided, uses custom encrypted IndexedDB storage.
 * When no key, uses unencrypted y-indexeddb persistence.
 *
 * If a legacy (non-Yjs) workspace snapshot exists in the separate legacy store,
 * it will be migrated into the Y.Doc automatically.
 *
 * @param workspaceId - Optional workspace ID for multi-workspace support (changes IndexedDB key)
 */
export async function initYjs(
  legacySnapshot: WorkspaceSnapshot | null,
  key?: string | null,
  workspaceId?: string
): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;

  currentWorkspaceId = workspaceId ?? null;

  // Determine the correct DB name based on workspace
  const dbName = workspaceId ? `${BASE_DB_NAME}-${workspaceId}` : BASE_DB_NAME;

  const doc = getYDoc();

  if (key) {
    // ── Encrypted persistence ──────────────────────────────────────
    initPromise = initEncryptedPersistence(doc, key, legacySnapshot, workspaceId);
  } else {
    // ── Unencrypted y-indexeddb persistence ─────────────────────────
    initPromise = new Promise<void>((resolve) => {
      persistence = new IndexeddbPersistence(dbName, doc);

      persistence.on('synced', async () => {
        const pagesMap = getPagesMap(doc);
        const isYDocEmpty = pagesMap.size === 0;

        if (isYDocEmpty && legacySnapshot) {
          snapshotToYDoc(legacySnapshot, doc);
        }

        initialized = true;
        resolve();
      });

      setTimeout(() => {
        if (!initialized) {
          initialized = true;
          resolve();
        }
      }, 5000);
    });
  }

  return initPromise;
}

export function isYjsInitialized(): boolean {
  return initialized;
}

export function getCurrentWorkspaceId(): string | null {
  return currentWorkspaceId;
}

export function destroyYjs(): void {
  webrtcProviders.forEach((p) => p.destroy());
  webrtcProviders.clear();
  if (persistence) {
    persistence.destroy();
    persistence = null;
  }
  if (ydoc) {
    ydoc.destroy();
    ydoc = null;
  }
  initialized = false;
  initPromise = null;
  currentWorkspaceId = null;
}
