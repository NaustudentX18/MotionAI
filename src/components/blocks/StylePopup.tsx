import React from 'react';
import { Bold, Italic, Underline, X, Sparkles, Wand2, Edit } from 'lucide-react';
import { cn } from '../../lib/utils';
import { TEXT_COLORS, BG_COLORS } from '../../lib/blockUtils';

interface StylePopupProps {
  blockId: string;
  style?: { bold?: boolean; italic?: boolean; underline?: boolean; color?: string; backgroundColor?: string };
  onToggleFlag: (blockId: string, flag: 'bold' | 'italic' | 'underline') => void;
  onUpdateColor: (blockId: string, type: 'color' | 'backgroundColor', value: string) => void;
  onUpdateBlock: (id: string, updates: any) => void;
  onClose: () => void;
}

export function StylePopup({ blockId, style, onToggleFlag, onUpdateColor, onUpdateBlock, onClose }: StylePopupProps) {
  return (
    <div className="absolute right-0 top-8 bg-white dark:bg-[#252525] border border-[#EBEBE9] dark:border-[#2F2F2F] rounded-lg shadow-lg p-3 z-30 w-72 text-xs text-[#37352F] dark:text-gray-200 pdf-exclude">
      <div className="flex items-center justify-between mb-2 pb-1 border-b border-[#EBEBE9] dark:border-[#2F2F2F]">
        <span className="font-bold uppercase tracking-wider text-[10px] text-gray-400">Block Styling</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={12} /></button>
      </div>
      <div className="flex gap-1 mb-3">
        <button onClick={() => onToggleFlag(blockId, 'bold')} className={cn("p-1.5 rounded border transition-colors flex-1 flex justify-center", style?.bold ? "bg-purple-100 border-purple-300 text-purple-700 font-bold" : "border-[#EBEBE9] dark:border-[#373737] hover:bg-gray-50 dark:hover:bg-gray-800")}><Bold size={13} /></button>
        <button onClick={() => onToggleFlag(blockId, 'italic')} className={cn("p-1.5 rounded border transition-colors flex-1 flex justify-center", style?.italic ? "bg-purple-100 border-purple-300 text-purple-700 font-bold" : "border-[#EBEBE9] dark:border-[#373737] hover:bg-gray-50 dark:hover:bg-gray-800")}><Italic size={13} /></button>
        <button onClick={() => onToggleFlag(blockId, 'underline')} className={cn("p-1.5 rounded border transition-colors flex-1 flex justify-center", style?.underline ? "bg-purple-100 border-purple-300 text-purple-700 font-bold" : "border-[#EBEBE9] dark:border-[#373737] hover:bg-gray-50 dark:hover:bg-gray-800")}><Underline size={13} /></button>
      </div>
      <div className="space-y-3">
        <div>
          <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Text Color</span>
          <div className="grid grid-cols-5 gap-1.5">
            {TEXT_COLORS.map(c => (
              <button key={c.name} onClick={() => onUpdateColor(blockId, 'color', c.value)} className="w-6 h-6 rounded-full border border-gray-200 dark:border-gray-700 cursor-pointer flex items-center justify-center text-[9px] relative hover:scale-105 transition-transform" style={{ backgroundColor: c.value === 'inherit' ? '#37352F' : c.value }} title={c.name}>
                {style?.color === c.value && <Check size={11} className="text-white mix-blend-difference" />}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Background Color</span>
          <div className="grid grid-cols-5 gap-1.5">
            {BG_COLORS.map(bg => (
              <button key={bg.name} onClick={() => onUpdateColor(blockId, 'backgroundColor', bg.value)} className="w-6 h-6 rounded border border-gray-200 dark:border-gray-700 cursor-pointer flex items-center justify-center text-[9px] hover:scale-105 transition-transform" style={{ backgroundColor: bg.value }} title={bg.name}>
                {style?.backgroundColor === bg.value && <Check size={11} className="text-black" />}
              </button>
            ))}
          </div>
        </div>
        <div className="pt-2.5 border-t border-[#EBEBE9] dark:border-[#2F2F2F] mt-1.5">
          <span className="text-[10px] uppercase font-bold text-purple-600 dark:text-purple-400 block mb-1">⚡ AI Conversion Tools</span>
          <div className="flex flex-col gap-0.5">
            <button onClick={() => { onUpdateBlock(blockId, { type: 'ai-summary', aiContext: '', aiPrompt: 'Provide a tidy, structured summary of the content below.' }); onClose(); }} className="flex items-center gap-1.5 w-full text-left p-1 rounded hover:bg-purple-50 dark:hover:bg-purple-950/20 text-purple-750 dark:text-purple-400 font-semibold transition-colors cursor-pointer"><Sparkles size={11} /><span>Convert to AI Summary Block</span></button>
            <button onClick={() => { onUpdateBlock(blockId, { type: 'ai-draft', aiPrompt: '', aiContext: '' }); onClose(); }} className="flex items-center gap-1.5 w-full text-left p-1 rounded hover:bg-purple-50 dark:hover:bg-purple-950/20 text-purple-750 dark:text-purple-400 font-semibold transition-colors cursor-pointer"><Wand2 size={11} /><span>Convert to AI Draft Block</span></button>
            <button onClick={() => { onUpdateBlock(blockId, { type: 'ai-rewrite', aiContext: '', aiPrompt: 'Make this content professional and clearer.' }); onClose(); }} className="flex items-center gap-1.5 w-full text-left p-1 rounded hover:bg-purple-50 dark:hover:bg-purple-950/20 text-purple-750 dark:text-purple-400 font-semibold transition-colors cursor-pointer"><Edit size={11} /><span>Convert to AI Rewrite Block</span></button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { Check } from 'lucide-react';
export default StylePopup;
