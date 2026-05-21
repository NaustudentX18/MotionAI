export const INLINE_AI_PRESETS: Record<string, Array<{ label: string; prompt: string }>> = {
  'ai-summary': [
    { label: "⚡ TL;DR", prompt: "Summarize this into a single, punchy TL;DR paragraph." },
    { label: "📋 Deliverables", prompt: "Extract and summarize all action items and meeting deliverables as a structured list." },
    { label: "💡 Key Insights", prompt: "Identify and outline the 3 most critical insights and lessons from the text." },
  ],
  'ai-draft': [
    { label: "📅 Agenda", prompt: "Create a detailed meeting agenda outline including standard timers and discussion goals." },
    { label: "✉️ Email", prompt: "Draft a polished, professional email summarizing these points for executive stakeholders." },
    { label: "🚀 Launch Pitch", prompt: "Write an inspiring release announcement for a product launch highlighting the key impacts." },
  ],
  'ai-rewrite': [
    { label: "👔 Corporate", prompt: "Rewrite this content to be highly professional, elegant, and corporate suited." },
    { label: "✂️ Concise", prompt: "Rewrite this text to be short and direct. Eliminate all fluff while preserving core facts." },
    { label: "👶 Simple", prompt: "Simplify the language and terminology. Explain this complex concept as if I am 10 years old." },
  ]
};
