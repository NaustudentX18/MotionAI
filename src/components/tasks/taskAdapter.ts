import type { Page } from '../../types';

export type TaskPriority = NonNullable<Page['priority']>;
export type TaskStatus = 'open' | 'completed';
export type TaskSourceType = 'page' | 'todo';
export type DueDateFilter = 'all' | 'overdue' | 'today' | 'next7' | 'no-date';
export type TaskStatusFilter = 'all' | TaskStatus;

export interface TaskItem {
  id: string;
  title: string;
  sourcePageId: string;
  sourcePageTitle: string;
  sourceType: TaskSourceType;
  dueDate?: string;
  priority?: TaskPriority;
  assignee?: string;
  completed: boolean;
  status: TaskStatus;
  estimatedTime?: number;
  actualTime?: number;
  isInbox: boolean;
}

export interface TaskFilters {
  query: string;
  status: TaskStatusFilter;
  due: DueDateFilter;
  priority: 'all' | TaskPriority | 'None';
  assignee: 'all' | string;
}

export interface TaskStats {
  total: number;
  open: number;
  completed: number;
  overdue: number;
  today: number;
  next7: number;
  inbox: number;
  completionRate: number;
  trackedMinutes: number;
  estimatedMinutes: number;
}

export const PRIORITY_ORDER: Record<TaskPriority, number> = {
  Urgent: 0,
  High: 1,
  Normal: 2,
  Low: 3,
};

export function dateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDaysKey(days: number, from = new Date()): string {
  const date = new Date(from);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

function normalizeDate(value?: string): string | undefined {
  if (!value) return undefined;
  return value.slice(0, 10);
}

function isTaskPage(page: Page): boolean {
  return Boolean(
    page.priority ||
    page.dueDate ||
    page.assignee ||
    page.estimatedTime !== undefined ||
    page.actualTime !== undefined ||
    page.isTimerRunning
  );
}

function compareTaskItems(a: TaskItem, b: TaskItem): number {
  if (a.completed !== b.completed) return a.completed ? 1 : -1;
  const aDue = normalizeDate(a.dueDate) ?? '9999-12-31';
  const bDue = normalizeDate(b.dueDate) ?? '9999-12-31';
  if (aDue !== bDue) return aDue.localeCompare(bDue);

  const aPriority = a.priority ? PRIORITY_ORDER[a.priority] : 9;
  const bPriority = b.priority ? PRIORITY_ORDER[b.priority] : 9;
  if (aPriority !== bPriority) return aPriority - bPriority;

  return a.title.localeCompare(b.title);
}

export function buildTaskItems(pages: Page[]): TaskItem[] {
  const tasks: TaskItem[] = [];

  pages.forEach(page => {
    const blocks = Array.isArray(page.blocks) ? page.blocks : [];
    const todos = blocks.filter(block => block.type === 'todo');
    const sourcePageTitle = page.title || 'Untitled Page';

    if (isTaskPage(page)) {
      const completed = todos.length > 0 && todos.every(todo => todo.checked === true);
      const dueDate = normalizeDate(page.dueDate);
      const task: TaskItem = {
        id: page.id,
        title: sourcePageTitle,
        sourcePageId: page.id,
        sourcePageTitle,
        sourceType: 'page',
        dueDate,
        priority: page.priority,
        assignee: page.assignee,
        completed,
        status: completed ? 'completed' : 'open',
        estimatedTime: page.estimatedTime,
        actualTime: page.actualTime,
        isInbox: !completed && !dueDate && !page.priority && !page.assignee,
      };
      tasks.push(task);
    }

    todos.forEach(todo => {
      const completed = todo.checked === true;
      const dueDate = normalizeDate(page.dueDate);
      tasks.push({
        id: todo.id,
        title: todo.content || 'Untitled checklist item',
        sourcePageId: page.id,
        sourcePageTitle,
        sourceType: 'todo',
        dueDate,
        priority: page.priority,
        assignee: page.assignee,
        completed,
        status: completed ? 'completed' : 'open',
        isInbox: !completed && !dueDate && !page.priority && !page.assignee,
      });
    });
  });

  return tasks.sort(compareTaskItems);
}

export function dueBucket(task: TaskItem, today = dateKey(), next7 = addDaysKey(7)): Exclude<DueDateFilter, 'all'> | 'later' {
  const dueDate = normalizeDate(task.dueDate);
  if (!dueDate) return 'no-date';
  if (dueDate < today) return 'overdue';
  if (dueDate === today) return 'today';
  if (dueDate <= next7) return 'next7';
  return 'later';
}

export function matchesDueFilter(task: TaskItem, filter: DueDateFilter): boolean {
  if (filter === 'all') return true;
  return dueBucket(task) === filter;
}

export function applyTaskFilters(tasks: TaskItem[], filters: TaskFilters): TaskItem[] {
  const query = filters.query.trim().toLowerCase();

  return tasks.filter(task => {
    if (query) {
      const haystack = `${task.title} ${task.sourcePageTitle} ${task.assignee ?? ''} ${task.priority ?? ''}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    if (filters.status !== 'all' && task.status !== filters.status) return false;
    if (!matchesDueFilter(task, filters.due)) return false;
    if (filters.priority !== 'all') {
      if (filters.priority === 'None') {
        if (task.priority) return false;
      } else if (task.priority !== filters.priority) {
        return false;
      }
    }
    if (filters.assignee !== 'all' && (task.assignee || 'Unassigned') !== filters.assignee) return false;

    return true;
  });
}

export function getTaskStats(tasks: TaskItem[]): TaskStats {
  const openTasks = tasks.filter(task => !task.completed);
  const completed = tasks.length - openTasks.length;
  const today = dateKey();
  const next7 = addDaysKey(7);

  return {
    total: tasks.length,
    open: openTasks.length,
    completed,
    overdue: openTasks.filter(task => dueBucket(task, today, next7) === 'overdue').length,
    today: openTasks.filter(task => dueBucket(task, today, next7) === 'today').length,
    next7: openTasks.filter(task => dueBucket(task, today, next7) === 'next7').length,
    inbox: openTasks.filter(task => task.isInbox).length,
    completionRate: tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0,
    trackedMinutes: tasks.reduce((sum, task) => sum + (task.actualTime ?? 0), 0),
    estimatedMinutes: tasks.reduce((sum, task) => sum + (task.estimatedTime ?? 0), 0),
  };
}

export function listAssignees(tasks: TaskItem[]): string[] {
  return Array.from(new Set(tasks.map(task => task.assignee || 'Unassigned'))).sort((a, b) => a.localeCompare(b));
}
