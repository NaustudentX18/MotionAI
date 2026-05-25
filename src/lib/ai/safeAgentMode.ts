/**
 * Safe Agent Mode — guardrails for AI actions in the workspace.
 *
 * Enforces:
 * - Read-only default: AI can suggest but not modify without permission
 * - Tool permission prompts: destructive/scope-changing actions require confirmation
 * - Audit log: all AI actions are recorded for review
 * - Prompt-injection warnings: external content is flagged
 */

export type AgentActionType =
  | 'read'
  | 'write'
  | 'delete'
  | 'execute'
  | 'export'
  | 'import'
  | 'share';

export type AgentPermission = 'granted' | 'denied' | 'prompt';

export interface AgentAction {
  id: string;
  type: AgentActionType;
  description: string;
  targetId?: string;
  timestamp: number;
  permission: AgentPermission;
  result?: string;
  source: 'ai' | 'user';
  externalContent?: boolean;
}

export interface AgentPolicy {
  defaultPermission: AgentPermission;
  requirePromptFor: AgentActionType[];
  auditLogEnabled: boolean;
  injectionWarningEnabled: boolean;
}

const STORAGE_KEY = 'motionai-agent-audit-log';

const DEFAULT_POLICY: AgentPolicy = {
  defaultPermission: 'prompt',
  requirePromptFor: ['delete', 'execute', 'import', 'share'],
  auditLogEnabled: true,
  injectionWarningEnabled: true,
};

let policy: AgentPolicy = { ...DEFAULT_POLICY };

export function getAgentPolicy(): AgentPolicy {
  return { ...policy };
}

export function setAgentPolicy(update: Partial<AgentPolicy>): void {
  policy = { ...policy, ...update };
}

export function resetAgentPolicy(): void {
  policy = { ...DEFAULT_POLICY };
}

export function requiresPrompt(actionType: AgentActionType): boolean {
  return policy.requirePromptFor.includes(actionType);
}

export function checkActionPermission(actionType: AgentActionType): AgentPermission {
  if (requiresPrompt(actionType)) return 'prompt';
  return policy.defaultPermission;
}

let actionCounter = 0;

export function createAction(
  type: AgentActionType,
  description: string,
  options?: { targetId?: string; source?: 'ai' | 'user'; externalContent?: boolean },
): AgentAction {
  actionCounter++;
  const permission = checkActionPermission(type);
  const action: AgentAction = {
    id: `agent-action-${actionCounter}-${Date.now()}`,
    type,
    description,
    targetId: options?.targetId,
    timestamp: Date.now(),
    permission,
    source: options?.source ?? 'ai',
    externalContent: options?.externalContent,
  };

  if (policy.auditLogEnabled) {
    appendToAuditLog(action);
  }

  return action;
}

export function resolveAction(actionId: string, permission: AgentPermission): AgentAction | null {
  const log = readAuditLog();
  const idx = log.findIndex(a => a.id === actionId);
  if (idx === -1) return null;
  log[idx].permission = permission;
  saveAuditLog(log);
  return log[idx];
}

export function detectExternalContent(text: string): boolean {
  const patterns = [
    /https?:\/\/[^\s]+/,
    /<script[\s>]/i,
    /<iframe[\s>]/i,
    /javascript:/i,
    /onerror\s*=/i,
    /onclick\s*=/i,
    /onload\s*=/i,
  ];
  return patterns.some(p => p.test(text));
}

export function createAuditEntry(
  type: AgentActionType,
  description: string,
  result: string,
): AgentAction {
  const action = createAction(type, description);
  action.result = result;
  if (policy.auditLogEnabled) {
    appendToAuditLog({ ...action, result });
  }
  return action;
}

function readAuditLog(): AgentAction[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAuditLog(log: AgentAction[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
  } catch {
    // Storage full — silently skip
  }
}

function appendToAuditLog(action: AgentAction): void {
  const log = readAuditLog();
  log.push(action);
  // Keep last 500 entries
  if (log.length > 500) log.splice(0, log.length - 500);
  saveAuditLog(log);
}

export function getAuditLog(): AgentAction[] {
  return readAuditLog();
}

export function clearAuditLog(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function auditLogSummary(): string {
  const log = readAuditLog();
  const byType = log.reduce<Record<string, number>>((acc, a) => {
    acc[a.type] = (acc[a.type] || 0) + 1;
    return acc;
  }, {});

  const lines = [
    `Audit Log: ${log.length} entries`,
    ...Object.entries(byType).map(([type, count]) => `  ${type}: ${count}`),
  ];
  return lines.join('\n');
}
