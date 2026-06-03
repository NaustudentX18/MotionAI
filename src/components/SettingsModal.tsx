import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Settings, X, CheckCircle, XCircle, Loader, Github, ExternalLink, Plus, Trash2, ToggleLeft, ToggleRight, Edit3, Zap, Play, Clock, ChevronDown, ChevronRight, AlertCircle, Info } from 'lucide-react';
import { AiProviderId } from '../lib/ai/providers';
import { useSettings } from '../hooks/useSettings';
import {
  PROVIDER_LABELS,
  PROVIDER_BASE_URLS,
  ProviderConfig,
} from '../lib/settings';
import { loadWorkspace, saveWorkspace, isWorkspaceLocked, setWorkspaceKey } from '../lib/persistence';
import { exportWorkspaceJson, importWorkspaceJson } from '../lib/workspaceImportExport';
import { exportDiagnostics } from '../lib/diagnostics';
import { csvExportToWorkspace } from '../lib/importers/csvImporter';
import { Page } from '../types';
import AutomationHistoryPanel from './automations/AutomationHistoryPanel';
import StunTurnConfig from './settings/StunTurnConfig';
import { cn } from '../lib/utils';
import {
  clearPin,
  getInactivityTimeoutMs,
  hasPin,
  INACTIVITY_TIMEOUT_OPTIONS_MS,
  lock,
  setInactivityTimeoutMs,
  setPin,
} from '../lib/localAuth';

import {
  Rule,
  TriggerType,
  ActionType,
  ConditionOperator,
  loadRules,
  createRule,
  updateRule,
  deleteRule,
  toggleRule,
  defaultStatusChangeRule,
  defaultDueDateRule,
} from '../lib/automations/ruleBuilder';

type TabId = 'ai' | 'appearance' | 'data' | 'security' | 'automations' | 'collaboration' | 'about';

const PROVIDER_ORDER: AiProviderId[] = [
  'gemini',
  'ollama',
  'lmstudio',
  'vllm',
  'openai-compatible',
  'custom-endpoint',
  'disabled',
];

// ─── Provider Card ────────────────────────────────────────────────────────────

interface ProviderUiMeta {
  description: string;
  baseUrlLabel: string;
  baseUrlPlaceholder: string;
  modelPlaceholder: string;
  keyLabel: string;
  keyPlaceholder: string;
  keyHint: string;
  requiresBaseUrl: boolean;
  requiresModel: boolean;
  requiresKey: boolean;
}

const PROVIDER_UI: Record<AiProviderId, ProviderUiMeta> = {
  disabled: {
    description: 'Turns off AI calls. Documents stay editable, but AI actions return a disabled response without contacting a provider.',
    baseUrlLabel: 'Base URL',
    baseUrlPlaceholder: '',
    modelPlaceholder: '',
    keyLabel: 'API Key',
    keyPlaceholder: '',
    keyHint: 'No key is used in disabled mode.',
    requiresBaseUrl: false,
    requiresModel: false,
    requiresKey: false,
  },
  gemini: {
    description: 'Google Gemini API. Requires a Gemini API key; no Base URL is sent from the browser settings.',
    baseUrlLabel: 'Base URL',
    baseUrlPlaceholder: 'Gemini SDK managed endpoint',
    modelPlaceholder: 'e.g. gemini-3.5-flash',
    keyLabel: 'Gemini API Key',
    keyPlaceholder: 'AIza...',
    keyHint: 'Stored only in local browser settings and never returned by MotionAI API responses.',
    requiresBaseUrl: false,
    requiresModel: true,
    requiresKey: true,
  },
  'openai-compatible': {
    description: 'OpenAI or OpenAI-compatible hosted API. Remote endpoints require an API key.',
    baseUrlLabel: 'Base URL',
    baseUrlPlaceholder: PROVIDER_BASE_URLS['openai-compatible'],
    modelPlaceholder: 'e.g. gpt-4o-mini',
    keyLabel: 'API Key',
    keyPlaceholder: 'sk-...',
    keyHint: 'Required for remote endpoints. Local loopback endpoints may use a dummy bearer token.',
    requiresBaseUrl: true,
    requiresModel: true,
    requiresKey: true,
  },
  ollama: {
    description: 'Local Ollama OpenAI-compatible endpoint. Best for local-only traffic when bound to loopback.',
    baseUrlLabel: 'Base URL',
    baseUrlPlaceholder: PROVIDER_BASE_URLS.ollama,
    modelPlaceholder: 'e.g. llama3.1',
    keyLabel: 'Optional API Key',
    keyPlaceholder: 'optional',
    keyHint: 'Usually blank for local Ollama.',
    requiresBaseUrl: true,
    requiresModel: true,
    requiresKey: false,
  },
  lmstudio: {
    description: 'Local LM Studio server using its OpenAI-compatible API.',
    baseUrlLabel: 'Base URL',
    baseUrlPlaceholder: PROVIDER_BASE_URLS.lmstudio,
    modelPlaceholder: 'e.g. local-model',
    keyLabel: 'Optional API Key',
    keyPlaceholder: 'optional',
    keyHint: 'Usually blank for local LM Studio.',
    requiresBaseUrl: true,
    requiresModel: true,
    requiresKey: false,
  },
  vllm: {
    description: 'Self-hosted vLLM OpenAI-compatible server.',
    baseUrlLabel: 'Base URL',
    baseUrlPlaceholder: PROVIDER_BASE_URLS.vllm,
    modelPlaceholder: 'e.g. Qwen/Qwen2.5-Coder-7B-Instruct',
    keyLabel: 'Optional API Key',
    keyPlaceholder: 'optional',
    keyHint: 'Set only if your vLLM gateway requires one.',
    requiresBaseUrl: true,
    requiresModel: true,
    requiresKey: false,
  },
  'custom-endpoint': {
    description: 'Any OpenAI-compatible custom endpoint. Use this for proxies or providers that are not covered above.',
    baseUrlLabel: 'Base URL',
    baseUrlPlaceholder: PROVIDER_BASE_URLS['custom-endpoint'],
    modelPlaceholder: 'model name required by your endpoint',
    keyLabel: 'Optional API Key',
    keyPlaceholder: 'optional provider token',
    keyHint: 'Only sent to the selected endpoint during AI requests; never echoed back by MotionAI.',
    requiresBaseUrl: true,
    requiresModel: true,
    requiresKey: false,
  },
};

interface StatusBadgeProps { configured: boolean; enabled: boolean; disabledMode: boolean; }

function StatusBadge({ configured, enabled, disabledMode }: StatusBadgeProps) {
  if (disabledMode) return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-stone-800 dark:text-stone-300">Disabled</span>;
  if (!enabled) return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-stone-800 dark:text-stone-400">Inactive</span>;
  if (configured) return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400">Configured</span>;
  return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400">Needs setup</span>;
}

interface ProviderCardProps {
  id: AiProviderId;
  config: ProviderConfig;
  isActive: boolean;
  configured: boolean;
  onSelect: () => void;
  onChange: (field: keyof ProviderConfig, value: string | boolean) => void;
  onTest: () => void;
  testStatus: 'idle' | 'testing' | 'ok' | 'error';
  testMessage: string;
}

function ProviderCard({
  id, config, isActive, configured, onSelect, onChange, onTest, testStatus, testMessage,
}: ProviderCardProps) {
  const [showKey, setShowKey] = useState(false);
  const meta = PROVIDER_UI[id];
  const disabledMode = id === 'disabled';
  const canTest = !disabledMode && (id === 'gemini' ? Boolean(config.model && config.apiKey) : Boolean(config.baseUrl && config.model));

  return (
    <div className={cn(
      "rounded-lg border p-4 transition-colors",
      isActive ? "border-purple-400 bg-purple-50/50 dark:bg-purple-950/10" : "border-gray-200 dark:border-stone-700"
    )}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="radio"
            name="activeProvider"
            checked={isActive}
            onChange={onSelect}
            className="accent-purple-600 mt-0.5"
          />
          <span>
            <span className="font-semibold text-sm text-[#37352F] dark:text-[#E3E3E3]">
              {PROVIDER_LABELS[id]}
            </span>
            {isActive && <span className="ml-2 text-xs bg-purple-600 text-white px-1.5 py-0.5 rounded">Active</span>}
            <span className="block text-xs text-gray-500 dark:text-stone-400 mt-1 max-w-xl">{meta.description}</span>
          </span>
        </label>
        <StatusBadge configured={configured} enabled={config.enabled || isActive} disabledMode={disabledMode && isActive} />
      </div>

      {!disabledMode && (
        <div className="space-y-2.5 ml-6">
          <div>
            <label className="block text-xs text-gray-500 dark:text-stone-400 mb-1">
              {meta.baseUrlLabel}{meta.requiresBaseUrl ? ' *' : ''}
            </label>
            <input
              type="url"
              value={config.baseUrl}
              onChange={e => onChange('baseUrl', e.target.value)}
              placeholder={meta.baseUrlPlaceholder}
              disabled={!meta.requiresBaseUrl}
              className="w-full text-sm px-2.5 py-1.5 rounded border border-gray-200 dark:border-stone-600 bg-white dark:bg-stone-800 text-[#37352F] dark:text-[#E3E3E3] focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-stone-400 mb-1">Model{meta.requiresModel ? ' *' : ''}</label>
            <input
              type="text"
              value={config.model}
              onChange={e => onChange('model', e.target.value)}
              placeholder={meta.modelPlaceholder}
              className="w-full text-sm px-2.5 py-1.5 rounded border border-gray-200 dark:border-stone-600 bg-white dark:bg-stone-800 text-[#37352F] dark:text-[#E3E3E3] focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-stone-400 mb-1">{meta.keyLabel}{meta.requiresKey ? ' *' : ''}</label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={config.apiKey}
                onChange={e => onChange('apiKey', e.target.value)}
                placeholder={meta.keyPlaceholder}
                className="w-full text-sm px-2.5 py-1.5 pr-8 rounded border border-gray-200 dark:border-stone-600 bg-white dark:bg-stone-800 text-[#37352F] dark:text-[#E3E3E3] focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
              <button
                type="button"
                onClick={() => setShowKey(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-stone-300"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="text-[11px] text-gray-400 dark:text-stone-500 mt-1">{meta.keyHint}</p>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={onTest}
              disabled={testStatus === 'testing' || !canTest}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-gray-200 dark:border-stone-600 bg-white dark:bg-stone-800 text-gray-600 dark:text-stone-300 hover:bg-gray-50 dark:hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {testStatus === 'testing' ? <Loader size={11} className="animate-spin" /> : null}
              {testStatus === 'ok' ? <CheckCircle size={11} className="text-green-500" /> : null}
              {testStatus === 'error' ? <XCircle size={11} className="text-red-500" /> : null}
              Test Connection
            </button>
            {testMessage && (
              <span className={cn(
                "text-xs",
                testStatus === 'ok' ? "text-green-600 dark:text-green-400" :
                testStatus === 'error' ? "text-red-600 dark:text-red-400" : "text-gray-500"
              )}>
                {testMessage.length > 80 ? testMessage.slice(0, 80) + '…' : testMessage}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── AI Tab ───────────────────────────────────────────────────────────────────

function AiTab() {
  const { settings, updateSettings, localMode } = useSettings();
  const [testStates, setTestStates] = useState<Record<AiProviderId, { status: 'idle' | 'testing' | 'ok' | 'error'; message: string }>>({} as any);

  const handleChange = useCallback((id: AiProviderId, field: keyof ProviderConfig, value: string | boolean) => {
    updateSettings({
      providers: {
        ...settings.providers,
        [id]: { ...settings.providers[id], [field]: value },
      },
    });
  }, [settings.providers, updateSettings]);

  const handleTest = useCallback(async (id: AiProviderId) => {
    const config = settings.providers[id];
    setTestStates(prev => ({ ...prev, [id]: { status: 'testing', message: '' } }));
    try {
      const { motionAiFetch } = await import('../lib/apiClient');
      const res = await motionAiFetch('/api/ai/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ai: {
            provider: id === 'disabled' ? 'disabled' : id,
            baseUrl: config.baseUrl,
            model: config.model,
            apiKey: config.apiKey,
          },
        }),
      });
      const data = await res.json();
      setTestStates(prev => ({
        ...prev,
        [id]: { status: data.ok ? 'ok' : 'error', message: data.message || (data.ok ? 'Connected' : 'Failed') },
      }));
    } catch {
      setTestStates(prev => ({ ...prev, [id]: { status: 'error', message: 'Network error' } }));
    }
  }, [settings.providers]);

  const setActiveProvider = (id: AiProviderId) => {
    updateSettings({
      activeProvider: id,
      providers: {
        ...settings.providers,
        [id]: { ...settings.providers[id], enabled: id !== 'disabled' },
      },
    });
  };

  const isConfigured = (id: AiProviderId): boolean => {
    if (id === 'disabled') return true;
    const config = settings.providers[id];
    if (!config) return false;
    if (id === 'gemini') return Boolean(config.model && config.apiKey);
    const hasEndpoint = Boolean(config.baseUrl && config.model);
    if (id === 'openai-compatible' && !/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])/i.test(config.baseUrl)) {
      return hasEndpoint && Boolean(config.apiKey);
    }
    return hasEndpoint;
  };

  return (
    <div className="space-y-4">
      {localMode && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
          <span className="text-amber-500 mt-0.5 shrink-0">⚠️</span>
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Running in local mode</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              No external AI API keys configured. Set up a provider below (e.g. Ollama at localhost) to enable AI features.
            </p>
          </div>
        </div>
      )}
      {PROVIDER_ORDER.map(id => (
        <ProviderCard
          key={id}
          id={id}
          config={settings.providers[id]}
          isActive={settings.activeProvider === id}
          configured={isConfigured(id)}
          onSelect={() => setActiveProvider(id)}
          onChange={(field, value) => handleChange(id, field, value)}
          onTest={() => handleTest(id)}
          testStatus={testStates[id]?.status || 'idle'}
          testMessage={testStates[id]?.message || ''}
        />
      ))}
    </div>
  );
}

// ─── Appearance Tab ────────────────────────────────────────────────────────────

function AppearanceTab() {
  const { settings, updateSettings } = useSettings();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-[#37352F] dark:text-[#E3E3E3] mb-3">Theme</h3>
        <div className="flex gap-3">
          <button
            onClick={() => {
              const isDark = document.documentElement.classList.contains('dark');
              if (isDark) {
                document.documentElement.classList.remove('dark');
                localStorage.setItem('motion_ai_dark_mode', 'false');
              }
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-stone-600 bg-white dark:bg-stone-800 text-sm hover:bg-gray-50 dark:hover:bg-stone-700 transition-colors"
          >
            <span className="text-lg" role="img" aria-label="Light">☀️</span> Light
          </button>
          <button
            onClick={() => {
              const isDark = document.documentElement.classList.contains('dark');
              if (!isDark) {
                document.documentElement.classList.add('dark');
                localStorage.setItem('motion_ai_dark_mode', 'true');
              }
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-stone-600 bg-white dark:bg-stone-800 text-sm hover:bg-gray-50 dark:hover:bg-stone-700 transition-colors"
          >
            <span className="text-lg" role="img" aria-label="Dark">🌙</span> Dark
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-[#37352F] dark:text-[#E3E3E3] mb-3">Font Size</h3>
        <div className="flex gap-2">
          {(['small', 'medium', 'large'] as const).map(size => (
            <button
              key={size}
              onClick={() => updateSettings({ appearance: { ...settings.appearance, fontSize: size } })}
              className={cn(
                "px-4 py-2 rounded-lg border text-sm transition-colors capitalize",
                settings.appearance.fontSize === size
                  ? "border-purple-500 bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300"
                  : "border-gray-200 dark:border-stone-600 bg-white dark:bg-stone-800 text-gray-600 dark:text-stone-300 hover:bg-gray-50 dark:hover:bg-stone-700"
              )}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-[#37352F] dark:text-[#E3E3E3] mb-3">Line Height</h3>
        <div className="flex gap-2">
          {(['compact', 'comfortable'] as const).map(lh => (
            <button
              key={lh}
              onClick={() => updateSettings({ appearance: { ...settings.appearance, lineHeight: lh } })}
              className={cn(
                "px-4 py-2 rounded-lg border text-sm transition-colors capitalize",
                settings.appearance.lineHeight === lh
                  ? "border-purple-500 bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300"
                  : "border-gray-200 dark:border-stone-600 bg-white dark:bg-stone-800 text-gray-600 dark:text-stone-300 hover:bg-gray-50 dark:hover:bg-stone-700"
              )}
            >
              {lh}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Data Tab ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatLastSaved(timestamp: number | null): string {
  if (!timestamp) return 'Unknown';
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getTtsCacheSize(): Promise<number> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open('motionai_tts_cache', 1);
      request.onerror = () => resolve(0);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('audio_blobs')) {
          db.close();
          resolve(0);
          return;
        }
        const transaction = db.transaction('audio_blobs', 'readonly');
        const store = transaction.objectStore('audio_blobs');
        const cursorRequest = store.openCursor();
        let totalSize = 0;
        cursorRequest.onsuccess = (event: any) => {
          const cursor = event.target.result;
          if (cursor) {
            const blob = cursor.value;
            if (blob instanceof Blob) {
              totalSize += blob.size;
            }
            cursor.continue();
          } else {
            db.close();
            resolve(totalSize);
          }
        };
        cursorRequest.onerror = () => {
          db.close();
          resolve(0);
        };
      };
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('audio_blobs')) {
          db.createObjectStore('audio_blobs');
        }
      };
    } catch (e) {
      resolve(0);
    }
  });
}

function clearTtsCache(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open('motionai_tts_cache', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('audio_blobs')) {
          db.close();
          resolve();
          return;
        }
        const transaction = db.transaction('audio_blobs', 'readwrite');
        const store = transaction.objectStore('audio_blobs');
        const clearRequest = store.clear();
        clearRequest.onsuccess = () => {
          db.close();
          resolve();
        };
        clearRequest.onerror = () => {
          db.close();
          reject(clearRequest.error);
        };
      };
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('audio_blobs')) {
          db.createObjectStore('audio_blobs');
        }
      };
    } catch (e) {
      reject(e);
    }
  });
}

function DataTab() {
  const [storageEstimate, setStorageEstimate] = useState<string>('');
  const [pageCount, setPageCount] = useState<number>(0);
  const [blockCount, setBlockCount] = useState<number>(0);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [ttsCacheSize, setTtsCacheSize] = useState<number>(0);
  const [isClearingTts, setIsClearingTts] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  function handleCsvImportClick() {
    csvInputRef.current?.click();
  }

  async function handleCsvFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const result = csvExportToWorkspace(text);
      
      const snapshot = await loadWorkspace();
      const existingPages = snapshot?.pages || [];
      const updatedPages = [...existingPages, ...result.snapshot.pages];
      
      await saveWorkspace({
        pages: updatedPages,
        currentPageId: result.snapshot.currentPageId || snapshot?.currentPageId || null
      });

      alert(`Successfully imported ${result.snapshot.pages.length} pages/tasks from CSV.`);
      window.location.reload();
    } catch (e) {
      alert('Failed to import CSV: ' + (e instanceof Error ? e.message : String(e)));
    }
  }

  useEffect(() => {
    estimateStorage();
    loadWorkspaceStats();
    loadTtsCacheSize();
  }, []);

  async function loadTtsCacheSize() {
    try {
      const size = await getTtsCacheSize();
      setTtsCacheSize(size);
    } catch (e) {
      console.error('Failed to load TTS cache size:', e);
    }
  }

  async function handleClearTtsCache() {
    setIsClearingTts(true);
    try {
      await clearTtsCache();
      await loadTtsCacheSize();
    } catch (e) {
      console.error('Failed to clear TTS cache:', e);
      alert('Failed to clear TTS cache');
    } finally {
      setIsClearingTts(false);
    }
  }

  async function estimateStorage() {
    if (navigator.storage && navigator.storage.estimate) {
      const est = await navigator.storage.estimate();
      const used = est.usage || 0;
      setStorageEstimate(formatBytes(used));
    } else {
      setStorageEstimate('Unknown');
    }
  }

  async function loadWorkspaceStats() {
    const snapshot = await loadWorkspace();
    if (snapshot) {
      setPageCount(snapshot.pages.length);
      const totalBlocks = snapshot.pages.reduce((acc, page) => acc + page.blocks.length, 0);
      setBlockCount(totalBlocks);
      const mostRecent = snapshot.pages.reduce((max, page) => {
        return page.updatedAt > max ? page.updatedAt : max;
      }, 0);
      setLastSaved(mostRecent || null);
    }
  }

  async function handleExport() {
    const snapshot = await loadWorkspace();
    const result = exportWorkspaceJson(snapshot);
    const blob = new Blob([result.body], { type: result.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const result = importWorkspaceJson(text, { mode: 'append' });
      await saveWorkspace(result.snapshot);
      const warningMsg = result.warnings.length > 0 ? '\n\nWarnings:\n' + result.warnings.slice(0, 3).join('\n') : '';
      if (warningMsg) console.warn('Import warnings:', result.warnings);
      window.location.reload();
    } catch (e) {
      alert('Failed to import workspace: ' + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function handleClearAll() {
    if (deleteInput !== 'DELETE') return;
    localStorage.clear();
    if (navigator.storage && navigator.storage.estimate) {
      const est = await navigator.storage.estimate();
      const dbName = est.quota ? 'open_notion_workspace' : undefined;
      if (dbName && window.indexedDB) {
        window.indexedDB.deleteDatabase(dbName);
      }
    }
    window.location.reload();
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg bg-gray-50 dark:bg-stone-800 border border-gray-200 dark:border-stone-700">
          <p className="text-xs text-gray-500 dark:text-stone-400">Pages</p>
          <p className="text-lg font-semibold text-[#37352F] dark:text-[#E3E3E3]">{pageCount}</p>
        </div>
        <div className="p-3 rounded-lg bg-gray-50 dark:bg-stone-800 border border-gray-200 dark:border-stone-700">
          <p className="text-xs text-gray-500 dark:text-stone-400">Blocks</p>
          <p className="text-lg font-semibold text-[#37352F] dark:text-[#E3E3E3]">{blockCount}</p>
        </div>
        <div className="p-3 rounded-lg bg-gray-50 dark:bg-stone-800 border border-gray-200 dark:border-stone-700">
          <p className="text-xs text-gray-500 dark:text-stone-400">Storage</p>
          <p className="text-lg font-semibold text-[#37352F] dark:text-[#E3E3E3]">{storageEstimate}</p>
        </div>
        <div className="p-3 rounded-lg bg-gray-50 dark:bg-stone-800 border border-gray-200 dark:border-stone-700">
          <p className="text-xs text-gray-500 dark:text-stone-400">Last Saved</p>
          <p className="text-lg font-semibold text-[#37352F] dark:text-[#E3E3E3]">{formatLastSaved(lastSaved)}</p>
        </div>
      </div>

      <div className="space-y-3">
        <button
          onClick={handleExport}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-stone-600 bg-white dark:bg-stone-800 text-sm font-medium text-[#37352F] dark:text-[#E3E3E3] hover:bg-gray-50 dark:hover:bg-stone-700 transition-colors"
        >
          Export Workspace
        </button>
        <button
          onClick={handleImportClick}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-stone-600 bg-white dark:bg-stone-800 text-sm font-medium text-[#37352F] dark:text-[#E3E3E3] hover:bg-gray-50 dark:hover:bg-stone-700 transition-colors"
        >
          Import Workspace
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />

        <button
          onClick={handleCsvImportClick}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-stone-600 bg-white dark:bg-stone-800 text-sm font-medium text-[#37352F] dark:text-[#E3E3E3] hover:bg-gray-50 dark:hover:bg-stone-700 transition-colors"
        >
          Import Database from CSV
        </button>
        <input
          ref={csvInputRef}
          type="file"
          accept=".csv"
          onChange={handleCsvFileChange}
          className="hidden"
        />

        <button
          onClick={() => {
            // Need pages from the snapshot for diagnostics
            loadWorkspace().then(snapshot => {
              if (snapshot) {
                exportDiagnostics(snapshot.pages);
              }
            });
          }}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-stone-600 bg-white dark:bg-stone-800 text-sm font-medium text-[#37352F] dark:text-[#E3E3E3] hover:bg-gray-50 dark:hover:bg-stone-700 transition-colors"
        >
          Export Diagnostics
        </button>
      </div>

      {/* TTS Audio Cache Section */}
      <div className="pt-4 border-t border-gray-200 dark:border-stone-700">
        <h3 className="text-sm font-semibold text-[#37352F] dark:text-[#E3E3E3] mb-3">TTS Audio Cache</h3>
        <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-stone-800 border border-gray-200 dark:border-stone-700 mb-3">
          <div>
            <p className="text-xs text-gray-500 dark:text-stone-400">Cache Size</p>
            <p className="text-lg font-semibold text-[#37352F] dark:text-[#E3E3E3]">{formatBytes(ttsCacheSize)}</p>
          </div>
          <button
            onClick={handleClearTtsCache}
            disabled={isClearingTts}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-stone-600 bg-white dark:bg-stone-800 text-xs font-medium text-gray-600 dark:text-stone-300 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50 transition-colors"
          >
            {isClearingTts ? 'Clearing...' : 'Clear TTS Audio Cache'}
          </button>
        </div>
      </div>

      {/* E2EE Encryption Section */}
      <div className="pt-4 border-t border-gray-200 dark:border-stone-700">
        <h3 className="text-sm font-semibold text-[#37352F] dark:text-[#E3E3E3] mb-3">Encryption</h3>
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 mb-3">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            <strong>Important:</strong> Your passphrase is never stored. If you close the browser without unlocking, you must re-enter your passphrase.
          </p>
        </div>
        {isWorkspaceLocked() ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-stone-400">Workspace is currently locked.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-stone-400">Your workspace is currently encrypted with a passphrase.</p>
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-gray-200 dark:border-stone-700">
        <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">Danger Zone</h3>
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
          >
            Clear All Data
          </button>
        ) : (
          <div className="space-y-3 p-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/10">
            <p className="text-xs text-red-600 dark:text-red-400">
              This will permanently delete all pages, settings, and IndexedDB data. Type <strong>DELETE</strong> to confirm.
            </p>
            <input
              type="text"
              value={deleteInput}
              onChange={e => setDeleteInput(e.target.value)}
              placeholder="Type DELETE to confirm"
              className="w-full text-sm px-2.5 py-1.5 rounded border border-red-200 dark:border-red-900 bg-white dark:bg-stone-800 text-red-600 dark:text-red-400 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
            <div className="flex gap-2">
              <button
                onClick={handleClearAll}
                disabled={deleteInput !== 'DELETE'}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Confirm Delete
              </button>
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteInput(''); }}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded border border-gray-200 dark:border-stone-600 bg-white dark:bg-stone-800 text-xs font-medium text-gray-600 dark:text-stone-300 hover:bg-gray-50 dark:hover:bg-stone-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SecurityTab() {
  const [pin, setPinInput] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [message, setMessage] = useState('');
  const [configured, setConfigured] = useState(() => hasPin());
  const [inactivityTimeout, setInactivityTimeout] = useState(() => getInactivityTimeoutMs());

  const handleSavePin = async () => {
    setMessage('');
    if (!/^\d{6}$/.test(pin)) {
      setMessage('PIN must be exactly 6 digits.');
      return;
    }
    if (pin !== confirmPin) {
      setMessage('PIN entries do not match.');
      return;
    }
    await setPin(pin);
    setPinInput('');
    setConfirmPin('');
    setConfigured(true);
    setInactivityTimeout(getInactivityTimeoutMs());
    window.dispatchEvent(new CustomEvent('motionai-local-auth-settings-change'));
    setMessage('Local PIN enabled. The app will lock on the next session or when you lock it now.');
  };

  const handleClearPin = () => {
    clearPin();
    setConfigured(false);
    setInactivityTimeout(0);
    window.dispatchEvent(new CustomEvent('motionai-local-auth-settings-change'));
    setMessage('Local PIN disabled on this device.');
  };

  const handleLockNow = () => {
    lock();
    window.dispatchEvent(new CustomEvent('motionai-local-lock'));
  };

  const handleInactivityChange = (timeoutMs: number) => {
    try {
      setInactivityTimeoutMs(timeoutMs);
      setInactivityTimeout(timeoutMs);
      window.dispatchEvent(new CustomEvent('motionai-local-auth-settings-change'));
      setMessage(timeoutMs === 0
        ? 'Inactivity auto-lock disabled.'
        : `Inactivity auto-lock set to ${formatInactivityTimeout(timeoutMs)}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update inactivity auto-lock.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-[#37352F] dark:text-[#E3E3E3] mb-2">Local app PIN lock</h3>
        <p className="text-xs text-gray-500 dark:text-stone-400">
          Adds a device-local 6 digit PIN gate for the browser app. This is a local privacy lock, not a
          replacement for OS login, disk encryption, or production multi-user permissions.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-stone-700 p-4 space-y-3">
        <div className="text-sm font-medium text-[#37352F] dark:text-[#E3E3E3]">
          Status: {configured ? 'PIN enabled' : 'PIN not configured'}
        </div>
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={pin}
          onChange={event => setPinInput(event.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="New 6 digit PIN"
          className="w-full text-sm px-3 py-2 rounded border border-gray-200 dark:border-stone-600 bg-white dark:bg-stone-800 text-[#37352F] dark:text-[#E3E3E3]"
        />
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={confirmPin}
          onChange={event => setConfirmPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="Confirm PIN"
          className="w-full text-sm px-3 py-2 rounded border border-gray-200 dark:border-stone-600 bg-white dark:bg-stone-800 text-[#37352F] dark:text-[#E3E3E3]"
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleSavePin}
            className="px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium"
          >
            Save PIN
          </button>
          <button
            onClick={handleLockNow}
            disabled={!configured}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-stone-600 text-xs font-medium text-[#37352F] dark:text-[#E3E3E3] disabled:opacity-50"
          >
            Lock now
          </button>
          <button
            onClick={handleClearPin}
            disabled={!configured}
            className="px-3 py-2 rounded-lg border border-red-200 dark:border-red-900 text-xs font-medium text-red-600 dark:text-red-400 disabled:opacity-50"
          >
            Disable PIN
          </button>
        </div>
        {message && <p className="text-xs text-gray-500 dark:text-stone-400">{message}</p>}
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-stone-700 p-4 space-y-3">
        <div>
          <h4 className="text-sm font-medium text-[#37352F] dark:text-[#E3E3E3]">Inactivity auto-lock</h4>
          <p className="text-xs text-gray-500 dark:text-stone-400 mt-1">
            Automatically re-lock this browser session after no keyboard, pointer, touch, or focus activity.
            Requires a local PIN and stays device-local.
          </p>
        </div>
        <select
          value={inactivityTimeout}
          onChange={event => handleInactivityChange(Number(event.target.value))}
          disabled={!configured}
          className="w-full text-sm px-3 py-2 rounded border border-gray-200 dark:border-stone-600 bg-white dark:bg-stone-800 text-[#37352F] dark:text-[#E3E3E3] disabled:opacity-50"
        >
          {INACTIVITY_TIMEOUT_OPTIONS_MS.map(option => (
            <option key={option} value={option}>
              {formatInactivityTimeout(option)}
            </option>
          ))}
        </select>
        {!configured && (
          <p className="text-xs text-amber-600 dark:text-amber-400">Set a 6 digit PIN before enabling inactivity auto-lock.</p>
        )}
      </div>
    </div>
  );
}

function formatInactivityTimeout(timeoutMs: number): string {
  if (timeoutMs === 0) return 'Off';
  const minutes = timeoutMs / 60_000;
  return minutes === 1 ? 'After 1 minute' : `After ${minutes} minutes`;
}

// ─── About Tab ────────────────────────────────────────────────────────────────

function AboutTab() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 p-4 rounded-lg bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20 border border-purple-100 dark:border-purple-900">
        <div className="w-12 h-12 rounded-xl bg-purple-600 flex items-center justify-center text-white text-xl font-bold">M</div>
        <div>
          <h3 className="text-lg font-bold text-[#37352F] dark:text-[#E3E3E3]">MotionAI</h3>
          <p className="text-sm text-gray-500 dark:text-stone-400">Version 0.0.0</p>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <p className="text-gray-600 dark:text-stone-300">
          A high-performance document workspace with multi-provider AI integration, built with React 19, TypeScript, and Tailwind CSS 4.
        </p>
      </div>

      <div className="space-y-2">
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 hover:underline"
        >
          <Github size={14} /> GitHub Repository
        </a>
        <a
          href="https://docs.example.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 hover:underline"
        >
          <ExternalLink size={14} /> Documentation
        </a>
      </div>

      <div className="pt-4 border-t border-gray-200 dark:border-stone-700">
        <p className="text-xs text-gray-400 dark:text-stone-500">
          Licensed under Apache 2.0
        </p>
      </div>
    </div>
  );
}

// ─── Settings Modal ────────────────────────────────────────────────────────────


// ─── Automations Tab ──────────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<TriggerType, string> = {
  'status-change': 'Status Change',
  'due-date': 'Due Date',
  'new-page': 'New Page',
  'new-task': 'New Task',
  'mention': 'Mention',
  'webhook': 'Webhook',
  'scheduled': 'Scheduled',
};

const ACTION_LABELS: Record<ActionType, string> = {
  'create-task': 'Create Task',
  'update-task': 'Update Task',
  'append-block': 'Append Block',
  'send-webhook': 'Send Webhook',
  'run-script': 'Run Script',
  'ai-classify': 'AI Classify',
  'ai-summarize': 'AI Summarize',
};

const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  'equals': '=',
  'not-equals': '≠',
  'contains': 'contains',
  'greater-than': '>',
  'less-than': '<',
};

function AutomationsTab() {
  const [rules, setRules] = useState<Rule[]>(() => loadRules());
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [expandedRule, setExpandedRule] = useState<string | null>(null);

  const refreshRules = useCallback(() => setRules(loadRules()), []);

  const handleToggle = useCallback((id: string) => {
    toggleRule(id);
    refreshRules();
  }, [refreshRules]);

  const handleDelete = useCallback((id: string) => {
    deleteRule(id);
    refreshRules();
    if (editingRule?.id === id) setEditingRule(null);
    if (expandedRule === id) setExpandedRule(null);
  }, [refreshRules, editingRule, expandedRule]);

  const handleCreateDefault = useCallback((factory: () => Rule) => {
    factory();
    refreshRules();
    setShowNewForm(false);
  }, [refreshRules]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#37352F] dark:text-[#E3E3E3]">Automation Rules</h3>
          <p className="text-xs text-gray-500 dark:text-stone-400 mt-0.5">
            Trigger → Conditions → Action pipelines that run locally on workspace events.
          </p>
        </div>
        <button
          onClick={() => setShowNewForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors"
        >
          <Plus size={14} />
          New Rule
        </button>
      </div>

      {/* New Rule Quick-Add */}
      {showNewForm && (
        <div className="p-4 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-purple-700 dark:text-purple-300">Quick-start templates</p>
            <button onClick={() => setShowNewForm(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-stone-200">
              <X size={14} />
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleCreateDefault(defaultStatusChangeRule)}
              className="flex-1 p-3 rounded-lg border border-purple-200 dark:border-purple-700 bg-white dark:bg-[#252525] text-left hover:border-purple-400 dark:hover:border-purple-500 transition-colors"
            >
              <div className="flex items-center gap-1.5 text-xs font-medium text-[#37352F] dark:text-[#E3E3E3]">
                <Zap size={12} className="text-purple-500" /> Status Change Webhook
              </div>
              <p className="text-[10px] text-gray-500 dark:text-stone-400 mt-1">Send a webhook when a task status changes.</p>
            </button>
            <button
              onClick={() => handleCreateDefault(defaultDueDateRule)}
              className="flex-1 p-3 rounded-lg border border-purple-200 dark:border-purple-700 bg-white dark:bg-[#252525] text-left hover:border-purple-400 dark:hover:border-purple-500 transition-colors"
            >
              <div className="flex items-center gap-1.5 text-xs font-medium text-[#37352F] dark:text-[#E3E3E3]">
                <Clock size={12} className="text-purple-500" /> Due Date Reminder
              </div>
              <p className="text-[10px] text-gray-500 dark:text-stone-400 mt-1">Auto-create reminder task before due dates.</p>
            </button>
          </div>
          <RuleEditForm
            onSave={(name, trigger, conditions, actions, desc) => {
              createRule(name, trigger, conditions, actions, desc);
              refreshRules();
              setShowNewForm(false);
            }}
            onCancel={() => setShowNewForm(false)}
          />
        </div>
      )}

      {/* Rules List */}
      {rules.length === 0 && !showNewForm ? (
        <div className="text-center py-10">
          <Zap size={32} className="mx-auto text-gray-300 dark:text-stone-600 mb-2" />
          <p className="text-sm text-gray-500 dark:text-stone-400">No automation rules yet</p>
          <p className="text-xs text-gray-400 dark:text-stone-500 mt-0.5">Create your first rule to automate repetitive work.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map(rule => (
            <div
              key={rule.id}
              className={cn(
                'rounded-xl border transition-colors',
                rule.enabled
                  ? 'border-gray-200 dark:border-stone-700 bg-white dark:bg-[#252525]'
                  : 'border-gray-100 dark:border-stone-800 bg-gray-50/50 dark:bg-stone-900/30 opacity-60'
              )}
            >
              {/* Rule Header */}
              <div className="flex items-center gap-3 px-4 py-3">
                <button
                  onClick={() => handleToggle(rule.id)}
                  className="shrink-0 text-gray-400 hover:text-purple-500 dark:hover:text-purple-400 transition-colors"
                  title={rule.enabled ? 'Disable rule' : 'Enable rule'}
                >
                  {rule.enabled ? <ToggleRight size={20} className="text-purple-500" /> : <ToggleLeft size={20} />}
                </button>
                <button
                  onClick={() => setExpandedRule(expandedRule === rule.id ? null : rule.id)}
                  className="flex-1 flex items-center gap-2 text-left min-w-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[#37352F] dark:text-[#E3E3E3] truncate">{rule.name}</span>
                      <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium">
                        {TRIGGER_LABELS[rule.trigger.type]}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 dark:text-stone-500 truncate mt-0.5">
                      {rule.conditions.length} condition{rule.conditions.length !== 1 ? 's' : ''}
                      {' → '}
                      {rule.actions.length} action{rule.actions.length !== 1 ? 's' : ''}
                      {rule.runCount > 0 && ` • Ran ${rule.runCount}×`}
                    </p>
                  </div>
                  {expandedRule === rule.id ? <ChevronDown size={14} className="shrink-0 text-gray-400" /> : <ChevronRight size={14} className="shrink-0 text-gray-400" />}
                </button>
                <button
                  onClick={() => handleDelete(rule.id)}
                  className="shrink-0 p-1 rounded text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  title="Delete rule"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Expanded Detail */}
              {expandedRule === rule.id && (
                <div className="px-4 pb-4 pt-0 border-t border-gray-100 dark:border-stone-700 space-y-3">
                  {rule.description && (
                    <p className="text-xs text-gray-500 dark:text-stone-400 mt-3">{rule.description}</p>
                  )}

                  {/* Trigger */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-stone-500 mb-1">Trigger</p>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium">
                        {TRIGGER_LABELS[rule.trigger.type]}
                      </span>
                      {Object.entries(rule.trigger.config).map(([k, v]) => (
                        <span key={k} className="text-gray-500 dark:text-stone-400">
                          {k}: <code className="text-[11px] px-1 py-0.5 rounded bg-gray-100 dark:bg-stone-800">{String(v)}</code>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Conditions */}
                  {rule.conditions.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-stone-500 mb-1">
                        Conditions ({rule.conditions.length})
                      </p>
                      <div className="space-y-1">
                        {rule.conditions.map((cond, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs">
                            <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-stone-800 text-[#37352F] dark:text-[#E3E3E3]">{cond.field}</code>
                            <span className="text-gray-400 font-mono">{OPERATOR_LABELS[cond.operator]}</span>
                            <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-stone-800 text-[#37352F] dark:text-[#E3E3E3]">{String(cond.value)}</code>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-stone-500 mb-1">
                      Actions ({rule.actions.length})
                    </p>
                    <div className="space-y-1">
                      {rule.actions.map((action, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs">
                          <Play size={10} className="text-green-500 shrink-0" />
                          <span className="px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-medium">
                            {ACTION_LABELS[action.type]}
                          </span>
                          {Object.entries(action.config).filter(([k]) => k !== 'url' || String(action.config[k]).length > 0).map(([k, v]) => (
                            <span key={k} className="text-gray-500 dark:text-stone-400 truncate">
                              {k}: <code className="text-[11px] px-1 py-0.5 rounded bg-gray-100 dark:bg-stone-800">{String(v).substring(0, 40)}{String(v).length > 40 ? '…' : ''}</code>
                            </span>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Edit button and metadata */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => setEditingRule(editingRule?.id === rule.id ? null : rule)}
                      className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
                    >
                      <Edit3 size={11} />
                      {editingRule?.id === rule.id ? 'Cancel Edit' : 'Edit'}
                    </button>
                    <span className="text-[10px] text-gray-400 dark:text-stone-500">
                      Created {new Date(rule.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Inline Edit Form */}
                  {editingRule?.id === rule.id && (
                    <RuleEditForm
                      initialName={rule.name}
                      initialDescription={rule.description}
                      initialTrigger={rule.trigger}
                      initialConditions={rule.conditions}
                      initialActions={rule.actions}
                      onSave={(name, trigger, conditions, actions, desc) => {
                        updateRule(rule.id, { name, trigger, conditions, actions, description: desc });
                        refreshRules();
                        setEditingRule(null);
                      }}
                      onCancel={() => setEditingRule(null)}
                    />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <hr className="my-4 border-gray-100 dark:border-stone-700" />
      <AutomationHistoryPanel />
    </div>
  );
}


// ─── Collaboration Tab ────────────────────────────────────────────────────────

function CollaborationTab() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-[#37352F] dark:text-[#E3E3E3]">Collaboration & WebRTC</h3>
        <p className="text-xs text-gray-500 dark:text-stone-400 mt-0.5">
          Configure ICE/STUN/TURN servers for WebRTC peer-to-peer document sync.
        </p>
      </div>
      <StunTurnConfig />
    </div>
  );
}


// ─── Rule Edit Form ────────────────────────────────────────────────────────────

interface RuleEditFormProps {
  initialName?: string;
  initialDescription?: string;
  initialTrigger?: import('../lib/automations/ruleBuilder').Trigger;
  initialConditions?: import('../lib/automations/ruleBuilder').Condition[];
  initialActions?: import('../lib/automations/ruleBuilder').Action[];
  onSave: (name: string, trigger: import('../lib/automations/ruleBuilder').Trigger, conditions: import('../lib/automations/ruleBuilder').Condition[], actions: import('../lib/automations/ruleBuilder').Action[], description: string) => void;
  onCancel: () => void;
}

function RuleEditForm({ initialName, initialDescription, initialTrigger, initialConditions, initialActions, onSave, onCancel }: RuleEditFormProps) {
  const [name, setName] = useState(initialName || '');
  const [description, setDescription] = useState(initialDescription || '');
  const [triggerType, setTriggerType] = useState<TriggerType>(initialTrigger?.type || 'status-change');
  const [triggerConfig, setTriggerConfig] = useState<Record<string, string>>(() => {
    const cfg: Record<string, string> = {};
    if (initialTrigger?.config) {
      for (const [k, v] of Object.entries(initialTrigger.config)) cfg[k] = String(v);
    }
    return cfg;
  });
  const [conditions, setConditions] = useState<{ field: string; operator: ConditionOperator; value: string }[]>(
    initialConditions?.map(c => ({ field: c.field, operator: c.operator, value: String(c.value) })) || []
  );
  const [actions, setActions] = useState<{ type: ActionType; configStr: string }[]>(
    initialActions?.map(a => ({ type: a.type, configStr: JSON.stringify(a.config) })) || []
  );

  const addCondition = () => setConditions([...conditions, { field: '', operator: 'equals', value: '' }]);
  const removeCondition = (idx: number) => setConditions(conditions.filter((_, i) => i !== idx));
  const updateCondition = (idx: number, update: Partial<typeof conditions[0]>) => {
    setConditions(conditions.map((c, i) => i === idx ? { ...c, ...update } : c));
  };

  const addAction = () => setActions([...actions, { type: 'create-task', configStr: '{}' }]);
  const removeAction = (idx: number) => setActions(actions.filter((_, i) => i !== idx));
  const updateAction = (idx: number, update: Partial<typeof actions[0]>) => {
    setActions(actions.map((a, i) => i === idx ? { ...a, ...update } : a));
  };

  const handleSave = () => {
    if (!name.trim()) return;
    let parsedConfig: Record<string, string | number | boolean> = {};
    try { parsedConfig = JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(triggerConfig).filter(([_, v]) => v !== '')))); } catch { /* keep empty */ }
    const parsedConditions = conditions.filter(c => c.field.trim()).map(c => ({
      field: c.field,
      operator: c.operator,
      value: isNaN(Number(c.value)) ? c.value : Number(c.value),
    }));
    const parsedActions = actions.map(a => {
      let cfg: Record<string, string | number | boolean> = {};
      try { cfg = JSON.parse(a.configStr); } catch { cfg = { _raw: a.configStr }; }
      return { type: a.type, config: cfg };
    });
    onSave(name.trim(), { type: triggerType, config: parsedConfig }, parsedConditions, parsedActions, description.trim());
  };

  const canSave = name.trim().length > 0;

  return (
    <div className="space-y-3 p-3 rounded-lg border border-gray-200 dark:border-stone-700 bg-gray-50/50 dark:bg-stone-900/30">
      {/* Name */}
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-stone-500 block mb-1">Rule Name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Auto-tag new tasks"
          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-stone-600 bg-white dark:bg-[#1C1C1C] text-[#37352F] dark:text-[#E3E3E3] placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
        />
      </div>

      {/* Description */}
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-stone-500 block mb-1">Description (optional)</label>
        <input
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="What this rule does..."
          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-stone-600 bg-white dark:bg-[#1C1C1C] text-[#37352F] dark:text-[#E3E3E3] placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
        />
      </div>

      {/* Trigger */}
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-stone-500 block mb-1">Trigger</label>
        <select
          value={triggerType}
          onChange={e => { setTriggerType(e.target.value as TriggerType); setTriggerConfig({}); }}
          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-stone-600 bg-white dark:bg-[#1C1C1C] text-[#37352F] dark:text-[#E3E3E3] focus:outline-none focus:ring-1 focus:ring-purple-500"
        >
          {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        {/* Trigger-specific config fields */}
        {triggerType === 'status-change' && (
          <input
            type="text"
            value={triggerConfig.status || ''}
            onChange={e => setTriggerConfig({ ...triggerConfig, status: e.target.value })}
            placeholder="Status value to watch (leave empty for any change)"
            className="w-full mt-1 px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-stone-600 bg-white dark:bg-[#1C1C1C] text-[#37352F] dark:text-[#E3E3E3] placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        )}
        {triggerType === 'due-date' && (
          <input
            type="number"
            value={triggerConfig.daysBefore || '1'}
            onChange={e => setTriggerConfig({ ...triggerConfig, daysBefore: e.target.value })}
            placeholder="Days before due date"
            className="w-full mt-1 px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-stone-600 bg-white dark:bg-[#1C1C1C] text-[#37352F] dark:text-[#E3E3E3] placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        )}
        {triggerType === 'webhook' && (
          <input
            type="text"
            value={triggerConfig.path || ''}
            onChange={e => setTriggerConfig({ ...triggerConfig, path: e.target.value })}
            placeholder="Webhook path (e.g. /hooks/github)"
            className="w-full mt-1 px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-stone-600 bg-white dark:bg-[#1C1C1C] text-[#37352F] dark:text-[#E3E3E3] placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        )}
        {triggerType === 'scheduled' && (
          <input
            type="text"
            value={triggerConfig.cron || ''}
            onChange={e => setTriggerConfig({ ...triggerConfig, cron: e.target.value })}
            placeholder="Cron expression (e.g. 0 9 * * 1-5)"
            className="w-full mt-1 px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-stone-600 bg-white dark:bg-[#1C1C1C] text-[#37352F] dark:text-[#E3E3E3] placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        )}
      </div>

      {/* Conditions */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-stone-500">Conditions</label>
          <button onClick={addCondition} className="text-[10px] text-purple-600 dark:text-purple-400 hover:text-purple-700">
            + Add
          </button>
        </div>
        {conditions.length === 0 && (
          <p className="text-[11px] text-gray-400 dark:text-stone-500 italic">No conditions — rule always fires on trigger.</p>
        )}
        <div className="space-y-1.5">
          {conditions.map((cond, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <input
                type="text"
                value={cond.field}
                onChange={e => updateCondition(idx, { field: e.target.value })}
                placeholder="field"
                className="flex-1 px-2 py-1 text-[11px] rounded border border-gray-200 dark:border-stone-600 bg-white dark:bg-[#1C1C1C] text-[#37352F] dark:text-[#E3E3E3] focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
              <select
                value={cond.operator}
                onChange={e => updateCondition(idx, { operator: e.target.value as ConditionOperator })}
                className="w-16 px-1 py-1 text-[11px] rounded border border-gray-200 dark:border-stone-600 bg-white dark:bg-[#1C1C1C] text-[#37352F] dark:text-[#E3E3E3] focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                {Object.entries(OPERATOR_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <input
                type="text"
                value={String(cond.value)}
                onChange={e => updateCondition(idx, { value: e.target.value })}
                placeholder="value"
                className="flex-1 px-2 py-1 text-[11px] rounded border border-gray-200 dark:border-stone-600 bg-white dark:bg-[#1C1C1C] text-[#37352F] dark:text-[#E3E3E3] focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
              <button onClick={() => removeCondition(idx)} className="text-gray-400 hover:text-red-500 shrink-0">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-stone-500">Actions</label>
          <button onClick={addAction} className="text-[10px] text-purple-600 dark:text-purple-400 hover:text-purple-700">
            + Add
          </button>
        </div>
        <div className="space-y-1.5">
          {actions.map((action, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <select
                value={action.type}
                onChange={e => updateAction(idx, { type: e.target.value as ActionType })}
                className="flex-1 px-2 py-1 text-[11px] rounded border border-gray-200 dark:border-stone-600 bg-white dark:bg-[#1C1C1C] text-[#37352F] dark:text-[#E3E3E3] focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                {Object.entries(ACTION_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <input
                type="text"
                value={action.configStr}
                onChange={e => updateAction(idx, { configStr: e.target.value })}
                placeholder='e.g. {"title":"Follow up"}'
                className="flex-[2] px-2 py-1 text-[11px] rounded border border-gray-200 dark:border-stone-600 bg-white dark:bg-[#1C1C1C] text-[#37352F] dark:text-[#E3E3E3] focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
              <button onClick={() => removeAction(idx)} className="text-gray-400 hover:text-red-500 shrink-0">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={!canSave}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
            canSave
              ? 'bg-purple-600 text-white hover:bg-purple-700'
              : 'bg-gray-200 dark:bg-stone-700 text-gray-400 cursor-not-allowed'
          )}
        >
          {initialName ? 'Save Changes' : 'Create Rule'}
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs font-medium rounded-lg text-gray-600 dark:text-stone-300 hover:bg-gray-100 dark:hover:bg-stone-700 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'ai', label: 'AI Providers' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'data', label: 'Data' },
  { id: 'security', label: 'Security' },
  { id: 'automations', label: 'Automations' },
  { id: 'collaboration', label: 'Collaboration' },
  { id: 'about', label: 'About' },
];

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('ai');
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className="relative w-full max-w-xl max-h-[85vh] flex flex-col rounded-2xl shadow-2xl bg-white dark:bg-[#1C1C1C] border border-gray-200 dark:border-stone-700 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-stone-700 shrink-0">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-purple-600 dark:text-purple-400" />
            <h2 className="text-base font-semibold text-[#37352F] dark:text-[#E3E3E3]">Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-stone-700 text-gray-400 hover:text-gray-600 dark:text-stone-400 dark:hover:text-stone-200 transition-colors"
            aria-label="Close settings"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-stone-700 shrink-0 px-6">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative px-3 py-2.5 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "text-purple-600 dark:text-purple-400"
                  : "text-gray-400 dark:text-stone-400 hover:text-gray-600 dark:hover:text-stone-200"
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 dark:bg-purple-400 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'ai' && <AiTab />}
          {activeTab === 'appearance' && <AppearanceTab />}
          {activeTab === 'data' && <DataTab />}
          {activeTab === 'security' && <SecurityTab />}
          {activeTab === 'automations' && <AutomationsTab />}
          {activeTab === 'about' && <AboutTab />}
          {activeTab === 'collaboration' && <CollaborationTab />}
        </div>
      </div>
    </div>,
    document.body
  );
}
