import React, { useMemo } from 'react';
import { Page } from '../types';
import { Link2, ArrowUpRight } from 'lucide-react';
import { parseWikiLinks } from '../lib/backlinks';

interface BacklinksPanelProps {
  currentPage: Page | null;
  pages: Page[];
  backlinks: string[];
  onNavigateToPage: (pageId: string) => void;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

export function BacklinksPanel({ currentPage, pages, backlinks, onNavigateToPage }: BacklinksPanelProps) {
  const linkingPages = useMemo(() => {
    return pages.filter((p) => backlinks.includes(p.id) && p.id !== currentPage?.id);
  }, [pages, backlinks, currentPage]);

  const outboundTargets = useMemo(() => {
    if (!currentPage) return [];
    const titles = new Set<string>();
    for (const block of currentPage.blocks || []) {
      const plain = stripHtml(block.content || '');
      parseWikiLinks(plain).forEach((t) => titles.add(t));
    }
    return [...titles]
      .map((title) => {
        const target = pages.find(
          (p) => p.title?.toLowerCase() === title.toLowerCase() || p.id === title,
        );
        return target ? { page: target, label: title } : { page: null, label: title };
      })
      .filter((x) => x.page?.id !== currentPage.id);
  }, [currentPage, pages]);

  if (!currentPage) return null;

  return (
    <div className="space-y-4">
      <div>
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
          <p className="text-xs text-gray-400 italic mt-2">
            No pages link here yet. Use [[Page Title]] syntax to create links.
          </p>
        ) : (
          <div className="space-y-1.5 mt-2">
            {linkingPages.map((page) => (
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

      {outboundTargets.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-gray-500">
            <ArrowUpRight size={12} />
            Links from this page
          </div>
          <div className="space-y-1.5 mt-2">
            {outboundTargets.map(({ page, label }) =>
              page ? (
                <button
                  key={page.id}
                  onClick={() => onNavigateToPage(page.id)}
                  className="w-full text-left px-2.5 py-2 rounded border border-dashed border-stone-300 dark:border-stone-600 hover:border-purple-400 text-xs"
                >
                  <span className="mr-1">{page.icon ?? '📄'}</span>
                  {page.title || label}
                </button>
              ) : (
                <div
                  key={label}
                  className="px-2.5 py-2 text-xs text-amber-600 dark:text-amber-400 border border-dashed border-amber-300/50 rounded"
                >
                  [[{label}]] — page not found
                </div>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
