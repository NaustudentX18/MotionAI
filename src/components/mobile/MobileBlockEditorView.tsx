import { ArrowLeft } from 'lucide-react';
import { BlockEditor } from '../BlockEditor';
import type { Page } from '../../types';

interface MobileBlockEditorViewProps {
  page: Page;
  onUpdatePage: (id: string, updates: Partial<Page>) => void;
  onBack: () => void;
  focusBlockId?: string | null;
  onFocusUsed?: () => void;
  onLockWorkspace?: () => void;
}

/**
 * Mobile page editor — uses the same TipTap BlockEditor as desktop for full parity.
 */
export function MobileBlockEditorView({
  page,
  onUpdatePage,
  onBack,
  focusBlockId,
  onFocusUsed,
  onLockWorkspace,
}: MobileBlockEditorViewProps) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#191919] animate-in slide-in-from-right duration-250">
      <div
        style={{ paddingTop: 'calc(12px + env(safe-area-inset-top))' }}
        className="flex shrink-0 items-center justify-between border-b border-stone-800 bg-stone-900/50 px-4 pb-2 pt-safe"
      >
        <button
          type="button"
          onClick={onBack}
          className="flex min-h-11 items-center gap-1.5 rounded-lg bg-stone-800 px-3 py-2 text-xs font-bold text-stone-300 hover:bg-stone-750"
          aria-label="Back to home"
        >
          <ArrowLeft size={13} />
          Home
        </button>
        <span className="max-w-[45vw] truncate text-xs font-bold text-stone-400">
          {page.icon || '📄'} {page.title || 'Untitled'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-1 py-2 [webkit-overflow-scrolling:touch]">
        <div className="min-h-full rounded-lg bg-[#FBFBFA] dark:bg-[#191919] px-2 py-4 sm:px-4">
          <BlockEditor
            key={page.id}
            pageId={page.id}
            title={page.title}
            onTitleChange={title => onUpdatePage(page.id, { title, updatedAt: Date.now() })}
            initialBlocks={page.blocks}
            onChange={blocks => onUpdatePage(page.id, { blocks, updatedAt: Date.now() })}
            focusAfterInsert={focusBlockId}
            onFocusAfterInsertUsed={onFocusUsed}
            onLockWorkspace={onLockWorkspace}
          />
        </div>
      </div>
    </div>
  );
}
