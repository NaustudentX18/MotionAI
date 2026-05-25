import React, { useState } from 'react';
import { useWebRTCConfig, type StunTurnServer } from '../../hooks/useWebRTCConfig';

export default function StunTurnConfig() {
  const { getServers, addServer, removeServer, resetToDefaults, testConnection } = useWebRTCConfig();
  const [servers, setServers] = useState<StunTurnServer[]>(getServers());
  const [newUrl, setNewUrl] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editCredential, setEditCredential] = useState('');

  const refresh = () => {
    setServers(getServers());
  };

  const handleAdd = () => {
    const trimmed = newUrl.trim();
    if (!trimmed) return;
    addServer({ urls: trimmed });
    setNewUrl('');
    refresh();
  };

  const handleRemove = (index: number) => {
    removeServer(index);
    refresh();
  };

  const handleReset = () => {
    resetToDefaults();
    refresh();
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const result = await testConnection();
    if (result.success) {
      setTestResult(`Connected in ${result.durationMs}ms${result.candidateType ? ` (${result.candidateType})` : ''}`);
    } else {
      setTestResult(`Failed after ${result.durationMs}ms`);
    }
    setTesting(false);
  };

  const handleSaveEdit = (index: number) => {
    const updated = [...servers];
    updated[index] = { ...updated[index], username: editUsername, credential: editCredential };
    const { setServers: saveServers } = useWebRTCConfig();
    saveServers(updated);
    setEditIndex(null);
    setEditUsername('');
    setEditCredential('');
    refresh();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-stone-800 dark:text-stone-200">ICE / STUN / TURN Servers</h3>
        <div className="flex gap-1">
          <button
            onClick={handleReset}
            className="text-xs px-2 py-1 rounded bg-stone-200 hover:bg-stone-300 dark:bg-stone-700 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-300"
          >
            Reset Defaults
          </button>
          <button
            onClick={handleTest}
            disabled={testing}
            className="text-xs px-2 py-1 rounded bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:hover:bg-indigo-800/50 text-indigo-700 dark:text-indigo-300 disabled:opacity-50"
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
        </div>
      </div>

      {testResult && (
        <div className={`text-xs p-2 rounded ${
          testResult.startsWith('Connected')
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
        }`}>
          {testResult}
        </div>
      )}

      <div className="space-y-1 max-h-48 overflow-y-auto">
        {servers.map((server, i) => (
          <div key={i} className="flex items-center gap-1 text-xs p-1.5 rounded bg-stone-50 dark:bg-stone-800/50">
            <span className="flex-1 truncate font-mono text-stone-700 dark:text-stone-300" title={server.urls}>
              {server.urls}
            </span>
            {editIndex === i ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  placeholder="Username"
                  className="w-20 px-1 py-0.5 text-xs border rounded dark:bg-stone-700 dark:border-stone-600"
                />
                <input
                  type="password"
                  value={editCredential}
                  onChange={(e) => setEditCredential(e.target.value)}
                  placeholder="Credential"
                  className="w-20 px-1 py-0.5 text-xs border rounded dark:bg-stone-700 dark:border-stone-600"
                />
                <button onClick={() => handleSaveEdit(i)} className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400">Save</button>
                <button onClick={() => setEditIndex(null)} className="text-stone-500 hover:text-stone-700">Cancel</button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                {server.username && <span className="text-stone-400">(auth)</span>}
                <button onClick={() => { setEditIndex(i); setEditUsername(server.username || ''); setEditCredential(server.credential || ''); }} className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400">Edit</button>
                <button onClick={() => handleRemove(i)} className="text-red-500 hover:text-red-700">✕</button>
              </div>
            )}
          </div>
        ))}
        {servers.length === 0 && (
          <p className="text-xs text-stone-500 dark:text-stone-400 italic">No ICE servers configured. WebRTC may not work.</p>
        )}
      </div>

      <div className="flex gap-1">
        <input
          type="text"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          placeholder="stun:stun.example.com:19302"
          className="flex-1 px-2 py-1 text-xs border rounded dark:bg-stone-700 dark:border-stone-600 dark:text-stone-200"
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button
          onClick={handleAdd}
          className="text-xs px-2 py-1 rounded bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:hover:bg-indigo-800/50 text-indigo-700 dark:text-indigo-300"
        >
          Add
        </button>
      </div>

      <p className="text-xs text-stone-400 dark:text-stone-500">
        STUN servers help discover your public IP for WebRTC peer connections.
        TURN servers relay traffic when direct connections fail.
      </p>
    </div>
  );
}
