import React, { useState, useEffect, useRef } from 'react';
import { Page } from '../../types';
import {
  AlertCircle,
  Calendar,
  User,
  Clock,
  Play,
  Square,
  AlertTriangle,
  CheckCircle,
  HelpCircle
} from 'lucide-react';

interface TaskPropertiesPanelProps {
  page: Page;
  onUpdatePage: (id: string, updates: Partial<Page>) => void;
}

const PRIORITIES = [
  { value: 'Urgent', label: 'Urgent', color: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300 border-red-200 dark:border-red-900/50' },
  { value: 'High', label: 'High', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-900/50' },
  { value: 'Normal', label: 'Normal', color: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-900/50' },
  { value: 'Low', label: 'Low', color: 'bg-stone-100 text-stone-800 dark:bg-stone-950/40 dark:text-stone-300 border-stone-200 dark:border-stone-800/50' }
] as const;

export function TaskPropertiesPanel({ page, onUpdatePage }: TaskPropertiesPanelProps) {
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [estimateInput, setEstimateInput] = useState('');
  
  // Timer state
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync elapsed time from actualTime / timerStartTime
  useEffect(() => {
    if (page.isTimerRunning && page.timerStartTime) {
      const interval = setInterval(() => {
        const currentElapsed = Math.floor((Date.now() - page.timerStartTime!) / 1000);
        setElapsedTime((page.actualTime || 0) * 60 + currentElapsed);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setElapsedTime((page.actualTime || 0) * 60);
    }
  }, [page.isTimerRunning, page.timerStartTime, page.actualTime]);

  const handlePrioritySelect = (p: typeof PRIORITIES[number]['value']) => {
    onUpdatePage(page.id, { priority: p });
    setPriorityOpen(false);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdatePage(page.id, { dueDate: e.target.value });
  };

  const handleReminderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdatePage(page.id, { reminderDate: e.target.value || undefined });
  };

  const handleAssigneeSelect = (name: string) => {
    onUpdatePage(page.id, { assignee: name });
    setAssigneeOpen(false);
  };

  const handleEstimateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEstimateInput(e.target.value);
  };

  const handleEstimateBlur = () => {
    const mins = parseInt(estimateInput, 10);
    if (!isNaN(mins) && mins >= 0) {
      onUpdatePage(page.id, { estimatedTime: mins });
    } else if (estimateInput === '') {
      onUpdatePage(page.id, { estimatedTime: undefined });
    }
    setEstimateInput(page.estimatedTime?.toString() || '');
  };

  // Sync estimate input field
  useEffect(() => {
    setEstimateInput(page.estimatedTime !== undefined ? page.estimatedTime.toString() : '');
  }, [page.estimatedTime]);

  const toggleTimer = () => {
    if (page.isTimerRunning) {
      // Stop timer: calculate total minutes accumulated
      const now = Date.now();
      const sessionSeconds = Math.floor((now - (page.timerStartTime || now)) / 1000);
      const newActualMinutes = (page.actualTime || 0) + (sessionSeconds / 60);
      onUpdatePage(page.id, {
        isTimerRunning: false,
        timerStartTime: undefined,
        actualTime: Math.round(newActualMinutes * 10) / 10 // keep 1 decimal place
      });
    } else {
      // Start timer
      onUpdatePage(page.id, {
        isTimerRunning: true,
        timerStartTime: Date.now(),
        actualTime: page.actualTime || 0
      });
    }
  };

  const resetTimer = () => {
    if (confirm('Are you sure you want to reset tracked time to 0?')) {
      onUpdatePage(page.id, {
        isTimerRunning: false,
        timerStartTime: undefined,
        actualTime: 0
      });
      setElapsedTime(0);
    }
  };

  // Format seconds into HH:MM:SS
  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = Math.floor(totalSeconds % 60);
    return [
      hrs.toString().padStart(2, '0'),
      mins.toString().padStart(2, '0'),
      secs.toString().padStart(2, '0')
    ].join(':');
  };

  const activePriority = PRIORITIES.find(p => p.value === page.priority);
  const currentActualMin = page.actualTime || 0;
  const currentEstimateMin = page.estimatedTime || 0;

  // Calculate indicator colors for estimation status
  let statusColor = 'text-stone-500';
  let progressPercent = 0;
  if (currentEstimateMin > 0) {
    progressPercent = Math.min(100, (currentActualMin / currentEstimateMin) * 100);
    if (currentActualMin > currentEstimateMin) {
      statusColor = 'text-red-500 font-semibold';
    } else if (currentActualMin === currentEstimateMin) {
      statusColor = 'text-amber-500 font-semibold';
    } else if (progressPercent > 80) {
      statusColor = 'text-amber-500';
    } else {
      statusColor = 'text-green-500';
    }
  }

  return (
    <div className="w-full bg-[#FAF9F6] dark:bg-[#1A1A1A] border border-[#EBEBE9] dark:border-[#2F2F2F] rounded-xl p-4 mb-6 shadow-xs flex flex-col md:flex-row gap-4 md:items-center justify-between text-xs select-none transition-all">
      {/* Parameters Panel */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Priority Select */}
        <div className="relative">
          <button
            onClick={() => setPriorityOpen(!priorityOpen)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium cursor-pointer transition-colors shadow-2xs ${
              activePriority?.color || 'bg-white dark:bg-[#252525] text-stone-650 dark:text-stone-400 border-stone-200 dark:border-stone-800'
            }`}
          >
            <AlertCircle size={13} className="opacity-70" />
            <span>Priority: {page.priority || 'None'}</span>
          </button>

          {priorityOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setPriorityOpen(false)} />
              <div className="absolute left-0 mt-1 w-36 bg-white dark:bg-[#1E1E1E] border border-stone-200 dark:border-stone-800 rounded-lg shadow-lg py-1 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                {PRIORITIES.map(p => (
                  <button
                    key={p.value}
                    onClick={() => handlePrioritySelect(p.value)}
                    className="w-full text-left px-3 py-1.5 hover:bg-stone-50 dark:hover:bg-stone-900/50 text-[11px] font-medium flex items-center gap-2 cursor-pointer text-stone-750 dark:text-stone-300"
                  >
                    <span className={`w-2 h-2 rounded-full ${p.value === 'Urgent' ? 'bg-red-500' : p.value === 'High' ? 'bg-amber-500' : p.value === 'Normal' ? 'bg-blue-500' : 'bg-stone-400'}`} />
                    {p.label}
                  </button>
                ))}
                <button
                  onClick={() => { onUpdatePage(page.id, { priority: undefined }); setPriorityOpen(false); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-stone-50 dark:hover:bg-[#2A2A2A] text-[11px] text-red-500 dark:text-red-400 border-t border-stone-100 dark:border-stone-850 cursor-pointer"
                >
                  Clear Priority
                </button>
              </div>
            </>
          )}
        </div>

        {/* Due Date Picker */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white dark:bg-[#252525] border border-stone-200 dark:border-stone-800 rounded-lg text-stone-650 dark:text-stone-400 shadow-2xs">
          <Calendar size={13} className="opacity-70" />
          <span className="mr-0.5">Due:</span>
          <input
            type="date"
            value={page.dueDate || ''}
            onChange={handleDateChange}
            className="bg-transparent border-0 outline-none p-0 cursor-pointer text-stone-800 dark:text-stone-200"
          />
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white dark:bg-[#252525] border border-stone-200 dark:border-stone-800 rounded-lg text-stone-650 dark:text-stone-400 shadow-2xs">
          <Clock size={13} className="opacity-70" />
          <span className="mr-0.5">Reminder:</span>
          <input
            type="datetime-local"
            value={page.reminderDate || ''}
            onChange={handleReminderChange}
            className="bg-transparent border-0 outline-none p-0 cursor-pointer text-stone-800 dark:text-stone-200"
          />
        </div>

        {/* Assignee Manager */}
        <div className="relative">
          <button
            onClick={() => setAssigneeOpen(!assigneeOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white dark:bg-[#252525] border border-stone-200 dark:border-stone-800 rounded-lg text-stone-650 dark:text-stone-400 cursor-pointer hover:bg-stone-50/50 dark:hover:bg-[#2E2E2E] transition-colors shadow-2xs"
          >
            <User size={13} className="opacity-70" />
            <span>Assignee: {page.assignee || 'Unassigned'}</span>
          </button>

          {assigneeOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setAssigneeOpen(false)} />
              <div className="absolute left-0 mt-1 w-44 bg-white dark:bg-[#1E1E1E] border border-stone-200 dark:border-stone-800 rounded-lg shadow-lg py-1 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                {['Me', 'Alice', 'Bob', 'Charlie'].map(name => (
                  <button
                    key={name}
                    onClick={() => handleAssigneeSelect(name)}
                    className="w-full text-left px-3 py-1.5 hover:bg-stone-50 dark:hover:bg-stone-900/50 text-[11px] flex items-center gap-2 cursor-pointer text-stone-750 dark:text-stone-300"
                  >
                    <div className="w-4 h-4 rounded-full bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-[9px] uppercase">
                      {name[0]}
                    </div>
                    {name}
                  </button>
                ))}
                <button
                  onClick={() => { onUpdatePage(page.id, { assignee: undefined }); setAssigneeOpen(false); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-stone-50 dark:hover:bg-[#2A2A2A] text-[11px] text-red-500 dark:text-red-400 border-t border-stone-100 dark:border-stone-850 cursor-pointer"
                >
                  Unassign
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Time Tracking Widget */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-white dark:bg-[#252525] border border-stone-200 dark:border-stone-800 rounded-xl p-3 shadow-2xs flex-1 md:flex-initial max-w-full md:max-w-md">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-[10px] text-stone-400 dark:text-stone-500 font-bold uppercase tracking-wider">Time Tracker</span>
            <span className="text-sm font-mono font-bold tracking-tight text-stone-800 dark:text-stone-200">
              {formatTime(elapsedTime)}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleTimer}
              className={`p-1.5 rounded-lg text-white transition-colors cursor-pointer flex items-center justify-center ${
                page.isTimerRunning
                  ? 'bg-amber-500 hover:bg-amber-600'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
              title={page.isTimerRunning ? 'Pause timer' : 'Start tracking time'}
            >
              {page.isTimerRunning ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" className="translate-x-0.5" />}
            </button>
            
            <button
              onClick={resetTimer}
              className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-900/50 text-stone-550 transition-colors cursor-pointer"
              title="Reset tracked time"
            >
              <Clock size={12} />
            </button>
          </div>
        </div>

        {/* Estimation bar */}
        <div className="flex-1 w-full min-w-[120px] flex flex-col gap-1">
          <div className="flex items-center justify-between text-[10px] text-stone-500 dark:text-stone-400">
            <div className="flex items-center gap-1">
              <span>Est:</span>
              <input
                type="text"
                value={estimateInput}
                onChange={handleEstimateChange}
                onBlur={handleEstimateBlur}
                placeholder="--"
                className="w-8 bg-transparent text-center border-b border-dashed border-stone-300 dark:border-stone-700 focus:border-stone-500 outline-none p-0 text-stone-800 dark:text-stone-200 font-semibold"
              />
              <span>m</span>
            </div>
            <span>Tracked: <strong className={statusColor}>{currentActualMin.toFixed(1)}m</strong></span>
          </div>

          {currentEstimateMin > 0 ? (
            <div className="h-2 w-full bg-stone-100 dark:bg-stone-900 rounded-full overflow-hidden border border-stone-200/20">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  currentActualMin > currentEstimateMin
                    ? 'bg-red-500'
                    : currentActualMin === currentEstimateMin
                    ? 'bg-amber-500'
                    : 'bg-green-500'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          ) : (
            <div className="h-2 w-full bg-stone-100 dark:bg-stone-900 rounded-full border border-stone-200/20 flex items-center justify-center">
              <span className="text-[7px] text-stone-400">No estimate defined</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
