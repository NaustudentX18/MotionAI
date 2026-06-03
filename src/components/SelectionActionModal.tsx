import React, { useState } from 'react';
import { Wand2, Calendar, CheckSquare, X, Loader2, ArrowRight } from 'lucide-react';
import { addGoogleTask, addGoogleCalendarEvent } from '../lib/workspace';

interface SelectionActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedText: string;
}

export function SelectionActionModal({ isOpen, onClose, selectedText }: SelectionActionModalProps) {
  const [mode, setMode] = useState<'menu' | 'task' | 'event'>('menu');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Todo State
  const [taskTitle, setTaskTitle] = useState('');
  const [taskNotes, setTaskNotes] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');

  // Calendar State
  const [eventSummary, setEventSummary] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventStartTime, setEventStartTime] = useState('');
  const [eventEndTime, setEventEndTime] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      setMode('menu');
      setError(null);
      setSuccess(null);
      
      // Seed prefilled values
      setTaskTitle(selectedText.slice(0, 80));
      setTaskNotes(selectedText);
      
      setEventSummary(selectedText.slice(0, 60));
      setEventDescription(selectedText);
      
      // Default to today
      const today = new Date().toISOString().split('T')[0];
      setEventDate(today);
      setEventStartTime('09:00');
      setEventEndTime('10:00');
    }
  }, [isOpen, selectedText]);

  if (!isOpen) return null;

  const handleAiParse = async () => {
    setLoading(true);
    setError(null);
    try {
      const today = new Date().toISOString().split('T')[0];
      const { motionAiFetch } = await import('../lib/apiClient');
      const res = await motionAiFetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: 'custom',
          context: selectedText,
          prompt: `Extract event scheduling or task information from this text. Today's date is ${today}. Return ONLY a raw JSON object matching this schema without any markdown tags or description block: { "title": "string", "description": "string", "date": "YYYY-MM-DD", "startTime": "HH:MM", "endTime": "HH:MM" }`
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      let cleanText = data.text.trim();
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.substring(7);
      }
      if (cleanText.endsWith('```')) {
        cleanText = cleanText.substring(0, cleanText.length - 3);
      }
      cleanText = cleanText.trim();

      const parsed = JSON.parse(cleanText);
      if (parsed.title) {
        setEventSummary(parsed.title);
        setTaskTitle(parsed.title);
      }
      if (parsed.description) {
        setEventDescription(parsed.description);
        setTaskNotes(parsed.description);
      }
      if (parsed.date) {
        setEventDate(parsed.date);
        setTaskDueDate(parsed.date);
      }
      if (parsed.startTime) setEventStartTime(parsed.startTime);
      if (parsed.endTime) setEventEndTime(parsed.endTime);

      setSuccess("✨ Smart date/time parse successful!");
      setTimeout(() => setSuccess(null), 2000);
    } catch (err: any) {
      setError("AI Parsing failed. Please enter details manually.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const dueDateObj = taskDueDate ? new Date(taskDueDate) : undefined;
      await addGoogleTask(taskTitle, taskNotes, dueDateObj);
      setSuccess('Google Task created successfully!');
      setTimeout(() => onClose(), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (!eventDate || !eventStartTime || !eventEndTime) {
        throw new Error('Please select date and start/end times.');
      }
      const start = new Date(`${eventDate}T${eventStartTime}:00`);
      const end = new Date(`${eventDate}T${eventEndTime}:00`);
      if (end <= start) {
        throw new Error('End time must be after start time.');
      }
      await addGoogleCalendarEvent(eventSummary, eventDescription, start, end);
      setSuccess('Google Calendar event created successfully!');
      setTimeout(() => onClose(), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4" onClick={onClose}>
      <div 
        className="w-full max-w-md bg-white dark:bg-[#191919] rounded-xl shadow-2xl overflow-hidden border border-[#EBEBE9] dark:border-[#2F2F2F] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#EBEBE9] dark:border-[#2F2F2F]">
          <h3 className="font-semibold text-sm text-[#37352F] dark:text-[#D4D4D4] flex items-center gap-2">
            <Wand2 size={16} className="text-purple-600 animate-pulse" />
            <span>Workspace Integrations</span>
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-[#F1F1F0] dark:hover:bg-[#2F2F2F] rounded text-[#37352f7a]">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/10 border border-red-200 dark:border-red-900/20 text-red-600 dark:text-red-400 text-xs rounded-lg text-center font-medium">
              ⚠️ {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-50 dark:bg-green-950/10 border border-green-200 dark:border-green-900/20 text-green-700 dark:text-green-400 text-xs rounded-lg text-center font-medium">
              ✨ {success}
            </div>
          )}

          {/* Selected text preview */}
          <div className="p-3 bg-gray-50 dark:bg-gray-900/20 border border-gray-100 dark:border-gray-800 rounded-lg text-xs leading-relaxed max-h-24 overflow-y-auto italic text-gray-600 dark:text-gray-400">
            "{selectedText}"
          </div>

          <button
            type="button"
            onClick={handleAiParse}
            disabled={loading}
            className="w-full py-2 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/20 dark:hover:bg-purple-900/20 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800/50 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <span>✨ Auto-Parse & Prefill calendar with AI</span>}
          </button>

          {mode === 'menu' && (
            <div className="space-y-2 pt-2">
              <button
                onClick={() => setMode('task')}
                className="w-full flex items-center justify-between p-3 border border-[#EBEBE9] dark:border-[#2F2F2F] rounded-lg hover:bg-purple-50/40 dark:hover:bg-purple-950/5 group text-left transition-colors"
              >
                <div className="flex items-center gap-3">
                  <CheckSquare size={18} className="text-blue-500" />
                  <div>
                    <div className="text-xs font-semibold text-[#37352F] dark:text-[#D4D4D4]">Convert to Google Task</div>
                    <div className="text-[10px] text-[#37352f7a]">Add to your Google Workspace task checklist</div>
                  </div>
                </div>
                <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>

              <button
                onClick={() => setMode('event')}
                className="w-full flex items-center justify-between p-3 border border-[#EBEBE9] dark:border-[#2F2F2F] rounded-lg hover:bg-purple-50/40 dark:hover:bg-purple-950/5 group text-left transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Calendar size={18} className="text-green-500" />
                  <div>
                    <div className="text-xs font-semibold text-[#37352F] dark:text-[#D4D4D4]">Create Google Calendar Event</div>
                    <div className="text-[10px] text-[#37352f7a]">Schedule directly onto your calendar</div>
                  </div>
                </div>
                <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </div>
          )}

          {mode === 'task' && (
            <form onSubmit={handleCreateTask} className="space-y-3 pt-2">
              <div>
                <label className="block text-[10px] font-bold text-[#37352f7a] uppercase mb-1">Task Title</label>
                <input
                  required
                  type="text"
                  value={taskTitle}
                  onChange={e => setTaskTitle(e.target.value)}
                  className="w-full p-2 text-xs border border-[#EBEBE9] dark:border-[#2F2F2F] rounded-lg bg-transparent focus:outline-purple-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#37352f7a] uppercase mb-1">Notes / Details</label>
                <textarea
                  value={taskNotes}
                  onChange={e => setTaskNotes(e.target.value)}
                  className="w-full p-2 text-xs border border-[#EBEBE9] dark:border-[#2F2F2F] rounded-lg bg-transparent min-h-[60px] focus:outline-purple-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#37352f7a] uppercase mb-1">Due Date (Optional)</label>
                <input
                  type="date"
                  value={taskDueDate}
                  onChange={e => setTaskDueDate(e.target.value)}
                  className="w-full p-2 text-xs border border-[#EBEBE9] dark:border-[#2F2F2F] rounded-lg bg-transparent focus:outline-purple-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMode('menu')}
                  className="flex-1 py-1.5 text-xs border border-[#EBEBE9] dark:border-[#2F2F2F] text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-1.5 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-1.5 font-medium disabled:opacity-50"
                >
                  {loading && <Loader2 className="animate-spin" size={12} />}
                  Confirm Task
                </button>
              </div>
            </form>
          )}

          {mode === 'event' && (
            <form onSubmit={handleCreateEvent} className="space-y-3 pt-2">
              <div>
                <label className="block text-[10px] font-bold text-[#37352f7a] uppercase mb-1">Event Title</label>
                <input
                  required
                  type="text"
                  value={eventSummary}
                  onChange={e => setEventSummary(e.target.value)}
                  className="w-full p-2 text-xs border border-[#EBEBE9] dark:border-[#2F2F2F] rounded-lg bg-transparent focus:outline-purple-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#37352f7a] uppercase mb-1">Description</label>
                <textarea
                  value={eventDescription}
                  onChange={e => setEventDescription(e.target.value)}
                  className="w-full p-2 text-xs border border-[#EBEBE9] dark:border-[#2F2F2F] rounded-lg bg-transparent min-h-[50px] focus:outline-purple-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="block text-[10px] font-bold text-[#37352f7a] uppercase mb-1">Date</label>
                  <input
                    required
                    type="date"
                    value={eventDate}
                    onChange={e => setEventDate(e.target.value)}
                    className="w-full p-2 text-xs border border-[#EBEBE9] dark:border-[#2F2F2F] rounded-lg bg-transparent focus:outline-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#37352f7a] uppercase mb-1">Start Time</label>
                  <input
                    required
                    type="time"
                    value={eventStartTime}
                    onChange={e => setEventStartTime(e.target.value)}
                    className="w-full p-2 text-xs border border-[#EBEBE9] dark:border-[#2F2F2F] rounded-lg bg-transparent focus:outline-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#37352f7a] uppercase mb-1">End Time</label>
                  <input
                    required
                    type="time"
                    value={eventEndTime}
                    onChange={e => setEventEndTime(e.target.value)}
                    className="w-full p-2 text-xs border border-[#EBEBE9] dark:border-[#2F2F2F] rounded-lg bg-transparent focus:outline-purple-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMode('menu')}
                  className="flex-1 py-1.5 text-xs border border-[#EBEBE9] dark:border-[#2F2F2F] text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-1.5 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-1.5 font-medium disabled:opacity-50"
                >
                  {loading && <Loader2 className="animate-spin" size={12} />}
                  Schedule Event
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
