import { X } from 'lucide-react';
import { MOTIONAI_SHORTCUTS } from '../lib/shortcuts';
import { MotionAILogo } from './brand/MotionAILogo';

interface ShortcutHelpModalProps {
  open: boolean;
  onClose: () => void;
}

export function ShortcutHelpModal({ open, onClose }: ShortcutHelpModalProps) {
  if (!open) return null;

  const categories = ['Navigation', 'Workspace', 'Editor', 'AI'] as const;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal
      aria-label="Keyboard shortcuts"
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white shadow-2xl dark:border-stone-700 dark:bg-stone-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4 dark:border-stone-700">
          <div className="flex items-center gap-3">
            <MotionAILogo size={32} />
            <div>
              <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">Keyboard shortcuts</h2>
              <p className="text-xs text-stone-500">MotionAI power moves</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-5 space-y-5">
          {categories.map((cat) => {
            const items = MOTIONAI_SHORTCUTS.filter((s) => s.category === cat);
            if (items.length === 0) return null;
            return (
              <div key={cat}>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-purple-600 dark:text-purple-400 mb-2">
                  {cat}
                </h3>
                <ul className="space-y-2">
                  {items.map((s) => (
                    <li key={s.keys + s.description} className="flex items-center justify-between gap-4 text-sm">
                      <span className="text-stone-600 dark:text-stone-300">{s.description}</span>
                      <kbd className="shrink-0 rounded-md border border-stone-200 bg-stone-50 px-2 py-0.5 font-mono text-[11px] dark:border-stone-600 dark:bg-stone-800">
                        {s.keys}
                      </kbd>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
