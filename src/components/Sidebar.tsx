import { useState } from 'react';
import { Page, PageType } from '../types';
import { FileText, Plus, LogOut, CheckSquare, HardDrive, Layout, ChevronDown, PlusCircle, Trash2, Edit2 } from 'lucide-react';
import { WorkspaceMeta } from '../lib/persistence';

interface SidebarProps {
  pages: Page[];
  currentPageId: string | null;
  onSelectPage: (id: string) => void;
  onAddPage: (pageType?: PageType) => void;
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

export function Sidebar({ pages, currentPageId, onSelectPage, onAddPage, userEmail, onLogout, onLogin, onOpenDrive, workspaces, currentWorkspace, onSwitchWorkspace, onCreateWorkspace, onDeleteWorkspace, onRenameWorkspace }: SidebarProps) {
  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

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

  return (
    <div className="w-[240px] h-screen bg-[#F7F6F3] border-r border-[#EBEBE9] flex flex-col shrink-0 text-[#37352F]">
      {/* Workspace Switcher */}
      {workspaces && workspaces.length > 0 && onSwitchWorkspace ? (
        <div className="p-2 mb-1 relative">
          <button
            onClick={() => setWorkspaceDropdownOpen(!workspaceDropdownOpen)}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-[#EBEBE9] transition-colors text-sm"
          >
            <div className="flex items-center space-x-2 min-w-0">
              <div className="w-6 h-6 rounded bg-[#37352F] flex items-center justify-center font-bold text-[10px] text-white shrink-0">
                {currentWorkspace?.name?.[0]?.toUpperCase() || 'W'}
              </div>
              <span className="font-medium truncate">{currentWorkspace?.name || 'Select Workspace'}</span>
            </div>
            <ChevronDown size={14} className="shrink-0 opacity-50" />
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
                          className="flex-1 px-1 py-0.5 text-sm border border-[#EBEBE9] dark:border-[#2F2F2F] rounded bg-white dark:bg-[#1C1C1C]"
                          autoFocus
                        />
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => { onSwitchWorkspace(ws); setWorkspaceDropdownOpen(false); }}
                          className={`flex-1 text-left text-sm truncate ${currentWorkspace?.id === ws.id ? 'font-semibold' : ''}`}
                        >
                          {ws.name}
                        </button>
                        {onRenameWorkspace && (
                          <button
                            onClick={() => handleStartEdit(ws)}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#EBEBE9] dark:hover:bg-[#3F3F3F] rounded transition-opacity"
                          >
                            <Edit2 size={12} />
                          </button>
                        )}
                        {onDeleteWorkspace && workspaces.length > 1 && (
                          <button
                            onClick={() => { if (confirm(`Delete workspace "${ws.name}"?`)) onDeleteWorkspace(ws.id); }}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-opacity text-red-600"
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
                      className="flex-1 px-1 py-0.5 text-sm border border-[#EBEBE9] dark:border-[#2F2F2F] rounded bg-white dark:bg-[#1C1C1C]"
                      autoFocus
                    />
                    <button onClick={handleCreateWorkspace} className="p-1 hover:bg-[#EBEBE9] dark:hover:bg-[#3F3F3F] rounded">
                      <Plus size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsCreating(true)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-[#37352f8c] hover:bg-[#F1F1F0] dark:hover:bg-[#2F2F2F] rounded"
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
        <div className="p-4 flex items-center space-x-2 mb-2 hover:bg-[#EBEBE9] cursor-pointer rounded mx-2 mt-2 transition-colors">
          <div className="w-6 h-6 rounded bg-[#37352F] flex items-center justify-center font-bold text-[10px] text-white">
            {userEmail ? userEmail[0].toUpperCase() : 'W'}
          </div>
          <span className="font-medium text-sm truncate">{userEmail ? `${userEmail}'s Workspace` : 'Workspace AI'}</span>
        </div>
      )}

      <nav className="px-2 space-y-0.5 flex-1 overflow-y-auto">
        <div className="pt-4 pb-1 px-2 text-[11px] font-semibold text-[#37352f7a] uppercase tracking-wider">Workspace</div>
        
        {pages.map(page => (
          <button
            key={page.id}
            onClick={() => onSelectPage(page.id)}
            className={`w-full flex items-center px-2 py-1 text-sm rounded cursor-pointer transition-colors text-left ${
              currentPageId === page.id 
                ? 'bg-[#EBEBE9] font-medium' 
                : 'hover:bg-[#EBEBE9]'
            }`}
          >
            {page.icon ? (
              <span className="mr-2 opacity-50">{page.icon}</span>
            ) : (
              <span className="mr-2 opacity-50"><FileText size={16} /></span>
            )}
            <span className="truncate">{page.title || 'Untitled'}</span>
          </button>
        ))}
        
      </nav>

      <div className="p-3 border-t border-[#EBEBE9] space-y-1">
         <button onClick={() => onAddPage('block')} className="w-full flex items-center px-2 py-1 text-sm rounded hover:bg-[#EBEBE9] text-[#37352f8c]">
           <span className="mr-2">+</span> New Page
         </button>
         <button onClick={() => onAddPage('canvas')} className="w-full flex items-center px-2 py-1 text-sm rounded hover:bg-[#EBEBE9] text-[#37352f8c]">
           <span className="mr-2"><Layout size={16} /></span> New Canvas
         </button>
      </div>

      <div className="p-3 border-t border-[#EBEBE9]">
        {userEmail ? (
          <div className="text-xs text-[#37352f7a] space-y-3 px-2">
             <div className="flex items-center gap-2">
                <CheckSquare size={14} className="opacity-50"/>
                <span>Google Tasks linked</span>
             </div>
             <button onClick={onOpenDrive} className="flex items-center gap-2 hover:text-purple-600 dark:hover:text-purple-400 transition-colors w-full text-left font-medium">
                <HardDrive size={14} className="opacity-50 text-purple-600 dark:text-purple-400" />
                <span>Google Drive Sync</span>
             </button>
             <button onClick={onLogout} className="flex items-center gap-2 hover:text-[#37352F] w-full">
               <LogOut size={14} className="opacity-50" />
               <span>Log out</span>
             </button>
          </div>
        ) : (
           <button onClick={onLogin} className="w-full bg-white border border-[#EBEBE9] hover:bg-[#F1F1F0] text-[#37352F] font-medium py-1.5 px-3 rounded text-sm transition-colors">
              Sign in with Google
           </button>
        )}
      </div>
    </div>
  );
}
