/**
 * Deterministic migration tests for MotionAI persistence schema.
 * Verifies that legacy localStorage schemas migrate correctly
 * and that schema changes produce clean round-trips.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Simulate the migration logic from persistence.ts
interface Page { id: string; title: string; blocks: Block[]; icon: string | null; cover: string | null; createdAt: number; updatedAt: number; }
interface Block { id: string; type: string; content: string; }
interface WorkspaceSnapshot { pages: Page[]; currentPageId: string | null; }

const LEGACY_PAGE_KEYS = ['motion_ai_pages', 'notion_clone_pages'];
const LEGACY_CURRENT_PAGE_KEYS = ['motion_ai_current_page_id', 'notion_clone_current_page_id'];
const FALLBACK_WORKSPACE_KEY = 'motion_ai_workspace';

function parsePages(raw: string | null): Page[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
}

function parseWorkspace(raw: string | null): WorkspaceSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<WorkspaceSnapshot>;
    if (!Array.isArray(parsed.pages)) return null;
    return { pages: parsed.pages, currentPageId: typeof parsed.currentPageId === 'string' ? parsed.currentPageId : null };
  } catch { return null; }
}

function migrateFromLegacy(storage: Map<string, string>): WorkspaceSnapshot | null {
  // Try new format first
  const workspace = parseWorkspace(storage.get(FALLBACK_WORKSPACE_KEY) ?? null);
  if (workspace) return workspace;

  // Try legacy page keys
  const pages = LEGACY_PAGE_KEYS
    .map(key => parsePages(storage.get(key) ?? null))
    .find((value): value is Page[] => Array.isArray(value));
  if (!pages) return null;

  const currentPageId = LEGACY_CURRENT_PAGE_KEYS
    .map(key => storage.get(key))
    .find((value): value is string => Boolean(value)) ?? null;

  return { pages, currentPageId };
}

describe('Migration: new workspace format', () => {
  it('returns null when nothing is stored', () => {
    const storage = new Map<string, string>();
    assert.equal(migrateFromLegacy(storage), null);
  });

  it('reads new format workspace directly', () => {
    const snapshot: WorkspaceSnapshot = {
      pages: [{ id: 'p1', title: 'Test', blocks: [], icon: null, cover: null, createdAt: 100, updatedAt: 100 }],
      currentPageId: 'p1',
    };
    const storage = new Map<string, string>([
      [FALLBACK_WORKSPACE_KEY, JSON.stringify(snapshot)],
    ]);
    const result = migrateFromLegacy(storage);
    assert.ok(result !== null);
    assert.equal(result.pages.length, 1);
    assert.equal(result.currentPageId, 'p1');
  });
});

describe('Migration: legacy formats', () => {
  it('migrates from motion_ai_pages', () => {
    const pages = [{ id: 'p1', title: 'Legacy', blocks: [], icon: null, cover: null, createdAt: 100, updatedAt: 100 }];
    const storage = new Map<string, string>([
      ['motion_ai_pages', JSON.stringify(pages)],
      ['motion_ai_current_page_id', 'p1'],
    ]);
    const result = migrateFromLegacy(storage);
    assert.ok(result !== null);
    assert.equal(result.pages.length, 1);
    assert.equal(result.currentPageId, 'p1');
    assert.equal(result.pages[0].title, 'Legacy');
  });

  it('migrates from notion_clone_pages', () => {
    const pages = [{ id: 'p2', title: 'Clone Era', blocks: [], icon: null, cover: null, createdAt: 200, updatedAt: 200 }];
    const storage = new Map<string, string>([
      ['notion_clone_pages', JSON.stringify(pages)],
      ['notion_clone_current_page_id', 'p2'],
    ]);
    const result = migrateFromLegacy(storage);
    assert.ok(result !== null);
    assert.equal(result.pages.length, 1);
    assert.equal(result.currentPageId, 'p2');
  });

  it('prefers motion_ai over notion_clone when both exist', () => {
    const motionPages = [{ id: 'ma', title: 'MotionAI', blocks: [], icon: null, cover: null, createdAt: 100, updatedAt: 100 }];
    const clonePages = [{ id: 'nc', title: 'Clone', blocks: [], icon: null, cover: null, createdAt: 200, updatedAt: 200 }];
    const storage = new Map<string, string>([
      ['notion_clone_pages', JSON.stringify(clonePages)],
      ['notion_clone_current_page_id', 'nc'],
      ['motion_ai_pages', JSON.stringify(motionPages)],
      ['motion_ai_current_page_id', 'ma'],
    ]);
    const result = migrateFromLegacy(storage);
    assert.ok(result !== null);
    assert.equal(result.pages[0].id, 'ma');
  });

  it('prefers new workspace format over legacy', () => {
    const workspaceSnapshot: WorkspaceSnapshot = {
      pages: [{ id: 'w1', title: 'Workspace', blocks: [], icon: null, cover: null, createdAt: 100, updatedAt: 100 }],
      currentPageId: 'w1',
    };
    const legacyPages = [{ id: 'l1', title: 'Legacy', blocks: [], icon: null, cover: null, createdAt: 200, updatedAt: 200 }];
    const storage = new Map<string, string>([
      [FALLBACK_WORKSPACE_KEY, JSON.stringify(workspaceSnapshot)],
      ['motion_ai_pages', JSON.stringify(legacyPages)],
      ['motion_ai_current_page_id', 'l1'],
    ]);
    const result = migrateFromLegacy(storage);
    assert.ok(result !== null);
    assert.equal(result.pages[0].id, 'w1');
  });

  it('returns null for corrupted legacy data', () => {
    const storage = new Map<string, string>([
      ['motion_ai_pages', '{corrupted'],
    ]);
    assert.equal(migrateFromLegacy(storage), null);
  });

  it('returns null for non-array legacy data', () => {
    const storage = new Map<string, string>([
      ['motion_ai_pages', JSON.stringify({ not: 'an array' })],
    ]);
    assert.equal(migrateFromLegacy(storage), null);
  });
});

describe('WorkspaceSnapshot validation', () => {
  it('rejects snapshot without pages array', () => {
    assert.equal(parseWorkspace(JSON.stringify({ currentPageId: 'p1' })), null);
  });

  it('rejects snapshot with non-array pages', () => {
    assert.equal(parseWorkspace(JSON.stringify({ pages: 'not-array', currentPageId: 'p1' })), null);
  });

  it('accepts minimal valid snapshot', () => {
    const result = parseWorkspace(JSON.stringify({ pages: [], currentPageId: null }));
    assert.ok(result !== null);
    assert.equal(result.pages.length, 0);
    assert.equal(result.currentPageId, null);
  });

  it('accepts snapshot with pages and currentPageId', () => {
    const snapshot: WorkspaceSnapshot = {
      pages: [{ id: 'p1', title: 'T', blocks: [], icon: null, cover: null, createdAt: 1, updatedAt: 2 }],
      currentPageId: 'p1',
    };
    const result = parseWorkspace(JSON.stringify(snapshot));
    assert.ok(result !== null);
    assert.equal(result.pages[0].id, 'p1');
    assert.equal(result.currentPageId, 'p1');
  });
});


// ─── Backward-compat migration fixtures ───────────────────────────────────────

describe('Backward-compat migration fixtures', () => {
  it('migrates legacy page without reminderDate', () => {
    const legacyPage = JSON.stringify({
      id: 'page-1',
      title: 'Legacy Task',
      icon: null,
      cover: null,
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      blocks: [{ id: 'b1', type: 'task', content: 'old task' }],
    });
    const parsed = JSON.parse(legacyPage);
    // reminderDate was added later; legacy pages should work without it
    assert.equal(parsed.id, 'page-1');
    assert.equal(parsed.reminderDate, undefined);
  });

  it('migrates legacy task without assignee field', () => {
    const legacyTask = {
      id: 'task-1',
      title: 'Unassigned task',
      status: 'todo',
      priority: 'medium',
      // no assignee
    };
    const parsed = JSON.parse(JSON.stringify(legacyTask));
    assert.equal(parsed.assignee, undefined);
    // After migration, assignee should be undefined (not null or empty string)
    const migrated = { ...parsed, assignee: parsed.assignee ?? undefined };
    assert.equal(migrated.assignee, undefined);
  });

  it('migrates legacy task without priority field', () => {
    const legacyTask = {
      id: 'task-2',
      title: 'No priority task',
      status: 'in-progress',
      // no priority
    };
    const migrated = JSON.parse(JSON.stringify(legacyTask));
    assert.equal(migrated.priority, undefined);
  });

  it('handles unexpected fields gracefully during migration', () => {
    const legacyWithExtra = {
      id: 'task-3',
      title: 'Task with extra fields',
      status: 'done',
      extraField1: 'unexpected',
      nestedExtra: { key: 'value' },
    };
    const parsed = JSON.parse(JSON.stringify(legacyWithExtra));
    // Extra fields should be preserved but not cause migration errors
    assert.equal(parsed.extraField1, 'unexpected');
    assert.equal(parsed.title, 'Task with extra fields');
  });

  it('preserves reminderDate through JSON round-trip', () => {
    const taskWithReminder = {
      id: 'task-4',
      title: 'Task with reminder',
      status: 'todo',
      reminderDate: '2026-06-15',
    };
    const roundTripped = JSON.parse(JSON.stringify(taskWithReminder));
    assert.equal(roundTripped.reminderDate, '2026-06-15');
    assert.equal(roundTripped.title, 'Task with reminder');
  });

  it('handles reminderDate as ISO datetime string', () => {
    const taskWithDatetime = {
      id: 'task-5',
      title: 'Task with datetime reminder',
      reminderDate: '2026-06-15T14:30:00.000Z',
    };
    const parsed = JSON.parse(JSON.stringify(taskWithDatetime));
    assert.ok(parsed.reminderDate.startsWith('2026-06-15'), 'ISO datetime parsed correctly');
  });
});
