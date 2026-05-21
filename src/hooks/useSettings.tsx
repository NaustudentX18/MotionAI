import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  MotionAiSettings,
  loadSettings as loadSettingsFromStorage,
  saveSettings as saveSettingsToStorage,
  applyAppearanceSettings,
  isLocalMode,
} from '../lib/settings';

interface SettingsContextValue {
  settings: MotionAiSettings;
  updateSettings: (updates: Partial<MotionAiSettings>) => void;
  localMode: boolean;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<MotionAiSettings>(() => {
    const loaded = loadSettingsFromStorage();
    applyAppearanceSettings(loaded.appearance);
    return loaded;
  });
  const [localMode, setLocalMode] = useState(false);

  useEffect(() => {
    setLocalMode(isLocalMode(settings));
  }, [settings]);

  useEffect(() => {
    applyAppearanceSettings(settings.appearance);
  }, [settings.appearance]);

  const updateSettings = useCallback((updates: Partial<MotionAiSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...updates };
      if (updates.providers) {
        next.providers = { ...prev.providers, ...updates.providers };
      }
      if (updates.appearance) {
        next.appearance = { ...prev.appearance, ...updates.appearance };
      }
      saveSettingsToStorage(next);
      return next;
    });
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, localMode }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
