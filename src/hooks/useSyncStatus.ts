import { useState, useEffect, useCallback } from 'react';
import { isWorkspaceLocked } from '../lib/persistence';
import { getYjsKey } from '../lib/yjs';

export interface SyncStatus {
  /** Whether the workspace encryption is currently locked */
  encryptionLocked: boolean;
  /** Whether an encryption key is set at all */
  encryptionKeySet: boolean;
  /** Timestamp of the last known save (from localStorage flag) */
  lastSavedAt: number | null;
  /** Whether a save appears to be in-flight */
  saving: boolean;
}

const LAST_SAVE_KEY = 'motionai-last-save-ts';

export function setLastSaveNow(): void {
  if (typeof localStorage !== 'undefined') {
    try { localStorage.setItem(LAST_SAVE_KEY, String(Date.now())); } catch { /* ignore */ }
  }
}

export function getLastSavedAt(): number | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LAST_SAVE_KEY);
    return raw ? Number(raw) : null;
  } catch { return null; }
}

/**
 * Hook that polls sync-relevant state: encryption, last save, save-in-flight.
 * Polls every 2 seconds so it stays reasonably fresh without excessive reads.
 */
export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>(() => ({
    encryptionLocked: false,
    encryptionKeySet: false,
    lastSavedAt: getLastSavedAt(),
    saving: false,
  }));

  const refresh = useCallback(() => {
    const locked = isWorkspaceLocked();
    const keySet = getYjsKey() !== null;
    setStatus({
      encryptionLocked: locked,
      encryptionKeySet: keySet,
      lastSavedAt: getLastSavedAt(),
      saving: false,
    });
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Expose refresh so saves can update the timestamp immediately
  (status as any)._refresh = refresh;
  return status;
}
