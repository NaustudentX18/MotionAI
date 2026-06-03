import {
  getConfiguredProviders,
  createAiClient,
  probeAi,
  providerUnavailableMessage,
  safeErrorMessage,
  buildGeneratePrompt,
  parseJsonObject,
  extractAiSettings
} from './providers';
import { loadSettings } from '../settings';
import { keychain } from '../keychain';

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

export function initTauriAiProxy() {
  if (!isTauri()) return;

  const originalFetch = window.fetch;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    if (url.endsWith('/api/ai/providers') || url.endsWith('/api/ai/status')) {
      const providers = getConfiguredProviders();
      const settings = loadSettings();
      const resolvedProviders = await Promise.all(providers.map(async (p) => {
        const hasKeychainKey = await keychain.retrieveKey(`ai-key-${p.id}`);
        const config = settings.providers[p.id];
        const hasConfig = config ? (p.id === 'gemini' ? Boolean(config.model && (config.apiKey || hasKeychainKey)) : Boolean(config.baseUrl && config.model)) : false;
        return {
          ...p,
          configured: hasConfig,
        };
      }));
      return new Response(JSON.stringify({ providers: resolvedProviders, configuredProviders: resolvedProviders, keysReturned: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.endsWith('/api/ai/probe')) {
      const body = JSON.parse(init?.body as string || '{}');
      const settings = extractAiSettings(body);
      const providerId = settings.provider || 'disabled';
      const actualApiKey = settings.apiKey === '[securely-stored]' || !settings.apiKey
        ? await keychain.retrieveKey(`ai-key-${providerId}`)
        : settings.apiKey;

      const result = await probeAi({
        ...settings,
        apiKey: actualApiKey || undefined,
      });
      return new Response(JSON.stringify({ ...result, keysReturned: false }), {
        status: result.ok ? 200 : 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.endsWith('/api/ai/generate')) {
      const body = JSON.parse(init?.body as string || '{}');
      const settings = extractAiSettings(body);
      const providerId = settings.provider || 'disabled';
      const actualApiKey = settings.apiKey === '[securely-stored]' || !settings.apiKey
        ? await keychain.retrieveKey(`ai-key-${providerId}`)
        : settings.apiKey;

      const client = createAiClient({
        ...settings,
        apiKey: actualApiKey || undefined,
      });

      if (!client.info.enabled || !client.info.configured) {
        return new Response(JSON.stringify({ error: providerUnavailableMessage(client.info), provider: client.info, keysReturned: false }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      try {
        const { systemInstruction, userPrompt } = buildGeneratePrompt(body.command, body.context, body.prompt);
        const text = await client.generateText(userPrompt, { systemInstruction });
        return new Response(JSON.stringify({ text, provider: client.info, keysReturned: false }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: safeErrorMessage(err, [actualApiKey || undefined]), provider: client.info, keysReturned: false }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    if (url.endsWith('/api/ai/spellcheck')) {
      const body = JSON.parse(init?.body as string || '{}');
      const settings = extractAiSettings(body);
      const providerId = settings.provider || 'disabled';
      const actualApiKey = settings.apiKey === '[securely-stored]' || !settings.apiKey
        ? await keychain.retrieveKey(`ai-key-${providerId}`)
        : settings.apiKey;

      const client = createAiClient({
        ...settings,
        apiKey: actualApiKey || undefined,
      });

      if (!client.info.enabled || !client.info.configured) {
        return new Response(JSON.stringify({ error: providerUnavailableMessage(client.info), provider: client.info, keysReturned: false }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const { blocks } = body;
      if (!blocks || !Array.isArray(blocks)) {
        return new Response(JSON.stringify({ error: 'Missing or invalid blocks array' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const textBlocks = blocks.filter((b: any) => b.content && b.content.trim() && b.type !== 'divider');
      if (textBlocks.length === 0) {
        return new Response(JSON.stringify({ issues: [], provider: client.info, keysReturned: false }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      let dataPrompt = 'Analyze the text contents of the following document blocks for spelling and typographical errors. Ignore valid code names, URLs, file paths, specialized jargon, or technical abbreviations unless they are obviously misspellings. Return ONLY valid JSON matching this shape: { "issues": [{ "id": "string", "word": "string", "suggestions": ["string"], "context": "string", "blockId": "string" }] }.\n\nInput Blocks:\n';
      textBlocks.forEach((b: any) => {
        dataPrompt += `[BlockId: ${b.id}]\nText: ${b.content}\n\n`;
      });

      try {
        const { spellcheckResponseSchema } = await import('./providers');
        const resultText = await client.generateText(dataPrompt, {
          systemInstruction: 'You are a precise doc proofreader. Analyze spelling and typos, associate them with the accurate original BlockId, extract the offending word, surrounding context (under 40 characters), and provide 2-3 accurate corrections. Respond ONLY with a valid JSON document matching the specified schema.',
          jsonSchema: spellcheckResponseSchema,
        });
        const parsed = parseJsonObject(resultText) || { issues: [] };
        return new Response(JSON.stringify({ issues: Array.isArray(parsed.issues) ? parsed.issues : [], provider: client.info, keysReturned: false }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: safeErrorMessage(err, [actualApiKey || undefined]), provider: client.info, keysReturned: false }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    if (url.endsWith('/api/ai/chat')) {
      const body = JSON.parse(init?.body as string || '{}');
      const settings = extractAiSettings(body);
      const providerId = settings.provider || 'disabled';
      const actualApiKey = settings.apiKey === '[securely-stored]' || !settings.apiKey
        ? await keychain.retrieveKey(`ai-key-${providerId}`)
        : settings.apiKey;

      const client = createAiClient({
        ...settings,
        apiKey: actualApiKey || undefined,
      });

      if (!client.info.enabled || !client.info.configured) {
        return new Response(JSON.stringify({ error: providerUnavailableMessage(client.info), provider: client.info, keysReturned: false }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const { history, message } = body;
      if (!message) {
        return new Response(JSON.stringify({ error: 'Missing chat message' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      try {
        const conversationHistory = Array.isArray(history) ? history : [];
        const messages = conversationHistory.map((h: any) => ({
          role: h.role === 'user' ? 'user' as const : 'model' as const,
          text: String(h.text || ''),
        }));
        messages.push({ role: 'user' as const, text: String(message) });

        const workspaceLabel =
          typeof body?.workspaceName === 'string' && body.workspaceName.trim()
            ? body.workspaceName.trim()
            : 'your workspace';
        const systemInstruction = `You are a helpful, professional Workspace Assistant named **MotionAI** for ${workspaceLabel}.\n- Answer user queries with professional poise and clarity in Markdown format.\n- Assist with content generation, summarization, general questions, and technical advice.\n- Keep your tone friendly, helpful, highly organized, and compact. Match the minimalist workspace aesthetic.\n- Avoid preachy or overly verbose intros unless necessary. Deliver exact solutions directly.`;

        const text = await client.generateText(messages, { systemInstruction });
        return new Response(JSON.stringify({ text, provider: client.info, keysReturned: false }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: safeErrorMessage(err, [actualApiKey || undefined]), provider: client.info, keysReturned: false }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    if (url.endsWith('/api/ai/checklist') || url.endsWith('/api/ai/meeting-parser')) {
      const body = JSON.parse(init?.body as string || '{}');
      const settings = extractAiSettings(body);
      const providerId = settings.provider || 'disabled';
      const actualApiKey = settings.apiKey === '[securely-stored]' || !settings.apiKey
        ? await keychain.retrieveKey(`ai-key-${providerId}`)
        : settings.apiKey;

      const client = createAiClient({
        ...settings,
        apiKey: actualApiKey || undefined,
      });

      const { transcript } = body;
      const isMeetingParser = url.endsWith('/api/ai/meeting-parser');
      
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

      const deterministicMeetingFallback = (text: string) => {
        const fallback = deterministicChecklistFallback(text);
        const summary = text.split(/\r?\n/)
          .map(line => line.trim())
          .filter(Boolean)
          .slice(0, 3)
          .map(line => line.slice(0, 180));
        return {
          summary: summary.length > 0 ? summary : ['Meeting transcript captured for review.'],
          tasks: fallback.tasks,
          source: 'deterministic',
        };
      };

      if (!client.info.enabled || !client.info.configured) {
        const fallbackResult = isMeetingParser
          ? deterministicMeetingFallback(transcript || '')
          : deterministicChecklistFallback(transcript || '');
        return new Response(JSON.stringify({ ...fallbackResult, provider: client.info, keysReturned: false }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      try {
        const { checklistResponseSchema, meetingParserResponseSchema } = await import('./providers');
        const resultText = await client.generateText(transcript || '', {
          systemInstruction: isMeetingParser
            ? 'You are a meeting-to-tasks parser for MotionAI. Extract concise summary bullets and concrete task objects from the transcript. Return ONLY valid JSON matching: { "summary": ["string"], "tasks": [{ "title": "string", "assignee": "string", "dueDate": "string", "priority": "low|medium|high" }] }.'
            : 'You are a meeting assistant. Analyze the meeting transcript or notes and convert them into a JSON checklist of tasks. For each task, extract: title (action item description), assignee (default to "Unassigned"), dueDate (default to "No due date"), and priority ("low", "medium", or "high"). Respond ONLY with a valid JSON document matching the specified schema.',
          jsonSchema: isMeetingParser ? meetingParserResponseSchema : checklistResponseSchema,
        });

        const parsed = parseJsonObject(resultText) || { tasks: [] };
        const tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
        const summary = Array.isArray(parsed.summary) ? parsed.summary : deterministicMeetingFallback(transcript || '').summary;
        const payload = isMeetingParser ? { summary, tasks, source: 'ai' } : { tasks };
        return new Response(JSON.stringify({ ...payload, provider: client.info, keysReturned: false }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err) {
        console.warn('AI checklist generation failed, falling back to deterministic parser:', safeErrorMessage(err, [actualApiKey || undefined]));
        const fallbackResult = isMeetingParser
          ? deterministicMeetingFallback(transcript || '')
          : deterministicChecklistFallback(transcript || '');
        return new Response(JSON.stringify({ ...fallbackResult, provider: client.info, keysReturned: false }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    return originalFetch(input, init);
  };
}
