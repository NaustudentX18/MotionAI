import React from 'react';
import { Database, DatabaseView } from '../../types/database';
import { Plus, Trash2 } from 'lucide-react';
import { formatCellValue, getRowTitle, getVisibleProperties } from './databaseViewUtils';

interface DatabaseListViewProps {
  database: Database;
  view: DatabaseView;
  onChange: (updatedDb: Database) => void;
  onViewChange: (updatedView: DatabaseView) => void;
}

export function DatabaseListView({ database, view, onChange, onViewChange }: DatabaseListViewProps) {
  const visibleProperties = getVisibleProperties(database, view).filter(property => property.id !== view.titlePropertyId);

  const handleAddRow = () => {
    const newRow = {
      id: crypto.randomUUID(),
      values: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    onChange({ ...database, rows: [...database.rows, newRow] });
  };

  const handleDeleteRow = (rowId: string) => {
    onChange({ ...database, rows: database.rows.filter(row => row.id !== rowId) });
  };

  if (database.properties.length === 0) {
    return <EmptyState title="No properties yet" message="Add properties in Table view before using List view." />;
  }

  return (
    <div className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#191919] overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-b border-gray-100 dark:border-gray-800 bg-[#FAFAFA] dark:bg-[#1E1E1E]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-400">List View</span>
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Title:</span>
          <select value={view.titlePropertyId || ''} onChange={(event) => onViewChange({ ...view, titlePropertyId: event.target.value || undefined })} className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-800 rounded bg-white dark:bg-[#1E1E1E] font-medium">
            <option value="">Auto</option>
            {database.properties.map(property => <option key={property.id} value={property.id}>{property.name}</option>)}
          </select>
        </div>
        <button onClick={handleAddRow} className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition">
          <Plus size={12} /> Add Item
        </button>
      </div>

      {database.rows.length === 0 ? (
        <EmptyState title="No rows" message="Add an item to populate this list." />
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {database.rows.map(row => (
            <div key={row.id} className="group flex items-start gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-900/20 transition">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                  {getRowTitle(database, row, view.titlePropertyId)}
                </div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {visibleProperties.map(property => (
                    <span key={property.id} className="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400">
                      {property.name}: {formatCellValue(row.values[property.id])}
                    </span>
                  ))}
                </div>
              </div>
              <button onClick={() => handleDeleteRow(row.id)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 p-1 rounded transition" title="Delete item">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed border-gray-200 dark:border-gray-800 rounded-xl m-3">
      <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">{title}</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400">{message}</p>
    </div>
  );
}
