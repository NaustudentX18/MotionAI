import React from 'react';
import { Database, DatabaseProperty, DatabaseView } from '../../types/database';
import { Plus, Trash2 } from 'lucide-react';
import { getRowTitle, isValidDateValue, toDateKey } from './databaseViewUtils';

interface DatabaseTimelineViewProps {
  database: Database;
  view: DatabaseView;
  onChange: (updatedDb: Database) => void;
  onViewChange: (updatedView: DatabaseView) => void;
}

export function DatabaseTimelineView({ database, view, onChange, onViewChange }: DatabaseTimelineViewProps) {
  const dateProperties = database.properties.filter(property => property.type === 'date');
  const startProperty = findDateProperty(dateProperties, view.timelineStartPropertyId);
  const endProperty = findDateProperty(dateProperties, view.timelineEndPropertyId);

  const handleAddRow = () => {
    const values = startProperty ? { [startProperty.id]: new Date().toISOString().split('T')[0] } : {};
    onChange({
      ...database,
      rows: [...database.rows, { id: crypto.randomUUID(), values, createdAt: Date.now(), updatedAt: Date.now() }],
    });
  };

  const handleDeleteRow = (rowId: string) => {
    onChange({ ...database, rows: database.rows.filter(row => row.id !== rowId) });
  };

  if (!startProperty) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-900/10 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl text-center">
        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Date property needed</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 max-w-sm">Timeline view needs a valid date column for the start date.</p>
        {dateProperties.length > 0 ? (
          <select value={view.timelineStartPropertyId || ''} onChange={(event) => onViewChange({ ...view, timelineStartPropertyId: event.target.value })} className="px-2.5 py-1 text-xs border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-[#1E1E1E]">
            <option value="">Select a start date column...</option>
            {dateProperties.map(property => <option key={property.id} value={property.id}>{property.name}</option>)}
          </select>
        ) : (
          <span className="text-xs italic text-red-500">Please add a Date property to this database first.</span>
        )}
      </div>
    );
  }

  const sortedRows = [...database.rows].sort((a, b) => {
    const aTime = isValidDateValue(a.values[startProperty.id]) ? new Date(a.values[startProperty.id]).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = isValidDateValue(b.values[startProperty.id]) ? new Date(b.values[startProperty.id]).getTime() : Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  });

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-gray-100 dark:border-gray-800">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Start:</span>
          <select value={startProperty.id} onChange={(event) => onViewChange({ ...view, timelineStartPropertyId: event.target.value })} className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-800 rounded bg-white dark:bg-[#1E1E1E] font-medium">
            {dateProperties.map(property => <option key={property.id} value={property.id}>{property.name}</option>)}
          </select>
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">End:</span>
          <select value={endProperty?.id || ''} onChange={(event) => onViewChange({ ...view, timelineEndPropertyId: event.target.value || undefined })} className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-800 rounded bg-white dark:bg-[#1E1E1E] font-medium">
            <option value="">None</option>
            {dateProperties.map(property => <option key={property.id} value={property.id}>{property.name}</option>)}
          </select>
        </div>
        <button onClick={handleAddRow} className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition">
          <Plus size={12} /> Add Item
        </button>
      </div>

      {sortedRows.length === 0 ? (
        <div className="p-8 text-center text-xs text-gray-400 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl">No timeline items yet.</div>
      ) : (
        <div className="relative flex flex-col gap-3 pl-4 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-px before:bg-purple-200 dark:before:bg-purple-900/50">
          {sortedRows.map(row => {
            const start = toDateKey(row.values[startProperty.id]);
            const end = endProperty ? toDateKey(row.values[endProperty.id]) : null;
            return (
              <div key={row.id} className="relative rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#191919] p-3 shadow-sm group">
                <span className="absolute -left-[18px] top-4 h-3 w-3 rounded-full border-2 border-white dark:border-[#191919] bg-purple-500" />
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate">{getRowTitle(database, row, view.titlePropertyId)}</div>
                    <div className="mt-1 text-xs font-medium text-purple-600 dark:text-purple-400">{start || 'No start date'}{end ? ` → ${end}` : ''}</div>
                  </div>
                  <button onClick={() => handleDeleteRow(row.id)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 p-0.5 rounded transition" title="Delete item">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function findDateProperty(dateProperties: DatabaseProperty[], propertyId?: string) {
  return dateProperties.find(property => property.id === propertyId) || dateProperties[0];
}
