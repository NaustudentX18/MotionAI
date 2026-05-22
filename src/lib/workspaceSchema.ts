import { BLOCK_TYPES, PAGE_TYPES, type Block, type BlockType, type Page, type PageType, type PageVersion } from '../types';
import type { WorkspaceSnapshot } from './persistence';

export const WORKSPACE_SCHEMA_VERSION = 1 as const;
export const WORKSPACE_APP_ID = 'motionai-workspace' as const;

export type WorkspaceSchemaVersion = typeof WORKSPACE_SCHEMA_VERSION;

export interface VersionedWorkspaceSnapshot extends WorkspaceSnapshot {
  schemaVersion: WorkspaceSchemaVersion;
  app: typeof WORKSPACE_APP_ID;
  exportedAt: string;
}

export interface WorkspaceValidationResult {
  ok: boolean;
  errors: string[];
}

const VALID_BLOCK_TYPES = new Set<BlockType>(BLOCK_TYPES);
const VALID_PAGE_TYPES = new Set<PageType>(PAGE_TYPES);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateBlock(block: unknown, path: string, errors: string[]): block is Block {
  if (!isRecord(block)) {
    errors.push(`${path} must be an object`);
    return false;
  }

  if (typeof block.id !== 'string' || block.id.length === 0) {
    errors.push(`${path}.id must be a non-empty string`);
  }

  if (typeof block.type !== 'string' || !VALID_BLOCK_TYPES.has(block.type as BlockType)) {
    errors.push(`${path}.type must be a supported block type`);
  }

  if (typeof block.content !== 'string') {
    errors.push(`${path}.content must be a string`);
  }

  if ('checked' in block && typeof block.checked !== 'boolean') {
    errors.push(`${path}.checked must be a boolean when present`);
  }

  if ('indentLevel' in block) {
    if (!Number.isInteger(block.indentLevel) || (block.indentLevel as number) < 0 || (block.indentLevel as number) > 8) {
      errors.push(`${path}.indentLevel must be an integer between 0 and 8 when present`);
    }
  }

  if ('comments' in block && block.comments !== undefined) {
    if (!Array.isArray(block.comments)) {
      errors.push(`${path}.comments must be an array when present`);
    } else {
      block.comments.forEach((comment, index) => {
        const commentPath = `${path}.comments[${index}]`;
        if (!isRecord(comment)) {
          errors.push(`${commentPath} must be an object`);
          return;
        }
        if (typeof comment.id !== 'string' || comment.id.length === 0) errors.push(`${commentPath}.id must be a non-empty string`);
        if (typeof comment.author !== 'string') errors.push(`${commentPath}.author must be a string`);
        if (typeof comment.text !== 'string') errors.push(`${commentPath}.text must be a string`);
        if (!isFiniteNumber(comment.createdAt)) errors.push(`${commentPath}.createdAt must be a finite number`);
      });
    }
  }

  return errors.length === 0;
}


function validatePageVersion(version: unknown, path: string, errors: string[]): version is PageVersion {
  if (!isRecord(version)) {
    errors.push(`${path} must be an object`);
    return false;
  }

  if (typeof version.id !== 'string' || version.id.length === 0) errors.push(`${path}.id must be a non-empty string`);
  if (!isFiniteNumber(version.timestamp)) errors.push(`${path}.timestamp must be a finite number`);
  if (typeof version.title !== 'string') errors.push(`${path}.title must be a string`);

  if (!Array.isArray(version.blocks)) {
    errors.push(`${path}.blocks must be an array`);
    return false;
  }

  const versionBlockIds = new Set<string>();
  version.blocks.forEach((block, index) => {
    const before = errors.length;
    validateBlock(block, `${path}.blocks[${index}]`, errors);
    if (errors.length === before && isRecord(block)) {
      const blockId = block.id as string;
      if (versionBlockIds.has(blockId)) errors.push(`${path}.blocks[${index}].id duplicates another block in the same version`);
      versionBlockIds.add(blockId);
    }
  });

  return errors.length === 0;
}

function validatePage(page: unknown, path: string, errors: string[]): page is Page {
  if (!isRecord(page)) {
    errors.push(`${path} must be an object`);
    return false;
  }

  if (typeof page.id !== 'string' || page.id.length === 0) errors.push(`${path}.id must be a non-empty string`);
  if (typeof page.title !== 'string') errors.push(`${path}.title must be a string`);
  if (page.icon !== null && typeof page.icon !== 'string') errors.push(`${path}.icon must be a string or null`);
  if (page.cover !== null && typeof page.cover !== 'string') errors.push(`${path}.cover must be a string or null`);
  if (!isFiniteNumber(page.createdAt)) errors.push(`${path}.createdAt must be a finite number`);
  if (!isFiniteNumber(page.updatedAt)) errors.push(`${path}.updatedAt must be a finite number`);

  if ('pageType' in page && page.pageType !== undefined) {
    if (typeof page.pageType !== 'string' || !VALID_PAGE_TYPES.has(page.pageType as PageType)) {
      errors.push(`${path}.pageType must be a supported page type`);
    }
  }

  if ('versions' in page && page.versions !== undefined) {
    if (!Array.isArray(page.versions)) {
      errors.push(`${path}.versions must be an array when present`);
    } else {
      page.versions.forEach((version, index) => validatePageVersion(version, `${path}.versions[${index}]`, errors));
    }
  }

  if (!Array.isArray(page.blocks)) {
    errors.push(`${path}.blocks must be an array`);
    return false;
  }

  const blockIds = new Set<string>();
  page.blocks.forEach((block, index) => {
    const before = errors.length;
    validateBlock(block, `${path}.blocks[${index}]`, errors);
    if (errors.length === before && isRecord(block)) {
      const blockId = block.id as string;
      if (blockIds.has(blockId)) errors.push(`${path}.blocks[${index}].id duplicates another block on the same page`);
      blockIds.add(blockId);
    }
  });

  return errors.length === 0;
}

export function validateWorkspaceSnapshot(snapshot: unknown): WorkspaceValidationResult {
  const errors: string[] = [];

  if (!isRecord(snapshot)) {
    return { ok: false, errors: ['snapshot must be an object'] };
  }

  const schemaVersion = snapshot.schemaVersion;
  if (schemaVersion !== undefined && schemaVersion !== WORKSPACE_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${WORKSPACE_SCHEMA_VERSION} when present`);
  }

  if (!Array.isArray(snapshot.pages)) {
    errors.push('pages must be an array');
    return { ok: false, errors };
  }

  const pageIds = new Set<string>();
  snapshot.pages.forEach((page, index) => {
    const before = errors.length;
    validatePage(page, `pages[${index}]`, errors);
    if (errors.length === before && isRecord(page)) {
      const pageId = page.id as string;
      if (pageIds.has(pageId)) errors.push(`pages[${index}].id duplicates another page`);
      pageIds.add(pageId);
    }
  });

  if (snapshot.currentPageId !== null && typeof snapshot.currentPageId !== 'string') {
    errors.push('currentPageId must be a string or null');
  }
  if (typeof snapshot.currentPageId === 'string' && !pageIds.has(snapshot.currentPageId)) {
    errors.push('currentPageId must reference an existing page id');
  }

  return { ok: errors.length === 0, errors };
}

export function assertValidWorkspaceSnapshot(snapshot: unknown): asserts snapshot is WorkspaceSnapshot {
  const result = validateWorkspaceSnapshot(snapshot);
  if (!result.ok) {
    throw new Error(`Invalid workspace snapshot: ${result.errors.join('; ')}`);
  }
}

export function createVersionedWorkspaceSnapshot(snapshot: WorkspaceSnapshot, exportedAt = new Date().toISOString()): VersionedWorkspaceSnapshot {
  assertValidWorkspaceSnapshot(snapshot);
  return {
    ...snapshot,
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    app: WORKSPACE_APP_ID,
    exportedAt,
  };
}
