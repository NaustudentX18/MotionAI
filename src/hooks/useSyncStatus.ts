import { useState, useEffect, useCallback } from 'react';
import { isWorkspaceLocked } from '../lib/persistence';
import { getYjsKey } from '../lib/yjs';

export interface SyncStatus {
  encryptionLocked: boolean;
  encryptionKeySet: boolean;
  lastSavedAt: number | null;
  saving: boolean;
  offline: boolean;
}

const LAST_SAVE_KEY = 'motionai-last-save-ts';
let savingCounter = 0;
let savingListeners: Array<(saving: boolean) => void> = [];

export function setLastSaveNow(): void {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(LAST_SAVE_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  }
  notifySavingListeners(false);
}

export function getLastSavedAt(): number | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LAST_SAVE_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

/** Call when a debounced persistence write starts. */
export function markSaveStarted(): void {
  savingCounter += 1;
  notifySavingListeners(true);
}

/** Call when a persistence write completes (success or failure). */
export function markSaveFinished(): void {
  savingCounter = Math.max(0, savingCounter - 1);
  if (savingCounter === 0) {
    notifySavingListeners(false);
  }
}

function notifySavingListeners(saving: boolean): void {
  savingListeners.forEach((fn) => fn(saving));
}

export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>(() => ({
    encryptionLocked: false,
    encryptionKeySet: false,
    lastSavedAt: getLastSavedAt(),
    saving: false,
    offline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
  }));

  const refresh = useCallback(() => {
    const locked = isWorkspaceLocked();
    const keySet = getYjsKey() !== null;
    setStatus((prev) => ({
      encryptionLocked: locked,
      encryptionKeySet: keySet,
      lastSavedAt: getLastSavedAt(),
      saving: prev.saving,
      offline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
    }));
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 2000);
    const onSaving = (saving: boolean) => {
      setStatus((prev) => ({ ...prev, saving }));
    };
    savingListeners.push(onSaving);
    const onOnline = () => refresh();
    const onOffline = () => refresh();
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      clearInterval(interval);
      savingListeners = savingListeners.filter((fn) => fn !== onSaving);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [refresh]);

  return status;
}
