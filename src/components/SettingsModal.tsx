import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Settings, X, CheckCircle, XCircle, Loader, Github, ExternalLink } from 'lucide-react';
import { AiProviderId } from '../lib/ai/providers';
import { useSettings } from '../hooks/useSettings';
import {
  PROVIDER_LABELS,
  PROVIDER_BASE_URLS,
  ProviderConfig,
} from '../lib/settings';
import { loadWorkspace, saveWorkspace, isWorkspaceLocked, setWorkspaceKey } from '../lib/persistence';
import { Page } from '../types';
import { cn } from '../lib/utils';

type TabId = 'ai' | 'appearance' | 'data' | 'about';

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
      const res = await fetch('/api/ai/probe', {
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

function DataTab() {
  const [storageEstimate, setStorageEstimate] = useState<string>('');
  const [pageCount, setPageCount] = useState<number>(0);
  const [blockCount, setBlockCount] = useState<number>(0);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    estimateStorage();
    loadWorkspaceStats();
  }, []);

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
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'workspace.json';
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
      const data = JSON.parse(text);
      if (Array.isArray(data.pages)) {
        await saveWorkspace({ pages: data.pages as Page[], currentPageId: data.currentPageId || null });
        window.location.reload();
      } else {
        alert('Invalid workspace file');
      }
    } catch {
      alert('Failed to parse workspace file');
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

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'ai', label: 'AI Providers' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'data', label: 'Data' },
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
          {activeTab === 'about' && <AboutTab />}
        </div>
      </div>
    </div>,
    document.body
  );
}
