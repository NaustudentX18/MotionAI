/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Page } from '../types';
import { backlinksIndex } from './backlinksIndex';
import { encrypt, decrypt, isEncryptedData, EncryptedData } from './crypto';
import {
  initYjs,
  getYDoc,
  isYjsInitialized,
  yDocToSnapshot,
  snapshotToYDoc,
  updatePageInYDoc,
  deletePageFromYDoc,
  addPageToYDoc,
  setCurrentPageIdInYDoc,
  getYDocState,
  applyYDocState,
  setYjsKey,
  clearYjsKey,
  WorkspaceSnapshot,
} from './yjs';
import { migratePageBlocksToFragment } from './yjs-migration';

export type { WorkspaceSnapshot } from './yjs';

// ─── Workspace Meta (localStorage) ────────────────────────────────────────────

export interface WorkspaceMeta {
  id: string;
  name: string;
  createdAt: number;
  lastOpened: number;
}

const WORKSPACES_KEY = 'motionai-workspaces';

function browserStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function getWorkspacesFromStorage(): WorkspaceMeta[] {
  const storage = browserStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(WORKSPACES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveWorkspacesToStorage(workspaces: WorkspaceMeta[]): void {
  const storage = browserStorage();
  if (!storage) return;
  storage.setItem(WORKSPACES_KEY, JSON.stringify(workspaces));
}

export function listWorkspaces(): WorkspaceMeta[] {
  return getWorkspacesFromStorage();
}

export function createWorkspace(name: string): WorkspaceMeta {
  const workspaces = getWorkspacesFromStorage();
  const newWorkspace: WorkspaceMeta = {
    id: crypto.randomUUID(),
    name,
    createdAt: Date.now(),
    lastOpened: Date.now(),
  };
  workspaces.push(newWorkspace);
  saveWorkspacesToStorage(workspaces);
  return newWorkspace;
}

export function deleteWorkspace(id: string): void {
  const workspaces = getWorkspacesFromStorage().filter(w => w.id !== id);
  saveWorkspacesToStorage(workspaces);
  // Also clear the yjs state for this workspace
  if (typeof window !== 'undefined' && window.indexedDB) {
    const dbNames = [`motionai-ydoc-${id}`, `motionai-ydoc-encrypted-${id}`];
    dbNames.forEach(dbName => {
      const deleteReq = window.indexedDB.deleteDatabase(dbName);
      deleteReq.onsuccess = () => {};
    });
  }
}

export function renameWorkspace(id: string, name: string): void {
  const workspaces = getWorkspacesFromStorage().map(w =>
    w.id === id ? { ...w, name } : w
  );
  saveWorkspacesToStorage(workspaces);
}

export function updateLastOpened(id: string): void {
  const workspaces = getWorkspacesFromStorage().map(w =>
    w.id === id ? { ...w, lastOpened: Date.now() } : w
  );
  saveWorkspacesToStorage(workspaces);
}

export function getDefaultWorkspace(): WorkspaceMeta {
  const workspaces = getWorkspacesFromStorage();
  if (workspaces.length === 0) {
    return createWorkspace('Default');
  }
  // Return most recently opened
  return workspaces.sort((a, b) => b.lastOpened - a.lastOpened)[0];
}

// In-memory encryption key — NEVER persisted
let workspaceKey: string | null = null;

export function isWorkspaceLocked(): boolean {
  return workspaceKey === null;
}

export function setWorkspaceKey(passphrase: string): void {
  workspaceKey = passphrase;
  setYjsKey(passphrase);
}

export function clearWorkspaceKey(): void {
  workspaceKey = null;
  clearYjsKey();
}

const DB_NAME = 'open_notion_workspace';
const DB_VERSION = 1;
const STORE_NAME = 'workspace';
const WORKSPACE_KEY = 'default';

const FALLBACK_WORKSPACE_KEY = 'motion_ai_workspace';
const LEGACY_PAGE_KEYS = ['motion_ai_pages', 'notion_clone_pages'];
const LEGACY_CURRENT_PAGE_KEYS = ['motion_ai_current_page_id', 'notion_clone_current_page_id'];

function parsePages(raw: string | null): Page[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch (error) {
    console.error('Failed to parse persisted pages', error);
    return null;
  }
}

function parseWorkspace(raw: string | null): WorkspaceSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<WorkspaceSnapshot>;
    if (!Array.isArray(parsed.pages)) return null;
    return {
      pages: parsed.pages,
      currentPageId: typeof parsed.currentPageId === 'string' ? parsed.currentPageId : null,
    };
  } catch (error) {
    console.error('Failed to parse persisted workspace', error);
    return null;
  }
}

async function parseEncryptedWorkspace(raw: string | null, key: string): Promise<WorkspaceSnapshot | null> {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as EncryptedData;
    if (!isEncryptedData(parsed)) return null;
    const decrypted = await decrypt(parsed, key);
    const workspace = JSON.parse(decrypted) as Partial<WorkspaceSnapshot>;
    if (!Array.isArray(workspace.pages)) return null;
    return {
      pages: workspace.pages,
      currentPageId: typeof workspace.currentPageId === 'string' ? workspace.currentPageId : null,
    };
  } catch (error) {
    console.error('Failed to decrypt persisted workspace', error);
    return null;
  }
}

function loadFromLocalStorage(key?: string | null): Promise<WorkspaceSnapshot | null> {
  const storage = browserStorage();
  if (!storage) return Promise.resolve(null);

  const raw = storage.getItem(FALLBACK_WORKSPACE_KEY);
  if (!raw) return Promise.resolve(null);

  if (key) {
    return parseEncryptedWorkspace(raw, key).then(workspace => {
      if (workspace) return workspace;
      const unencrypted = parseWorkspace(raw);
      if (unencrypted) return unencrypted;
      return migrateLegacyPages(storage);
    });
  }

  const unencrypted = parseWorkspace(raw);
  if (unencrypted) return Promise.resolve(unencrypted);
  return Promise.resolve(migrateLegacyPages(storage));
}

function migrateLegacyPages(storage: Storage): WorkspaceSnapshot | null {
  const pages = LEGACY_PAGE_KEYS
    .map(key => parsePages(storage.getItem(key)))
    .find((value): value is Page[] => Array.isArray(value));

  if (!pages) return null;

  const currentPageId = LEGACY_CURRENT_PAGE_KEYS
    .map(key => storage.getItem(key))
    .find((value): value is string => Boolean(value)) ?? null;

  return { pages, currentPageId };
}

async function saveToLocalStorage(snapshot: WorkspaceSnapshot, key?: string | null): Promise<void> {
  const storage = browserStorage();
  if (!storage) return;

  if (key) {
    const encrypted = await encrypt(JSON.stringify(snapshot), key);
    storage.setItem(FALLBACK_WORKSPACE_KEY, JSON.stringify(encrypted));
  } else {
    storage.setItem(FALLBACK_WORKSPACE_KEY, JSON.stringify(snapshot));
  }
}

function indexedDBAvailable(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readIndexedDB(key?: string | null): Promise<WorkspaceSnapshot | null> {
  if (!indexedDBAvailable()) return null;

  let db: IDBDatabase | null = null;
  try {
    db = await openDB();
    const raw = await new Promise<unknown>((resolve, reject) => {
      const transaction = db!.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).get(WORKSPACE_KEY);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });

    if (!raw) return null;

    if (key && typeof raw === 'object' && raw !== null) {
      const rawObj = raw as Record<string, unknown>;
      if (typeof rawObj.ciphertext === 'string' && typeof rawObj.iv === 'string' && typeof rawObj.salt === 'string') {
        return parseEncryptedWorkspace(JSON.stringify(raw), key);
      }
    }

    return raw as WorkspaceSnapshot;
  } catch (error) {
    console.warn('IndexedDB read failed; falling back to localStorage', error);
    return null;
  } finally {
    db?.close();
  }
}

async function writeIndexedDB(snapshot: WorkspaceSnapshot, key?: string | null): Promise<boolean> {
  if (!indexedDBAvailable()) return false;

  let db: IDBDatabase | null = null;
  try {
    db = await openDB();

    const dataToStore = key
      ? await encrypt(JSON.stringify(snapshot), key)
      : snapshot;

    await new Promise<void>((resolve, reject) => {
      const transaction = db!.transaction(STORE_NAME, 'readwrite');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.objectStore(STORE_NAME).put(dataToStore, WORKSPACE_KEY);
    });
    return true;
  } catch (error) {
    console.warn('IndexedDB write failed; using localStorage fallback', error);
    return false;
  } finally {
    db?.close();
  }
}

/**
 * Load workspace snapshot from Yjs-backed IndexedDB.
 * Falls back to legacy stores if Yjs hasn't been used yet (migration path).
 *
 * This initializes the Y.Doc singleton if not already done.
 * The Y.Doc is ready after this call — use getYDoc() to access it.
 *
 * @param workspaceId - The workspace ID to load (uses default if not provided)
 */
export async function loadWorkspace(workspaceId?: string): Promise<WorkspaceSnapshot | null> {
  // Load legacy snapshot first (for migration check + E2EE key)
  const legacySnapshot = await (async () => {
    const indexed = await readIndexedDB(workspaceKey);
    if (indexed) return indexed;
    const local = await loadFromLocalStorage(workspaceKey);
    if (local && indexedDBAvailable()) {
      await writeIndexedDB(local, workspaceKey);
    }
    return local;
  })();

  // Initialize Yjs + y-indexeddb
  await initYjs(legacySnapshot, workspaceKey, workspaceId);

  // Migrate any pages with legacy Y.Array blocks to new Y.XmlFragment format
  const doc = getYDoc();
  const pagesMap = (doc as any).getMap('pages');
  if (pagesMap) {
    pagesMap.forEach((_pageYMap: any, pageId: string) => {
      migratePageBlocksToFragment(doc, pageId);
    });
  }

  // Derive snapshot from Y.Doc
  const snapshot = yDocToSnapshot(doc);

  if (snapshot.pages.length === 0 && legacySnapshot && legacySnapshot.pages.length > 0) {
    // Y.Doc was empty and we had a legacy snapshot — it was already migrated by initYjs
    // Re-derive from Y.Doc
    return yDocToSnapshot(getYDoc());
  }

  return snapshot;
}

/**
 * Save the current workspace snapshot to Yjs.
 * Yjs will auto-persist to IndexedDB via y-indexeddb.
 *
 * Also maintains a legacy backup in the old IndexedDB store for E2EE users.
 */
export async function saveWorkspace(snapshot: WorkspaceSnapshot): Promise<void> {
  // Write to Y.Doc (y-indexeddb auto-persists)
  snapshotToYDoc(snapshot, getYDoc());

  // Keep legacy backup for E2EE compatibility
  const savedToIndexedDB = await writeIndexedDB(snapshot, workspaceKey);
  if (!savedToIndexedDB || browserStorage()) {
    await saveToLocalStorage(snapshot, workspaceKey);
  }

  // Update backlinks index
  backlinksIndex.rebuildFromPages(snapshot.pages).catch(err => {
    console.warn('Failed to rebuild backlinks index', err);
  });
}

/**
 * Save a single page update to Yjs (incremental, avoids full snapshot re-serialization).
 * Use this for block-level edits to avoid serializing the entire workspace on every keystroke.
 */
export async function savePage(page: Page): Promise<void> {
  updatePageInYDoc(page);

  // Also update backlinks incrementally
  backlinksIndex.indexPage(page).catch(err => {
    console.warn('Failed to update backlinks for page', err);
  });
}

/**
 * Delete a page from Yjs.
 */
export async function deletePage(pageId: string): Promise<void> {
  deletePageFromYDoc(pageId);
  backlinksIndex.removePage(pageId).catch(err => {
    console.warn('Failed to cleanup backlinks for deleted page', err);
  });
}

/**
 * Add a new page to Yjs.
 */
export async function addPage(page: Page): Promise<void> {
  addPageToYDoc(page);
}

/**
 * Set the current page ID in Yjs.
 */
export async function setCurrentPageId(currentPageId: string | null): Promise<void> {
  setCurrentPageIdInYDoc(currentPageId);
}

/**
 * Reload workspace from the legacy (encrypted) store using the currently set key.
 * Used after unlock/set-passphrase to re-hydrate the Y.Doc from encrypted storage.
 */
export async function reloadWorkspaceFromLegacyStore(): Promise<WorkspaceSnapshot | null> {
  const legacySnapshot = await (async () => {
    const indexed = await readIndexedDB(workspaceKey);
    if (indexed) return indexed;
    const local = await loadFromLocalStorage(workspaceKey);
    if (local && indexedDBAvailable()) {
      await writeIndexedDB(local, workspaceKey);
    }
    return local;
  })();

  // Key was set but nothing loaded — decryption almost certainly failed
  if (!legacySnapshot && workspaceKey) {
    clearWorkspaceKey();
    throw new Error('DECRYPTION_FAILED');
  }

  if (!legacySnapshot) return null;

  // Write legacy snapshot to Y.Doc
  snapshotToYDoc(legacySnapshot, getYDoc());

  return legacySnapshot;
}

/**
 * Get the raw Y.Doc state (for encryption-at-rest if needed).
 */
export function getDocState(): Uint8Array {
  return getYDocState();
}

/**
 * Apply a raw Y.Doc state update (for sync/encryption scenarios).
 */
export function applyDocState(state: Uint8Array): void {
  applyYDocState(state);
}
