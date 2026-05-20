/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Page, Block } from './types';
import { Sidebar } from './components/Sidebar';
import { BlockEditor } from './components/BlockEditor';
import { CommandPalette } from './components/CommandPalette';
import { DriveModal } from './components/DriveModal';
import { PageAddons } from './components/PageAddons';
import { MobileWorkspaceApp } from './components/MobileWorkspaceApp';
import { MotionAIHub } from './components/MotionAIHub';
import { initAuth, googleSignIn, logout, getUser } from './lib/firebase';
import { User } from 'firebase/auth';
import { Menu, History, Download, Smartphone, Laptop, Sparkles } from 'lucide-react';
import { cn } from './lib/utils';

export default function App() {
  const [pages, setPages] = useState<Page[]>(() => {
    const saved = localStorage.getItem('motion_ai_pages') || localStorage.getItem('notion_clone_pages');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.error('Failed to parse pages from localStorage', e);
      }
    }
    return [];
  });
  const [currentPageId, setCurrentPageId] = useState<string | null>(() => {
    return localStorage.getItem('motion_ai_current_page_id') || localStorage.getItem('notion_clone_current_page_id') || null;
  });

  // Save pages to localStorage when they change
  useEffect(() => {
    if (pages.length > 0) {
      localStorage.setItem('motion_ai_pages', JSON.stringify(pages));
    }
  }, [pages]);

  // Save current page ID to localStorage when it changes
  useEffect(() => {
    if (currentPageId) {
      localStorage.setItem('motion_ai_current_page_id', currentPageId);
    }
  }, [currentPageId]);
  const [user, setUser] = useState<User | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [driveModalOpen, setDriveModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile' | 'hub'>('hub');
  
  // Persisted Dark Mode State & Effect
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('motion_ai_dark_mode');
    if (saved !== null) {
      return saved === 'true';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('motion_ai_dark_mode', String(darkMode));
  }, [darkMode]);

  // New States: Versions, Sidebar Addons and Collaborators
  const [addonsOpen, setAddonsOpen] = useState(false);
  const [collaborationActive, setCollaborationActive] = useState(true);
  const [activePeers, setActivePeers] = useState<Array<{ name: string; email: string; color: string; status: 'typing' | 'idle' }>>([
    { name: 'Sarah (PM)', email: 'sarah.pm@yourhomelab.org', color: '#8B5CF6', status: 'idle' },
    { name: 'Alex (DevOps)', email: 'alex.devops@homelab.net', color: '#10B981', status: 'idle' }
  ]);

  // Initialize Auth
  useEffect(() => {
    const unsubscribe = initAuth(
      (u) => setUser(u),
      () => setUser(null)
    );
    return () => unsubscribe();
  }, []);

  // Initialize a default page if none exist
  const [vectorSearchReady, setVectorSearchReady] = useState(false);

  // Initialize Vector Search in background
  useEffect(() => {
    if (pages.length > 0 && !vectorSearchReady) {
      import('./lib/vectorStore').then(({ initVectorDB }) => {
        initVectorDB(pages)
          .then(() => {
            console.log("WASM Vector Search initialized");
            setVectorSearchReady(true);
          })
          .catch(err => console.error("Vector DB init err:", err));
      });
    }
  }, [pages, vectorSearchReady]);

  useEffect(() => {
    if (pages.length === 0) {
      const newPage: Page = {
        id: uuidv4(),
        title: 'Getting Started',
        icon: '👋',
        cover: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        blocks: [
          { id: uuidv4(), type: 'h1', content: 'Welcome to your Workspace ✨' },
          { id: uuidv4(), type: 'p', content: 'This is an exact replica of the core features you love.' },
          { id: uuidv4(), type: 'p', content: 'Type / for commands, or select text to invoke the AI assistant.' },
          { id: uuidv4(), type: 'todo', content: 'Explore slash commands', checked: false },
          { id: uuidv4(), type: 'todo', content: 'Extract text to Google Tasks', checked: false }
        ]
      };
      setPages([newPage]);
      setCurrentPageId(newPage.id);
    }
  }, [pages.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle Ctrl+K or Cmd+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(topLevel => !topLevel);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogin = async () => {
    try {
      await googleSignIn();
    } catch (e) {
      console.error(e);
    }
  };

  const addPage = () => {
    const newPage: Page = {
      id: uuidv4(),
      title: '',
      icon: null,
      cover: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      blocks: [{ id: uuidv4(), type: 'p', content: '' }]
    };
    setPages([...pages, newPage]);
    setCurrentPageId(newPage.id);
  };

  const updateCurrentPage = (updates: Partial<Page>) => {
    setPages(pages.map(p => p.id === currentPageId ? { ...p, ...updates, updatedAt: Date.now() } : p));
  };

  const updatePageById = (id: string, updates: Partial<Page>) => {
    setPages(pages.map(p => p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p));
  };

  const deletePageById = (id: string) => {
    const updated = pages.filter(p => p.id !== id);
    setPages(updated);
    if (currentPageId === id) {
      setCurrentPageId(updated.length > 0 ? updated[0].id : null);
    }
  };

  const handleAddNewPageObj = (newPage: Page) => {
    setPages([...pages, newPage]);
    setCurrentPageId(newPage.id);
  };

  const handleImportDrivePage = (title: string, blocks: Block[]) => {
    const newPage: Page = {
      id: uuidv4(),
      title,
      icon: '📁',
      cover: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      blocks,
    };
    setPages([...pages, newPage]);
    setCurrentPageId(newPage.id);
  };

  const handleSaveSnapshot = () => {
    if (!currentPageId) return;
    const targetPage = pages.find(p => p.id === currentPageId);
    if (!targetPage) return;

    const newVersion = {
      id: uuidv4(),
      timestamp: Date.now(),
      title: targetPage.title || 'Untitled Snapshot',
      blocks: JSON.parse(JSON.stringify(targetPage.blocks)) // Deep clone blocks
    };

    const updatedPages = pages.map(p => {
      if (p.id === currentPageId) {
        return {
          ...p,
          versions: [newVersion, ...(p.versions || [])].slice(0, 15) // Keep up to 15 versions
        };
      }
      return p;
    });
    setPages(updatedPages);
  };

  const handleRestoreVersion = (version: any) => {
    if (!currentPageId) return;
    const confirmRestore = window.confirm(`Are you sure you want to revert to the snapshot from ${new Date(version.timestamp).toLocaleTimeString()}?`);
    if (!confirmRestore) return;

    // Create a snapshot of current state before reverting so user doesn't lose current work
    handleSaveSnapshot();

    setPages(pages.map(p => {
      if (p.id === currentPageId) {
        return {
          ...p,
          title: version.title,
          blocks: JSON.parse(JSON.stringify(version.blocks)),
          updatedAt: Date.now()
        };
      }
      return p;
    }));
  };

  const handleTriggerMockEdit = (peerName: string) => {
    if (!currentPageId || !currentPage) return;

    // Set peer to typing state
    setActivePeers(prev => prev.map(p => p.name === peerName ? { ...p, status: 'typing' } : p));

    setTimeout(() => {
      // Create a nice mock technical edit block
      const prompts = [
        `💡 suggestion by ${peerName}: Verified SABnzbd download path matches correct NAS mount permissions dynamically.`,
        `💡 checklist update by ${peerName}: Ensure /etc/docker-compose or openmediavault parameters are perfectly stored.`,
        `💡 recommendation by ${peerName}: Backup Docker volume mappings to the OpenMediaVault (OMV) backup pool regularly!`,
        `💡 system check by ${peerName}: Port Forwarding correctly active for remote overseerr / plex routing.`
      ];
      const selectedPrompt = prompts[Math.floor(Math.random() * prompts.length)];

      const newBlock = {
        id: uuidv4(),
        type: 'callout' as const,
        content: selectedPrompt,
        checked: false,
        indentLevel: 1
      };

      setPages(prevPages => prevPages.map(p => {
        if (p.id === currentPageId) {
          return {
            ...p,
            blocks: [...p.blocks, newBlock],
            updatedAt: Date.now()
          };
        }
        return p;
      }));

      // Set peer back to idle
      setActivePeers(prev => prev.map(p => p.name === peerName ? { ...p, status: 'idle' } : p));
    }, 1500);
  };

  const currentPage = pages.find(p => p.id === currentPageId);

  return (
    <div className="flex h-[100dvh] bg-[#FFFFFF] text-[#37352F] overflow-hidden font-sans relative">
      <CommandPalette 
         isOpen={paletteOpen} 
         onClose={() => setPaletteOpen(false)}
         pages={pages}
         onSelectPage={setCurrentPageId}
         currentPage={currentPage}
         onAiAction={(action) => {
           // Basic handle AI action by emitting a custom event the editor can listen to
           window.dispatchEvent(new CustomEvent('ai-command', { detail: { action } }));
         }}
         onInsertBlocks={(newBlocks) => {
           if (!currentPageId) return;
           setPages(prevPages => prevPages.map(p => {
             if (p.id === currentPageId) {
               return {
                 ...p,
                 blocks: [...p.blocks, ...newBlocks],
                 updatedAt: Date.now()
               };
             }
             return p;
           }));
         }}
      />
    
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
         <div className="fixed inset-0 bg-black/20 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      
      <div className={cn(
        "fixed md:static inset-y-0 left-0 z-50 transform transition-transform duration-200 ease-in-out md:transform-none md:flex",
        sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
         <Sidebar 
           pages={pages}
           currentPageId={currentPageId}
           onSelectPage={(id) => {
             setCurrentPageId(id);
             if (window.innerWidth < 768) setSidebarOpen(false);
           }}
           onAddPage={addPage}
           userEmail={user?.email || null}
           onLogin={handleLogin}
           onLogout={logout}
           onOpenDrive={() => setDriveModalOpen(true)}
         />
      </div>
      
      <div className="flex-1 flex overflow-hidden w-full relative">
        <main className={cn("flex-1 relative flex flex-col min-w-0 w-full", viewMode === 'desktop' ? "overflow-y-auto" : "overflow-hidden")}>
        <header className="sticky top-0 z-10 flex items-center px-4 bg-white/80 backdrop-blur-sm dark:bg-[#1C1C1C]/80 h-11 text-sm justify-between shrink-0 border-b border-gray-150 dark:border-stone-850">
           <div className="flex items-center space-x-2 text-[#37352f8c] dark:text-[#E3E3E3]/60">
             <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 hover:bg-[#F1F1F0] dark:hover:bg-[#2F2F2F] rounded mr-2">
                 <Menu size={16} />
             </button>
             <span className="hidden sm:inline truncate max-w-[100px]">{user?.email || 'Local Workspace'}</span>
             <span className="hidden sm:inline">/</span>
             <span className="text-[#37352F] dark:text-[#E3E3E3] font-medium truncate max-w-[125px] mr-2">{currentPage?.title || 'Untitled'}</span>
             
             {/* Segment platform selector controller */}
             <div className="flex items-center bg-gray-100 dark:bg-stone-800 p-0.5 rounded-lg border border-gray-150 dark:border-stone-700 select-none">
               <button 
                 onClick={() => setViewMode('hub')}
                 className={cn(
                   "flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold cursor-pointer transition-all",
                   viewMode === 'hub'
                     ? "bg-purple-650 text-white shadow-xs font-bold" 
                     : "text-stone-500 hover:text-stone-850 dark:hover:text-stone-200"
                 )}
                 title="MotionAI Repository Handbook & Workspace Gaps roadmap dashboard"
               >
                 <Sparkles size={11} className={viewMode === 'hub' ? "text-yellow-300" : ""} />
                 <span className="hidden md:inline font-sans text-[11px]">MotionAI Portal</span>
               </button>
               <button 
                 onClick={() => setViewMode('desktop')}
                 className={cn(
                   "flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold cursor-pointer transition-all",
                   viewMode === 'desktop'
                     ? "bg-white dark:bg-stone-900 text-stone-850 dark:text-stone-100 shadow-xs font-bold" 
                     : "text-stone-500 hover:text-stone-850 dark:hover:text-stone-200"
                 )}
               >
                 <Laptop size={11} />
                 <span className="hidden md:inline font-sans text-[11px]">Desktop</span>
               </button>
               <button 
                 onClick={() => setViewMode('mobile')}
                 className={cn(
                   "flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold cursor-pointer transition-all",
                   viewMode === 'mobile'
                     ? "bg-white dark:bg-stone-900 text-stone-850 dark:text-stone-100 shadow-xs font-bold" 
                     : "text-stone-500 hover:text-stone-850 dark:hover:text-stone-200"
                 )}
               >
                 <Smartphone size={11} />
                 <span className="hidden md:inline font-sans text-[11px]">Mobile View</span>
               </button>
             </div>
           </div>
           <div className="flex items-center space-x-4">
             {user && (
               <button 
                 onClick={() => setDriveModalOpen(true)} 
                 className="flex items-center gap-1 text-xs bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 hover:bg-purple-100/50 dark:hover:bg-purple-900/10 px-2.5 py-1.5 rounded font-medium transition-colors"
               >
                 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><path d="M12 3v18"/><path d="M3 12h18"/></svg>
                 Drive Sync
               </button>
             )}
             <button aria-label="Search" onClick={() => setPaletteOpen(true)} className="p-1 hover:bg-[#F1F1F0] dark:hover:bg-[#2F2F2F] rounded text-[#37352f8c]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
             </button>
             <button aria-label="Dark Mode" onClick={() => setDarkMode(!darkMode)} className="p-1 hover:bg-[#F1F1F0] dark:hover:bg-[#2F2F2F] rounded text-[#37352f8c]" title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}>
                {darkMode ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-700"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
                )}
             </button>
             {currentPage && (
                <div className="flex items-center gap-1.5 flex-row">
                  <button 
                     onClick={() => window.dispatchEvent(new CustomEvent('export-pdf'))}
                     className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold bg-white hover:bg-[#F1F1F0] dark:bg-[#1E1E1E] dark:hover:bg-[#2F2F2F] border border-[#EBEBE9] dark:border-[#2F2F2F] text-gray-600 dark:text-gray-300 rounded transition-colors cursor-pointer mr-2"
                     title="Export Current Page to PDF"
                   >
                     <Download size={13} className="text-purple-600 dark:text-purple-400" />
                     <span>Export PDF</span>
                   </button>
                   <span className="text-[#37352f8c] hidden sm:inline text-xs mr-1">Edited recently</span>
                  <button 
                    title="Open Document History & Collaboration"
                    onClick={() => setAddonsOpen(!addonsOpen)}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded transition-colors relative border",
                      addonsOpen 
                        ? "bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-400 font-bold" 
                        : "bg-white hover:bg-[#F1F1F0] dark:bg-[#1E1E1E] dark:hover:bg-[#2F2F2F] border-[#EBEBE9] dark:border-[#2F2F2F] text-gray-600 dark:text-gray-300 font-medium"
                    )}
                  >
                    <History size={13} />
                    <span>History & Peers</span>
                    {collaborationActive && <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />}
                  </button>
                </div>
              )}
             {!user ? (
               <button onClick={handleLogin} className="text-sm bg-[#F7F6F3] border border-[#EBEBE9] text-[#37352F] hover:bg-[#EBEBE9] px-2 py-1 rounded">Link Workspace</button>
             ) : null}
           </div>
        </header>

        <div className="flex-1 w-full relative bg-gray-50 dark:bg-stone-900">
          {viewMode === 'hub' ? (
            <MotionAIHub />
          ) : viewMode === 'mobile' ? (
            <MobileWorkspaceApp 
              pages={pages}
              currentPageId={currentPageId}
              onSelectPage={setCurrentPageId}
              onAddPage={handleAddNewPageObj}
              onUpdatePage={updatePageById}
              onDeletePage={deletePageById}
              userEmail={user?.email || null}
            />
          ) : (
            currentPage && (
               <BlockEditor 
                 key={currentPage.id}
                 title={currentPage.title}
                 onTitleChange={t => updateCurrentPage({ title: t })}
                 initialBlocks={currentPage.blocks}
                 onChange={b => updateCurrentPage({ blocks: b })}
               />
            )
          )}
        </div>
        </main>
        {addonsOpen && (
          <>
            {/* Mobile Backdrop Overlay */}
            <div 
              className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 md:hidden" 
              onClick={() => setAddonsOpen(false)} 
            />
            <div className="fixed md:static inset-y-0 right-0 z-50 w-80 shadow-xl md:shadow-none bg-[#FBFBFA] dark:bg-[#1C1C1C] flex flex-col h-full animate-in slide-in-from-right duration-250">
              <PageAddons
                currentPage={currentPage || null}
                onRestoreVersion={handleRestoreVersion}
                onSaveSnapshot={handleSaveSnapshot}
                collaborationActive={collaborationActive}
                onToggleCollaboration={setCollaborationActive}
                activePeers={activePeers}
                onTriggerMockEdit={handleTriggerMockEdit}
              />
            </div>
          </>
        )}
      </div>

      <DriveModal 
        isOpen={driveModalOpen} 
        onClose={() => setDriveModalOpen(false)} 
        currentPage={currentPage}
        onPageImported={handleImportDrivePage}
      />
    </div>
  );
}
