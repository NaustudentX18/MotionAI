import React, { useEffect, useState, useCallback } from 'react';
import { getEntries, clearHistory, retryEntry, type AutomationLogEntry, type AutomationStats, getStats } from '../../lib/automations/automationHistory';
import { loadRules, type Rule } from '../../lib/automations/ruleBuilder';

const STATUS_COLORS: Record<string, string> = {
  triggered: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  skipped: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString();
}

export default function AutomationHistoryPanel() {
  const [entries, setEntries] = useState<AutomationLogEntry[]>([]);
  const [stats, setStats] = useState<AutomationStats | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [filter, setFilter] = useState<string>('all');

  const refresh = useCallback(async () => {
    setRules(loadRules());
    const all = await getEntries();
    setEntries(all);
    setStats(await getStats());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = filter === 'all' ? entries : entries.filter((e) => e.status === filter);

  const handleClear = async () => {
    await clearHistory();
    refresh();
  };

  const handleRetry = async (entryId: string) => {
    await retryEntry(entryId, rules);
    refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-stone-800 dark:text-stone-200">Automation History</h3>
        <button
          onClick={handleClear}
          className="text-xs px-2 py-1 rounded bg-stone-200 hover:bg-stone-300 dark:bg-stone-700 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-300"
        >
          Clear History
        </button>
      </div>

      {stats && (
        <div className="flex gap-3 text-xs">
          <span>Total: {stats.total}</span>
          <span className="text-green-600 dark:text-green-400">✓ {stats.triggered}</span>
          <span className="text-yellow-600 dark:text-yellow-400">~ {stats.skipped}</span>
          <span className="text-red-600 dark:text-red-400">✗ {stats.failed + stats.error}</span>
        </div>
      )}

      <div className="flex gap-1 flex-wrap">
        {['all', 'triggered', 'skipped', 'failed', 'error'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`text-xs px-2 py-0.5 rounded ${
              filter === s
                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-400 dark:hover:bg-stone-700'
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-xs text-stone-500 dark:text-stone-400 italic">No entries yet.</p>
      ) : (
        <div className="max-h-64 overflow-y-auto space-y-1">
          {filtered.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between text-xs p-2 rounded bg-stone-50 dark:bg-stone-800/50"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-stone-800 dark:text-stone-200 truncate">{entry.ruleName}</div>
                <div className="text-stone-500 dark:text-stone-400">
                  {entry.triggerType} · {formatTime(entry.timestamp)}
                  {entry.durationMs != null && ` · ${entry.durationMs}ms`}
                </div>
                {entry.errorMessage && (
                  <div className="text-red-500 dark:text-red-400 truncate" title={entry.errorMessage}>
                    {entry.errorMessage}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[entry.status] || ''}`}>
                  {entry.status}
                </span>
                {(entry.status === 'failed' || entry.status === 'error') && (
                  <button
                    onClick={() => handleRetry(entry.id)}
                    className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 text-xs"
                    title="Retry"
                  >
                    ↻
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
