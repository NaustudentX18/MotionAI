import React from 'react';
import { Sparkles, Download, RefreshCw, Save, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface TopBarProps {
  saveStatus: 'saved' | 'saving' | 'dirty' | 'error';
  lastSavedTime: string;
  showSpellcheck: boolean;
  spellCheckLoading: boolean;
  exportingPdf: boolean;
  onTriggerManualSave: () => void;
  onRunSpellCheck: () => void;
}

export function TopBar({
  saveStatus,
  lastSavedTime,
  showSpellcheck,
  spellCheckLoading,
  exportingPdf,
  onTriggerManualSave,
  onRunSpellCheck
}: TopBarProps) {
  return (
    <div className="flex items-center justify-between mb-8 pb-4 border-b border-[#EBEBE9] dark:border-[#2F2F2F] pdf-exclude">
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400 font-medium tracking-wide uppercase hidden sm:inline">MotionAI workspace</span>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#F4F4F3] dark:bg-[#1E1E1E] border border-[#EBEBE9] dark:border-[#2F2F2F] text-[10px] font-mono leading-none select-none">
          {saveStatus === 'saving' && (<span className="flex items-center gap-1 text-purple-650 dark:text-purple-400"><RefreshCw size={10} className="animate-spin" /><span>Saving draft...</span></span>)}
          {saveStatus === 'saved' && (<span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" /><span>Auto-saved {lastSavedTime}</span></span>)}
          {saveStatus === 'dirty' && (<button onClick={onTriggerManualSave} className="flex items-center gap-1 text-amber-600 dark:text-amber-400 hover:text-amber-700 transition-colors cursor-pointer font-bold" title="Unsaved modifications"><Save size={10} /><span>Unsaved (Save Now)</span></button>)}
          {saveStatus === 'error' && (<span className="text-rose-500 font-bold flex items-center gap-1"><X size={10} /><span>Error Saving</span></span>)}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onRunSpellCheck} disabled={spellCheckLoading} className={cn("flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md shadow-sm transition-all cursor-pointer border", showSpellcheck ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 font-bold" : "bg-white hover:bg-[#F1F1F0] dark:bg-[#1E1E1E] dark:hover:bg-[#2F2F2F] border-[#EBEBE9] dark:border-[#2F2F2F] text-gray-600 dark:text-gray-300 font-medium")} title="Check spelling">
          {spellCheckLoading ? (<div className="w-3.5 h-3.5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin mr-1" />) : (<Sparkles size={13} className={cn("transition-colors", showSpellcheck ? "text-amber-500 animate-pulse" : "text-gray-400")} />)}
          <span>{spellCheckLoading ? 'Analyzing...' : showSpellcheck ? 'Close Spellcheck' : 'Spellcheck'}</span>
        </button>
        <button onClick={() => {}} disabled={exportingPdf} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition-colors cursor-pointer"><Download size={13} />{exportingPdf ? 'Exporting PDF...' : 'Export to PDF'}</button>
      </div>
    </div>
  );
}

export default TopBar;
