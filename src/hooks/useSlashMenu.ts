import React, { useState, useEffect } from 'react';
import {
  Type, Hash, CheckSquare, List, Minus, Quote, Sparkles,
  Wand2, Code, Lightbulb, Edit
} from 'lucide-react';
import { Block, BlockType } from '../types';

export interface SlashMenuAction {
  label: string;
  icon: React.ComponentType<{ size: number; strokeWidth?: number }>;
  type: BlockType | 'ai-custom' | 'ai-summary' | 'ai-draft' | 'ai-rewrite';
  description: string;
  category: string;
}

const slashMenuActions: SlashMenuAction[] = [
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

export function useSlashMenu(blocks: Block[], focusedId: string | null) {
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashMenuPos, setSlashMenuPos] = useState({ top: 0, left: 0 });
  const [slashQuery, setSlashQuery] = useState('');
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);

  // Reset selected index on query change
  useEffect(() => {
    setSlashSelectedIndex(0);
  }, [slashQuery]);

  // Close slash menu on outside click
  useEffect(() => {
    if (!slashMenuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.slash-menu-container')) {
        setSlashMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [slashMenuOpen]);

  const filteredSlashActions = slashMenuActions.filter(action =>
    action.label.toLowerCase().includes(slashQuery.toLowerCase()) ||
    action.description.toLowerCase().includes(slashQuery.toLowerCase())
  );

  const openSlashMenu = (position: { top: number; left: number }) => {
    setSlashMenuPos(position);
    setSlashMenuOpen(true);
  };

  const closeSlashMenu = () => {
    setSlashMenuOpen(false);
    setSlashQuery('');
    setSlashSelectedIndex(0);
  };

  const handleSlashKeyDown = (
    e: React.KeyboardEvent,
    handleSlashAction: (action: SlashMenuAction) => void
  ) => {
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
      closeSlashMenu();
      return;
    }
  };

  return {
    slashMenuOpen,
    setSlashMenuOpen,
    slashMenuPos,
    setSlashMenuPos,
    slashQuery,
    setSlashQuery,
    slashSelectedIndex,
    setSlashSelectedIndex,
    filteredSlashActions,
    slashMenuActions,
    openSlashMenu,
    closeSlashMenu,
    handleSlashKeyDown
  };
}
