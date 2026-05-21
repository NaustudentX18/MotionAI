import React, { useState, useEffect } from 'react';
import { X, Loader2, CheckSquare, Plus, Trash2, AlertCircle, Calendar } from 'lucide-react';
import { addGoogleTask } from '../lib/workspace';
import { cn } from '../lib/utils';

interface TasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPageContent?: string;
}

type TasksStatus = 'idle' | 'loading' | 'error' | 'not_connected';

export function TasksModal({ isOpen, onClose, currentPageContent }: TasksModalProps) {
  const [status, setStatus] = useState<TasksStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStatus('idle');
      setError(null);
      setSuccess(false);
      // Pre-fill from current page content if provided
      if (currentPageContent) {
        setNotes(currentPageContent);
      }
    }
  }, [isOpen, currentPageContent]);

  const handleAddTask = async () => {
    if (!title.trim()) return;

    setStatus('loading');
    setError(null);
    setSuccess(false);

    try {
      await addGoogleTask(
        title.trim(),
        notes.trim() || undefined,
        dueDate ? new Date(dueDate) : undefined
      );
      setSuccess(true);
      setTitle('');
      setNotes('');
      setDueDate('');
      setStatus('idle');
    } catch (err: any) {
      const message = err.message || 'Failed to create task';
      setError(message);
      setStatus(message.includes('not connected') ? 'not_connected' : 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-24">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-white dark:bg-[#1C1C1C] rounded-2xl shadow-2xl border border-[#EBEBE9] dark:border-[#2F2F2F] w-full max-w-md mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#EBEBE9] dark:border-[#2F2F2F]">
          <div className="flex items-center gap-2">
            <CheckSquare size={18} className="text-emerald-600 dark:text-emerald-400" />
            <span className="font-bold text-sm text-[#37352F] dark:text-[#D4D4D4]">Google Tasks</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#F1F1F0] dark:hover:bg-[#2F2F2F] transition-colors cursor-pointer"
          >
            <X size={16} className="text-[#37352F8c]" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Not connected state */}
          {status === 'not_connected' && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-900/25 rounded-xl text-center space-y-2">
              <AlertCircle size={24} className="mx-auto text-amber-500" />
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                Google Workspace is not connected.
              </p>
              <p className="text-[11px] text-amber-600 dark:text-amber-500">
                Use the Drive & Sync button in the top bar to link your Google account first.
              </p>
            </div>
          )}

          {/* Error state */}
          {status === 'error' && error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/10 border border-red-200 dark:border-red-900/20 rounded-xl text-center">
              <p className="text-xs text-red-600 dark:text-red-400">⚠️ {error}</p>
            </div>
          )}

          {/* Success state */}
          {success && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/10 border border-emerald-200 dark:border-emerald-900/25 rounded-xl text-center">
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                ✓ Task created successfully
              </p>
            </div>
          )}

          {/* Task form */}
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-[#37352F8c] dark:text-gray-400 uppercase tracking-wider mb-1">
                Task Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="What needs to be done?"
                className="w-full px-3 py-2 text-sm rounded-lg border border-[#EBEBE9] dark:border-[#2F2F2F] bg-white dark:bg-[#191919] text-[#37352F] dark:text-[#D4D4D4] placeholder:text-[#37352F8c] dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-400/50"
                disabled={status === 'loading'}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#37352F8c] dark:text-gray-400 uppercase tracking-wider mb-1">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Additional details..."
                rows={3}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[#EBEBE9] dark:border-[#2F2F2F] bg-white dark:bg-[#191919] text-[#37352F] dark:text-[#D4D4D4] placeholder:text-[#37352F8c] dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-400/50 resize-none"
                disabled={status === 'loading'}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#37352F8c] dark:text-gray-400 uppercase tracking-wider mb-1">
                Due Date
              </label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#37352F8c]" />
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[#EBEBE9] dark:border-[#2F2F2F] bg-white dark:bg-[#191919] text-[#37352F] dark:text-[#D4D4D4] focus:outline-none focus:ring-2 focus:ring-purple-400/50"
                  disabled={status === 'loading'}
                />
              </div>
            </div>

            <button
              onClick={handleAddTask}
              disabled={status === 'loading' || !title.trim()}
              className={cn(
                "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer",
                title.trim() && status !== 'loading'
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                  : "bg-[#F1F1F0] dark:bg-[#2F2F2F] text-[#37352F8c] dark:text-gray-500 cursor-not-allowed"
              )}
            >
              {status === 'loading' ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus size={16} />
                  Add to Google Tasks
                </>
              )}
            </button>
          </div>

          {/* Info footer */}
          <div className="pt-2 border-t border-[#EBEBE9] dark:border-[#2F2F2F]">
            <p className="text-[10px] text-[#37352F8c] dark:text-gray-500 text-center">
              Tasks are created in your default Google Tasks list.
              Requires Google Workspace to be linked.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
