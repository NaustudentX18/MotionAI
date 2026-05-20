import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Sparkles, MessageSquare, Hash, Type, CheckSquare, 
  ArrowLeft, Loader2, Check, Copy, RefreshCw, Lightbulb 
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '../lib/utils';
import { Page, Block } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  pages: Page[];
  onSelectPage: (id: string) => void;
  onAiAction: (action: string) => void;
  onInsertBlocks?: (blocks: Block[]) => void;
  currentPage?: Page | null;
}

const SUGGESTED_TOPICS = [
  'Innovative features for a read-later content reader',
  'Marketing slogans for an eco-friendly water bottle brand',
  'Creative fictional plot twists for a sci-fi novel set in 2088',
  'Engagement activities for an online developer community',
];

const GENERATION_STEPS = [
  'Analyzing brainstorming topic & scope...',
  'Connecting securely to Gemini 3.5 AI Core...',
  'Synthesizing 10 high-impact distinct concepts...',
  'Refining Markdown and Aligning structure with Workspace layout...',
];

export function CommandPalette({ 
  isOpen, 
  onClose, 
  pages, 
  onSelectPage, 
  onAiAction,
  onInsertBlocks,
  currentPage
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [isBrainstormingMode, setIsBrainstormingMode] = useState(false);
  const [brainstormTopic, setBrainstormTopic] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [brainstormResult, setBrainstormResult] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  // Dynamic Workspace Engine
  const [activeCommand, setActiveCommand] = useState('brainstorm');
  const [workspaceTitle, setWorkspaceTitle] = useState('Gemini Brainstorming Core');
  const [workspaceLabel, setWorkspaceLabel] = useState('What would you like to brainstorm today?');
  const [workspacePlaceholder, setWorkspacePlaceholder] = useState('e.g. Catchy title ideas for a technology vlog...');

  // Helper to strip HTML tags for plain text comparison
  const stripHtml = (htmlStr: string) => {
    if (!htmlStr) return '';
    return htmlStr.replace(/<[^>]*>/g, '').trim();
  };

  // Extract custom slash commands and dynamic prompts from current active page content
  const extractedCommands = React.useMemo(() => {
    if (!currentPage || !currentPage.blocks) return [];
    const list: {
      id: string;
      label: string;
      prompt: string;
      type: string;
      category: string;
      icon: any;
      color: string;
    }[] = [];

    currentPage.blocks.forEach((block) => {
      // 1. Text blocks starting with a slash `/`
      if (block.content) {
        const plainText = stripHtml(block.content);
        if (plainText.startsWith('/') && plainText.length > 2) {
          list.push({
            id: `page-content-${block.id}`,
            label: plainText,
            prompt: plainText.substring(1), // remove '/'
            type: 'custom',
            category: 'Page Slash Command',
            icon: Sparkles,
            color: 'text-purple-650'
          });
        }
      }

      // 2. Custom Prompts in preset AI Blocks
      if (block.type === 'ai-summary' || block.type === 'ai-draft' || block.type === 'ai-rewrite') {
        if (block.aiPrompt && block.aiPrompt.trim()) {
          const typeName = block.type === 'ai-summary' ? 'summary' : block.type === 'ai-draft' ? 'draft' : 'rewrite';
          list.push({
            id: `page-ai-${block.id}`,
            label: `/${typeName}: ${block.aiPrompt.trim()}`,
            prompt: block.aiPrompt.trim(),
            type: 'custom',
            category: 'AI Block Preset',
            icon: Sparkles,
            color: 'text-purple-700 font-bold'
          });
        }
      }
    });

    return list;
  }, [currentPage]);

  const filteredExtracted = React.useMemo(() => {
    return extractedCommands.filter(c =>
      c.label.toLowerCase().includes(query.toLowerCase()) ||
      c.prompt.toLowerCase().includes(query.toLowerCase())
    );
  }, [extractedCommands, query]);

  const inputRef = useRef<HTMLInputElement>(null);
  const topicInputRef = useRef<HTMLTextAreaElement>(null);
  const stepTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (isBrainstormingMode) {
        setTimeout(() => topicInputRef.current?.focus(), 50);
      } else {
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    } else {
      setQuery('');
      setIsBrainstormingMode(false);
      setBrainstormTopic('');
      setBrainstormResult('');
      setErrorMsg('');
      setIsLoading(false);
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
    }
  }, [isOpen, isBrainstormingMode]);

  // Clean timer on unmount
  useEffect(() => {
    return () => {
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
    };
  }, []);

  if (!isOpen) return null;

  const filteredPages = pages.filter(p => (p.title || 'Untitled').toLowerCase().includes(query.toLowerCase()));
  
  const aiCommands = [
    { id: 'brainstorm', label: 'Brainstorm ideas...', icon: Sparkles, color: 'text-purple-600' },
    { id: 'summarize', label: 'Summarize text...', icon: MessageSquare, color: 'text-green-600' },
    { id: 'draft', label: 'Draft a blog post...', icon: Type, color: 'text-blue-600' },
    { id: 'translate', label: 'Translate selected text...', icon: Sparkles, color: 'text-orange-500' },
    { id: 'rewrite', label: 'Rewrite selected paragraph...', icon: Type, color: 'text-indigo-500' },
    { id: 'grammar', label: 'Check content grammar...', icon: CheckSquare, color: 'text-teal-500' },
  ].filter(c => c.label.toLowerCase().includes(query.toLowerCase()));

  const parseMarkdownToBlocks = (text: string): Block[] => {
    const lines = text.split('\n');
    const blocks: Block[] = [];
    
    // Add title block
    blocks.push({
      id: uuidv4(),
      type: 'h3',
      content: `💡 Brainstormed Ideas: *"${brainstormTopic}"*`
    });

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      
      // Parse horizontal line
      if (trimmed === '---') {
        blocks.push({
          id: uuidv4(),
          type: 'divider',
          content: ''
        });
        return;
      }

      // Parse H3
      if (trimmed.startsWith('### ')) {
        blocks.push({
          id: uuidv4(),
          type: 'h3',
          content: trimmed.substring(4).replace(/\*\*/g, ''),
        });
      }
      // Parse H2
      else if (trimmed.startsWith('## ')) {
        blocks.push({
          id: uuidv4(),
          type: 'h2',
          content: trimmed.substring(3).replace(/\*\*/g, ''),
        });
      }
      // Parse H1
      else if (trimmed.startsWith('# ')) {
        blocks.push({
          id: uuidv4(),
          type: 'h1',
          content: trimmed.substring(2).replace(/\*\*/g, ''),
        });
      }
      // Parse bullet
      else if (trimmed.match(/^[-*]\s+/)) {
        blocks.push({
          id: uuidv4(),
          type: 'bullet',
          content: trimmed.replace(/^[-*]\s+/, ''),
        });
      }
      // Parse numbered lists/bullets too
      else if (trimmed.match(/^\d+\.\s+/)) {
        blocks.push({
          id: uuidv4(),
          type: 'bullet',
          content: trimmed.replace(/^\d+\.\s+/, ''),
        });
      }
      // Parse todo check lists
      else if (trimmed.startsWith('- [ ] ') || trimmed.startsWith('* [ ] ')) {
        blocks.push({
          id: uuidv4(),
          type: 'todo',
          content: trimmed.substring(6),
          checked: false
        });
      }
      // Parse quote
      else if (trimmed.startsWith('> ')) {
        blocks.push({
          id: uuidv4(),
          type: 'quote',
          content: trimmed.substring(2),
        });
      }
      // Default to paragraph
      else {
        blocks.push({
          id: uuidv4(),
          type: 'p',
          content: trimmed,
        });
      }
    });

    return blocks;
  };

  const handleGenerateBrainstorm = async () => {
    if (!brainstormTopic.trim()) return;
    setIsLoading(true);
    setErrorMsg('');
    setCurrentStepIndex(0);

    // Dynamic Step Sequence
    if (stepTimerRef.current) clearInterval(stepTimerRef.current);
    let step = 0;
    stepTimerRef.current = setInterval(() => {
      step++;
      if (step < GENERATION_STEPS.length) {
        setCurrentStepIndex(step);
      } else {
        if (stepTimerRef.current) clearInterval(stepTimerRef.current);
      }
    }, 900);

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: activeCommand || 'brainstorm',
          context: '',
          prompt: brainstormTopic
        })
      });
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      setBrainstormResult(data.text || '');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error occurred during generation. Please check Gemini config.');
    } finally {
      setIsLoading(false);
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
    }
  };

  const handleCopyToClipboard = () => {
    if (!brainstormResult) return;
    navigator.clipboard.writeText(brainstormResult);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleInsertToPage = () => {
    if (!brainstormResult || !onInsertBlocks) return;
    const blocks = parseMarkdownToBlocks(brainstormResult);
    onInsertBlocks(blocks);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] sm:pt-[20vh] bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="w-full max-w-2xl bg-white dark:bg-[#191919] rounded-xl shadow-2xl overflow-hidden border border-[#EBEBE9] dark:border-[#2F2F2F] animate-in fade-in zoom-in-95 duration-200" 
        onClick={e => e.stopPropagation()}
      >
        {isBrainstormingMode ? (
          /* Brainstorm Sub-Prompt Screen */
          <div className="flex flex-col h-full min-h-[300px]">
            {/* Header row */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#EBEBE9] dark:border-[#2F2F2F] bg-gray-50/50 dark:bg-[#1E1E1E]/50">
              <button 
                onClick={() => {
                  setIsBrainstormingMode(false);
                  setBrainstormTopic('');
                  setBrainstormResult('');
                  setErrorMsg('');
                }}
                disabled={isLoading}
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <ArrowLeft size={14} /> Back
              </button>
              <div className="flex items-center gap-1.5 text-xs font-bold text-purple-650 dark:text-purple-400 uppercase tracking-widest font-mono">
                <Sparkles size={13} className="animate-pulse" /> {workspaceTitle}
              </div>
            </div>

            {/* Content pane */}
            <div className="flex-1 p-5 space-y-4">
              {!brainstormResult && !isLoading ? (
                /* 1. Input view */
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-semibold text-[#37352F] dark:text-gray-200">
                      {workspaceLabel}
                    </label>
                    <textarea
                      ref={topicInputRef}
                      rows={3}
                      value={brainstormTopic}
                      onChange={e => setBrainstormTopic(e.target.value)}
                      placeholder={workspacePlaceholder}
                      className="w-full text-sm p-3 bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-[#2F2F2F] outline-none rounded-lg text-[#37352F] dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:ring-1 focus:ring-purple-250 font-medium leading-relaxed resize-none"
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleGenerateBrainstorm();
                        }
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex items-center gap-1">
                      <Lightbulb size={12} className="text-amber-500" /> Need inspiration? Try a suggestion:
                    </span>
                    <div className="flex flex-col gap-1.5 pt-0.5">
                      {SUGGESTED_TOPICS.map((topic, idx) => (
                        <button
                          key={idx}
                          onClick={() => setBrainstormTopic(topic)}
                          className="w-full text-left p-2.5 text-xs hover:bg-[#F4F4F3] dark:hover:bg-[#252525] text-gray-700 dark:text-gray-300 font-medium rounded-lg border border-[#EBEBE9] dark:border-[#2F2F2F] transition-all cursor-pointer whitespace-nowrap overflow-hidden text-overflow-ellipsis block hover:border-purple-200 dark:hover:border-purple-900"
                        >
                          📌 {topic}
                        </button>
                      ))}
                    </div>
                  </div>

                  {errorMsg && (
                    <div className="text-xs p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-450 rounded-lg font-medium leading-relaxed">
                      ⚠️ {errorMsg}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setIsBrainstormingMode(false)}
                      className="px-4 py-2 text-xs font-semibold text-[#37352F] hover:bg-[#F1F1F0] dark:text-gray-300 dark:hover:bg-[#2F2F2F] rounded-lg border border-[#EBEBE9] dark:border-[#2F2F2F] transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleGenerateBrainstorm}
                      disabled={!brainstormTopic.trim()}
                      className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:hover:bg-purple-600 cursor-pointer shadow-xs"
                    >
                      <Sparkles size={13} /> Run with Gemini
                    </button>
                  </div>
                </div>
              ) : isLoading ? (
                /* 2. Loading pipeline view */
                <div className="flex flex-col items-center justify-center py-6 space-y-6 animate-in fade-in duration-200">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-full border border-purple-100 dark:border-purple-900 flex items-center justify-center bg-purple-50 dark:bg-purple-950/30 animate-pulse">
                      <Sparkles size={24} className="text-purple-600 dark:text-purple-400 rotate-12" />
                    </div>
                    <Loader2 size={16} className="text-purple-600 dark:text-purple-400 animate-spin absolute -bottom-1 -right-1" />
                  </div>

                  <div className="w-full max-w-sm space-y-3">
                    <div className="text-center space-y-1">
                      <h4 className="text-sm font-bold text-[#37352F] dark:text-gray-200 tracking-wide">Gemini is Brainstorming...</h4>
                      <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">Please stand by as ideas are developed.</p>
                    </div>

                    <div className="space-y-2 p-4 bg-[#F4F4F3] dark:bg-[#202020] rounded-xl border border-[#EBEBE9] dark:border-[#2F2F2F]/60">
                      {GENERATION_STEPS.map((step, idx) => {
                        const isDone = idx < currentStepIndex;
                        const isActive = idx === currentStepIndex;
                        return (
                          <div key={idx} className="flex items-center gap-2.5 text-xs transition-opacity duration-300">
                            {isDone ? (
                              <Check size={12} className="text-emerald-500 font-bold" />
                            ) : isActive ? (
                              <Loader2 size={12} className="text-purple-600 dark:text-purple-400 animate-spin" />
                            ) : (
                              <div className="w-3 h-3 rounded-full border border-gray-300 dark:border-gray-700 flex items-center justify-center text-[8px] text-gray-400">
                                {idx + 1}
                              </div>
                            )}
                            <span className={cn(
                              "font-medium",
                              isDone ? "text-gray-400 line-through decoration-gray-300/60 dark:decoration-gray-700/60" :
                              isActive ? "text-purple-700 dark:text-purple-400 font-semibold" : "text-gray-400 dark:text-gray-600"
                            )}>
                              {step}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                /* 3. Output results view */
                <div className="space-y-4 animate-in fade-in duration-200 flex flex-col h-full">
                  <div className="flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400 pb-1 border-b border-gray-100 dark:border-[#2F2F2F]">
                    <span>Original request: <strong className="text-[#37352F] dark:text-gray-200">"{brainstormTopic}"</strong></span>
                    <span className="text-[10px] font-mono bg-purple-50 dark:bg-purple-950/30 text-purple-650 dark:text-purple-400 px-1.5 py-0.5 rounded font-bold">10 IDEAS GENERATED</span>
                  </div>

                  <div className="scrollable-preview p-4 bg-[#FBFBFA] dark:bg-[#1E1E1E] border border-gray-200 dark:border-[#2F2F2F] rounded-lg text-sm text-[#37352F] dark:text-gray-200 leading-relaxed max-h-[350px] overflow-y-auto font-sans shadow-inner whitespace-pre-wrap">
                    {brainstormResult}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <button
                      onClick={() => {
                        setBrainstormResult('');
                        setErrorMsg('');
                        setTimeout(() => topicInputRef.current?.focus(), 50);
                      }}
                      className="px-3 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-[#F4F4F3] dark:hover:bg-[#252525] rounded-md transition-all flex items-center gap-1.5 border border-transparent hover:border-gray-200 dark:hover:border-[#2F2F2F] cursor-pointer"
                    >
                      <RefreshCw size={13} /> Brainstorm another topic
                    </button>

                    <div className="flex items-center gap-2 ml-auto">
                      <button
                        onClick={handleCopyToClipboard}
                        className={cn(
                          "px-3 py-2 text-xs font-bold rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer shadow-xs",
                          isCopied 
                            ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 text-emerald-700 dark:text-emerald-400"
                            : "bg-white dark:bg-[#1E1E1E] border-[#EBEBE9] dark:border-[#2F2F2F] text-gray-700 dark:text-gray-300 hover:bg-[#F1F1F0] dark:hover:bg-[#2F2F2F]"
                        )}
                      >
                        {isCopied ? (
                          <>
                            <Check size={13} /> Copied!
                          </>
                        ) : (
                          <>
                            <Copy size={13} /> Copy plain text
                          </>
                        )}
                      </button>

                      {onInsertBlocks && (
                        <button
                          onClick={handleInsertToPage}
                          className="px-4 py-2 text-xs font-bold text-white bg-purple-650 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          📥 Insert directly into page
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Standard Search / AI Command Palette View */
          <>
            <div className="flex items-center px-4 py-3 border-b border-[#EBEBE9] dark:border-[#2F2F2F]">
              <Search size={20} className="text-[#37352f7a] dark:text-gray-500 mr-3" />
              <input
                ref={inputRef}
                className="flex-1 bg-transparent border-none outline-none text-lg text-[#37352F] dark:text-gray-100 placeholder-[#37352f7a] dark:placeholder-gray-500"
                placeholder="Search pages or ask AI..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Escape') onClose();
                }}
              />
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2">
              {/* Dynamic Page Extracted Commands Section */}
              {filteredExtracted.length > 0 && (
                <div className="mb-5 animate-in slide-in-from-top-1 duration-200">
                  <div className="px-3 py-1.5 text-[11.5px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center justify-between">
                    <span>✨ Page Slash Commands (/commands)</span>
                    <span className="text-[10px] font-mono bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 px-1.5 py-0.2 rounded font-semibold scale-90">
                      {filteredExtracted.length} active
                    </span>
                  </div>
                  <div className="space-y-0.5 mt-1.5">
                    {filteredExtracted.map(cmd => (
                      <button
                        key={cmd.id}
                        onClick={() => {
                          setActiveCommand('custom');
                          setWorkspaceTitle('Gemini Action Core');
                          setWorkspaceLabel(`Executing slash action: "${cmd.label}"`);
                          setWorkspacePlaceholder('Add any optional focus or specifications here...');
                          setBrainstormTopic(cmd.prompt);
                          setBrainstormResult('');
                          setErrorMsg('');
                          setIsBrainstormingMode(true);
                        }}
                        className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-[#37352F] dark:text-gray-200 hover:bg-purple-50/50 dark:hover:bg-purple-950/10 hover:shadow-xs rounded-lg transition-all cursor-pointer group border border-transparent hover:border-purple-200/50 dark:hover:border-purple-900/25"
                      >
                        <div className="flex items-center min-w-0">
                          <cmd.icon size={15} className="mr-3 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform flex-shrink-0 animate-pulse" />
                          <span className="font-mono text-purple-700 dark:text-purple-300 font-bold truncate pr-3">{cmd.label}</span>
                        </div>
                        <span className="text-[9px] bg-purple-100/50 dark:bg-purple-900/40 text-purple-850 dark:text-purple-300 px-2 py-0.5 rounded font-bold font-sans flex-shrink-0 border border-purple-200/20">
                          {cmd.category}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {aiCommands.length > 0 && (
                <div className="mb-4">
                  <div className="px-3 py-1.5 text-[11px] font-bold text-[#37352f7a] dark:text-gray-500 uppercase tracking-wider">AI Actions</div>
                  {aiCommands.map(cmd => (
                    <button
                      key={cmd.id}
                      onClick={() => {
                        if (cmd.id === 'brainstorm') {
                          setWorkspaceTitle('Gemini Brainstorming Core');
                          setWorkspaceLabel('What would you like to brainstorm today?');
                          setWorkspacePlaceholder('e.g. Catchy title ideas for a technology vlog...');
                          setActiveCommand('brainstorm');
                          setBrainstormTopic('');
                          setBrainstormResult('');
                          setErrorMsg('');
                          setIsBrainstormingMode(true);
                        } else {
                          onAiAction(cmd.id);
                          onClose();
                        }
                      }}
                      className="w-full flex items-center px-3 py-2 text-sm text-[#37352F] dark:text-gray-200 hover:bg-[#F1F1F0] dark:hover:bg-[#252525] rounded-md transition-colors cursor-pointer"
                    >
                      <cmd.icon size={16} className={cn("mr-3", cmd.color)} />
                      {cmd.label}
                    </button>
                  ))}
                </div>
              )}

              {filteredPages.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-[11px] font-bold text-[#37352f7a] dark:text-gray-500 uppercase tracking-wider">Pages</div>
                  {filteredPages.map(page => (
                    <button
                      key={page.id}
                      onClick={() => {
                        onSelectPage(page.id);
                        onClose();
                      }}
                      className="w-full flex items-center px-3 py-2 text-sm text-[#37352F] dark:text-gray-200 hover:bg-[#F1F1F0] dark:hover:bg-[#252525] rounded-md transition-colors cursor-pointer"
                    >
                      <span className="mr-3 text-[#37352f7a] dark:text-gray-500">{page.icon || <Hash size={16} />}</span>
                      {page.title || 'Untitled'}
                    </button>
                  ))}
                </div>
              )}

              {query && aiCommands.length === 0 && filteredPages.length === 0 && (
                <div className="p-8 text-center text-[#37352f7a] dark:text-gray-500 text-sm">
                  No results found for "{query}"
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
