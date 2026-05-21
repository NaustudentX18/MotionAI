import { useState, useCallback } from 'react';
import type { Editor } from '@tiptap/core';
import type { BlockComment } from '../types';
import { v4 as uuidv4 } from 'uuid';

export interface BlockCommentsState {
  activeStyleBlockId: string | null;
  activeCommentBlockId: string | null;
  newCommentText: string;
}

export interface BlockCommentsActions {
  setActiveStyleBlockId: (v: string | null) => void;
  setActiveCommentBlockId: (v: string | null) => void;
  setNewCommentText: (v: string) => void;
  updateNodeAttrs: (blockId: string, newAttrs: Record<string, unknown>) => void;
  addBlockComment: (blockId: string) => void;
  removeBlockComment: (blockId: string, commentId: string) => void;
  getBlockComments: (blockId: string) => BlockComment[];
  openCommentPopupForCurrentBlock: () => void;
}

export function useBlockComments(editor: Editor | null): BlockCommentsState & BlockCommentsActions {
  const [activeStyleBlockId, setActiveStyleBlockId] = useState<string | null>(null);
  const [activeCommentBlockId, setActiveCommentBlockId] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState('');

  const updateNodeAttrs = useCallback((blockId: string, newAttrs: Record<string, unknown>) => {
    if (!editor) return;
    let targetPos: number | null = null;
    let targetNodeType: any = null;
    let targetAttrs: Record<string, unknown> = {};
    editor.state.doc.descendants((node, pos) => {
      if (node.attrs?.id === blockId) {
        targetPos = pos;
        targetNodeType = node.type;
        targetAttrs = { ...node.attrs } as Record<string, unknown>;
        return false;
      }
    });
    if (targetPos === null || targetNodeType === null) return;
    const tr = editor.state.tr.setNodeMarkup(targetPos, targetNodeType, { ...targetAttrs, ...newAttrs });
    editor.view.dispatch(tr);
  }, [editor]);

  const addBlockComment = useCallback((blockId: string) => {
    if (!newCommentText.trim() || !editor) return;
    const comment: BlockComment = { id: uuidv4(), author: 'Jake (You)', text: newCommentText.trim(), createdAt: Date.now() };
    let existingComments: BlockComment[] = [];
    editor.state.doc.descendants((node) => {
      if (node.attrs?.id === blockId && node.attrs?.comments) {
        try { existingComments = JSON.parse(node.attrs.comments as string); } catch { existingComments = []; }
      }
    });
    const updated = [...existingComments, comment];
    updateNodeAttrs(blockId, { comments: JSON.stringify(updated) });
    setNewCommentText('');
  }, [newCommentText, editor, updateNodeAttrs]);

  const removeBlockComment = useCallback((blockId: string, commentId: string) => {
    if (!editor) return;
    let existingComments: BlockComment[] = [];
    editor.state.doc.descendants((node) => {
      if (node.attrs?.id === blockId && node.attrs?.comments) {
        try { existingComments = JSON.parse(node.attrs.comments as string); } catch { existingComments = []; }
      }
    });
    const updated = existingComments.filter(c => c.id !== commentId);
    updateNodeAttrs(blockId, { comments: JSON.stringify(updated) });
  }, [editor, updateNodeAttrs]);

  const getBlockComments = useCallback((blockId: string): BlockComment[] => {
    if (!editor) return [];
    let comments: BlockComment[] = [];
    editor.state.doc.descendants((node) => {
      if (node.type.name !== 'doc' && node.attrs?.id === blockId) {
        try { comments = JSON.parse(node.attrs.comments as string || '[]'); } catch { comments = []; }
      }
    });
    return comments;
  }, [editor]);

  const openCommentPopupForCurrentBlock = useCallback(() => {
    if (!editor) return;
    const { from } = editor.state.selection;
    const $from = editor.state.doc.resolve(from);
    const blockId = $from.parent.attrs?.id as string | null;
    if (blockId) {
      setActiveCommentBlockId(blockId);
    }
  }, [editor]);

  return {
    activeStyleBlockId, activeCommentBlockId, newCommentText,
    setActiveStyleBlockId, setActiveCommentBlockId, setNewCommentText,
    updateNodeAttrs, addBlockComment, removeBlockComment, getBlockComments,
    openCommentPopupForCurrentBlock,
  };
}
