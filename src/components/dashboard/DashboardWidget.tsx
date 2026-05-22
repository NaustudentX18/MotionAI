import React from 'react';
import type { Page } from '../../types';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Circle,
  Clock3,
  Inbox,
  ListFilter,
  Search,
  ShieldAlert,
  Sparkles,
  UserRound,
} from 'lucide-react';
import {
  PRIORITY_ORDER,
  applyTaskFilters,
  buildTaskItems,
  dueBucket,
  getTaskStats,
  listAssignees,
  type DueDateFilter,
  type TaskFilters,
  type TaskItem,
  type TaskPriority,
  type TaskStatusFilter,
} from '../tasks/taskAdapter';

interface DashboardWidgetProps {
  pages: Page[];
  onSelectPage: (id: string) => void;
  isLoading?: boolean;
  error?: string | null;
}

const priorityStyles: Record<TaskPriority | 'None', string> = {
  Urgent: 'bg-red-500 text-white border-red-500',
  High: 'bg-amber-400 text-stone-950 border-amber-400',
  Normal: 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-200 dark:border-cyan-900/50',
  Low: 'bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-900 dark:text-stone-300 dark:border-stone-700',
  None: 'bg-transparent text-stone-500 border-stone-200 dark:border-stone-700 dark:text-stone-400',
};

const dueStyles: Record<ReturnType<typeof dueBucket>, string> = {
  overdue: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-300 dark:border-red-900/50',
  today: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/20 dark:text-amber-200 dark:border-amber-900/50',
  next7: 'bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-950/20 dark:text-cyan-200 dark:border-cyan-900/50',
  later: 'bg-stone-50 text-stone-600 border-stone-200 dark:bg-stone-900 dark:text-stone-300 dark:border-stone-700',
  'no-date': 'bg-white/70 text-stone-500 border-stone-200 dark:bg-stone-950/40 dark:text-stone-400 dark:border-stone-800',
};

const dueLabels: Record<ReturnType<typeof dueBucket>, string> = {
  overdue: 'Overdue',
  today: 'Today',
  next7: 'Next 7 days',
  later: 'Later',
  'no-date': 'No date',
};

function formatMinutes(minutes: number): string {
  if (minutes <= 0) return '0h';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  return `${(minutes / 60).toFixed(1)}h`;
}

function formatDueDate(date?: string): string {
  if (!date) return 'No date';
  const parsed = new Date(`${date.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(parsed);
}

function StateCard({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  detail: string;
  tone: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-[#1B1B1A]">
      <div className={`absolute -right-8 -top-10 h-24 w-24 rounded-full blur-2xl ${tone}`} />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-stone-500 dark:text-stone-400">{label}</p>
          <p className="mt-1 font-serif text-3xl font-black leading-none text-stone-950 dark:text-stone-50">{value}</p>
          <p className="mt-2 text-[11px] font-medium text-stone-500 dark:text-stone-400">{detail}</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-2 text-stone-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200">
          {icon}
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1 text-[10px] font-black uppercase tracking-[0.16em] text-stone-500 dark:text-stone-400 sm:min-w-[9.5rem]">
      {label}
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        className="h-10 rounded-xl border border-stone-200 bg-white px-3 text-xs font-bold normal-case tracking-normal text-stone-800 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/30 dark:border-stone-800 dark:bg-[#1B1B1A] dark:text-stone-100"
      >
        {children}
      </select>
    </label>
  );
}

function TaskMetaPill({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${className}`}>
      {children}
    </span>
  );
}

function TaskRow({ task, onSelectPage }: { task: TaskItem; onSelectPage: (id: string) => void }) {
  const bucket = dueBucket(task);
  const priority = task.priority ?? 'None';

  return (
    <button
      type="button"
      onClick={() => onSelectPage(task.sourcePageId)}
      className="group w-full rounded-2xl border border-stone-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-amber-300/40 dark:border-stone-800 dark:bg-[#191918] dark:hover:border-amber-600"
      aria-label={`Open ${task.title} in ${task.sourcePageTitle}`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 rounded-full border p-1 ${task.completed ? 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300' : 'border-stone-300 bg-stone-50 text-stone-400 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-500'}`}>
          {task.completed ? <CheckCircle2 size={15} /> : <Circle size={15} />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className={`truncate text-sm font-black tracking-tight ${task.completed ? 'text-stone-400 line-through dark:text-stone-500' : 'text-stone-900 dark:text-stone-100'}`}>
                {task.title}
              </p>
              <p className="mt-0.5 truncate text-[11px] font-medium text-stone-500 dark:text-stone-400">
                {task.sourceType === 'page' ? 'Task page' : 'Checklist'} · {task.sourcePageTitle}
              </p>
            </div>
            <ArrowRight size={16} className="hidden shrink-0 text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-amber-500 sm:block" />
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <TaskMetaPill className={dueStyles[bucket]}>
              <CalendarClock size={11} /> {dueLabels[bucket]} · {formatDueDate(task.dueDate)}
            </TaskMetaPill>
            <TaskMetaPill className={priorityStyles[priority]}>
              <ShieldAlert size={11} /> {priority}
            </TaskMetaPill>
            <TaskMetaPill className="border-stone-200 bg-stone-50 text-stone-600 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300">
              <UserRound size={11} /> {task.assignee || 'Unassigned'}
            </TaskMetaPill>
            {task.isInbox && (
              <TaskMetaPill className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                <Inbox size={11} /> Inbox
              </TaskMetaPill>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.6fr_0.9fr]">
      <div className="space-y-3 rounded-3xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-[#191918]">
        {[0, 1, 2].map(index => (
          <div key={index} className="animate-pulse rounded-2xl border border-stone-100 bg-stone-50 p-4 dark:border-stone-800 dark:bg-stone-900/50">
            <div className="h-4 w-2/3 rounded bg-stone-200 dark:bg-stone-700" />
            <div className="mt-3 h-3 w-1/2 rounded bg-stone-100 dark:bg-stone-800" />
          </div>
        ))}
      </div>
      <div className="animate-pulse rounded-3xl border border-stone-200 bg-stone-100 p-5 dark:border-stone-800 dark:bg-stone-900" />
    </div>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-3xl border border-dashed border-stone-300 bg-white/70 p-8 text-center dark:border-stone-700 dark:bg-[#191918]">
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
        <Sparkles size={28} />
      </div>
      <h3 className="mt-4 font-serif text-2xl font-black text-stone-950 dark:text-stone-50">
        {hasFilters ? 'No tasks match this cut' : 'The home inbox is clear'}
      </h3>
      <p className="mt-2 max-w-md text-sm text-stone-500 dark:text-stone-400">
        {hasFilters
          ? 'Loosen the filters to bring more work back into view.'
          : 'Add todo blocks or page-level due date, priority, assignee, or time tracking properties to populate My Tasks.'}
      </p>
    </div>
  );
}

export function DashboardWidget({ pages, onSelectPage, isLoading = false, error = null }: DashboardWidgetProps) {
  const [filters, setFilters] = React.useState<TaskFilters>({
    query: '',
    status: 'open',
    due: 'all',
    priority: 'all',
    assignee: 'all',
  });

  const taskState = React.useMemo(() => {
    try {
      return { tasks: buildTaskItems(pages), error: null as string | null };
    } catch (err) {
      return {
        tasks: [] as TaskItem[],
        error: err instanceof Error ? err.message : 'Unable to read task data from this workspace.',
      };
    }
  }, [pages]);

  const tasks = taskState.tasks;
  const stats = React.useMemo(() => getTaskStats(tasks), [tasks]);
  const assignees = React.useMemo(() => listAssignees(tasks), [tasks]);
  const filteredTasks = React.useMemo(() => applyTaskFilters(tasks, filters), [tasks, filters]);
  const inboxTasks = React.useMemo(() => tasks.filter(task => task.isInbox).slice(0, 6), [tasks]);
  const urgentTasks = React.useMemo(
    () => tasks.filter(task => !task.completed && (dueBucket(task) === 'overdue' || task.priority === 'Urgent')).slice(0, 4),
    [tasks]
  );

  const hasFilters = filters.query.trim() !== '' || filters.status !== 'open' || filters.due !== 'all' || filters.priority !== 'all' || filters.assignee !== 'all';
  const taskError = error || taskState.error;

  const updateFilter = <K extends keyof TaskFilters>(key: K, value: TaskFilters[K]) => {
    setFilters(current => ({ ...current, [key]: value }));
  };

  return (
    <div className="h-full w-full overflow-y-auto bg-[#F4F1EA] px-3 py-4 text-stone-900 dark:bg-[#111110] dark:text-stone-100 sm:px-6 sm:py-8 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 pb-28">
        <section className="relative overflow-hidden rounded-[2rem] border border-stone-900/10 bg-[#14120F] p-5 text-white shadow-2xl shadow-stone-950/10 dark:border-stone-700 sm:p-7">
          <div className="absolute inset-y-0 right-0 w-2/3 bg-[radial-gradient(circle_at_70%_30%,rgba(245,158,11,0.34),transparent_34%),radial-gradient(circle_at_82%_70%,rgba(20,184,166,0.22),transparent_28%)]" />
          <div className="relative grid gap-6 lg:grid-cols-[1.5fr_0.8fr] lg:items-end">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-amber-100">
                <Inbox size={13} /> Home Command Surface
              </div>
              <h1 className="font-serif text-4xl font-black leading-[0.95] tracking-tight sm:text-5xl lg:text-6xl">
                My Tasks,
                <span className="block text-amber-200">without the drift.</span>
              </h1>
              <p className="mt-4 max-w-2xl text-sm font-medium leading-6 text-stone-300 sm:text-base">
                A consolidated home surface for page tasks and inline checklists, using the current workspace schema only: due date, priority, assignee, time tracking, and todo completion.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">Open Loop Load</p>
                  <p className="mt-1 font-serif text-4xl font-black text-white">{stats.open}</p>
                </div>
                <div className="h-20 w-20 rounded-full border-8 border-stone-700 border-t-amber-300 border-r-cyan-300 shadow-inner" aria-hidden="true" />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[10px] font-black uppercase tracking-[0.12em] text-stone-300">
                <span className="rounded-xl bg-white/10 px-2 py-2">{stats.inbox} inbox</span>
                <span className="rounded-xl bg-white/10 px-2 py-2">{stats.overdue} late</span>
                <span className="rounded-xl bg-white/10 px-2 py-2">{stats.completionRate}% done</span>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StateCard icon={<Inbox size={18} />} label="Inbox" value={stats.inbox} detail="Open tasks missing routing metadata" tone="bg-amber-300/40" />
          <StateCard icon={<CalendarClock size={18} />} label="Due today" value={stats.today} detail={`${stats.next7} more in the next 7 days`} tone="bg-cyan-300/40" />
          <StateCard icon={<AlertTriangle size={18} />} label="Overdue" value={stats.overdue} detail="Open tasks past their due date" tone="bg-red-300/40" />
          <StateCard icon={<Clock3 size={18} />} label="Tracked" value={formatMinutes(stats.trackedMinutes)} detail={`${formatMinutes(stats.estimatedMinutes)} estimated`} tone="bg-emerald-300/40" />
        </section>

        <section className="rounded-[1.75rem] border border-stone-200 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-stone-800 dark:bg-[#171716]/90">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end">
            <label className="flex flex-1 flex-col gap-1 text-[10px] font-black uppercase tracking-[0.16em] text-stone-500 dark:text-stone-400">
              Search tasks
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="search"
                  value={filters.query}
                  onChange={event => updateFilter('query', event.target.value)}
                  placeholder="Task title, page, assignee, priority..."
                  className="h-10 w-full rounded-xl border border-stone-200 bg-white pl-9 pr-3 text-sm font-semibold normal-case tracking-normal text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-300/30 dark:border-stone-800 dark:bg-[#1B1B1A] dark:text-stone-100"
                />
              </div>
            </label>

            <div className="flex flex-col gap-3 sm:flex-row lg:flex-[1.6]">
              <FilterSelect label="Status" value={filters.status} onChange={value => updateFilter('status', value as TaskStatusFilter)}>
                <option value="open">Open</option>
                <option value="completed">Completed</option>
                <option value="all">All</option>
              </FilterSelect>
              <FilterSelect label="Due" value={filters.due} onChange={value => updateFilter('due', value as DueDateFilter)}>
                <option value="all">All dates</option>
                <option value="overdue">Overdue</option>
                <option value="today">Today</option>
                <option value="next7">Next 7 days</option>
                <option value="no-date">No date</option>
              </FilterSelect>
              <FilterSelect label="Priority" value={filters.priority} onChange={value => updateFilter('priority', value as TaskFilters['priority'])}>
                <option value="all">All priorities</option>
                {(Object.keys(PRIORITY_ORDER) as TaskPriority[]).map(priority => (
                  <option key={priority} value={priority}>{priority}</option>
                ))}
                <option value="None">None</option>
              </FilterSelect>
              <FilterSelect label="Assignee" value={filters.assignee} onChange={value => updateFilter('assignee', value)}>
                <option value="all">All assignees</option>
                {assignees.map(assignee => (
                  <option key={assignee} value={assignee}>{assignee}</option>
                ))}
              </FilterSelect>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-stone-200 pt-3 text-[11px] font-bold text-stone-500 dark:border-stone-800 dark:text-stone-400">
            <span className="inline-flex items-center gap-2"><ListFilter size={14} /> {filteredTasks.length} of {tasks.length} tasks visible</span>
            {hasFilters && (
              <button
                type="button"
                onClick={() => setFilters({ query: '', status: 'open', due: 'all', priority: 'all', assignee: 'all' })}
                className="rounded-full border border-stone-200 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-stone-600 transition hover:border-amber-300 hover:text-stone-950 dark:border-stone-700 dark:text-stone-300 dark:hover:border-amber-700 dark:hover:text-white"
              >
                Reset filters
              </button>
            )}
          </div>
        </section>

        {taskError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300" role="alert">
            Unable to render task surface: {taskError}
          </div>
        )}

        {isLoading ? (
          <LoadingState />
        ) : (
          <section className="grid gap-5 lg:grid-cols-[1.55fr_0.85fr]">
            <div className="rounded-[1.75rem] border border-stone-200 bg-[#FBFAF7] p-3 shadow-sm dark:border-stone-800 dark:bg-[#151514] sm:p-4">
              <div className="mb-3 flex items-center justify-between gap-3 px-1">
                <div>
                  <h2 className="font-serif text-2xl font-black text-stone-950 dark:text-stone-50">My Tasks</h2>
                  <p className="text-xs font-medium text-stone-500 dark:text-stone-400">Sorted by open state, due date, then priority.</p>
                </div>
                <div className="hidden rounded-full border border-stone-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-stone-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 sm:block">
                  {stats.completed}/{stats.total} closed
                </div>
              </div>

              <div className="space-y-2">
                {filteredTasks.length === 0 ? (
                  <EmptyState hasFilters={hasFilters} />
                ) : (
                  filteredTasks.map(task => <TaskRow key={`${task.sourceType}-${task.id}`} task={task} onSelectPage={onSelectPage} />)
                )}
              </div>
            </div>

            <aside className="flex flex-col gap-5">
              <div className="rounded-[1.75rem] border border-amber-200 bg-amber-50/80 p-4 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/10">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-serif text-xl font-black text-stone-950 dark:text-stone-50">Inbox triage</h2>
                    <p className="text-xs font-medium text-stone-600 dark:text-stone-400">Schema-compatible inbox = open tasks with no due date, priority, or assignee.</p>
                  </div>
                  <Inbox size={20} className="text-amber-700 dark:text-amber-300" />
                </div>
                <div className="space-y-2">
                  {inboxTasks.length === 0 ? (
                    <p className="rounded-2xl border border-amber-200 bg-white/70 p-4 text-sm font-semibold text-amber-800 dark:border-amber-900/50 dark:bg-stone-950/20 dark:text-amber-200">
                      Nothing is waiting for triage.
                    </p>
                  ) : (
                    inboxTasks.map(task => <TaskRow key={`inbox-${task.sourceType}-${task.id}`} task={task} onSelectPage={onSelectPage} />)
                  )}
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-[#191918]">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-serif text-xl font-black text-stone-950 dark:text-stone-50">Needs attention</h2>
                    <p className="text-xs font-medium text-stone-500 dark:text-stone-400">Overdue or urgent open work.</p>
                  </div>
                  <AlertTriangle size={20} className="text-red-500" />
                </div>
                <div className="space-y-2">
                  {urgentTasks.length === 0 ? (
                    <p className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm font-semibold text-stone-600 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300">
                      No urgent fires. Keep the board moving.
                    </p>
                  ) : (
                    urgentTasks.map(task => <TaskRow key={`urgent-${task.sourceType}-${task.id}`} task={task} onSelectPage={onSelectPage} />)
                  )}
                </div>
              </div>
            </aside>
          </section>
        )}

        <div className="rounded-2xl border border-stone-200 bg-white/70 p-3 text-[11px] font-semibold text-stone-500 dark:border-stone-800 dark:bg-[#171716] dark:text-stone-400">
          Reminder/status note: this surface does not add schema. Status is inferred from todo completion; page tasks are complete only when all internal todos are checked. Reminder scheduling is not shown because the current task model has no reminder field.
        </div>
      </div>
    </div>
  );
}
