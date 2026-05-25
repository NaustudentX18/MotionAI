import {
  applyTaskFilters,
  buildTaskItems,
  getTaskStats,
  reminderBucket,
  type TaskFilters,
} from '../src/components/tasks/taskAdapter';
import {
  DEFAULT_REMINDER_SNOOZE_MINUTES,
  buildReminderKey,
  formatLocalReminderDateTime,
  snoozeReminderDate,
} from '../src/hooks/useReminders';
import type { Page } from '../src/types';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function minutesFromNow(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

const pages: Page[] = [
  {
    id: 'due-reminder',
    title: 'Call supplier',
    icon: null,
    cover: null,
    blocks: [],
    reminderDate: minutesFromNow(-5),
    priority: 'High',
    createdAt: 1,
    updatedAt: 1,
  },
  {
    id: 'upcoming-reminder',
    title: 'Prepare standup notes',
    icon: null,
    cover: null,
    blocks: [],
    reminderDate: minutesFromNow(30),
    createdAt: 1,
    updatedAt: 1,
  },
  {
    id: 'plain-task',
    title: 'Inbox task',
    icon: null,
    cover: null,
    blocks: [{ id: 'todo-1', type: 'todo', content: 'Ship the update', checked: false }],
    createdAt: 1,
    updatedAt: 1,
  },
];

const baseFilters: TaskFilters = {
  query: '',
  status: 'all',
  due: 'all',
  reminder: 'all',
  priority: 'all',
  assignee: 'all',
};

const tasks = buildTaskItems(pages);
assert(tasks.length === 3, 'Task adapter should include reminder pages plus checklist items');

const due = tasks.find(task => task.id === 'due-reminder');
const upcoming = tasks.find(task => task.id === 'upcoming-reminder');
const plain = tasks.find(task => task.id === 'todo-1');

assert(due, 'Due reminder task should exist');
assert(upcoming, 'Upcoming reminder task should exist');
assert(plain, 'Plain checklist task should exist');
assert(reminderBucket(due) === 'due', 'Past reminder should be due');
assert(reminderBucket(upcoming) === 'upcoming', 'Near-future reminder should be upcoming');
assert(reminderBucket(plain) === 'none', 'Task without reminder should bucket as none');

const stats = getTaskStats(tasks);
assert(stats.remindersDue === 1, 'Stats should count one due reminder');
assert(stats.remindersUpcoming === 1, 'Stats should count one upcoming reminder');

const dueFiltered = applyTaskFilters(tasks, { ...baseFilters, reminder: 'due' });
assert(dueFiltered.length === 1 && dueFiltered[0].id === 'due-reminder', 'Due reminder filter should isolate due reminder');

const noneFiltered = applyTaskFilters(tasks, { ...baseFilters, reminder: 'none' });
assert(noneFiltered.length === 1 && noneFiltered[0].id === 'todo-1', 'None reminder filter should isolate tasks without reminders');

const fixedLocalDate = new Date(2026, 0, 2, 3, 4, 5);
assert(formatLocalReminderDateTime(fixedLocalDate) === '2026-01-02T03:04', 'Reminder datetime helper should format datetime-local values without seconds');
assert(snoozeReminderDate(DEFAULT_REMINDER_SNOOZE_MINUTES, fixedLocalDate.getTime()) === formatLocalReminderDateTime(new Date(2026, 0, 2, 3, 14, 5)), 'Default snooze should move reminder forward ten minutes');
assert(buildReminderKey('page-1', 12345) === 'page-1:12345', 'Reminder key should stay stable across hook and tests');

console.log('✅ task reminder tests passed');
