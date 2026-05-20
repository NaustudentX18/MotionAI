import React, { useState, useEffect, useRef } from 'react';
import { Search, Sparkles, MessageSquare, Plus, Calendar, Hash, Type, CheckSquare } from 'lucide-react';
import { cn } from '../lib/utils';
import { Page } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  pages: Page[];
  onSelectPage: (id: string) => void;
  onAiAction: (action: string) => void;
}

export function CommandPalette({ isOpen, onClose, pages, onSelectPage, onAiAction }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

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

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] sm:pt-[20vh] bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200" 
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center px-4 py-3 border-b border-[#EBEBE9]">
          <Search size={20} className="text-[#37352f7a] mr-3" />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent border-none outline-none text-lg text-[#37352F] placeholder-[#37352f7a]"
            placeholder="Search pages or ask AI..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') onClose();
            }}
          />
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {aiCommands.length > 0 && (
            <div className="mb-4">
              <div className="px-3 py-1.5 text-[11px] font-bold text-[#37352f7a] uppercase tracking-wider">AI Actions</div>
              {aiCommands.map(cmd => (
                <button
                  key={cmd.id}
                  onClick={() => {
                    onAiAction(cmd.id);
                    onClose();
                  }}
                  className="w-full flex items-center px-3 py-2 text-sm text-[#37352F] hover:bg-[#F1F1F0] rounded-md transition-colors"
                >
                  <cmd.icon size={16} className={cn("mr-3", cmd.color)} />
                  {cmd.label}
                </button>
              ))}
            </div>
          )}

          {filteredPages.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[11px] font-bold text-[#37352f7a] uppercase tracking-wider">Pages</div>
              {filteredPages.map(page => (
                <button
                  key={page.id}
                  onClick={() => {
                    onSelectPage(page.id);
                    onClose();
                  }}
                  className="w-full flex items-center px-3 py-2 text-sm text-[#37352F] hover:bg-[#F1F1F0] rounded-md transition-colors"
                >
                  <span className="mr-3 text-[#37352f7a]">{page.icon || <Hash size={16} />}</span>
                  {page.title || 'Untitled'}
                </button>
              ))}
            </div>
          )}

          {query && aiCommands.length === 0 && filteredPages.length === 0 && (
            <div className="p-8 text-center text-[#37352f7a] text-sm">
              No results found for "{query}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
