import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Block, BlockType, BlockStyle, BlockComment } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '../lib/utils';
import { 
  GripVertical, Plus, ChevronRight, Hash, Type, CheckSquare, 
  List, Minus, Quote, Sparkles, MessageSquare, ArrowRight, Wand2,
  Mic, MicOff, Lightbulb, Languages, Edit, Compass, Calendar,
  Download, Palette, MessageCircle, Bold, Italic, Underline, Check, X,
  Save, RefreshCw, Maximize2, Code, Copy
} from 'lucide-react';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import { addGoogleTask, addGoogleCalendarEvent } from '../lib/workspace';
import { SelectionActionModal } from './SelectionActionModal';
import { AiComposerModal } from './AiComposerModal';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const TEXT_COLORS = [
  { name: 'Default', value: 'inherit' },
  { name: 'Gray', value: '#787774' },
  { name: 'Brown', value: '#976D57' },
  { name: 'Orange', value: '#CC4E00' },
  { name: 'Yellow', value: '#C29000' },
  { name: 'Green', value: '#218358' },
  { name: 'Blue', value: '#137CA6' },
  { name: 'Purple', value: '#8F55A3' },
  { name: 'Red', value: '#C23131' },
];

const BG_COLORS = [
  { name: 'Transparent', value: 'transparent' },
  { name: 'Light Gray', value: '#F1F1F0' },
  { name: 'Brown', value: '#F3ECE9' },
  { name: 'Orange', value: '#FAEBDD' },
  { name: 'Yellow', value: '#FBF3DB' },
  { name: 'Green', value: '#EDF6EC' },
  { name: 'Blue', value: '#E8F4FC' },
  { name: 'Purple', value: '#F3EDF5' },
  { name: 'Red', value: '#FDEBEC' },
];

const INLINE_AI_PRESETS = {
  'ai-summary': [
    { label: "⚡ TL;DR", prompt: "Summarize this into a single, punchy TL;DR paragraph." },
    { label: "📋 Deliverables", prompt: "Extract and summarize all action items and meeting deliverables as a structured list." },
    { label: "💡 Key Insights", prompt: "Identify and outline the 3 most critical insights and lessons from the text." },
  ],
  'ai-draft': [
    { label: "📅 Agenda", prompt: "Create a detailed meeting agenda outline including standard timers and discussion goals." },
    { label: "✉️ Email", prompt: "Draft a polished, professional email summarizing these points for executive stakeholders." },
    { label: "🚀 Launch Pitch", prompt: "Write an inspiring release announcement for a product launch highlighting the key impacts." },
  ],
  'ai-rewrite': [
    { label: "👔 Corporate", prompt: "Rewrite this content to be highly professional, elegant, and corporate suited." },
    { label: "✂️ Concise", prompt: "Rewrite this text to be short and direct. Eliminate all fluff while preserving core facts." },
    { label: "👶 Simple", prompt: "Simplify the language and terminology. Explain this complex concept as if I am 10 years old." },
  ]
};

export function parseMarkdownToHtml(text: string): string {
  if (!text) return text;
  
  let parsed = text;

  // Bold: **text** or __text__
  parsed = parsed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  parsed = parsed.replace(/__(.*?)__/g, '<strong>$1</strong>');

  // Italic: *text* or _text_
  parsed = parsed.replace(/\*([^\*<>]+)\*/g, '<em>$1</em>');
  parsed = parsed.replace(/_([^_<>]+)_/g, '<em>$1</em>');

  // Strikethrough: ~~text~~ or ~text~
  parsed = parsed.replace(/~~([^~<>]+)~~/g, '<del>$1</del>');
  parsed = parsed.replace(/~([^~<>]+)~/g, '<del>$1</del>');

  // Code: `text`
  parsed = parsed.replace(/`([^`<>]+)`/g, (match, p1) => {
    return `<code class="bg-[#F1F1F0] dark:bg-[#2F2F2F] text-[#EB5757] dark:text-[#E06C75] px-1.5 py-0.5 rounded font-mono text-sm border border-[#EBEBE9] dark:border-[#3F3F3F] font-semibold">${p1}</code>`;
  });

  // Multiline lists
  if (parsed.includes('\n')) {
    const lines = parsed.split('\n');
    let insideUl = false;
    let insideOl = false;
    const formattedLines = lines.map(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        let prefix = insideUl ? '' : '<ul class="list-disc pl-5 my-1 space-y-0.5">';
        insideUl = true;
        if (insideOl) {
          prefix = '</ol>' + prefix;
          insideOl = false;
        }
        return prefix + `<li class="my-0.5">${trimmed.substring(2)}</li>`;
      } else if (/^\d+\.\s/.test(trimmed)) {
        let prefix = insideOl ? '' : '<ol class="list-decimal pl-5 my-1 space-y-0.5">';
        insideOl = true;
        if (insideUl) {
          prefix = '</ul>' + prefix;
          insideUl = false;
        }
        const match = trimmed.match(/^\d+\.\s(.*)/);
        const liContent = match ? match[1] : trimmed;
        return prefix + `<li class="my-0.5">${liContent}</li>`;
      } else {
        let suffix = '';
        if (insideUl) {
          suffix = '</ul>';
          insideUl = false;
        }
        if (insideOl) {
          suffix = '</ol>';
          insideOl = false;
        }
        return suffix + line;
      }
    });
    
    if (insideUl) formattedLines.push('</ul>');
    if (insideOl) formattedLines.push('</ol>');
    parsed = formattedLines.join('\n');
  }

  return parsed;
}

interface CodeBlockProps {
  block: Block;
  index: number;
  focusedId: string | null;
  setFocusedId: (id: string | null) => void;
  updateBlock: (id: string, updates: Partial<Block>) => void;
  blocks: Block[];
  setBlocks: React.Dispatch<React.SetStateAction<Block[]>>;
  focusBlock: (id: string, start?: boolean) => void;
}

const SUPPORTED_LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'html', label: 'HTML/XML' },
  { value: 'css', label: 'CSS' },
  { value: 'python', label: 'Python' },
  { value: 'rust', label: 'Rust' },
  { value: 'go', label: 'Go' },
  { value: 'sql', label: 'SQL' },
  { value: 'bash', label: 'Bash/Shell' },
  { value: 'json', label: 'JSON' },
  { value: 'cpp', label: 'C++' },
  { value: 'java', label: 'Java' },
  { value: 'plaintext', label: 'Plain Text' }
];

function CodeBlock({ 
  block, 
  index, 
  focusedId, 
  setFocusedId, 
  updateBlock, 
  blocks, 
  setBlocks, 
  focusBlock 
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isFocused = focusedId === block.id;

  useEffect(() => {
    if (isFocused && textareaRef.current) {
      textareaRef.current.focus();
      // Adjust height
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [isFocused]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [block.content]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(block.content || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = textareaRef.current;
    if (!el) return;

    if (e.key === 'Tab') {
      e.preventDefault();
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const val = el.value;
      const newVal = val.substring(0, start) + '    ' + val.substring(end);
      updateBlock(block.id, { content: newVal });
      
      // Reset select position after render
      setTimeout(() => {
        el.selectionStart = el.selectionEnd = start + 4;
      }, 0);
      return;
    }

    if (e.key === 'ArrowUp' && el.selectionStart === 0 && index > 0) {
      e.preventDefault();
      focusBlock(blocks[index - 1].id, true);
      return;
    }

    if (e.key === 'ArrowDown' && el.selectionEnd === el.value.length && index < blocks.length - 1) {
      e.preventDefault();
      focusBlock(blocks[index + 1].id, true);
      return;
    }

    if (e.key === 'Backspace' && block.content === '') {
      e.preventDefault();
      updateBlock(block.id, { type: 'p' });
      // Keep focused
      setTimeout(() => focusBlock(block.id, true), 0);
      return;
    }

    // Handle Enter to NOT split the block but just add a newline in the code
    if (e.key === 'Enter') {
      // It is a standard textarea, so Enter naturally adds a newline. 
      // We don't want it to bubble up to any parent list selectors.
      e.stopPropagation();
    }
  };

  const highlightCode = (code: string, lang: string) => {
    if (!code) return '<span class="text-gray-500 italic pb-1">// Click to type your code here...</span>';
    try {
      const selectedLang = lang || 'javascript';
      if (hljs.getLanguage(selectedLang)) {
        return hljs.highlight(code, { language: selectedLang, ignoreIllegals: true }).value;
      }
      return hljs.highlightAuto(code).value;
    } catch (err) {
      return code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
  };

  return (
    <div 
      className={cn(
        "w-full rounded-xl bg-[#0D0D0E]/95 dark:bg-[#070709]/95 border border-[#1A1A1E] text-stone-200 shadow-lg p-0.5 overflow-hidden font-mono mt-3 mb-3 relative group/code focus-within:ring-1 focus-within:ring-purple-400 focus-within:border-purple-500/50",
        isFocused && "shadow-2xl border-[#2F2F38]"
      )}
      onClick={() => setFocusedId(block.id)}
    >
      {/* Code block Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1C1C22] select-none text-[11px] text-gray-400 bg-[#121217] rounded-t-xl shrink-0">
        <div className="flex items-center gap-2">
          <Code size={13} className="text-purple-400" />
          <select
            value={block.language || 'javascript'}
            onChange={(e) => {
              e.stopPropagation();
              updateBlock(block.id, { language: e.target.value });
            }}
            onClick={(e) => e.stopPropagation()}
            className="bg-transparent hover:bg-[#1E1E26] text-gray-300 font-sans font-bold uppercase tracking-wider text-[10px] rounded px-1.5 py-1 border border-transparent hover:border-[#2C2C37] outline-none cursor-pointer transition-all"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value} className="bg-[#121217] text-gray-205 uppercase">
                {lang.label}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1 bg-[#1E1E26]/45 hover:bg-[#23232C] hover:text-white border border-[#23232E] px-2.5 py-1 rounded text-[10px] font-sans font-bold uppercase tracking-wider transition-all cursor-pointer text-gray-400"
          title="Copy block to clipboard"
        >
          {copied ? (
            <>
              <Check size={11} className="text-emerald-400 stroke-[3]" />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy size={11} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code block Input or Output */}
      <div className="relative w-full p-4 overflow-x-auto select-text">
        {isFocused ? (
          <textarea
            ref={textareaRef}
            value={block.content || ''}
            onChange={(e) => {
              updateBlock(block.id, { content: e.target.value });
            }}
            onKeyDown={handleKeyDown}
            placeholder="// Paste or write code here..."
            className="w-full bg-transparent border-none text-sm font-mono text-gray-100 leading-relaxed outline-none focus:ring-0 resize-none overflow-hidden p-0 m-0"
            style={{ minHeight: '80px' }}
          />
        ) : (
          <pre className="text-sm font-mono leading-relaxed overflow-x-auto whitespace-pre p-0 m-0">
            <code 
              className={cn("hljs", block.language)} 
              dangerouslySetInnerHTML={{ __html: highlightCode(block.content || '', block.language || '') }} 
            />
          </pre>
        )}
      </div>
    </div>
  );
}

interface BlockEditorProps {
  key?: string;
  initialBlocks: Block[];
  onChange: (blocks: Block[]) => void;
  title: string;
  onTitleChange: (title: string) => void;
}

export function BlockEditor({ initialBlocks, onChange, title, onTitleChange }: BlockEditorProps) {
  const [blocks, setBlocks] = useState<Block[]>(() => 
    initialBlocks.map(b => ({
      ...b,
      content: parseMarkdownToHtml(b.content)
    }))
  );
  const [focusedId, setFocusedId] = useState<string | null>(null);
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

  // Styling & Comment states
  const [activeStyleBlockId, setActiveStyleBlockId] = useState<string | null>(null);
  const [activeCommentBlockId, setActiveCommentBlockId] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [showBgColorPicker, setShowBgColorPicker] = useState(false);
  
  // Spellchecker states
  const [showSpellcheck, setShowSpellcheck] = useState(false);
  const [spellCheckLoading, setSpellCheckLoading] = useState(false);
  const [spellingIssues, setSpellingIssues] = useState<{
    id: string;
    word: string;
    suggestions: string[];
    context: string;
    blockId: string;
  }[]>([]);

  const [blockLoadingMap, setBlockLoadingMap] = useState<Record<string, boolean>>({});
  const [composerBlockId, setComposerBlockId] = useState<string | null>(null);
  
  // Auto-save State Management
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty' | 'error'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<string>(() => new Date().toLocaleTimeString());
  const isFirstRender = useRef(true);

  // Reset slash index on query change
  useEffect(() => {
    setSlashSelectedIndex(0);
  }, [slashQuery]);

  // Mark status as dirty on user adjustments (skip first render mount)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setSaveStatus('dirty');
  }, [blocks, title]);

  // Handle auto-save at a regular interval (5 seconds)
  useEffect(() => {
    const timer = setInterval(() => {
      // Rotate state to saving
      setSaveStatus('saving');
      try {
        const payload = {
          title,
          blocks,
          timestamp: Date.now()
        };
        // Back up current content to local storage to avoid any data loss
        localStorage.setItem(`motion_ai_autosave_${title || 'Untitled'}`, JSON.stringify(payload));
        
        // Propagate state to the parent component
        onChangeRef.current(blocks);
        
        setTimeout(() => {
          setSaveStatus('saved');
          setLastSavedTime(new Date().toLocaleTimeString());
        }, 800);
      } catch (err) {
        console.error("Auto-save error:", err);
        setSaveStatus('error');
      }
    }, 5000); // 5 seconds interval

    return () => clearInterval(timer);
  }, [blocks, title]);

  // Manual save handler for active action support
  const triggerManualSave = () => {
    setSaveStatus('saving');
    try {
      const payload = {
        title,
        blocks,
        timestamp: Date.now()
      };
      localStorage.setItem(`motion_ai_autosave_${title || 'Untitled'}`, JSON.stringify(payload));
      onChangeRef.current(blocks);
      
      setTimeout(() => {
        setSaveStatus('saved');
        setLastSavedTime(new Date().toLocaleTimeString());
      }, 600);
    } catch (err) {
      console.error("Manual save error:", err);
      setSaveStatus('error');
    }
  };
  
  const blockRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onChangeRef.current(blocks);
  }, [blocks]);

  const focusBlock = (id: string, atEnd: boolean = true) => {
    setFocusedId(id);
    setTimeout(() => {
      const el = blockRefs.current[id];
      if (el) {
        el.focus();
        if (atEnd) {
          const range = document.createRange();
          const sel = window.getSelection();
          range.selectNodeContents(el);
          range.collapse(false);
          sel?.removeAllRanges();
          sel?.addRange(range);
        }
      }
    }, 0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>, index: number) => {
    const block = blocks[index];
    const el = e.currentTarget;

    if (slashMenuOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashSelectedIndex(prev => (prev + 1) % filteredSlashActions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashSelectedIndex(prev => (prev - 1 + filteredSlashActions.length) % filteredSlashActions.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const action = filteredSlashActions[slashSelectedIndex];
        if (action) {
          handleSlashAction(action);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSlashMenuOpen(false);
        return;
      }
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const currentLevel = block.indentLevel || 0;
      const newLevel = e.shiftKey ? Math.max(0, currentLevel - 1) : Math.min(4, currentLevel + 1);
      updateBlock(block.id, { indentLevel: newLevel });
      return;
    }
    
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      
      // If slash menu is open, let the menu handle it (simplified here for brevity)
      if (slashMenuOpen) return;
      
      const newBlock: Block = { id: uuidv4(), type: 'p', content: '' };
      
      // Inherit type if it's a list
      if (block.type === 'bullet' || block.type === 'todo') {
        if (block.content === '') {
          // If empty list item and hit enter, convert to paragraph
          updateBlock(block.id, { type: 'p' });
          return;
        }
        newBlock.type = block.type;
      }
      
      const newBlocks = [...blocks];
      newBlocks.splice(index + 1, 0, newBlock);
      setBlocks(newBlocks);
      focusBlock(newBlock.id, true);
    }
    
    if (e.key === 'Backspace' && el.textContent === '') {
      e.preventDefault();
      if (block.type !== 'p') {
        updateBlock(block.id, { type: 'p' });
      } else if (index > 0) {
        const prevId = blocks[index - 1].id;
        const newBlocks = blocks.filter((_, i) => i !== index);
        setBlocks(newBlocks);
        focusBlock(prevId, true);
      }
    }
    
    if (e.ctrlKey && e.altKey) {
      switch (e.key) {
        case 't': updateBlock(block.id, { type: 'todo' }); e.preventDefault(); return;
        case '1': updateBlock(block.id, { type: 'h1' }); e.preventDefault(); return;
        case '2': updateBlock(block.id, { type: 'h2' }); e.preventDefault(); return;
        case '3': updateBlock(block.id, { type: 'h3' }); e.preventDefault(); return;
        case 'b': updateBlock(block.id, { type: 'bullet' }); e.preventDefault(); return;
        case 'c': updateBlock(block.id, { type: 'callout' }); e.preventDefault(); return;
        case 'q': updateBlock(block.id, { type: 'quote' }); e.preventDefault(); return;
      }
    }

    if (e.metaKey || e.ctrlKey) {
      if (e.key === 'b') {
        e.preventDefault();
        const textSel = window.getSelection()?.toString();
        if (!textSel) {
          toggleBlockStyleFlag(block.id, 'bold');
        } else {
          document.execCommand('bold', false);
        }
        return;
      }
      if (e.key === 'i') {
        e.preventDefault();
        const textSel = window.getSelection()?.toString();
        if (!textSel) {
          toggleBlockStyleFlag(block.id, 'italic');
        } else {
          document.execCommand('italic', false);
        }
        return;
      }
    }

    if (e.key === '/') {
      const rect = el.getBoundingClientRect();
      setSlashMenuPos({ top: rect.bottom, left: rect.left });
      setSlashMenuOpen(true);
    } else if (slashMenuOpen && (e.key === 'Escape' || e.key === ' ')) {
      setSlashMenuOpen(false);
    }
    
    if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault();
      focusBlock(blocks[index - 1].id, true);
    }
    
    if (e.key === 'ArrowDown' && index < blocks.length - 1) {
      e.preventDefault();
      focusBlock(blocks[index + 1].id, true);
    }
  };

  const handleInput = (e: React.FormEvent<HTMLDivElement>, id: string) => {
    let content = e.currentTarget.innerHTML || '';
    let converted = false;
    
    // Auto-markdown inline conversions
    if (content.includes('**')) {
      const newContent = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      if (newContent !== content) {
        content = newContent;
        converted = true;
      }
    }
    if (content.includes('__')) {
      const newContent = content.replace(/__(.*?)__/g, '<strong>$1</strong>');
      if (newContent !== content) {
        content = newContent;
        converted = true;
      }
    }
    if (content.match(/\*([^\*<>]+)\*/)) {
      const newContent = content.replace(/\*([^\*<>]+)\*/g, '<em>$1</em>');
      if (newContent !== content) {
        content = newContent;
        converted = true;
      }
    }
    if (content.match(/_([^_<>]+)_/)) {
      const newContent = content.replace(/_([^_<>]+)_/g, '<em>$1</em>');
      if (newContent !== content) {
        content = newContent;
        converted = true;
      }
    }
    if (content.includes('`')) {
      const newContent = content.replace(/`([^`<>]+)`/g, (match, p1) => {
        return `<code class="bg-[#F1F1F0] dark:bg-[#2F2F2F] text-[#EB5757] dark:text-[#E06C75] px-1.5 py-0.5 rounded font-mono text-sm border border-[#EBEBE9] dark:border-[#3F3F3F] font-semibold">${p1}</code>`;
      });
      if (newContent !== content) {
        content = newContent;
        converted = true;
      }
    }
    if (content.includes('~~')) {
      const newContent = content.replace(/~~([^~<>]+)~~/g, '<del>$1</del>');
      if (newContent !== content) {
        content = newContent;
        converted = true;
      }
    }

    if (converted) {
      e.currentTarget.innerHTML = content;
      // Move caret to end
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(e.currentTarget);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }

    updateBlock(id, { content });
    
    const textContent = e.currentTarget.textContent || '';
    // Auto-markdown conversions for prefixes
    if (textContent.startsWith('# ')) {
      const clean = textContent.substring(2);
      updateBlock(id, { type: 'h1', content: clean });
      e.currentTarget.innerHTML = clean;
      focusBlock(id, true);
    } else if (textContent.startsWith('## ')) {
      const clean = textContent.substring(3);
      updateBlock(id, { type: 'h2', content: clean });
      e.currentTarget.innerHTML = clean;
      focusBlock(id, true);
    } else if (textContent.startsWith('### ')) {
      const clean = textContent.substring(4);
      updateBlock(id, { type: 'h3', content: clean });
      e.currentTarget.innerHTML = clean;
      focusBlock(id, true);
    } else if (textContent.startsWith('- ') || textContent.startsWith('* ')) {
      const clean = textContent.substring(2);
      updateBlock(id, { type: 'bullet', content: clean });
      e.currentTarget.innerHTML = clean;
      focusBlock(id, true);
    } else if (textContent.startsWith('1. ')) {
      const clean = textContent.substring(3);
      updateBlock(id, { type: 'bullet', content: clean });
      e.currentTarget.innerHTML = clean;
      focusBlock(id, true);
    } else if (textContent.startsWith('[] ') || textContent.startsWith('[ ] ')) {
      const offset = textContent.startsWith('[ ] ') ? 4 : 3;
      const clean = textContent.substring(offset);
      updateBlock(id, { type: 'todo', content: clean, checked: false });
      e.currentTarget.innerHTML = clean;
      focusBlock(id, true);
    } else if (textContent.startsWith('[x] ') || textContent.startsWith('[X] ')) {
      const clean = textContent.substring(4);
      updateBlock(id, { type: 'todo', content: clean, checked: true });
      e.currentTarget.innerHTML = clean;
      focusBlock(id, true);
    } else if (textContent.startsWith('> ')) {
      const clean = textContent.substring(2);
      updateBlock(id, { type: 'quote', content: clean });
      e.currentTarget.innerHTML = clean;
      focusBlock(id, true);
    } else if (textContent === '---') {
      updateBlock(id, { type: 'divider', content: '' });
      e.currentTarget.innerHTML = '';
      focusBlock(id, true);
    } else if (textContent.startsWith('```')) {
      const langMatch = textContent.match(/^```(\w+)?/);
      const language = langMatch && langMatch[1] ? langMatch[1].toLowerCase() : 'javascript';
      const clean = textContent.replace(/^```(\w+)?\s*/, '');
      updateBlock(id, { type: 'code', content: clean, language });
      e.currentTarget.innerHTML = clean;
      focusBlock(id, true);
    }

    // Keep track of Slash command live inputs and search terms
    const slashIndex = textContent.lastIndexOf('/');
    if (slashIndex !== -1 && slashIndex >= textContent.length - 15) {
      const query = textContent.substring(slashIndex + 1);
      if (!query.includes(' ') && !query.includes('\n')) {
        setSlashQuery(query);
        setSlashMenuOpen(true);
        // Position relative to current text caret
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          if (rect.top !== 0 && rect.left !== 0) {
            setSlashMenuPos({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX });
          }
        }
      } else {
        setSlashMenuOpen(false);
        setSlashQuery('');
      }
    } else {
      if (slashMenuOpen && !textContent.includes('/')) {
        setSlashMenuOpen(false);
        setSlashQuery('');
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>, index: number, id: string) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;

    // Check if it's multiline markdown or standard markdown
    if (text.includes('\n')) {
      const lines = text.split('\n');
      const newBlocks: Block[] = [];
      
      lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) {
          newBlocks.push({ id: uuidv4(), type: 'p', content: '' });
          return;
        }

        let type: BlockType = 'p';
        let content = line;
        let checked = false;

        if (trimmed.startsWith('# ')) {
          type = 'h1';
          content = line.replace(/^\s*#\s+/, '');
        } else if (trimmed.startsWith('## ')) {
          type = 'h2';
          content = line.replace(/^\s*##\s+/, '');
        } else if (trimmed.startsWith('### ')) {
          type = 'h3';
          content = line.replace(/^\s*###\s+/, '');
        } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          type = 'bullet';
          content = line.replace(/^\s*[-*]\s+/, '');
        } else if (trimmed.startsWith('1. ')) {
          type = 'bullet';
          content = line.replace(/^\s*1\.\s+/, '');
        } else if (trimmed.startsWith('> ')) {
          type = 'quote';
          content = line.replace(/^\s*>\s+/, '');
        } else if (trimmed.startsWith('[] ') || trimmed.startsWith('[ ] ')) {
          type = 'todo';
          content = line.replace(/^\s*\[\s*\]\s+/, '');
        } else if (trimmed.startsWith('[x] ') || trimmed.startsWith('[X] ')) {
          type = 'todo';
          checked = true;
          content = line.replace(/^\s*\[[xX]\]\s+/, '');
        } else if (trimmed === '---') {
          type = 'divider';
          content = '';
        }

        // Run inline markdown parsing on pasted content
        content = parseMarkdownToHtml(content);

        newBlocks.push({
          id: uuidv4(),
          type,
          content,
          checked
        });
      });

      if (newBlocks.length > 0) {
        const updatedBlocks = [...blocks];
        const currentBlock = blocks[index];
        const currentTrimmed = e.currentTarget.textContent?.trim() || '';

        if (currentTrimmed === '') {
          updatedBlocks[index] = {
            ...currentBlock,
            type: newBlocks[0].type,
            content: newBlocks[0].content,
            checked: newBlocks[0].checked
          };
          updatedBlocks.splice(index + 1, 0, ...newBlocks.slice(1));
        } else {
          updatedBlocks.splice(index + 1, 0, ...newBlocks);
        }

        setBlocks(updatedBlocks);
        // Focus last block
        const lastPastedId = newBlocks[newBlocks.length - 1].id;
        focusBlock(lastPastedId, true);
      }
    } else {
      // Single line paste - parse inline formatting to html
      const parsedText = parseMarkdownToHtml(text);
      document.execCommand('insertHTML', false, parsedText);
    }
  };

  const updateBlock = (id: string, updates: Partial<Block>) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const convertFocusedBlock = (newType: 'ai-summary' | 'ai-draft' | 'ai-rewrite') => {
    if (!focusedId) return;
    
    // Determine context and prompt based on types
    let aiContext = '';
    let aiPrompt = '';
    
    if (newType === 'ai-summary') {
      aiContext = selectedText || blocks.find(b => b.id === focusedId)?.content || '';
      aiPrompt = 'Provide a tidy, structured summary of the content below.';
    } else if (newType === 'ai-draft') {
      aiPrompt = selectedText || blocks.find(b => b.id === focusedId)?.content || '';
      aiContext = '';
    } else if (newType === 'ai-rewrite') {
      aiContext = selectedText || blocks.find(b => b.id === focusedId)?.content || '';
      aiPrompt = 'Make this content professional and clearer.';
    }
    
    // strip HTML tags for plain text usage in textareas
    aiContext = aiContext.replace(/<[^>]*>/g, '');
    aiPrompt = aiPrompt.replace(/<[^>]*>/g, '');
    
    updateBlock(focusedId, {
      type: newType,
      aiContext,
      aiPrompt,
      content: '' // Reset direct rich content
    });
    
    setAiMenuOpen(false);
  };

  const applyInlineStyle = (command: string, value: string = '') => {
    document.execCommand(command, false, value);
    if (focusedId) {
      const el = blockRefs.current[focusedId];
      if (el) {
        const fakeEvent = {
          currentTarget: el,
        } as unknown as React.FormEvent<HTMLDivElement>;
        handleInput(fakeEvent, focusedId);
      }
    }
  };

  const openAiMenuForSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelectedText(sel.toString());
      setAiMenuPos({ top: rect.bottom + window.scrollY + 8, left: rect.left + window.scrollX });
      setAiMenuOpen(true);
    }
  };

  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.selection-toolbar-container')) {
        return;
      }
      
      setTimeout(() => {
        const sel = window.getSelection();
        if (sel && sel.toString().trim().length > 0) {
          openAiMenuForSelection();
        } else {
          setAiMenuOpen(false);
          setSelectedText('');
          setShowTextColorPicker(false);
          setShowBgColorPicker(false);
        }
      }, 50);
    };
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [focusedId]);

  useEffect(() => {
    const handleAiCommandEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ action: string }>;
      const { action } = customEvent.detail;
      setAiMenuPos({ top: window.innerHeight / 3, left: Math.max(20, window.innerWidth / 2 - 250) });
      setAiMenuOpen(true);
      if (action === 'brainstorm') {
         setAiPrompt('Brainstorm ideas for... ');
      } else if (action === 'summarize') {
         if (selectedText) {
             runAiCommand('summarize');
         } else {
             setAiPrompt('Summarize... ');
         }
      } else if (action === 'draft') {
         setAiPrompt('Draft a blog post about... ');
      } else if (action === 'translate') {
         if (selectedText) {
             runAiCommand('custom', 'Translate this text into Spanish (or specified language):');
         } else {
             setAiPrompt('Translate this to Chinese: ');
         }
      } else if (action === 'rewrite') {
         if (selectedText) {
             runAiCommand('custom', 'Rewrite this paragraph to be more professional and clear:');
         } else {
             setAiPrompt('Rewrite: ');
         }
      } else if (action === 'grammar') {
         if (selectedText) {
             runAiCommand('custom', 'Fix spelling and grammar mistakes in this text, keeping the tone the same:');
         } else {
             setAiPrompt('Check grammar: ');
         }
      }
    };
    window.addEventListener('ai-command', handleAiCommandEvent);
    return () => window.removeEventListener('ai-command', handleAiCommandEvent);
  }, [blocks.length, selectedText]); // Add dependencies since we call runAiCommand which uses them

  useEffect(() => {
    const handlePdfExportEvent = () => {
      exportPageAsPdf();
    };
    window.addEventListener('export-pdf', handlePdfExportEvent);
    return () => window.removeEventListener('export-pdf', handlePdfExportEvent);
  }, [blocks, title]);

  const runAiCommand = async (command: string, customPrompt = '') => {
    if (!selectedText && command !== 'continue' && command !== 'custom' && command !== 'brainstorm') return;
    
    setAiLoading(true);
    try {
      let semanticContext = '';
      try {
        const { semanticSearch } = await import('../lib/vectorStore');
        const results = await semanticSearch(customPrompt || aiPrompt || selectedText || 'general content', 3);
        if (results && results.length > 0) {
          semanticContext = '\n\n[RELEVANT LOCAL CHUNKS]\n' + results.map((r: any) => `- "${r.text}"`).join('\n');
        }
      } catch (e) {
        console.warn('Semantic search failed or not ready:', e);
      }

      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command,
          context: (selectedText || blocks.map(b => b.content).join('\n')) + semanticContext,
          prompt: customPrompt || aiPrompt
        })
      });
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      // Process Data
      const newContent = data.text;
      
      if (command === 'extract') {
         // Create tasks from extracted text
         const lines = newContent.split('\n').filter((l: string) => l.trim().length > 0);
         for (const line of lines) {
           const cleanLine = line.replace(/^[-*]\s*/, '').trim();
           if (cleanLine) {
               // Use confirmation workflow for Workspace mutation
               const conf = window.confirm(`Create Google Task: "${cleanLine}"?`);
               if (conf) {
                 await addGoogleTask(cleanLine);
               }
           }
         }
         alert("Data extraction complete!");
         setAiMenuOpen(false);
         setAiPrompt('');
      } else {
        setAiResult(newContent);
      }
      
    } catch (err: any) {
      alert("AI Error: " + err.message);
      setAiMenuOpen(false);
      setAiPrompt('');
    } finally {
      setAiLoading(false);
    }
  };

  const generateContentForBlock = async (id: string) => {
    const block = blocks.find(b => b.id === id);
    if (!block) return;

    setBlockLoadingMap(prev => ({ ...prev, [id]: true }));
    try {
      let command = 'custom';
      let prompt = '';
      let context = '';

      if (block.type === 'ai-summary') {
        command = 'summarize';
        context = block.aiContext || '';
        prompt = block.aiPrompt || 'Provide a tidy, structured summary of the content below.';
      } else if (block.type === 'ai-draft') {
        command = 'custom';
        context = block.aiContext || '';
        prompt = `Draft a modern document block about: ${block.aiPrompt}.${context ? ` Extra context: ${context}` : ''}`;
      } else if (block.type === 'ai-rewrite') {
        command = 'custom';
        context = block.aiContext || '';
        prompt = `Please rewrite the following content to fit these criteria: ${block.aiPrompt}. Keep it structurally sound and clean. Target Content:\n${context}`;
      }

      let semanticContext = '';
      try {
        const { semanticSearch } = await import('../lib/vectorStore');
        const results = await semanticSearch(prompt || context || 'general content', 3);
        if (results && results.length > 0) {
          semanticContext = '\n\n[RELEVANT LOCAL CHUNKS]\n' + results.map((r: any) => `- "${r.text}"`).join('\n');
        }
      } catch (e) {
        console.warn('Semantic search failed or not ready:', e);
      }

      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command,
          context: context + semanticContext,
          prompt
        })
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const htmlContent = parseMarkdownToHtml(data.text || '');
      updateBlock(id, { content: htmlContent });
    } catch (err: any) {
      alert("Block generation error: " + err.message);
    } finally {
      setBlockLoadingMap(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleAiAction = (action: 'insert' | 'replace' | 'discard') => {
    if (action === 'discard') {
      setAiResult(null);
      setAiMenuOpen(false);
      setAiPrompt('');
      return;
    }
    
    if (!aiResult) return;
    
    const lines = aiResult.split('\n').filter((l: string) => l.trim().length > 0);
    const newBlocks: Block[] = lines.map((line: string) => ({
        id: uuidv4(),
        type: 'p',
        content: line
    }));
    
    const updatedBlocks = [...blocks];
    let index = blocks.length - 1;
    if (focusedId) {
        index = blocks.findIndex(b => b.id === focusedId);
    }
    
    if (action === 'replace' && focusedId) {
        const targetBlock = updatedBlocks.find(b => b.id === focusedId);
        if (targetBlock && selectedText) {
          const cleanTextResult = aiResult.trim();
          if (targetBlock.content.includes(selectedText)) {
            targetBlock.content = targetBlock.content.replace(selectedText, cleanTextResult);
          } else {
            // Strip any tags if necessary, or just fallback to block replacement
            targetBlock.content = cleanTextResult;
          }
        } else {
          updatedBlocks.splice(index, 1, ...newBlocks);
        }
    } else {
        updatedBlocks.splice(index + 1, 0, ...newBlocks);
    }
    
    setBlocks(updatedBlocks);
    setAiResult(null);
    setAiMenuOpen(false);
    setAiPrompt('');
  };

  const toggleListening = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition isn't supported in your browser.");
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    
    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        if (focusedId) {
          const content = blockRefs.current[focusedId]?.textContent || '';
          updateBlock(focusedId, { content: content + ' ' + finalTranscript.trim() });
        } else {
          // If no focus, add a new block at the end
          const newBlock: Block = { id: uuidv4(), type: 'p', content: finalTranscript.trim() };
          setBlocks([...blocks, newBlock]);
        }
      }
    };
    
    recognition.start();
  };

  const toggleBlockStyleFlag = (blockId: string, flag: 'bold' | 'italic' | 'underline') => {
    setBlocks(blocks.map(b => {
      if (b.id === blockId) {
        const style = b.style || {};
        return {
          ...b,
          style: {
            ...style,
            [flag]: !style[flag]
          }
        };
      }
      return b;
    }));
  };

  const updateBlockStyleColor = (blockId: string, type: 'color' | 'backgroundColor', value: string) => {
    setBlocks(blocks.map(b => {
      if (b.id === blockId) {
        const style = b.style || {};
        return {
          ...b,
          style: {
            ...style,
            [type]: value === 'inherit' || value === 'transparent' ? undefined : value
          }
        };
      }
      return b;
    }));
  };

  const addBlockComment = (blockId: string) => {
    if (!newCommentText.trim()) return;
    const comment: BlockComment = {
      id: uuidv4(),
      author: 'Jake (You)',
      text: newCommentText.trim(),
      createdAt: Date.now()
    };
    setBlocks(blocks.map(b => {
      if (b.id === blockId) {
        return {
          ...b,
          comments: [...(b.comments || []), comment]
        };
      }
      return b;
    }));
    setNewCommentText('');
  };

  const removeBlockComment = (blockId: string, commentId: string) => {
    setBlocks(blocks.map(b => {
      if (b.id === blockId) {
        return {
          ...b,
          comments: (b.comments || []).filter(c => c.id !== commentId)
        };
      }
      return b;
    }));
  };

  const exportPageAsPdf = async () => {
    setExportingPdf(true);
    try {
      const element = document.getElementById('workspace-page-content');
      if (!element) return;
      
      const currentScrollY = window.scrollY;
      window.scrollTo(0, 0);

      // Hide handle controls, styled bars, edit tags and side dialogs for cleaner export
      const interactiveElements = document.querySelectorAll('.pdf-exclude');
      interactiveElements.forEach((el: any) => {
        el.style.opacity = '0';
        el.style.visibility = 'hidden';
      });

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: document.documentElement.classList.contains('dark') ? '#1C1C1C' : '#FFFFFF',
        scrollY: 0
      });

      // Restore elements
      interactiveElements.forEach((el: any) => {
        el.style.opacity = '';
        el.style.visibility = '';
      });
      window.scrollTo(0, currentScrollY);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 190; // margin 10mm on both sides
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 10; // Start with 10mm top margin

      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      pdf.save(`${title.replace(/\s+/g, '_') || 'Untitled_Page'}.pdf`);
    } catch (e) {
      console.error(e);
      alert('Failed to generate PDF');
    } finally {
      setExportingPdf(false);
    }
  };

  const runSpellCheck = async () => {
    if (showSpellcheck) {
      setShowSpellcheck(false);
      return;
    }

    setSpellCheckLoading(true);
    try {
      const cleanedBlocks = blocks.map(b => {
        const dummyText = b.content.replace(/<[^>]*>/g, ' ');
        return {
          id: b.id,
          content: dummyText,
          type: b.type
        };
      });

      const resp = await fetch('/api/ai/spellcheck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks: cleanedBlocks })
      });

      if (!resp.ok) {
        throw new Error('Spellcheck failed');
      }

      const data = await resp.json();
      setSpellingIssues(data.issues || []);
      setShowSpellcheck(true);
    } catch (err) {
      console.error(err);
      alert('Unable to run spellcheck right now. Please make sure Gemini API key is configured.');
    } finally {
      setSpellCheckLoading(false);
    }
  };

  const applySpellingCorrection = (blockId: string, originalWord: string, correction: string, issueId: string) => {
    setBlocks(currentBlocks => currentBlocks.map(b => {
      if (b.id === blockId) {
        let newContent = b.content;
        const cleanOriginal = originalWord.trim();
        const cleanCorrection = correction.trim();
        
        const regex = new RegExp(`\\b${cleanOriginal}\\b`, 'gi');
        if (regex.test(newContent)) {
          newContent = newContent.replace(regex, cleanCorrection);
        } else {
          newContent = newContent.replace(cleanOriginal, cleanCorrection);
        }
        
        setTimeout(() => {
          const el = blockRefs.current[blockId];
          if (el) {
            el.innerHTML = newContent;
            const fakeEvent = { currentTarget: el } as unknown as React.FormEvent<HTMLDivElement>;
            handleInput(fakeEvent, blockId);
          }
        }, 50);

        return { ...b, content: newContent };
      }
      return b;
    }));
    
    setSpellingIssues(prev => prev.filter(issue => issue.id !== issueId));
  };

  const ignoreSpellingIssue = (issueId: string) => {
    setSpellingIssues(prev => prev.filter(issue => issue.id !== issueId));
  };

  const hasSpellingError = (blockId: string) => {
    return spellingIssues.some(issue => issue.blockId === blockId);
  };

  const slashMenuActions = [
    { label: 'Text', icon: Type, type: 'p', description: 'Plain text formatting', category: 'Basic Blocks' },
    { label: 'Heading 1', icon: Hash, type: 'h1', description: 'Large section heading', category: 'Basic Blocks' },
    { label: 'Heading 2', icon: Hash, type: 'h2', description: 'Medium section heading', category: 'Basic Blocks' },
    { label: 'Heading 3', icon: Hash, type: 'h3', description: 'Small section heading', category: 'Basic Blocks' },
    { label: 'To-do list', icon: CheckSquare, type: 'todo', description: 'Task checkbox tracker', category: 'Basic Blocks' },
    { label: 'Bulleted list', icon: List, type: 'bullet', description: 'Simple bulleted list', category: 'Basic Blocks' },
    { label: 'Divider', icon: Minus, type: 'divider', description: 'Visual divider line', category: 'Basic Blocks' },
    { label: 'Quote', icon: Quote, type: 'quote', description: 'Blockquote callout text', category: 'Basic Blocks' },
    { label: 'Callout', icon: Lightbulb, type: 'callout', description: 'Lightbulb highlighted box', category: 'Basic Blocks' },
    { label: 'Code Block', icon: Code, type: 'code', description: 'Code with syntax highlighting', category: 'Basic Blocks' },
    { label: 'Draft with AI...', icon: Wand2, type: 'ai-custom', description: 'Ask AI to write or edit', category: 'AI Magic' },
    { label: 'AI Summary Block', icon: Sparkles, type: 'ai-summary', description: 'Prompt AI to summarize text', category: 'AI Magic' },
    { label: 'AI Draft Block', icon: Wand2, type: 'ai-draft', description: 'Draft text from prompts', category: 'AI Magic' },
    { label: 'AI Rewrite Block', icon: Edit, type: 'ai-rewrite', description: 'Prompt AI to edit or rewrite text', category: 'AI Magic' }
  ];

  const filteredSlashActions = slashMenuActions.filter(action => 
    action.label.toLowerCase().includes(slashQuery.toLowerCase()) || 
    action.description.toLowerCase().includes(slashQuery.toLowerCase())
  );

  const handleSlashAction = (action: typeof slashMenuActions[0]) => {
    if (!focusedId) return;

    // Remove the "/" and search characters typed in the DOM element
    const el = blockRefs.current[focusedId];
    if (el) {
      let text = el.innerText || '';
      const idx = text.lastIndexOf('/');
      if (idx !== -1) {
        text = text.substring(0, idx);
      }
      el.innerText = text;
    }

    if (action.type === 'ai-custom') {
      setSlashMenuOpen(false);
      setAiMenuPos({ top: window.innerHeight / 3, left: window.innerWidth / 2 - 250 });
      setAiMenuOpen(true);
    } else if (action.type === 'ai-summary' || action.type === 'ai-draft' || action.type === 'ai-rewrite') {
      updateBlock(focusedId, { 
        type: action.type as BlockType, 
        content: '', 
        aiPrompt: action.type === 'ai-summary' ? 'Summarize this page or previous blocks.' : action.type === 'ai-rewrite' ? 'Rewrite the input into a professional, concise pitch.' : '',
        aiContext: '' 
      });
      setSlashMenuOpen(false);
    } else {
      updateBlock(focusedId, { type: action.type as BlockType, content: '' });
      setSlashMenuOpen(false);
    }
  };

  return (
    <div className={cn(
      "w-full px-6 sm:px-12 py-12 pb-48 font-sans text-lg text-[#37352F] dark:text-[#E3E3E3] transition-all duration-300",
      showSpellcheck && spellingIssues.length > 0 ? "max-w-6xl mx-auto" : "max-w-3xl mx-auto"
    )}>
      {/* Top PDF and Page Panel Actions */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-[#EBEBE9] dark:border-[#2F2F2F] pdf-exclude">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 font-medium tracking-wide uppercase hidden sm:inline">MotionAI workspace</span>
          
          {/* Elegant Auto-save Badge */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#F4F4F3] dark:bg-[#1E1E1E] border border-[#EBEBE9] dark:border-[#2F2F2F] text-[10px] font-mono leading-none select-none">
            {saveStatus === 'saving' && (
              <span className="flex items-center gap-1 text-purple-650 dark:text-purple-400">
                <RefreshCw size={10} className="animate-spin" />
                <span>Saving draft...</span>
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                <span>Auto-saved {lastSavedTime}</span>
              </span>
            )}
            {saveStatus === 'dirty' && (
              <button 
                onClick={triggerManualSave}
                className="flex items-center gap-1 text-amber-600 dark:text-amber-400 hover:text-amber-700 transition-colors cursor-pointer font-bold"
                title="Unsaved modifications. Click to save now!"
              >
                <Save size={10} />
                <span>Unsaved (Save Now)</span>
              </button>
            )}
            {saveStatus === 'error' && (
              <span className="text-rose-500 font-bold flex items-center gap-1">
                <X size={10} />
                <span>Error Saving</span>
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runSpellCheck}
            disabled={spellCheckLoading}
            className={cn(
              "flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md shadow-sm transition-all cursor-pointer border",
              showSpellcheck
                ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 font-bold"
                : "bg-white hover:bg-[#F1F1F0] dark:bg-[#1E1E1E] dark:hover:bg-[#2F2F2F] border-[#EBEBE9] dark:border-[#2F2F2F] text-gray-600 dark:text-gray-300 font-medium"
            )}
            title="Check document spelling with AI helper"
          >
            {spellCheckLoading ? (
              <div className="w-3.5 h-3.5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin mr-1" />
            ) : (
              <Sparkles size={13} className={cn("transition-colors", showSpellcheck ? "text-amber-500 animate-pulse" : "text-gray-400")} />
            )}
            <span>{spellCheckLoading ? 'Analyzing...' : showSpellcheck ? 'Close Spellcheck' : 'Spellcheck'}</span>
          </button>

          <button
            onClick={exportPageAsPdf}
            disabled={exportingPdf}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition-colors cursor-pointer"
          >
            <Download size={13} />
            {exportingPdf ? 'Exporting PDF...' : 'Export to PDF'}
          </button>
        </div>
      </div>

      <div className={cn(
        "w-full",
        showSpellcheck && spellingIssues.length > 0 ? "grid grid-cols-1 lg:grid-cols-4 gap-8 items-start" : ""
      )}>
        {/* Main Document Col */}
        <div className={cn(
          "w-full",
          showSpellcheck && spellingIssues.length > 0 ? "lg:col-span-3" : ""
        )}>
          <div id="workspace-page-content" className="p-4 sm:p-6 rounded-xl">
            <input 
              type="text" 
              value={title || ''} 
              onChange={e => onTitleChange(e.target.value)}
              placeholder="Untitled"
              className="w-full text-4xl font-bold bg-transparent border-none outline-none mb-8 placeholder-[#37352f4d] dark:placeholder-[#ffffff4d] resize-none text-[#37352F] dark:text-[#E3E3E3]"
            />

            <div className="space-y-2">
          {blocks.map((block, index) => (
            <div 
              key={block.id} 
              className="relative group flex items-start -ml-6 rounded-md hover:bg-gray-50/50 dark:hover:bg-gray-800/10 transition-colors py-1 px-1"
              style={{ paddingLeft: `${((block.indentLevel || 0) * 24) + 24}px` }}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', index.toString());
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                const dragIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
                if (!isNaN(dragIndex) && dragIndex !== index && dragIndex >= 0 && dragIndex < blocks.length) {
                  const reordered = [...blocks];
                  const [moved] = reordered.splice(dragIndex, 1);
                  reordered.splice(index, 0, moved);
                  setBlocks(reordered);
                }
              }}
            >
              <div 
                className="w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-[#37352f4d] mt-1 shrink-0 pdf-exclude"
                contentEditable={false}
                title="Drag to reorder block"
              >
                <GripVertical size={16} />
              </div>
              
              <div className="flex-1 w-full min-w-0 pr-16 relative" style={{ position: 'relative' }}>
                {block.type === 'todo' && (
                  <div className="absolute left-0 top-1.5 cursor-pointer mr-2 pdf-exclude" onClick={() => updateBlock(block.id, {checked: !block.checked})}>
                    <div className={cn("w-5 h-5 border rounded-sm flex items-center justify-center transition-colors", block.checked ? "bg-[#2EAADC] border-[#2EAADC] text-white" : "border-[#EBEBE9] hover:bg-[#F1F1F0]")}>
                      {block.checked && <CheckSquare size={14} className="opacity-100" />}
                    </div>
                  </div>
                )}
                {block.type === 'bullet' && (
                  <div className="absolute left-0 top-3 w-1.5 h-1.5 bg-current rounded-full" />
                )}
                {block.type === 'divider' ? (
                  <div className="h-px w-full bg-[#EBEBE9] dark:bg-[#2F2F2F] my-4" />
                ) : block.type === 'code' ? (
                  <CodeBlock
                    block={block}
                    index={index}
                    focusedId={focusedId}
                    setFocusedId={setFocusedId}
                    updateBlock={updateBlock}
                    blocks={blocks}
                    setBlocks={setBlocks}
                    focusBlock={focusBlock}
                  />
                ) : block.type === 'ai-summary' || block.type === 'ai-draft' || block.type === 'ai-rewrite' ? (
                  <div className="w-full border border-purple-200 dark:border-purple-900/40 bg-purple-50/10 dark:bg-purple-950/5 p-4 rounded-lg my-3 space-y-3 shadow-xs">
                    {/* Header of the block */}
                    <div className="flex items-center justify-between text-xs pb-2 border-b border-purple-100 dark:border-purple-900/20 pdf-exclude select-none">
                      <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 font-bold">
                        <Sparkles size={14} className={blockLoadingMap[block.id] ? "animate-spin" : "animate-pulse"} />
                        <span className="uppercase tracking-wider">
                          {block.type === 'ai-summary' && 'AI Summary Block'}
                          {block.type === 'ai-draft' && 'AI Draft Block'}
                          {block.type === 'ai-rewrite' && 'AI Rewrite Block'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[#37352f8c] dark:text-gray-400 font-bold">
                        <button 
                          onClick={() => setComposerBlockId(block.id)}
                          className="hover:text-purple-650 dark:hover:text-purple-400 text-purple-600 dark:text-purple-500 transition-colors px-1.5 py-0.5 rounded hover:bg-purple-100/30 text-[10px] flex items-center gap-0.5 font-bold cursor-pointer"
                          title="Open dedicated modal workspace context composer"
                        >
                          <Maximize2 size={10} />
                          <span>AI Workspace</span>
                        </button>
                        <button 
                          onClick={() => updateBlock(block.id, { type: 'p' })}
                          className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors px-1.5 py-0.5 rounded hover:bg-purple-100/30 text-[10px] cursor-pointer"
                          title="Convert to normal text block"
                        >
                          Convert to Text
                        </button>
                        <button 
                          onClick={() => setBlocks(prev => prev.filter(b => b.id !== block.id))}
                          className="hover:text-red-500 transition-colors px-1.5 py-0.5 rounded hover:bg-red-50 text-[10px] cursor-pointer"
                          title="Delete block"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {blockLoadingMap[block.id] ? (
                      <div className="space-y-3 py-2 pdf-exclude">
                        <div className="h-4 bg-purple-100 dark:bg-purple-900/30 rounded w-3/4 animate-pulse" />
                        <div className="h-4 bg-purple-50 dark:bg-purple-900/20 rounded w-full animate-pulse" />
                        <div className="h-4 bg-purple-50 dark:bg-purple-900/20 rounded w-5/6 animate-pulse" />
                        <div className="h-4 bg-purple-50 dark:bg-purple-900/20 rounded w-2/3 animate-pulse" />
                        <div className="flex items-center gap-2 mt-2">
                           <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                           <span className="text-xs text-purple-600 dark:text-purple-455 font-medium">AI is generating structured content...</span>
                        </div>
                      </div>
                    ) : block.content ? (
                      <div className="space-y-3">
                        <div
                          ref={el => blockRefs.current[block.id] = el}
                          contentEditable
                          suppressContentEditableWarning
                          onKeyDown={e => handleKeyDown(e, index)}
                          onInput={e => handleInput(e, block.id)}
                          onFocus={() => setFocusedId(block.id)}
                          className="outline-none min-h-[1.5em] break-words leading-relaxed max-w-full font-sans text-sm p-1 rounded transition-all dark:text-gray-200"
                          style={{
                            color: block.style?.color || undefined,
                            backgroundColor: block.style?.backgroundColor || undefined,
                            fontWeight: block.style?.bold ? 'bold' : undefined,
                            fontStyle: block.style?.italic ? 'italic' : undefined,
                            textDecoration: block.style?.underline ? 'underline' : undefined,
                          }}
                          dangerouslySetInnerHTML={{ __html: block.content }}
                        />
                        
                        <div className="flex items-center gap-2 pt-1 border-t border-[#EBEBE9]/50 dark:border-[#2F2F2F] text-[11px] pdf-exclude select-none">
                          <button 
                            onClick={() => updateBlock(block.id, { content: '' })}
                            className="flex items-center gap-1 text-purple-600 dark:text-purple-400 hover:bg-purple-100/30 px-2 py-1 rounded cursor-pointer font-bold"
                          >
                            <Wand2 size={12} />
                            Regenerate...
                          </button>
                          <button 
                            onClick={() => updateBlock(block.id, { type: 'p' })}
                            className="text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 px-2 py-1 rounded cursor-pointer font-semibold"
                          >
                            Accept & Merge
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4 pdf-exclude">
                        {block.type === 'ai-summary' && (
                          <div className="space-y-3">
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <label className="block text-[11px] font-bold text-purple-650 dark:text-purple-400 uppercase tracking-wider">Text context to Summarize</label>
                                <button
                                  onClick={() => setComposerBlockId(block.id)}
                                  className="text-[10px] text-purple-600 dark:text-purple-400 font-bold hover:underline transition-all flex items-center gap-1 cursor-pointer"
                                >
                                  <Maximize2 size={10} /> Full-Screen Workspace
                                </button>
                              </div>
                              <textarea
                                className="w-full text-xs p-2.5 bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-[#2F2F2F] outline-none rounded-lg resize-y min-h-[75px] text-[#37352F] dark:text-gray-200 focus:ring-1 focus:ring-purple-250 transition-all font-sans leading-relaxed"
                                placeholder="Paste text context here, or compose in full-screen AI Workspace..."
                                value={block.aiContext || ''}
                                onChange={e => updateBlock(block.id, { aiContext: e.target.value })}
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    const allText = blocks
                                      .filter(b => b.id !== block.id && b.content && b.content.trim() && b.type !== 'divider')
                                      .map(b => b.content.replace(/<[^>]*>/g, '').trim())
                                      .join('\n\n');
                                    updateBlock(block.id, { aiContext: allText });
                                  }}
                                  className="text-[10px] text-purple-600 dark:text-purple-400 hover:text-purple-700 bg-purple-50 dark:bg-purple-950/20 hover:bg-purple-100/30 font-bold px-2 py-1 rounded transition-colors cursor-pointer"
                                >
                                  📥 Use all page content
                                </button>
                              </div>
                            </div>

                            <div className="space-y-1.5 pt-1.5 border-t border-[#EBEBE9]/40 dark:border-[#2F2F2F]/40">
                              <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-550 uppercase tracking-wider">Summary style rules (optional)</label>
                              <textarea
                                className="w-full text-xs p-2.5 bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-[#2F2F2F] outline-none rounded-lg resize-y min-h-[50px] text-[#37352F] dark:text-gray-200 focus:ring-1 focus:ring-purple-250 transition-all font-sans font-semibold placeholder:font-normal"
                                placeholder="e.g. Keep under 100 words, use bulleted lists, highlight names..."
                                value={block.aiPrompt || ''}
                                onChange={e => updateBlock(block.id, { aiPrompt: e.target.value })}
                              />
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {INLINE_AI_PRESETS['ai-summary'].map((p) => (
                                  <button
                                    key={p.label}
                                    onClick={() => updateBlock(block.id, { aiPrompt: p.prompt })}
                                    className="text-[10px] bg-[#F4F4F3] dark:bg-[#252525] text-gray-700 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 font-bold px-2 py-0.5 rounded border border-dashed border-[#EBEBE9] dark:border-[#2F2F2F] transition-all cursor-pointer"
                                  >
                                    {p.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {block.type === 'ai-draft' && (
                          <div className="space-y-3">
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <label className="block text-[11px] font-bold text-purple-650 dark:text-purple-400 uppercase tracking-wider">What should the AI draft?</label>
                                <button
                                  onClick={() => setComposerBlockId(block.id)}
                                  className="text-[10px] text-purple-600 dark:text-purple-400 font-bold hover:underline transition-all flex items-center gap-1 cursor-pointer"
                                >
                                  <Maximize2 size={10} /> Full-Screen Workspace
                                </button>
                              </div>
                              <textarea
                                className="w-full text-xs p-2.5 bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-[#2F2F2F] outline-none rounded-lg resize-y min-h-[55px] text-[#37352F] dark:text-gray-200 focus:ring-1 focus:ring-purple-250 font-semibold placeholder:font-normal leading-relaxed"
                                placeholder="e.g. A meeting agenda for project launch, a blog post outline on Docker..."
                                value={block.aiPrompt || ''}
                                onChange={e => updateBlock(block.id, { aiPrompt: e.target.value })}
                              />
                              <div className="flex flex-wrap gap-1.5 pt-0.5">
                                {INLINE_AI_PRESETS['ai-draft'].map((p) => (
                                  <button
                                    key={p.label}
                                    onClick={() => updateBlock(block.id, { aiPrompt: p.prompt })}
                                    className="text-[10px] bg-[#F4F4F3] dark:bg-[#252525] text-gray-700 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 font-bold px-2 py-0.5 rounded border border-dashed border-[#EBEBE9] dark:border-[#2F2F2F] transition-all cursor-pointer"
                                  >
                                    {p.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-550 uppercase tracking-wider">Context or details (optional)</label>
                              <textarea
                                className="w-full text-xs p-2.5 bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-[#2F2F2F] outline-none rounded-lg resize-y min-h-[50px] text-[#37352F] dark:text-gray-200 focus:ring-1 focus:ring-purple-250 transition-all font-sans"
                                placeholder="Provide context, keywords, outlines, tone guidelines..."
                                value={block.aiContext || ''}
                                onChange={e => updateBlock(block.id, { aiContext: e.target.value })}
                              />
                            </div>
                          </div>
                        )}

                        {block.type === 'ai-rewrite' && (
                          <div className="space-y-3">
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <label className="block text-[11px] font-bold text-purple-650 dark:text-purple-400 uppercase tracking-wider">Text to Rewrite</label>
                                <button
                                  onClick={() => setComposerBlockId(block.id)}
                                  className="text-[10px] text-purple-600 dark:text-purple-400 font-bold hover:underline transition-all flex items-center gap-1 cursor-pointer"
                                >
                                  <Maximize2 size={10} /> Full-Screen Workspace
                                </button>
                              </div>
                              <textarea
                                className="w-full text-xs p-2.5 bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-[#2F2F2F] outline-none rounded-lg resize-y min-h-[60px] text-[#37352F] dark:text-gray-200 focus:ring-1 focus:ring-purple-250 font-sans leading-relaxed"
                                placeholder="Paste the target sentence or paragraph to rewrite..."
                                value={block.aiContext || ''}
                                onChange={e => updateBlock(block.id, { aiContext: e.target.value })}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-550 uppercase tracking-wider">How should it be rewritten?</label>
                              <textarea
                                className="w-full text-xs p-2.5 bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-[#2F2F2F] outline-none rounded-lg resize-y min-h-[55px] text-[#37352F] dark:text-gray-200 focus:ring-1 focus:ring-purple-250 font-semibold placeholder:font-normal leading-relaxed"
                                placeholder="e.g. More professional, clear & concise, explain to a beginner..."
                                value={block.aiPrompt || ''}
                                onChange={e => updateBlock(block.id, { aiPrompt: e.target.value })}
                              />
                              <div className="flex flex-wrap gap-1.5 pt-0.5">
                                {INLINE_AI_PRESETS['ai-rewrite'].map((p) => (
                                  <button
                                    key={p.label}
                                    onClick={() => updateBlock(block.id, { aiPrompt: p.prompt })}
                                    className="text-[10px] bg-[#F4F4F3] dark:bg-[#252525] text-gray-700 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 font-bold px-2 py-0.5 rounded border border-dashed border-[#EBEBE9] dark:border-[#2F2F2F] transition-all cursor-pointer"
                                  >
                                    {p.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Action Trigger Row */}
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#EBEBE9] dark:border-[#2F2F2F]">
                          <button
                            onClick={() => setComposerBlockId(block.id)}
                            className="flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-100/10 px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer border border-[#EBEBE9]/50 dark:border-[#2F2F2F]"
                            title="Open extensive fullscreen layout"
                          >
                            <Maximize2 size={11} />
                            <span>Full-Screen Workspace</span>
                          </button>
                          
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateBlock(block.id, { type: 'p' })}
                              className="px-3 py-1.5 text-xs text-[#37352f8c] dark:text-gray-400 hover:bg-gray-150 dark:hover:bg-gray-800 rounded-lg transition-all font-semibold cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={async () => {
                                await generateContentForBlock(block.id);
                              }}
                              disabled={
                                block.type === 'ai-summary' ? !(block.aiContext?.trim()) :
                                block.type === 'ai-draft' ? !(block.aiPrompt?.trim()) :
                                !(block.aiContext?.trim() && block.aiPrompt?.trim())
                              }
                              className="flex items-center gap-1 px-3.5 py-1.5 text-xs bg-purple-650 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg font-bold transition-all shadow-xs cursor-pointer"
                            >
                              <Sparkles size={11} />
                              Generate Content
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    ref={el => blockRefs.current[block.id] = el}
                    contentEditable
                    spellCheck={true}
                    suppressContentEditableWarning
                    onKeyDown={e => handleKeyDown(e, index)}
                    onInput={e => handleInput(e, block.id)}
                    onPaste={e => handlePaste(e, index, block.id)}
                    onFocus={() => setFocusedId(block.id)}
                    className={cn(
                      "outline-none min-h-[1.5em] empty:before:content-[attr(data-placeholder)] empty:before:text-[#37352f33] dark:empty:before:text-[#ffffff33] empty:before:pointer-events-none break-words leading-relaxed max-w-full p-1 rounded transition-all",
                      showSpellcheck && hasSpellingError(block.id) && "ring-1 ring-amber-300 dark:ring-amber-800/40 bg-amber-50/10 dark:bg-amber-950/10 border-l-2 border-l-amber-500 dark:border-l-amber-400 pl-2",
                      block.type === 'h1' && "text-3xl font-bold mt-6 mb-3",
                      block.type === 'h2' && "text-2xl font-semibold mt-5 mb-2",
                      block.type === 'h3' && "text-xl font-semibold mt-4 mb-1",
                      block.type === 'quote' && "border-l-[3px] border-[#37352F] dark:border-gray-300 pl-4 py-1 text-lg my-4",
                      block.type === 'callout' && "bg-[#F1F1F0] dark:bg-[#2F2F2F] p-4 pr-4 pl-12 rounded flex items-start text-lg my-2 relative before:content-['💡'] before:absolute before:left-4",
                      (block.type === 'todo' || block.type === 'bullet') && "pl-8",
                      block.type === 'todo' && block.checked && "line-through text-[#37352f7a] dark:text-gray-500"
                    )}
                    style={{ 
                      whiteSpace: 'pre-wrap',
                      color: block.style?.color || undefined,
                      backgroundColor: block.style?.backgroundColor || undefined,
                      fontWeight: block.style?.bold ? 'bold' : undefined,
                      fontStyle: block.style?.italic ? 'italic' : undefined,
                      textDecoration: block.style?.underline ? 'underline' : undefined,
                    }}
                    data-placeholder={focusedId === block.id && block.type === 'p' ? "Press '/' for commands..." : ""}
                    dangerouslySetInnerHTML={{ __html: block.content }}
                  />
                )}

                {/* Floating Gutter Icons for Block Formatting (Style & Comments) */}
                <div className="absolute right-0 top-1 flex items-center gap-1.5 opacity-60 md:opacity-0 group-hover:opacity-100 transition-opacity pdf-exclude z-10">
                  {/* Bold Toggle Button */}
                  <button
                    onClick={() => toggleBlockStyleFlag(block.id, 'bold')}
                    className={cn(
                      "p-1.5 hover:bg-[#F1F1F0] dark:hover:bg-[#2F2F2F] rounded text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 cursor-pointer border border-transparent transition-all",
                      block.style?.bold && "text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-950/20 font-bold border-purple-300 dark:border-purple-800"
                    )}
                    title="Toggle Bold Style for Block"
                  >
                    <Bold size={13} />
                  </button>

                  {/* Comments Toggle */}
                  <button
                    onClick={() => {
                      setActiveCommentBlockId(activeCommentBlockId === block.id ? null : block.id);
                      setActiveStyleBlockId(null);
                    }}
                    className={cn(
                      "p-1.5 hover:bg-[#F1F1F0] dark:hover:bg-[#2F2F2F] rounded text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 cursor-pointer flex items-center gap-1 text-[10px]",
                      (block.comments?.length || 0) > 0 && "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/20 font-bold px-2 rounded-full border border-purple-200"
                    )}
                    title="Comments"
                  >
                    <MessageCircle size={13} />
                    {(block.comments?.length || 0) > 0 && <span>{block.comments?.length}</span>}
                  </button>

                  {/* Aesthetic Formatter Toggle */}
                  <button
                    onClick={() => {
                      setActiveStyleBlockId(activeStyleBlockId === block.id ? null : block.id);
                      setActiveCommentBlockId(null);
                    }}
                    className={cn(
                      "p-1.5 hover:bg-[#F1F1F0] dark:hover:bg-[#2F2F2F] rounded text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer border border-transparent",
                      activeStyleBlockId === block.id && "border-[#EBEBE9] dark:border-[#2F2F2F] bg-white dark:bg-[#1C1C1C] text-indigo-500"
                    )}
                    title="Block color & typography"
                  >
                    <Palette size={13} />
                  </button>
                </div>

                {/* POPUP: Format options */}
                {activeStyleBlockId === block.id && (
                  <div className="absolute right-0 top-8 bg-white dark:bg-[#252525] border border-[#EBEBE9] dark:border-[#2F2F2F] rounded-lg shadow-lg p-3 z-30 w-72 text-xs text-[#37352F] dark:text-gray-200 pdf-exclude">
                    <div className="flex items-center justify-between mb-2 pb-1 border-b border-[#EBEBE9] dark:border-[#2F2F2F]">
                      <span className="font-bold uppercase tracking-wider text-[10px] text-gray-400">Block Styling</span>
                      <button onClick={() => setActiveStyleBlockId(null)} className="text-gray-400 hover:text-gray-600"><X size={12} /></button>
                    </div>

                    {/* Font format triggers */}
                    <div className="flex gap-1 mb-3">
                      <button
                        onClick={() => toggleBlockStyleFlag(block.id, 'bold')}
                        className={cn("p-1.5 rounded border transition-colors flex-1 flex justify-center", block.style?.bold ? "bg-purple-100 border-purple-300 text-purple-700 font-bold" : "border-[#EBEBE9] dark:border-[#373737] hover:bg-gray-50 dark:hover:bg-gray-800")}
                      >
                        <Bold size={13} />
                      </button>
                      <button
                        onClick={() => toggleBlockStyleFlag(block.id, 'italic')}
                        className={cn("p-1.5 rounded border transition-colors flex-1 flex justify-center", block.style?.italic ? "bg-purple-100 border-purple-300 text-purple-700 font-bold" : "border-[#EBEBE9] dark:border-[#373737] hover:bg-gray-50 dark:hover:bg-gray-800")}
                      >
                        <Italic size={13} />
                      </button>
                      <button
                        onClick={() => toggleBlockStyleFlag(block.id, 'underline')}
                        className={cn("p-1.5 rounded border transition-colors flex-1 flex justify-center", block.style?.underline ? "bg-purple-100 border-purple-300 text-purple-700 font-bold" : "border-[#EBEBE9] dark:border-[#373737] hover:bg-gray-50 dark:hover:bg-gray-800")}
                      >
                        <Underline size={13} />
                      </button>
                    </div>

                    {/* Color selection layout grid */}
                    <div className="space-y-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Text Color</span>
                        <div className="grid grid-cols-5 gap-1.5">
                          {TEXT_COLORS.map(c => (
                            <button
                              key={c.name}
                              onClick={() => updateBlockStyleColor(block.id, 'color', c.value)}
                              className="w-6 h-6 rounded-full border border-gray-200 dark:border-gray-700 cursor-pointer flex items-center justify-center text-[9px] relative hover:scale-105 transition-transform"
                              style={{ backgroundColor: c.value === 'inherit' ? '#37352F' : c.value }}
                              title={c.name}
                            >
                              {block.style?.color === c.value && <Check size={11} className="text-white mix-blend-difference" />}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Background Color</span>
                        <div className="grid grid-cols-5 gap-1.5">
                          {BG_COLORS.map(bg => (
                            <button
                              key={bg.name}
                              onClick={() => updateBlockStyleColor(block.id, 'backgroundColor', bg.value)}
                              className="w-6 h-6 rounded border border-gray-200 dark:border-gray-700 cursor-pointer flex items-center justify-center text-[9px] hover:scale-105 transition-transform"
                              style={{ backgroundColor: bg.value }}
                              title={bg.name}
                            >
                              {block.style?.backgroundColor === bg.value && <Check size={11} className="text-black" />}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Transform to AI Block */}
                      <div className="pt-2.5 border-t border-[#EBEBE9] dark:border-[#2F2F2F] mt-1.5">
                        <span className="text-[10px] uppercase font-bold text-purple-600 dark:text-purple-400 block mb-1">⚡ AI Conversion Tools</span>
                        <div className="flex flex-col gap-0.5">
                          <button
                            onClick={() => {
                              updateBlock(block.id, { 
                                type: 'ai-summary', 
                                aiContext: block.content ? block.content.replace(/<[^>]*>/g, '') : '',
                                aiPrompt: 'Provide a tidy, structured summary of the content below.' 
                              });
                              setActiveStyleBlockId(null);
                            }}
                            className="flex items-center gap-1.5 w-full text-left p-1 rounded hover:bg-purple-50 dark:hover:bg-purple-950/20 text-purple-750 dark:text-purple-400 font-semibold transition-colors cursor-pointer"
                          >
                            <Sparkles size={11} />
                            <span>Convert to AI Summary Block</span>
                          </button>
                          <button
                            onClick={() => {
                              updateBlock(block.id, { 
                                type: 'ai-draft', 
                                aiPrompt: block.content ? block.content.replace(/<[^>]*>/g, '') : '',
                                aiContext: '' 
                              });
                              setActiveStyleBlockId(null);
                            }}
                            className="flex items-center gap-1.5 w-full text-left p-1 rounded hover:bg-purple-50 dark:hover:bg-purple-950/20 text-purple-750 dark:text-purple-400 font-semibold transition-colors cursor-pointer"
                          >
                            <Wand2 size={11} />
                            <span>Convert to AI Draft Block</span>
                          </button>
                          <button
                            onClick={() => {
                              updateBlock(block.id, { 
                                type: 'ai-rewrite', 
                                aiContext: block.content ? block.content.replace(/<[^>]*>/g, '') : '',
                                aiPrompt: 'Make this content professional and clearer.' 
                              });
                              setActiveStyleBlockId(null);
                            }}
                            className="flex items-center gap-1.5 w-full text-left p-1 rounded hover:bg-purple-50 dark:hover:bg-purple-950/20 text-purple-750 dark:text-purple-400 font-semibold transition-colors cursor-pointer"
                          >
                            <Edit size={11} />
                            <span>Convert to AI Rewrite Block</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* POPUP: Comments dialog */}
                {activeCommentBlockId === block.id && (
                  <div className="absolute right-0 top-8 bg-white dark:bg-[#252525] border border-[#EBEBE9] dark:border-[#2F2F2F] rounded-lg shadow-lg p-3.5 z-30 w-72 text-xs text-[#37352F] dark:text-gray-200 pdf-exclude">
                    <div className="flex items-center justify-between mb-2 pb-1 border-b border-[#EBEBE9] dark:border-[#2F2F2F]">
                      <span className="font-bold uppercase tracking-wider text-[10px] text-purple-600">Block Comments</span>
                      <button onClick={() => setActiveCommentBlockId(null)} className="text-gray-400 hover:text-gray-650"><X size={12} /></button>
                    </div>

                    <div className="max-h-40 overflow-y-auto space-y-2 mb-3 pr-1 leading-normal">
                      {(!block.comments || block.comments.length === 0) ? (
                        <div className="text-gray-400 italic text-[11px] py-4 text-center">No comments yet. Add a quick note below!</div>
                      ) : (
                        block.comments.map(comment => (
                          <div key={comment.id} className="p-2 bg-gray-50 dark:bg-gray-800/40 rounded border border-gray-100 dark:border-gray-800/60 relative group/comment">
                            <div className="flex items-center justify-between pointer-events-none">
                              <span className="font-semibold text-[10px] text-indigo-600">{comment.author}</span>
                              <span className="text-[8px] text-gray-400">{new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p className="text-[11px] mt-0.5 text-gray-600 dark:text-gray-200">{comment.text}</p>
                            <button
                              onClick={() => removeBlockComment(block.id, comment.id)}
                              className="absolute right-1 top-1 text-red-400 hover:text-red-500 cursor-pointer opacity-0 group-hover/comment:opacity-100 transition-opacity"
                              title="Delete comment"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="flex gap-1.5 items-center">
                      <input
                        type="text"
                        value={newCommentText}
                        onChange={e => setNewCommentText(e.target.value)}
                        placeholder="Add comment..."
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            addBlockComment(block.id);
                          }
                        }}
                        className="flex-1 bg-[#F1F1F0] dark:bg-[#1E1E1E] rounded text-[11px] px-2.5 py-1.5 outline-none border border-transparent focus:border-purple-300 text-[#37352F] dark:text-gray-200"
                      />
                      <button
                        onClick={() => addBlockComment(block.id)}
                        className="p-1 px-3 bg-purple-600 hover:bg-purple-750 text-white rounded text-[11px] font-semibold cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      </div>

      {/* AI Spellchecker Assistant Col */}
      {showSpellcheck && spellingIssues.length > 0 && (
        <div className="lg:col-span-1 bg-[#F9F9F8] dark:bg-[#1C1C1C] p-4 rounded-xl border border-[#EBEBE9] dark:border-[#2F2F2F] sticky top-4 max-h-[calc(100vh-120px)] overflow-y-auto w-full shadow-sm animate-in slide-in-from-right duration-250 pdf-exclude z-10">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#EBEBE9] dark:border-[#2F2F2F]">
            <div className="flex items-center gap-1.5">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#37352F] dark:text-[#E3E3E3]">Spelling Check</h3>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 font-mono">
              {spellingIssues.length}
            </span>
          </div>

          <p className="text-[11px] text-[#37352f8c] dark:text-gray-400 mb-3 leading-relaxed">
            Misspelled words found by AI. Click any suggestion card to apply it instantly.
          </p>

          <div className="space-y-3">
            {spellingIssues.map(issue => {
              const regexEscapedWord = issue.word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
              const parts = issue.context.split(new RegExp(`(${regexEscapedWord})`, 'gi'));
              return (
                <div 
                  key={issue.id} 
                  className="p-3 bg-white dark:bg-[#252525] rounded-l-md rounded-r-lg border border-[#EBEBE9] dark:border-[#2F2F2F] hover:border-amber-300 dark:hover:border-amber-800 transition-all shadow-xs flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-xs font-bold text-red-500 line-through truncate max-w-[140px]" title="Misspelled word">
                      {issue.word}
                    </span>
                    <button 
                      onClick={() => ignoreSpellingIssue(issue.id)}
                      className="text-gray-400 hover:text-gray-650 dark:hover:text-gray-200 p-0.5 rounded cursor-pointer shrink-0"
                      title="Ignore this spelling warning"
                    >
                      <X size={12} />
                    </button>
                  </div>

                  {issue.context && (
                    <div className="text-[11px] text-[#37352fbb] dark:text-gray-300 bg-[#F1F1F0]/50 dark:bg-[#1E1E1E]/50 px-2 py-1.5 rounded font-mono leading-normal break-words">
                      ...
                      {parts.map((part, i) => (
                        part.toLowerCase() === issue.word.toLowerCase() ? (
                          <span key={i} className="text-red-500 font-bold underline decoration-wavy bg-red-500/10 px-0.5 rounded">
                            {part}
                          </span>
                        ) : (
                          <span key={i}>{part}</span>
                        )
                      ))}
                      ...
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5 mt-1 pt-1 border-t border-gray-100 dark:border-[#2F2F2F]">
                    {issue.suggestions.map((suggestion, sIdx) => (
                      <button
                        key={sIdx}
                        onClick={() => applySpellingCorrection(issue.blockId, issue.word, suggestion, issue.id)}
                        className="text-[10px] font-medium px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 active:bg-amber-100 text-amber-800 dark:bg-amber-950/20 dark:hover:bg-amber-900/40 dark:text-amber-300 border border-amber-200/50 dark:border-amber-900/50 transition-colors cursor-pointer"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      const el = blockRefs.current[issue.blockId];
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        el.focus();
                      }
                    }}
                    className="text-[10px] text-gray-400 hover:text-gray-650 dark:hover:text-gray-300 mt-1 self-start font-medium cursor-pointer"
                  >
                    🔍 Focus block
                  </button>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => runSpellCheck()}
            className="mt-4 w-full text-center py-1.5 rounded-md border border-[#EBEBE9] dark:border-[#2F2F2F] text-[11px] text-[#37352f8c] dark:text-gray-300 hover:bg-[#F1F1F0] dark:hover:bg-[#252525] transition-colors cursor-pointer font-semibold"
          >
            Recheck Document
          </button>
        </div>
      )}

      {/* Show Spellcheck All Clear state if active and 0 issues */}
      {showSpellcheck && spellingIssues.length === 0 && (
        <div className="lg:col-span-1 bg-green-50/50 dark:bg-green-950/10 p-4 rounded-xl border border-green-200 dark:border-green-900/50 sticky top-4 w-full shadow-sm animate-in fade-in duration-200 pdf-exclude z-10 flex flex-col items-center text-center">
          <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-950/40 flex items-center justify-center text-green-600 dark:text-green-400 mb-3">
            <Check size={20} className="stroke-[3]" />
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-green-800 dark:text-green-400 mb-1 font-sans">Clear!</h3>
          <p className="text-[11px] text-green-700/80 dark:text-green-500 mb-4 leading-relaxed font-sans">
            AI proofreader found zero spelling or typo issues in this document.
          </p>
          <button
            onClick={() => setShowSpellcheck(false)}
            className="w-full text-center py-1.5 rounded-md border border-green-200 dark:border-green-900/40 text-[11px] text-green-800 dark:text-green-400 hover:bg-green-100/50 dark:hover:bg-green-950/30 transition-colors cursor-pointer font-semibold"
          >
            Close Spellchecker
          </button>
        </div>
      )}

      </div>

      {/* Slash Command Menu */}
      {slashMenuOpen && (
        <div 
          className="fixed z-50 w-[90%] max-w-[320px] bg-white dark:bg-[#1E1E1E] rounded-lg shadow-[0_4px_16px_rgba(15,15,15,0.25),0_0_0_1px_rgba(15,15,15,0.1)] border border-[#EBEBE9] dark:border-[#333333] overflow-hidden text-sm animate-in fade-in zoom-in-95 duration-100"
          style={{ 
            top: Math.max(10, slashMenuPos.top + 24), 
            left: window.innerWidth < 640 ? '5%' : Math.max(10, Math.min(slashMenuPos.left, window.innerWidth - 330)) 
          }}
        >
          {slashQuery && (
            <div className="px-3 py-1.5 text-[10px] bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 font-mono font-bold flex items-center justify-between border-b border-[#EBEBE9] dark:border-[#2F2F2F]">
              <span>FILTER: "{slashQuery.toUpperCase()}"</span>
              <span>{filteredSlashActions.length} matches</span>
            </div>
          )}
          <div className="p-1 max-h-[300px] overflow-y-auto">
            {filteredSlashActions.length === 0 ? (
              <div className="p-3 text-center text-xs text-[#37352f7a] dark:text-stone-500 font-medium">No commands found...</div>
            ) : (
              (() => {
                let lastCategory = '';
                return filteredSlashActions.map((action, actionIdx) => {
                  const showCategoryHeader = action.category !== lastCategory;
                  lastCategory = action.category;
                  const isSelected = actionIdx === slashSelectedIndex;
                  const IconComponent = action.icon;
                  
                  return (
                    <React.Fragment key={action.label}>
                      {showCategoryHeader && (
                        <div className="px-2.5 py-1 text-[10px] font-bold text-gray-400 dark:text-stone-500 uppercase tracking-widest mt-1.5 first:mt-0 pb-1">
                          {action.category}
                        </div>
                      )}
                      <button
                        className={cn(
                          "w-full flex items-center p-2 rounded text-left transition-all cursor-pointer",
                          isSelected 
                            ? "bg-[#F1F1F0] dark:bg-[#2F2F2F] ring-1 ring-purple-300 dark:ring-purple-900 border-l-4 border-purple-500" 
                            : "hover:bg-[#F1F1F0]/50 dark:hover:bg-[#252525]/30 text-stone-700 dark:text-stone-300"
                        )}
                        onClick={() => handleSlashAction(action)}
                        onMouseEnter={() => setSlashSelectedIndex(actionIdx)}
                      >
                        <div className={cn(
                          "w-10 h-10 rounded border flex items-center justify-center mr-3 flex-shrink-0 transition-colors",
                          action.category === 'AI Magic' 
                            ? "border-purple-300 dark:border-purple-900 bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400" 
                            : "border-[#EBEBE9] dark:border-[#2F2F2F] bg-white dark:bg-[#252525] text-[#37352F] dark:text-stone-250"
                        )}>
                          <IconComponent size={18} strokeWidth={1.5} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-xs text-[#37352F] dark:text-[#E3E3E3] flex items-center gap-1">
                            <span>{action.label}</span>
                            {isSelected && <span className="text-[9px] bg-purple-100 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 px-1 rounded font-mono">↵</span>}
                          </div>
                          {action.description && (
                            <div className="text-[10px] text-[#37352f7a] dark:text-stone-400 truncate leading-tight mt-0.5">{action.description}</div>
                          )}
                        </div>
                      </button>
                    </React.Fragment>
                  );
                });
              })()
            )}
          </div>
        </div>
      )}

      {/* AI Menu */}
      {aiMenuOpen && (
        <div className="fixed z-50 overflow-hidden" style={{ 
          top: Math.max(20, aiMenuPos.top), 
          left: window.innerWidth < 640 ? 10 : Math.max(10, Math.min(aiMenuPos.left, window.innerWidth - 600)),
          width: window.innerWidth < 640 ? 'calc(100% - 20px)' : 'auto'
        }}>
           <div className="w-full sm:w-[600px] bg-white rounded-lg shadow-[0_0_0_1px_rgba(15,15,15,0.05),0_8px_16px_-4px_rgba(15,15,15,0.1)] border border-[#EBEBE9] overflow-hidden z-20">
              <div className="flex items-center px-3 py-2 border-b border-[#EBEBE9] bg-[#FBFAFB]">
                 <div className="w-5 h-5 mr-2 flex items-center justify-center bg-purple-100 text-purple-600 rounded text-xs">✨</div>
                 <input 
                    autoFocus
                    className="flex-1 bg-transparent border-none outline-none text-sm placeholder-[#37352f4d]"
                    placeholder="Ask AI to write or edit..."
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter') runAiCommand('custom');
                        if (e.key === 'Escape') {
                            setAiMenuOpen(false);
                            setAiResult(null);
                        }
                    }}
                 />
                 <button onClick={() => { setAiMenuOpen(false); setAiResult(null); }} className="text-[#37352f4d] hover:text-[#37352F]">×</button>
              </div>
              
              {aiLoading ? (
                 <div className="p-4 space-y-3">
                   <div className="h-4 bg-purple-100 dark:bg-purple-900/30 rounded w-3/4 animate-pulse" />
                   <div className="h-4 bg-purple-50 dark:bg-purple-900/20 rounded w-full animate-pulse" />
                   <div className="h-4 bg-purple-50 dark:bg-purple-900/20 rounded w-5/6 animate-pulse" />
                   <div className="h-4 bg-purple-50 dark:bg-purple-900/20 rounded w-2/3 animate-pulse" />
                   <div className="flex items-center gap-2 mt-2">
                      <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-purple-600 font-medium">AI is crafting response...</span>
                   </div>
                 </div>
              ) : aiResult ? (
                 <div className="p-4">
                   <div className="text-sm text-[#37352F] mb-4 whitespace-pre-wrap max-h-60 overflow-y-auto font-sans leading-relaxed">
                     {aiResult}
                   </div>
                   <div className="flex items-center gap-2 border-t border-[#EBEBE9] pt-3">
                     <button className="px-3 py-1.5 text-sm bg-[#2EAADC] hover:bg-[#258ab5] text-white font-medium rounded transition-colors" onClick={() => handleAiAction('insert')}>Insert below</button>
                     {selectedText && (
                       <button className="px-3 py-1.5 text-sm bg-[#F1F1F0] hover:bg-[#EBEBE9] text-[#37352F] font-medium rounded transition-colors" onClick={() => handleAiAction('replace')}>Replace selection</button>
                     )}
                     <button className="px-3 py-1.5 text-sm text-[#37352f8c] hover:text-[#37352F] font-medium rounded transition-colors ml-auto" onClick={() => handleAiAction('discard')}>Discard</button>
                   </div>
                 </div>
              ) : (
                <div className="p-1">
                     {selectedText && (
                       <div className="mb-2 bg-gradient-to-r from-purple-50/70 to-purple-50/40 dark:from-purple-950/20 dark:to-purple-950/10 p-2 rounded-lg border border-purple-100 dark:border-purple-900/40">
                         <div className="px-2 py-1 text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase tracking-widest flex items-center justify-between">
                           <span>✨ Selection Quick Tools</span>
                           <span className="text-[9px] bg-purple-100 dark:bg-purple-900/40 text-purple-850 dark:text-purple-255 px-1.5 py-0.5 rounded font-mono font-bold">
                             {selectedText.length} chars
                           </span>
                         </div>
                         <div className="space-y-1 mt-1.5">
                           <button 
                             className="w-full text-left px-2 py-1.5 text-xs hover:bg-white dark:hover:bg-[#151515] hover:shadow-xs text-[#37352F] dark:text-gray-200 cursor-pointer rounded flex items-center justify-between font-semibold border border-transparent hover:border-purple-200/50 dark:hover:border-purple-900/30 group transition-all" 
                             onClick={() => runAiCommand('summarize')}
                           >
                             <div className="flex items-center gap-2">
                               <MessageSquare size={13} className="text-purple-600 group-hover:scale-110 transition-transform"/> 
                               <span>📝 Summarize Selection</span>
                             </div>
                             <span className="text-[9px] text-[#37352f55] dark:text-gray-400">Run AI</span>
                           </button>
                           <button 
                             className="w-full text-left px-2 py-1.5 text-xs hover:bg-white dark:hover:bg-[#151515] hover:shadow-xs text-[#37352F] dark:text-gray-200 cursor-pointer rounded flex items-center justify-between font-semibold border border-transparent hover:border-purple-200/50 dark:hover:border-purple-900/30 group transition-all" 
                             onClick={() => runAiCommand('custom', 'Rewrite this specific selected text to be clearer, more elegant, and grammatically perfect:')}
                           >
                             <div className="flex items-center gap-2">
                               <Edit size={13} className="text-purple-650 group-hover:scale-110 transition-transform"/> 
                               <span>✍️ Rewrite Selection</span>
                             </div>
                             <span className="text-[9px] text-[#37352f55] dark:text-gray-400">Run AI</span>
                           </button>
                           <button 
                             className="w-full text-left px-2 py-1.5 text-xs hover:bg-white dark:hover:bg-[#151515] hover:shadow-xs text-[#37352F] dark:text-gray-200 cursor-pointer rounded flex items-center justify-between font-semibold border border-transparent hover:border-purple-200/50 dark:hover:border-purple-900/30 group transition-all" 
                             onClick={() => runAiCommand('improve')}
                           >
                             <div className="flex items-center gap-2">
                               <Sparkles size={13} className="text-amber-500 group-hover:scale-110 transition-transform"/> 
                               <span>🪄 Improve & Polish Selection</span>
                             </div>
                             <span className="text-[9px] text-[#37352f55] dark:text-gray-400">Run AI</span>
                           </button>
                           <button 
                             className="w-full text-left px-2 py-1.5 text-xs hover:bg-white dark:hover:bg-[#151515] hover:shadow-xs text-[#37352F] dark:text-gray-200 cursor-pointer rounded flex items-center justify-between font-semibold border border-transparent hover:border-purple-200/50 dark:hover:border-purple-900/30 group transition-all" 
                             onClick={() => runAiCommand('custom', 'Explain this highlighted word, concept or phrase in simple, clear terms, highlighting key concepts:')}
                           >
                             <div className="flex items-center gap-2">
                               <Lightbulb size={13} className="text-yellow-500 group-hover:scale-110 transition-transform"/> 
                               <span>💡 Explain Selection Context</span>
                              </div>
                              <span className="text-[9px] text-[#37352f55] dark:text-gray-400">Run AI</span>
                            </button>

                            {focusedId && (
                              <div className="pt-1.5 border-t border-purple-200/50 dark:border-purple-900/30 mt-1 space-y-1 pdf-exclude">
                                <span className="px-2 py-0.5 text-[9px] font-bold text-slate-400 dark:text-gray-400 block uppercase tracking-wider">Style Focused Block</span>
                                <div className="flex gap-1 px-2 pb-1.55">
                                  <button 
                                    onClick={() => toggleBlockStyleFlag(focusedId, 'bold')}
                                    className={cn(
                                      "flex-1 py-1 px-1.5 rounded border text-[10px] font-bold flex items-center justify-center gap-0.5 transition-all cursor-pointer",
                                      blocks.find(b => b.id === focusedId)?.style?.bold 
                                        ? "bg-purple-100 dark:bg-purple-950/40 border-purple-300 text-purple-700 dark:text-purple-300 font-bold" 
                                        : "border-[#EBEBE9] dark:border-[#2F2F2F] text-[#37352F] dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                                    )}
                                  >
                                    <Bold size={11} className="stroke-[2.5]" />
                                    <span>Bold Block</span>
                                  </button>
                                  <button 
                                    onClick={() => toggleBlockStyleFlag(focusedId, 'italic')}
                                    className={cn(
                                      "flex-1 py-1 px-1.5 rounded border text-[10px] font-bold flex items-center justify-center gap-0.5 transition-all cursor-pointer",
                                      blocks.find(b => b.id === focusedId)?.style?.italic 
                                        ? "bg-purple-100 dark:bg-purple-950/40 border-purple-300 text-purple-700 dark:text-purple-355 font-bold" 
                                        : "border-[#EBEBE9] dark:border-[#2F2F2F] text-[#37352F] dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                                    )}
                                  >
                                    <Italic size={11} className="stroke-[2.5]" />
                                    <span>Italic</span>
                                  </button>
                                  <button 
                                    onClick={() => toggleBlockStyleFlag(focusedId, 'underline')}
                                    className={cn(
                                      "flex-1 py-1 px-1.5 rounded border text-[10px] font-bold flex items-center justify-center gap-0.5 transition-all cursor-pointer",
                                      blocks.find(b => b.id === focusedId)?.style?.underline 
                                        ? "bg-purple-100 dark:bg-purple-950/40 border-purple-300 text-purple-700 dark:text-purple-300 font-bold" 
                                        : "border-[#EBEBE9] dark:border-[#2F2F2F] text-[#37352F] dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                                    )}
                                  >
                                    <Underline size={11} className="stroke-[2.5]" />
                                    <span>Underline</span>
                                  </button>
                                </div>
                                <span className="px-2 py-0.5 text-[9px] font-bold text-purple-700/60 dark:text-purple-400 block uppercase tracking-wider">Convert Block Type</span>
                                <button 
                                  className="w-full text-left px-2 py-1.5 text-xs hover:bg-white dark:hover:bg-[#151515] hover:shadow-xs text-[#37352F] dark:text-gray-200 cursor-pointer rounded flex items-center justify-between font-semibold border border-transparent hover:border-purple-200/50 dark:hover:border-purple-900/30 group transition-all" 
                                  onClick={() => convertFocusedBlock('ai-summary')}
                                >
                                  <div className="flex items-center gap-2">
                                    <Sparkles size={11} className="text-purple-600 group-hover:rotate-12 transition-transform"/> 
                                    <span>✨ Convert Block to AI Summary</span>
                                  </div>
                                  <span className="text-[9px] bg-purple-100 dark:bg-purple-900/40 text-purple-650 dark:text-purple-400 px-1 rounded font-mono font-bold">Block</span>
                                </button>
                                <button 
                                  className="w-full text-left px-2 py-1.5 text-xs hover:bg-white dark:hover:bg-[#151515] hover:shadow-xs text-[#37352F] dark:text-gray-200 cursor-pointer rounded flex items-center justify-between font-semibold border border-transparent hover:border-purple-200/50 dark:hover:border-purple-900/30 group transition-all" 
                                  onClick={() => convertFocusedBlock('ai-draft')}
                                >
                                  <div className="flex items-center gap-2">
                                    <Wand2 size={11} className="text-purple-600 group-hover:rotate-12 transition-transform"/> 
                                    <span>🪄 Convert Block to AI Draft</span>
                                  </div>
                                  <span className="text-[9px] bg-purple-100 dark:bg-purple-900/40 text-purple-650 dark:text-purple-400 px-1 rounded font-mono font-bold">Block</span>
                                </button>
                                <button 
                                  className="w-full text-left px-2 py-1.5 text-xs hover:bg-white dark:hover:bg-[#151515] hover:shadow-xs text-[#37352F] dark:text-gray-200 cursor-pointer rounded flex items-center justify-between font-semibold border border-transparent hover:border-purple-200/50 dark:hover:border-purple-900/30 group transition-all" 
                                  onClick={() => convertFocusedBlock('ai-rewrite')}
                                >
                                  <div className="flex items-center gap-2">
                                    <Edit size={11} className="text-purple-600 group-hover:rotate-12 transition-transform"/> 
                                    <span>✍️ Convert Block to AI Rewrite</span>
                                  </div>
                                  <span className="text-[9px] bg-purple-100 dark:bg-purple-900/40 text-purple-650 dark:text-purple-400 px-1 rounded font-mono font-bold">Block</span>
                                </button>
                              </div>
                            )}
                            <button className="hidden">
                              <div>
                                <span>💡 Explain Selection Context</span>
                             </div>
                             <span className="text-[9px] text-[#37352f55] dark:text-gray-400">Run AI</span>
                           </button>
                         </div>
                       </div>
                     )}
                    <div className="px-2 py-1.5 text-[11px] font-bold text-[#37352f7a] uppercase tracking-wider">AI Actions</div>
                    <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-[#F1F1F0] cursor-pointer rounded flex items-center gap-2" onClick={() => runAiCommand('improve')}><Sparkles size={16} className="opacity-60"/> <span>Improve writing</span></button>
                     <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-[#F1F1F0] cursor-pointer rounded flex items-center gap-2" onClick={() => runAiCommand('custom', 'Translate this text into Spanish (or specified language):')}><Languages size={15} className="opacity-60 text-orange-500" /> <span>Translate text</span></button>
                     <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-[#F1F1F0] cursor-pointer rounded flex items-center gap-2" onClick={() => runAiCommand('custom', 'Rewrite this paragraph to be more professional and clear:')}><Edit size={15} className="opacity-60 text-indigo-500" /> <span>Rewrite text</span></button>
                     <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-[#F1F1F0] cursor-pointer rounded flex items-center gap-2" onClick={() => runAiCommand('custom', 'Fix spelling and grammar mistakes in this text, keeping the tone the same:')}><CheckSquare size={15} className="opacity-60 text-teal-500" /> <span>Check grammar</span></button>
                     <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-purple-50 text-purple-600 dark:text-purple-400 font-semibold cursor-pointer rounded flex items-center gap-2 border-t border-[#EBEBE9] mt-1" onClick={() => setWorkspaceModalOpen(true)}><Compass size={15} className="opacity-80 stroke-[2.5]" /> <span>Send to Google Workspace Event/Task</span></button>
                    <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-[#F1F1F0] cursor-pointer rounded flex items-center gap-2" onClick={() => runAiCommand('summarize')}><MessageSquare size={16} className="opacity-60"/> <span>Summarize</span></button>
                    <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-[#F1F1F0] cursor-pointer rounded flex items-center gap-2" onClick={() => runAiCommand('continue')}><ArrowRight size={16} className="opacity-60"/> <span>Continue writing</span></button>
                    <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-[#F1F1F0] cursor-pointer rounded flex items-center gap-2 border-t border-[#EBEBE9] mt-1" onClick={() => runAiCommand('extract')}><CheckSquare size={16} className="opacity-60"/> <span>Extract to Google Tasks</span></button>
                    
                    <div className="px-2 py-1.5 mt-2 text-[11px] font-bold text-[#37352f7a] uppercase tracking-wider bg-white border-t border-[#EBEBE9]">Generate from scratch</div>
                    <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-[#F1F1F0] cursor-pointer rounded flex items-center gap-2 mt-1" onClick={() => runAiCommand('brainstorm')}><span className="opacity-60">💡</span> <span>Brainstorm ideas</span></button>
                    <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-[#F1F1F0] cursor-pointer rounded flex items-center gap-2" onClick={() => runAiCommand('custom', 'Write a blog post about...')} ><span className="opacity-60">📝</span> <span>Draft a blog post</span></button>
                    <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-[#F1F1F0] cursor-pointer rounded flex items-center gap-2" onClick={() => runAiCommand('custom', 'Write a meeting agenda...')} ><span className="opacity-60">🗒️</span> <span>Draft an agenda</span></button>
                </div>
              )}
           </div>
        </div>
      )}
      {/* Bottom UI Elements */}
      <div className="fixed bottom-8 right-6 md:right-8 flex space-x-2 z-30">
        {selectedText && (
          <button 
            onClick={() => setWorkspaceModalOpen(true)}
            title="Send layout contents / selections to Calendar/Tasks"
            className="h-10 px-4 bg-purple-600 text-white shadow-md rounded-full flex items-center hover:bg-purple-700 text-sm font-medium transition-colors"
          >
            <Compass size={16} className="mr-1.5 animate-pulse" /> Workspace Actions
          </button>
        )}
        <button 
          onClick={toggleListening}
          className={cn(
            "w-10 h-10 border border-[#EBEBE9] shadow-md rounded-full flex items-center justify-center transition-colors",
            isListening ? "bg-red-50 text-red-500 border-red-200" : "bg-white hover:bg-[#F1F1F0] text-[#37352f7a]"
          )}
        >
          {isListening ? <Mic size={18} /> : <MicOff size={18} />}
        </button>
        <button 
          onClick={() => {
            setAiMenuPos({ top: Math.max(100, window.innerHeight - 400), left: Math.max(20, window.innerWidth / 2 - 250) });
            setAiMenuOpen(true);
          }}
          className="h-10 px-4 bg-white border border-[#EBEBE9] shadow-md rounded-full flex items-center hover:bg-[#F1F1F0] text-sm font-medium transition-colors"
        >
          <span className="text-purple-600 mr-2">✨</span> Ask AI
        </button>
      </div>

      <SelectionActionModal 
        isOpen={workspaceModalOpen} 
        onClose={() => setWorkspaceModalOpen(false)} 
        selectedText={selectedText || "Page Title: " + title}
      />

      {composerBlockId && (() => {
        const selectedBlock = blocks.find(b => b.id === composerBlockId);
        if (!selectedBlock) return null;
        return (
          <AiComposerModal
            isOpen={true}
            onClose={() => setComposerBlockId(null)}
            block={selectedBlock}
            blocks={blocks}
            onSave={updateBlock}
          />
        );
      })()}
    </div>
  );
}
