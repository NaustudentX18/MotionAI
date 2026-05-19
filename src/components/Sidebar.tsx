import React from 'react';
import { Page } from '../types';
import { FileText, Plus, LogOut, Calendar, CheckSquare, Search } from 'lucide-react';

interface SidebarProps {
  pages: Page[];
  currentPageId: string | null;
  onSelectPage: (id: string) => void;
  onAddPage: () => void;
  userEmail: string | null;
  onLogout: () => void;
  onLogin: () => void;
}

export function Sidebar({ pages, currentPageId, onSelectPage, onAddPage, userEmail, onLogout, onLogin }: SidebarProps) {
  return (
    <div className="w-[240px] h-screen bg-[#F7F6F3] border-r border-[#EBEBE9] flex flex-col shrink-0 text-[#37352F]">
      <div className="p-4 flex items-center space-x-2 mb-2 hover:bg-[#EBEBE9] cursor-pointer rounded mx-2 mt-2 transition-colors">
        <div className="w-6 h-6 rounded bg-[#37352F] flex items-center justify-center font-bold text-[10px] text-white">
          {userEmail ? userEmail[0].toUpperCase() : 'W'}
        </div>
        <span className="font-medium text-sm truncate">{userEmail ? `${userEmail}'s Workspace` : 'Workspace AI'}</span>
      </div>

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

      <div className="p-3 border-t border-[#EBEBE9]">
         <button onClick={onAddPage} className="w-full flex items-center px-2 py-1 text-sm rounded hover:bg-[#EBEBE9] text-[#37352f8c]">
           <span className="mr-2">+</span> New Page
         </button>
      </div>

      <div className="p-3 border-t border-[#EBEBE9]">
        {userEmail ? (
          <div className="text-xs text-[#37352f7a] space-y-3 px-2">
             <div className="flex items-center gap-2">
                <CheckSquare size={14} className="opacity-50"/>
                <span>Google Tasks linked</span>
             </div>
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
