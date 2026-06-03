import { Layout, Table, BarChart3, PenTool, Monitor } from 'lucide-react';
import type { Page } from '../../types';

interface MobileRichPageFallbackProps {
  page: Page;
  onBack: () => void;
  onOpenDesktopHint?: () => void;
}

const PAGE_META: Record<string, { icon: typeof Layout; title: string; description: string }> = {
  canvas: {
    icon: PenTool,
    title: 'Canvas page',
    description: 'Infinite boards and connectors work best on desktop. Your canvas data is saved and syncs with this workspace.',
  },
  database: {
    icon: Table,
    title: 'Database page',
    description: 'Table, board, and calendar views are available on desktop. Open this workspace on a larger screen to edit rows and views.',
  },
  dashboard: {
    icon: BarChart3,
    title: 'Dashboard',
    description: 'Widgets and charts are optimized for desktop. Metrics still update from your task and page data.',
  },
  space: {
    icon: Layout,
    title: 'Space',
    description: 'Organize folders and projects from the sidebar on any device.',
  },
  folder: {
    icon: Layout,
    title: 'Folder',
    description: 'Browse child pages from the sidebar menu.',
  },
};

export function MobileRichPageFallback({ page, onBack, onOpenDesktopHint }: MobileRichPageFallbackProps) {
  const type = page.pageType || 'block';
  const meta = PAGE_META[type] ?? {
    icon: Monitor,
    title: 'Rich page',
    description: 'This page type is best edited on desktop.',
  };
  const Icon = meta.icon;

  return (
    <div
      className="flex flex-1 flex-col items-center justify-center px-8 py-12 text-center"
      style={{ paddingTop: 'calc(2rem + env(safe-area-inset-top))' }}
    >
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-stone-700 bg-stone-900 text-purple-400">
        <Icon size={28} />
      </div>
      <p className="text-3xl mb-2">{page.icon || '📄'}</p>
      <h2 className="text-lg font-bold text-stone-100 mb-2">{page.title || 'Untitled'}</h2>
      <p className="motion-label mb-1 text-stone-500">{meta.title}</p>
      <p className="text-sm text-stone-400 leading-relaxed max-w-xs mb-8">{meta.description}</p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          type="button"
          onClick={onBack}
          className="min-h-11 w-full rounded-xl bg-stone-800 font-semibold text-stone-100 border border-stone-700"
        >
          Back to home
        </button>
        {onOpenDesktopHint && (
          <button
            type="button"
            onClick={onOpenDesktopHint}
            className="min-h-11 w-full rounded-xl border border-purple-500/40 text-purple-300 text-sm font-medium"
          >
            Switch to desktop view
          </button>
        )}
      </div>
    </div>
  );
}
