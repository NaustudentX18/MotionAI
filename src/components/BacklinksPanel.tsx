import React, { useMemo } from 'react';
import { Page } from '../types';
import { Link2 } from 'lucide-react';

interface BacklinksPanelProps {
  currentPage: Page | null;
  pages: Page[];
  backlinks: string[]; // page IDs that link to current page
  onNavigateToPage: (pageId: string) => void;
}

export function BacklinksPanel({ currentPage, pages, backlinks, onNavigateToPage }: BacklinksPanelProps) {
  const linkingPages = useMemo(() => {
    return pages.filter(p => backlinks.includes(p.id) && p.id !== currentPage?.id);
  }, [pages, backlinks, currentPage]);

  if (!currentPage) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-gray-500">
        <Link2 size={12} />
        Backlinks
        {linkingPages.length > 0 && (
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 text-[9px]">
            {linkingPages.length}
          </span>
        )}
      </div>

      {linkingPages.length === 0 ? (
        <p className="text-xs text-gray-400 italic">
          No pages link here yet. Use [[Page Title]] syntax to create links.
        </p>
      ) : (
        <div className="space-y-1.5">
          {linkingPages.map(page => (
            <button
              key={page.id}
              onClick={() => onNavigateToPage(page.id)}
              className="w-full text-left px-2.5 py-2 rounded bg-white dark:bg-[#252525] border border-[#EBEBE9] dark:border-[#2F2F2F] hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-xs transition-all group"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-sm opacity-60">{page.icon ?? '📄'}</span>
                <span className="text-xs font-medium text-[#37352F] dark:text-[#E3E3E3] group-hover:text-purple-600 dark:group-hover:text-purple-400 truncate">
                  {page.title || 'Untitled'}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
