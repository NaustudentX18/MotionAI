import { AiProviderId } from './ai/providers';

export interface ProviderConfig {
  enabled: boolean;
  baseUrl: string;
  model: string;
  apiKey: string;
}

export interface AppearanceSettings {
  fontSize: 'small' | 'medium' | 'large';
  lineHeight: 'compact' | 'comfortable';
}

export interface MotionAiSettings {
  activeProvider: AiProviderId;
  providers: Record<AiProviderId, ProviderConfig>;
  appearance: AppearanceSettings;
}

export const DEFAULT_PROVIDER_CONFIG: ProviderConfig = {
  enabled: false,
  baseUrl: '',
  model: '',
  apiKey: '',
};

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  fontSize: 'medium',
  lineHeight: 'comfortable',
};

export const DEFAULT_SETTINGS: MotionAiSettings = {
  activeProvider: 'ollama',
  providers: {
    disabled: { ...DEFAULT_PROVIDER_CONFIG, enabled: false },
    gemini: { ...DEFAULT_PROVIDER_CONFIG },
    'openai-compatible': { ...DEFAULT_PROVIDER_CONFIG, baseUrl: 'https://api.openai.com/v1' },
    ollama: { ...DEFAULT_PROVIDER_CONFIG, baseUrl: 'http://localhost:11434/v1' },
    lmstudio: { ...DEFAULT_PROVIDER_CONFIG, baseUrl: 'http://localhost:1234/v1' },
    vllm: { ...DEFAULT_PROVIDER_CONFIG, baseUrl: 'http://localhost:8000/v1' },
    'custom-endpoint': { ...DEFAULT_PROVIDER_CONFIG },
  },
  appearance: { ...DEFAULT_APPEARANCE },
};

export const PROVIDER_BASE_URLS: Record<AiProviderId, string> = {
  disabled: '',
  gemini: '',
  'openai-compatible': 'https://api.openai.com/v1',
  ollama: 'http://localhost:11434/v1',
  lmstudio: 'http://localhost:1234/v1',
  vllm: 'http://localhost:8000/v1',
  'custom-endpoint': 'https://your-provider.example/v1',
};

export const PROVIDER_LABELS: Record<AiProviderId, string> = {
  disabled: 'No AI / Disabled',
  gemini: 'Google Gemini',
  'openai-compatible': 'OpenAI-Compatible',
  ollama: 'Ollama',
  lmstudio: 'LM Studio',
  vllm: 'vLLM',
  'custom-endpoint': 'Custom Endpoint',
};

const STORAGE_KEY = 'motion_ai_settings';

export function loadSettings(): MotionAiSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS, providers: { ...DEFAULT_SETTINGS.providers } };
    const parsed = JSON.parse(raw) as Partial<MotionAiSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      providers: {
        ...DEFAULT_SETTINGS.providers,
        ...(parsed.providers || {}),
      },
      appearance: {
        ...DEFAULT_APPEARANCE,
        ...(parsed.appearance || {}),
      },
    };
  } catch {
    return { ...DEFAULT_SETTINGS, providers: { ...DEFAULT_SETTINGS.providers } };
  }
}

import { keychain } from './keychain';

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

export function saveSettings(settings: MotionAiSettings): void {
  let settingsToSave = settings;
  if (isTauri()) {
    const providersCopy = { ...settings.providers };
    let changed = false;
    for (const [id, config] of Object.entries(providersCopy) as [AiProviderId, ProviderConfig][]) {
      if (config.apiKey && config.apiKey !== '[securely-stored]') {
        changed = true;
        const key = config.apiKey;
        providersCopy[id] = {
          ...config,
          apiKey: '[securely-stored]',
        };
        keychain.storeKey(`ai-key-${id}`, key).catch(err => {
          console.error(`Failed to securely save API key for ${id}:`, err);
        });
      } else if (config.apiKey === '') {
        // Delete key from keychain if user explicitly cleared it
        keychain.deleteKey(`ai-key-${id}`).catch(() => {});
      }
    }
    if (changed) {
      settingsToSave = {
        ...settings,
        providers: providersCopy,
      };
    }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settingsToSave));
}

export function isLocalMode(settings: MotionAiSettings): boolean {
  const active = settings.activeProvider;
  if (active === 'disabled') return true;
  if (active === 'gemini') return false;
  const config = settings.providers[active];
  if (!config) return true;
  return !config.apiKey && /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])/i.test(config.baseUrl);
}

export function applyAppearanceSettings(appearance: AppearanceSettings): void {
  const root = document.documentElement;
  switch (appearance.fontSize) {
    case 'small':
      root.style.setProperty('--font-size-base', '13px');
      break;
    case 'large':
      root.style.setProperty('--font-size-base', '17px');
      break;
    default:
      root.style.setProperty('--font-size-base', '15px');
  }
  switch (appearance.lineHeight) {
    case 'compact':
      root.style.setProperty('--line-height-multiplier', '1.4');
      break;
    default:
      root.style.setProperty('--line-height-multiplier', '1.7');
  }
}
