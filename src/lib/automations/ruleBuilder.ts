/**
 * Rule Builder — trigger → conditions → action automation engine.
 */

export type TriggerType =
  | 'status-change'
  | 'due-date'
  | 'new-page'
  | 'new-task'
  | 'mention'
  | 'webhook'
  | 'scheduled';

export type ConditionOperator = 'equals' | 'not-equals' | 'contains' | 'greater-than' | 'less-than';

export type ActionType =
  | 'create-task'
  | 'update-task'
  | 'append-block'
  | 'send-webhook'
  | 'run-script'
  | 'ai-classify'
  | 'ai-summarize';

export interface Trigger {
  type: TriggerType;
  config: Record<string, string | number | boolean>;
}

export interface Condition {
  field: string;
  operator: ConditionOperator;
  value: string | number | boolean;
}

export interface Action {
  type: ActionType;
  config: Record<string, string | number | boolean>;
}

export interface Rule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger: Trigger;
  conditions: Condition[];
  actions: Action[];
  createdAt: number;
  updatedAt: number;
  lastRunAt?: number;
  runCount: number;
}

const STORAGE_KEY = 'motionai-automation-rules';
let rules: Rule[] = [];

export function loadRules(): Rule[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    rules = raw ? JSON.parse(raw) : [];
  } catch { rules = []; }
  return [...rules];
}

export function saveRules(): void {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rules)); } catch { /* storage full */ }
}

export function getRules(): Rule[] { return [...rules]; }
export function getRule(id: string): Rule | undefined { return rules.find(r => r.id === id); }

export function createRule(name: string, trigger: Trigger, conditions: Condition[], actions: Action[], description?: string): Rule {
  const rule: Rule = { id: crypto.randomUUID(), name, description: description ?? '', enabled: true, trigger, conditions, actions, createdAt: Date.now(), updatedAt: Date.now(), runCount: 0 };
  rules.push(rule);
  saveRules();
  return rule;
}

export function updateRule(id: string, update: Partial<Rule>): Rule | null {
  const idx = rules.findIndex(r => r.id === id);
  if (idx === -1) return null;
  rules[idx] = { ...rules[idx], ...update, updatedAt: Date.now() };
  saveRules();
  return rules[idx];
}

export function deleteRule(id: string): boolean {
  const idx = rules.findIndex(r => r.id === id);
  if (idx === -1) return false;
  rules.splice(idx, 1);
  saveRules();
  return true;
}

export function toggleRule(id: string): Rule | null {
  const rule = getRule(id);
  return rule ? updateRule(id, { enabled: !rule.enabled }) : null;
}

export function evaluateRule(rule: Rule, context: Record<string, unknown>): boolean {
  if (!rule.enabled) return false;
  for (const [key, value] of Object.entries(rule.trigger.config)) {
    if (context[key] !== value) return false;
  }
  for (const condition of rule.conditions) {
    const ctxValue = context[condition.field];
    switch (condition.operator) {
      case 'equals': if (ctxValue !== condition.value) return false; break;
      case 'not-equals': if (ctxValue === condition.value) return false; break;
      case 'contains': if (typeof ctxValue !== 'string' || !ctxValue.includes(String(condition.value))) return false; break;
      case 'greater-than': if (typeof ctxValue !== 'number' || ctxValue <= Number(condition.value)) return false; break;
      case 'less-than': if (typeof ctxValue !== 'number' || ctxValue >= Number(condition.value)) return false; break;
      default: return false;
    }
  }
  rule.lastRunAt = Date.now();
  rule.runCount++;
  saveRules();
  return true;
}

export function defaultStatusChangeRule(): Rule {
  return createRule('Notify on status change', { type: 'status-change', config: {} }, [{ field: 'status', operator: 'not-equals', value: '' }], [{ type: 'send-webhook', config: { url: '' } }], 'Send a webhook when a task status changes.');
}

export function defaultDueDateRule(): Rule {
  return createRule('Upcoming due date reminder', { type: 'due-date', config: { daysBefore: 1 } }, [], [{ type: 'create-task', config: { title: 'Follow up on {{task}}', list: 'Reminders' } }], 'Auto-create reminder task when due date approaches.');
}
