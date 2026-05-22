import React, { useState } from 'react';
import { Tldraw, Editor, createShapeId } from '@tldraw/tldraw';
import '@tldraw/tldraw/tldraw.css';
import { Page } from '../types';
import { Layers, Plus, ExternalLink, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

interface CanvasEditorProps {
  pageId: string;
  pages: Page[];
  onSelectPage: (id: string) => void;
}

export function CanvasEditor({ pageId, pages, onSelectPage }: CanvasEditorProps) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(true);

  // Filters out the current canvas page to prevent embedding itself
  const embeddablePages = pages.filter(p => p.id !== pageId);

  const handleEmbedPage = (page: Page) => {
    if (!editor) return;

    // Calculate center of screen or random offset
    const { x, y } = editor.getViewportPageBounds().center;
    const shapeId = createShapeId();

    const priorityEmoji = page.priority === 'Urgent' ? '🔴' : page.priority === 'High' ? '🟠' : page.priority === 'Normal' ? '🔵' : '⚪';
    const dueDateText = page.dueDate ? `📅 Due: ${page.dueDate}` : '📅 No due date';
    const assigneeText = page.assignee ? `👤 Assignee: ${page.assignee}` : '👤 Unassigned';
    
    // Create a beautiful structured rectangle card representing the page
    editor.createShapes([
      {
        id: shapeId,
        type: 'geo',
        x: x - 110 + (Math.random() - 0.5) * 40,
        y: y - 75 + (Math.random() - 0.5) * 40,
        props: {
          geo: 'rectangle',
          w: 240,
          h: 150,
          text: `📄 ${page.title || 'Untitled'}\n\n${priorityEmoji} Priority: ${page.priority || 'None'}\n${assigneeText}\n${dueDateText}\n\nBlocks: ${page.blocks.length} elements`,
          font: 'sans',
          align: 'start',
          verticalAlign: 'start',
          growY: 0,
          color: page.priority === 'Urgent' ? 'red' : page.priority === 'High' ? 'orange' : page.priority === 'Normal' ? 'blue' : 'grey'
        } as any
      }
    ]);
  };

  return (
    <div className="w-full h-full flex relative select-none">
      {/* Main Canvas Area */}
      <div className="flex-1 h-full relative">
        <Tldraw onMount={(tldrawEditor) => setEditor(tldrawEditor)} />
      </div>

      {/* Toggle Drawer Button */}
      <button
        onClick={() => setDrawerOpen(!drawerOpen)}
        className="absolute top-4 right-4 z-40 bg-white dark:bg-[#1E1E1E] border border-stone-200 dark:border-stone-850 p-2 rounded-lg shadow-md text-stone-650 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-900 cursor-pointer flex items-center gap-1.5 transition-all text-xs font-semibold"
      >
        <Layers size={13} />
        <span>{drawerOpen ? 'Hide Panel' : 'Workspace Pages'}</span>
        {drawerOpen ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* Floating Pages Drawer */}
      {drawerOpen && (
        <div className="w-72 border-l border-stone-200 dark:border-stone-800 bg-white/95 dark:bg-[#1C1C1C]/95 backdrop-blur-md h-full flex flex-col z-30 shrink-0 shadow-lg animate-in slide-in-from-right duration-200">
          <div className="p-4 border-b border-stone-200/60 dark:border-stone-800 flex items-center gap-2">
            <Sparkles size={14} className="text-amber-500" />
            <span className="font-bold text-stone-800 dark:text-stone-250 text-xs">Embed Workspace Cards</span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {embeddablePages.length === 0 ? (
              <div className="text-center py-8 text-stone-400 italic text-[11px]">
                No other pages in workspace to embed.
              </div>
            ) : (
              embeddablePages.map(page => {
                const priorityBadge = page.priority ? (
                  <span className={`text-[8px] font-extrabold px-1 py-0.5 rounded uppercase tracking-wide shrink-0 ${
                    page.priority === 'Urgent' ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' :
                    page.priority === 'High' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' :
                    'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                  }`}>
                    {page.priority}
                  </span>
                ) : null;

                return (
                  <div
                    key={page.id}
                    className="p-2.5 border border-stone-150 dark:border-stone-850 rounded-lg hover:border-stone-300 dark:hover:border-stone-700 bg-stone-50/40 dark:bg-stone-900/10 flex items-center justify-between gap-2 group transition-all"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="shrink-0">{page.icon || '📄'}</span>
                        <span className="font-semibold text-stone-750 dark:text-stone-250 truncate block text-[11px]">
                          {page.title || 'Untitled'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[9px] text-stone-400 capitalize">{page.pageType || 'Document'}</span>
                        {priorityBadge}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => handleEmbedPage(page)}
                        title="Embed as Card shape on Canvas"
                        className="p-1 bg-purple-50 dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-900 text-purple-650 dark:text-purple-400 rounded-md cursor-pointer transition-colors"
                      >
                        <Plus size={12} />
                      </button>
                      <button
                        onClick={() => onSelectPage(page.id)}
                        title="Go to Page"
                        className="p-1 hover:bg-stone-200 dark:hover:bg-stone-850 text-stone-500 hover:text-stone-800 dark:hover:text-stone-350 rounded-md cursor-pointer transition-colors"
                      >
                        <ExternalLink size={12} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
