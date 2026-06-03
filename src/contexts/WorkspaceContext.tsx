/**
 * Lightweight workspace context — shared page list and navigation for deep trees.
 * App remains source of truth; this avoids prop drilling for new features.
 */
import React, { createContext, useContext, useMemo } from 'react';
import type { Page } from '../types';
import type { WorkspaceMeta } from '../lib/persistence';

export interface WorkspaceContextValue {
  pages: Page[];
  currentPageId: string | null;
  currentPage: Page | null;
  currentWorkspace: WorkspaceMeta | null;
  setCurrentPageId: (id: string | null) => void;
  updatePageById: (id: string, updates: Partial<Page>) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  value,
  children,
}: {
  value: WorkspaceContextValue;
  children: React.ReactNode;
}) {
  const memo = useMemo(() => value, [
    value.pages,
    value.currentPageId,
    value.currentPage,
    value.currentWorkspace,
    value.setCurrentPageId,
    value.updatePageById,
  ]);
  return <WorkspaceContext.Provider value={memo}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace must be used within WorkspaceProvider');
  }
  return ctx;
}

export function useWorkspaceOptional(): WorkspaceContextValue | null {
  return useContext(WorkspaceContext);
}
