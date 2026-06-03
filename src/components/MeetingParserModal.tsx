import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckSquare, FilePlus2, Loader2, Sparkles, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Block } from '../types';
import { cn } from '../lib/utils';
import { loadSettings } from '../lib/settings';

interface MeetingTask {
  title: string;
  assignee: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high';
}

interface MeetingParserResult {
  summary?: string[];
  tasks?: MeetingTask[];
  source?: string;
  error?: string;
}

interface MeetingParserModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPageTitle?: string;
  currentPageContent?: string;
  canAppendToCurrentPage: boolean;
  onAppendBlocks: (blocks: Block[]) => void;
  onCreateTaskPage: (title: string, blocks: Block[]) => void;
}

type ParseStatus = 'idle' | 'loading' | 'preview' | 'error' | 'applied';

function taskLabel(task: MeetingTask): string {
  const details = [
    task.assignee && task.assignee !== 'Unassigned' ? `Owner: ${task.assignee}` : '',
    task.dueDate && task.dueDate !== 'No due date' ? `Due: ${task.dueDate}` : '',
    task.priority !== 'medium' ? `Priority: ${task.priority}` : '',
  ].filter(Boolean);
  return details.length ? `${task.title} (${details.join(' · ')})` : task.title;
}

function buildMeetingBlocks(summary: string[], tasks: MeetingTask[]): Block[] {
  const blocks: Block[] = [];
  if (summary.length > 0) {
    blocks.push({ id: uuidv4(), type: 'h2', content: 'Meeting summary' });
    summary.forEach(item => blocks.push({ id: uuidv4(), type: 'bullet', content: item }));
  }
  blocks.push({ id: uuidv4(), type: 'h2', content: 'Action items' });
  tasks.forEach(task => blocks.push({ id: uuidv4(), type: 'todo', content: taskLabel(task), checked: false }));
  return blocks;
}

function buildAiPayload(transcript: string) {
  const settings = loadSettings();
  const active = settings.providers[settings.activeProvider];
  return {
    transcript,
    ai: {
      provider: settings.activeProvider,
      baseUrl: active?.baseUrl || '',
      model: active?.model || '',
      apiKey: active?.apiKey || '',
    },
  };
}

export function MeetingParserModal({
  isOpen,
  onClose,
  currentPageTitle,
  currentPageContent,
  canAppendToCurrentPage,
  onAppendBlocks,
  onCreateTaskPage,
}: MeetingParserModalProps) {
  const [status, setStatus] = useState<ParseStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [summary, setSummary] = useState<string[]>([]);
  const [tasks, setTasks] = useState<MeetingTask[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setStatus('idle');
    setError(null);
    setSummary([]);
    setTasks([]);
    setSelected({});
    setSource(null);
    setTranscript(currentPageContent?.trim() || '');
  }, [isOpen]);

  const selectedTasks = useMemo(
    () => tasks.filter((_task, index) => selected[index]),
    [tasks, selected]
  );

  const parseMeeting = async () => {
    const trimmed = transcript.trim();
    if (!trimmed) {
      setError('Paste meeting notes or transcript text before parsing.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setError(null);
    setSource(null);

    try {
      const { motionAiFetch } = await import('../lib/apiClient');
      const res = await motionAiFetch('/api/ai/meeting-parser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildAiPayload(trimmed)),
      });
      const data = await res.json() as MeetingParserResult;
      if (!res.ok || data.error) throw new Error(data.error || 'Meeting parser request failed.');
      const parsedTasks = Array.isArray(data.tasks) ? data.tasks : [];
      if (parsedTasks.length === 0) throw new Error('No action items were returned for this meeting.');
      setSummary(Array.isArray(data.summary) ? data.summary : []);
      setTasks(parsedTasks);
      setSelected(Object.fromEntries(parsedTasks.map((_task, index) => [index, true])));
      setSource(data.source || null);
      setStatus('preview');
    } catch (err: any) {
      setError(err.message || 'Failed to parse meeting notes.');
      setStatus('error');
    }
  };

  const applyBlocks = (mode: 'append' | 'page') => {
    if (selectedTasks.length === 0) {
      setError('Select at least one generated task before applying.');
      setStatus('error');
      return;
    }
    const blocks = buildMeetingBlocks(summary, selectedTasks);
    if (mode === 'append') {
      onAppendBlocks(blocks);
    } else {
      const date = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      onCreateTaskPage(`Meeting tasks - ${date}`, blocks);
    }
    setStatus('applied');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 sm:pt-16 px-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-xs" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[86dvh] overflow-hidden rounded-2xl border border-[#EBEBE9] dark:border-[#2F2F2F] bg-white dark:bg-[#1C1C1C] shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-[#EBEBE9] dark:border-[#2F2F2F] p-4">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-purple-600 dark:text-purple-400" />
            <div>
              <h2 className="text-sm font-bold text-[#37352F] dark:text-[#D4D4D4]">Meeting notes to tasks</h2>
              <p className="text-[11px] text-[#37352F8c] dark:text-stone-400">Parse, preview, select, then apply without writing until you confirm.</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[#37352F8c] transition-colors hover:bg-[#F1F1F0] dark:hover:bg-[#2F2F2F]">
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[calc(86dvh-73px)] overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/25 dark:bg-red-950/10 dark:text-red-400">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {status === 'applied' && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center text-xs font-bold text-emerald-700 dark:border-emerald-900/25 dark:bg-emerald-950/10 dark:text-emerald-400">
              ✓ Applied {selectedTasks.length} selected task{selectedTasks.length === 1 ? '' : 's'}.
            </div>
          )}

          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#37352F8c] dark:text-stone-400">Meeting notes</label>
              {currentPageTitle && <span className="truncate text-[10px] text-[#37352F8c] dark:text-stone-500">Seeded from: {currentPageTitle}</span>}
            </div>
            <textarea
              value={transcript}
              onChange={event => setTranscript(event.target.value)}
              placeholder="Paste meeting notes, transcript, or agenda follow-ups here…"
              rows={7}
              disabled={status === 'loading'}
              className="w-full resize-y rounded-xl border border-[#EBEBE9] bg-white px-3 py-2 text-sm leading-6 text-[#37352F] outline-none placeholder:text-[#37352F8c] focus:ring-2 focus:ring-purple-400/50 dark:border-[#2F2F2F] dark:bg-[#191919] dark:text-[#D4D4D4] dark:placeholder:text-stone-500"
            />
          </div>

          <button
            onClick={parseMeeting}
            disabled={status === 'loading' || !transcript.trim()}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all',
              status !== 'loading' && transcript.trim()
                ? 'bg-purple-600 text-white shadow-sm hover:bg-purple-700'
                : 'cursor-not-allowed bg-[#F1F1F0] text-[#37352F8c] dark:bg-[#2F2F2F] dark:text-stone-500'
            )}
          >
            {status === 'loading' ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {status === 'loading' ? 'Parsing meeting…' : 'Parse meeting notes'}
          </button>

          {tasks.length > 0 && (
            <div className="space-y-3 rounded-2xl border border-[#EBEBE9] bg-[#FBFBFA] p-3 dark:border-[#2F2F2F] dark:bg-[#191919]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#37352F] dark:text-[#D4D4D4]">Preview tasks</h3>
                  <p className="text-[11px] text-[#37352F8c] dark:text-stone-400">{selectedTasks.length} of {tasks.length} selected{source ? ` · ${source}` : ''}</p>
                </div>
                <div className="flex gap-2">
                  <button className="text-[11px] font-semibold text-purple-700 hover:underline dark:text-purple-400" onClick={() => setSelected(Object.fromEntries(tasks.map((_task, index) => [index, true])))}>Select all</button>
                  <button className="text-[11px] font-semibold text-stone-500 hover:underline dark:text-stone-400" onClick={() => setSelected({})}>Clear</button>
                </div>
              </div>

              {summary.length > 0 && (
                <div className="rounded-xl bg-white p-3 text-xs text-stone-600 dark:bg-[#202020] dark:text-stone-300">
                  <p className="mb-1 font-bold text-stone-700 dark:text-stone-200">Summary</p>
                  <ul className="list-disc space-y-1 pl-4">
                    {summary.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
                  </ul>
                </div>
              )}

              <div className="space-y-2">
                {tasks.map((task, index) => (
                  <label key={`${task.title}-${index}`} className="flex items-start gap-3 rounded-xl bg-white p-3 text-sm shadow-xs dark:bg-[#202020]">
                    <input
                      type="checkbox"
                      checked={Boolean(selected[index])}
                      onChange={event => setSelected(prev => ({ ...prev, [index]: event.target.checked }))}
                      className="mt-1 h-4 w-4 rounded border-stone-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-[#37352F] dark:text-[#D4D4D4]">{task.title}</span>
                      <span className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-[#37352F8c] dark:text-stone-400">
                        <span>Owner: {task.assignee || 'Unassigned'}</span>
                        <span>• Due: {task.dueDate || 'No due date'}</span>
                        <span>• Priority: {task.priority}</span>
                      </span>
                    </span>
                  </label>
                ))}
              </div>

              <div className="grid gap-2 border-t border-[#EBEBE9] pt-3 dark:border-[#2F2F2F] sm:grid-cols-2">
                <button
                  onClick={() => applyBlocks('append')}
                  disabled={!canAppendToCurrentPage || selectedTasks.length === 0}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-colors',
                    canAppendToCurrentPage && selectedTasks.length > 0
                      ? 'bg-stone-900 text-white hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white'
                      : 'cursor-not-allowed bg-[#F1F1F0] text-[#37352F8c] dark:bg-[#2F2F2F] dark:text-stone-500'
                  )}
                >
                  <CheckSquare size={15} /> Append blocks to current page
                </button>
                <button
                  onClick={() => applyBlocks('page')}
                  disabled={selectedTasks.length === 0}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-colors',
                    selectedTasks.length > 0
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'cursor-not-allowed bg-[#F1F1F0] text-[#37352F8c] dark:bg-[#2F2F2F] dark:text-stone-500'
                  )}
                >
                  <FilePlus2 size={15} /> Create task page
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
