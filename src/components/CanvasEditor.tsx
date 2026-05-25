import React, { useState } from 'react';
import {
  Tldraw,
  Editor,
  createShapeId,
  toRichText,
  type TLCreateShapePartial,
  type TLDefaultColorStyle,
  type TLGeoShape,
  type TLNoteShape,
  type TLShape,
  type TLShapePartial,
} from '@tldraw/tldraw';
import '@tldraw/tldraw/tldraw.css';
import { CANVAS_TEMPLATES, CanvasTemplate, CanvasTemplateShape } from '../lib/canvasTemplates';
import { Page } from '../types';
import { Layers, Plus, ExternalLink, ChevronLeft, ChevronRight, Sparkles, LayoutTemplate, Wand2 } from 'lucide-react';

interface CanvasEditorProps {
  pageId: string;
  pages: Page[];
  onSelectPage: (id: string) => void;
}

type CanvasCreateShape = TLCreateShapePartial<TLGeoShape> | TLCreateShapePartial<TLNoteShape>;

const TEMPLATE_ORIGIN_OFFSET = { x: -300, y: -200 } as const;
const NOTE_CLUSTER_GAP = 80;
const NOTE_CLUSTER_COLUMN_WIDTH = 170;
const NOTE_CLUSTER_ROW_HEIGHT = 145;

function isNoteShape(shape: TLShape): shape is TLNoteShape {
  return shape.type === 'note';
}

function createTemplateShape(shape: CanvasTemplateShape, centerX: number, centerY: number): CanvasCreateShape {
  const x = centerX + TEMPLATE_ORIGIN_OFFSET.x + shape.x;
  const y = centerY + TEMPLATE_ORIGIN_OFFSET.y + shape.y;

  if (shape.type === 'note') {
    return {
      id: createShapeId(),
      type: 'note',
      x,
      y,
      props: {
        richText: toRichText(shape.text),
        color: shape.color,
        font: 'sans',
        align: 'start',
        verticalAlign: 'start',
        growY: 0,
      },
    };
  }

  return {
    id: createShapeId(),
    type: 'geo',
    x,
    y,
    props: {
      geo: shape.geo ?? 'rectangle',
      w: shape.w,
      h: shape.h,
      richText: toRichText(shape.text),
      color: shape.color,
      fill: 'semi',
      font: 'sans',
      align: 'start',
      verticalAlign: 'start',
      growY: 0,
    },
  };
}

function getPageCardColor(page: Page): TLDefaultColorStyle {
  if (page.priority === 'Urgent') return 'red';
  if (page.priority === 'High') return 'orange';
  if (page.priority === 'Normal') return 'blue';
  return 'grey';
}

export function CanvasEditor({ pageId, pages, onSelectPage }: CanvasEditorProps) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(true);

  // Filters out the current canvas page to prevent embedding itself
  const embeddablePages = pages.filter(p => p.id !== pageId);

  const handleLoadTemplate = (template: CanvasTemplate) => {
    if (!editor) return;
    const { x: cx, y: cy } = editor.getViewportPageBounds().center;

    // Delete all existing shapes first so templates are predictable starter boards.
    const existingShapes = editor.getCurrentPageShapeIds();
    editor.deleteShapes([...existingShapes]);

    const shapesToCreate = template.shapes.map(shape => createTemplateShape(shape, cx, cy));
    editor.createShapes(shapesToCreate);
    editor.zoomToFit({ animation: { duration: 300 } });
  };

  const handleAiCluster = () => {
    if (!editor) return;

    // Truthful local scaffold: no model call yet. It clusters sticky notes by their
    // current tldraw color, then lays each color cluster into a readable grid.
    const notes = editor.getCurrentPageShapes().filter(isNoteShape);
    const { x: centerX, y: centerY } = editor.getViewportPageBounds().center;

    if (notes.length < 2) {
      editor.createShapes([
        {
          id: createShapeId(),
          type: 'note',
          x: centerX - 140,
          y: centerY - 40,
          props: {
            richText: toRichText('Local clustering needs at least 2 sticky notes. Add notes, then run this again.'),
            color: 'yellow',
            font: 'sans',
            align: 'start',
            verticalAlign: 'start',
            growY: 0,
          },
        },
      ]);
      return;
    }

    const notesByColor = new Map<TLDefaultColorStyle, TLNoteShape[]>();
    const orderedNotes = [...notes].sort((a, b) => (a.x - b.x) || (a.y - b.y));

    for (const note of orderedNotes) {
      const color = note.props.color || 'yellow';
      notesByColor.set(color, [...(notesByColor.get(color) ?? []), note]);
    }

    const clusters = [...notesByColor.entries()];
    const clusterWidths = clusters.map(([, clusterNotes]) => {
      const columns = Math.min(3, Math.ceil(Math.sqrt(clusterNotes.length)));
      return columns * NOTE_CLUSTER_COLUMN_WIDTH;
    });
    const totalWidth = clusterWidths.reduce((sum, width) => sum + width, 0) + NOTE_CLUSTER_GAP * Math.max(0, clusters.length - 1);

    let nextClusterX = centerX - totalWidth / 2;
    const updates: TLShapePartial<TLNoteShape>[] = [];

    clusters.forEach(([, clusterNotes], clusterIndex) => {
      const columns = Math.min(3, Math.ceil(Math.sqrt(clusterNotes.length)));
      const clusterWidth = clusterWidths[clusterIndex];
      const rows = Math.ceil(clusterNotes.length / columns);
      const clusterY = centerY - (rows * NOTE_CLUSTER_ROW_HEIGHT) / 2;

      clusterNotes.forEach((note, index) => {
        updates.push({
          id: note.id,
          type: 'note',
          x: nextClusterX + (index % columns) * NOTE_CLUSTER_COLUMN_WIDTH,
          y: clusterY + Math.floor(index / columns) * NOTE_CLUSTER_ROW_HEIGHT,
        });
      });

      nextClusterX += clusterWidth + NOTE_CLUSTER_GAP;
    });

    editor.updateShapes(updates);
    editor.zoomToFit({ animation: { duration: 300 } });
  };

  const handleEmbedPage = (page: Page) => {
    if (!editor) return;

    // Calculate center of screen with a small deterministic-looking spread so
    // repeated embeds do not stack exactly on top of each other.
    const { x, y } = editor.getViewportPageBounds().center;
    const priorityEmoji = page.priority === 'Urgent' ? '🔴' : page.priority === 'High' ? '🟠' : page.priority === 'Normal' ? '🔵' : '⚪';
    const dueDateText = page.dueDate ? `📅 Due: ${page.dueDate}` : '📅 No due date';
    const assigneeText = page.assignee ? `👤 Assignee: ${page.assignee}` : '👤 Unassigned';
    const cardText = `📄 ${page.title || 'Untitled'}\n\n${priorityEmoji} Priority: ${page.priority || 'None'}\n${assigneeText}\n${dueDateText}\n\nBlocks: ${page.blocks.length} elements`;
    const cardShape: TLCreateShapePartial<TLGeoShape> = {
      id: createShapeId(),
      type: 'geo',
      x: x - 110 + (Math.random() - 0.5) * 40,
      y: y - 75 + (Math.random() - 0.5) * 40,
      props: {
        geo: 'rectangle',
        w: 240,
        h: 150,
        richText: toRichText(cardText),
        font: 'sans',
        align: 'start',
        verticalAlign: 'start',
        growY: 0,
        fill: 'semi',
        color: getPageCardColor(page),
      },
    };

    editor.createShapes([cardShape]);
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
          <div className="p-4 border-b border-stone-200/60 dark:border-stone-800">
            <span className="font-bold text-stone-800 dark:text-stone-250 text-xs">Canvas Tools</span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {/* Templates Section */}
            <div className="mb-3">
              <div className="flex items-center gap-1.5 mb-2">
                <LayoutTemplate size={12} className="text-purple-500" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Templates</span>
              </div>
              <div className="space-y-1">
                {CANVAS_TEMPLATES.map(template => (
                  <button
                    key={template.id}
                    onClick={() => handleLoadTemplate(template)}
                    className="w-full text-left px-2.5 py-2 rounded-lg border border-stone-150 dark:border-stone-850 bg-stone-50/40 dark:bg-stone-900/10 hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-xs transition-all group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{template.icon}</span>
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-stone-750 dark:text-stone-250 group-hover:text-purple-600 dark:group-hover:text-purple-400">
                          {template.name}
                        </div>
                        <div className="text-[9px] text-stone-400 truncate">{template.description}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Smart canvas actions */}
            <div className="mb-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Wand2 size={12} className="text-amber-500" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Smart Actions</span>
              </div>
              <button
                onClick={handleAiCluster}
                className="w-full text-left px-2.5 py-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/10 hover:border-amber-400 dark:hover:border-amber-600 transition-all group"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">🧹</span>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-stone-750 dark:text-stone-250">
                      Cluster Sticky Notes
                    </div>
                    <div className="text-[9px] text-stone-400">Local scaffold: groups notes by color into grids.</div>
                  </div>
                </div>
              </button>
            </div>

            {/* Separator */}
            <div className="border-t border-stone-150 dark:border-stone-800 my-1" />
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles size={12} className="text-amber-500" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Embed Pages</span>
            </div>

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
