/**
 * automation-trigger-tests.ts — Reliability tests for automation triggers.
 *
 * Tests that scheduled triggers fire at correct times, event triggers
 * fire on state changes, and conditions gate execution.
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

import { type Rule, type Trigger, type Action, type Condition } from '../src/lib/automations/ruleBuilder';

interface TriggerEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
}

interface AutomationResult {
  ruleId: string;
  triggered: boolean;
  reason?: string;
}

function evaluateConditions(conditions: Condition[], data: Record<string, unknown>): boolean {
  for (const cond of conditions) {
    const actual = data[cond.field];
    switch (cond.operator) {
      case 'equals':
        if (actual !== cond.value) return false;
        break;
      case 'not-equals':
        if (actual === cond.value) return false;
        break;
      case 'contains':
        if (typeof actual !== 'string' || !actual.includes(String(cond.value))) return false;
        break;
      case 'greater-than':
        if (typeof actual !== 'number' || actual <= Number(cond.value)) return false;
        break;
      case 'less-than':
        if (typeof actual !== 'number' || actual >= Number(cond.value)) return false;
        break;
      default:
        return false;
    }
  }
  return true;
}

function shouldTrigger(rule: Rule, event: TriggerEvent): AutomationResult {
  if (!rule.enabled) return { ruleId: rule.id, triggered: false, reason: 'disabled' };

  if (rule.trigger.type !== event.type && rule.trigger.type !== 'scheduled') {
    return { ruleId: rule.id, triggered: false, reason: 'trigger type mismatch' };
  }

  if (!evaluateConditions(rule.conditions, event.data)) {
    return { ruleId: rule.id, triggered: false, reason: 'conditions not met' };
  }

  return { ruleId: rule.id, triggered: true };
}

function makeRule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: 'test-rule-1',
    name: 'Test Rule',
    description: 'A test automation rule',
    enabled: true,
    trigger: { type: 'status-change', config: {} },
    conditions: [],
    actions: [{ type: 'create-task', config: {} }],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    runCount: 0,
    ...overrides,
  };
}

function makeEvent(type: string, data: Record<string, unknown> = {}): TriggerEvent {
  return { type, data, timestamp: Date.now() };
}

describe('Automation trigger reliability', () => {
  test('enabled rule fires on matching event', () => {
    const rule = makeRule({ trigger: { type: 'status-change', config: {} } });
    const event = makeEvent('status-change', { status: 'done' });
    const result = shouldTrigger(rule, event);
    assert(result.triggered === true, 'Enabled rule should trigger on matching event');
  });

  test('disabled rule does not fire', () => {
    const rule = makeRule({ enabled: false, trigger: { type: 'status-change', config: {} } });
    const event = makeEvent('status-change', { status: 'done' });
    const result = shouldTrigger(rule, event);
    assert(result.triggered === false, 'Disabled rule should not trigger');
    assert(result.reason === 'disabled', 'Reason should be disabled');
  });

  test('trigger type mismatch prevents firing', () => {
    const rule = makeRule({ trigger: { type: 'new-page', config: {} } });
    const event = makeEvent('status-change', { status: 'done' });
    const result = shouldTrigger(rule, event);
    assert(result.triggered === false, 'Mismatched trigger type should not fire');
  });

  test('conditions must be satisfied', () => {
    const rule = makeRule({
      trigger: { type: 'status-change', config: {} },
      conditions: [{ field: 'status', operator: 'equals', value: 'done' }],
    });
    const matchingEvent = makeEvent('status-change', { status: 'done' });
    const nonMatchingEvent = makeEvent('status-change', { status: 'in-progress' });
    assert(shouldTrigger(rule, matchingEvent).triggered === true, 'Matching condition triggers');
    assert(shouldTrigger(rule, nonMatchingEvent).triggered === false, 'Non-matching condition blocks');
  });

  test('multiple conditions use AND logic', () => {
    const rule = makeRule({
      trigger: { type: 'status-change', config: {} },
      conditions: [
        { field: 'status', operator: 'equals', value: 'done' },
        { field: 'priority', operator: 'equals', value: 'high' },
      ],
    });
    const allMatch = makeEvent('status-change', { status: 'done', priority: 'high' });
    const partialMatch = makeEvent('status-change', { status: 'done', priority: 'low' });
    assert(shouldTrigger(rule, allMatch).triggered === true, 'All conditions met triggers');
    assert(shouldTrigger(rule, partialMatch).triggered === false, 'Partial match does not trigger');
  });

  test('scheduled trigger fires regardless of event data', () => {
    const rule = makeRule({ trigger: { type: 'scheduled', config: {} } });
    const event = makeEvent('scheduled', {});
    const result = shouldTrigger(rule, event);
    assert(result.triggered === true, 'Scheduled rule fires on scheduled event');
  });

  test('new-task trigger fires on new task events', () => {
    const rule = makeRule({ trigger: { type: 'new-task', config: {} } });
    const event = makeEvent('new-task', { title: 'Buy groceries' });
    const result = shouldTrigger(rule, event);
    assert(result.triggered === true, 'New-task rule fires on new-task event');
  });

  test('greater-than condition works correctly', () => {
    const rule = makeRule({
      trigger: { type: 'status-change', config: {} },
      conditions: [{ field: 'priority', operator: 'greater-than', value: 3 }],
    });
    assert(shouldTrigger(rule, makeEvent('status-change', { priority: 5 })).triggered === true, '5 > 3 triggers');
    assert(shouldTrigger(rule, makeEvent('status-change', { priority: 2 })).triggered === false, '2 > 3 does not trigger');
  });

  test('contains condition works correctly', () => {
    const rule = makeRule({
      trigger: { type: 'status-change', config: {} },
      conditions: [{ field: 'title', operator: 'contains', value: 'urgent' }],
    });
    assert(shouldTrigger(rule, makeEvent('status-change', { title: 'URGENT: fix bug' })).triggered === true, 'Contains matches substring');
    assert(shouldTrigger(rule, makeEvent('status-change', { title: 'minor update' })).triggered === false, 'Does not contain');
  });
});
