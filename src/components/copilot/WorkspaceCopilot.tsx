import React, { useState, useEffect, useRef } from 'react';
import { Page, PageType } from '../../types';
import { initVectorDB, semanticSearch, SearchResult } from '../../lib/vectorStore';
import { loadSettings } from '../../lib/settings';
import { createAiClient } from '../../lib/ai/providers';
import {
  Sparkles,
  Send,
  Loader2,
  AlertCircle,
  Layers,
  CheckCircle,
  Copy,
  ExternalLink,
  MessageSquare,
  Bot
} from 'lucide-react';

interface WorkspaceCopilotProps {
  pages: Page[];
  currentPageId: string | null;
  onSelectPage: (id: string) => void;
  onAddPage: (pageType?: PageType, parentId?: string | null) => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: SearchResult[];
}

export function WorkspaceCopilot({ pages, currentPageId, onSelectPage, onAddPage }: WorkspaceCopilotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hello! I am your AI Workspace Co-pilot. I can perform semantic retrieval over your documents, summarize task pipelines, and locate similar task cards. How can I help you today?"
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [vectorDbLoading, setVectorDbLoading] = useState(true);
  const [vectorDbError, setVectorDbError] = useState<string | null>(null);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initialize the Vector Database from current workspace pages
  useEffect(() => {
    async function init() {
      try {
        setVectorDbLoading(true);
        setVectorDbError(null);
        await initVectorDB(pages);
      } catch (err) {
        console.error("Failed to initialize vector database", err);
        setVectorDbError("Could not initialize local vector index. AI search is disabled.");
      } finally {
        setVectorDbLoading(false);
      }
    }
    init();
  }, [pages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMsg = textToSend.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      // 1. Perform semantic search (RAG)
      let context = '';
      let sources: SearchResult[] = [];
      try {
        sources = await semanticSearch(userMsg, 5);
        if (sources.length > 0) {
          context = sources.map((s, index) => `[Source ${index + 1}: ${s.text}]`).join('\n\n');
        }
      } catch (err) {
        console.warn("Semantic search failed during co-pilot query", err);
      }

      // 2. Fetch active AI provider settings
      const settings = loadSettings();
      const activeProvider = settings.activeProvider;
      if (activeProvider === 'disabled') {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: "AI is currently disabled. Please enable it in Workspace Settings to chat with your co-pilot."
        }]);
        setLoading(false);
        return;
      }

      const providerConfig = settings.providers[activeProvider];
      const client = createAiClient({
        provider: activeProvider,
        model: providerConfig.model,
        baseUrl: providerConfig.baseUrl,
        apiKey: providerConfig.apiKey,
      });

      // 3. Construct prompt
      const prompt = `You are MotionAI's workspace co-pilot assistant.
You help the user manage their documentation, tasks, kanban boards, and canvas drawings.
Below is the relevant context retrieved from their offline workspace:

${context || "No matching workspace context found."}

Use the context above to answer the user's request. Be precise, highly analytical, and friendly. 
If referencing documents, cite the page titles (e.g. "Getting Started").

User Request: "${userMsg}"`;

      // 4. Generate response
      const response = await client.generateText(prompt);
      setMessages(prev => [...prev, { role: 'assistant', content: response, sources }]);
    } catch (err) {
      console.error("Co-pilot chat failed", err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error generating response: ${err instanceof Error ? err.message : String(err)}`
      }]);
    } finally {
      setLoading(false);
    }
  };

  // Quick Action Macros
  const handleSummarizeTasks = async () => {
    if (loading) return;
    setMessages(prev => [...prev, { role: 'user', content: "📊 Summarize active workspace tasks & schedules" }]);
    setLoading(true);

    try {
      // Collect todos and pages with priorities
      const tasksList: string[] = [];
      pages.forEach(p => {
        if (p.priority || p.dueDate) {
          tasksList.push(`Page "${p.title || 'Untitled'}" (Priority: ${p.priority || 'None'}, Due: ${p.dueDate || 'No Date'})`);
        }
        p.blocks.forEach(b => {
          if (b.type === 'todo') {
            tasksList.push(`- Checklist Item: "${b.content || 'Blank todo'}" [${b.checked ? 'Completed' : 'Pending'}] on page "${p.title || 'Untitled'}"`);
          }
        });
      });

      if (tasksList.length === 0) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: "No active tasks, priorities, or checkboxes found in this workspace. Create some todos or assign priorities to pages to get started!"
        }]);
        setLoading(false);
        return;
      }

      const settings = loadSettings();
      const activeProvider = settings.activeProvider;
      if (activeProvider === 'disabled') {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: "AI is currently disabled. Please enable it in Settings to run the task summary."
        }]);
        setLoading(false);
        return;
      }

      const providerConfig = settings.providers[activeProvider];
      const client = createAiClient({
        provider: activeProvider,
        model: providerConfig.model,
        baseUrl: providerConfig.baseUrl,
        apiKey: providerConfig.apiKey,
      });

      const prompt = `You are MotionAI's task assistant. Below is the raw checklist and task metadata of the current workspace:

${tasksList.join('\n')}

Please synthesize this list into a clean, ClickUp-style executive summary:
1. Overdue/Critical Tasks (prioritize High/Urgent, pending todos).
2. Weekly schedule overview.
3. Total completion progress.
Keep it bulleted and neat.`;

      const response = await client.generateText(prompt);
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', content: "Failed to summarize tasks due to an internal error." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleFindDuplicates = async () => {
    if (loading) return;
    setMessages(prev => [...prev, { role: 'user', content: "🔍 Scan workspace for duplicate tasks & conflicts" }]);
    setLoading(true);

    try {
      // Gather list of checklist items
      const todos: Array<{ id: string, text: string, pageTitle: string, pageId: string }> = [];
      pages.forEach(p => {
        p.blocks.forEach(b => {
          if (b.type === 'todo' && b.content && b.content.trim()) {
            todos.push({
              id: b.id,
              text: b.content.trim(),
              pageTitle: p.title || 'Untitled',
              pageId: p.id
            });
          }
        });
      });

      if (todos.length < 2) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: "You need at least 2 checklists/todos in the workspace to perform a duplicate scan."
        }]);
        setLoading(false);
        return;
      }

      // Semantic scanning using vector DB
      const duplicatesReport: string[] = [];
      const checkedPairs = new Set<string>();

      for (let i = 0; i < todos.length; i++) {
        const item = todos[i];
        // Search Voy for highly similar blocks
        const matches = await semanticSearch(item.text, 3);
        matches.forEach(m => {
          // Voy maps similarity index. Higher is closer.
          if (m.blockId !== item.id && m.score > 0.75) {
            // Find matched item in our local list to get page
            const matchItem = todos.find(t => t.id === m.blockId);
            if (matchItem) {
              const pairKey = [item.id, matchItem.id].sort().join('-');
              if (!checkedPairs.has(pairKey)) {
                checkedPairs.add(pairKey);
                duplicatesReport.push(`- Conflict: "${item.text}" on [${item.pageTitle}] matches closely with "${matchItem.text}" on [${matchItem.pageTitle}] (Confidence: ${Math.round(m.score * 100)}%)`);
              }
            }
          }
        });
      }

      if (duplicatesReport.length === 0) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: "Awesome! Scan complete. No duplicate task items or semantic conflicts detected."
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Duplicate scan complete. Found the following potential task conflicts:\n\n${duplicatesReport.join('\n')}\n\nReview them to ensure clean workspace planning.`
        }]);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', content: "Failed to scan duplicates due to an index error." }]);
    } finally {
      setLoading(false);
    }
  };

  // Jump to document
  const handleJumpToPage = (titleOrId: string) => {
    // Attempt search by title
    const cleanTitle = titleOrId.split('|')[0].trim();
    const foundPage = pages.find(p => p.title?.toLowerCase() === cleanTitle.toLowerCase() || p.id === titleOrId);
    if (foundPage) {
      onSelectPage(foundPage.id);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#FBFBFA] dark:bg-[#1C1C1C] text-xs">
      {/* Header */}
      <div className="p-4 border-b border-[#EBEBE9] dark:border-[#2F2F2F] flex items-center justify-between bg-stone-50/30 dark:bg-stone-900/10">
        <div className="flex items-center gap-2">
          <Bot size={15} className="text-purple-600 dark:text-purple-400" />
          <span className="font-bold text-stone-800 dark:text-stone-200">Workspace Brain</span>
        </div>
        <span className="text-[9px] bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">
          Local RAG
        </span>
      </div>

      {/* Message Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {vectorDbLoading && (
          <div className="flex items-center justify-center gap-2 py-2 text-stone-400">
            <Loader2 size={13} className="animate-spin" />
            <span>Indexing workspace vectors...</span>
          </div>
        )}

        {vectorDbError && (
          <div className="flex items-start gap-2 p-2.5 bg-red-50 dark:bg-red-950/10 border border-red-100 dark:border-red-900/30 rounded-lg text-red-650 dark:text-red-400">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>{vectorDbError}</span>
          </div>
        )}

        {messages.map((m, idx) => (
          <div key={idx} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[85%] rounded-xl p-3 leading-relaxed ${
              m.role === 'user'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-white dark:bg-[#252525] border border-stone-200/60 dark:border-stone-800 text-stone-850 dark:text-stone-250 shadow-2xs'
            }`}>
              {/* Render content */}
              <div className="whitespace-pre-wrap select-text">{m.content}</div>

              {/* Render Cited Sources */}
              {m.sources && m.sources.length > 0 && (
                <div className="mt-3.5 pt-2.5 border-t border-stone-100 dark:border-stone-800">
                  <span className="text-[9px] uppercase tracking-wider font-bold text-stone-400 dark:text-stone-500 block mb-1.5">
                    Workspace Context Sources:
                  </span>
                  <div className="flex flex-col gap-1">
                    {m.sources.map((s, sIdx) => {
                      const sourceTitle = s.pageId || 'Untitled Page';
                      return (
                        <button
                          key={sIdx}
                          onClick={() => handleJumpToPage(s.pageId)}
                          className="flex items-center gap-1.5 text-left text-[10px] text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 font-semibold cursor-pointer"
                        >
                          <ExternalLink size={9} />
                          <span className="truncate">{sourceTitle}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-stone-400 pl-2">
            <Loader2 size={13} className="animate-spin text-purple-500" />
            <span>Co-pilot thinking...</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Quick Action Buttons */}
      <div className="px-4 py-2 flex flex-wrap gap-1.5 border-t border-[#EBEBE9] dark:border-[#2F2F2F] bg-stone-50/20 dark:bg-stone-900/5">
        <button
          onClick={handleSummarizeTasks}
          disabled={loading || vectorDbLoading}
          className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-[#252525] border border-stone-250 dark:border-stone-800 rounded-md hover:bg-stone-50 dark:hover:bg-[#2F2F2F] text-stone-650 dark:text-stone-400 cursor-pointer disabled:opacity-50"
        >
          <Layers size={11} />
          <span>Summarize Tasks</span>
        </button>
        <button
          onClick={handleFindDuplicates}
          disabled={loading || vectorDbLoading}
          className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-[#252525] border border-stone-250 dark:border-stone-800 rounded-md hover:bg-stone-50 dark:hover:bg-[#2F2F2F] text-stone-650 dark:text-stone-400 cursor-pointer disabled:opacity-50"
        >
          <Copy size={11} />
          <span>Scan Duplicates</span>
        </button>
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => { e.preventDefault(); handleSendMessage(input); }}
        className="p-3 border-t border-[#EBEBE9] dark:border-[#2F2F2F] flex items-center gap-2 bg-white dark:bg-[#1E1E1E]"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading || vectorDbLoading}
          placeholder={vectorDbLoading ? "Indexing..." : "Ask your local workspace..."}
          className="flex-1 bg-stone-50 dark:bg-[#252525] border border-[#EBEBE9] dark:border-[#2F2F2F] rounded-full px-4 py-2 outline-none text-stone-800 dark:text-stone-200 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading || vectorDbLoading}
          className="w-8 h-8 rounded-full bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center shrink-0 disabled:opacity-40 transition-colors cursor-pointer"
        >
          <Send size={13} className="translate-x-[-0.5px]" />
        </button>
      </form>
    </div>
  );
}
