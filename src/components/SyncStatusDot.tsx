import { SyncStatus } from '../hooks/useSyncStatus';

interface SyncStatusDotProps {
  status: SyncStatus;
  className?: string;
}

function formatRelativeTime(ts: number | null): string {
  if (!ts) return 'Not saved yet';
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 5) return 'Saved just now';
  if (sec < 60) return `Saved ${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `Saved ${min}m ago`;
  return `Saved ${Math.floor(min / 60)}h ago`;
}

export function SyncStatusDot({ status, className = '' }: SyncStatusDotProps) {
  let color = 'bg-emerald-500';
  let label = formatRelativeTime(status.lastSavedAt);

  if (status.offline) {
    color = 'bg-amber-500';
    label = 'Offline — edits stay on device';
  } else if (status.encryptionLocked) {
    color = 'bg-red-500';
    label = 'Workspace locked';
  } else if (status.saving) {
    color = 'bg-cyan-400 animate-pulse';
    label = 'Saving…';
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] text-stone-500 dark:text-stone-400 ${className}`}
      title={label}
    >
      <span className={`h-2 w-2 rounded-full shrink-0 ${color}`} aria-hidden />
      <span className="hidden lg:inline truncate max-w-[140px]">{label}</span>
    </span>
  );
}
