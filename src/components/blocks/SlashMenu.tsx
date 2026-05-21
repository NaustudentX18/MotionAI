import React from 'react';
import { cn } from '../../lib/utils';
import { Type, Hash, CheckSquare, List, Minus, Quote, Sparkles, Wand2, Code, Lightbulb, Edit, Image } from 'lucide-react';
import { BlockType } from '../../types';

export interface SlashMenuAction {
  label: string;
  icon: React.ComponentType<{ size: number; strokeWidth?: number }>;
  type: BlockType | 'ai-custom' | 'ai-summary' | 'ai-draft' | 'ai-rewrite';
  description: string;
  category: string;
}

export const slashMenuActions: SlashMenuAction[] = [
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
  { label: 'Image', icon: Image, type: 'image', description: 'Upload an image', category: 'Basic Blocks' },
  { label: 'Draft with AI...', icon: Wand2, type: 'ai-custom', description: 'Ask AI to write or edit', category: 'AI Magic' },
  { label: 'AI Summary Block', icon: Sparkles, type: 'ai-summary', description: 'Prompt AI to summarize text', category: 'AI Magic' },
  { label: 'AI Draft Block', icon: Wand2, type: 'ai-draft', description: 'Draft text from prompts', category: 'AI Magic' },
  { label: 'AI Rewrite Block', icon: Edit, type: 'ai-rewrite', description: 'Prompt AI to edit or rewrite text', category: 'AI Magic' }
];

interface SlashMenuProps {
  isOpen: boolean;
  position: { top: number; left: number };
  query: string;
  selectedIndex: number;
  onAction: (action: SlashMenuAction) => void;
  onSelectIndex: (index: number) => void;
}

export function SlashMenu({ isOpen, position, query, selectedIndex, onAction, onSelectIndex }: SlashMenuProps) {
  if (!isOpen) return null;

  const filtered = slashMenuActions.filter(action =>
    action.label.toLowerCase().includes(query.toLowerCase()) ||
    action.description.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div
      className="slash-menu-container fixed z-50 w-[90%] max-w-[320px] bg-white dark:bg-[#1E1E1E] rounded-lg shadow-[0_4px_16px_rgba(15,15,15,0.25),0_0_0_1px_rgba(15,15,15,0.1)] border border-[#EBEBE9] dark:border-[#333333] overflow-hidden text-sm animate-in fade-in zoom-in-95 duration-100"
      style={{ top: Math.min(position.top + 24, window.innerHeight - 350), left: window.innerWidth < 640 ? '5%' : Math.max(10, Math.min(position.left, window.innerWidth - 330)) }}
    >
      {query && (
        <div className="px-3 py-1.5 text-[10px] bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 font-mono font-bold flex items-center justify-between border-b border-[#EBEBE9] dark:border-[#2F2F2F]">
          <span>FILTER: "{query.toUpperCase()}"</span>
          <span>{filtered.length} matches</span>
        </div>
      )}
      <div className="p-1 max-h-[300px] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-3 text-center text-xs text-[#37352f7a] dark:text-stone-500 font-medium">No commands found...</div>
        ) : (
          (() => {
            let lastCategory = '';
            return filtered.map((action, actionIdx) => {
              const showCategoryHeader = action.category !== lastCategory;
              lastCategory = action.category;
              const isSelected = actionIdx === selectedIndex;
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
                    onClick={() => onAction(action)}
                    onMouseEnter={() => onSelectIndex(actionIdx)}
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
  );
}

export default SlashMenu;
