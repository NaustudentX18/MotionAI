import { Page } from '../types';
import { parseWikiLinks } from './backlinks';

const DB_NAME = 'open_notion_backlinks';
const DB_VERSION = 1;
const STORE_NAME = 'backlinks';

/** Maps page title → array of page IDs that link to it */
type BacklinksMap = Record<string, string[]>;

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

async function readAllBacklinks(): Promise<BacklinksMap> {
  if (!indexedDBAvailable()) return {};
  let db: IDBDatabase | null = null;
  try {
    db = await openDB();
    return await new Promise((resolve, reject) => {
      const transaction = db!.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result?.[0] ?? {});
      request.onerror = () => reject(request.error);
    });
  } catch {
    return {};
  } finally {
    db?.close();
  }
}

async function writeBacklinks(map: BacklinksMap): Promise<void> {
  if (!indexedDBAvailable()) return;
  let db: IDBDatabase | null = null;
  try {
    db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db!.transaction(STORE_NAME, 'readwrite');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.objectStore(STORE_NAME).put(map);
    });
  } catch (err) {
    console.warn('Failed to write backlinks index', err);
  } finally {
    db?.close();
  }
}

export class BacklinksIndex {
  private cache: BacklinksMap = {};
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    this.cache = await readAllBacklinks();
    this.initialized = true;
  }

  /** Rebuild the entire index from all pages */
  async rebuildFromPages(pages: Page[]): Promise<void> {
    const map: BacklinksMap = {};
    for (const page of pages) {
      const titles = this.extractPageLinks(page);
      for (const title of titles) {
        if (!map[title]) map[title] = [];
        if (!map[title].includes(page.id)) {
          map[title].push(page.id);
        }
      }
    }
    this.cache = map;
    await writeBacklinks(map);
  }

  /** Index a single page (update only its links) */
  async indexPage(page: Page): Promise<void> {
    await this.init();
    const linkedTitles = this.extractPageLinks(page);

    // Remove this page from all existing backlinks first
    for (const title of Object.keys(this.cache)) {
      this.cache[title] = this.cache[title].filter(id => id !== page.id);
      if (this.cache[title].length === 0) {
        delete this.cache[title];
      }
    }

    // Add fresh entries
    for (const title of linkedTitles) {
      if (!this.cache[title]) this.cache[title] = [];
      if (!this.cache[title].includes(page.id)) {
        this.cache[title].push(page.id);
      }
    }

    await writeBacklinks(this.cache);
  }

  /** Remove a page entirely from the index */
  async removePage(pageId: string): Promise<void> {
    await this.init();
    for (const title of Object.keys(this.cache)) {
      this.cache[title] = this.cache[title].filter(id => id !== pageId);
      if (this.cache[title].length === 0) {
        delete this.cache[title];
      }
    }
    await writeBacklinks(this.cache);
  }

  /** Get all page IDs that link to a given page title */
  getBacklinks(pageTitle: string): string[] {
    return this.cache[pageTitle] ?? [];
  }

  private extractPageLinks(page: Page): string[] {
    const titles = new Set<string>();
    for (const block of page.blocks) {
      for (const title of parseWikiLinks(block.content)) {
        titles.add(title);
      }
    }
    // Also check the page title itself
    if (page.title) {
      titles.add(page.title);
    }
    return Array.from(titles);
  }
}

export const backlinksIndex = new BacklinksIndex();
