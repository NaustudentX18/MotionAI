import { Clock } from 'lucide-react';
import type { ReminderEvent } from '../../hooks/useReminders';
import { Button } from '../ui/Button';

interface ReminderActionToastProps {
  reminder: ReminderEvent;
  snoozeMinutes: number;
  onDismiss: (reminder: ReminderEvent) => void;
  onSnooze: (reminder: ReminderEvent) => void;
  onOpenPage?: (pageId: string) => void;
}

export function ReminderActionToast({
  reminder,
  snoozeMinutes,
  onDismiss,
  onSnooze,
  onOpenPage,
}: ReminderActionToastProps) {
  return (
    <div
      className="fixed bottom-4 right-4 z-[80] w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-amber-200 bg-white p-4 shadow-2xl dark:border-amber-900/60 dark:bg-[#1E1E1E]"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-amber-100 p-2 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          <Clock size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-stone-850 dark:text-stone-100">{reminder.pageTitle}</p>
          <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">{reminder.body}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              onClick={() => onSnooze(reminder)}
              className="min-h-9 bg-amber-500 px-3 text-xs hover:opacity-100 hover:bg-amber-600"
            >
              Snooze {snoozeMinutes}m
            </Button>
            <Button
              variant="secondary"
              onClick={() => onDismiss(reminder)}
              className="min-h-9 px-3 text-xs"
            >
              Dismiss
            </Button>
            {onOpenPage && (
              <Button
                variant="ghost"
                onClick={() => onOpenPage(reminder.pageId)}
                className="min-h-9 px-3 text-xs"
              >
                Open task
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
