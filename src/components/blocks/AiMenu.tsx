import React from 'react';
import {
  Sparkles, MessageSquare, Edit, Lightbulb, Wand2, Languages,
  CheckSquare, Compass, ArrowRight, Bold, Italic, Underline
} from 'lucide-react';
import { Block } from '../../types';
import { cn } from '../../lib/utils';

interface AiMenuProps {
  aiMenuPos: { top: number; left: number };
  aiPrompt: string;
  aiLoading: boolean;
  aiResult: string | null;
  selectedText: string;
  focusedId: string | null;
  blocks: Block[];
  onSetAiPrompt: (prompt: string) => void;
  onRunAiCommand: (command: string, customPrompt?: string) => void;
  onHandleAiAction: (action: 'insert' | 'replace' | 'discard') => void;
  onToggleBlockStyleFlag: (blockId: string, flag: 'bold' | 'italic' | 'underline') => void;
  onConvertFocusedBlock: (newType: 'ai-summary' | 'ai-draft' | 'ai-rewrite') => void;
  onSetAiMenuOpen: (open: boolean) => void;
  onSetAiMenuPos: (pos: { top: number; left: number }) => void;
  onSetAiResult: (result: string | null) => void;
  onSetWorkspaceModalOpen: (open: boolean) => void;
}

export function AiMenu({
  aiMenuPos,
  aiPrompt,
  aiLoading,
  aiResult,
  selectedText,
  focusedId,
  blocks,
  onSetAiPrompt,
  onRunAiCommand,
  onHandleAiAction,
  onToggleBlockStyleFlag,
  onConvertFocusedBlock,
  onSetAiMenuOpen,
  onSetAiMenuPos,
  onSetAiResult,
  onSetWorkspaceModalOpen
}: AiMenuProps) {
  return (
    <div className="fixed z-50 overflow-hidden" style={{ top: Math.max(20, aiMenuPos.top), left: window.innerWidth < 640 ? 10 : Math.max(10, Math.min(aiMenuPos.left, window.innerWidth - 600)), width: window.innerWidth < 640 ? 'calc(100% - 20px)' : 'auto' }}>
      <div className="w-full sm:w-[600px] bg-white rounded-lg shadow-[0_0_0_1px_rgba(15,15,15,0.05),0_8px_16px_-4px_rgba(15,15,15,0.1)] border border-[#EBEBE9] overflow-hidden z-20">
        <div className="flex items-center px-3 py-2 border-b border-[#EBEBE9] bg-[#FBFAFB]">
          <div className="w-5 h-5 mr-2 flex items-center justify-center bg-purple-100 text-purple-600 rounded text-xs">✨</div>
          <input
            autoFocus
            className="flex-1 bg-transparent border-none outline-none text-sm placeholder-[#37352f4d]"
            placeholder="Ask AI to write or edit..."
            value={aiPrompt}
            onChange={e => onSetAiPrompt(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') onRunAiCommand('custom');
              if (e.key === 'Escape') { onSetAiMenuOpen(false); onSetAiResult(null); }
            }}
          />
          <button
            onClick={() => { onSetAiMenuOpen(false); onSetAiResult(null); }}
            className="text-[#37352f4d] hover:text-[#37352F]"
          >
            ×
          </button>
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
              <button
                className="px-3 py-1.5 text-sm bg-[#2EAADC] hover:bg-[#258ab5] text-white font-medium rounded transition-colors"
                onClick={() => onHandleAiAction('insert')}
              >
                Insert below
              </button>
              {selectedText && (
                <button
                  className="px-3 py-1.5 text-sm bg-[#F1F1F0] hover:bg-[#EBEBE9] text-[#37352F] font-medium rounded transition-colors"
                  onClick={() => onHandleAiAction('replace')}
                >
                  Replace selection
                </button>
              )}
              <button
                className="px-3 py-1.5 text-sm text-[#37352f8c] hover:text-[#37352F] font-medium rounded transition-colors ml-auto"
                onClick={() => onHandleAiAction('discard')}
              >
                Discard
              </button>
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
                    className="w-full text-left px-2 py-1.5 text-xs hover:bg-white dark:hover:bg-[#151515] text-[#37352F] dark:text-gray-200 cursor-pointer rounded flex items-center justify-between font-semibold border border-transparent hover:border-purple-200/50 dark:hover:border-purple-900/30 group transition-all"
                    onClick={() => onRunAiCommand('summarize')}
                  >
                    <div className="flex items-center gap-2"><MessageSquare size={13} className="text-purple-600" /><span>📝 Summarize Selection</span></div>
                    <span className="text-[9px] text-[#37352f55] dark:text-gray-400">Run AI</span>
                  </button>
                  <button
                    className="w-full text-left px-2 py-1.5 text-xs hover:bg-white dark:hover:bg-[#151515] text-[#37352F] dark:text-gray-200 cursor-pointer rounded flex items-center justify-between font-semibold border border-transparent hover:border-purple-200/50 dark:hover:border-purple-900/30 group transition-all"
                    onClick={() => onRunAiCommand('custom', 'Rewrite this specific selected text to be clearer, more elegant, and grammatically perfect:')}
                  >
                    <div className="flex items-center gap-2"><Edit size={13} className="text-purple-650" /><span>✍️ Rewrite Selection</span></div>
                    <span className="text-[9px] text-[#37352f55] dark:text-gray-400">Run AI</span>
                  </button>
                  <button
                    className="w-full text-left px-2 py-1.5 text-xs hover:bg-white dark:hover:bg-[#151515] text-[#37352F] dark:text-gray-200 cursor-pointer rounded flex items-center justify-between font-semibold border border-transparent hover:border-purple-200/50 dark:hover:border-purple-900/30 group transition-all"
                    onClick={() => onRunAiCommand('improve')}
                  >
                    <div className="flex items-center gap-2"><Sparkles size={13} className="text-amber-500" /><span>🪄 Improve & Polish Selection</span></div>
                    <span className="text-[9px] text-[#37352f55] dark:text-gray-400">Run AI</span>
                  </button>
                  <button
                    className="w-full text-left px-2 py-1.5 text-xs hover:bg-white dark:hover:bg-[#151515] text-[#37352F] dark:text-gray-200 cursor-pointer rounded flex items-center justify-between font-semibold border border-transparent hover:border-purple-200/50 dark:hover:border-purple-900/30 group transition-all"
                    onClick={() => onRunAiCommand('custom', 'Explain this highlighted word, concept or phrase in simple, clear terms:')}
                  >
                    <div className="flex items-center gap-2"><Lightbulb size={13} className="text-yellow-500" /><span>💡 Explain Selection Context</span></div>
                    <span className="text-[9px] text-[#37352f55] dark:text-gray-400">Run AI</span>
                  </button>

                  {focusedId && (
                    <div className="pt-1.5 border-t border-purple-200/50 dark:border-purple-900/30 mt-1 space-y-1 pdf-exclude">
                      <span className="px-2 py-0.5 text-[9px] font-bold text-slate-400 dark:text-gray-400 block uppercase tracking-wider">Style Focused Block</span>
                      <div className="flex gap-1 px-2 pb-1.55">
                        <button
                          onClick={() => onToggleBlockStyleFlag(focusedId, 'bold')}
                          className={cn(
                            "flex-1 py-1 px-1.5 rounded border text-[10px] font-bold flex items-center justify-center gap-0.5 transition-all cursor-pointer",
                            blocks.find(b => b.id === focusedId)?.style?.bold ? "bg-purple-100 dark:bg-purple-950/40 border-purple-300 text-purple-700 dark:text-purple-300" : "border-[#EBEBE9] dark:border-[#2F2F2F] text-[#37352F] dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                          )}
                        >
                          <Bold size={11} className="stroke-[2.5]" /><span>Bold</span>
                        </button>
                        <button
                          onClick={() => onToggleBlockStyleFlag(focusedId, 'italic')}
                          className={cn(
                            "flex-1 py-1 px-1.5 rounded border text-[10px] font-bold flex items-center justify-center gap-0.5 transition-all cursor-pointer",
                            blocks.find(b => b.id === focusedId)?.style?.italic ? "bg-purple-100 dark:bg-purple-950/40 border-purple-300 text-purple-700" : "border-[#EBEBE9] dark:border-[#2F2F2F] text-[#37352F] dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                          )}
                        >
                          <Italic size={11} className="stroke-[2.5]" /><span>Italic</span>
                        </button>
                        <button
                          onClick={() => onToggleBlockStyleFlag(focusedId, 'underline')}
                          className={cn(
                            "flex-1 py-1 px-1.5 rounded border text-[10px] font-bold flex items-center justify-center gap-0.5 transition-all cursor-pointer",
                            blocks.find(b => b.id === focusedId)?.style?.underline ? "bg-purple-100 dark:bg-purple-950/40 border-purple-300 text-purple-700" : "border-[#EBEBE9] dark:border-[#2F2F2F] text-[#37352F] dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                          )}
                        >
                          <Underline size={11} className="stroke-[2.5]" /><span>Underline</span>
                        </button>
                      </div>
                      <span className="px-2 py-0.5 text-[9px] font-bold text-purple-700/60 dark:text-purple-400 block uppercase tracking-wider">Convert Block Type</span>
                      <button
                        className="w-full text-left px-2 py-1.5 text-xs hover:bg-white dark:hover:bg-[#151515] text-[#37352F] dark:text-gray-200 cursor-pointer rounded flex items-center justify-between font-semibold border border-transparent hover:border-purple-200/50 dark:hover:border-purple-900/30 group transition-all"
                        onClick={() => onConvertFocusedBlock('ai-summary')}
                      >
                        <div className="flex items-center gap-2"><Sparkles size={11} className="text-purple-600" /><span>✨ Convert to AI Summary</span></div>
                        <span className="text-[9px] bg-purple-100 dark:bg-purple-900/40 text-purple-650 dark:text-purple-400 px-1 rounded font-mono font-bold">Block</span>
                      </button>
                      <button
                        className="w-full text-left px-2 py-1.5 text-xs hover:bg-white dark:hover:bg-[#151515] text-[#37352F] dark:text-gray-200 cursor-pointer rounded flex items-center justify-between font-semibold border border-transparent hover:border-purple-200/50 dark:hover:border-purple-900/30 group transition-all"
                        onClick={() => onConvertFocusedBlock('ai-draft')}
                      >
                        <div className="flex items-center gap-2"><Wand2 size={11} className="text-purple-600" /><span>🪄 Convert to AI Draft</span></div>
                        <span className="text-[9px] bg-purple-100 dark:bg-purple-900/40 text-purple-650 dark:text-purple-400 px-1 rounded font-mono font-bold">Block</span>
                      </button>
                      <button
                        className="w-full text-left px-2 py-1.5 text-xs hover:bg-white dark:hover:bg-[#151515] text-[#37352F] dark:text-gray-200 cursor-pointer rounded flex items-center justify-between font-semibold border border-transparent hover:border-purple-200/50 dark:hover:border-purple-900/30 group transition-all"
                        onClick={() => onConvertFocusedBlock('ai-rewrite')}
                      >
                        <div className="flex items-center gap-2"><Edit size={11} className="text-purple-600" /><span>✍️ Convert to AI Rewrite</span></div>
                        <span className="text-[9px] bg-purple-100 dark:bg-purple-900/40 text-purple-650 dark:text-purple-400 px-1 rounded font-mono font-bold">Block</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="px-2 py-1.5 text-[11px] font-bold text-[#37352f7a] uppercase tracking-wider">AI Actions</div>
            <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-[#F1F1F0] cursor-pointer rounded flex items-center gap-2" onClick={() => onRunAiCommand('improve')}><Sparkles size={16} className="opacity-60" /><span>Improve writing</span></button>
            <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-[#F1F1F0] cursor-pointer rounded flex items-center gap-2" onClick={() => onRunAiCommand('custom', 'Translate this text into Spanish (or specified language):')}><Languages size={15} className="opacity-60 text-orange-500" /><span>Translate text</span></button>
            <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-[#F1F1F0] cursor-pointer rounded flex items-center gap-2" onClick={() => onRunAiCommand('custom', 'Rewrite this paragraph to be more professional and clear:')}><Edit size={15} className="opacity-60 text-indigo-500" /><span>Rewrite text</span></button>
            <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-[#F1F1F0] cursor-pointer rounded flex items-center gap-2" onClick={() => onRunAiCommand('custom', 'Fix spelling and grammar mistakes in this text, keeping the tone the same:')}><CheckSquare size={15} className="opacity-60 text-teal-500" /><span>Check grammar</span></button>
            <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-purple-50 text-purple-600 dark:text-purple-400 font-semibold cursor-pointer rounded flex items-center gap-2 border-t border-[#EBEBE9] mt-1" onClick={() => onSetWorkspaceModalOpen(true)}><Compass size={15} className="opacity-80 stroke-[2.5]" /><span>Send to Google Workspace</span></button>
            <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-[#F1F1F0] cursor-pointer rounded flex items-center gap-2" onClick={() => onRunAiCommand('summarize')}><MessageSquare size={16} className="opacity-60" /><span>Summarize</span></button>
            <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-[#F1F1F0] cursor-pointer rounded flex items-center gap-2" onClick={() => onRunAiCommand('continue')}><ArrowRight size={16} className="opacity-60" /><span>Continue writing</span></button>
            <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-[#F1F1F0] cursor-pointer rounded flex items-center gap-2 border-t border-[#EBEBE9] mt-1" onClick={() => onRunAiCommand('extract')}><CheckSquare size={16} className="opacity-60" /><span>Extract to Google Tasks</span></button>

            <div className="px-2 py-1.5 mt-2 text-[11px] font-bold text-[#37352f7a] uppercase tracking-wider bg-white border-t border-[#EBEBE9]">Generate from scratch</div>
            <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-[#F1F1F0] cursor-pointer rounded flex items-center gap-2 mt-1" onClick={() => onRunAiCommand('brainstorm')}><span className="opacity-60">💡</span><span>Brainstorm ideas</span></button>
            <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-[#F1F1F0] cursor-pointer rounded flex items-center gap-2" onClick={() => onRunAiCommand('custom', 'Write a blog post about...')}><span className="opacity-60">📝</span><span>Draft a blog post</span></button>
            <button className="w-full text-left px-2 py-1.5 text-sm hover:bg-[#F1F1F0] cursor-pointer rounded flex items-center gap-2" onClick={() => onRunAiCommand('custom', 'Write a meeting agenda...')}><span className="opacity-60">🗒️</span><span>Draft an agenda</span></button>
          </div>
        )}
      </div>
    </div>
  );
}

export default AiMenu;
