/**
 * Telemetry-free diagnostics bundle.
 * Gathers workspace stats and system info for bug reports.
 * No network calls — export is entirely local and user-initiated.
 */
import { Page } from '../types';

export interface DiagnosticsStatus {
  encryptionLocked?: boolean;
  encryptionKeySet?: boolean;
  collaborationEnabled?: boolean;
}

export interface DiagnosticsBundle {
  generatedAt: string;
  motionAiVersion: string;
  workspace: {
    pageCount: number;
    blockCount: number;
    pageTypes: Record<string, number>;
    blockTypes: Record<string, number>;
    hasEncryption: boolean;
    hasCollaboration: boolean;
    totalContentLength: number;
  };
  environment: {
    userAgent: string;
    language: string;
    localStorageSize: string;
    indexedDbAvailable: boolean;
    url: string;
  };
  pages: Array<{
    id: string;
    title: string;
    pageType: string;
    blockCount: number;
    hasParent: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function generateDiagnostics(
  pages: Page[],
  status?: DiagnosticsStatus | null,
): DiagnosticsBundle {
  const blockTypes: Record<string, number> = {};
  const pageTypes: Record<string, number> = {};
  let blockCount = 0;
  let totalContentLength = 0;

  for (const page of pages) {
    const pt = page.pageType || 'block';
    pageTypes[pt] = (pageTypes[pt] || 0) + 1;
    for (const block of page.blocks) {
      blockTypes[block.type] = (blockTypes[block.type] || 0) + 1;
      blockCount++;
      totalContentLength += (block.content || '').length;
    }
  }

  // Estimate localStorage size
  let lsSize = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) lsSize += (localStorage.getItem(key) || '').length * 2; // UTF-16
    }
  } catch { /* ignore */ }

  let indexedDbAvailable = false;
  try { indexedDbAvailable = !!window.indexedDB; } catch { /* ignore */ }

  return {
    generatedAt: new Date().toISOString(),
    motionAiVersion: '0.0.0', // overridden by package.json if available
    workspace: {
      pageCount: pages.length,
      blockCount,
      pageTypes,
      blockTypes,
      hasEncryption: Boolean(status?.encryptionKeySet || status?.encryptionLocked),
      hasCollaboration: Boolean(status?.collaborationEnabled),
      totalContentLength,
    },
    environment: {
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
      language: typeof navigator !== 'undefined' ? navigator.language : 'en',
      localStorageSize: formatBytes(lsSize),
      indexedDbAvailable,
      url: typeof window !== 'undefined' ? window.location.href : 'server',
    },
    pages: pages.map(p => ({
      id: p.id,
      title: p.title || 'Untitled',
      pageType: p.pageType || 'block',
      blockCount: p.blocks.length,
      hasParent: Boolean(p.parentId),
      createdAt: new Date(p.createdAt).toISOString(),
      updatedAt: new Date(p.updatedAt).toISOString(),
    })),
  };
}

/**
 * Export diagnostics as a downloadable JSON file.
 * Redacts all block content — only stats and structure are included.
 */
export function exportDiagnostics(pages: Page[], status?: DiagnosticsStatus | null): void {
  const bundle = generateDiagnostics(pages, status);
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `motionai-diagnostics-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
