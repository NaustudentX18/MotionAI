import React from 'react';
import { X, Check } from 'lucide-react';
import { escapeRegExp } from '../../lib/sanitize';

interface SpellingIssue {
  id: string;
  word: string;
  suggestions: string[];
  context: string;
  blockId: string;
}

interface SpellcheckPanelProps {
  spellingIssues: SpellingIssue[];
  blockRefs: React.RefObject<Record<string, HTMLDivElement | null>>;
  applySpellingCorrection: (blockId: string, originalWord: string, correction: string, issueId: string) => void;
  ignoreSpellingIssue: (issueId: string) => void;
  runSpellCheck: () => void;
}

export function SpellcheckPanel({ spellingIssues, blockRefs, applySpellingCorrection, ignoreSpellingIssue, runSpellCheck }: SpellcheckPanelProps) {
  if (spellingIssues.length === 0) {
    return (
      <div className="lg:col-span-1 bg-green-50/50 dark:bg-green-950/10 p-4 rounded-xl border border-green-200 dark:border-green-900/50 sticky top-4 w-full shadow-sm animate-in fade-in duration-200 pdf-exclude z-10 flex flex-col items-center text-center">
        <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-950/40 flex items-center justify-center text-green-600 dark:text-green-400 mb-3">
          <Check size={20} className="stroke-[3]" />
        </div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-green-800 dark:text-green-400 mb-1 font-sans">Clear!</h3>
        <p className="text-[11px] text-green-700/80 dark:text-green-500 mb-4 leading-relaxed font-sans">Zero spelling issues found.</p>
        <button onClick={() => runSpellCheck()} className="w-full text-center py-1.5 rounded-md border border-green-200 dark:border-green-900/40 text-[11px] text-green-800 dark:text-green-400 hover:bg-green-100/50 dark:hover:bg-green-950/30 transition-colors cursor-pointer font-semibold">Close Spellchecker</button>
      </div>
    );
  }

  return (
    <div className="lg:col-span-1 bg-[#F9F9F8] dark:bg-[#1C1C1C] p-4 rounded-xl border border-[#EBEBE9] dark:border-[#2F2F2F] sticky top-4 max-h-[calc(100vh-120px)] overflow-y-auto w-full shadow-sm animate-in slide-in-from-right duration-250 pdf-exclude z-10">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#EBEBE9] dark:border-[#2F2F2F]">
        <div className="flex items-center gap-1.5">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#37352F] dark:text-[#E3E3E3]">Spelling Check</h3>
        </div>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 font-mono">{spellingIssues.length}</span>
      </div>
      <p className="text-[11px] text-[#37352f8c] dark:text-gray-400 mb-3 leading-relaxed">Misspelled words found by AI.</p>
      <div className="space-y-3">
        {spellingIssues.map(issue => {
          const regexEscapedWord = escapeRegExp(issue.word);
          const parts = issue.context.split(new RegExp(`(${regexEscapedWord})`, 'gi'));
          return (
            <div key={issue.id} className="p-3 bg-white dark:bg-[#252525] rounded-l-md rounded-r-lg border border-[#EBEBE9] dark:border-[#2F2F2F] hover:border-amber-300 dark:hover:border-amber-800 transition-all shadow-xs flex flex-col gap-2">
              <div className="flex items-start justify-between gap-1">
                <span className="text-xs font-bold text-red-500 line-through truncate max-w-[140px]" title="Misspelled word">{issue.word}</span>
                <button onClick={() => ignoreSpellingIssue(issue.id)} className="text-gray-400 hover:text-gray-650 dark:hover:text-gray-200 p-0.5 rounded cursor-pointer shrink-0" title="Ignore"><X size={12} /></button>
              </div>
              {issue.context && (
                <div className="text-[11px] text-[#37352fbb] dark:text-gray-300 bg-[#F1F1F0]/50 dark:bg-[#1E1E1E]/50 px-2 py-1.5 rounded font-mono leading-normal break-words">
                  ...{parts.map((part, i) => (part.toLowerCase() === issue.word.toLowerCase() ? (<span key={i} className="text-red-500 font-bold underline decoration-wavy bg-red-500/10 px-0.5 rounded">{part}</span>) : (<span key={i}>{part}</span>)))}...
                </div>
              )}
              <div className="flex flex-wrap gap-1.5 mt-1 pt-1 border-t border-gray-100 dark:border-[#2F2F2F]">
                {issue.suggestions.map((suggestion, sIdx) => (
                  <button key={sIdx} onClick={() => applySpellingCorrection(issue.blockId, issue.word, suggestion, issue.id)} className="text-[10px] font-medium px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/20 dark:hover:bg-amber-900/40 dark:text-amber-300 border border-amber-200/50 dark:border-amber-900/50 transition-colors cursor-pointer">{suggestion}</button>
                ))}
              </div>
              <button onClick={() => { const el = blockRefs.current[issue.blockId]; if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); } }} className="text-[10px] text-gray-400 hover:text-gray-650 dark:hover:text-gray-300 mt-1 self-start font-medium cursor-pointer">🔍 Focus block</button>
            </div>
          );
        })}
      </div>
      <button onClick={() => runSpellCheck()} className="mt-4 w-full text-center py-1.5 rounded-md border border-[#EBEBE9] dark:border-[#2F2F2F] text-[11px] text-[#37352f8c] dark:text-gray-300 hover:bg-[#F1F1F0] dark:hover:bg-[#252525] transition-colors cursor-pointer font-semibold">Recheck Document</button>
    </div>
  );
}

export default SpellcheckPanel;
