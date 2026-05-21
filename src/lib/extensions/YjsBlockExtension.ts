/**
 * YjsBlockExtension — binds a TipTap editor to a Y.XmlFragment backed by a Y.Map.
 *
 * Sync strategy: The TipTap JSON document is stored in a Y.Map entry on the shared
 * Y.Doc (keyed `blocks-json-${pageId}`). The Y.XmlFragment is created per-page
 * (empty) so that Y.UndoManager can be scoped to it for per-page undo/redo.
 *
 * Echo-loop prevention: Uses a transaction origin flag so local TipTap updates
 * don't get pushed back from Yjs observe, and vice versa.
 */

import { Extension } from '@tiptap/core';
import type { Editor } from '@tiptap/core';
import * as Y from 'yjs';

export interface YjsBlockExtensionOptions {
  /** The page identifier, used as the JSON storage key: `blocks-json-${pageId}` */
  pageId: string;
  /** Optional Y.Map to use for storage. If not provided, looked up by pageId. */
  jsonMap?: Y.Map<string>;
  /** The Y.Doc to use. Defaults to the shared singleton. */
  ydoc?: Y.Doc;
}

const TRANSACTION_ORIGIN = 'tipTap-sync';
const JSON_MAP_PREFIX = 'blocks-json-';

// ─── Fragment / UndoManager registry ────────────────────────────────────────────

const fragmentCache = new Map<string, Y.XmlFragment>();
const undoManagerCache = new Map<string, Y.UndoManager>();

export function getOrCreateFragment(ydoc: Y.Doc, pageId: string): Y.XmlFragment {
  const key = `blocks-${pageId}`;
  const cached = fragmentCache.get(key);
  if (cached) return cached;

  const fragment = ydoc.getXmlFragment(key);
  fragmentCache.set(key, fragment);
  return fragment;
}

export function createFragmentUndoManager(fragment: Y.XmlFragment, pageId: string): Y.UndoManager {
  const cached = undoManagerCache.get(pageId);
  if (cached) return cached;

  const manager = new Y.UndoManager(fragment, { trackedOrigins: new Set([TRANSACTION_ORIGIN]) });
  undoManagerCache.set(pageId, manager);
  return manager;
}

// ─── Extension ────────────────────────────────────────────────────────────────

export const YjsBlockExtension = Extension.create<YjsBlockExtensionOptions>({
  name: 'yjsBlock',

  addOptions() {
    return {
      pageId: '',
      jsonMap: undefined,
      ydoc: undefined,
    };
  },

  onCreate() {
    const options = this.options;
    const editor = this.editor as Editor;
    const ydoc = options.ydoc ?? (YjsBlockExtension as any).getYDoc?.() ?? getYDocStatic();

    // JSON storage map (either injected or looked up by pageId)
    const jsonMap =
      options.jsonMap ??
      (ydoc.getMap(`${JSON_MAP_PREFIX}${options.pageId}`) as Y.Map<string>);

    let isApplyingRemoteChange = false;

    // ── 1. TipTap → Yjs ────────────────────────────────────────────────────
    editor.on('update', ({ editor: ed }) => {
      if (isApplyingRemoteChange) return;

      const json = ed.getJSON();
      const serialized = JSON.stringify(json);

      ydoc.transact(() => {
        jsonMap.set('json', serialized);
      }, TRANSACTION_ORIGIN);
    });

    // ── 2. Yjs → TipTap ────────────────────────────────────────────────────
    const observer = (event: Y.YMapEvent<string>) => {
      if (event.transaction.origin === TRANSACTION_ORIGIN) return;
      if (isApplyingRemoteChange) return;

      const jsonValue = jsonMap.get('json');
      if (typeof jsonValue !== 'string') return;

      try {
        const parsed = JSON.parse(jsonValue);
        isApplyingRemoteChange = true;
        try {
          // false = don't emit update (we're applying a remote change)
          editor.commands.setContent(parsed, { emitUpdate: false });
        } finally {
          isApplyingRemoteChange = false;
        }
      } catch {
        // Malformed JSON — ignore
      }
    };

    jsonMap.observe(observer);

    // Store for cleanup
    (this as any).__jsonMap = jsonMap;
    (this as any).__observer = observer;
  },

  onDestroy() {
    const ext = this as any;
    if (ext.__jsonMap && ext.__observer) {
      ext.__jsonMap.unobserve(ext.__observer);
    }
    const key = `blocks-${this.options.pageId}`;
    fragmentCache.delete(key);
    undoManagerCache.delete(this.options.pageId);
  },
});

// ─── Static helpers ──────────────────────────────────────────────────────────

// Circular dep guard: getYDoc from yjs.ts at call time
let _getYDocStatic: () => Y.Doc = () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getYDoc } = require('../yjs');
    return getYDoc();
  } catch {
    throw new Error('YjsBlockExtension: cannot resolve Y.Doc. Provide ydoc option or call setYDocGetter first.');
  }
};

export function setYDocGetter(fn: () => Y.Doc): void {
  _getYDocStatic = fn;
}

function getYDocStatic(): Y.Doc {
  return _getYDocStatic();
}

(YjsBlockExtension as any).getYDoc = getYDocStatic;
(YjsBlockExtension as any).getOrCreateFragment = getOrCreateFragment;
(YjsBlockExtension as any).createUndoManager = createFragmentUndoManager;
