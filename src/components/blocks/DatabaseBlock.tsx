import React, { useState, useEffect } from 'react';
import { Block } from '../../types';
import { Database, DatabaseViewType } from '../../types/database';
import { DatabaseTableView } from '../database/DatabaseTableView';
import { DatabaseBoardView } from '../database/DatabaseBoardView';
import { DatabaseCalendarView } from '../database/DatabaseCalendarView';
import { Table, KanbanSquare, Calendar, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DatabaseBlockProps {
  block: Block;
  onChange: (updatedBlockContent: string) => void;
  onRunAi?: (db: Database, propertyId: string, rowId: string) => Promise<string>;
}

export function DatabaseBlock({ block, onChange, onRunAi }: DatabaseBlockProps) {
  const [database, setDatabase] = useState<Database | null>(null);
  const [activeView, setActiveView] = useState<DatabaseViewType>('table');
  const [aiRunningRows, setAiRunningRows] = useState<Record<string, boolean>>({});

  // Parse block content into structured Database
  useEffect(() => {
    try {
      if (block.content && block.content.trim().startsWith('{')) {
        const parsed = JSON.parse(block.content) as Database;
        setDatabase(parsed);
        if (parsed.views?.[0]) {
          setActiveView(parsed.views[0].type);
        }
      } else {
        // Initialize default database template
        const defaultDb: Database = {
          id: crypto.randomUUID(),
          title: 'Tasks Database',
          properties: [
            { id: 'prop-title', name: 'Name', type: 'text' },
            {
              id: 'prop-status',
              name: 'Status',
              type: 'select',
              options: [
                { id: 'opt-todo', name: 'To Do', color: 'gray' },
                { id: 'opt-progress', name: 'In Progress', color: 'blue' },
                { id: 'opt-done', name: 'Done', color: 'emerald' },
              ],
            },
            { id: 'prop-date', name: 'Due Date', type: 'date' },
          ],
          rows: [
            {
              id: 'row-1',
              values: {
                'prop-title': 'Project kickoff meeting',
                'prop-status': 'To Do',
                'prop-date': new Date().toISOString().split('T')[0],
              },
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          ],
          views: [
            { id: 'view-table', name: 'Table', type: 'table', visibleProperties: ['prop-title', 'prop-status', 'prop-date'] },
            { id: 'view-board', name: 'Board', type: 'board', visibleProperties: ['prop-title', 'prop-status'], groupByPropertyId: 'prop-status' },
          ],
        };
        setDatabase(defaultDb);
        onChange(JSON.stringify(defaultDb));
      }
    } catch (e) {
      console.error('Failed to parse database block content', e);
    }
  }, [block.content]);

  const handleDatabaseChange = (updatedDb: Database) => {
    setDatabase(updatedDb);
    onChange(JSON.stringify(updatedDb));
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

  if (!database) return <div className="p-4 text-xs italic text-gray-400">Loading Database...</div>;

  return (
    <div className="my-6 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 bg-white dark:bg-[#191919] shadow-xs">
      {/* Database Title & View Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={database.title}
            onChange={(e) => handleDatabaseChange({ ...database, title: e.target.value })}
            className="text-sm font-bold text-gray-800 dark:text-gray-100 bg-transparent border-0 outline-none focus:ring-1 focus:ring-purple-400/50 rounded px-1"
          />
        </div>

        {/* View Switchers */}
        <div className="flex gap-1 border border-gray-200 dark:border-gray-800 rounded-lg p-0.5 bg-gray-50/50 dark:bg-gray-900/10">
          <button
            onClick={() => setActiveView('table')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition",
              activeView === 'table'
                ? "bg-white dark:bg-[#1E1E1E] text-purple-600 dark:text-purple-400 shadow-xs border border-gray-200 dark:border-gray-800"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-800"
            )}
          >
            <Table size={12} />
            <span>Table</span>
          </button>
          <button
            onClick={() => setActiveView('board')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition",
              activeView === 'board'
                ? "bg-white dark:bg-[#1E1E1E] text-purple-600 dark:text-purple-400 shadow-xs border border-gray-200 dark:border-gray-800"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-800"
            )}
          >
            <KanbanSquare size={12} />
            <span>Board</span>
          </button>
          <button
            onClick={() => setActiveView('calendar')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition",
              activeView === 'calendar'
                ? "bg-white dark:bg-[#1E1E1E] text-purple-600 dark:text-purple-400 shadow-xs border border-gray-200 dark:border-gray-800"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-800"
            )}
          >
            <Calendar size={12} />
            <span>Calendar</span>
          </button>
        </div>
      </div>

      {/* Database View Contents */}
      {activeView === 'table' && (
        <DatabaseTableView
          database={database}
          onChange={handleDatabaseChange}
          onRunAiProperty={handleRunAiProperty}
          aiRunningRows={aiRunningRows}
        />
      )}
      {activeView === 'board' && (
        <DatabaseBoardView
          database={database}
          onChange={handleDatabaseChange}
        />
      )}
      {activeView === 'calendar' && (
        <DatabaseCalendarView
          database={database}
          onChange={handleDatabaseChange}
        />
      )}
    </div>
  );
}
