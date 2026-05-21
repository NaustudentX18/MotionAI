import React, { useState, useEffect } from 'react';
import { 
  Sparkles, X, Loader2, Play, Check, Copy, RefreshCw, 
  BookOpen, AlignLeft, Edit3, HelpCircle, FileText, LayoutTemplate, Maximize2
} from 'lucide-react';
import { Block, BlockType } from '../types';
import { parseMarkdownToHtml } from './BlockEditor';
import { cn } from '../lib/utils';
import { sanitizeHtml } from '../lib/sanitize';

interface AiComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  block: Block;
  blocks: Block[];
  onSave: (id: string, updates: Partial<Block>) => void;
}

const PRESETS = {
  'ai-summary': [
    { label: "⚡ Short & Punchy TL;DR", prompt: "Summarize this into a single, punchy TL;DR paragraph." },
    { label: "📋 Detailed Action Items", prompt: "Extract and summarize all action items and meeting deliverables as a structured list." },
    { label: "💡 Key Insights Only", prompt: "Identify and outline the 3 most critical insights and lessons from the text." },
    { label: "📚 Glossary Table", prompt: "Summarize by extracting key terms, metrics, or jargon and provide quick explanations for each." }
  ],
  'ai-draft': [
    { label: "📅 Professional Meeting Agenda", prompt: "Create a detailed meeting agenda outline including standard timers and discussion goals." },
    { label: "🎓 Educational Guide", prompt: "Draft an engaging step-by-step explanatory tutorial suited for a beginner introducing this concept." },
    { label: "✉️ Executive Email", prompt: "Draft a polished, professional email summarizing these points for executive stakeholders." },
    { label: "🚀 Feature Announcement", prompt: "Write an inspiring release announcement for a product launch highlighting the key impacts." },
    { label: "🧠 10 Creative Ideas", prompt: "Brainstorm 10 out-of-the-box ideas, hook titles, or solutions based on this topic." }
  ],
  'ai-rewrite': [
    { label: "👔 Elevate Professionalism", prompt: "Rewrite this content to be highly professional, elegant, and corporate suited." },
    { label: "✂️ Clear & Concise", prompt: "Rewrite this text to be short and direct. Eliminate all fluff while preserving core facts." },
    { label: "👶 Explain to a Child", prompt: "Simplify the language and terminology. Explain this complex concept as if I am 10 years old." },
    { label: "✨ High Engagement Hook", prompt: "Rewrite this draft to be dramatic, visually engaging, and optimized for social posts or articles." },
    { label: "🏃 Active Voice Switch", prompt: "Rewrite to convert passive voice elements into active, lively, persuasive phrasing." }
  ]
};

export function AiComposerModal({ isOpen, onClose, block, blocks, onSave }: AiComposerModalProps) {
  const [activeType, setActiveType] = useState<BlockType>(block.type);
  const [prompt, setPrompt] = useState(block.aiPrompt || '');
  const [context, setContext] = useState(block.aiContext || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generationSteps, setGenerationSteps] = useState<string[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  
  // Working draft output that the user can verify or manually edit
  const [previewContent, setPreviewContent] = useState(block.content || '');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveType(block.type);
      setPrompt(block.aiPrompt || '');
      setContext(block.aiContext || '');
      setPreviewContent(block.content || '');
      setError(null);
      setGenerationSteps([]);
    }
  }, [isOpen, block]);

  const steps = [
    "Analyzing structured context parameters...",
    "Injecting layout instructions and prompt criteria...",
    "Optimizing payload for Google Gemini API...",
    "Decoding generated markdown token sequences...",
    "Mapping typographic styles and codeblocks..."
  ];

  // Rotate generator steps for engaging visual cue
  useEffect(() => {
    if (loading) {
      setCurrentStepIndex(0);
      const interval = setInterval(() => {
        setCurrentStepIndex(p => (p + 1) % steps.length);
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [loading]);

  if (!isOpen) return null;

  const pullPageContent = () => {
    const allText = blocks
      .filter(b => b.id !== block.id && b.content && b.content.trim() && b.type !== 'divider')
      .map(b => b.content.replace(/<[^>]*>/g, '').trim())
      .join('\n\n');
    setContext(allText);
  };

  const handleApplyPreset = (presetPrompt: string) => {
    if (activeType === 'ai-summary') {
      setPrompt(presetPrompt);
    } else {
      setPrompt(presetPrompt);
    }
  };

  const executeGeneration = async () => {
    setLoading(true);
    setError(null);
    setPreviewContent('');
    
    try {
      let command = 'custom';
      let requestPrompt = '';
      
      if (activeType === 'ai-summary') {
        command = 'summarize';
        requestPrompt = prompt || 'Provide a tidy, structured summary of the content below.';
      } else if (activeType === 'ai-draft') {
        command = 'custom';
        requestPrompt = `Draft a modern document block about: ${prompt}.${context ? ` Extra context: ${context}` : ''}`;
      } else if (activeType === 'ai-rewrite') {
        command = 'custom';
        requestPrompt = `Please rewrite the following content to fit these criteria: ${prompt}. Keep it structurally sound and clean. Target Content:\n${context}`;
      }

      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command,
          context,
          prompt: requestPrompt
        })
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Translate generated Markdown to high contrast style elements inside blocks
      const htmlContent = sanitizeHtml(parseMarkdownToHtml(data.text || ''));
      setPreviewContent(htmlContent);
    } catch (err: any) {
      setError(err.message || 'Generation issue encountered');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      // Strip html tags to get plain text
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = sanitizeHtml(previewContent);
      const plainText = tempDiv.textContent || tempDiv.innerText || '';
      await navigator.clipboard.writeText(plainText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveAndClose = () => {
    onSave(block.id, {
      type: activeType,
      aiPrompt: prompt,
      aiContext: context,
      content: sanitizeHtml(previewContent)
    });
    onClose();
  };

  const wordCount = context.trim() ? context.trim().split(/\s+/).length : 0;
  const charCount = context.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-hidden" onClick={onClose}>
      <div 
        className="w-full max-w-5xl bg-white dark:bg-[#191919] rounded-2xl shadow-2xl overflow-hidden border border-[#EBEBE9] dark:border-[#2F2F2F] flex flex-col h-[85vh] animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Head Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EBEBE9] dark:border-[#2F2F2F] bg-gradient-to-r from-purple-50/10 to-transparent">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-sm shadow-purple-200 dark:shadow-none animate-pulse">
              <Sparkles size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#37352F] dark:text-[#E3E3E2] tracking-wide uppercase">AI Workspace Composer</h2>
              <p className="text-[11px] text-[#37352f7a] dark:text-gray-400 mt-0.5">Craft detailed instructions, configure rich contexts, and preview structured updates</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 px-1.5 rounded-lg hover:bg-[#F1F1F0] dark:hover:bg-[#2F2F2F] text-[#37352F] dark:text-gray-300 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Dynamic Mode Switcher Bar */}
        <div className="flex border-b border-[#EBEBE9] dark:border-[#2F2F2F] bg-slate-50/40 dark:bg-[#1d1d1d]/40 p-2.5 gap-2 select-none">
          <button
            onClick={() => {
              setActiveType('ai-summary');
              if (!prompt) setPrompt('Provide a tidy, structured summary of the content below.');
            }}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer",
              activeType === 'ai-summary' 
                ? "bg-purple-600 text-white shadow-sm" 
                : "text-gray-650 dark:text-gray-400 hover:bg-gray-150/60 dark:hover:bg-[#2A2A2A]"
            )}
          >
            <AlignLeft size={13} />
            <span>AI Summary</span>
          </button>

          <button
            onClick={() => {
              setActiveType('ai-draft');
              if (prompt === 'Provide a tidy, structured summary of the content below.') setPrompt('');
            }}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer",
              activeType === 'ai-draft' 
                ? "bg-purple-600 text-white shadow-sm" 
                : "text-gray-650 dark:text-gray-400 hover:bg-gray-150/60 dark:hover:bg-[#2A2A2A]"
            )}
          >
            <BookOpen size={13} />
            <span>AI Draft Writer</span>
          </button>

          <button
            onClick={() => {
              setActiveType('ai-rewrite');
              if (prompt === 'Provide a tidy, structured summary of the content below.') setPrompt('');
            }}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer",
              activeType === 'ai-rewrite' 
                ? "bg-purple-600 text-white shadow-sm" 
                : "text-gray-650 dark:text-gray-400 hover:bg-gray-150/60 dark:hover:bg-[#2A2A2A]"
            )}
          >
            <Edit3 size={13} />
            <span>AI Revision Tool</span>
          </button>
        </div>

        {/* Content Panel Box */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 bg-[#FCFBFB] dark:bg-[#161616]">
          
          {/* Left panel: Prompt Construction Area */}
          <div className="w-full md:w-[48%] border-r border-[#EBEBE9] dark:border-[#2F2F2F] flex flex-col overflow-y-auto p-5 space-y-4">
            
            {/* Context Inputs Field */}
            {activeType !== 'ai-draft' ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
                    <FileText size={12} />
                    <span>Source Text Material</span>
                  </label>
                  <button
                    onClick={pullPageContent}
                    className="text-[10px] text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/25 px-2 py-0.5 rounded-md transition-all font-bold border border-purple-150 dark:border-purple-900/40 select-none hover:underline flex items-center gap-1"
                  >
                    📥 Pull all document paragraphs
                  </button>
                </div>
                
                <div className="relative">
                  <textarea
                    className="w-full text-xs p-3 font-sans bg-white dark:bg-[#202020] border border-[#EBEBE9] dark:border-[#333] outline-none rounded-xl resize-y min-h-[140px] text-[#37352F] dark:text-gray-100 transition-all focus:ring-1 focus:ring-purple-400"
                    placeholder="Provide the raw texts, references, or context parameters that the AI will work upon..."
                    value={context}
                    onChange={e => setContext(e.target.value)}
                  />
                  {charCount > 0 && (
                    <div className="absolute bottom-2.5 right-3 text-[9px] font-mono text-gray-400 pointer-events-none select-none">
                      {wordCount} words • {charCount} chars
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <HelpCircle size={12} />
                    <span>Optional Draft Context</span>
                  </label>
                </div>
                <div className="relative">
                  <textarea
                    className="w-full text-xs p-3 font-sans bg-white dark:bg-[#202020] border border-[#EBEBE9] dark:border-[#333] outline-none rounded-xl resize-y min-h-[100px] text-[#37352F] dark:text-gray-100 transition-all focus:ring-1 focus:ring-purple-400"
                    placeholder="Add background context, keywords, outlines, tone guidelines, or list constraints (optional)..."
                    value={context}
                    onChange={e => setContext(e.target.value)}
                  />
                  {charCount > 0 && (
                    <div className="absolute bottom-2.5 right-3 text-[9px] font-mono text-gray-400 pointer-events-none select-none">
                      {wordCount} words • {charCount} chars
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Prompt Criteria Field */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-purple-650 dark:text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
                <LayoutTemplate size={12} />
                <span>
                  {activeType === 'ai-summary' ? 'Criteria / Style Guideline' : 
                   activeType === 'ai-draft' ? 'Describe what to draft' : 
                   'How should it be rewritten?'}
                </span>
              </label>
              
              <textarea
                className="w-full text-xs p-3 font-semibold bg-white dark:bg-[#202020] border border-purple-100 dark:border-[#3A3245] outline-none rounded-xl text-[#37352F] dark:text-gray-100 transition-all focus:ring-1 focus:ring-purple-400 min-h-[70px]"
                placeholder={
                  activeType === 'ai-summary' ? "Provide rules (e.g., Use bullet points, keep under 100 words, create glossary Table...)" :
                  activeType === 'ai-draft' ? "Write a tutorial teaching rust, draft an agenda for sync with team..." :
                  "Make it sound professional, convert to active verbs, streamline for readability..."
                }
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
              />
            </div>

            {/* Preset Buttons Grid */}
            <div className="space-y-2 pt-1">
              <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 tracking-widest block">Quick Studio Presets</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PRESETS[activeType as keyof typeof PRESETS]?.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => handleApplyPreset(preset.prompt)}
                    className="p-2 text-left text-[11px] rounded-xl border border-dashed border-[#EBEBE9] dark:border-[#2F2F2F] bg-white dark:bg-[#1E1E1E] text-gray-700 dark:text-gray-300 hover:bg-purple-50 hover:text-purple-700 dark:hover:bg-purple-950/20 hover:border-purple-300 transition-all cursor-pointer font-medium truncate"
                    title={preset.prompt}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="pt-4 border-t border-[#EBEBE9] dark:border-[#2F2F2F]">
              <button
                onClick={executeGeneration}
                disabled={
                  loading || 
                  (activeType === 'ai-summary' ? !context.trim() : 
                   activeType === 'ai-draft' ? !prompt.trim() : 
                   !(context.trim() && prompt.trim()))
                }
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm hover:shadow-purple-300 dark:shadow-none"
              >
                {loading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Play size={12} className="fill-current" />
                )}
                <span>Generate Workspace Output</span>
              </button>
            </div>
          </div>

          {/* Right panel: Side-by-Side Live Rendered Preview Output */}
          <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#191919]">
            
            {/* Header of preview area */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#EBEBE9] dark:border-[#2F2F2F] select-none bg-[#FBFAFB] dark:bg-[#1E1E1E]">
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#37352f50] dark:text-gray-400 flex items-center gap-1">
                <Maximize2 size={11} />
                Live Generated Document
              </span>
              
              {previewContent && !loading && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleCopy}
                    className="p-1.5 px-2 text-[11px] rounded bg-[#F4F4F3] dark:bg-[#2A2A2A] text-gray-750 hover:text-purple-650 dark:text-gray-300 transition-all font-semibold flex items-center gap-1.5 border border-[#EBEBE9] dark:border-none"
                  >
                    {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button 
                    onClick={executeGeneration}
                    className="p-1.5 px-2 text-[11px] rounded bg-[#F4F4F3] dark:bg-[#2A2A2A] text-gray-750 hover:text-purple-650 dark:text-gray-300 transition-all font-semibold flex items-center gap-1.5 border border-[#EBEBE9] dark:border-none"
                  >
                    <RefreshCw size={12} />
                    <span>Regen</span>
                  </button>
                </div>
              )}
            </div>

            {/* Generator Loading/Rendering viewport */}
            <div className="flex-1 overflow-y-auto p-6 font-sans">
              {loading ? (
                <div className="h-full flex flex-col items-center justify-center py-20 text-center space-y-4">
                  <div className="relative flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
                    <Sparkles className="absolute text-purple-600 animate-pulse" size={16} />
                  </div>
                  <div className="space-y-1.5 animate-pulse max-w-sm">
                    <p className="text-sm font-bold text-purple-700 dark:text-purple-400">
                      {steps[currentStepIndex]}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-550 leading-relaxed font-mono">
                      Querying advanced Gemini model engine parameters...
                    </p>
                  </div>
                </div>
              ) : error ? (
                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/15 border border-red-100 dark:border-red-900/30 text-rose-600 dark:text-rose-450 text-xs">
                  <div className="font-bold flex items-center gap-1 mb-1">
                    <X size={14} /> Failed Block Generation
                  </div>
                  <p className="leading-relaxed opacity-90">{error}</p>
                </div>
              ) : previewContent ? (
                <div className="space-y-4">
                  {/* Rich Editable Content Block */}
                  <div 
                    contentEditable
                    suppressContentEditableWarning
                    onInput={(e) => setPreviewContent(sanitizeHtml((e.target as HTMLDivElement).innerHTML))}
                    className="outline-none min-h-[250px] leading-relaxed break-words font-sans text-sm focus:ring-1 focus:ring-purple-200 p-2 rounded-xl dark:text-gray-200 markdown-body prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewContent) }}
                  />
                  
                  <div className="text-[10px] text-gray-400 select-none font-mono py-1 border-t border-[#F1F1F0] dark:border-zinc-800 flex items-center gap-1 bg-gray-50/50 dark:bg-transparent px-2.5 rounded-lg border">
                    <span>💡 Pro-tip: You can click inside the generated preview above to edit, polish, or append notes directly before inserting!</span>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center py-20 text-gray-400 space-y-3 dark:text-gray-500">
                  <Sparkles size={28} className="text-gray-300 dark:text-zinc-700 animate-pulse" />
                  <div className="space-y-1 max-w-xs">
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400">Preview Is Empty</p>
                    <p className="text-[11px] text-[#37352f7a] leading-relaxed">
                      Select a preset or customize prompt guidelines on the left, then click 'Generate' to fetch clean output.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Actions Footer Bar */}
            <div className="p-4 border-t border-[#EBEBE9] dark:border-[#2F2F2F] flex items-center justify-end gap-2.5 bg-[#FBFAFB] dark:bg-[#1E1E1E]">
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs text-gray-650 dark:text-gray-400 hover:bg-gray-150/70 dark:hover:bg-[#2D2D2D] rounded-xl font-semibold transition-all"
              >
                Discard Workspace
              </button>
              <button
                onClick={handleSaveAndClose}
                disabled={!previewContent && !prompt && !context}
                className="px-5 py-2 text-xs bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-xl font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Check size={13} />
                <span>Accept & Insert into Editor</span>
              </button>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
