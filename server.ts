import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import {
  createAiClient,
  extractAiSettings,
  getConfiguredProviders,
  probeAi,
  providerUnavailableMessage,
  safeErrorMessage,
  spellcheckResponseSchema,
  checklistResponseSchema,
  meetingParserResponseSchema,
  buildGeneratePrompt,
  parseJsonObject,
  type ChatMessage,
} from './src/lib/ai/providers';
import { rateLimitMiddleware, shutdownRateLimitStore } from './src/lib/rateLimit';
import { assertAllowedFetchUrl, SsrfBlockedError } from './src/lib/ssrfGuard';

// ─── Presence Signaling Types & Store ────────────────────────────────────────

interface OutgoingSignal {
  to: string;
  from: string;
  type: 'offer' | 'answer' | 'ice-candidate';
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit;
}

interface IncomingSignal {
  from: string;
  type: 'offer' | 'answer' | 'ice-candidate';
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit;
}

interface SignalStoreEntry {
  signals: IncomingSignal[];
  expiresAt: number;
}


interface MeetingTask {
  title: string;
  assignee: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high';
}

interface MeetingParserResult {
  summary: string[];
  tasks: MeetingTask[];
}

function normalizeMeetingPriority(value: unknown): MeetingTask['priority'] {
  return value === 'high' || value === 'low' || value === 'medium' ? value : 'medium';
}

function sanitizeMeetingTask(input: unknown, index: number): MeetingTask | null {
  if (!input || typeof input !== 'object') return null;
  const record = input as Record<string, unknown>;
  const rawTitle = typeof record.title === 'string' ? record.title : '';
  const title = rawTitle.replace(/[\r\n]+/g, ' ').trim().slice(0, 180);
  if (title.length < 3) return null;
  const assignee = (typeof record.assignee === 'string' && record.assignee.trim())
    ? record.assignee.trim().slice(0, 80)
    : 'Unassigned';
  const dueDate = (typeof record.dueDate === 'string' && record.dueDate.trim())
    ? record.dueDate.trim().slice(0, 80)
    : 'No due date';
  return { title: title || `Action item ${index + 1}`, assignee, dueDate, priority: normalizeMeetingPriority(record.priority) };
}

function deterministicMeetingParser(transcript: string): MeetingParserResult {
  const lines = transcript.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const tasks: MeetingTask[] = [];
  const summary: string[] = [];

  for (const line of lines) {
    const cleaned = line.replace(/^[-*\d.)\s]+/, '').trim();
    if (summary.length < 3 && cleaned.length > 8) summary.push(cleaned.slice(0, 180));
    const isTaskLine = /\b(todo|action item|need to|will|follow up|deadline|due|assign|owner)\b/i.test(cleaned);
    if (!isTaskLine) continue;
    let title = cleaned.replace(/^(todo|action item):\s*/i, '').trim();
    let assignee = 'Unassigned';
    const assigneeMatch = title.match(/(?:owner|assignee|assigned to|by):\s*([A-Za-z0-9 _.-]+)/i)
      || title.match(/^([A-Z][A-Za-z0-9_-]+):\s+/)
      || title.match(/\b([A-Z][A-Za-z0-9_-]+)\s+will\s+/);
    if (assigneeMatch) assignee = assigneeMatch[1].trim().slice(0, 80);
    let priority: MeetingTask['priority'] = 'medium';
    if (/\b(urgent|critical|asap|high priority)\b/i.test(title)) priority = 'high';
    if (/\b(low priority|backlog|minor)\b/i.test(title)) priority = 'low';
    let dueDate = 'No due date';
    const dueMatch = title.match(/\b(?:due|by|deadline):?\s*([A-Za-z0-9, /-]+?)(?:[.;]|$)/i);
    if (dueMatch) dueDate = dueMatch[1].trim().slice(0, 80);
    const task = sanitizeMeetingTask({ title, assignee, dueDate, priority }, tasks.length);
    if (task) tasks.push(task);
  }

  if (summary.length === 0) summary.push('Meeting transcript captured for review.');
  if (tasks.length === 0 && transcript.trim()) {
    tasks.push({ title: `Review transcript for action items: ${transcript.trim().slice(0, 80)}`, assignee: 'Unassigned', dueDate: 'No due date', priority: 'medium' });
  }
  return { summary, tasks };
}

function normalizeMeetingParserResult(input: unknown, transcript: string): MeetingParserResult {
  const fallback = deterministicMeetingParser(transcript);
  if (!input || typeof input !== 'object') return fallback;
  const record = input as Record<string, unknown>;
  const summary = Array.isArray(record.summary)
    ? record.summary.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean).slice(0, 6)
    : fallback.summary;
  const tasks = Array.isArray(record.tasks)
    ? record.tasks.map(sanitizeMeetingTask).filter((task): task is MeetingTask => task !== null).slice(0, 25)
    : fallback.tasks;
  return { summary: summary.length ? summary : fallback.summary, tasks: tasks.length ? tasks : fallback.tasks };
}

const signalStore = new Map<string, SignalStoreEntry>();
const webhookReplayStore = new Map<string, number>();
const SIGNAL_TTL_MS = 30_000;
const CLEANUP_INTERVAL_MS = 10_000;
const WEBHOOK_REPLAY_TTL_MS = 5 * 60_000;
const MAX_AI_PROMPT_CHARS = 32_000;

// Non-blocking cleanup of expired signal entries
setInterval(() => {
  const now = Date.now();
  for (const [peerId, entry] of signalStore) {
    if (entry.expiresAt <= now) {
      signalStore.delete(peerId);
    }
  }
  for (const [key, expiresAt] of webhookReplayStore) {
    if (expiresAt <= now) webhookReplayStore.delete(key);
  }
}, CLEANUP_INTERVAL_MS);

function getHeaderValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function matchesMotionAiSecret(provided: string): boolean {
  const secret = process.env.MOTIONAI_API_SECRET;
  if (!secret) return true;
  if (!provided || provided.length !== secret.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided, 'utf8'), Buffer.from(secret, 'utf8'));
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!matchesMotionAiSecret(getHeaderValue(req.headers['x-motionai-secret']))) {
    res.status(401).json({ error: 'Unauthorized', keysReturned: false });
    return;
  }
  next();
}

function requireWebhookAuth(req: Request, res: Response, next: NextFunction): void {
  if (!process.env.MOTIONAI_API_SECRET) {
    res.status(503).json({ error: 'Webhook authentication is not configured.', keysReturned: false });
    return;
  }
  requireAuth(req, res, next);
}

function validateWebhookPath(pathValue: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,127}$/.test(pathValue) && !pathValue.includes('..');
}

function requireWebhookReplayProtection(req: Request, res: Response, next: NextFunction): void {
  const replayId = getHeaderValue(req.headers['x-motionai-delivery']);
  if (!replayId) {
    next();
    return;
  }
  const key = `${req.params.path}:${replayId}`;
  if (webhookReplayStore.has(key)) {
    res.status(409).json({ error: 'Duplicate webhook delivery rejected.', keysReturned: false });
    return;
  }
  webhookReplayStore.set(key, Date.now() + WEBHOOK_REPLAY_TTL_MS);
  next();
}

function promptLengthExceeded(...parts: unknown[]): string | null {
  let total = 0;
  for (const part of parts) {
    if (typeof part === 'string') total += part.length;
    if (total > MAX_AI_PROMPT_CHARS) {
      return `Prompt exceeds ${MAX_AI_PROMPT_CHARS} character limit.`;
    }
  }
  return null;
}

function chatPromptLengthExceeded(message: unknown, history: unknown): string | null {
  let total = 0;
  if (typeof message === 'string') total += message.length;
  if (Array.isArray(history)) {
    for (const entry of history) {
      if (entry && typeof entry === 'object' && typeof (entry as { text?: unknown }).text === 'string') {
        total += (entry as { text: string }).text.length;
      }
    }
  }
  if (total > MAX_AI_PROMPT_CHARS) {
    return `Prompt exceeds ${MAX_AI_PROMPT_CHARS} character limit.`;
  }
  return null;
}

function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = getHeaderValue(req.headers['x-request-id']);
  const requestId = incoming || crypto.randomUUID();
  res.setHeader('X-Request-Id', requestId);
  (req as Request & { requestId?: string }).requestId = requestId;
  next();
}


async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.set('trust proxy', 1);

  // Create uploads directory — outside the if/else so both branches can reference it
  const UPLOADS_DIR = path.join(process.cwd(), 'data', 'uploads');
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  app.use(requestIdMiddleware);
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, status: 'ok', ai: getConfiguredProviders(), keysReturned: false });
  });

  app.get('/api/ai/providers', (_req, res) => {
    res.json({ providers: getConfiguredProviders(), keysReturned: false });
  });

  app.get('/api/ai/status', (_req, res) => {
    res.json({
      configuredProviders: getConfiguredProviders(),
      keysReturned: false,
    });
  });

  app.post('/api/ai/probe', rateLimitMiddleware, requireAuth, async (req, res) => {
    const settings = extractAiSettings(req.body || {});
    const result = await probeAi(settings);
    res.status(result.ok ? 200 : 503).json({ ...result, keysReturned: false });
  });

  app.post('/api/ai/generate', rateLimitMiddleware, requireAuth, async (req, res) => {
    const { command, context, prompt } = req.body || {};
    const lengthError = promptLengthExceeded(command, context, prompt);
    if (lengthError) {
      return res.status(413).json({ error: lengthError, keysReturned: false });
    }
    const settings = extractAiSettings(req.body || {});
    const client = createAiClient(settings);

    if (!client.info.enabled || !client.info.configured) {
      return res.status(503).json({ error: providerUnavailableMessage(client.info), provider: client.info, keysReturned: false });
    }

    try {
      const { systemInstruction, userPrompt } = buildGeneratePrompt(command, context, prompt);
      const text = await client.generateText(userPrompt, { systemInstruction });
      res.json({ text, provider: client.info, keysReturned: false });
    } catch (err) {
      console.error('AI generate endpoint error:', safeErrorMessage(err, [settings.apiKey]));
      res.status(502).json({ error: safeErrorMessage(err, [settings.apiKey]), provider: client.info, keysReturned: false });
    }
  });

  app.post('/api/ai/spellcheck', rateLimitMiddleware, requireAuth, async (req, res) => {
    const settings = extractAiSettings(req.body || {});
    const client = createAiClient(settings);
    if (!client.info.enabled || !client.info.configured) {
      return res.status(503).json({ error: providerUnavailableMessage(client.info), provider: client.info, keysReturned: false });
    }

    const { blocks } = req.body || {};
    if (!blocks || !Array.isArray(blocks)) {
      return res.status(400).json({ error: 'Missing or invalid blocks array' });
    }

    const textBlocks = blocks.filter(b => b.content && b.content.trim() && b.type !== 'divider');
    if (textBlocks.length === 0) {
      return res.json({ issues: [], provider: client.info, keysReturned: false });
    }

    let dataPrompt = 'Analyze the text contents of the following document blocks for spelling and typographical errors. Ignore valid code names, URLs, file paths, specialized jargon, or technical abbreviations unless they are obviously misspellings. Return ONLY valid JSON matching this shape: { "issues": [{ "id": "string", "word": "string", "suggestions": ["string"], "context": "string", "blockId": "string" }] }.\n\nInput Blocks:\n';
    textBlocks.forEach(b => {
      dataPrompt += `[BlockId: ${b.id}]\nText: ${b.content}\n\n`;
    });

    try {
      const resultText = await client.generateText(dataPrompt, {
        systemInstruction: 'You are a precise doc proofreader. Analyze spelling and typos, associate them with the accurate original BlockId, extract the offending word, surrounding context (under 40 characters), and provide 2-3 accurate corrections. Respond ONLY with a valid JSON document matching the specified schema.',
        jsonSchema: spellcheckResponseSchema,
      });
      const parsed = parseJsonObject(resultText) || { issues: [] };
      res.json({ issues: Array.isArray(parsed.issues) ? parsed.issues : [], provider: client.info, keysReturned: false });
    } catch (err) {
      console.error('Spellcheck API error:', safeErrorMessage(err, [settings.apiKey]));
      res.status(502).json({ error: safeErrorMessage(err, [settings.apiKey]), provider: client.info, keysReturned: false });
    }
  });

  app.post('/api/ai/meeting-parser', rateLimitMiddleware, requireAuth, async (req, res) => {
    const settings = extractAiSettings(req.body || {});
    const client = createAiClient(settings);
    const { transcript } = req.body || {};
    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid transcript parameter', keysReturned: false });
    }

    if (!client.info.enabled || !client.info.configured) {
      return res.json({ ...deterministicMeetingParser(transcript), provider: client.info, source: 'deterministic', keysReturned: false });
    }

    try {
      const resultText = await client.generateText(transcript, {
        systemInstruction: 'You are a meeting-to-tasks parser for MotionAI. Extract concise summary bullets and concrete task objects from the transcript. Return ONLY valid JSON matching: { "summary": ["string"], "tasks": [{ "title": "string", "assignee": "string", "dueDate": "string", "priority": "low|medium|high" }] }. Do not include markdown or explanations.',
        jsonSchema: meetingParserResponseSchema,
      });
      const parsed = parseJsonObject(resultText);
      res.json({ ...normalizeMeetingParserResult(parsed, transcript), provider: client.info, source: 'ai', keysReturned: false });
    } catch (err) {
      console.warn('AI meeting parser failed, falling back to deterministic parser:', safeErrorMessage(err, [settings.apiKey]));
      res.json({ ...deterministicMeetingParser(transcript), provider: client.info, source: 'deterministic-fallback', keysReturned: false });
    }
  });

  app.post('/api/ai/checklist', rateLimitMiddleware, requireAuth, async (req, res) => {
    const settings = extractAiSettings(req.body || {});
    const client = createAiClient(settings);

    const { transcript } = req.body || {};
    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid transcript parameter', keysReturned: false });
    }

    // Helper for deterministic parser fallback
    const deterministicChecklistFallback = (text: string) => {
      const lines = text.split('\n');
      const tasks: Array<{ title: string; assignee: string; dueDate: string; priority: 'low' | 'medium' | 'high' }> = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const isTaskLine =
          trimmed.startsWith('-') ||
          trimmed.startsWith('*') ||
          /^\d+\./.test(trimmed) ||
          /todo/i.test(trimmed) ||
          /action item/i.test(trimmed) ||
          /need to/i.test(trimmed);

        if (isTaskLine) {
          let title = trimmed
            .replace(/^[-*\d.]+\s*(\[[\sX]\])?\s*/i, '')
            .replace(/^(todo|action item):\s*/i, '')
            .trim();

          if (title.length < 5) continue;

          let assignee = 'Unassigned';
          const assigneeMatch = title.match(/(?:assignee|owner|assigned to|for|by):\s*([A-Za-z0-9]+)/i)
            || title.match(/([A-Za-z0-9]+)\s+will\s+/i)
            || title.match(/^([A-Za-z0-9]+):\s+/i);

          if (assigneeMatch) {
            assignee = assigneeMatch[1];
            title = title.replace(new RegExp(`^${assignee}:\\s*`, 'i'), '');
          }

          let priority: 'low' | 'medium' | 'high' = 'medium';
          if (/urgent|high|asap|critical/i.test(title)) {
            priority = 'high';
          } else if (/low|minor|backlog/i.test(title)) {
            priority = 'low';
          }

          let dueDate = 'No due date';
          const dateMatch = title.match(/(?:due|by|deadline):\s*([0-9/\-A-Za-z\s]+?)(?:\.|$|\))/i);
          if (dateMatch) {
            dueDate = dateMatch[1].trim();
          }

          tasks.push({ title, assignee, dueDate, priority });
        }
      }

      if (tasks.length === 0 && text.trim().length > 0) {
        tasks.push({
          title: 'Review transcript for action items: ' + (text.length > 50 ? text.slice(0, 50) + '...' : text),
          assignee: 'Unassigned',
          dueDate: 'No due date',
          priority: 'medium'
        });
      }

      return { tasks };
    };

    if (!client.info.enabled || !client.info.configured) {
      // If AI is disabled/unconfigured, fall back to deterministic parsing
      const fallbackResult = deterministicChecklistFallback(transcript);
      return res.json({ ...fallbackResult, provider: client.info, keysReturned: false });
    }

    try {
      const resultText = await client.generateText(transcript, {
        systemInstruction: 'You are a meeting assistant. Analyze the meeting transcript or notes and convert them into a JSON checklist of tasks. For each task, extract: title (action item description), assignee (default to "Unassigned"), dueDate (default to "No due date"), and priority ("low", "medium", or "high"). Respond ONLY with a valid JSON document matching the specified schema.',
        jsonSchema: checklistResponseSchema,
      });

      const parsed = parseJsonObject(resultText) || { tasks: [] };
      res.json({ tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [], provider: client.info, keysReturned: false });
    } catch (err) {
      console.warn('AI checklist generation failed, falling back to deterministic parser:', safeErrorMessage(err, [settings.apiKey]));
      const fallbackResult = deterministicChecklistFallback(transcript);
      res.json({ ...fallbackResult, provider: client.info, keysReturned: false });
    }
  });

  // Image Upload Endpoint
  app.post('/api/upload/image', rateLimitMiddleware, requireAuth, async (req, res) => {
    const { name, type, data } = req.body as { name?: string; type?: string; data?: string };
    if (!name || !type || !data) {
      res.status(400).json({ error: 'Missing name, type, or data' });
      return;
    }
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(type)) {
      res.status(400).json({ error: 'Invalid image type' });
      return;
    }
    const maxBytes = 4 * 1024 * 1024;
    try {
      const buffer = Buffer.from(data, 'base64');
      if (buffer.length > maxBytes) {
        res.status(413).json({ error: 'Image exceeds 4MB limit' });
        return;
      }
      const ext = type.split('/')[1];
      const filename = `${crypto.randomUUID()}.${ext}`;
      const filepath = path.join(UPLOADS_DIR, filename);
      fs.writeFileSync(filepath, buffer);
      res.json({ url: `/uploads/${filename}`, filename });
    } catch (err) {
      res.status(500).json({ error: 'Failed to save image' });
    }
  });

  // Dynamic MotionAI Chat Proxy Endpoint
  app.post('/api/ai/chat', rateLimitMiddleware, requireAuth, async (req, res) => {
    const settings = extractAiSettings(req.body || {});
    const client = createAiClient(settings);
    if (!client.info.enabled || !client.info.configured) {
      return res.status(503).json({ error: providerUnavailableMessage(client.info), provider: client.info, keysReturned: false });
    }

    const { history, message } = req.body || {};
    if (!message) {
      return res.status(400).json({ error: 'Missing chat message' });
    }
    const lengthError = chatPromptLengthExceeded(message, history);
    if (lengthError) {
      return res.status(413).json({ error: lengthError, keysReturned: false });
    }

    try {
      const conversationHistory = Array.isArray(history) ? history : [];
      const messages: ChatMessage[] = conversationHistory.map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        text: String(h.text || ''),
      }));
      messages.push({ role: 'user', text: String(message) });

      const workspaceLabel =
        typeof req.body?.workspaceName === 'string' && req.body.workspaceName.trim()
          ? req.body.workspaceName.trim()
          : 'your workspace';
      const systemInstruction = `You are a helpful, professional Workspace Assistant named **MotionAI** for ${workspaceLabel}.
- Answer user queries with professional poise and clarity in Markdown format.
- Assist with content generation, summarization, general questions, and technical advice.
- Keep your tone friendly, helpful, highly organized, and compact. Match the minimalist workspace aesthetic.
- Avoid preachy or overly verbose intros unless necessary. Deliver exact solutions directly.`;

      const text = await client.generateText(messages, { systemInstruction });
      res.json({ text, provider: client.info, keysReturned: false });
    } catch (err) {
      console.error('MotionAI Chat endpoint error:', safeErrorMessage(err, [settings.apiKey]));
      res.status(502).json({ error: safeErrorMessage(err, [settings.apiKey]), provider: client.info, keysReturned: false });
    }
  });

  app.post('/api/ai/tts', rateLimitMiddleware, requireAuth, async (req, res) => {
    const { text, provider, voice, speed, localEndpointUrl, model } = req.body || {};
    const settings = extractAiSettings(req.body || {});

    if (!text) {
      res.status(400).json({ error: 'Text is required', keysReturned: false });
      return;
    }

    try {
      if (provider === 'openai') {
        const apiKey = settings.apiKey || process.env.OPENAI_API_KEY;
        if (!apiKey) {
          res.status(500).json({ error: 'OpenAI API key is not configured on the server', keysReturned: false });
          return;
        }

        const response = await fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model || 'tts-1',
            input: text,
            voice: voice || 'alloy',
            speed: speed || 1.0,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          res.status(response.status).json({ error: `OpenAI TTS failed: ${errorText}`, keysReturned: false });
          return;
        }

        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'no-cache');

        if (response.body) {
          const reader = response.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
          res.end();
        } else {
          res.end();
        }
        return;
      }

      if (provider === 'local') {
        const endpoint = localEndpointUrl || process.env.LOCAL_TTS_URL || 'http://127.0.0.1:8888/v1/audio/speech';
        try {
          assertAllowedFetchUrl(endpoint, 'TTS local endpoint URL');
        } catch (err) {
          if (err instanceof SsrfBlockedError) {
            res.status(400).json({ error: err.message, keysReturned: false });
            return;
          }
          throw err;
        }
        const isOpenAiCompatible = endpoint.includes('/audio/speech');

        let localResponse: globalThis.Response;
        if (isOpenAiCompatible) {
          localResponse = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: model || 'kokoro',
              input: text,
              voice: voice || 'af_bella',
              speed: speed || 1.0,
            }),
          });
        } else {
          localResponse = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              text,
              voice: voice || 'en-us',
              speed: speed || 1.0,
            }),
          });
        }

        if (!localResponse.ok) {
          const errorText = await localResponse.text();
          res.status(localResponse.status).json({ error: `Local TTS endpoint failed: ${errorText}`, keysReturned: false });
          return;
        }

        const contentType = localResponse.headers.get('content-type') || 'audio/wav';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'no-cache');

        if (localResponse.body) {
          const reader = localResponse.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
          res.end();
        } else {
          res.end();
        }
        return;
      }

      res.status(400).json({ error: `Unsupported provider: ${provider}`, keysReturned: false });
    } catch (err) {
      console.error('TTS endpoint error:', safeErrorMessage(err, [settings.apiKey]));
      res.status(502).json({ error: safeErrorMessage(err, [settings.apiKey]), keysReturned: false });
    }
  });

  app.post('/api/webhooks/:path', requireWebhookAuth, requireWebhookReplayProtection, (req, res) => {
    const webhookPath = String(req.params.path || '').trim();
    if (!webhookPath || !validateWebhookPath(webhookPath)) {
      res.status(400).json({ error: 'Missing or invalid webhook path', keysReturned: false });
      return;
    }

    res.json({
      ok: true,
      webhook: webhookPath,
      received: true,
      deliveryId: getHeaderValue(req.headers['x-motionai-delivery']) || null,
      keysReturned: false,
    });
  });

  // ─── Presence Signaling Endpoints ──────────────────────────────────────────────

  // GET /api/presence/signal?peerId=xxx — retrieve and consume pending signals for a peer
  app.get('/api/presence/signal', (req, res) => {
    const { peerId } = req.query;
    if (!peerId || typeof peerId !== 'string') {
      res.status(400).json({ error: 'Missing or invalid peerId query parameter' });
      return;
    }
    const entry = signalStore.get(peerId);
    if (!entry || entry.expiresAt <= Date.now()) {
      res.json([]);
      return;
    }
    signalStore.delete(peerId);
    res.json(entry.signals);
  });

  // POST /api/presence/signal — store a signal for the target peer (30s TTL)
  app.post('/api/presence/signal', rateLimitMiddleware, requireAuth, (req, res) => {
    const signal = req.body as OutgoingSignal;
    if (!signal || !signal.to || !signal.from || !signal.type || !signal.payload) {
      res.status(400).json({ error: 'Invalid signal body: expected OutgoingSignal' });
      return;
    }
    const incoming: IncomingSignal = { from: signal.from, type: signal.type, payload: signal.payload };
    const existing = signalStore.get(signal.to);
    if (existing && existing.expiresAt > Date.now()) {
      existing.signals.push(incoming);
    } else {
      signalStore.set(signal.to, { signals: [incoming], expiresAt: Date.now() + SIGNAL_TTL_MS });
    }
    res.json({ ok: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    app.use('/uploads', express.static(UPLOADS_DIR));
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use('/uploads', express.static(UPLOADS_DIR));
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(error => {
  console.error('Server startup failed:', safeErrorMessage(error));
  process.exit(1);
});

process.on('SIGTERM', () => { shutdownRateLimitStore(); process.exit(0); });
process.on('SIGINT', () => { shutdownRateLimitStore(); process.exit(0); });
