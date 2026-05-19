import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Block, BlockType } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '../lib/utils';
import { 
  GripVertical, Plus, ChevronRight, Hash, Type, CheckSquare, 
  List, Minus, Quote, Sparkles, MessageSquare, ArrowRight, Wand2
} from 'lucide-react';
import { addGoogleTask, addGoogleCalendarEvent } from '../lib/workspace';

interface BlockEditorProps {
  initialBlocks: Block[];
  onChange: (blocks: Block[]) => void;
  title: string;
  onTitleChange: (title: string) => void;
}

export function BlockEditor({ initialBlocks, onChange, title, onTitleChange }: BlockEditorProps) {
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashMenuPos, setSlashMenuPos] = useState({ top: 0, left: 0 });
  const [slashQuery, setSlashQuery] = useState('');
  
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [aiMenuPos, setAiMenuPos] = useState({ top: 0, left: 0 });
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  
  const blockRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    onChange(blocks);
  }, [blocks, onChange]);

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
    const content = e.currentTarget.textContent || '';
    updateBlock(id, { content });
    
    // Auto-markdown conversions
    if (content === '# ') {
      updateBlock(id, { type: 'h1', content: '' });
      e.currentTarget.textContent = '';
    } else if (content === '## ') {
      updateBlock(id, { type: 'h2', content: '' });
      e.currentTarget.textContent = '';
    } else if (content === '### ') {
      updateBlock(id, { type: 'h3', content: '' });
      e.currentTarget.textContent = '';
    } else if (content === '- ' || content === '* ') {
      updateBlock(id, { type: 'bullet', content: '' });
      e.currentTarget.textContent = '';
    } else if (content === '[] ') {
      updateBlock(id, { type: 'todo', content: '' });
      e.currentTarget.textContent = '';
    } else if (content === '---') {
      updateBlock(id, { type: 'divider', content: '' });
      e.currentTarget.textContent = '';
    }
  };

  const updateBlock = (id: string, updates: Partial<Block>) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const openAiMenuForSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.toString().length > 0) {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelectedText(sel.toString());
      setAiMenuPos({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX });
      setAiMenuOpen(true);
    }
  };

  useEffect(() => {
    const handleMouseUp = () => setTimeout(openAiMenuForSelection, 50);
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const runAiCommand = async (command: string, customPrompt = '') => {
    if (!selectedText && command !== 'continue' && command !== 'custom') return;
    
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command,
          context: selectedText || blocks.map(b => b.content).join('\n'),
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
      } else {
        // Insert new blocks below the current selection or at bottom
        let index = blocks.length - 1;
        if (focusedId) {
            index = blocks.findIndex(b => b.id === focusedId);
        }
        
        const generatedLines = newContent.split('\n').filter((l: string) => l.trim().length > 0);
        const newBlocks: Block[] = generatedLines.map((line: string) => ({
            id: uuidv4(),
            type: 'p',
            content: line
        }));
        
        const updatedBlocks = [...blocks];
        updatedBlocks.splice(index + 1, 0, ...newBlocks);
        setBlocks(updatedBlocks);
      }
      
    } catch (err: any) {
      alert("AI Error: " + err.message);
    } finally {
      setAiLoading(false);
      setAiMenuOpen(false);
      setAiPrompt('');
    }
  };

  const commands = [
    { label: 'Text', icon: Type, type: 'p' },
    { label: 'Heading 1', icon: Hash, type: 'h1' },
    { label: 'Heading 2', icon: Hash, type: 'h2' },
    { label: 'Heading 3', icon: Hash, type: 'h3' },
    { label: 'To-do list', icon: CheckSquare, type: 'todo' },
    { label: 'Bulleted list', icon: List, type: 'bullet' },
    { label: 'Divider', icon: Minus, type: 'divider' },
    { label: 'Quote', icon: Quote, type: 'quote' },
  ];

  return (
    <div className="w-full max-w-2xl mx-auto px-12 py-12 pb-48 font-sans text-lg text-[#37352F]">
      <input 
        type="text" 
        value={title} 
        onChange={e => onTitleChange(e.target.value)}
        placeholder="Untitled"
        className="w-full text-4xl font-bold bg-transparent border-none outline-none mb-8 placeholder-[#37352f4d] resize-none"
      />

      <div className="space-y-1">
        {blocks.map((block, index) => (
          <div key={block.id} className="relative group flex items-start -ml-6">
            <div 
              className="w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-[#37352f4d] mt-1"
              contentEditable={false}
            >
              <GripVertical size={16} />
            </div>
            
            <div className="flex-1 w-full min-w-0" style={{position: 'relative'}}>
              {block.type === 'todo' && (
                <div className="absolute left-0 top-1.5 cursor-pointer mr-2" onClick={() => updateBlock(block.id, {checked: !block.checked})}>
                  <div className={cn("w-5 h-5 border rounded-sm flex items-center justify-center transition-colors", block.checked ? "bg-[#2EAADC] border-[#2EAADC] text-white" : "border-[#EBEBE9] hover:bg-[#F1F1F0]")}>
                    {block.checked && <CheckSquare size={14} className="opacity-100" />}
                  </div>
                </div>
              )}
              {block.type === 'bullet' && (
                <div className="absolute left-0 top-3 w-1.5 h-1.5 bg-current rounded-full" />
              )}
              {block.type === 'divider' ? (
                <div className="h-px w-full bg-[#EBEBE9] my-4" />
              ) : (
                <div
                  ref={el => blockRefs.current[block.id] = el}
                  contentEditable
                  suppressContentEditableWarning
                  onKeyDown={e => handleKeyDown(e, index)}
                  onInput={e => handleInput(e, block.id)}
                  onFocus={() => setFocusedId(block.id)}
                  className={cn(
                    "outline-none min-h-[1.5em] empty:before:content-[attr(data-placeholder)] empty:before:text-[#37352f33] empty:before:pointer-events-none break-words leading-relaxed max-w-full",
                    block.type === 'h1' && "text-3xl font-bold mt-6 mb-3",
                    block.type === 'h2' && "text-2xl font-semibold mt-5 mb-2",
                    block.type === 'h3' && "text-xl font-semibold mt-4 mb-1",
                    block.type === 'quote' && "border-l-[3px] border-[#37352F] pl-4 py-1 text-lg my-4",
                    (block.type === 'todo' || block.type === 'bullet') && "pl-8",
                    block.type === 'todo' && block.checked && "line-through text-[#37352f7a]"
                  )}
                  style={{ whiteSpace: 'pre-wrap' }}
                  data-placeholder={focusedId === block.id && block.type === 'p' ? "Press '/' for commands..." : ""}
                >
                  {block.content}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Slash Command Menu */}
      {slashMenuOpen && (
        <div 
          className="fixed z-50 w-80 bg-white rounded-lg shadow-[0_4px_16px_rgba(15,15,15,0.1),0_0_0_1px_rgba(15,15,15,0.05)] overflow-hidden text-sm"
          style={{ top: slashMenuPos.top + 24, left: slashMenuPos.left }}
        >
          <div className="px-3 py-1.5 text-[11px] font-bold text-[#37352f7a] uppercase tracking-wider bg-white">
            Basic Blocks
          </div>
          <div className="p-1 max-h-[300px] overflow-y-auto">
            {commands.map((cmd) => (
              <button
                key={cmd.label}
                className="w-full flex items-center p-2 hover:bg-[#F1F1F0] rounded text-left"
                onClick={() => {
                  if (focusedId) updateBlock(focusedId, { type: cmd.type as BlockType, content: '' });
                  setSlashMenuOpen(false);
                }}
              >
                <div className="w-10 h-10 rounded border border-[#EBEBE9] bg-white flex items-center justify-center mr-3 flex-shrink-0 text-[#37352F]">
                  <cmd.icon size={18} strokeWidth={1.5} />
                </div>
                <div>
                  <div className="font-medium text-[#37352F]">{cmd.label}</div>
                  <div className="text-xs text-[#37352f7a]">Shortcut formatting</div>
                </div>
              </button>
            ))}
            
            <div className="px-2 py-1.5 mt-2 text-[11px] font-bold text-[#37352f7a] uppercase tracking-wider bg-white border-t border-[#EBEBE9]">
              AI Magic
            </div>
            <button className="w-full flex items-center p-2 hover:bg-[#F1F1F0] rounded text-left mt-1"
              onClick={() => {
                setSlashMenuOpen(false);
                setAiMenuOpen(true);
                setAiMenuPos({top: window.innerHeight/3, left: window.innerWidth/2 - 250});
              }}
            >
              <div className="w-10 h-10 rounded border border-[#EBEBE9] bg-purple-50 flex items-center justify-center mr-3 flex-shrink-0 text-purple-600">
                <Wand2 size={18} strokeWidth={1.5} />
              </div>
              <div>
                <div className="font-medium text-[#37352F]">Draft with AI...</div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* AI Menu */}
      {aiMenuOpen && (
        <div className="fixed z-50 overflow-hidden" style={{ top: aiMenuPos.top + 10, left: aiMenuPos.left }}>
           <div className="w-full max-w-2xl bg-white rounded-lg shadow-[0_0_0_1px_rgba(15,15,15,0.05),0_8px_16px_-4px_rgba(15,15,15,0.1)] border border-[#EBEBE9] overflow-hidden z-20">
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
                        if (e.key === 'Escape') setAiMenuOpen(false);
                    }}
                 />
                 <button onClick={() => setAiMenuOpen(false)} className="text-[#37352f4d] hover:text-[#37352F]">×</button>
              </div>
              
              {aiLoading ? (
                 <div className="p-8 text-center text-[#37352f7a] text-sm flex flex-col items-center gap-3">
                   <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                   AI is working on it...
                 </div>
              ) : (
                <div className="p-1">
                    <div className="px-2 py-1.5 text-[11px] font-bold text-[#37352f7a] uppercase tracking-wider">AI Actions</div>
                    <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-[#F1F1F0] cursor-pointer rounded flex items-center gap-2" onClick={() => runAiCommand('improve')}><Sparkles size={16} className="opacity-60"/> <span>Improve writing</span></button>
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
    </div>
  );
}
