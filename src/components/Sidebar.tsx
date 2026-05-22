import { useState } from 'react';
import { Page, PageType } from '../types';
import {
  FileText,
  Plus,
  LogOut,
  CheckSquare,
  HardDrive,
  Layout,
  ChevronDown,
  ChevronRight,
  PlusCircle,
  Trash2,
  Edit2,
  Table,
  Folder
} from 'lucide-react';
import { WorkspaceMeta } from '../lib/persistence';

interface SidebarProps {
  pages: Page[];
  currentPageId: string | null;
  onSelectPage: (id: string) => void;
  onAddPage: (pageType?: PageType, parentId?: string | null) => void;
  onDeletePage?: (id: string) => void;
  userEmail: string | null;
  onLogout: () => void;
  onLogin: () => void;
  onOpenDrive?: () => void;
  // Workspace props
  workspaces?: WorkspaceMeta[];
  currentWorkspace?: WorkspaceMeta | null;
  onSwitchWorkspace?: (workspace: WorkspaceMeta) => void;
  onCreateWorkspace?: (name: string) => void;
  onDeleteWorkspace?: (id: string) => void;
  onRenameWorkspace?: (id: string, name: string) => void;
}

interface PageTreeNode {
  page: Page;
  children: PageTreeNode[];
}

function buildTree(pages: Page[]): PageTreeNode[] {
  const nodeMap: Record<string, PageTreeNode> = {};
  const roots: PageTreeNode[] = [];

  // Initialize nodes
  pages.forEach(page => {
    nodeMap[page.id] = { page, children: [] };
  });

  // Build tree hierarchy
  pages.forEach(page => {
    const node = nodeMap[page.id];
    if (page.parentId && nodeMap[page.parentId]) {
      nodeMap[page.parentId].children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

interface SidebarItemProps {
  node: PageTreeNode;
  depth: number;
  currentPageId: string | null;
  onSelectPage: (id: string) => void;
  onAddPage: (pageType?: PageType, parentId?: string | null) => void;
  onDeletePage?: (id: string) => void;
  expandedPageIds: Record<string, boolean>;
  onToggleExpand: (id: string) => void;
}

function SidebarItem({
  node,
  depth,
  currentPageId,
  onSelectPage,
  onAddPage,
  onDeletePage,
  expandedPageIds,
  onToggleExpand,
}: SidebarItemProps) {
  const { page, children } = node;
  const isExpanded = expandedPageIds[page.id] ?? false;
  const isSelected = currentPageId === page.id;
  const hasChildren = children.length > 0;

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleExpand(page.id);
  };

  const handleItemClick = () => {
    onSelectPage(page.id);
  };

  const getIcon = () => {
    if (page.icon) return <span className="mr-1.5 shrink-0 text-sm select-none">{page.icon}</span>;
    if (page.pageType === 'canvas') return <Layout size={14} className="mr-1.5 shrink-0 text-amber-500" />;
    if (page.pageType === 'database') return <Table size={14} className="mr-1.5 shrink-0 text-purple-550" />;
    if (hasChildren) return <Folder size={14} className="mr-1.5 shrink-0 text-blue-500" />;
    return <FileText size={14} className="mr-1.5 shrink-0 text-stone-500" />;
  };

  return (
    <div className="w-full">
      <div
        style={{ paddingLeft: `${Math.max(4, depth * 12)}px` }}
        className={`group w-full flex items-center justify-between py-1.5 pr-2 rounded-md text-xs transition-colors cursor-pointer select-none ${
          isSelected 
            ? 'bg-[#EBEBE9] dark:bg-[#2F2F2F] font-semibold text-stone-900 dark:text-stone-150' 
            : 'hover:bg-[#EBEBE9]/50 dark:hover:bg-[#252525]/30 text-stone-750 dark:text-stone-400'
        }`}
        onClick={handleItemClick}
      >
        <div className="flex items-center min-w-0 flex-1">
          {/* Collapsible toggle chevron */}
          <button
            onClick={handleToggleExpand}
            className={`p-0.5 rounded-sm hover:bg-[#D9D8D6] dark:hover:bg-[#3F3F3F] shrink-0 mr-1 transition-opacity ${
              hasChildren ? 'opacity-100 cursor-pointer' : 'opacity-0 pointer-events-none w-4'
            }`}
          >
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
          
          {getIcon()}
          
          <span className="truncate">{page.title || 'Untitled'}</span>
        </div>

        {/* Action triggers */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddPage('block', page.id);
              if (!isExpanded) onToggleExpand(page.id);
            }}
            title="Add sub-page"
            className="p-0.5 rounded-sm hover:bg-[#D9D8D6] dark:hover:bg-[#3F3F3F] text-stone-550 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-150 cursor-pointer"
          >
            <Plus size={11} />
          </button>
          {onDeletePage && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete page "${page.title || 'Untitled'}" and all its sub-pages?`)) {
                  onDeletePage(page.id);
                }
              }}
              title="Delete page"
              className="p-0.5 rounded-sm hover:bg-red-100 dark:hover:bg-red-950/20 text-stone-550 dark:text-stone-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div className="mt-0.5 space-y-0.5">
          {children.map((child) => (
            <SidebarItem
              key={child.page.id}
              node={child}
              depth={depth + 1}
              currentPageId={currentPageId}
              onSelectPage={onSelectPage}
              onAddPage={onAddPage}
              onDeletePage={onDeletePage}
              expandedPageIds={expandedPageIds}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar({
  pages,
  currentPageId,
  onSelectPage,
  onAddPage,
  onDeletePage,
  userEmail,
  onLogout,
  onLogin,
  onOpenDrive,
  workspaces,
  currentWorkspace,
  onSwitchWorkspace,
  onCreateWorkspace,
  onDeleteWorkspace,
  onRenameWorkspace
}: SidebarProps) {
  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [expandedPageIds, setExpandedPageIds] = useState<Record<string, boolean>>({});

  const handleCreateWorkspace = () => {
    if (newWorkspaceName.trim() && onCreateWorkspace) {
      onCreateWorkspace(newWorkspaceName.trim());
      setNewWorkspaceName('');
      setIsCreating(false);
    }
  };

  const handleStartEdit = (workspace: WorkspaceMeta) => {
    setEditingWorkspaceId(workspace.id);
    setEditingName(workspace.name);
  };

  const handleSaveEdit = () => {
    if (editingWorkspaceId && editingName.trim() && onRenameWorkspace) {
      onRenameWorkspace(editingWorkspaceId, editingName.trim());
    }
    setEditingWorkspaceId(null);
    setEditingName('');
  };

  const toggleExpand = (id: string) => {
    setExpandedPageIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const treeRoots = buildTree(pages);

  return (
    <div className="w-[240px] h-screen bg-[#F7F6F3] dark:bg-[#151515] border-r border-[#EBEBE9] dark:border-[#2F2F2F] flex flex-col shrink-0 text-[#37352F] dark:text-stone-300 transition-colors">
      {/* Workspace Switcher */}
      {workspaces && workspaces.length > 0 && onSwitchWorkspace ? (
        <div className="p-2 mb-1 relative">
          <button
            onClick={() => setWorkspaceDropdownOpen(!workspaceDropdownOpen)}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-[#EBEBE9] dark:hover:bg-[#252525] transition-colors text-sm cursor-pointer"
          >
            <div className="flex items-center space-x-2 min-w-0">
              <div className="w-6 h-6 rounded bg-[#37352F] dark:bg-stone-100 flex items-center justify-center font-bold text-[10px] text-white dark:text-stone-900 shrink-0">
                {currentWorkspace?.name?.[0]?.toUpperCase() || 'W'}
              </div>
              <span className="font-semibold truncate">{currentWorkspace?.name || 'Select Workspace'}</span>
            </div>
            <ChevronDown size={14} className="shrink-0 opacity-55" />
          </button>

          {workspaceDropdownOpen && (
            <div className="absolute left-0 right-0 mx-2 mt-1 bg-white dark:bg-[#1C1C1C] border border-[#EBEBE9] dark:border-[#2F2F2F] rounded-lg shadow-lg z-50 max-h-[300px] overflow-y-auto">
              <div className="p-1">
                {workspaces.map(ws => (
                  <div key={ws.id} className="group flex items-center gap-1 px-2 py-1.5 rounded hover:bg-[#F1F1F0] dark:hover:bg-[#2F2F2F]">
                    {editingWorkspaceId === ws.id ? (
                      <div className="flex-1 flex items-center gap-1">
                        <input
                          type="text"
                          value={editingName}
                          onChange={e => setEditingName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleSaveEdit()}
                          onBlur={handleSaveEdit}
                          className="flex-1 px-1 py-0.5 text-sm border border-[#EBEBE9] dark:border-[#2F2F2F] rounded bg-white dark:bg-[#1C1C1C] text-stone-800 dark:text-stone-100 outline-none"
                          autoFocus
                        />
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => { onSwitchWorkspace(ws); setWorkspaceDropdownOpen(false); }}
                          className={`flex-1 text-left text-sm truncate cursor-pointer ${currentWorkspace?.id === ws.id ? 'font-semibold text-purple-600 dark:text-purple-400' : ''}`}
                        >
                          {ws.name}
                        </button>
                        {onRenameWorkspace && (
                          <button
                            onClick={() => handleStartEdit(ws)}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#EBEBE9] dark:hover:bg-[#3F3F3F] rounded transition-opacity cursor-pointer text-stone-500"
                          >
                            <Edit2 size={12} />
                          </button>
                        )}
                        {onDeleteWorkspace && workspaces.length > 1 && (
                          <button
                            onClick={() => { if (confirm(`Delete workspace "${ws.name}"?`)) onDeleteWorkspace(ws.id); }}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-950/20 rounded transition-opacity text-red-650 cursor-pointer"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                ))}

                {isCreating ? (
                  <div className="flex items-center gap-1 px-2 py-1.5">
                    <input
                      type="text"
                      value={newWorkspaceName}
                      onChange={e => setNewWorkspaceName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleCreateWorkspace();
                        if (e.key === 'Escape') { setIsCreating(false); setNewWorkspaceName(''); }
                      }}
                      onBlur={() => { if (!newWorkspaceName.trim()) { setIsCreating(false); } }}
                      placeholder="Workspace name..."
                      className="flex-1 px-1.5 py-0.5 text-sm border border-[#EBEBE9] dark:border-[#2F2F2F] rounded bg-white dark:bg-[#1C1C1C] text-stone-850 dark:text-stone-100 outline-none"
                      autoFocus
                    />
                    <button onClick={handleCreateWorkspace} className="p-1 hover:bg-[#EBEBE9] dark:hover:bg-[#3F3F3F] rounded cursor-pointer">
                      <Plus size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsCreating(true)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-[#37352f8c] dark:text-stone-400 hover:bg-[#F1F1F0] dark:hover:bg-[#2F2F2F] rounded cursor-pointer"
                  >
                    <PlusCircle size={14} />
                    <span>New Workspace</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 flex items-center space-x-2 mb-2 hover:bg-[#EBEBE9] dark:hover:bg-[#2F2F2F] cursor-pointer rounded mx-2 mt-2 transition-colors">
          <div className="w-6 h-6 rounded bg-[#37352F] dark:bg-stone-100 flex items-center justify-center font-bold text-[10px] text-white dark:text-stone-900">
            {userEmail ? userEmail[0].toUpperCase() : 'W'}
          </div>
          <span className="font-semibold text-sm truncate">{userEmail ? `${userEmail}'s Workspace` : 'Workspace AI'}</span>
        </div>
      )}

      {/* Pages list rendering */}
      <nav className="px-2 space-y-0.5 flex-1 overflow-y-auto">
        <div className="pt-4 pb-1 px-2 text-[10px] font-bold text-[#37352f7a] dark:text-stone-500 uppercase tracking-widest">
          Workspace Directory
        </div>
        
        <div className="space-y-0.5">
          {treeRoots.map(root => (
            <SidebarItem
              key={root.page.id}
              node={root}
              depth={0}
              currentPageId={currentPageId}
              onSelectPage={onSelectPage}
              onAddPage={onAddPage}
              onDeletePage={onDeletePage}
              expandedPageIds={expandedPageIds}
              onToggleExpand={toggleExpand}
            />
          ))}
          {treeRoots.length === 0 && (
            <div className="text-[11px] italic text-stone-400 p-2 select-none">No pages created yet.</div>
          )}
        </div>
      </nav>

      {/* Footer Add Buttons */}
      <div className="p-2 border-t border-[#EBEBE9] dark:border-[#2F2F2F] space-y-0.5 shrink-0 bg-stone-50/50 dark:bg-stone-900/10">
         <button onClick={() => onAddPage('block')} className="w-full flex items-center px-2 py-1.5 text-xs font-semibold rounded hover:bg-[#EBEBE9] dark:hover:bg-[#2F2F2F] text-stone-650 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 cursor-pointer">
           <span className="mr-2 text-sm">+</span> New Page
         </button>
         <button onClick={() => onAddPage('database')} className="w-full flex items-center px-2 py-1.5 text-xs font-semibold rounded hover:bg-[#EBEBE9] dark:hover:bg-[#2F2F2F] text-stone-650 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 cursor-pointer">
           <span className="mr-2"><Table size={13} /></span> New Database
         </button>
         <button onClick={() => onAddPage('canvas')} className="w-full flex items-center px-2 py-1.5 text-xs font-semibold rounded hover:bg-[#EBEBE9] dark:hover:bg-[#2F2F2F] text-stone-650 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 cursor-pointer">
           <span className="mr-2"><Layout size={13} /></span> New Canvas
         </button>
      </div>

      <div className="p-3 border-t border-[#EBEBE9] dark:border-[#2F2F2F] shrink-0">
        {userEmail ? (
          <div className="text-xs text-[#37352f7a] dark:text-stone-400 space-y-3 px-2">
             <div className="flex items-center gap-2 select-none">
                <CheckSquare size={14} className="opacity-50"/>
                <span>Google Tasks linked</span>
             </div>
             <button onClick={onOpenDrive} className="flex items-center gap-2 hover:text-purple-600 dark:hover:text-purple-400 transition-colors w-full text-left font-medium cursor-pointer">
                <HardDrive size={14} className="opacity-55 text-purple-600 dark:text-purple-400" />
                <span>Google Drive Sync</span>
             </button>
             <button onClick={onLogout} className="flex items-center gap-2 hover:text-[#37352F] dark:hover:text-stone-200 w-full cursor-pointer">
               <LogOut size={14} className="opacity-55" />
               <span>Log out</span>
             </button>
          </div>
        ) : (
           <button onClick={onLogin} className="w-full bg-white dark:bg-[#1E1E1E] border border-[#EBEBE9] dark:border-[#2F2F2F] hover:bg-[#F1F1F0] dark:hover:bg-[#252525] text-[#37352F] dark:text-stone-200 font-semibold py-1.5 px-3 rounded text-xs transition-colors cursor-pointer shadow-xs">
              Sign in with Google
           </button>
        )}
      </div>
    </div>
  );
}
