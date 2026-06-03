import { useCallback, useEffect, useState } from 'react';
import { isMobileUserAgent, isStandalonePwa } from '../lib/device';

export type ViewMode = 'desktop' | 'mobile' | 'hub';

const STORAGE_KEY = 'motionai-view-mode';

function readStoredMode(): ViewMode | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'desktop' || raw === 'mobile' || raw === 'hub') return raw;
  } catch {
    /* ignore */
  }
  return null;
}

function defaultMode(): ViewMode {
  if (typeof window === 'undefined') return 'hub';
  if (isMobileUserAgent() || isStandalonePwa() || window.innerWidth < 768) return 'mobile';
  return 'hub';
}

export function useViewMode() {
  const [viewMode, setViewModeState] = useState<ViewMode>(() => readStoredMode() ?? defaultMode());

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const stored = readStoredMode();
    if (stored) return;
    if (isMobileUserAgent() || isStandalonePwa()) {
      setViewModeState('mobile');
    }
  }, []);

  return [viewMode, setViewMode] as const;
}
