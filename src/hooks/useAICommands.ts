import { useState, useCallback, useEffect, useRef } from 'react';
import type { Block, BlockComment } from '../types';
import type { Editor } from '@tiptap/core';
import { v4 as uuidv4 } from 'uuid';
import { sanitizeHtml, parseMarkdownToHtml } from '../lib/blockUtils';
import { addGoogleTask } from '../lib/workspace';

export interface AICommandsState {
  aiMenuOpen: boolean;
  aiMenuPos: { top: number; left: number };
  aiPrompt: string;
  aiLoading: boolean;
  aiResult: string | null;
  selectedText: string;
  isListening: boolean;
  blockLoadingMap: Record<string, boolean>;
  blockErrorMap: Record<string, string>;
  composerBlockId: string | null;
}

export interface AICommandsActions {
  setAiMenuOpen: (v: boolean) => void;
  setAiMenuPos: (v: { top: number; left: number }) => void;
  setAiPrompt: (v: string) => void;
  setAiResult: (v: string | null) => void;
  setSelectedText: (v: string) => void;
  setBlockLoadingMap: (v: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void;
  setBlockErrorMap: (v: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
  setComposerBlockId: (v: string | null) => void;
  generateContentForBlock: (id: string) => Promise<void>;
  runAiCommand: (command: string, customPrompt?: string) => Promise<void>;
  convertFocusedBlock: (newType: 'ai-summary' | 'ai-draft' | 'ai-rewrite') => void;
  handleAiAction: (action: 'insert' | 'replace' | 'discard') => void;
  openAiMenuForSelection: () => void;
  toggleListening: () => void;
  getFocusedBlockId: () => string | null;
  findNodePosAndSize: (id: string) => { pos: number; nodeSize: number } | null;
}

export function useAICommands(editor: Editor | null, blocksRef: React.MutableRefObject<Block[]>, updateNodeAttrs: (blockId: string, newAttrs: Record<string, unknown>) => void): AICommandsState & AICommandsActions {
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [aiMenuPos, setAiMenuPos] = useState({ top: 0, left: 0 });
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [blockLoadingMap, setBlockLoadingMap] = useState<Record<string, boolean>>({});
  const [blockErrorMap, setBlockErrorMap] = useState<Record<string, string>>({});
  const [composerBlockId, setComposerBlockId] = useState<string | null>(null);

  const getFocusedBlockId = useCallback((): string | null => {
    if (!editor) return null;
    const { from } = editor.state.selection;
    let blockId: string | null = null;
    editor.state.doc.descendants((node, pos) => {
      if (pos <= from && node.attrs?.id) {
        blockId = node.attrs.id as string;
      }
    });
    return blockId;
  }, [editor]);

  const findNodePosAndSize = useCallback((id: string): { pos: number; nodeSize: number } | null => {
    if (!editor) return null;
    let result: { pos: number; nodeSize: number } | null = null;
    editor.state.doc.descendants((node, pos) => {
      if (node.attrs?.id === id) {
        result = { pos, nodeSize: node.nodeSize };
        return false;
      }
    });
    return result;
  }, [editor]);

  const generateContentForBlock = useCallback(async (id: string) => {
    if (!editor) return;
    const info = findNodePosAndSize(id);
    if (!info) return;
    const { pos: targetPos, nodeSize } = info;
    let nodeType = '';
    editor.state.doc.descendants((node) => {
      if (node.attrs?.id === id) { nodeType = node.type.name; }
    });
    setBlockLoadingMap(prev => ({ ...prev, [id]: true }));
    try {
      let attrs: Record<string, unknown> = {};
      editor.state.doc.descendants((node) => {
        if (node.attrs?.id === id) { attrs = node.attrs as Record<string, unknown>; }
      });
      let command = 'custom'; let prompt = ''; let context = '';
      if (nodeType === 'aiSummaryNode') {
        command = 'summarize';
        context = (attrs.aiContext as string) || '';
        prompt = (attrs.aiPrompt as string) || 'Provide a tidy, structured summary of the content below.';
      } else if (nodeType === 'aiDraftNode') {
        command = 'custom';
        context = (attrs.aiContext as string) || '';
        prompt = `Draft a modern document block about: ${attrs.aiPrompt}.${context ? ` Extra context: ${context}` : ''}`;
      } else if (nodeType === 'aiRewriteNode') {
        command = 'custom';
        context = (attrs.aiContext as string) || '';
        prompt = `Please rewrite the following content to fit these criteria: ${attrs.aiPrompt}. Keep it structurally sound and clean. Target Content:\n${context}`;
      }
      let semanticContext = '';
      try { const { semanticSearch } = await import('../lib/vectorStore'); const results = await semanticSearch(prompt || context || 'general content', 3); if (results && results.length > 0) semanticContext = '\n\n[RELEVANT LOCAL CHUNKS]\n' + results.map((r: any) => `- "${r.text}"`).join('\n'); } catch (e) { console.warn('Semantic search failed:', e); }
      const res = await fetch('/api/ai/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command, context: context + semanticContext, prompt }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const htmlContent = sanitizeHtml(parseMarkdownToHtml(data.text || ''));
      const contentStart = targetPos + 1;
      const contentEnd = targetPos + nodeSize - 1;
      editor.chain().focus().setTextSelection(contentStart).deleteRange({ from: contentStart, to: contentEnd }).insertContent(htmlContent).run();
      setBlockErrorMap(prev => { const n = { ...prev }; delete n[id]; return n; });
    } catch (err: any) { setBlockErrorMap(prev => ({ ...prev, [id]: err.message || 'Generation failed' })); } finally { setBlockLoadingMap(prev => ({ ...prev, [id]: false })); }
  }, [editor, findNodePosAndSize]);

  const runAiCommand = useCallback(async (command: string, customPrompt = '') => {
    if (!selectedText && command !== 'continue' && command !== 'custom' && command !== 'brainstorm') return;
    setAiLoading(true);
    try {
      let semanticContext = '';
      try { const { semanticSearch } = await import('../lib/vectorStore'); const results = await semanticSearch(customPrompt || aiPrompt || selectedText || 'general content', 3); if (results && results.length > 0) semanticContext = '\n\n[RELEVANT LOCAL CHUNKS]\n' + results.map((r: any) => `- "${r.text}"`).join('\n'); } catch (e) { console.warn('Semantic search failed:', e); }
      const res = await fetch('/api/ai/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command, context: (selectedText || blocksRef.current.map(b => b.content).join('\n')) + semanticContext, prompt: customPrompt || aiPrompt }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (command === 'extract') {
        const newContent = data.text;
        const lines = newContent.split('\n').filter((l: string) => l.trim().length > 0);
        for (const line of lines) { const cleanLine = line.replace(/^[-*]\s*/, '').trim(); if (cleanLine) { const conf = window.confirm(`Create Google Task: "${cleanLine}"?`); if (conf) await addGoogleTask(cleanLine); } }
        alert("Data extraction complete!"); setAiMenuOpen(false); setAiPrompt('');
      } else { setAiResult(data.text); }
    } catch (err: any) { alert("AI Error: " + err.message); setAiMenuOpen(false); setAiPrompt(''); } finally { setAiLoading(false); }
  }, [selectedText, aiPrompt, blocksRef]);

  const convertFocusedBlock = useCallback((newType: 'ai-summary' | 'ai-draft' | 'ai-rewrite') => {
    if (!editor) return;
    const focusedId = getFocusedBlockId();
    if (!focusedId) return;
    let aiContext = ''; let aiPrompt = '';
    if (newType === 'ai-summary') { aiContext = selectedText || ''; aiPrompt = 'Provide a tidy, structured summary of the content below.'; }
    else if (newType === 'ai-draft') { aiPrompt = selectedText || ''; aiContext = ''; }
    else if (newType === 'ai-rewrite') { aiContext = selectedText || ''; aiPrompt = 'Make this content professional and clearer.'; }
    aiContext = aiContext.replace(/<[^>]*>/g, ''); aiPrompt = aiPrompt.replace(/<[^>]*>/g, '');
    updateNodeAttrs(focusedId, { aiPrompt, aiContext });
    setAiMenuOpen(false);
  }, [editor, getFocusedBlockId, selectedText, updateNodeAttrs]);

  const handleAiAction = useCallback((action: 'insert' | 'replace' | 'discard') => {
    if (action === 'discard') { setAiResult(null); setAiMenuOpen(false); setAiPrompt(''); return; }
    if (!aiResult || !editor) return;
    const lines = aiResult.split('\n').filter((l: string) => l.trim().length > 0);
    const focusedId = getFocusedBlockId();
    if (focusedId) {
      const info = findNodePosAndSize(focusedId);
      if (info) {
        const nodes = lines.map(line => ({
          type: 'pNode',
          attrs: { id: uuidv4(), indentLevel: 0, comments: '[]' },
          content: [{ type: 'text', text: sanitizeHtml(parseMarkdownToHtml(line)) }]
        }));
        if (action === 'replace') {
          editor.chain().focus().setTextSelection(info.pos).deleteRange({ from: info.pos, to: info.pos + info.nodeSize }).insertContent(nodes).run();
        } else {
          editor.chain().focus().setTextSelection(info.pos + info.nodeSize).insertContent(nodes).run();
        }
      }
    } else {
      const nodes = lines.map(line => ({
        type: 'pNode',
        attrs: { id: uuidv4(), indentLevel: 0, comments: '[]' },
        content: [{ type: 'text', text: sanitizeHtml(parseMarkdownToHtml(line)) }]
      }));
      editor.chain().focus().insertContent(nodes).run();
    }
    setAiResult(null); setAiMenuOpen(false); setAiPrompt('');
  }, [aiResult, editor, getFocusedBlockId, findNodePosAndSize]);

  const openAiMenuForSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) { const range = sel.getRangeAt(0); const rect = range.getBoundingClientRect(); setSelectedText(sel.toString()); setAiMenuPos({ top: rect.bottom + window.scrollY + 8, left: rect.left + window.scrollX }); setAiMenuOpen(true); }
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) { setIsListening(false); return; }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Speech recognition isn't supported in your browser."); return; }
    const recognition = new SpeechRecognition();
    recognition.continuous = true; recognition.interimResults = true;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) { if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript; }
      if (finalTranscript) {
        const focusedId = getFocusedBlockId();
        if (focusedId && editor) {
          const info = findNodePosAndSize(focusedId);
          if (info) {
            editor.chain().focus().setTextSelection(info.pos + info.nodeSize).insertContent(` ${finalTranscript.trim()}`).run();
          }
        }
      }
    };
    recognition.start();
  }, [isListening, editor, getFocusedBlockId, findNodePosAndSize]);

  // Global event listener for ai-command
  useEffect(() => {
    const handleAiCommandEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ action: string; block?: Block }>;
      const { action, block } = customEvent.detail;
      if (action === 'generate' && block) { generateContentForBlock(block.id); return; }
      setAiMenuPos({ top: window.innerHeight / 3, left: Math.max(20, window.innerWidth / 2 - 250) });
      setAiMenuOpen(true);
      if (action === 'brainstorm') setAiPrompt('Brainstorm ideas for... ');
      else if (action === 'summarize') selectedText ? runAiCommand('summarize') : setAiPrompt('Summarize... ');
      else if (action === 'draft') setAiPrompt('Draft a blog post about... ');
      else if (action === 'translate') selectedText ? runAiCommand('custom', 'Translate this text into Spanish (or specified language):') : setAiPrompt('Translate this to Chinese: ');
      else if (action === 'rewrite') selectedText ? runAiCommand('custom', 'Rewrite this paragraph to be more professional and clear:') : setAiPrompt('Rewrite: ');
      else if (action === 'grammar') selectedText ? runAiCommand('custom', 'Fix spelling and grammar mistakes in this text, keeping the tone the same:') : setAiPrompt('Check grammar: ');
    };
    window.addEventListener('ai-command', handleAiCommandEvent);
    return () => window.removeEventListener('ai-command', handleAiCommandEvent);
  }, [selectedText, generateContentForBlock, runAiCommand]);

  // Mouseup handler for selection AI menu
  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.selection-toolbar-container')) return;
      setTimeout(() => { const sel = window.getSelection(); if (sel && sel.toString().trim().length > 0) openAiMenuForSelection(); else { setAiMenuOpen(false); setSelectedText(''); } }, 50);
    };
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [openAiMenuForSelection]);

  return {
    aiMenuOpen, aiMenuPos, aiPrompt, aiLoading, aiResult, selectedText, isListening,
    blockLoadingMap, blockErrorMap, composerBlockId,
    setAiMenuOpen, setAiMenuPos, setAiPrompt, setAiResult, setSelectedText,
    setBlockLoadingMap, setBlockErrorMap, setComposerBlockId,
    generateContentForBlock, runAiCommand, convertFocusedBlock, handleAiAction,
    openAiMenuForSelection, toggleListening, getFocusedBlockId, findNodePosAndSize,
  };
}
