import { useState, useRef, useEffect, useMemo } from 'react';
import { EditorContent } from '@tiptap/react';
import { useBlockEditor } from '../hooks/useBlockEditor';
import { useAICommands } from '../hooks/useAICommands';
import { useSpellcheck } from '../hooks/useSpellcheck';
import { useBlockComments } from '../hooks/useBlockComments';
import type { Block, BlockComment } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '../lib/utils';
import { escapeHtml, sanitizeHtml, parseMarkdownToHtml } from '../lib/blockUtils';
import { escapeRegExp } from '../lib/sanitize';
import { Sparkles, Mic, MicOff, Compass, Download, MessageCircle, X, Save, RefreshCw, Lock } from 'lucide-react';
import { SelectionActionModal } from './SelectionActionModal';
import { AiComposerModal } from './AiComposerModal';
import { SpellcheckPanel } from './blocks/SpellcheckPanel';
import { CommentPopup } from './blocks/CommentPopup';
import { SlashMenu, slashMenuActions } from './blocks/SlashMenu';
import { AiMenu } from './blocks/AiMenu';
import { StylePopup } from './blocks/StylePopup';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export { parseMarkdownToHtml } from '../lib/blockUtils';

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
}: {
  key?: string;
  initialBlocks: Block[];
  onChange: (blocks: Block[]) => void;
  title: string;
  onTitleChange: (title: string) => void;
  onActiveBlockChange?: (blockId: string | null) => void;
  onAiBlockRun?: (blockId: string) => void;
  focusAfterInsert?: string | null;
  onFocusAfterInsertUsed?: () => void;
  pageId?: string;
  onLockWorkspace?: () => void;
}) {
  const pageId = useMemo(
    () => pageIdProp || `page-${title.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'untitled'}`,
    [pageIdProp, title]
  );

  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);

  const { editor, isReady, commands } = useBlockEditor({
    pageId,
    initialBlocks,
    onChange: (newBlocks: Block[]) => {
      setBlocks(newBlocks);
      onChange(newBlocks);
    },
  });

  // ─── Slash Menu State ──────────────────────────────────────────────────────
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashMenuPos, setSlashMenuPos] = useState({ top: 0, left: 0 });
  const [slashQuery, setSlashQuery] = useState('');
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty' | 'error'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<string>(() => new Date().toLocaleTimeString());
  const isFirstRender = useRef(true);

  const onChangeRef = useRef(onChange);
  const blocksRef = useRef<Block[]>(blocks);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { blocksRef.current = blocks; }, [blocks]);

  // ─── Extracted hooks ─────────────────────────────────────────────────────────
  const comments = useBlockComments(editor);
  const ai = useAICommands(editor, blocksRef, comments.updateNodeAttrs);

  const getBlockElement = (id: string): HTMLElement | null => {
    if (!editor) return null;
    return editor.view.dom.querySelector(`[data-id="${id}"]`);
  };

  const spellcheck = useSpellcheck(editor, blocksRef, getBlockElement, ai.findNodePosAndSize);

  // ─── Helpers ─────────────────────────────────────────────────────────────────
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
      ai.setAiMenuPos({ top: window.innerHeight / 3, left: window.innerWidth / 2 - 250 });
      ai.setAiMenuOpen(true);
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
            const focusedId = ai.getFocusedBlockId();
            if (!focusedId) return;
            const info = ai.findNodePosAndSize(focusedId);
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
    if (!nodeName) { ai.setAiMenuOpen(true); setSlashMenuOpen(false); return; }

    const focusedId = ai.getFocusedBlockId();
    if (!focusedId) return;
    const info = ai.findNodePosAndSize(focusedId);
    if (!info) return;
    const { pos: blockStart, nodeSize } = info;
    const contentStart = blockStart + 1;
    const contentEnd = blockStart + nodeSize - 1;

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

    editor.chain().focus().deleteRange({ from: contentStart, to: contentEnd }).insertContent({ type: nodeName, attrs }).run();
    setSlashMenuOpen(false);
    setSlashQuery('');
  };

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

  useEffect(() => {
    if (!slashMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.slash-menu-container')) setSlashMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [slashMenuOpen]);

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
      const id = ai.getFocusedBlockId();
      onActiveBlockChange?.(id);
    };
    editor.on('selectionUpdate', handleSelectionUpdate);
    return () => { editor.off('selectionUpdate', handleSelectionUpdate); };
  }, [editor, onActiveBlockChange, ai]);

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
        comments.openCommentPopupForCurrentBlock();
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
  }, [editor, slashMenuOpen, filteredSlashActions, slashSelectedIndex, comments]);

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

  // ─── PDF export event listener ──────────────────────────────────────────────
  useEffect(() => {
    const handlePdfExportEvent = () => { exportPageAsPdf(); };
    window.addEventListener('export-pdf', handlePdfExportEvent);
    return () => window.removeEventListener('export-pdf', handlePdfExportEvent);
  }, []);

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className={cn("w-full px-6 sm:px-12 py-12 pb-48 font-sans text-lg text-[#37352F] dark:text-[#E3E3E3] transition-all duration-300", spellcheck.showSpellcheck && spellcheck.spellingIssues.length > 0 ? "max-w-6xl mx-auto" : "max-w-3xl mx-auto")}>
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
          <button onClick={spellcheck.runSpellCheck} disabled={spellcheck.spellCheckLoading} className={cn("flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md shadow-sm transition-all cursor-pointer border", spellcheck.showSpellcheck ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 font-bold" : "bg-white hover:bg-[#F1F1F0] dark:bg-[#1E1E1E] dark:hover:bg-[#2F2F2F] border-[#EBEBE9] dark:border-[#2F2F2F] text-gray-600 dark:text-gray-400")}>
            {spellcheck.spellCheckLoading ? <RefreshCw size={12} className="animate-spin" /> : <MessageCircle size={12} />}
            {spellcheck.spellCheckLoading ? 'Checking...' : spellcheck.showSpellcheck ? `Hide (${spellcheck.spellingIssues.length})` : 'Spellcheck'}
          </button>
          <button onClick={exportPageAsPdf} disabled={exportingPdf} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md bg-white hover:bg-[#F1F1F0] dark:bg-[#1E1E1E] dark:hover:bg-[#2F2F2F] border border-[#EBEBE9] dark:border-[#2F2F2F] text-gray-600 dark:text-gray-400 shadow-sm transition-all cursor-pointer">
            {exportingPdf ? <RefreshCw size={12} className="animate-spin" /> : <Download size={12} />}
            {exportingPdf ? 'Exporting...' : 'Export PDF'}
          </button>
          {onLockWorkspace && (<button onClick={onLockWorkspace} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md bg-white hover:bg-[#F1F1F0] dark:bg-[#1E1E1E] dark:hover:bg-[#2F2F2F] border border-[#EBEBE9] dark:border-[#2F2F2F] text-gray-600 dark:text-gray-400 shadow-sm transition-all cursor-pointer"><Lock size={12} /> Lock</button>)}
        </div>
      </div>

      <div className={cn("w-full", spellcheck.showSpellcheck && spellcheck.spellingIssues.length > 0 ? "grid grid-cols-1 lg:grid-cols-4 gap-8 items-start" : "")}>
        <div className={cn("w-full", spellcheck.showSpellcheck && spellcheck.spellingIssues.length > 0 ? "lg:col-span-3" : "")}>
          <div id="workspace-page-content" className="p-4 sm:p-6 rounded-xl">
            <input type="text" value={title || ''} onChange={e => onTitleChange(e.target.value)} placeholder="Untitled" className="w-full text-4xl font-bold bg-transparent border-none outline-none mb-8 placeholder-[#37352f4d] dark:placeholder-[#ffffff4d] resize-none text-[#37352F] dark:text-[#E3E3E3]" />

            {/* TipTap Editor Content */}
            {isReady && editor ? (
              <EditorContent editor={editor} />
            ) : (
              <div className="text-gray-400 text-sm py-8 text-center">Loading editor…</div>
            )}
          </div>
        </div>

        {/* Spellchecker panel */}
        {spellcheck.showSpellcheck && (
          <SpellcheckPanel
            spellingIssues={spellcheck.spellingIssues}
            blockRefs={{ current: new Proxy({}, { get: (_: any, id: string) => getBlockElement(id) }) } as any}
            applySpellingCorrection={spellcheck.applySpellingCorrection}
            ignoreSpellingIssue={spellcheck.ignoreSpellingIssue}
            runSpellCheck={spellcheck.runSpellCheck}
          />
        )}
      </div>

      {comments.activeStyleBlockId && editor && (
        <div className="fixed top-20 right-6 z-40">
          <StylePopup
            blockId={comments.activeStyleBlockId}
            style={getCurrentStyleFromEditor()}
            onToggleFlag={toggleBlockStyleFlag}
            onUpdateColor={updateBlockStyleColor}
            onUpdateBlock={(id, updates) => {
              const nodeName = typeToNodeName(updates.type as string);
              if (!nodeName || !editor) return;
              const info = ai.findNodePosAndSize(id);
              if (!info) return;
              const attrs: Record<string, unknown> = {
                id, indentLevel: 0, comments: '[]',
                aiPrompt: (updates as any).aiPrompt ?? (updates.type === 'ai-summary' ? 'Provide a tidy, structured summary of the content below.' : updates.type === 'ai-draft' ? 'Draft a modern document block about:' : 'Make this content professional and clearer.') ?? '',
                aiContext: (updates as any).aiContext ?? '',
              };
              const contentStart = info.pos + 1;
              const contentEnd = info.pos + info.nodeSize - 1;
              editor.chain().focus().setTextSelection(contentStart).deleteRange({ from: contentStart, to: contentEnd }).insertContent({ type: nodeName, attrs }).run();
            }}
            onClose={() => comments.setActiveStyleBlockId(null)}
          />
        </div>
      )}

      <SlashMenu
        isOpen={slashMenuOpen}
        position={slashMenuPos}
        query={slashQuery}
        selectedIndex={slashSelectedIndex}
        onAction={handleSlashAction}
        onSelectIndex={setSlashSelectedIndex}
      />

      {ai.aiMenuOpen && (
        <AiMenu
          aiMenuPos={ai.aiMenuPos}
          aiPrompt={ai.aiPrompt}
          aiLoading={ai.aiLoading}
          aiResult={ai.aiResult}
          selectedText={ai.selectedText}
          focusedId={ai.getFocusedBlockId()}
          blocks={blocksRef.current}
          onSetAiPrompt={ai.setAiPrompt}
          onRunAiCommand={ai.runAiCommand}
          onHandleAiAction={ai.handleAiAction}
          onToggleBlockStyleFlag={toggleBlockStyleFlag}
          onConvertFocusedBlock={ai.convertFocusedBlock}
          onSetAiMenuOpen={ai.setAiMenuOpen}
          onSetAiMenuPos={ai.setAiMenuPos}
          onSetAiResult={ai.setAiResult}
          onSetWorkspaceModalOpen={setWorkspaceModalOpen}
        />
      )}

      <div className="fixed bottom-8 right-6 md:right-8 flex space-x-2 z-30">
        {ai.selectedText && (<button onClick={() => setWorkspaceModalOpen(true)} className="h-10 px-4 bg-purple-600 text-white shadow-md rounded-full flex items-center hover:bg-purple-700 text-sm font-medium transition-colors"><Compass size={16} className="mr-1.5 animate-pulse" /> Workspace Actions</button>)}
        <button onClick={ai.toggleListening} className={cn("w-10 h-10 border border-[#EBEBE9] shadow-md rounded-full flex items-center justify-center transition-colors", ai.isListening ? "bg-red-50 text-red-500 border-red-200" : "bg-white hover:bg-[#F1F1F0] text-[#37352f7a]")}>{ai.isListening ? <Mic size={18} /> : <MicOff size={18} />}</button>
        <button onClick={() => { ai.setAiMenuPos({ top: Math.max(100, window.innerHeight - 400), left: Math.max(20, window.innerWidth / 2 - 250) }); ai.setAiMenuOpen(true); }} className="h-10 px-4 bg-white border border-[#EBEBE9] shadow-md rounded-full flex items-center hover:bg-[#F1F1F0] text-sm font-medium transition-colors"><span className="text-purple-600 mr-2">✨</span> Ask AI</button>
      </div>

      <SelectionActionModal isOpen={workspaceModalOpen} onClose={() => setWorkspaceModalOpen(false)} selectedText={ai.selectedText || "Page Title: " + title} />
      {ai.composerBlockId && (() => { const selectedBlock = blocksRef.current.find(b => b.id === ai.composerBlockId); if (!selectedBlock) return null; return (<AiComposerModal isOpen={true} onClose={() => ai.setComposerBlockId(null)} block={selectedBlock} blocks={blocksRef.current} onSave={() => {}} />); })()}

      {comments.activeCommentBlockId && editor && (
        <div className="fixed top-20 right-6 z-40">
          <CommentPopup
            blockId={comments.activeCommentBlockId}
            comments={comments.getBlockComments(comments.activeCommentBlockId)}
            newCommentText={comments.newCommentText}
            onSetNewCommentText={comments.setNewCommentText}
            onAddComment={comments.addBlockComment}
            onRemoveComment={comments.removeBlockComment}
            onClose={() => comments.setActiveCommentBlockId(null)}
          />
        </div>
      )}
    </div>
  );
}
