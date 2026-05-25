import type { WorkspaceSnapshot } from './persistence';
import type { Block, Page } from '../types';
import {
  WORKSPACE_SCHEMA_VERSION,
  assertValidWorkspaceSnapshot,
  validateWorkspaceSnapshot,
} from './workspaceSchema';

export const WORKSPACE_EXPORT_SCHEMA = 'motionai.workspace' as const;
export const WORKSPACE_EXPORT_MIME_TYPE = 'application/json' as const;
export const WORKSPACE_EXPORT_APP_NAME = 'MotionAI' as const;
export const MAX_WORKSPACE_IMPORT_BYTES = 10 * 1024 * 1024;

export type ImportMode = 'append' | 'replace';
export type WorkspaceExportSource = 'local' | 'google-drive' | 'test' | 'unknown';

export interface WorkspaceEnvelopeV1 {
  schema: typeof WORKSPACE_EXPORT_SCHEMA;
  schemaVersion: typeof WORKSPACE_SCHEMA_VERSION;
  exportedAt: string;
  appName: typeof WORKSPACE_EXPORT_APP_NAME;
  appVersion?: string;
  source: WorkspaceExportSource;
  workspace: WorkspaceSnapshot;
}

export interface WorkspaceExportResult {
  filename: string;
  mimeType: typeof WORKSPACE_EXPORT_MIME_TYPE;
  body: string;
}

export interface ImportWarning {
  code: string;
  message: string;
  path?: string;
}

export interface WorkspaceImportResult {
  snapshot: WorkspaceSnapshot;
  warnings: ImportWarning[];
  recoverySnapshot?: WorkspaceSnapshot;
}

export interface ExportWorkspaceOptions {
  exportedAt?: string;
  source?: WorkspaceExportSource;
  appVersion?: string;
}

export interface ImportWorkspaceOptions {
  mode: ImportMode;
  existing?: WorkspaceSnapshot;
  maxBytes?: number;
}

export class UnsupportedWorkspaceSchemaVersionError extends Error {
  constructor(version: unknown) {
    super(`Unsupported ${WORKSPACE_EXPORT_SCHEMA} schemaVersion: ${String(version)}`);
    this.name = 'UnsupportedWorkspaceSchemaVersionError';
  }
}

export class WorkspaceImportValidationError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(`Invalid ${WORKSPACE_EXPORT_SCHEMA} import: ${errors.join('; ')}`);
    this.name = 'WorkspaceImportValidationError';
    this.errors = errors;
  }
}

const SECRET_PATTERNS: Array<{ code: string; pattern: RegExp }> = [
  { code: 'google-api-key', pattern: /AIza[0-9A-Za-z_-]{20,}/ },
  { code: 'google-oauth-token', pattern: /ya29\.[0-9A-Za-z_-]+/ },
  { code: 'openai-api-key', pattern: /sk-[A-Za-z0-9_-]{20,}/ },
  { code: 'passphrase-field', pattern: /"(?:passphrase|password|accessToken|refreshToken|apiKey|secret|keychain)"\s*:/i },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stableTimestampForFilename(isoTimestamp: string): string {
  return isoTimestamp.replace(/\.\d{3}Z$/, 'Z').replace(/[:.]/g, '-');
}

function makeWorkspaceFilename(exportedAt: string): string {
  return `motionai-workspace-${stableTimestampForFilename(exportedAt)}.json`;
}

function cloneBlock(block: Block): Block {
  return {
    id: block.id,
    type: block.type,
    content: block.content,
    ...(block.checked !== undefined ? { checked: block.checked } : {}),
    ...(block.indentLevel !== undefined ? { indentLevel: block.indentLevel } : {}),
    ...(block.style !== undefined ? { style: { ...block.style } } : {}),
    ...(block.comments !== undefined ? { comments: block.comments.map(comment => ({ ...comment })) } : {}),
    ...(block.aiPrompt !== undefined ? { aiPrompt: block.aiPrompt } : {}),
    ...(block.aiContext !== undefined ? { aiContext: block.aiContext } : {}),
    ...(block.language !== undefined ? { language: block.language } : {}),
  };
}

function clonePage(page: Page): Page {
  return {
    id: page.id,
    title: page.title,
    icon: page.icon,
    cover: page.cover,
    blocks: page.blocks.map(cloneBlock),
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
    ...(page.versions !== undefined ? {
      versions: page.versions.map(version => ({
        id: version.id,
        timestamp: version.timestamp,
        title: version.title,
        blocks: version.blocks.map(cloneBlock),
      })),
    } : {}),
    ...(page.pageType !== undefined ? { pageType: page.pageType } : {}),
    ...(page.parentId !== undefined ? { parentId: page.parentId } : {}),
    ...(page.priority !== undefined ? { priority: page.priority } : {}),
    ...(page.dueDate !== undefined ? { dueDate: page.dueDate } : {}),
    ...(page.assignee !== undefined ? { assignee: page.assignee } : {}),
    ...(page.estimatedTime !== undefined ? { estimatedTime: page.estimatedTime } : {}),
    ...(page.actualTime !== undefined ? { actualTime: page.actualTime } : {}),
    ...(page.isTimerRunning !== undefined ? { isTimerRunning: page.isTimerRunning } : {}),
    ...(page.timerStartTime !== undefined ? { timerStartTime: page.timerStartTime } : {}),
    ...(page.reminderDate !== undefined ? { reminderDate: page.reminderDate } : {}),
  };
}

function cloneSnapshot(snapshot: WorkspaceSnapshot): WorkspaceSnapshot {
  return {
    pages: snapshot.pages.map(clonePage),
    currentPageId: snapshot.currentPageId,
  };
}

function assertNoSecrets(raw: string): void {
  const match = SECRET_PATTERNS.find(({ pattern }) => pattern.test(raw));
  if (match) {
    throw new Error(`Refusing to export workspace JSON containing secret-like data (${match.code})`);
  }
}

function parseWorkspaceJson(raw: string, maxBytes: number): unknown {
  if (new TextEncoder().encode(raw).byteLength > maxBytes) {
    throw new Error(`Workspace import exceeds ${maxBytes} byte limit`);
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid workspace JSON: ${message}`);
  }
}

function isWorkspaceEnvelope(value: unknown): value is WorkspaceEnvelopeV1 {
  return isRecord(value) && value.schema === WORKSPACE_EXPORT_SCHEMA;
}

function normalizeLegacySnapshot(input: unknown, warnings: ImportWarning[]): WorkspaceSnapshot {
  if (!isRecord(input)) {
    throw new WorkspaceImportValidationError(['workspace must be an object']);
  }

  const candidate = {
    pages: input.pages,
    currentPageId: typeof input.currentPageId === 'string' || input.currentPageId === null ? input.currentPageId : null,
  } as WorkspaceSnapshot;

  const pageIds = Array.isArray(candidate.pages)
    ? new Set(candidate.pages.filter(isRecord).map(page => page.id).filter((id): id is string => typeof id === 'string'))
    : new Set<string>();

  if (typeof input.currentPageId === 'string' && !pageIds.has(input.currentPageId)) {
    candidate.currentPageId = null;
    warnings.push({
      code: 'current-page-missing',
      message: 'currentPageId did not reference an imported page and was reset to null.',
      path: 'currentPageId',
    });
  }

  const validation = validateWorkspaceSnapshot(candidate);
  if (!validation.ok) {
    throw new WorkspaceImportValidationError(validation.errors);
  }

  return cloneSnapshot(candidate);
}

function envelopeToSnapshot(input: unknown, warnings: ImportWarning[]): WorkspaceSnapshot {
  if (isWorkspaceEnvelope(input)) {
    if (input.schemaVersion !== WORKSPACE_SCHEMA_VERSION) {
      throw new UnsupportedWorkspaceSchemaVersionError(input.schemaVersion);
    }
    return normalizeLegacySnapshot(input.workspace, warnings);
  }

  if (isRecord(input) && typeof input.schema === 'string' && input.schema !== WORKSPACE_EXPORT_SCHEMA) {
    throw new Error(`Unsupported workspace import schema: ${input.schema}`);
  }

  warnings.push({
    code: 'legacy-bare-snapshot',
    message: 'Imported a legacy bare workspace snapshot and normalized it to the current workspace envelope contract.',
  });
  return normalizeLegacySnapshot(input, warnings);
}

function uniquePageId(baseId: string, usedIds: Set<string>): string {
  if (!usedIds.has(baseId)) return baseId;
  let index = 2;
  let candidate = `${baseId}-imported`;
  while (usedIds.has(candidate)) {
    candidate = `${baseId}-imported-${index}`;
    index += 1;
  }
  return candidate;
}

function remapImportedPages(importedPages: Page[], existingPages: Page[], warnings: ImportWarning[]): { pages: Page[]; pageIdMap: Map<string, string> } {
  const usedIds = new Set(existingPages.map(page => page.id));
  const pageIdMap = new Map<string, string>();

  for (const page of importedPages) {
    const nextId = uniquePageId(page.id, usedIds);
    pageIdMap.set(page.id, nextId);
    usedIds.add(nextId);
    if (nextId !== page.id) {
      warnings.push({
        code: 'page-id-collision',
        message: `Imported page id "${page.id}" collided with an existing page and was renamed to "${nextId}".`,
        path: `pages.${page.id}.id`,
      });
    }
  }

  return {
    pages: importedPages.map(page => ({
      ...page,
      id: pageIdMap.get(page.id) ?? page.id,
      parentId: page.parentId && pageIdMap.has(page.parentId) ? pageIdMap.get(page.parentId)! : page.parentId,
    })),
    pageIdMap,
  };
}

export function createWorkspaceEnvelope(snapshot: WorkspaceSnapshot, options: ExportWorkspaceOptions = {}): WorkspaceEnvelopeV1 {
  assertValidWorkspaceSnapshot(snapshot);
  return {
    schema: WORKSPACE_EXPORT_SCHEMA,
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    exportedAt: options.exportedAt ?? new Date().toISOString(),
    appName: WORKSPACE_EXPORT_APP_NAME,
    ...(options.appVersion !== undefined ? { appVersion: options.appVersion } : {}),
    source: options.source ?? 'local',
    workspace: cloneSnapshot(snapshot),
  };
}

export function exportWorkspaceJson(snapshot: WorkspaceSnapshot, options: ExportWorkspaceOptions = {}): WorkspaceExportResult {
  const envelope = createWorkspaceEnvelope(snapshot, options);
  const body = `${JSON.stringify(envelope, null, 2)}\n`;
  assertNoSecrets(body);

  return {
    filename: makeWorkspaceFilename(envelope.exportedAt),
    mimeType: WORKSPACE_EXPORT_MIME_TYPE,
    body,
  };
}

export function importWorkspaceJson(raw: string, options: ImportWorkspaceOptions): WorkspaceImportResult {
  const warnings: ImportWarning[] = [];
  const parsed = parseWorkspaceJson(raw, options.maxBytes ?? MAX_WORKSPACE_IMPORT_BYTES);
  const imported = envelopeToSnapshot(parsed, warnings);

  if (options.mode === 'replace') {
    return {
      snapshot: imported,
      warnings,
      ...(options.existing ? { recoverySnapshot: cloneSnapshot(options.existing) } : {}),
    };
  }

  const existing = options.existing ? cloneSnapshot(options.existing) : { pages: [], currentPageId: null };
  const { pages: remappedPages, pageIdMap } = remapImportedPages(imported.pages, existing.pages, warnings);
  const importedCurrentPageId = imported.currentPageId
    ? pageIdMap.get(imported.currentPageId) ?? null
    : null;
  const nextSnapshot: WorkspaceSnapshot = {
    pages: [...existing.pages, ...remappedPages],
    currentPageId: existing.currentPageId ?? importedCurrentPageId,
  };

  assertValidWorkspaceSnapshot(nextSnapshot);
  return { snapshot: nextSnapshot, warnings };
}
