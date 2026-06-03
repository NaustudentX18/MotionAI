import { motionAiFetch } from '../apiClient';

export interface StreamChatOptions {
  history: Array<{ role: string; text: string }>;
  message: string;
  workspaceName?: string;
  onDelta: (chunk: string) => void;
  signal?: AbortSignal;
}

/**
 * Streams AI chat via SSE when available; falls back to JSON chat.
 */
export async function streamAiChat(options: StreamChatOptions): Promise<string> {
  const { history, message, workspaceName, onDelta, signal } = options;

  try {
    const res = await motionAiFetch('/api/ai/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ history, message, workspaceName }),
      signal,
    });

    if (res.ok && res.headers.get('content-type')?.includes('text/event-stream') && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') continue;
          try {
            const parsed = JSON.parse(payload) as { delta?: string };
            if (parsed.delta) {
              full += parsed.delta;
              onDelta(parsed.delta);
            }
          } catch {
            /* ignore malformed chunks */
          }
        }
      }
      return full;
    }
  } catch {
    /* fall through */
  }

  const res = await motionAiFetch('/api/ai/chat', {
    method: 'POST',
    body: JSON.stringify({ history, message, workspaceName }),
    signal,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Chat failed (${res.status})`);
  }
  const data = await res.json();
  const text = data.text || '';
  if (text) onDelta(text);
  return text;
}
