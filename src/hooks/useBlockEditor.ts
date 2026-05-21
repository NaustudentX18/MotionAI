/**
 * useBlockEditor — creates and manages a TipTap editor bound to a Y.XmlFragment.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { Editor } from '@tiptap/core';
import * as Y from 'yjs';
import { Block, BlockType } from '../types';
import { blockSchema } from '../lib/tiptap-schema';
import { inlineMarks } from '../lib/tiptap-marks';
import { createInputRules } from '../lib/tiptap-input-rules';
import { Extension } from '@tiptap/core';
import { CollaborationCursor } from '@tiptap/extension-collaboration-cursor';
import { YjsBlockExtension, setYDocGetter } from '../lib/extensions/YjsBlockExtension';
import { DragHandleExtension } from '../lib/extensions/DragHandleExtension';
import { getYDoc, getWebrtcProvider } from '../lib/yjs';
import { v4 as uuidv4 } from 'uuid';

const JSON_MAP_PREFIX = 'blocks-json-';

// ─── Block → TipTap JSON ──────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

function blockToTipTapNode(block: Block): Record<string, unknown> {
  const nodeName = block.type + 'Node';

  const attrs: Record<string, unknown> = {
    id: block.id || uuidv4(),
    indentLevel: block.indentLevel ?? 0,
  };

  if (block.type === 'todo' && block.checked !== undefined) {
    (attrs as Record<string, unknown>).checked = block.checked;
  }
  if (block.type === 'code' && block.language) {
    (attrs as Record<string, unknown>).language = block.language;
  }
  if (
    (block.type === 'ai-summary' ||
      block.type === 'ai-draft' ||
      block.type === 'ai-rewrite') &&
    block.aiPrompt
  ) {
    (attrs as Record<string, unknown>).aiPrompt = block.aiPrompt;
    (attrs as Record<string, unknown>).aiContext = block.aiContext ?? '';
  }

  const textContent = stripHtml(block.content);
  const content =
    textContent.length > 0 ? [{ type: 'text', text: textContent }] : [];

  return { type: nodeName, attrs, content };
}

function blocksToTipTapJSON(blocks: Block[]): Record<string, unknown> {
  return {
    type: 'doc',
    content: blocks.map(blockToTipTapNode),
  };
}

// ─── TipTap JSON → Block ──────────────────────────────────────────────────────

function tipTapToBlocks(json: Record<string, unknown>): Block[] {
  const content = json.content as Array<Record<string, unknown>> | undefined;
  if (!content) return [];

  return content.map((node) => {
    const attrs = (node.attrs as Record<string, unknown>) ?? {};
    const nodeContent = (node.content as Array<Record<string, unknown>> | undefined) ?? [];
    const firstText = nodeContent.find((n) => n.type === 'text') as
      | { type: string; text: string }
      | undefined;

    const typeName = (node.type as string) ?? '';
    const blockType = typeName.replace(/Node$/, '') as BlockType;

    const block: Block = {
      id: (attrs.id as string) || uuidv4(),
      type: blockType,
      content: firstText?.text ?? '',
      indentLevel: (attrs.indentLevel as number) ?? 0,
    };

    if (blockType === 'todo') {
      block.checked = Boolean(attrs.checked);
    }
    if (blockType === 'code') {
      block.language = (attrs.language as string) ?? 'javascript';
    }
    if (blockType === 'ai-summary' || blockType === 'ai-draft' || blockType === 'ai-rewrite') {
      block.aiPrompt = (attrs.aiPrompt as string) ?? '';
      block.aiContext = (attrs.aiContext as string) ?? '';
    }

    return block;
  });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseBlockEditorOptions {
  /** Page identifier */
  pageId: string;
  /** Initial blocks (used when fragment is empty) */
  initialBlocks: Block[];
  /** Callback fired when editor content changes */
  onChange: (blocks: Block[]) => void;
  /** Y.Doc to use (defaults to the shared singleton) */
  ydoc?: Y.Doc;
}

export interface UseBlockEditorResult {
  editor: Editor | null;
  isReady: boolean;
  commands: {
    setBlockType: (type: BlockType) => void;
    toggleBold: () => void;
    toggleItalic: () => void;
    toggleUnderline: () => void;
    setIndent: (level: number) => void;
    insertBlock: (type: BlockType, at?: number) => void;
    deleteBlock: (at?: number) => void;
    setContent: (blocks: Block[]) => void;
  };
}

export function useBlockEditor({
  pageId,
  initialBlocks,
  onChange,
  ydoc: ydocProp,
}: UseBlockEditorOptions): UseBlockEditorResult {
  const ydoc = ydocProp ?? getYDoc();

  // Set the Y.Doc getter so YjsBlockExtension can access it
  setYDocGetter(() => ydoc);

  const [editor, setEditor] = useState<Editor | null>(null);
  const [isReady, setIsReady] = useState(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    // Look up the JSON map (same key as used in YjsBlockExtension)
    const jsonMap = ydoc.getMap(`${JSON_MAP_PREFIX}${pageId}`) as Y.Map<string>;
    const existingJson = jsonMap.get('json');

    const json =
      existingJson !== undefined
        ? (JSON.parse(existingJson) as Record<string, unknown>)
        : blocksToTipTapJSON(initialBlocks);

    const InputRulesExtension = Extension.create({
      name: 'inputRules',
      addInputRules() {
        return createInputRules();
      },
    });

    // Generate or retrieve anonymous user identity for collaboration
    const storedUserName = typeof window !== 'undefined' ? localStorage.getItem('opennotion-username') : null;
    const userName = storedUserName || `Anonymous-${Math.floor(Math.random() * 10000)}`;
    if (typeof window !== 'undefined' && !storedUserName) {
      localStorage.setItem('opennotion-username', userName);
    }
    const userColor = '#' + Math.floor(Math.random() * 16777215).toString(16);

    // Set up WebrtcProvider for peer collaboration
    const provider = getWebrtcProvider(`opennotion-${pageId}`);
    provider.awareness.setLocalStateField('user', {
      name: userName,
      color: userColor,
    });

    const editorInstance = new Editor({
      extensions: [
        ...blockSchema,
        ...inlineMarks,
        DragHandleExtension,
        InputRulesExtension,
        YjsBlockExtension.configure({
          pageId,
          ydoc,
          jsonMap,
        }),
        CollaborationCursor.configure({
          provider,
          user: {
            name: userName,
            color: userColor,
          },
        }),
      ],
      content: json,
      onUpdate: ({ editor: ed }) => {
        const tipTapJson = ed.getJSON();
        const blocks = tipTapToBlocks(tipTapJson);
        onChangeRef.current(blocks);
      },
    });

    setEditor(editorInstance);
    setIsReady(true);

    return () => {
      editorInstance.destroy();
      setEditor(null);
      setIsReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]); // intentionally omit initialBlocks / onChange — only mount once per pageId

  const commands = {
    setBlockType: useCallback((type: BlockType) => {
      if (!editor) return;
      // toggleNode switches between two node types; here we just insert the target node
      const nodeName = type + 'Node';
      editor.chain().focus().insertContent({ type: nodeName, attrs: { id: uuidv4() } }).run();
    }, [editor]),

    toggleBold: useCallback(() => {
      if (!editor) return;
      editor.chain().focus().toggleMark('bold').run();
    }, [editor]),

    toggleItalic: useCallback(() => {
      if (!editor) return;
      editor.chain().focus().toggleMark('italic').run();
    }, [editor]),

    toggleUnderline: useCallback(() => {
      if (!editor) return;
      editor.chain().focus().toggleMark('underline').run();
    }, [editor]),

    setIndent: useCallback((level: number) => {
      if (!editor) return;
      const { from } = editor.state.selection;
      const node = editor.state.doc.nodeAt(from);
      if (!node) return;
      const tr = editor.state.tr.setNodeMarkup(from, undefined, { ...node.attrs, indentLevel: level });
      editor.view.dispatch(tr);
    }, [editor]),

    insertBlock: useCallback((type: BlockType, at?: number) => {
      if (!editor) return;
      const nodeName = type + 'Node';
      const attrs: Record<string, unknown> = { id: uuidv4(), indentLevel: 0 };
      if (type === 'todo') attrs.checked = false;
      if (type === 'code') attrs.language = 'javascript';

      if (at !== undefined) {
        editor.chain().focus().insertContentAt(at, { type: nodeName, attrs }).run();
      } else {
        editor.chain().focus().insertContent({ type: nodeName, attrs }).run();
      }
    }, [editor]),

    deleteBlock: useCallback((at?: number) => {
      if (!editor) return;
      if (at !== undefined) {
        editor.chain().focus().deleteRange({ from: at, to: at + 1 }).run();
      } else {
        editor.chain().focus().deleteSelection().run();
      }
    }, [editor]),

    setContent: useCallback((blocks: Block[]) => {
      if (!editor) return;
      const json = blocksToTipTapJSON(blocks);
      editor.commands.setContent(json, { emitUpdate: true });
    }, [editor]),
  };

  return { editor, isReady, commands };
}
