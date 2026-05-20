import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
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
      let systemInstruction = `You are the **Notion AI Core Engine**. You operate as a high-performance document processor. 
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
