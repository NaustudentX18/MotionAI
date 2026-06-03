import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { cn } from '../lib/utils';

type ToastKind = 'info' | 'success' | 'error';

interface ToastItem {
  id: string;
  message: string;
  kind: ToastKind;
}

interface ToastContextValue {
  showToast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, message, kind }]);
    window.setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4200);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[200] flex flex-col items-center gap-2 px-4 pb-safe"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        aria-live="polite"
      >
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto max-w-md rounded-xl border px-4 py-3 text-sm font-medium shadow-lg backdrop-blur-md',
              toast.kind === 'error' && 'border-red-500/40 bg-red-950/90 text-red-100',
              toast.kind === 'success' && 'border-emerald-500/40 bg-emerald-950/90 text-emerald-100',
              toast.kind === 'info' && 'border-stone-600/50 bg-stone-900/95 text-stone-100'
            )}
            role="status"
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
