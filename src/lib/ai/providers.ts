import { GoogleGenAI, Type } from '@google/genai';

export type AiProviderId = 'disabled' | 'gemini' | 'openai-compatible' | 'ollama' | 'lmstudio' | 'vllm' | 'custom-endpoint';

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
  custom: 'custom-endpoint',
  'custom-endpoint': 'custom-endpoint',
  custom_endpoint: 'custom-endpoint',
  endpoint: 'custom-endpoint',
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
    providerInfo('custom-endpoint'),
    providerInfo('disabled'),
  ];
}

export function resolveProviderId(input?: string): AiProviderId {
  const normalized = (input || '').trim().toLowerCase();
  if (!normalized) return autoProviderId();
  return PROVIDER_ALIASES[normalized] || 'custom-endpoint';
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
    return { ok: true, provider: client.info, message: 'AI is disabled. No provider call was made.' };
  }
  if (!client.info.configured) {
    return { ok: false, provider: client.info, message: providerUnavailableMessage(client.info) };
  }

  try {
    const text = await client.generateText('Reply with exactly: ok', { systemInstruction: 'Health probe. Keep the response to one token.' });
    return { ok: true, provider: client.info, message: text.trim().slice(0, 120) || 'ok' };
  } catch (error) {
    return { ok: false, provider: client.info, message: safeErrorMessage(error, [settings.apiKey]) };
  }
}

export function providerUnavailableMessage(info: AiProviderInfo): string {
  if (info.id === 'disabled' || !info.enabled) {
    return 'AI is disabled. Choose and configure a provider before using AI features.';
  }
  if (info.id === 'gemini') {
    return 'Google Gemini is not configured. Add a Gemini API key and model name.';
  }
  if (info.id === 'custom-endpoint') {
    return 'Custom endpoint is not configured. Add an OpenAI-compatible base URL and model name.';
  }
  if (info.id === 'openai-compatible' && !isLocalBaseUrl(info.baseUrl)) {
    return 'OpenAI-compatible provider is not configured. Add a base URL, model name, and API key for remote endpoints.';
  }
  return `${info.label} is not configured. Add a base URL and model name.`;
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
      configured: Boolean(model && (settings.apiKey || process.env.GEMINI_API_KEY)),
      enabled: true,
      model,
      keysReturned: false,
    };
  }

  const { baseUrl, model, apiKey } = openAiCompatibleConfig(id, settings);
  const requiresKey = id === 'openai-compatible' && !isLocalBaseUrl(baseUrl);
  return {
    id,
    label: providerLabel(id),
    configured: Boolean(baseUrl && model && (!requiresKey || apiKey)),
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
    case 'custom-endpoint': return 'Custom endpoint';
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
      if (!apiKey) throw new Error(providerUnavailableMessage(info));
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
      if (!baseUrl || !model) throw new Error(providerUnavailableMessage(info));
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
  if (id === 'custom-endpoint') {
    return {
      baseUrl: settings.baseUrl || process.env.CUSTOM_AI_BASE_URL || '',
      model: settings.model || process.env.CUSTOM_AI_MODEL || '',
      apiKey: settings.apiKey || process.env.CUSTOM_AI_API_KEY || process.env.OPENAI_API_KEY,
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
  if (typeof window === 'undefined') {
    const { assertAllowedFetchUrl } = await import('../ssrfGuard');
    assertAllowedFetchUrl(url, 'AI provider base URL');
  }
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
    process.env.CUSTOM_AI_API_KEY,
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

export const checklistResponseSchema = {
  type: Type.OBJECT,
  properties: {
    tasks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: 'Action item description' },
          assignee: { type: Type.STRING, description: 'Person assigned (Unassigned if not specified)' },
          dueDate: { type: Type.STRING, description: 'Due date or deadline (No due date if not specified)' },
          priority: { type: Type.STRING, enum: ['low', 'medium', 'high'], description: 'Priority level' },
        },
        required: ['title', 'assignee', 'dueDate', 'priority'],
      },
    },
  },
  required: ['tasks'],
};

export const meetingParserResponseSchema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Concise meeting summary bullets',
    },
    tasks: checklistResponseSchema.properties.tasks,
  },
  required: ['summary', 'tasks'],
};

export function buildGeneratePrompt(command: string | undefined, context: string | undefined, prompt: string | undefined) {
  let systemInstruction = `You are the **MotionAI Core Engine**. You operate as a high-performance document processor. \nYour primary goal is to transform, generate, and refine content within a rich-text workspace. \nYou are NOT a conversational assistant. You are a background utility.\n\n<behavioral_guardrails>\n  <rule priority="1">NEVER use conversational filler. No "Sure," "I can help," or "Here is the output."</rule>\n  <rule priority="2">Respond ONLY with the requested Markdown content.</rule>\n  <rule priority="3">Maintain a "Minimalist Modern" aesthetic: clean, objective, and dense with information.</rule>\n  <rule priority="4">If a command is missing, default to "Improve Writing" based on context.</rule>\n</behavioral_guardrails>\n\n<formatting_standards>\n  - **Typography**: Use **Bold** for high-impact keywords. Use \\\`inline code\\\` for technical identifiers.\n  - **Structure**: Use \\\`###\\\` for sub-headers (H3). Avoid H1/H2 unless the document is long-form.\n  - **Segmentation**: Use \\\`---\\\` (Horizontal Rules) to separate distinct logic blocks.\n  - **Visual Pop**: Use \\\`>\\\` (Blockquotes) for summaries, callouts, or "TL;DR" sections.\n  - **Checklists**: Use \\\`- [ ]\\\` for all task-oriented outputs.\n</formatting_standards>\n\n<technical_context_awareness>\n  The user operates a sophisticated home lab environment:\n  - OS: OpenMediaVault (OMV).\n  - Stack: RADARR, SONARR, Overseerr, SABnzbd, Plex.\n  - Infrastructure: Docker, Port Forwarding, NAS management.\n  When processing technical notes, maintain strict accuracy for Linux paths, YAML syntax, and networking protocols.\n</technical_context_awareness>\n\n[INPUT] -> [PROCESS BY COMMAND] -> [OUTPUT MARKDOWN BLOCK]\nNO PREAMBLE. NO APOLOGIES. NO CHAT.`;

  let userPrompt = prompt || '';

  if (command === 'continue' || prompt?.startsWith('/continue')) {
    systemInstruction += `\n\nExecute command /continue:\n- Read the existing page context.\n- Predict the next logical section.\n- Match tone, vocabulary, and block structure perfectly.`;
    userPrompt = `Context to continue from:\n${context || ''}\n\nPlease continue writing.`;
  } else if (command === 'summarize' || prompt?.startsWith('/summarize')) {
    systemInstruction += `\n\nExecute command /summarize:\n- Output a '> [TL;DR]' callout.\n- Follow with a '### Key Insights' section containing 3-5 bullet points.`;
    userPrompt = `Text to summarize:\n${context || prompt || ''}`;
  } else if (command === 'brainstorm' || prompt?.startsWith('/brainstorm')) {
    systemInstruction += `\n\nExecute command /brainstorm:\n- Generate exactly 10 high-quality, distinct ideas.\n- Format as a bulleted list under an '### Ideation' header.`;
    userPrompt = `Brainstorm ideas for: ${prompt || context || ''}`;
  } else if (command === 'improve' || command === 'fix' || prompt?.startsWith('/fix')) {
    systemInstruction += `\n\nExecute command /fix:\n- Correct grammar, spelling, and punctuation.\n- Preserving technical terminology (especially NAS/Docker/OMV paths).\n- DO NOT rewrite for style unless the flow is broken.`;
    userPrompt = `Improve this text:\n${context || prompt || ''}`;
  } else if (command === 'extract' || prompt?.startsWith('/todo')) {
    systemInstruction += `\n\nExecute command /todo:\n- Extract all verbs and commitments from the provided text.\n- Format as a '- [ ]' checklist.\n- Group by category if more than 10 items are found.`;
    userPrompt = `Extract action items from:\n${context || prompt || ''}`;
  } else if (command === 'table' || prompt?.startsWith('/table')) {
    systemInstruction += `\n\nExecute command /table:\n- Analyze unstructured data (CSV-style, bulleted, or narrative).\n- Build a GitHub-flavored Markdown table.\n- Automatically infer logical headers (e.g., Date, Task, Status, Cost).`;
    userPrompt = `Convert this to table:\n${context || prompt || ''}`;
  } else if (command === 'custom') {
    systemInstruction += `\n\nFollow the user's instructions exactly. Output ONLY the requested content with Structure Over Prose alignment.`;
    userPrompt = `Context (if relevant):\n${context || ''}\n\nTask: ${prompt || ''}`;
  } else {
    userPrompt = prompt || context || '';
  }

  return { systemInstruction, userPrompt };
}

export function parseJsonObject(text: string): any | null {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}
