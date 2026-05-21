/**
 * yjs-migration — migrate pages from legacy Y.Array<Y.Map> blocks to Y.XmlFragment.
 *
 * Legacy structure:
 *   ydoc.getMap('pages').get(pageId) → Y.Map with blocks: Y.Array<Y.Map<unknown>>
 *
 * New structure:
 *   ydoc.getXmlFragment(`blocks-${pageId}`) → Y.XmlFragment storing TipTap JSON doc
 *
 * Migration is idempotent: checks if fragment already has data before migrating.
 */

import * as Y from 'yjs';
import { Block, BlockType } from '../types';

// ─── Block → TipTap JSON node ─────────────────────────────────────────────────

function blockToTipTapNode(block: Block): Record<string, unknown> {
  const nodeName = block.type + 'Node';
  const textContent = stripHtml(block.content);

  const attrs: Record<string, unknown> = {
    id: block.id,
    indentLevel: block.indentLevel ?? 0,
  };

  if (block.type === 'todo' && block.checked !== undefined) {
    attrs.checked = block.checked;
  }
  if (block.type === 'code' && block.language) {
    attrs.language = block.language;
  }
  if (
    (block.type === 'ai-summary' || block.type === 'ai-draft' || block.type === 'ai-rewrite') &&
    block.aiPrompt
  ) {
    attrs.aiPrompt = block.aiPrompt;
    attrs.aiContext = block.aiContext ?? '';
  }

  const content =
    textContent.length > 0 ? [{ type: 'text', text: textContent }] : [];

  return {
    type: nodeName,
    attrs,
    content,
  };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

function blocksToTipTapJSON(blocks: Block[]): Record<string, unknown> {
  return {
    type: 'doc',
    content: blocks.map(blockToTipTapNode),
  };
}

const JSON_MAP_PREFIX = 'blocks-json-';

// ─── Migration ────────────────────────────────────────────────────────────────

/**
 * Migrate a page's blocks from legacy Y.Array<Y.Map> to Y.XmlFragment.
 *
 * Returns `true` if migration was performed, `false` if already migrated
 * or page had no blocks (idempotent).
 */
export function migrateBlockArrayToFragment(
  ydoc: Y.Doc,
  pageId: string,
  legacyBlocks: Block[]
): boolean {
  const jsonMap = ydoc.getMap(`${JSON_MAP_PREFIX}${pageId}`) as Y.Map<string>;

  // Idempotency: already migrated
  if (jsonMap.get('json') !== undefined) {
    return false;
  }

  if (legacyBlocks.length === 0) {
    return false;
  }

  const tipTapDoc = blocksToTipTapJSON(legacyBlocks);
  const serialized = JSON.stringify(tipTapDoc);

  ydoc.transact(() => {
    jsonMap.set('json', serialized);
  });

  return true;
}

/**
 * Migrate a page by removing the legacy blocks array from its Y.Map.
 * Call this AFTER migrateBlockArrayToFragment succeeds.
 */
export function removeLegacyBlocksFromPage(ydoc: Y.Doc, pageId: string): void {
  const pagesMap = ydoc.getMap('pages');
  const pageMap = pagesMap.get(pageId) as Y.Map<unknown> | undefined;

  if (!pageMap) return;

  ydoc.transact(() => {
    pageMap.delete('blocks');
  });
}

/**
 * Convenience: migrate if needed and remove legacy representation.
 * Returns `true` if migration happened.
 */
export function migratePageBlocksToFragment(
  ydoc: Y.Doc,
  pageId: string
): boolean {
  // Retrieve legacy blocks from the page's Y.Map
  const pagesMap = ydoc.getMap('pages');
  const pageMap = pagesMap.get(pageId) as Y.Map<unknown> | undefined;

  if (!pageMap) return false;

  const blocksYArray = pageMap.get('blocks') as Y.Array<Y.Map<unknown>> | undefined;
  if (!blocksYArray || blocksYArray.length === 0) return false;

  const legacyBlocks: Block[] = [];
  blocksYArray.forEach((blockYMap: Y.Map<unknown>) => {
    legacyBlocks.push(yMapToBlock(blockYMap));
  });

  const migrated = migrateBlockArrayToFragment(ydoc, pageId, legacyBlocks);
  if (migrated) {
    removeLegacyBlocksFromPage(ydoc, pageId);
  }

  return migrated;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function yMapToBlock(ymap: Y.Map<unknown>): Block {
  const styleYMap = ymap.get('style') as Y.Map<unknown> | undefined;
  const commentsYArray = ymap.get('comments') as Y.Array<Y.Map<unknown>> | undefined;

  const style = styleYMap ? yMapToStyle(styleYMap) : undefined;
  const comments = commentsYArray
    ? commentsYArray.toArray().map((c: Y.Map<unknown>) => yMapToComment(c))
    : undefined;

  return {
    id: (ymap.get('id') as string) ?? '',
    type: (ymap.get('type') as BlockType) ?? 'p',
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
