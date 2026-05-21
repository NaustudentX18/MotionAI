import React from 'react';
import { Mic, MicOff, Compass } from 'lucide-react';
import { cn } from '../../lib/utils';

interface BottomBarProps {
  selectedText: string;
  isListening: boolean;
  onToggleListening: () => void;
  onOpenAiMenu: () => void;
  onOpenWorkspace: () => void;
}

export function BottomBar({
  selectedText,
  isListening,
  onToggleListening,
  onOpenAiMenu,
  onOpenWorkspace
}: BottomBarProps) {
  return (
    <div className="fixed bottom-8 right-6 md:right-8 flex space-x-2 z-30">
      {selectedText && (
        <button
          onClick={onOpenWorkspace}
          className="h-10 px-4 bg-purple-600 text-white shadow-md rounded-full flex items-center hover:bg-purple-700 text-sm font-medium transition-colors"
        >
          <Compass size={16} className="mr-1.5 animate-pulse" /> Workspace Actions
        </button>
      )}
      <button
        onClick={onToggleListening}
        className={cn(
          "w-10 h-10 border border-[#EBEBE9] shadow-md rounded-full flex items-center justify-center transition-colors",
          isListening ? "bg-red-50 text-red-500 border-red-200" : "bg-white hover:bg-[#F1F1F0] text-[#37352f7a]"
        )}
      >
        {isListening ? <Mic size={18} /> : <MicOff size={18} />}
      </button>
      <button
        onClick={onOpenAiMenu}
        className="h-10 px-4 bg-white border border-[#EBEBE9] shadow-md rounded-full flex items-center hover:bg-[#F1F1F0] text-sm font-medium transition-colors"
      >
        <span className="text-purple-600 mr-2">✨</span> Ask AI
      </button>
    </div>
  );
}

export default BottomBar;
