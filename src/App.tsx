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
import { initAuth, googleSignIn, logout, getUser } from './lib/firebase';
import { User } from 'firebase/auth';
import { Menu } from 'lucide-react';
import { cn } from './lib/utils';

export default function App() {
  const [pages, setPages] = useState<Page[]>([]);
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [driveModalOpen, setDriveModalOpen] = useState(false);

  // Initialize Auth
  useEffect(() => {
    const unsubscribe = initAuth(
      (u) => setUser(u),
      () => setUser(null)
    );
    return () => unsubscribe();
  }, []);

  // Initialize a default page if none exist
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
          { id: uuidv4(), type: 'h1', content: 'Welcome to your Notion Clone ✨' },
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

  const currentPage = pages.find(p => p.id === currentPageId);

  return (
    <div className="flex h-[100dvh] bg-[#FFFFFF] text-[#37352F] overflow-hidden font-sans relative">
      <CommandPalette 
         isOpen={paletteOpen} 
         onClose={() => setPaletteOpen(false)}
         pages={pages}
         onSelectPage={setCurrentPageId}
         onAiAction={(action) => {
           // Basic handle AI action by emitting a custom event the editor can listen to
           window.dispatchEvent(new CustomEvent('ai-command', { detail: { action } }));
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
      
      <main className="flex-1 overflow-y-auto relative flex flex-col w-full md:w-auto min-w-0">
        <header className="sticky top-0 z-10 flex items-center px-4 bg-white/80 backdrop-blur-sm h-11 text-sm justify-between shrink-0">
           <div className="flex items-center space-x-2 text-[#37352f8c]">
             <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 hover:bg-[#F1F1F0] rounded mr-2">
                 <Menu size={16} />
             </button>
             <span>{user?.email || 'Local Workspace'}</span>
             <span>/</span>
             <span className="text-[#37352F]">{currentPage?.title || 'Untitled'}</span>
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
             <button aria-label="Dark Mode" onClick={() => document.documentElement.classList.toggle('dark')} className="p-1 hover:bg-[#F1F1F0] dark:hover:bg-[#2F2F2F] rounded text-[#37352f8c]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
             </button>
             {currentPage && <span className="text-[#37352f8c] hidden sm:inline">Edited recently</span>}
             {!user ? (
               <button onClick={handleLogin} className="text-sm bg-[#F7F6F3] border border-[#EBEBE9] text-[#37352F] hover:bg-[#EBEBE9] px-2 py-1 rounded">Link Workspace</button>
             ) : null}
           </div>
        </header>

        <div className="flex-1 w-full relative">
          {currentPage && (
             <BlockEditor 
               key={currentPage.id}
               title={currentPage.title}
               onTitleChange={t => updateCurrentPage({ title: t })}
               initialBlocks={currentPage.blocks}
               onChange={b => updateCurrentPage({ blocks: b })}
             />
          )}
        </div>
      </main>

      <DriveModal 
        isOpen={driveModalOpen} 
        onClose={() => setDriveModalOpen(false)} 
        currentPage={currentPage}
        onPageImported={handleImportDrivePage}
      />
    </div>
  );
}
