import React from 'react';
import { Database, DatabaseView } from '../../types/database';
import { Image, Plus, Trash2 } from 'lucide-react';
import { formatCellValue, getRowTitle, getVisibleProperties } from './databaseViewUtils';

interface DatabaseGalleryViewProps {
  database: Database;
  view: DatabaseView;
  onChange: (updatedDb: Database) => void;
  onViewChange: (updatedView: DatabaseView) => void;
}

export function DatabaseGalleryView({ database, view, onChange, onViewChange }: DatabaseGalleryViewProps) {
  const visibleProperties = getVisibleProperties(database, view).filter(property => property.id !== view.titlePropertyId && property.id !== view.coverPropertyId);

  const handleAddRow = () => {
    onChange({
      ...database,
      rows: [...database.rows, { id: crypto.randomUUID(), values: {}, createdAt: Date.now(), updatedAt: Date.now() }],
    });
  };

  const handleDeleteRow = (rowId: string) => {
    onChange({ ...database, rows: database.rows.filter(row => row.id !== rowId) });
  };

  if (database.properties.length === 0) {
    return <EmptyState title="No properties yet" message="Add properties in Table view before using Gallery view." />;
  }

  return (
    <div className="w-full flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-gray-100 dark:border-gray-800">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Gallery View</span>
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Title:</span>
          <select value={view.titlePropertyId || ''} onChange={(event) => onViewChange({ ...view, titlePropertyId: event.target.value || undefined })} className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-800 rounded bg-white dark:bg-[#1E1E1E] font-medium">
            <option value="">Auto</option>
            {database.properties.map(property => <option key={property.id} value={property.id}>{property.name}</option>)}
          </select>
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Cover:</span>
          <select value={view.coverPropertyId || ''} onChange={(event) => onViewChange({ ...view, coverPropertyId: event.target.value || undefined })} className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-800 rounded bg-white dark:bg-[#1E1E1E] font-medium">
            <option value="">None</option>
            {database.properties.map(property => <option key={property.id} value={property.id}>{property.name}</option>)}
          </select>
        </div>
        <button onClick={handleAddRow} className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition">
          <Plus size={12} /> Add Card
        </button>
      </div>

      {database.rows.length === 0 ? (
        <EmptyState title="No cards" message="Add a card to populate this gallery." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {database.rows.map(row => {
            const coverValue = view.coverPropertyId ? row.values[view.coverPropertyId] : undefined;
            return (
              <div key={row.id} className="group overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#191919] shadow-sm hover:shadow-md transition">
                <div className="flex h-28 items-center justify-center bg-gradient-to-br from-purple-50 to-gray-50 dark:from-purple-950/20 dark:to-gray-900/30 border-b border-gray-100 dark:border-gray-800">
                  {typeof coverValue === 'string' && /^https?:\/\//.test(coverValue) ? (
                    <img src={coverValue} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-purple-300 dark:text-purple-700">
                      <Image size={24} />
                      <span className="text-[10px] font-semibold">No cover</span>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="min-w-0 truncate text-sm font-bold text-gray-800 dark:text-gray-100">{getRowTitle(database, row, view.titlePropertyId)}</h3>
                    <button onClick={() => handleDeleteRow(row.id)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 p-0.5 rounded transition" title="Delete card">
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className="mt-2 flex flex-col gap-1">
                    {visibleProperties.slice(0, 4).map(property => (
                      <div key={property.id} className="flex items-center justify-between gap-2 text-[10px]">
                        <span className="font-semibold text-gray-400">{property.name}</span>
                        <span className="truncate text-gray-600 dark:text-gray-400">{formatCellValue(row.values[property.id])}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-900/10 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl text-center">
      <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">{title}</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400">{message}</p>
    </div>
  );
}
