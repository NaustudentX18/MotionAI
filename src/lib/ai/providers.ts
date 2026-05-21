import { GoogleGenAI, Type } from '@google/genai';

export type AiProviderId = 'disabled' | 'gemini' | 'openai-compatible' | 'ollama' | 'lmstudio' | 'vllm';

export interface AiRequestSettings {
  provider?: string;
  model?: string;
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
  disabled?: boolean;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'model';
  text: string;
}

export interface GenerateOptions {
  systemInstruction?: string;
  jsonSchema?: unknown;
}

export interface AiProviderInfo {
  id: AiProviderId;
  label: string;
  configured: boolean;
  enabled: boolean;
  model?: string;
  baseUrl?: string;
  keysReturned: false;
}

export interface AiClient {
  info: AiProviderInfo;
  generateText(prompt: string | ChatMessage[], options?: GenerateOptions): Promise<string>;
}

const PROVIDER_ALIASES: Record<string, AiProviderId> = {
  none: 'disabled',
  'no-ai': 'disabled',
  'no_ai': 'disabled',
  disabled: 'disabled',
  off: 'disabled',
  gemini: 'gemini',
  google: 'gemini',
  openai: 'openai-compatible',
  'openai-compatible': 'openai-compatible',
  openai_compatible: 'openai-compatible',
  local: 'openai-compatible',
  ollama: 'ollama',
  lmstudio: 'lmstudio',
  'lm-studio': 'lmstudio',
  vllm: 'vllm',
};

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 60_000;

export function getConfiguredProviders(): AiProviderInfo[] {
  return [
    providerInfo('gemini'),
    providerInfo('openai-compatible'),
    providerInfo('ollama'),
    providerInfo('lmstudio'),
    providerInfo('vllm'),
    providerInfo('disabled'),
  ];
}

export function resolveProviderId(input?: string): AiProviderId {
  const normalized = (input || '').trim().toLowerCase();
  if (!normalized) return autoProviderId();
  return PROVIDER_ALIASES[normalized] || 'openai-compatible';
}

export function extractAiSettings(body: any): AiRequestSettings {
  const nested = body?.ai || body?.settings || body?.providerConfig || {};
  return {
    provider: body?.provider ?? nested.provider,
    model: body?.model ?? nested.model,
    baseUrl: body?.baseUrl ?? body?.baseURL ?? nested.baseUrl ?? nested.baseURL,
    apiKey: body?.apiKey ?? nested.apiKey,
    timeoutMs: body?.timeoutMs ?? nested.timeoutMs,
    disabled: body?.disabled ?? nested.disabled,
  };
}

export function createAiClient(settings: AiRequestSettings = {}): AiClient {
  const providerId = settings.disabled ? 'disabled' : resolveProviderId(settings.provider || process.env.AI_PROVIDER);
  if (providerId === 'disabled') return disabledClient(settings);
  if (providerId === 'gemini') return geminiClient(settings);
  return openAiCompatibleClient(providerId, settings);
}

export async function probeAi(settings: AiRequestSettings = {}): Promise<{ ok: boolean; provider: AiProviderInfo; message: string }> {
  const client = createAiClient(settings);
  if (client.info.id === 'disabled') {
    return { ok: true, provider: client.info, message: 'AI is disabled.' };
  }
  if (!client.info.configured) {
    return { ok: false, provider: client.info, message: `${client.info.label} is not configured.` };
  }

  try {
    const text = await client.generateText('Reply with exactly: ok', { systemInstruction: 'Health probe. Keep the response to one token.' });
    return { ok: true, provider: client.info, message: text.trim().slice(0, 120) || 'ok' };
  } catch (error) {
    return { ok: false, provider: client.info, message: safeErrorMessage(error, [settings.apiKey]) };
  }
}

export function safeErrorMessage(error: unknown, extraSecrets: Array<string | undefined> = []): string {
  const raw = error instanceof Error ? error.message : String(error || 'Unknown AI provider error');
  let cleaned = raw;
  for (const secret of [...knownSecrets(), ...extraSecrets]) {
    if (secret) cleaned = cleaned.split(secret).join('[redacted]');
  }
  cleaned = cleaned.replace(/(api[_-]?key|authorization|bearer|token)\s*[:=]\s*[^\s,)]+/gi, '$1=[redacted]');
  return cleaned.slice(0, 300) || 'AI provider request failed.';
}

function autoProviderId(): AiProviderId {
  const configured = (process.env.AI_PROVIDER || '').trim();
  if (configured) return resolveProviderId(configured);
  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.OPENAI_BASE_URL || process.env.OPENAI_API_KEY) return 'openai-compatible';
  if (process.env.OLLAMA_BASE_URL) return 'ollama';
  if (process.env.LM_STUDIO_BASE_URL) return 'lmstudio';
  if (process.env.VLLM_BASE_URL) return 'vllm';
  return 'disabled';
}

function providerInfo(id: AiProviderId, settings: AiRequestSettings = {}): AiProviderInfo {
  if (id === 'disabled') {
    return { id, label: 'No AI / disabled', configured: true, enabled: false, keysReturned: false };
  }

  if (id === 'gemini') {
    const model = settings.model || process.env.GEMINI_MODEL || 'gemini-3.5-flash';
    return {
      id,
      label: 'Google Gemini',
      configured: Boolean(settings.apiKey || process.env.GEMINI_API_KEY),
      enabled: true,
      model,
      keysReturned: false,
    };
  }

  const { baseUrl, model } = openAiCompatibleConfig(id, settings);
  const requiresKey = id === 'openai-compatible' && !isLocalBaseUrl(baseUrl);
  return {
    id,
    label: providerLabel(id),
    configured: Boolean(baseUrl && model && (!requiresKey || settings.apiKey || process.env.OPENAI_API_KEY)),
    enabled: true,
    model,
    baseUrl,
    keysReturned: false,
  };
}

function providerLabel(id: AiProviderId): string {
  switch (id) {
    case 'ollama': return 'Ollama';
    case 'lmstudio': return 'LM Studio';
    case 'vllm': return 'vLLM';
    default: return 'OpenAI-compatible';
  }
}

function disabledClient(settings: AiRequestSettings): AiClient {
  return {
    info: providerInfo('disabled', settings),
    async generateText() {
      throw new Error('AI is disabled. Choose a configured provider to enable AI features.');
    },
  };
}

function geminiClient(settings: AiRequestSettings): AiClient {
  const info = providerInfo('gemini', settings);
  const apiKey = settings.apiKey || process.env.GEMINI_API_KEY;
  const model = settings.model || info.model || 'gemini-3.5-flash';

  return {
    info,
    async generateText(prompt, options = {}) {
      if (!apiKey) throw new Error('Gemini provider is not configured. Set GEMINI_API_KEY or pass a request apiKey.');
      const ai = new GoogleGenAI({ apiKey });
      const response = await withTimeout(
        ai.models.generateContent({
          model,
          contents: toGeminiContents(prompt),
          config: {
            systemInstruction: options.systemInstruction,
            ...(options.jsonSchema ? {
              responseMimeType: 'application/json',
              responseSchema: options.jsonSchema,
            } : {}),
          },
        }),
        timeoutMs(settings),
      );
      return response.text || '';
    },
  };
}

function openAiCompatibleClient(id: AiProviderId, settings: AiRequestSettings): AiClient {
  const info = providerInfo(id, settings);
  const { baseUrl, model, apiKey } = openAiCompatibleConfig(id, settings);

  return {
    info,
    async generateText(prompt, options = {}) {
      if (!baseUrl || !model) throw new Error(`${providerLabel(id)} provider is not configured.`);
      const messages = toOpenAiMessages(prompt, options.systemInstruction);
      if (options.jsonSchema) {
        messages.push({ role: 'user', content: 'Return only valid JSON. Do not wrap the JSON in markdown.' });
      }

      const response = await fetchWithTimeout(`${trimTrailingSlash(baseUrl)}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey || 'local-ai'}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.2,
          ...(options.jsonSchema ? { response_format: { type: 'json_object' } } : {}),
        }),
      }, timeoutMs(settings));

      if (!response.ok) {
        throw new Error(`${providerLabel(id)} request failed with HTTP ${response.status}.`);
      }

      const data = await response.json();
      return data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || '';
    },
  };
}

function openAiCompatibleConfig(id: AiProviderId, settings: AiRequestSettings): { baseUrl: string; model: string; apiKey?: string } {
  if (id === 'ollama') {
    return {
      baseUrl: settings.baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
      model: settings.model || process.env.OLLAMA_MODEL || process.env.OPENAI_MODEL || 'llama3.1',
      apiKey: settings.apiKey || process.env.OLLAMA_API_KEY || process.env.OPENAI_API_KEY,
    };
  }
  if (id === 'lmstudio') {
    return {
      baseUrl: settings.baseUrl || process.env.LM_STUDIO_BASE_URL || 'http://localhost:1234/v1',
      model: settings.model || process.env.LM_STUDIO_MODEL || process.env.OPENAI_MODEL || 'local-model',
      apiKey: settings.apiKey || process.env.LM_STUDIO_API_KEY || process.env.OPENAI_API_KEY,
    };
  }
  if (id === 'vllm') {
    return {
      baseUrl: settings.baseUrl || process.env.VLLM_BASE_URL || 'http://localhost:8000/v1',
      model: settings.model || process.env.VLLM_MODEL || process.env.OPENAI_MODEL || 'local-model',
      apiKey: settings.apiKey || process.env.VLLM_API_KEY || process.env.OPENAI_API_KEY,
    };
  }
  return {
    baseUrl: settings.baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    model: settings.model || process.env.OPENAI_MODEL || 'gpt-4o-mini',
    apiKey: settings.apiKey || process.env.OPENAI_API_KEY,
  };
}

function timeoutMs(settings: AiRequestSettings): number {
  const raw = Number(settings.timeoutMs || process.env.AI_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.min(raw, MAX_TIMEOUT_MS);
}

async function fetchWithTimeout(url: string, init: RequestInit, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('AI provider request timed out.')), timeout);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function toOpenAiMessages(prompt: string | ChatMessage[], systemInstruction?: string): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
  if (typeof prompt === 'string') {
    messages.push({ role: 'user', content: prompt });
    return messages;
  }
  for (const message of prompt) {
    messages.push({
      role: message.role === 'assistant' || message.role === 'model' ? 'assistant' : message.role === 'system' ? 'system' : 'user',
      content: message.text,
    });
  }
  return messages;
}

function toGeminiContents(prompt: string | ChatMessage[]): any {
  if (typeof prompt === 'string') return prompt;
  return prompt
    .filter(message => message.role !== 'system')
    .map(message => ({
      role: message.role === 'user' ? 'user' : 'model',
      parts: [{ text: message.text }],
    }));
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function isLocalBaseUrl(baseUrl?: string): boolean {
  if (!baseUrl) return false;
  return /^(http:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])/i.test(baseUrl);
}

function knownSecrets(): string[] {
  return [
    process.env.GEMINI_API_KEY,
    process.env.OPENAI_API_KEY,
    process.env.OLLAMA_API_KEY,
    process.env.LM_STUDIO_API_KEY,
    process.env.VLLM_API_KEY,
  ].filter((value): value is string => Boolean(value && value.length > 3));
}

export const spellcheckResponseSchema = {
  type: Type.OBJECT,
  properties: {
    issues: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: 'A unique random string or number index for this issue' },
          word: { type: Type.STRING, description: 'The exact misspelled word' },
          suggestions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'List of 2-3 correct candidate suggestions',
          },
          context: { type: Type.STRING, description: 'The immediate snippet of context containing the word' },
          blockId: { type: Type.STRING, description: 'The exact BlockId associated with this spelling issue' },
        },
        required: ['id', 'word', 'suggestions', 'context', 'blockId'],
      },
    },
  },
  required: ['issues'],
};
