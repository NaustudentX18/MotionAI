import React, { useEffect, useMemo, useState } from 'react';
import { Block } from '../../types';
import { Database, DatabaseView, DatabaseViewType } from '../../types/database';
import { DatabaseTableView } from '../database/DatabaseTableView';
import { DatabaseBoardView } from '../database/DatabaseBoardView';
import { DatabaseCalendarView } from '../database/DatabaseCalendarView';
import { DatabaseGalleryView } from '../database/DatabaseGalleryView';
import { DatabaseListView } from '../database/DatabaseListView';
import { DatabaseTimelineView } from '../database/DatabaseTimelineView';
import { createDefaultDatabase, createRowFromTemplate, normalizeDatabase } from '../database/databaseTemplates';
import { Calendar, Clock, Image, KanbanSquare, List, Sparkles, Table } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DatabaseBlockProps {
  block: Block;
  onChange: (updatedBlockContent: string) => void;
  onRunAi?: (db: Database, propertyId: string, rowId: string) => Promise<string>;
}

const VIEW_META: Record<DatabaseViewType, { label: string; icon: React.ElementType }> = {
  table: { label: 'Table', icon: Table },
  board: { label: 'Board', icon: KanbanSquare },
  calendar: { label: 'Calendar', icon: Calendar },
  list: { label: 'List', icon: List },
  gallery: { label: 'Gallery', icon: Image },
  timeline: { label: 'Timeline', icon: Clock },
};

export function DatabaseBlock({ block, onChange, onRunAi }: DatabaseBlockProps) {
  const [database, setDatabase] = useState<Database | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [aiRunningRows, setAiRunningRows] = useState<Record<string, boolean>>({});

  // Parse block content into structured Database
  useEffect(() => {
    try {
      setParseError(null);
      if (block.content && block.content.trim().startsWith('{')) {
        const parsed = normalizeDatabase(JSON.parse(block.content) as Database);
        setDatabase(parsed);
        if (JSON.stringify(parsed) !== block.content) {
          onChange(JSON.stringify(parsed));
        }
      } else {
        const defaultDb = createDefaultDatabase();
        setDatabase(defaultDb);
        onChange(JSON.stringify(defaultDb));
      }
    } catch (e) {
      console.error('Failed to parse database block content', e);
      setParseError('Database content is invalid JSON. The original content was left unchanged.');
      setDatabase(null);
    }
  }, [block.content, onChange]);

  const activeView = useMemo(() => {
    if (!database) return null;
    return database.views.find(view => view.id === database.activeViewId) || database.views[0] || null;
  }, [database]);

  const handleDatabaseChange = (updatedDb: Database) => {
    const normalized = normalizeDatabase(updatedDb);
    setDatabase(normalized);
    onChange(JSON.stringify(normalized));
  };

  const handleViewSwitch = (viewId: string) => {
    if (!database) return;
    handleDatabaseChange({ ...database, activeViewId: viewId });
  };

  const handleViewChange = (updatedView: DatabaseView) => {
    if (!database) return;
    handleDatabaseChange({
      ...database,
      views: database.views.map(view => view.id === updatedView.id ? updatedView : view),
      activeViewId: updatedView.id,
    });
  };

  const handleAddFromTemplate = (templateId: string) => {
    if (!database || !templateId) return;
    const template = database.templates?.find(item => item.id === templateId);
    if (!template) return;
    handleDatabaseChange({ ...database, rows: [...database.rows, createRowFromTemplate(template)] });
  };

  // Run AI smart column trigger
  const handleRunAiProperty = async (propertyId: string, rowId: string) => {
    if (!database || !onRunAi) return;
    const runningKey = `${propertyId}-${rowId}`;
    setAiRunningRows(prev => ({ ...prev, [runningKey]: true }));

    try {
      const generatedResult = await onRunAi(database, propertyId, rowId);
      const updatedRows = database.rows.map(r => {
        if (r.id === rowId) {
          return {
            ...r,
            values: { ...r.values, [propertyId]: generatedResult },
            updatedAt: Date.now(),
          };
        }
        return r;
      });
      handleDatabaseChange({ ...database, rows: updatedRows });
    } catch (e) {
      console.error('AI Property calculation failed', e);
    } finally {
      setAiRunningRows(prev => ({ ...prev, [runningKey]: false }));
    }
  };

  if (parseError) {
    return (
      <div className="my-6 border border-red-200 dark:border-red-900/60 rounded-2xl p-4 bg-red-50/50 dark:bg-red-950/10 text-sm text-red-700 dark:text-red-300">
        {parseError}
      </div>
    );
  }

  if (!database || !activeView) return <div className="p-4 text-xs italic text-gray-400">Loading Database...</div>;

  return (
    <div className="my-6 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 bg-white dark:bg-[#191919] shadow-xs">
      {/* Database Title & View Selector */}
      <div className="flex flex-col gap-4 mb-4 pb-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={database.title}
              onChange={(e) => handleDatabaseChange({ ...database, title: e.target.value })}
              className="text-sm font-bold text-gray-800 dark:text-gray-100 bg-transparent border-0 outline-none focus:ring-1 focus:ring-purple-400/50 rounded px-1"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {database.templates?.length ? (
              <select
                value=""
                onChange={(event) => handleAddFromTemplate(event.target.value)}
                className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-[#1E1E1E] text-gray-600 dark:text-gray-300 font-medium"
                title="Add from template"
              >
                <option value="">New from template...</option>
                {database.templates.map(template => (
                  <option key={template.id} value={template.id}>{template.name}</option>
                ))}
              </select>
            ) : null}
          </div>
        </div>

        {/* View Switchers */}
        <div className="flex flex-wrap gap-1 border border-gray-200 dark:border-gray-800 rounded-lg p-0.5 bg-gray-50/50 dark:bg-gray-900/10 w-fit max-w-full">
          {database.views.map(view => {
            const meta = VIEW_META[view.type];
            if (!meta) return null;
            const Icon = meta.icon;
            return (
              <button
                key={view.id}
                onClick={() => handleViewSwitch(view.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition",
                  activeView.id === view.id
                    ? "bg-white dark:bg-[#1E1E1E] text-purple-600 dark:text-purple-400 shadow-xs border border-gray-200 dark:border-gray-800"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-800"
                )}
              >
                <Icon size={12} />
                <span>{view.name || meta.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Database View Contents */}
      {activeView.type === 'table' && (
        <DatabaseTableView
          database={database}
          view={activeView}
          onChange={handleDatabaseChange}
          onRunAiProperty={handleRunAiProperty}
          aiRunningRows={aiRunningRows}
        />
      )}
      {activeView.type === 'board' && (
        <DatabaseBoardView
          database={database}
          view={activeView}
          onViewChange={handleViewChange}
          onChange={handleDatabaseChange}
        />
      )}
      {activeView.type === 'calendar' && (
        <DatabaseCalendarView
          database={database}
          view={activeView}
          onViewChange={handleViewChange}
          onChange={handleDatabaseChange}
        />
      )}
      {activeView.type === 'list' && (
        <DatabaseListView database={database} view={activeView} onViewChange={handleViewChange} onChange={handleDatabaseChange} />
      )}
      {activeView.type === 'gallery' && (
        <DatabaseGalleryView database={database} view={activeView} onViewChange={handleViewChange} onChange={handleDatabaseChange} />
      )}
      {activeView.type === 'timeline' && (
        <DatabaseTimelineView database={database} view={activeView} onViewChange={handleViewChange} onChange={handleDatabaseChange} />
      )}
    </div>
  );
}
