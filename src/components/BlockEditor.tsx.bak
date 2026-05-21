import { useState, useRef, useEffect, useMemo } from 'react';
import { EditorContent } from '@tiptap/react';
import { useBlockEditor } from '../hooks/useBlockEditor';
import type { Block, BlockComment } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '../lib/utils';
import { escapeHtml, sanitizeHtml, parseMarkdownToHtml } from '../lib/blockUtils';
import { escapeRegExp } from '../lib/sanitize';
import {
  Sparkles,
  Mic, MicOff,
  Compass,
  Download, MessageCircle,
  X,
  Save, RefreshCw,
  Lock
} from 'lucide-react';
import { addGoogleTask, addGoogleCalendarEvent } from '../lib/workspace';
import { SelectionActionModal } from './SelectionActionModal';
import { AiComposerModal } from './AiComposerModal';
import { SpellcheckPanel } from './blocks/SpellcheckPanel';
import { CommentPopup } from './blocks/CommentPopup';
import { SlashMenu, slashMenuActions, SlashMenuAction } from './blocks/SlashMenu';
import { AiMenu } from './blocks/AiMenu';
import { StylePopup } from './blocks/StylePopup';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Re-export parseMarkdownToHtml for use by AiComposerModal
export { parseMarkdownToHtml } from '../lib/blockUtils';

interface BlockEditorProps {
  key?: string;
  initialBlocks: Block[];
  onChange: (blocks: Block[]) => void;
  title: string;
  onTitleChange: (title: string) => void;
  onActiveBlockChange?: (blockId: string | null) => void;
  /** Callback fired when an AI block's Run/Generate button is clicked. */
  onAiBlockRun?: (blockId: string) => void;
  /** Block ID to focus after next block insertion (used by CommandPalette) */
  focusAfterInsert?: string | null;
  /** Called after focusAfterInsert is consumed, to clear the stale value */
  onFocusAfterInsertUsed?: () => void;
  /** Optional page ID for Yjs document keying. If not provided, derived from title. */
  pageId?: string;
  /** Callback to lock the E2EE workspace. */
  onLockWorkspace?: () => void;
}

export function BlockEditor({
  initialBlocks,
  onChange,
  title,
  onTitleChange,
  onActiveBlockChange,
  onAiBlockRun,
  focusAfterInsert,
  onFocusAfterInsertUsed,
  pageId: pageIdProp,
  onLockWorkspace,
}: BlockEditorProps) {
  // ─── Page ID ──────────────────────────────────────────────────────────────────
  const pageId = useMemo(
    () => pageIdProp || `page-${title.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'untitled'}`,
    [pageIdProp, title]
  );

  // ─── Editor ───────────────────────────────────────────────────────────────────
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);

  const { editor, isReady, commands } = useBlockEditor({
    pageId,
    initialBlocks,
    onChange: (newBlocks: Block[]) => {
      setBlocks(newBlocks);
      onChange(newBlocks);
    },
  });

  // ─── UI State ────────────────────────────────────────────────────────────────
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashMenuPos, setSlashMenuPos] = useState({ top: 0, left: 0 });
  const [slashQuery, setSlashQuery] = useState('');
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);

  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [aiMenuPos, setAiMenuPos] = useState({ top: 0, left: 0 });
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);

  const [activeStyleBlockId, setActiveStyleBlockId] = useState<string | null>(null);
  const [activeCommentBlockId, setActiveCommentBlockId] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);

  const [showSpellcheck, setShowSpellcheck] = useState(false);
  const [spellCheckLoading, setSpellCheckLoading] = useState(false);
  const [spellingIssues, setSpellingIssues] = useState<{
    id: string; word: string; suggestions: string[]; context: string; blockId: string;
  }[]>([]);

  const [blockLoadingMap, setBlockLoadingMap] = useState<Record<string, boolean>>({});
  const [blockErrorMap, setBlockErrorMap] = useState<Record<string, string>>({});
  const [composerBlockId, setComposerBlockId] = useState<string | null>(null);

  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty' | 'error'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<string>(() => new Date().toLocaleTimeString());
  const isFirstRender = useRef(true);

  // Refs
  const onChangeRef = useRef(onChange);
  const blocksRef = useRef<Block[]>(blocks);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { blocksRef.current = blocks; }, [blocks]);

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  const getBlockElement = (id: string): HTMLElement | null => {
    if (!editor) return null;
    return editor.view.dom.querySelector(`[data-id="${id}"]`);
  };

  const getFocusedBlockId = (): string | null => {
    if (!editor) return null;
    const { from } = editor.state.selection;
    let blockId: string | null = null;
    editor.state.doc.descendants((node, pos) => {
      if (pos <= from && node.attrs?.id) {
        blockId = node.attrs.id as string;
      }
    });
    return blockId;
  };

  const findNodePosAndSize = (id: string): { pos: number; nodeSize: number } | null => {
    if (!editor) return null;
    let result: { pos: number; nodeSize: number } | null = null;
    editor.state.doc.descendants((node, pos) => {
      if (node.attrs?.id === id) {
        result = { pos, nodeSize: node.nodeSize };
        return false;
      }
    });
    return result;
  };

  // ─── Auto-save timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    setSaveStatus('dirty');
  }, [blocks, title]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSaveStatus('saving');
      try {
        const payload = { title, blocks: blocksRef.current, timestamp: Date.now() };
        localStorage.setItem(`motion_ai_autosave_${title || 'Untitled'}`, JSON.stringify(payload));
        onChangeRef.current(blocksRef.current);
        setTimeout(() => { setSaveStatus('saved'); setLastSavedTime(new Date().toLocaleTimeString()); }, 800);
      } catch (err) { console.error("Auto-save error:", err); setSaveStatus('error'); }
    }, 5000);
    return () => clearInterval(timer);
  }, [title]);

  const triggerManualSave = () => {
    setSaveStatus('saving');
    try {
      const payload = { title, blocks: blocksRef.current, timestamp: Date.now() };
      localStorage.setItem(`motion_ai_autosave_${title || 'Untitled'}`, JSON.stringify(payload));
      onChangeRef.current(blocksRef.current);
      setTimeout(() => { setSaveStatus('saved'); setLastSavedTime(new Date().toLocaleTimeString()); }, 600);
    } catch (err) { console.error("Manual save error:", err); setSaveStatus('error'); }
  };

  // ─── Slash menu filter ───────────────────────────────────────────────────────
  useEffect(() => { setSlashSelectedIndex(0); }, [slashQuery]);

  const filteredSlashActions = slashMenuActions.filter(action =>
    action.label.toLowerCase().includes(slashQuery.toLowerCase()) ||
    action.description.toLowerCase().includes(slashQuery.toLowerCase())
  );

  // ─── Slash menu outside click ─────────────────────────────────────────────────
  useEffect(() => {
    if (!slashMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.slash-menu-container')) setSlashMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [slashMenuOpen]);

  // ─── Slash action → TipTap ────────────────────────────────────────────────────
  const typeToNodeName = (type: string): string | null => {
    const map: Record<string, string> = {
      p: 'pNode', h1: 'h1Node', h2: 'h2Node', h3: 'h3Node',
      todo: 'todoNode', bullet: 'bulletNode', divider: 'dividerNode',
      callout: 'calloutNode', quote: 'quoteNode',
      'ai-summary': 'aiSummaryNode', 'ai-draft': 'aiDraftNode', 'ai-rewrite': 'aiRewriteNode',
      code: 'codeNode',
    };
    return map[type] || null;
  };

  const handleSlashAction = (action: typeof slashMenuActions[0]) => {
    if (!editor) return;

    if (action.type === 'ai-custom') {
      setSlashMenuOpen(false);
      setAiMenuPos({ top: window.innerHeight / 3, left: window.innerWidth / 2 - 250 });
      setAiMenuOpen(true);
      return;
    }

    if (action.type === 'image') {
      setSlashMenuOpen(false);
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file || !editor) return;
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = (reader.result as string).split(',')[1];
          const res = await fetch('/api/upload/image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: file.name, type: file.type, data: base64 }),
          });
          const json = await res.json();
          if (json.url) {
            const focusedId = getFocusedBlockId();
            if (!focusedId) return;
            const info = findNodePosAndSize(focusedId);
            if (!info) return;
            const { pos: blockStart, nodeSize } = info;
            const contentStart = blockStart + 1;
            const contentEnd = blockStart + nodeSize - 1;
            editor.chain().focus().deleteRange({ from: contentStart, to: contentEnd }).insertContent({ type: 'image', attrs: { src: json.url, alt: file.name } }).run();
          }
        };
        reader.readAsDataURL(file);
      };
      input.click();
      return;
    }

    const nodeName = typeToNodeName(action.type);
    if (!nodeName) { setAiMenuOpen(true); setSlashMenuOpen(false); return; }

    const focusedId = getFocusedBlockId();
    if (!focusedId) return;

    const info = findNodePosAndSize(focusedId);
    if (!info) return;

    const { pos: blockStart, nodeSize } = info;

    // Delete the ENTIRE block content (from block start to end of block content)
    const contentStart = blockStart + 1;  // +1 to skip the opening tag
    const contentEnd = blockStart + nodeSize - 1;  // -1 to skip closing tag

    // Build attrs for the new node
    const id = uuidv4();
    const aiPromptMap: Record<string, string> = {
      'ai-summary': 'Summarize this page or previous blocks.',
      'ai-draft': 'Draft content based on the following input.',
      'ai-rewrite': 'Rewrite the input into a professional, concise pitch.',
    };

    const attrs: Record<string, unknown> = { id, indentLevel: 0, comments: '[]' };
    if (action.type === 'ai-summary' || action.type === 'ai-draft' || action.type === 'ai-rewrite') {
      attrs.aiPrompt = aiPromptMap[action.type] || '';
      attrs.aiContext = '';
    }
    if (action.type === 'todo') (attrs as Record<string, unknown>).checked = false;
    if (action.type === 'code') (attrs as Record<string, unknown>).language = 'javascript';

    // Replace the entire block content
    editor.chain().focus().deleteRange({ from: contentStart, to: contentEnd }).insertContent({ type: nodeName, attrs }).run();
    setSlashMenuOpen(false);
    setSlashQuery('');
  };

  // ─── Style toggles via TipTap marks ──────────────────────────────────────────
  const toggleBlockStyleFlag = (_blockId: string, flag: 'bold' | 'italic' | 'underline') => {
    if (!editor) return;
    if (flag === 'bold') editor.chain().focus().toggleMark('bold').run();
    else if (flag === 'italic') editor.chain().focus().toggleMark('italic').run();
    else if (flag === 'underline') editor.chain().focus().toggleMark('underline').run();
  };

  const updateBlockStyleColor = (_blockId: string, _type: 'color' | 'backgroundColor', _value: string) => {
    if (!editor) return;
    if (_type === 'color') {
      if (_value === 'inherit' || _value === 'transparent') {
        editor.chain().focus().unsetMark('color').run();
      } else {
        editor.chain().focus().setMark('color', { color: _value }).run();
      }
    } else if (_type === 'backgroundColor') {
      if (_value === 'inherit' || _value === 'transparent') {
        editor.chain().focus().unsetMark('highlight').run();
      } else {
        editor.chain().focus().setMark('highlight', { color: _value }).run();
      }
    }
  };

  const getCurrentStyleFromEditor = (): Block['style'] | undefined => {
    if (!editor) return undefined;
    const style: Block['style'] = {};
    if (editor.isActive('bold')) style.bold = true;
    if (editor.isActive('italic')) style.italic = true;
    if (editor.isActive('underline')) style.underline = true;
    if (editor.isActive('color')) {
      const attrs = editor.getAttributes('color');
      if (attrs.color) style.color = attrs.color;
    }
    if (editor.isActive('highlight')) {
      const attrs = editor.getAttributes('highlight');
      if (attrs.color) style.backgroundColor = attrs.color;
    }
    return Object.keys(style).length > 0 ? style : undefined;
  };

  // ─── Block comments (stored in node attrs as JSON) ────────────────────────────
  const updateNodeAttrs = (blockId: string, newAttrs: Record<string, unknown>) => {
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
  };

  const addBlockComment = (blockId: string) => {
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
  };

  const removeBlockComment = (blockId: string, commentId: string) => {
    if (!editor) return;
    let existingComments: BlockComment[] = [];
    editor.state.doc.descendants((node) => {
      if (node.attrs?.id === blockId && node.attrs?.comments) {
        try { existingComments = JSON.parse(node.attrs.comments as string); } catch { existingComments = []; }
      }
    });
    const updated = existingComments.filter(c => c.id !== commentId);
    updateNodeAttrs(blockId, { comments: JSON.stringify(updated) });
  };

  const getBlockComments = (blockId: string): BlockComment[] => {
    if (!editor) return [];
    let comments: BlockComment[] = [];
    editor.state.doc.descendants((node) => {
      if (node.type.name !== 'doc' && node.attrs?.id === blockId) {
        try { comments = JSON.parse(node.attrs.comments as string || '[]'); } catch { comments = []; }
      }
    });
    return comments;
  };

  const openCommentPopupForCurrentBlock = () => {
    if (!editor) return;
    const { from } = editor.state.selection;
    const $from = editor.state.doc.resolve(from);
    const blockId = $from.parent.attrs?.id as string | null;
    if (blockId) {
      setActiveCommentBlockId(blockId);
    }
  };

  // ─── generateContentForBlock via TipTap ───────────────────────────────────────
  const generateContentForBlock = async (id: string) => {
    if (!editor) return;
    const info = findNodePosAndSize(id);
    if (!info) return;
    const { pos: targetPos, nodeSize } = info;

    // Determine node type at this position
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

      // Replace content inside this block node
      const contentStart = targetPos + 1;
      const contentEnd = targetPos + nodeSize - 1;
      editor.chain().focus().setTextSelection(contentStart).deleteRange({ from: contentStart, to: contentEnd }).insertContent(htmlContent).run();
      setBlockErrorMap(prev => { const n = { ...prev }; delete n[id]; return n; });
    } catch (err: any) { setBlockErrorMap(prev => ({ ...prev, [id]: err.message || 'Generation failed' })); } finally { setBlockLoadingMap(prev => ({ ...prev, [id]: false })); }
  };

  // ─── AI command / menu ───────────────────────────────────────────────────────
  const runAiCommand = async (command: string, customPrompt = '') => {
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
  };

  const convertFocusedBlock = (newType: 'ai-summary' | 'ai-draft' | 'ai-rewrite') => {
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
  };

  const handleAiAction = (action: 'insert' | 'replace' | 'discard') => {
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
      // Insert at end
      const nodes = lines.map(line => ({
        type: 'pNode',
        attrs: { id: uuidv4(), indentLevel: 0, comments: '[]' },
        content: [{ type: 'text', text: sanitizeHtml(parseMarkdownToHtml(line)) }]
      }));
      editor.chain().focus().insertContent(nodes).run();
    }
    setAiResult(null); setAiMenuOpen(false); setAiPrompt('');
  };

  const applyInlineStyle = (command: string, value: string = '') => {
    document.execCommand(command, false, value);
  };

  const openAiMenuForSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) { const range = sel.getRangeAt(0); const rect = range.getBoundingClientRect(); setSelectedText(sel.toString()); setAiMenuPos({ top: rect.bottom + window.scrollY + 8, left: rect.left + window.scrollX }); setAiMenuOpen(true); }
  };

  // ─── Global event listeners ───────────────────────────────────────────────────
  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.selection-toolbar-container')) return;
      setTimeout(() => { const sel = window.getSelection(); if (sel && sel.toString().trim().length > 0) openAiMenuForSelection(); else { setAiMenuOpen(false); setSelectedText(''); } }, 50);
    };
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, []);

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
  }, [selectedText]);

  useEffect(() => {
    const handlePdfExportEvent = () => { exportPageAsPdf(); };
    window.addEventListener('export-pdf', handlePdfExportEvent);
    return () => window.removeEventListener('export-pdf', handlePdfExportEvent);
  }, []);

  // ─── Spellcheck ──────────────────────────────────────────────────────────────
  const runSpellCheck = async () => {
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
  };

  const applySpellingCorrection = (blockId: string, originalWord: string, correction: string, issueId: string) => {
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
  };

  const ignoreSpellingIssue = (issueId: string) => { setSpellingIssues(prev => prev.filter(issue => issue.id !== issueId)); };
  const hasSpellingError = (blockId: string) => { return spellingIssues.some(issue => issue.blockId === blockId); };

  // ─── PDF export ──────────────────────────────────────────────────────────────
  const exportPageAsPdf = async () => {
    setExportingPdf(true);
    try {
      const element = document.getElementById('workspace-page-content');
      if (!element) return;
      const currentScrollY = window.scrollY;
      window.scrollTo(0, 0);
      const interactiveElements = document.querySelectorAll('.pdf-exclude');
      interactiveElements.forEach((el: any) => { el.style.opacity = '0'; el.style.visibility = 'hidden'; });
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: document.documentElement.classList.contains('dark') ? '#1C1C1C' : '#FFFFFF', scrollY: 0 });
      interactiveElements.forEach((el: any) => { el.style.opacity = ''; el.style.visibility = ''; });
      window.scrollTo(0, currentScrollY);
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 190; const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight; let position = 10;
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft >= 0) { position = heightLeft - imgHeight; pdf.addPage(); pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight); heightLeft -= pageHeight; }
      pdf.save(`${title.replace(/\s+/g, '_') || 'Untitled_Page'}.pdf`);
    } catch (e) { console.error(e); alert('Failed to generate PDF'); } finally { setExportingPdf(false); }
  };

  // ─── Speech-to-text ──────────────────────────────────────────────────────────
  const toggleListening = () => {
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
  };

  // ─── TipTap paste handler for multi-line split ───────────────────────────────
  useEffect(() => {
    if (!editor) return;
    (editor as any).core.view.props.handlePaste = (view: any, event: ClipboardEvent) => {
      const text = event.clipboardData?.getData('text/plain') || '';
      if (!text.includes('\n')) return false;
      event.preventDefault();
      const lines = text.split('\n');
      const nodes: Record<string, unknown>[] = [];
      lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) { nodes.push({ type: 'pNode', attrs: { id: uuidv4(), indentLevel: 0, comments: '[]' }, content: [] }); return; }
        let nodeType = 'pNode'; let content = line;
        if (trimmed.startsWith('# ')) { nodeType = 'h1Node'; content = line.replace(/^\s*#\s+/, ''); }
        else if (trimmed.startsWith('## ')) { nodeType = 'h2Node'; content = line.replace(/^\s*##\s+/, ''); }
        else if (trimmed.startsWith('### ')) { nodeType = 'h3Node'; content = line.replace(/^\s*###\s+/, ''); }
        else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) { nodeType = 'bulletNode'; content = line.replace(/^\s*[-*]\s+/, ''); }
        else if (trimmed.startsWith('1. ')) { nodeType = 'bulletNode'; content = line.replace(/^\s*1\.\s+/, ''); }
        else if (trimmed.startsWith('> ')) { nodeType = 'quoteNode'; content = line.replace(/^\s*>\s+/, ''); }
        else if (trimmed.startsWith('[] ') || trimmed.startsWith('[ ] ')) { nodeType = 'todoNode'; content = line.replace(/^\s*\[\s*\]\s+/, ''); }
        else if (trimmed.startsWith('[x] ') || trimmed.startsWith('[X] ')) { nodeType = 'todoNode'; content = line.replace(/^\s*\[[xX]\]\s+/, ''); }
        else if (trimmed === '---') { nodeType = 'dividerNode'; content = ''; }
        const textContent = sanitizeHtml(parseMarkdownToHtml(content));
        nodes.push({ type: nodeType, attrs: { id: uuidv4(), indentLevel: 0, comments: '[]' }, content: textContent ? [{ type: 'text', text: textContent }] : [] });
      });
      const { from } = editor.state.selection;
      editor.chain().focus().deleteRange({ from, to: from }).insertContent(nodes).run();
      return true;
    };
  }, [editor]);

  // ─── Active block tracking ───────────────────────────────────────────────────
  useEffect(() => {
    if (!editor) return;
    const handleSelectionUpdate = () => {
      const id = getFocusedBlockId();
      onActiveBlockChange?.(id);
    };
    editor.on('selectionUpdate', handleSelectionUpdate);
    return () => { editor.off('selectionUpdate', handleSelectionUpdate); };
  }, [editor, onActiveBlockChange]);

  // ─── Focus block from focusAfterInsert ───────────────────────────────────────
  useEffect(() => {
    if (!focusAfterInsert || !editor) return;
    const el = getBlockElement(focusAfterInsert);
    if (el) {
      el.focus();
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    onFocusAfterInsertUsed?.();
  }, [focusAfterInsert, onFocusAfterInsertUsed, editor]);

  // ─── Keyboard: intercept slash key for menu ──────────────────────────────────
  useEffect(() => {
    if (!editor) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === '/') {
        const { from } = editor.state.selection;
        const $from = editor.state.doc.resolve(from);
        const blockText = $from.parent.textContent;
        if (blockText === '' || blockText.endsWith('/')) {
          const domPos = editor.view.coordsAtPos(from);
          setSlashMenuPos({ top: domPos.bottom, left: domPos.left });
          setSlashMenuOpen(true);
          setSlashQuery('');
        }
      }
      if (event.ctrlKey && event.shiftKey && event.key === 'C') {
        event.preventDefault();
        openCommentPopupForCurrentBlock();
      }
      if (slashMenuOpen) {
        if (event.key === 'ArrowDown') { event.preventDefault(); setSlashSelectedIndex(prev => (prev + 1) % filteredSlashActions.length); }
        else if (event.key === 'ArrowUp') { event.preventDefault(); setSlashSelectedIndex(prev => (prev - 1 + filteredSlashActions.length) % filteredSlashActions.length); }
        else if (event.key === 'Enter') { event.preventDefault(); const action = filteredSlashActions[slashSelectedIndex]; if (action) handleSlashAction(action); }
        else if (event.key === 'Escape') { event.preventDefault(); setSlashMenuOpen(false); setSlashQuery(''); }
        else if (event.key === 'Backspace') { setSlashMenuOpen(false); setSlashQuery(''); }
      }
    };
    const dom = editor.view.dom;
    dom.addEventListener('keydown', handleKeyDown);
    return () => dom.removeEventListener('keydown', handleKeyDown);
  }, [editor, slashMenuOpen, filteredSlashActions, slashSelectedIndex]);

  // ─── Slash query tracking ───────────────────────────────────────────────────
  useEffect(() => {
    if (!editor || !slashMenuOpen) return;
    const handleSelectionUpdate = () => {
      const { from } = editor.state.selection;
      const $from = editor.state.doc.resolve(from);
      const blockText = $from.parent.textContent;
      const textAfterSlash = blockText.substring(blockText.lastIndexOf('/') + 1);
      setSlashQuery(textAfterSlash);
    };
    editor.on('selectionUpdate', handleSelectionUpdate);
    return () => { editor.off('selectionUpdate', handleSelectionUpdate); };
  }, [editor, slashMenuOpen]);

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className={cn("w-full px-6 sm:px-12 py-12 pb-48 font-sans text-lg text-[#37352F] dark:text-[#E3E3E3] transition-all duration-300", showSpellcheck && spellingIssues.length > 0 ? "max-w-6xl mx-auto" : "max-w-3xl mx-auto")}>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-[#EBEBE9] dark:border-[#2F2F2F] pdf-exclude">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 font-medium tracking-wide uppercase hidden sm:inline">MotionAI workspace</span>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#F4F4F3] dark:bg-[#1E1E1E] border border-[#EBEBE9] dark:border-[#2F2F2F] text-[10px] font-mono leading-none select-none">
            {saveStatus === 'saving' && (<span className="flex items-center gap-1 text-purple-650 dark:text-purple-400"><RefreshCw size={10} className="animate-spin" /><span>Saving draft...</span></span>)}
            {saveStatus === 'saved' && (<span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" /><span>Auto-saved {lastSavedTime}</span></span>)}
            {saveStatus === 'dirty' && (<button onClick={triggerManualSave} className="flex items-center gap-1 text-amber-600 dark:text-amber-400 hover:text-amber-700 transition-colors cursor-pointer font-bold" title="Unsaved modifications"><Save size={10} /><span>Unsaved (Save Now)</span></button>)}
            {saveStatus === 'error' && (<span className="text-rose-500 font-bold flex items-center gap-1"><X size={10} /><span>Error Saving</span></span>)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={runSpellCheck} disabled={spellCheckLoading} className={cn("flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md shadow-sm transition-all cursor-pointer border", showSpellcheck ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 font-bold" : "bg-white hover:bg-[#F1F1F0] dark:bg-[#1E1E1E] dark:hover:bg-[#2F2F2F] border-[#EBEBE9] dark:border-[#2F2F2F] text-gray-600 dark:text-gray-300 font-medium")} title="Check spelling (Ctrl+Shift+C for comments)">
            {spellCheckLoading ? (<div className="w-3.5 h-3.5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin mr-1" />) : (<Sparkles size={13} className={cn("transition-colors", showSpellcheck ? "text-amber-500 animate-pulse" : "text-gray-400")} />)}
            <span>{spellCheckLoading ? 'Analyzing...' : showSpellcheck ? 'Close Spellcheck' : 'Spellcheck'}</span>
          </button>
          <button onClick={openCommentPopupForCurrentBlock} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md bg-white hover:bg-[#F1F1F0] dark:bg-[#1E1E1E] dark:hover:bg-[#2F2F2F] border border-[#EBEBE9] dark:border-[#2F2F2F] text-gray-600 dark:text-gray-300 font-medium shadow-sm transition-colors cursor-pointer" title="Add comment to block (Ctrl+Shift+C)">
            <MessageCircle size={13} />
            <span>Comment</span>
          </button>
          <button onClick={exportPageAsPdf} disabled={exportingPdf} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition-colors cursor-pointer"><Download size={13} />{exportingPdf ? 'Exporting PDF...' : 'Export to PDF'}</button>
          {onLockWorkspace && (
            <button onClick={onLockWorkspace} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md bg-white hover:bg-[#F1F1F0] dark:bg-[#1E1E1E] dark:hover:bg-[#2F2F2F] border border-[#EBEBE9] dark:border-[#2F2F2F] text-gray-600 dark:text-gray-300 font-medium shadow-sm transition-colors cursor-pointer" title="Lock Workspace">
              <Lock size={13} />
              <span>Lock</span>
            </button>
          )}
        </div>
      </div>

      <div className={cn("w-full", showSpellcheck && spellingIssues.length > 0 ? "grid grid-cols-1 lg:grid-cols-4 gap-8 items-start" : "")}>
        <div className={cn("w-full", showSpellcheck && spellingIssues.length > 0 ? "lg:col-span-3" : "")}>
          <div id="workspace-page-content" className="p-4 sm:p-6 rounded-xl">
            <input type="text" value={title || ''} onChange={e => onTitleChange(e.target.value)} placeholder="Untitled" className="w-full text-4xl font-bold bg-transparent border-none outline-none mb-8 placeholder-[#37352f4d] dark:placeholder-[#ffffff4d] resize-none text-[#37352F] dark:text-[#E3E3E3]" />

            {/* TipTap Editor Content */}
            {isReady && editor && (
              <EditorContent editor={editor} />
            )}
          </div>
        </div>

        {/* Spellchecker panel */}
        {showSpellcheck && (
          <SpellcheckPanel
            spellingIssues={spellingIssues}
            blockRefs={{ current: new Proxy({}, { get: (_: any, id: string) => getBlockElement(id) }) } as any}
            applySpellingCorrection={applySpellingCorrection}
            ignoreSpellingIssue={ignoreSpellingIssue}
            runSpellCheck={runSpellCheck}
          />
        )}
      </div>

      {/* Slash Command Menu */}
      <SlashMenu
        isOpen={slashMenuOpen}
        position={slashMenuPos}
        query={slashQuery}
        selectedIndex={slashSelectedIndex}
        onAction={handleSlashAction}
        onSelectIndex={setSlashSelectedIndex}
      />

      {/* AI Menu */}
      {aiMenuOpen && (
        <AiMenu
          aiMenuPos={aiMenuPos}
          aiPrompt={aiPrompt}
          aiLoading={aiLoading}
          aiResult={aiResult}
          selectedText={selectedText}
          focusedId={getFocusedBlockId()}
          blocks={blocksRef.current}
          onSetAiPrompt={setAiPrompt}
          onRunAiCommand={runAiCommand}
          onHandleAiAction={handleAiAction}
          onToggleBlockStyleFlag={toggleBlockStyleFlag}
          onConvertFocusedBlock={convertFocusedBlock}
          onSetAiMenuOpen={setAiMenuOpen}
          onSetAiMenuPos={setAiMenuPos}
          onSetAiResult={setAiResult}
          onSetWorkspaceModalOpen={setWorkspaceModalOpen}
        />
      )}

      {/* Bottom UI */}
      <div className="fixed bottom-8 right-6 md:right-8 flex space-x-2 z-30">
        {selectedText && (<button onClick={() => setWorkspaceModalOpen(true)} className="h-10 px-4 bg-purple-600 text-white shadow-md rounded-full flex items-center hover:bg-purple-700 text-sm font-medium transition-colors"><Compass size={16} className="mr-1.5 animate-pulse" /> Workspace Actions</button>)}
        <button onClick={toggleListening} className={cn("w-10 h-10 border border-[#EBEBE9] shadow-md rounded-full flex items-center justify-center transition-colors", isListening ? "bg-red-50 text-red-500 border-red-200" : "bg-white hover:bg-[#F1F1F0] text-[#37352f7a]")}>{isListening ? <Mic size={18} /> : <MicOff size={18} />}</button>
        <button onClick={() => { setAiMenuPos({ top: Math.max(100, window.innerHeight - 400), left: Math.max(20, window.innerWidth / 2 - 250) }); setAiMenuOpen(true); }} className="h-10 px-4 bg-white border border-[#EBEBE9] shadow-md rounded-full flex items-center hover:bg-[#F1F1F0] text-sm font-medium transition-colors"><span className="text-purple-600 mr-2">✨</span> Ask AI</button>
      </div>

      <SelectionActionModal isOpen={workspaceModalOpen} onClose={() => setWorkspaceModalOpen(false)} selectedText={selectedText || "Page Title: " + title} />
      {composerBlockId && (() => { const selectedBlock = blocksRef.current.find(b => b.id === composerBlockId); if (!selectedBlock) return null; return (<AiComposerModal isOpen={true} onClose={() => setComposerBlockId(null)} block={selectedBlock} blocks={blocksRef.current} onSave={() => {}} />); })()}

      {/* Block Comment Popup */}
      {activeCommentBlockId && editor && (
        <div className="fixed top-20 right-6 z-40">
          <CommentPopup
            blockId={activeCommentBlockId}
            comments={getBlockComments(activeCommentBlockId)}
            newCommentText={newCommentText}
            onSetNewCommentText={setNewCommentText}
            onAddComment={addBlockComment}
            onRemoveComment={removeBlockComment}
            onClose={() => setActiveCommentBlockId(null)}
          />
        </div>
      )}

      {/* Style Popup */}
      {activeStyleBlockId && editor && (
        <div className="fixed top-20 right-6 z-40">
          <StylePopup
            blockId={activeStyleBlockId}
            style={getCurrentStyleFromEditor()}
            onToggleFlag={toggleBlockStyleFlag}
            onUpdateColor={updateBlockStyleColor}
            onUpdateBlock={(id, updates) => {
              const nodeName = typeToNodeName(updates.type as string);
              if (!nodeName || !editor) return;
              const info = findNodePosAndSize(id);
              if (!info) return;
              const aiPromptMap: Record<string, string> = {
                'ai-summary': 'Provide a tidy, structured summary of the content below.',
                'ai-draft': 'Draft a modern document block about:',
                'ai-rewrite': 'Make this content professional and clearer.',
              };
              const aiContextMap: Record<string, string> = {
                'ai-summary': '',
                'ai-draft': '',
                'ai-rewrite': '',
              };
              const attrs: Record<string, unknown> = {
                id,
                indentLevel: 0,
                comments: '[]',
                aiPrompt: (updates as any).aiPrompt ?? aiPromptMap[updates.type as string] ?? '',
                aiContext: (updates as any).aiContext ?? aiContextMap[updates.type as string] ?? '',
              };
              const contentStart = info.pos + 1;
              const contentEnd = info.pos + info.nodeSize - 1;
              editor.chain().focus().setTextSelection(contentStart).deleteRange({ from: contentStart, to: contentEnd }).insertContent({ type: nodeName, attrs }).run();
            }}
            onClose={() => setActiveStyleBlockId(null)}
          />
        </div>
      )}
    </div>
  );
}
