import express from 'express';
import cors from 'cors';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Initialize Gemini API
  let ai: GoogleGenAI | null = null;
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  app.post('/api/ai/generate', async (req, res) => {
    if (!ai) {
      return res.status(500).json({ error: 'Gemini API not configured. Please add GEMINI_API_KEY.' });
    }

    const { command, context, prompt } = req.body;

    try {
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

      let userPrompt = prompt || "";

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
         userPrompt = `Context (if relevant):\n${context || ''}\n\nTask: ${prompt}`;
      } else {
         userPrompt = prompt || context || "";
      }

      const response = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: userPrompt,
          config: {
              systemInstruction: systemInstruction,
          }
      });
      
      res.json({ text: response.text });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/ai/spellcheck', async (req, res) => {
    if (!ai) {
      return res.status(500).json({ error: 'Gemini API not configured. Please add GEMINI_API_KEY.' });
    }

    const { blocks } = req.body;
    if (!blocks || !Array.isArray(blocks)) {
      return res.status(400).json({ error: 'Missing or invalid blocks array' });
    }

    const textBlocks = blocks.filter(b => b.content && b.content.trim() && b.type !== 'divider');

    if (textBlocks.length === 0) {
      return res.json({ issues: [] });
    }

    let dataPrompt = "Analyze the text contents of the following document blocks for spelling and typographical errors. Ignore valid code names, URLs, file paths, specialized jargon, or technical abbreviations unless they are obviously misspellings.\n\nInput Blocks:\n";
    textBlocks.forEach(b => {
      dataPrompt += `[BlockId: ${b.id}]\nText: ${b.content}\n\n`;
    });

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: dataPrompt,
        config: {
          systemInstruction: 'You are a precise doc proofreader. Analyze spelling and typos, associate them with the accurate original BlockId, extract the offending word, surrounding context (under 40 characters), and provide 2-3 accurate corrections. Respond ONLY with a valid JSON document matching the specified schema.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              issues: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING, description: "A unique random string or number index for this issue" },
                    word: { type: Type.STRING, description: "The exact misspelled word" },
                    suggestions: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: "List of 2-3 correct candidate suggestions"
                    },
                    context: { type: Type.STRING, description: "The immediate snippet of context containing the word" },
                    blockId: { type: Type.STRING, description: "The exact BlockId associated with this spelling issue" }
                  },
                  required: ["id", "word", "suggestions", "context", "blockId"]
                }
              }
            },
            required: ["issues"]
          }
        }
      });

      const resultText = response.text || '{ "issues": [] }';
      try {
        const parsed = JSON.parse(resultText);
        res.json(parsed);
      } catch (parseErr) {
        console.error('Failed to parse Gemini response as JSON:', resultText);
        res.json({ issues: [] });
      }
    } catch (err: any) {
      console.error('Spellcheck API error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Dynamic MotionAI Chat Proxy Endpoint
  app.post('/api/ai/chat', async (req, res) => {
    if (!ai) {
      return res.status(500).json({ error: 'Gemini API not configured. Please add GEMINI_API_KEY.' });
    }
    const { history, message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Missing chat message' });
    }

    try {
      const conversationHistory = Array.isArray(history) ? history : [];
      
      const contents = conversationHistory.map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.text }]
      }));
      
      contents.push({
        role: 'user',
        parts: [{ text: message }]
      });

      const systemInstruction = `You are a helpful, professional, and elite Workspace Assistant named **MotionAI**. You live in the mobile workspace of Jake Malby.
- Answer user queries with professional poise and clarity in Markdown format.
- Assist with content generation, summarization, general questions, and technical advice.
- Keep your tone friendly, helpful, highly organized, and compact. Match the beautiful minimalist Workspace aesthetic.
- Avoid preachy or overly verbose intros unless necessary. Deliver exact solutions directly.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
        }
      });

      res.json({ text: response.text });
    } catch (err: any) {
      console.error('MotionAI Chat endpoint error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
