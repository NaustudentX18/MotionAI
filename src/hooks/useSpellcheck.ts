import { useState, useCallback } from 'react';
import type { Editor } from '@tiptap/core';
import type { Block } from '../types';
import { escapeHtml, escapeRegExp } from '../lib/sanitize';

export interface SpellingIssue {
  id: string;
  word: string;
  suggestions: string[];
  context: string;
  blockId: string;
}

export interface SpellcheckState {
  showSpellcheck: boolean;
  spellCheckLoading: boolean;
  spellingIssues: SpellingIssue[];
}

export interface SpellcheckActions {
  setShowSpellcheck: (v: boolean) => void;
  runSpellCheck: () => Promise<void>;
  applySpellingCorrection: (blockId: string, originalWord: string, correction: string, issueId: string) => void;
  ignoreSpellingIssue: (issueId: string) => void;
  hasSpellingError: (blockId: string) => boolean;
}

export function useSpellcheck(
  editor: Editor | null,
  blocksRef: React.MutableRefObject<Block[]>,
  getBlockElement: (id: string) => HTMLElement | null,
  findNodePosAndSize: (id: string) => { pos: number; nodeSize: number } | null,
): SpellcheckState & SpellcheckActions {
  const [showSpellcheck, setShowSpellcheck] = useState(false);
  const [spellCheckLoading, setSpellCheckLoading] = useState(false);
  const [spellingIssues, setSpellingIssues] = useState<SpellingIssue[]>([]);

  const runSpellCheck = useCallback(async () => {
    if (showSpellcheck) { setShowSpellcheck(false); return; }
    setSpellCheckLoading(true);
    try {
      const currentBlocks = blocksRef.current;
      const cleanedBlocks = currentBlocks.filter(b => b.content && b.content.trim() && b.type !== 'divider').map(b => { const dummyText = b.content.replace(/<[^>]*>/g, ' '); return { id: b.id, content: dummyText, type: b.type }; });
      const resp = await fetch('/api/ai/spellcheck', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ blocks: cleanedBlocks }) });
      if (!resp.ok) throw new Error('Spellcheck failed');
      const data = await resp.json();
      setSpellingIssues(data.issues || []);
      setShowSpellcheck(true);
    } catch (err) { console.error(err); alert('Unable to run spellcheck right now. Please make sure Gemini API key is configured.'); } finally { setSpellCheckLoading(false); }
  }, [showSpellcheck, blocksRef]);

  const applySpellingCorrection = useCallback((blockId: string, originalWord: string, correction: string, issueId: string) => {
    if (!editor) return;
    const el = getBlockElement(blockId);
    if (!el) return;
    const cleanOriginal = originalWord.trim(); const cleanCorrection = correction.trim();
    const escapedOriginal = escapeRegExp(cleanOriginal); const regex = new RegExp(`\\b${escapedOriginal}\\b`, 'gi');
    const info = findNodePosAndSize(blockId);
    if (!info) return;
    const html = el.innerHTML;
    let newContent = html;
    if (regex.test(newContent)) newContent = newContent.replace(regex, escapeHtml(cleanCorrection));
    else newContent = newContent.replace(cleanOriginal, escapeHtml(cleanCorrection));
    const contentStart = info.pos + 1;
    const contentEnd = info.pos + info.nodeSize - 1;
    editor.chain().focus().setTextSelection(contentStart).deleteRange({ from: contentStart, to: contentEnd }).insertContent(newContent).run();
    setSpellingIssues(prev => prev.filter(issue => issue.id !== issueId));
  }, [editor, getBlockElement, findNodePosAndSize]);

  const ignoreSpellingIssue = useCallback((issueId: string) => {
    setSpellingIssues(prev => prev.filter(issue => issue.id !== issueId));
  }, []);

  const hasSpellingError = useCallback((blockId: string) => {
    return spellingIssues.some(issue => issue.blockId === blockId);
  }, [spellingIssues]);

  return {
    showSpellcheck, spellCheckLoading, spellingIssues,
    setShowSpellcheck, runSpellCheck, applySpellingCorrection, ignoreSpellingIssue, hasSpellingError,
  };
}
