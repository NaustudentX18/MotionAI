/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Page, Block } from './types';
import { Sidebar } from './components/Sidebar';
import { BlockEditor } from './components/BlockEditor';
import { initAuth, googleSignIn, logout, getUser } from './lib/firebase';
import { User } from 'firebase/auth';
import { Menu } from 'lucide-react';

export default function App() {
  const [pages, setPages] = useState<Page[]>([]);
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

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

  const currentPage = pages.find(p => p.id === currentPageId);

  return (
    <div className="flex h-screen bg-[#FFFFFF] text-[#37352F] overflow-hidden font-sans">
      {sidebarOpen && (
         <Sidebar 
           pages={pages}
           currentPageId={currentPageId}
           onSelectPage={setCurrentPageId}
           onAddPage={addPage}
           userEmail={user?.email || null}
           onLogin={handleLogin}
           onLogout={logout}
         />
      )}
      
      <main className="flex-1 overflow-y-auto relative flex flex-col">
        <header className="sticky top-0 z-10 flex items-center px-4 bg-white/80 backdrop-blur-sm h-11 text-sm justify-between">
           <div className="flex items-center space-x-2 text-[#37352f8c]">
             <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 hover:bg-[#F1F1F0] rounded mr-2">
                <Menu size={16} />
             </button>
             <span>{user?.email || 'Local Workspace'}</span>
             <span>/</span>
             <span className="text-[#37352F]">{currentPage?.title || 'Untitled'}</span>
           </div>
           
           <div className="flex items-center space-x-4">
             {currentPage && <span className="text-[#37352f8c]">Edited recently</span>}
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
    </div>
  );
}
