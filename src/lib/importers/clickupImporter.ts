import type { Page } from '../../types';
import type { WorkspaceSnapshot } from '../persistence';

export interface ClickUpTask {
  id: string;
  name: string;
  description: string;
  status: string;
  due_date?: string;
  priority?: number;
  assignee?: string;
  parent?: string;
}

export interface ClickUpList {
  id: string;
  name: string;
  tasks: ClickUpTask[];
}

export interface ClickUpSpace {
  id: string;
  name: string;
  lists: ClickUpList[];
}

export interface ImportResult {
  snapshot: WorkspaceSnapshot;
  warnings: string[];
}

function clickUpPriorityLabel(p: number): string {
  const labels: Record<number, string> = { 1: 'urgent', 2: 'high', 3: 'normal', 4: 'low' };
  return labels[p] ?? 'normal';
}

function clickUpDueDate(ts?: string): string | undefined {
  if (!ts) return undefined;
  const d = new Date(Number(ts));
  return isNaN(d.getTime()) ? undefined : d.toISOString().split('T')[0];
}

function taskToPage(task: ClickUpTask, listName: string): Page {
  const blocks = [
    { id: crypto.randomUUID(), type: 'p' as const, content: task.description || 'Imported from ClickUp' },
  ];

  const page: Page = {
    id: `clickup-${task.id}`,
    title: task.name,
    icon: '✅',
    cover: null,
    blocks,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  if (task.due_date) page.dueDate = clickUpDueDate(task.due_date);
  if (task.priority) (page as any).priority = clickUpPriorityLabel(task.priority) as any;
  if (task.assignee) page.assignee = task.assignee;
  if (task.parent) page.parentId = `clickup-${task.parent}`;

  return page;
}

export function clickupExportToWorkspace(spaces: ClickUpSpace[]): ImportResult {
  const warnings: string[] = [];
  const pages: Page[] = [];

  for (const space of spaces) {
    const spacePage: Page = {
      id: `clickup-space-${space.id}`,
      title: space.name,
      icon: '📁',
    cover: null,
      blocks: [{ id: crypto.randomUUID(), type: 'p', content: `Imported ClickUp space: ${space.name}` }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pageType: 'block',
    };
    pages.push(spacePage);

    for (const list of space.lists) {
      const listPage: Page = {
        id: `clickup-list-${list.id}`,
        title: list.name,
        icon: '📋',
    cover: null,
        blocks: [{ id: crypto.randomUUID(), type: 'p', content: `Imported ClickUp list: ${list.name}` }],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        parentId: spacePage.id,
      };
      pages.push(listPage);

      for (const task of list.tasks) {
        const taskPage = taskToPage(task, list.name);
        taskPage.parentId = listPage.id;
        pages.push(taskPage);
      }

      warnings.push(`List "${list.name}": imported ${list.tasks.length} tasks.`);
    }
  }

  warnings.push(`Total: ${spaces.length} space(s), ${pages.length} page(s) imported from ClickUp CSV/JSON format.`);

  return {
    snapshot: {
      pages,
      currentPageId: pages[0]?.id ?? null,
    },
    warnings,
  };
}
