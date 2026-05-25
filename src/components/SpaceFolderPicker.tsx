import React, { useState, useMemo } from 'react';
import { Page } from '../types';
import { cn } from '../lib/utils';
import { ChevronRight, ChevronDown, Folder, Layers, FileText, Layout, Table, BarChart3, X } from 'lucide-react';

interface SpaceFolderPickerProps {
  pages: Page[];
  currentPageId: string;
  currentParentId: string | null | undefined;
  onMove: (pageId: string, newParentId: string | null) => void;
  onClose: () => void;
}

interface TreeNode {
  page: Page;
  children: TreeNode[];
}

function buildTree(pages: Page[], excludeId?: string): TreeNode[] {
  const nodeMap: Record<string, TreeNode> = {};
  const roots: TreeNode[] = [];

  pages.forEach(page => {
    if (page.id === excludeId) return;
    nodeMap[page.id] = { page, children: [] };
  });

  pages.forEach(page => {
    if (page.id === excludeId) return;
    const node = nodeMap[page.id];
    if (!node) return;
    if (page.parentId && nodeMap[page.parentId]) {
      nodeMap[page.parentId].children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

function getPageIcon(page: Page, hasChildren: boolean) {
  if (page.pageType === 'space') return <Layers size={14} className="shrink-0 text-indigo-500" />;
  if (page.pageType === 'folder') return <Folder size={14} className="shrink-0 text-blue-500" />;
  if (page.pageType === 'canvas') return <Layout size={14} className="shrink-0 text-amber-500" />;
  if (page.pageType === 'database') return <Table size={14} className="shrink-0 text-purple-500" />;
  if (page.pageType === 'dashboard') return <BarChart3 size={14} className="shrink-0 text-green-500" />;
  if (hasChildren) return <Folder size={14} className="shrink-0 text-blue-400" />;
  return <FileText size={14} className="shrink-0 text-stone-500" />;
}

function TreeNodeItem({
  node,
  depth,
  selectedParentId,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  selectedParentId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedParentId === node.page.id;

  // Skip non-container types for parent selection when they have no children
  const isContainer = node.page.pageType === 'space' || node.page.pageType === 'folder';

  return (
    <div>
      <div
        style={{ paddingLeft: `${depth * 14}px` }}
        className={cn(
          'flex items-center gap-1.5 py-1.5 pr-2 rounded-md text-xs cursor-pointer transition-colors group',
          isSelected
            ? 'bg-purple-100 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300'
            : 'hover:bg-gray-100 dark:hover:bg-stone-800 text-[#37352F] dark:text-[#E3E3E3]'
        )}
        onClick={() => onSelect(node.page.id)}
      >
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="p-0.5 rounded-sm hover:bg-gray-200 dark:hover:bg-stone-700 shrink-0"
          >
            {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        {getPageIcon(node.page, hasChildren)}
        <span className="truncate flex-1">{node.page.title || 'Untitled'}</span>
        {isContainer && (
          <span className="text-[9px] px-1 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
            container
          </span>
        )}
        {isSelected && (
          <span className="text-[9px] text-purple-500 font-medium">selected</span>
        )}
      </div>
      {hasChildren && expanded && (
        <div>
          {node.children.map(child => (
            <TreeNodeItem
              key={child.page.id}
              node={child}
              depth={depth + 1}
              selectedParentId={selectedParentId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function SpaceFolderPicker({
  pages,
  currentPageId,
  currentParentId,
  onMove,
  onClose,
}: SpaceFolderPickerProps) {
  const [selectedParentId, setSelectedParentId] = useState<string | null>(currentParentId ?? null);
  const tree = useMemo(() => buildTree(pages, currentPageId), [pages, currentPageId]);

  // Find current parent title
  const currentParent = currentParentId ? pages.find(p => p.id === currentParentId) : null;

  const handleMove = () => {
    // Don't allow moving to same parent
    if (selectedParentId === (currentParentId ?? null)) {
      onClose();
      return;
    }
    onMove(currentPageId, selectedParentId);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}>
      <div className="w-full max-w-sm bg-white dark:bg-[#1C1C1C] rounded-xl border border-gray-200 dark:border-stone-700 shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-stone-700">
          <div>
            <h3 className="text-sm font-semibold text-[#37352F] dark:text-[#E3E3E3]">Move to…</h3>
            <p className="text-[10px] text-gray-400 dark:text-stone-500 mt-0.5">
              {currentParent
                ? `Current location: ${currentParent.title || 'Untitled'}`
                : 'Current location: Root (no parent)'}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-stone-700 text-gray-400">
            <X size={14} />
          </button>
        </div>

        {/* Root option */}
        <div className="max-h-64 overflow-y-auto p-2">
          <div
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-md text-xs cursor-pointer transition-colors',
              selectedParentId === null
                ? 'bg-purple-100 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300'
                : 'hover:bg-gray-100 dark:hover:bg-stone-800 text-[#37352F] dark:text-[#E3E3E3]'
            )}
            onClick={() => setSelectedParentId(null)}
          >
            <Layers size={14} className="shrink-0 text-stone-400" />
            <span>Root (no parent)</span>
            {selectedParentId === null && (
              <span className="text-[9px] text-purple-500 font-medium ml-auto">selected</span>
            )}
          </div>

          {/* Tree */}
          <div className="mt-1">
            {tree.map(node => (
              <TreeNodeItem
                key={node.page.id}
                node={node}
                depth={0}
                selectedParentId={selectedParentId}
                onSelect={setSelectedParentId}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 dark:border-stone-700 bg-gray-50/50 dark:bg-stone-900/30">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg text-gray-600 dark:text-stone-300 hover:bg-gray-100 dark:hover:bg-stone-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleMove}
            className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors"
          >
            Move Here
          </button>
        </div>
      </div>
    </div>
  );
}
