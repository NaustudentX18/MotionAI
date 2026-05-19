import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      let systemInstruction = "You are a helpful AI writing assistant embedded in a document editor like Notion AI.";
      let userPrompt = prompt || "";

      if (command === 'continue') {
        systemInstruction = "You are an AI assistant helping to continue writing a document. Read the context and write the next few sentences or paragraphs seamlessly. Output ONLY the continued text without conversational filler. Do not use quotes around the output.";
        userPrompt = `Context to continue from:\n${context}\n\nPlease continue writing.`;
      } else if (command === 'summarize') {
         systemInstruction = "You are an AI assistant. Summarize the provided text concisely into a few bullet points. Output ONLY the summary without any prefix or conversational filler.";
         userPrompt = `Text to summarize:\n${context}`;
      } else if (command === 'brainstorm') {
         systemInstruction = "You are an AI assistant helping to brainstorm ideas. Provide a structured list of ideas related to the prompt. Output ONLY the list without conversational filler.";
         userPrompt = `Brainstorm ideas for: ${prompt}`;
      } else if (command === 'improve') {
         systemInstruction = "You are an AI assistant. Improve the writing of the provided text by fixing grammar, enhancing vocabulary, and making it flow better. Keep the original meaning. Output ONLY the improved text, no explanations.";
         userPrompt = `Improve this text:\n${context}`;
      } else if (command === 'extract') {
         systemInstruction = "You are an AI assistant. Extract tasks, actionable items, or key data points from the provided text into a concise list. Output ONLY the extracted items.";
         userPrompt = `Extract action items from:\n${context}`;
      } else if (command === 'custom') {
         systemInstruction = "You are an AI assistant helping to write or edit a document. Follow the user's instructions exactly. Output ONLY the requested content.";
         userPrompt = `Context (if relevant):\n${context}\n\nTask: ${prompt}`;
      } else {
         userPrompt = prompt;
      }

      const response = await ai.models.generateContent({
          model: 'gemini-2.5-pro',
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
