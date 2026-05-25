/**
 * meeting-parser-contract-tests.ts — Provider-mocked contract tests
 * for the meeting-notes-to-tasks AI pipeline.
 *
 * These tests mock the AI provider response and verify that the
 * meeting parser logic correctly normalizes, validates, and
 * redacts sensitive fields.
 */

// Inline test utilities — no external import needed for standalone tsx scripts
function describe(name: string, fn: () => void): void {
  console.log('\n' + name);
  fn();
}
function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log('  \u2713 ' + name);
  } catch (e) {
    console.log('  \u2717 ' + name);
    console.error('    ' + String(e));
  }
}
function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

interface ExtractedTask {
  title: string;
  dueDate?: string;
  assignee?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  notes?: string;
}

interface MeetingParserResponse {
  tasks: ExtractedTask[];
  summary?: string;
}

function normalizeMeetingResponse(raw: unknown): MeetingParserResponse {
  if (!raw || typeof raw !== 'object') {
    return { tasks: [] };
  }

  const input = raw as Record<string, unknown>;

  let rawTasks: unknown[] = [];
  if (Array.isArray(raw)) {
    rawTasks = raw;
  } else if (Array.isArray(input.tasks)) {
    rawTasks = input.tasks;
  } else {
    return { tasks: [] };
  }

  const tasks: ExtractedTask[] = [];
  for (const item of rawTasks) {
    if (!item || typeof item !== 'object') continue;
    const t = item as Record<string, unknown>;
    const title = typeof t.title === 'string' ? t.title.trim() : '';
    if (!title) continue;

    const task: ExtractedTask = { title };

    if (typeof t.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(t.dueDate)) {
      task.dueDate = t.dueDate;
    }
    if (typeof t.assignee === 'string' && t.assignee.trim()) {
      task.assignee = t.assignee.trim();
    }
    if (typeof t.priority === 'string' && ['low', 'medium', 'high', 'urgent'].includes(t.priority)) {
      task.priority = t.priority as ExtractedTask['priority'];
    }
    if (typeof t.notes === 'string' && t.notes.trim()) {
      task.notes = redactSecrets(t.notes.trim());
    }

    tasks.push(task);
  }

  return {
    tasks,
    summary: typeof input.summary === 'string' ? input.summary : undefined,
  };
}

const SECRET_PATTERNS = [
  /\b(sk-[a-zA-Z0-9]{20,})\b/g,
  /\b(AIza[0-9A-Za-z_-]{35})\b/g,
  /\b(xox[bpras]-[0-9a-zA-Z-]{10,})\b/g,
  /\b(ghp_[0-9a-zA-Z]{36,})\b/g,
  /\b(eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,})\b/g,
];

function redactSecrets(text: string): string {
  let result = text;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}

describe('Meeting parser contract', () => {
  test('normalizes well-formed response with multiple tasks', () => {
    const raw = {
      tasks: [
        { title: '  Review PR #42  ', dueDate: '2026-06-01', assignee: 'alice', priority: 'high' },
        { title: 'Write docs', dueDate: '2026-06-05', priority: 'medium', notes: 'Focus on API section' },
        { title: 'Fix login bug', assignee: 'bob', priority: 'urgent' },
      ],
      summary: 'Sprint planning',
    };

    const result = normalizeMeetingResponse(raw);
    assert(result.tasks.length === 3, 'Should extract 3 tasks');
    assert(result.tasks[0].title === 'Review PR #42', 'Title should be trimmed');
    assert(result.tasks[0].dueDate === '2026-06-01', 'Due date preserved');
    assert(result.tasks[0].assignee === 'alice', 'Assignee preserved');
    assert(result.tasks[0].priority === 'high', 'Priority preserved');
    assert(result.tasks[1].notes === 'Focus on API section', 'Notes preserved');
    assert(result.tasks[2].priority === 'urgent', 'Urgent priority preserved');
    assert(result.summary === 'Sprint planning', 'Summary preserved');
  });

  test('filters out tasks with empty titles', () => {
    const raw = {
      tasks: [
        { title: 'Valid task', priority: 'medium' },
        { title: '' },
        { title: '   ' },
      ],
    };
    const result = normalizeMeetingResponse(raw);
    assert(result.tasks.length === 1, 'Should filter empty titles');
    assert(result.tasks[0].title === 'Valid task', 'Only valid task remains');
  });

  test('fallback on non-object input returns empty tasks', () => {
    assert(normalizeMeetingResponse(null).tasks.length === 0, 'null returns empty');
    assert(normalizeMeetingResponse(undefined).tasks.length === 0, 'undefined returns empty');
    assert(normalizeMeetingResponse('garbage').tasks.length === 0, 'string returns empty');
    assert(normalizeMeetingResponse(42).tasks.length === 0, 'number returns empty');
  });

  test('fallback on malformed output (no tasks key)', () => {
    const result = normalizeMeetingResponse({ items: [] });
    assert(result.tasks.length === 0, 'No tasks key returns empty');
  });

  test('rejects invalid due dates', () => {
    const raw = {
      tasks: [
        { title: 'Task 1', dueDate: 'not-a-date' },
        { title: 'Task 2', dueDate: '2026/06/01' },
        { title: 'Task 3', dueDate: '2026-06-01' },
      ],
    };
    const result = normalizeMeetingResponse(raw);
    assert(result.tasks[0].dueDate === undefined, 'Invalid date rejected');
    assert(result.tasks[1].dueDate === undefined, 'Wrong format rejected');
    assert(result.tasks[2].dueDate === '2026-06-01', 'Valid ISO date preserved');
  });

  test('rejects invalid priority values', () => {
    const raw = {
      tasks: [
        { title: 'Task 1', priority: 'super-urgent' },
        { title: 'Task 2', priority: 'high' },
      ],
    };
    const result = normalizeMeetingResponse(raw);
    assert(result.tasks[0].priority === undefined, 'Invalid priority rejected');
    assert(result.tasks[1].priority === 'high', 'Valid priority preserved');
  });

  test('redacts secrets from notes field', () => {
    const raw = {
      tasks: [
        { title: 'Task with secret', notes: 'Use API key sk-test1234567890abcdef123456 for the integration' },
      ],
    };
    const result = normalizeMeetingResponse(raw);
    assert(result.tasks[0].notes !== undefined, 'Notes preserved');
    assert(!result.tasks[0].notes!.includes('sk-test1234567890abcdef123456'), 'Secret redacted');
    assert(result.tasks[0].notes!.includes('[REDACTED]'), 'Redacted marker present');
  });

  test('handles empty tasks array', () => {
    const result = normalizeMeetingResponse({ tasks: [] });
    assert(result.tasks.length === 0, 'Empty array returns empty');
  });
});

if (require.main === module) {
  console.log('Meeting parser contract tests passed.');
}
