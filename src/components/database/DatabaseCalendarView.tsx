import React, { useState } from 'react';
import { Database, DatabaseRow, DatabaseProperty } from '../../types/database';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DatabaseCalendarViewProps {
  database: Database;
  onChange: (updatedDb: Database) => void;
  datePropertyId?: string;
}

export function DatabaseCalendarView({ database, onChange, datePropertyId }: DatabaseCalendarViewProps) {
  const { properties, rows } = database;

  // Find date property
  const activeDateProp = datePropertyId
    ? properties.find(p => p.id === datePropertyId)
    : properties.find(p => p.type === 'date');

  const [selectedDatePropId, setSelectedDatePropId] = useState<string>(activeDateProp?.id || '');
  const [currentDate, setCurrentDate] = useState(new Date());

  const targetDateProp = properties.find(p => p.id === selectedDatePropId);

  // If no date property exists, show configuration prompt
  if (!targetDateProp || targetDateProp.type !== 'date') {
    const dateProperties = properties.filter(p => p.type === 'date');
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-900/10 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl text-center">
        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Date property needed</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 max-w-sm">
          Calendar view maps database items to dates. Please select a column containing dates.
        </p>
        {dateProperties.length > 0 ? (
          <select
            value={selectedDatePropId}
            onChange={(e) => setSelectedDatePropId(e.target.value)}
            className="px-2.5 py-1 text-xs border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-[#1E1E1E]"
          >
            <option value="">Select a date column...</option>
            {dateProperties.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        ) : (
          <span className="text-xs italic text-red-500">
            Please add a "Date" property to this database first.
          </span>
        )}
      </div>
    );
  }

  // Calendar math
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const startDayOfWeek = firstDayOfMonth.getDay(); // 0 is Sunday, 6 is Saturday
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Create grid cells (42 cells: 6 rows of 7 columns)
  const cells: (Date | null)[] = [];
  // Pad beginning with nulls
  for (let i = 0; i < startDayOfWeek; i++) {
    cells.push(null);
  }
  // Fill month days
  for (let i = 1; i <= daysInMonth; i++) {
    cells.push(new Date(year, month, i));
  }
  // Pad end to make full multiple of 7
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  // Row items grouped by ISO date string (YYYY-MM-DD)
  const itemsByDate: Record<string, DatabaseRow[]> = {};
  rows.forEach(row => {
    const rawVal = row.values[targetDateProp.id];
    if (rawVal) {
      const dateStr = new Date(rawVal).toISOString().split('T')[0];
      if (!itemsByDate[dateStr]) {
        itemsByDate[dateStr] = [];
      }
      itemsByDate[dateStr].push(row);
    }
  });

  // Navigate Months
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Add Item to Date
  const handleAddItemToDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const newRow: DatabaseRow = {
      id: crypto.randomUUID(),
      values: { [targetDateProp.id]: dateStr },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    onChange({ ...database, rows: [...rows, newRow] });
  };

  // Delete Card
  const handleDeleteCard = (rowId: string) => {
    onChange({ ...database, rows: rows.filter(row => row.id !== rowId) });
  };

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Calendar Controls */}
      <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200">
            {monthNames[month]} {year}
          </h3>
          <div className="flex gap-1 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden bg-white dark:bg-[#1E1E1E]">
            <button
              onClick={handlePrevMonth}
              className="p-1 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1 border-l border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Date property:</span>
          <select
            value={selectedDatePropId}
            onChange={(e) => setSelectedDatePropId(e.target.value)}
            className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-800 rounded bg-white dark:bg-[#1E1E1E] font-medium"
          >
            {properties
              .filter(p => p.type === 'date')
              .map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
          </select>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-[#191919]">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30">
          {weekdays.map(day => (
            <div key={day} className="py-2 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 grid-rows-6 min-h-[480px]">
          {cells.map((date, idx) => {
            const dateStr = date ? date.toISOString().split('T')[0] : '';
            const dayItems = dateStr ? itemsByDate[dateStr] || [] : [];
            const isToday = dateStr === new Date().toISOString().split('T')[0];

            return (
              <div
                key={idx}
                className={cn(
                  "border-r border-b border-gray-200 dark:border-gray-800/80 p-2 flex flex-col group min-h-[80px]",
                  !date && "bg-gray-50/30 dark:bg-gray-900/5",
                  (idx + 1) % 7 === 0 && "border-r-0"
                )}
              >
                {date ? (
                  <>
                    {/* Day number & Add button */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold",
                        isToday
                          ? "bg-purple-600 text-white"
                          : "text-gray-600 dark:text-gray-400"
                      )}>
                        {date.getDate()}
                      </span>
                      <button
                        onClick={() => handleAddItemToDate(date)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/20 transition"
                        title="Add Item"
                      >
                        <Plus size={12} />
                      </button>
                    </div>

                    {/* Day items list */}
                    <div className="flex flex-col gap-1 overflow-y-auto max-h-[70px] flex-1">
                      {dayItems.map(row => {
                        const textProp = properties.find(p => p.type === 'text') || properties[0];
                        const cardTitle = row.values[textProp?.id] || 'Untitled Item';

                        return (
                          <div
                            key={row.id}
                            className="bg-purple-50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/30 px-1.5 py-0.5 rounded text-[10px] text-purple-800 dark:text-purple-300 font-medium truncate flex items-center justify-between group/item cursor-pointer"
                          >
                            <span className="truncate flex-1">{cardTitle}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteCard(row.id);
                              }}
                              className="opacity-0 group-hover/item:opacity-100 p-0.5 rounded text-purple-400 hover:text-red-500 transition"
                            >
                              <Trash2 size={9} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
