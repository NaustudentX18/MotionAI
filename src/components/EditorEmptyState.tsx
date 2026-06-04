import { Sparkles, ListTodo, Mic, BookOpen } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import type { Block } from '../types';

interface EditorEmptyStateProps {
  onApplyTemplate: (blocks: Block[], title?: string) => void;
}

const TEMPLATES: { label: string; icon: typeof Sparkles; title: string; blocks: Block[] }[] = [
  {
    label: 'Daily journal',
    icon: BookOpen,
    title: '',
    blocks: [
      { id: uuidv4(), type: 'h2', content: 'Today' },
      { id: uuidv4(), type: 'p', content: 'What matters most right now?' },
      { id: uuidv4(), type: 'todo', content: 'Top priority', checked: false },
    ],
  },
  {
    label: 'Meeting notes',
    icon: Mic,
    title: 'Meeting notes',
    blocks: [
      { id: uuidv4(), type: 'h2', content: 'Attendees' },
      { id: uuidv4(), type: 'p', content: '' },
      { id: uuidv4(), type: 'h2', content: 'Decisions' },
      { id: uuidv4(), type: 'bullet', content: '' },
      { id: uuidv4(), type: 'h2', content: 'Action items' },
      { id: uuidv4(), type: 'todo', content: '', checked: false },
    ],
  },
  {
    label: 'Task sprint',
    icon: ListTodo,
    title: 'Sprint board',
    blocks: [
      { id: uuidv4(), type: 'h2', content: 'This week' },
      { id: uuidv4(), type: 'todo', content: 'Ship feature', checked: false },
      { id: uuidv4(), type: 'todo', content: 'Review PRs', checked: false },
      { id: uuidv4(), type: 'callout', content: 'Tip: use [[wiki links]] to connect specs.' },
    ],
  },
  {
    label: 'Brainstorm',
    icon: Sparkles,
    title: 'Ideas',
    blocks: [
      { id: uuidv4(), type: 'h2', content: 'Brain dump' },
      { id: uuidv4(), type: 'bullet', content: 'First idea…' },
      { id: uuidv4(), type: 'bullet', content: 'Second idea…' },
    ],
  },
];

export function EditorEmptyState({ onApplyTemplate }: EditorEmptyStateProps) {
  return (
    <div className="motion-prose mx-auto max-w-2xl px-6 py-10 text-center animate-in fade-in duration-300">
      <p className="text-sm font-semibold text-stone-500 dark:text-stone-400 mb-1">Blank canvas</p>
      <h2 className="text-xl font-bold text-stone-800 dark:text-stone-100 mb-2">Start with a template</h2>
      <p className="text-sm text-stone-500 dark:text-stone-400 mb-6 max-w-md mx-auto">
        Pick a structure below or type <kbd className="rounded border px-1 text-xs">/</kbd> for slash commands.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TEMPLATES.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() =>
              onApplyTemplate(
                t.blocks.map((b) => ({ ...b, id: uuidv4() })),
                t.title || undefined,
              )
            }
            className="flex flex-col items-center gap-2 rounded-xl border border-stone-200 bg-stone-50/80 p-4 text-left transition-all hover:border-purple-300 hover:shadow-md dark:border-stone-700 dark:bg-stone-800/50 dark:hover:border-purple-600"
          >
            <t.icon size={20} className="text-purple-600 dark:text-purple-400" />
            <span className="text-xs font-semibold text-stone-700 dark:text-stone-200">{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
