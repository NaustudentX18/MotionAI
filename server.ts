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
  type ChatMessage,
} from './src/lib/ai/providers';
import { rateLimitMiddleware, shutdownRateLimitStore } from './src/lib/rateLimit';

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

const signalStore = new Map<string, SignalStoreEntry>();
const SIGNAL_TTL_MS = 30_000;
const CLEANUP_INTERVAL_MS = 10_000;

// Non-blocking cleanup of expired signal entries
setInterval(() => {
  const now = Date.now();
  for (const [peerId, entry] of signalStore) {
    if (entry.expiresAt <= now) {
      signalStore.delete(peerId);
    }
  }
}, CLEANUP_INTERVAL_MS);

function getHeaderValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function matchesMotionAiSecret(provided: string): boolean {
  const secret = process.env.MOTIONAI_API_SECRET;
  if (!secret) return true;

  const providedDigest = crypto.createHash('sha256').update(provided).digest();
  const secretDigest = crypto.createHash('sha256').update(secret).digest();
  return provided.length === secret.length && crypto.timingSafeEqual(providedDigest, secretDigest);
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

function buildGeneratePrompt(command: string | undefined, context: string | undefined, prompt: string | undefined) {
  let systemInstruction = `You are the **MotionAI Core Engine**. You operate as a high-performance document processor. 
Your primary goal is to transform, generate, and refine content within a rich-text workspace. 
You are NOT a conversational assistant. You are a background utility.

<behavioral_guardrails>
  <rule priority="1">NEVER use conversational filler. No "Sure," "I can help," or "Here is the output."</rule>
  <rule priority="2">Respond ONLY with the requested Markdown content.</rule>
  <rule priority="3">Maintain a "Minimalist Modern" aesthetic: clean, objective, and dense with information.</rule>
  <rule priority="4">If a command is missing, default to "Improve Writing" based on context.</rule>
</behavioral_guardrails>

<formatting_standards>
  - **Typography**: Use **Bold** for high-impact keywords. Use \`inline code\` for technical identifiers.
  - **Structure**: Use \`###\` for sub-headers (H3). Avoid H1/H2 unless the document is long-form.
  - **Segmentation**: Use \`---\` (Horizontal Rules) to separate distinct logic blocks.
  - **Visual Pop**: Use \`>\` (Blockquotes) for summaries, callouts, or "TL;DR" sections.
  - **Checklists**: Use \`- [ ]\` for all task-oriented outputs.
</formatting_standards>

<technical_context_awareness>
  The user operates a sophisticated home lab environment:
  - OS: OpenMediaVault (OMV).
  - Stack: RADARR, SONARR, Overseerr, SABnzbd, Plex.
  - Infrastructure: Docker, Port Forwarding, NAS management.
  When processing technical notes, maintain strict accuracy for Linux paths, YAML syntax, and networking protocols.
</technical_context_awareness>

[INPUT] -> [PROCESS BY COMMAND] -> [OUTPUT MARKDOWN BLOCK]
NO PREAMBLE. NO APOLOGIES. NO CHAT.`;

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

function parseJsonObject(text: string): any | null {
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

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  // Create uploads directory — outside the if/else so both branches can reference it
  const UPLOADS_DIR = path.join(process.cwd(), 'data', 'uploads');
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

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

  // Image Upload Endpoint
  app.post('/api/upload/image', async (req, res) => {
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
    const ext = type.split('/')[1];
    const filename = `${crypto.randomUUID()}.${ext}`;
    const filepath = path.join(UPLOADS_DIR, filename);
    try {
      const buffer = Buffer.from(data, 'base64');
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

    try {
      const conversationHistory = Array.isArray(history) ? history : [];
      const messages: ChatMessage[] = conversationHistory.map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        text: String(h.text || ''),
      }));
      messages.push({ role: 'user', text: String(message) });

      const systemInstruction = `You are a helpful, professional, and elite Workspace Assistant named **MotionAI**. You live in the mobile workspace of Jake Malby.
- Answer user queries with professional poise and clarity in Markdown format.
- Assist with content generation, summarization, general questions, and technical advice.
- Keep your tone friendly, helpful, highly organized, and compact. Match the beautiful minimalist Workspace aesthetic.
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

  app.post('/api/webhooks/:path', requireWebhookAuth, (req, res) => {
    const webhookPath = String(req.params.path || '').trim();
    if (!webhookPath) {
      res.status(400).json({ error: 'Missing webhook path', keysReturned: false });
      return;
    }

    res.json({
      ok: true,
      webhook: webhookPath,
      received: true,
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
  app.post('/api/presence/signal', (req, res) => {
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
