import { Page } from '../types';
import { BacklinksPanel } from './BacklinksPanel';
import { Link2, X } from 'lucide-react';

interface BacklinksRailProps {
  currentPage: Page;
  pages: Page[];
  backlinks: string[];
  onNavigateToPage: (pageId: string) => void;
  onClose: () => void;
}

/** Slim always-visible backlinks column on wide desktop layouts. */
export function BacklinksRail({
  currentPage,
  pages,
  backlinks,
  onNavigateToPage,
  onClose,
}: BacklinksRailProps) {
  if (backlinks.length === 0) return null;

  return (
    <aside className="hidden xl:flex w-56 shrink-0 flex-col border-l border-stone-200 bg-stone-50/90 dark:border-stone-800 dark:bg-stone-950/40">
      <div className="flex items-center justify-between px-3 py-2 border-b border-stone-200 dark:border-stone-800">
        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-stone-500">
          <Link2 size={12} />
          Linked
        </span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800"
          aria-label="Hide links rail"
        >
          <X size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <BacklinksPanel
          currentPage={currentPage}
          pages={pages}
          backlinks={backlinks}
          onNavigateToPage={onNavigateToPage}
        />
      </div>
    </aside>
  );
}
