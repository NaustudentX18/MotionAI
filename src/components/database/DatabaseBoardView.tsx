import React from 'react';
import { Database, DatabaseRow, DatabaseView } from '../../types/database';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DatabaseBoardViewProps {
  database: Database;
  onChange: (updatedDb: Database) => void;
  view: DatabaseView;
  onViewChange: (updatedView: DatabaseView) => void;
}

export function DatabaseBoardView({ database, onChange, view, onViewChange }: DatabaseBoardViewProps) {
  const { properties, rows } = database;

  // Find suitable grouping property (either selected or first 'select' property)
  const groupProperty = view.groupByPropertyId
    ? properties.find(p => p.id === view.groupByPropertyId)
    : properties.find(p => p.type === 'select');

  const activeGroupProp = groupProperty;

  // If no group property can be found, show setup UI
  if (!activeGroupProp || activeGroupProp.type !== 'select') {
    const selectProperties = properties.filter(p => p.type === 'select');

    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-900/10 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl text-center">
        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Group by property needed</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 max-w-sm">
          Kanban boards group database items into vertical columns based on a single select property (e.g. Status or Priority).
        </p>
        {selectProperties.length > 0 ? (
          <div className="flex gap-2">
            <select
              value={view.groupByPropertyId || ''}
              onChange={(e) => onViewChange({ ...view, groupByPropertyId: e.target.value || undefined })}
              className="px-2.5 py-1 text-xs border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-[#1E1E1E]"
            >
              <option value="">Select a column...</option>
              {selectProperties.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <span className="text-xs italic text-red-500">
            Please add a "Single Select" property to this database first.
          </span>
        )}
      </div>
    );
  }

  // Get columns from select options (include an "Unassigned" column for empty values)
  const columns = [
    { id: 'unassigned', name: 'Unassigned', color: 'gray' },
    ...(activeGroupProp.options || []).map(opt => ({
      id: opt.id,
      name: opt.name,
      color: opt.color || 'purple',
    })),
  ];

  // Map rows to columns
  const itemsByColumn: Record<string, DatabaseRow[]> = {};
  columns.forEach(col => {
    itemsByColumn[col.name] = [];
  });

  rows.forEach(row => {
    const val = row.values[activeGroupProp.id];
    if (!val) {
      itemsByColumn['Unassigned'].push(row);
    } else if (itemsByColumn[val]) {
      itemsByColumn[val].push(row);
    } else {
      // Option exists but not defined in column (fallback)
      itemsByColumn['Unassigned'].push(row);
    }
  });

  // Handle Drag & Drop
  const handleDragStart = (e: React.DragEvent, rowId: string) => {
    e.dataTransfer.setData('text/plain', rowId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetColumnName: string) => {
    e.preventDefault();
    const rowId = e.dataTransfer.getData('text/plain');
    if (!rowId) return;

    const newValue = targetColumnName === 'Unassigned' ? '' : targetColumnName;
    const updatedRows = rows.map(row => {
      if (row.id === rowId) {
        return {
          ...row,
          values: { ...row.values, [activeGroupProp.id]: newValue },
          updatedAt: Date.now(),
        };
      }
      return row;
    });

    onChange({ ...database, rows: updatedRows });
  };

  // Add Card in specific column
  const handleAddCard = (columnName: string) => {
    const val = columnName === 'Unassigned' ? '' : columnName;
    const newRow: DatabaseRow = {
      id: crypto.randomUUID(),
      values: { [activeGroupProp.id]: val },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    onChange({ ...database, rows: [...rows, newRow] });
  };

  // Delete Card
  const handleDeleteCard = (rowId: string) => {
    onChange({ ...database, rows: rows.filter(row => row.id !== rowId) });
  };

  // Get color styles for columns
  const getColHeaderStyle = (color: string) => {
    switch (color) {
      case 'red': return 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border-red-100 dark:border-red-900/30';
      case 'emerald': return 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30';
      case 'blue': return 'bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-900/30';
      case 'amber': return 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900/30';
      default: return 'bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 border-purple-100 dark:border-purple-900/30';
    }
  };

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Board Settings Bar */}
      <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Group by:</span>
          <select
            value={activeGroupProp.id}
            onChange={(e) => onViewChange({ ...view, groupByPropertyId: e.target.value })}
            className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-800 rounded bg-white dark:bg-[#1E1E1E] font-medium"
          >
            {properties
              .filter(p => p.type === 'select')
              .map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
          </select>
        </div>
      </div>

      {/* Kanban Grid */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map(col => {
          const colItems = itemsByColumn[col.name] || [];
          return (
            <div
              key={col.id}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.name)}
              className="flex-1 min-w-[280px] max-w-[320px] bg-gray-50/50 dark:bg-gray-900/10 rounded-xl p-3 flex flex-col border border-gray-100 dark:border-gray-800/60"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border",
                    getColHeaderStyle(col.color)
                  )}>
                    {col.name}
                  </span>
                  <span className="text-xs text-gray-400 font-bold">{colItems.length}</span>
                </div>
                <button
                  onClick={() => handleAddCard(col.name)}
                  className="p-1 rounded text-gray-400 hover:text-purple-600 hover:bg-gray-100 dark:hover:bg-gray-800/80 transition"
                  title="Add Card"
                >
                  <Plus size={14} />
                </button>
              </div>

              {/* Cards list */}
              <div className="flex flex-col gap-2.5 overflow-y-auto flex-1 min-h-[300px]">
                {colItems.map(row => {
                  // Find title / principal text property to render as card header
                  const textProp = properties.find(p => p.type === 'text') || properties[0];
                  const cardTitle = row.values[textProp?.id] || 'Untitled Item';

                  return (
                    <div
                      key={row.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, row.id)}
                      className="bg-white dark:bg-[#1E1E1E] p-3 rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs hover:shadow-md hover:border-purple-300 dark:hover:border-purple-900/40 cursor-grab active:cursor-grabbing transition group relative"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-1.5 min-w-0">
                          <GripVertical size={13} className="text-gray-300 dark:text-gray-600 shrink-0 mt-0.5" />
                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate block">
                            {cardTitle}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteCard(row.id)}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 p-0.5 rounded transition shrink-0"
                          title="Delete Card"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>

                      {/* Display minor metadata if available */}
                      <div className="mt-2.5 flex items-center justify-between text-[9px] text-gray-400 dark:text-gray-500 font-medium">
                        <span>Updated {new Date(row.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  );
                })}

                {colItems.length === 0 && (
                  <div className="flex-1 flex items-center justify-center p-8 border border-dashed border-gray-200 dark:border-gray-800 rounded-lg text-[10px] text-gray-400 dark:text-gray-600 italic">
                    Drop items here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
