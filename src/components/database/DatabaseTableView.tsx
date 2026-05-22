import React, { useState } from 'react';
import { Database, DatabaseProperty, DatabaseRow, SelectOption } from '../../types/database';
import { Plus, Trash2, Settings2, Sparkles, PlusCircle, Calendar as CalendarIcon, Type, Hash, CheckSquare, ListPlus, ChevronDown, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DatabaseTableViewProps {
  database: Database;
  onChange: (updatedDb: Database) => void;
  onRunAiProperty?: (propertyId: string, rowId: string) => Promise<void>;
  aiRunningRows?: Record<string, boolean>; // propertyId-rowId -> boolean
}

export function DatabaseTableView({ database, onChange, onRunAiProperty, aiRunningRows = {} }: DatabaseTableViewProps) {
  const [editingCell, setEditingCell] = useState<{ rowId: string; propertyId: string } | null>(null);
  const [editingProperty, setEditingProperty] = useState<string | null>(null); // propertyId for editing config
  const [newPropName, setNewPropName] = useState('');
  const [newPropType, setNewPropType] = useState<DatabaseProperty['type']>('text');
  const [showAddProp, setShowAddProp] = useState(false);

  const { properties, rows } = database;

  // Handler for cell updates
  const handleCellChange = (rowId: string, propertyId: string, value: any) => {
    const updatedRows = rows.map(row => {
      if (row.id === rowId) {
        return {
          ...row,
          values: { ...row.values, [propertyId]: value },
          updatedAt: Date.now(),
        };
      }
      return row;
    });
    onChange({ ...database, rows: updatedRows });
  };

  // Add a new row
  const handleAddRow = () => {
    const newRow: DatabaseRow = {
      id: crypto.randomUUID(),
      values: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    onChange({ ...database, rows: [...rows, newRow] });
  };

  // Delete a row
  const handleDeleteRow = (rowId: string) => {
    const updatedRows = rows.filter(row => row.id !== rowId);
    onChange({ ...database, rows: updatedRows });
  };

  // Add a new property (column)
  const handleAddProperty = () => {
    if (!newPropName.trim()) return;
    const newProp: DatabaseProperty = {
      id: crypto.randomUUID(),
      name: newPropName.trim(),
      type: newPropType,
      options: ['select', 'multi-select'].includes(newPropType) ? [] : undefined,
    };
    const updatedProperties = [...properties, newProp];
    onChange({
      ...database,
      properties: updatedProperties,
      views: database.views.map(view => ({
        ...view,
        visibleProperties: [...view.visibleProperties, newProp.id],
      })),
    });
    setNewPropName('');
    setShowAddProp(false);
  };

  // Delete a property
  const handleDeleteProperty = (propertyId: string) => {
    const updatedProperties = properties.filter(p => p.id !== propertyId);
    const updatedRows = rows.map(row => {
      const newValues = { ...row.values };
      delete newValues[propertyId];
      return { ...row, values: newValues };
    });
    onChange({ ...database, properties: updatedProperties, rows: updatedRows });
  };

  // Get Property Icon
  const getPropIcon = (type: DatabaseProperty['type']) => {
    switch (type) {
      case 'number': return <Hash size={14} className="opacity-60" />;
      case 'checkbox': return <CheckSquare size={14} className="opacity-60" />;
      case 'date': return <CalendarIcon size={14} className="opacity-60" />;
      case 'select': return <ListPlus size={14} className="opacity-60" />;
      case 'multi-select': return <ListPlus size={14} className="opacity-60" />;
      case 'ai': return <Sparkles size={14} className="text-purple-500 animate-pulse" />;
      default: return <Type size={14} className="opacity-60" />;
    }
  };

  // Render Cell Value helper
  const renderCell = (row: DatabaseRow, prop: DatabaseProperty) => {
    const value = row.values[prop.id];
    const isEditing = editingCell?.rowId === row.id && editingCell?.propertyId === prop.id;

    if (isEditing) {
      if (prop.type === 'checkbox') {
        return (
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => handleCellChange(row.id, prop.id, e.target.checked)}
            onBlur={() => setEditingCell(null)}
            className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
            autoFocus
          />
        );
      }

      if (prop.type === 'select' || prop.type === 'multi-select') {
        const options = prop.options || [];
        return (
          <div className="flex flex-col min-w-[120px] bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-gray-800 rounded shadow-md p-1 z-10 absolute">
            {options.map(opt => {
              const isSelected = prop.type === 'select'
                ? value === opt.name
                : Array.isArray(value) && value.includes(opt.name);

              return (
                <button
                  key={opt.id}
                  onClick={() => {
                    if (prop.type === 'select') {
                      handleCellChange(row.id, prop.id, opt.name);
                      setEditingCell(null);
                    } else {
                      const arr = Array.isArray(value) ? value : [];
                      const nextVal = arr.includes(opt.name)
                        ? arr.filter((x: string) => x !== opt.name)
                        : [...arr, opt.name];
                      handleCellChange(row.id, prop.id, nextVal);
                    }
                  }}
                  className="flex items-center justify-between px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-left"
                >
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300">
                    {opt.name}
                  </span>
                  {isSelected && <Check size={12} className="text-purple-600" />}
                </button>
              );
            })}
            <div className="flex gap-1 p-1 mt-1 border-t border-gray-100 dark:border-gray-800">
              <input
                type="text"
                placeholder="New option..."
                className="w-full px-1.5 py-0.5 text-[10px] border border-gray-200 dark:border-gray-800 rounded bg-transparent"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const input = e.currentTarget;
                    const optName = input.value.trim();
                    if (optName && !options.some(o => o.name === optName)) {
                      const newOption: SelectOption = { id: crypto.randomUUID(), name: optName };
                      const updatedProps = properties.map(p => {
                        if (p.id === prop.id) {
                          return { ...p, options: [...(p.options || []), newOption] };
                        }
                        return p;
                      });
                      onChange({ ...database, properties: updatedProps });
                      input.value = '';
                    }
                  }
                }}
              />
            </div>
            <button
              onClick={() => setEditingCell(null)}
              className="w-full text-center py-1 mt-1 text-[9px] text-gray-400 hover:text-gray-600 border-t border-gray-100 dark:border-gray-800"
            >
              Close
            </button>
          </div>
        );
      }

      return (
        <input
          type={prop.type === 'number' ? 'number' : 'text'}
          value={value === undefined ? '' : value}
          onChange={(e) => handleCellChange(row.id, prop.id, prop.type === 'number' ? Number(e.target.value) : e.target.value)}
          onBlur={() => setEditingCell(null)}
          onKeyDown={(e) => e.key === 'Enter' && setEditingCell(null)}
          className="w-full px-1 py-0.5 text-xs bg-transparent border-0 outline-none ring-1 ring-purple-500 rounded"
          autoFocus
        />
      );
    }

    // Default Rendering Mode
    switch (prop.type) {
      case 'checkbox':
        return (
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => handleCellChange(row.id, prop.id, e.target.checked)}
            className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500 cursor-pointer"
          />
        );
      case 'select':
        return value ? (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300">
            {value}
          </span>
        ) : (
          <span className="text-gray-300 dark:text-gray-600 text-[10px]">Empty</span>
        );
      case 'multi-select':
        return Array.isArray(value) && value.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {value.map(val => (
              <span key={val} className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-100 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300">
                {val}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-gray-300 dark:text-gray-600 text-[10px]">Empty</span>
        );
      case 'ai':
        const isRunning = aiRunningRows[`${prop.id}-${row.id}`];
        return (
          <div className="flex items-center gap-1 min-w-[120px] max-w-[280px]">
            {value ? (
              <span className="text-xs truncate" title={value}>{value}</span>
            ) : (
              <span className="text-gray-400 dark:text-gray-600 text-xs italic">Pending generation...</span>
            )}
            {onRunAiProperty && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRunAiProperty(prop.id, row.id);
                }}
                disabled={isRunning}
                className={cn(
                  "p-1 rounded text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-950/20 shrink-0",
                  isRunning && "animate-spin text-gray-400"
                )}
              >
                <Sparkles size={12} />
              </button>
            )}
          </div>
        );
      default:
        return value ? (
          <span className="text-xs truncate max-w-[200px]" title={value}>{value}</span>
        ) : (
          <span className="text-gray-300 dark:text-gray-700 text-xs italic">Empty</span>
        );
    }
  };

  return (
    <div className="w-full flex flex-col bg-white dark:bg-[#191919] border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
      {/* Table Action Bar */}
      <div className="flex items-center justify-between p-3 border-b border-gray-100 dark:border-gray-800 bg-[#FAFAFA] dark:bg-[#1E1E1E]">
        <div className="flex items-center gap-2">
          <span className="font-bold text-xs uppercase tracking-wider text-gray-400">Database Properties</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddProp(!showAddProp)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
          >
            <Plus size={12} />
            <span>Add Property</span>
          </button>
        </div>
      </div>

      {/* Add Property Form */}
      {showAddProp && (
        <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-[#1F1F1F] border-b border-gray-100 dark:border-gray-800">
          <input
            type="text"
            placeholder="Property Name"
            value={newPropName}
            onChange={(e) => setNewPropName(e.target.value)}
            className="px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1E1E1E]"
          />
          <select
            value={newPropType}
            onChange={(e) => setNewPropType(e.target.value as DatabaseProperty['type'])}
            className="px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1E1E1E]"
          >
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="select">Single Select</option>
            <option value="multi-select">Multi Select</option>
            <option value="checkbox">Checkbox</option>
            <option value="date">Date</option>
            <option value="ai">AI Generator</option>
          </select>
          {newPropType === 'ai' && (
            <input
              type="text"
              placeholder="Prompt template: Summarize {{TextColumn}}"
              className="flex-1 px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1E1E1E]"
              onBlur={(e) => {
                // We'll store prompt templates directly in the formula property
                database.properties = properties.map(p => p.name === newPropName ? { ...p, formula: e.target.value } : p);
              }}
            />
          )}
          <button
            onClick={handleAddProperty}
            className="px-3 py-1 text-xs font-semibold text-white bg-purple-600 rounded hover:bg-purple-700"
          >
            Create
          </button>
        </div>
      )}

      {/* Structured Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30">
              <th className="w-10 px-3 py-2 text-center text-xs font-bold text-gray-400 uppercase">#</th>
              {properties.map(prop => (
                <th key={prop.id} className="px-4 py-2.5 text-xs font-bold text-gray-600 dark:text-gray-400 group">
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5">
                      {getPropIcon(prop.type)}
                      <span>{prop.name}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteProperty(prop.id)}
                      className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600 p-0.5 rounded transition"
                      title="Delete Property"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </th>
              ))}
              <th className="w-12 px-3 py-2 text-center"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={row.id}
                className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/40 dark:hover:bg-gray-900/10 group transition"
              >
                <td className="px-3 py-2 text-center text-xs text-gray-400 font-medium">{idx + 1}</td>
                {properties.map(prop => (
                  <td
                    key={prop.id}
                    className="px-4 py-2 text-xs relative cursor-text min-h-[32px] group/cell"
                    onClick={() => {
                      if (prop.type !== 'checkbox') {
                        setEditingCell({ rowId: row.id, propertyId: prop.id });
                      }
                    }}
                  >
                    {renderCell(row, prop)}
                  </td>
                ))}
                <td className="px-3 py-2 text-center">
                  <button
                    onClick={() => handleDeleteRow(row.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 p-1 rounded transition"
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <button
        onClick={handleAddRow}
        className="flex items-center gap-2 p-3 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900/20 text-left border-t border-gray-100 dark:border-gray-800 transition"
      >
        <PlusCircle size={14} className="text-gray-400" />
        <span>Add a Row</span>
      </button>
    </div>
  );
}
