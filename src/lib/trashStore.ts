import type { Page } from '../types';

export interface TrashEntry {
  page: Page;
  deletedAt: number;
}

const TRASH_KEY = 'motionai-trash';

function readAll(): Record<string, TrashEntry[]> {
  try {
    const raw = localStorage.getItem(TRASH_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, TrashEntry[]>): void {
  localStorage.setItem(TRASH_KEY, JSON.stringify(data));
}

export function getTrash(workspaceId: string): TrashEntry[] {
  return readAll()[workspaceId] ?? [];
}

export function addToTrash(workspaceId: string, page: Page): void {
  const all = readAll();
  const list = all[workspaceId] ?? [];
  const without = list.filter(entry => entry.page.id !== page.id);
  all[workspaceId] = [{ page, deletedAt: Date.now() }, ...without];
  writeAll(all);
}

export function removeFromTrash(workspaceId: string, pageId: string): Page | null {
  const all = readAll();
  const list = all[workspaceId] ?? [];
  const entry = list.find(e => e.page.id === pageId);
  all[workspaceId] = list.filter(e => e.page.id !== pageId);
  writeAll(all);
  return entry?.page ?? null;
}

export function clearTrash(workspaceId: string): void {
  const all = readAll();
  delete all[workspaceId];
  writeAll(all);
}
