import React, { useState, useEffect, useRef } from 'react';
import { 
  Home, 
  MessageSquare, 
  Calendar, 
  Inbox, 
  Search, 
  PlusCircle, 
  MoreHorizontal, 
  ChevronDown, 
  Sparkles, 
  ArrowLeft, 
  Send, 
  Plus, 
  Sliders, 
  Clock, 
  Edit3, 
  ArrowRightLeft, 
  ArrowUpCircle, 
  Settings, 
  Users, 
  Trash2, 
  HelpCircle, 
  Check, 
  X, 
  Mic, 
  FileText,
  Bookmark,
  ChevronRight,
  RefreshCw,
  Lightbulb,
  CheckSquare,
  Square,
  Code,
  Copy
} from 'lucide-react';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import { Page, Block } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { addGoogleTask } from '../lib/workspace';
import { cn } from '../lib/utils';
import { getTrash, clearTrash } from '../lib/trashStore';
import { useToast } from './ToastProvider';
import { requestMicrophonePermission } from '../lib/device';
import { motionAiFetch } from '../lib/apiClient';
import { MobileRichPageFallback } from './mobile/MobileRichPageFallback';
import { MobileBlockEditorView } from './mobile/MobileBlockEditorView';

interface MobileWorkspaceAppProps {
  pages: Page[];
  currentPageId: string | null;
  workspaceId: string;
  workspaceName: string;
  onSelectPage: (id: string) => void;
  onAddPage: (page: Page) => void;
  onUpdatePage: (id: string, updates: Partial<Page>) => void;
  onDeletePage: (id: string) => void;
  onRestorePage: (page: Page) => void;
  onOpenSettings?: () => void;
  onOpenPages?: () => void;
  userEmail: string | null;
  /** True on real phones / installed PWA; false when previewing phone frame on desktop */
  isCompactDevice?: boolean;
  onRequestDesktopView?: () => void;
}

export function MobileWorkspaceApp({
  pages,
  currentPageId,
  workspaceId,
  workspaceName,
  onSelectPage,
  onAddPage,
  onUpdatePage,
  onDeletePage,
  onRestorePage,
  onOpenSettings,
  onOpenPages,
  userEmail,
  isCompactDevice = true,
  onRequestDesktopView,
}: MobileWorkspaceAppProps) {
  const { showToast } = useToast();
  // Navigation tabs: 'home' | 'chats' | 'meeting' | 'inbox'
  const [activeTab, setActiveTab] = useState<'home' | 'chats' | 'meeting' | 'inbox'>('home');
  
  // Custom Overlays & Views
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  const [isSearchOverlayOpen, setIsSearchOverlayOpen] = useState(false);
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [isComposeMenuOpen, setIsComposeMenuOpen] = useState(false);
  
  // Active page context when editing inside the mobile app layout
  const [mobileEditingPageId, setMobileEditingPageId] = useState<string | null>(null);
  
  // Submenu dialogs
  const [activeSubDialog, setActiveSubDialog] = useState<string | null>(null); // 'upgrade' | 'settings' | 'members' | 'bin' | 'help' | null

  // Search overlay input
  const [searchQuery, setSearchQuery] = useState('');
  
  // AI Chat states
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'model'; text: string; id: string }>>([
    {
      role: 'model',
      text: `Hi! I am **MotionAI**. Ask me anything in **${workspaceName}** — I can draft documents, brainstorm, or rewrite notes.`,
      id: 'initial-ai',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [taskStatus, setTaskStatus] = useState<Record<string, 'idle' | 'loading' | 'success' | 'error'>>({});

  // Meeting notes screen state
  const [isRecordingMeeting, setIsRecordingMeeting] = useState(false);
  const [isProcessingMeeting, setIsProcessingMeeting] = useState(false);
  const [meetingTimer, setMeetingTimer] = useState(0);
  const [meetingTranscript, setMeetingTranscript] = useState<string[]>([]);
  const meetingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Real voice dictation states
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [isChatVoiceActive, setIsChatVoiceActive] = useState(false);
  const [isEditorVoiceActive, setIsEditorVoiceActive] = useState(false);
  const activeRecognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setIsSpeechSupported(true);
    }
  }, []);

  const [trashEntries, setTrashEntries] = useState(() => getTrash(workspaceId));

  useEffect(() => {
    setTrashEntries(getTrash(workspaceId));
  }, [workspaceId, pages.length]);

  // Page level editing states inside mobile view
  const [addingBlockType, setAddingBlockType] = useState<string | null>(null);
  const [mobileNewBlockText, setMobileNewBlockText] = useState("");

  // Installation helper dialog state for iOS Safari Standalone detection
  const [showIOSInstallDialog, setShowIOSInstallDialog] = useState(false);

  useEffect(() => {
    // Check if the user agent is iOS Safari and not standalone
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const isStandalone = ('standalone' in window.navigator && (window.navigator as any).standalone) || 
      window.matchMedia('(display-mode: standalone)').matches;

    if (isIOS && isSafari && !isStandalone && isCompactDevice) {
      setShowIOSInstallDialog(true);
    }
  }, [isCompactDevice]);

  // --- GESTURE & RESPONSE OPTIMIZATION STATES & LOGIC ---
  const [swipedBlockId, setSwipedBlockId] = useState<string | null>(null);
  const [blockSwipeStartX, setBlockSwipeStartX] = useState<number | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [swipedPageId, setSwipedPageId] = useState<string | null>(null);
  const [pageSwipeStartX, setPageSwipeStartX] = useState<number | null>(null);

  const triggerHaptic = (duration = 50) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(duration);
      } catch (e) {
        console.warn('Vibration not supported or blocked:', e);
      }
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null || touchStartY === null) return;
    const diffX = e.changedTouches[0].clientX - touchStartX;
    const diffY = e.changedTouches[0].clientY - touchStartY;

    // Edge Swipe hooks to toggle sidebar (open from left edge, close from anywhere)
    if (isWorkspaceMenuOpen) {
      if (diffX < -50 && Math.abs(diffY) < 65) {
        triggerHaptic(50);
        setIsWorkspaceMenuOpen(false);
        setTouchStartX(null);
        setTouchStartY(null);
        return;
      }
    } else {
      if (diffX > 60 && Math.abs(diffY) < 65 && touchStartX < 50) {
        triggerHaptic(50);
        setIsWorkspaceMenuOpen(true);
        setTouchStartX(null);
        setTouchStartY(null);
        return;
      }
    }

    // Horizontally dominant gesture
    if (Math.abs(diffX) > 80 && Math.abs(diffY) < 60) {
      if (mobileEditingPageId) {
        // Active sub-page: Left to Right back swipe
        if (diffX > 0) {
          setMobileEditingPageId(null);
          setAddingBlockType(null);
          setSwipedBlockId(null);
        }
      } else {
        // Tab swiping
        const tabs: Array<'home' | 'chats' | 'meeting' | 'inbox'> = ['home', 'chats', 'meeting', 'inbox'];
        const currentIndex = tabs.indexOf(activeTab);
        if (diffX > 0 && currentIndex > 0) {
          // Swipe left-to-right (previous tab)
          setActiveTab(tabs[currentIndex - 1]);
        } else if (diffX < 0 && currentIndex < tabs.length - 1) {
          // Swipe right-to-left (next tab)
          setActiveTab(tabs[currentIndex + 1]);
        }
      }
    }
    setTouchStartX(null);
    setTouchStartY(null);
  };

  const handleBlockTouchStart = (e: React.TouchEvent, blockId: string) => {
    setBlockSwipeStartX(e.touches[0].clientX);
  };

  const handleBlockTouchEnd = (e: React.TouchEvent, block: Block) => {
    if (blockSwipeStartX === null) return;
    const diffX = e.changedTouches[0].clientX - blockSwipeStartX;
    if (block.type === 'todo' && diffX < -120) {
      triggerHaptic(50);
      if (activeMobilePage) {
        onUpdatePage(activeMobilePage.id, {
          blocks: activeMobilePage.blocks.filter(b => b.id !== block.id)
        });
      }
      setSwipedBlockId(null);
    } else if (diffX < -50) {
      // Swipe Left reveals formatting/delete tray
      setSwipedBlockId(block.id);
    } else if (diffX > 50) {
      // Swipe Right closes tray
      setSwipedBlockId(null);
    }
    setBlockSwipeStartX(null);
  };

  const handlePageTouchStart = (e: React.TouchEvent, pageId: string) => {
    setPageSwipeStartX(e.touches[0].clientX);
  };

  const handlePageTouchEnd = (e: React.TouchEvent, pageId: string) => {
    if (pageSwipeStartX === null) return;
    const diffX = e.changedTouches[0].clientX - pageSwipeStartX;
    if (diffX < -60) {
      setSwipedPageId(pageId);
    } else if (diffX > 60) {
      setSwipedPageId(null);
    }
    setPageSwipeStartX(null);
  };

  // Real-time dynamic current clock
  const [simTime, setSimTime] = useState("4:24");

  useEffect(() => {
    const updateSimTime = () => {
      const now = new Date();
      let hrs = now.getHours();
      const mins = String(now.getMinutes()).padStart(2, '0');
      // Format 12-hour or 24-hour style
      const formattedHrs = hrs % 12 === 0 ? 12 : hrs % 12;
      setSimTime(`${formattedHrs}:${mins}`);
    };
    updateSimTime();
    const interval = setInterval(updateSimTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // Sync state initialization with some default pages if needed
  useEffect(() => {
    // Fill mock chat logs if empty
    if (pages.length > 0 && !mobileEditingPageId) {
      // Pick first page by default for sandbox
    }
  }, [pages]);

  // Handle meeting recording logic with live microphone transcribing
  useEffect(() => {
    if (isRecordingMeeting) {
      // 1. Start timer
      meetingTimerRef.current = setInterval(() => {
        setMeetingTimer(t => t + 1);
      }, 1000);

      // 2. Start Live Microphone SpeechRecognition if available
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const rec = new SpeechRecognition();
          rec.continuous = true;
          rec.interimResults = false;
          rec.lang = 'en-US';

          rec.onresult = (event: any) => {
            const resultsLength = event.results.length;
            const latestResult = event.results[resultsLength - 1];
            if (latestResult && latestResult[0]) {
              const resultMsg = latestResult[0].transcript.trim();
              if (resultMsg) {
                setMeetingTranscript(prev => [...prev, `[You]: ${resultMsg}`]);
              }
            }
          };

          rec.onerror = (e: any) => {
            console.warn('Meeting speech recognition error:', e.error);
          };

          rec.onend = () => {
            // Self-restart continuous voice if requested
            if (isRecordingMeeting && activeRecognitionRef.current === rec) {
              try { rec.start(); } catch (err) {}
            }
          };

          rec.start();
          activeRecognitionRef.current = rec;
        } catch (e) {
          console.error('Error launching SpeechRecognition:', e);
        }
      }
    } else {
      if (meetingTimerRef.current) {
        clearInterval(meetingTimerRef.current);
      }
      setMeetingTimer(0);

      if (activeRecognitionRef.current) {
        try {
          activeRecognitionRef.current.stop();
        } catch (err) {}
        activeRecognitionRef.current = null;
      }
    }

    return () => {
      if (meetingTimerRef.current) {
        clearInterval(meetingTimerRef.current);
      }
      if (activeRecognitionRef.current) {
        try {
          activeRecognitionRef.current.stop();
        } catch (err) {}
      }
    };
  }, [isRecordingMeeting]);

  // Start/Stop chat voice dictation input
  const handleChatVoiceDictate = () => {
    triggerHaptic(50);
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast("Speech recognition isn't supported in this browser. Try Safari on iOS or Chrome.", 'error');
      return;
    }

    if (isChatVoiceActive) {
      if (activeRecognitionRef.current) {
        try { activeRecognitionRef.current.stop(); } catch (e) {}
        activeRecognitionRef.current = null;
      }
      setIsChatVoiceActive(false);
    } else {
      if (activeRecognitionRef.current) {
        try { activeRecognitionRef.current.stop(); } catch (e) {}
      }

      try {
        const trans = new SpeechRecognition();
        trans.continuous = false;
        trans.interimResults = true;
        trans.lang = 'en-US';

        trans.onresult = (event: any) => {
          if (event.results && event.results[0] && event.results[0][0]) {
            const text = event.results[0][0].transcript;
            setChatInput(text);
          }
        };

        trans.onend = () => {
          setIsChatVoiceActive(false);
          activeRecognitionRef.current = null;
        };

        trans.onerror = (e: any) => {
          console.warn('Chat voice error:', e.error);
          setIsChatVoiceActive(false);
          activeRecognitionRef.current = null;
        };

        setIsChatVoiceActive(true);
        trans.start();
        activeRecognitionRef.current = trans;
      } catch (err) {
        console.error('Error starting Chat input dictation:', err);
      }
    }
  };

  // Start/Stop block editor voice input
  const handleEditorVoiceDictate = () => {
    triggerHaptic(50);
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast("Speech recognition isn't supported in this browser. Try Safari on iOS or Chrome.", 'error');
      return;
    }

    if (isEditorVoiceActive) {
      if (activeRecognitionRef.current) {
        try { activeRecognitionRef.current.stop(); } catch (e) {}
        activeRecognitionRef.current = null;
      }
      setIsEditorVoiceActive(false);
    } else {
      if (activeRecognitionRef.current) {
        try { activeRecognitionRef.current.stop(); } catch (e) {}
      }

      try {
        const trans = new SpeechRecognition();
        trans.continuous = false;
        trans.interimResults = true;
        trans.lang = 'en-US';

        trans.onresult = (event: any) => {
          if (event.results && event.results[0] && event.results[0][0]) {
            const text = event.results[0][0].transcript;
            setMobileNewBlockText(text);
          }
        };

        trans.onend = () => {
          setIsEditorVoiceActive(false);
          activeRecognitionRef.current = null;
        };

        trans.onerror = (e: any) => {
          console.warn('Editor voice error:', e.error);
          setIsEditorVoiceActive(false);
          activeRecognitionRef.current = null;
        };

        setIsEditorVoiceActive(true);
        trans.start();
        activeRecognitionRef.current = trans;
      } catch (err) {
        console.error('Error starting Editor input dictation:', err);
      }
    }
  };

  // Trigger MotionAI chat message with server post
  const handleSendAiChat = async (directText?: string) => {
    const query = directText || chatInput;
    if (!query.trim()) return;

    const userMsg = { role: 'user' as const, text: query, id: uuidv4() };
    setChatMessages(prev => [...prev, userMsg]);
    if (!directText) setChatInput('');
    setIsAiTyping(true);

    try {
      let extraContext = '';
      try {
        const { semanticSearch } = await import('../lib/vectorStore');
        const results = await semanticSearch(query, 5);
        if (results && results.length > 0) {
          extraContext = "\n\n[USER CONTEXT FROM LOCAL APP DATA]:\n" + results.map((r: any) => `- "${r.text}"`).join('\n');
        }
      } catch(e) {
        console.warn('Semantic search warning:', e);
      }

      const res = await motionAiFetch('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          history: chatMessages.map(m => ({ role: m.role, text: m.text })),
          message: query + extraContext,
          workspaceName,
        })
      });

      if (res.ok) {
        const data = await res.json();
        setChatMessages(prev => [...prev, { role: 'model', text: data.text || 'No response from AI.', id: uuidv4() }]);
      } else {
        const errorText = await res.text();
        setChatMessages(prev => [...prev, { role: 'model', text: `⚠️ Error generation: ${errorText || 'Server offline or API key missing.'}`, id: uuidv4() }]);
      }
    } catch (err: any) {
      setChatMessages(prev => [...prev, { role: 'model', text: `⚠️ Connection failure: ${err.message || 'Make sure the server is online.'}`, id: uuidv4() }]);
    } finally {
      setIsAiTyping(false);
    }
  };

  // Google Tasks helper for task list in chatbot responses
  const handleAddTaskToGoogle = async (taskContent: string, taskKey: string) => {
    setTaskStatus(prev => ({ ...prev, [taskKey]: 'loading' }));
    try {
      await addGoogleTask(taskContent);
      setTaskStatus(prev => ({ ...prev, [taskKey]: 'success' }));
    } catch (err: any) {
      console.error('Failed to add Google task:', err);
      setTaskStatus(prev => ({ ...prev, [taskKey]: 'error' }));
      showToast(`Could not add task: ${err.message || 'Unknown error'}`, 'error');
    }
  };

  // Convert meeting to page after recording
  const finishMeetingRecording = async () => {
    setIsRecordingMeeting(false);
    setIsProcessingMeeting(true);
    
    // Generate page title and structured blocks using transcript or defaults
    const finalTranscriptText = meetingTranscript.length > 0 
      ? meetingTranscript.join('\n') 
      : "No transcript recorded. User started a blank meeting session.";

    let summaryPoints: string[] = ['No summary points extracted.'];
    let actionItems: string[] = ['Review meeting notes for action items.'];

    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await motionAiFetch('/api/ai/generate', {
        method: 'POST',
        body: JSON.stringify({
          command: 'custom',
          context: finalTranscriptText,
          prompt: `You are a meeting assistant. Summarize this transcript. Extract 3 key discussion bullet points and a list of concrete task action items. Return ONLY a JSON object matching this schema, without any markdown enclosing tags or surrounding explanations:
{
  "summary": ["point 1", "point 2", "point 3"],
  "tasks": ["task 1", "task 2"]
}`
        })
      });
      const data = await res.json();
      if (!data.error && data.text) {
        let cleanText = data.text.trim();
        if (cleanText.startsWith('```json')) {
          cleanText = cleanText.substring(7);
        }
        if (cleanText.endsWith('```')) {
          cleanText = cleanText.substring(0, cleanText.length - 3);
        }
        const parsed = JSON.parse(cleanText.trim());
        if (Array.isArray(parsed.summary)) summaryPoints = parsed.summary;
        if (Array.isArray(parsed.tasks)) actionItems = parsed.tasks;
      }
    } catch (err) {
      console.warn('AI meeting summarization failed, falling back to defaults:', err);
      summaryPoints = meetingTranscript.length > 0 ? meetingTranscript.slice(0, 3) : ['Discussion was blank.'];
      actionItems = [
        'Review dock container volume metrics with Alex',
        'Confirm OMV backup pools synchronization'
      ];
    }

    const dateStr = new Date().toLocaleDateString();
    
    const meetingPage: Page = {
      id: uuidv4(),
      title: `AI Meeting Notes - ${dateStr}`,
      icon: '🎙️',
      cover: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      blocks: [
        { id: uuidv4(), type: 'h1', content: `🎙️ AI Sync: Meeting Summary` },
        { id: uuidv4(), type: 'callout', content: `This structured meeting documentation was auto-captured live using state-of-the-art AI transcripts inside the Workspace client.` },
        { id: uuidv4(), type: 'h3', content: 'Discussion points & Key takeaways' },
        ...summaryPoints.map(line => ({
          id: uuidv4(),
          type: 'bullet' as const,
          content: line
        })),
        { id: uuidv4(), type: 'h3', content: 'Action Checklist' },
        ...actionItems.map(line => ({
          id: uuidv4(),
          type: 'todo' as const,
          content: line,
          checked: false
        }))
      ]
    };

    onAddPage(meetingPage);
    setMobileEditingPageId(meetingPage.id);
    setActiveTab('home');
    setMeetingTranscript([]);
    setIsProcessingMeeting(false);
  };

  // Compose shortcuts
  const createNewMobilePage = (overrideEmoji?: string, overrideTitle?: string) => {
    const emojis = ['📝', '💡', '🎨', '🚀', '📊', '⚡', '🤖', '📌', '📅', '🧠'];
    const randomEmoji = overrideEmoji || emojis[Math.floor(Math.random() * emojis.length)];
    const newPage: Page = {
      id: uuidv4(),
      title: overrideTitle || '',
      icon: randomEmoji,
      cover: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      blocks: [
        { id: uuidv4(), type: 'p', content: 'Start typing list assets or workspace ideas here...' }
      ]
    };
    onAddPage(newPage);
    setMobileEditingPageId(newPage.id);
    setIsComposeMenuOpen(false);
    setActiveTab('home');
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    if (action === 'ask-ai') {
      setIsAiChatOpen(true);
      setActiveTab('chats');
    }
    if (action === 'new-page') {
      createNewMobilePage();
    }
    if (action) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const startMeetingRecording = async () => {
    triggerHaptic(50);
    const mic = await requestMicrophonePermission();
    if (mic === 'denied') {
      showToast('Allow microphone access in Settings to record meetings.', 'error');
      return;
    }
    if (mic === 'unsupported') {
      showToast('Microphone capture is not supported in this browser.', 'error');
    }
    setActiveTab('meeting');
    setIsRecordingMeeting(true);
    setMeetingTranscript(['[Init]: Listening — speak clearly near your device.']);
  };

  // Search filter
  const filteredSearchPages = searchQuery.trim() === ''
    ? pages
    : pages.filter(p => 
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.blocks.some(b => b.content?.toLowerCase().includes(searchQuery.toLowerCase()))
      );

  const activeMobilePage = pages.find(p => p.id === mobileEditingPageId);

  // Quick preset queries for keyboard
  const PRESET_QUERIES = [
    "Brainstorm app features",
    "Design a technical checklist",
    "List home lab specifications",
    "Write a short book summary"
  ];

  return (
    <div className={cn(
      "w-full h-full text-gray-100 flex flex-col font-sans select-none overflow-hidden",
      isCompactDevice ? "bg-[#0E0E0E] p-0" : "bg-[#141414] items-center justify-center p-0 md:p-4"
    )}>
      <div className={cn(
        "w-full h-full relative flex flex-col overflow-hidden",
        isCompactDevice
          ? "bg-[#0E0E0E]"
          : "md:h-auto md:max-w-[420px] md:aspect-[9/19.5] md:min-h-[700px] md:max-h-[calc(100vh-32px)] bg-[#0E0E0E] md:rounded-[48px] p-0 md:p-2.5 shadow-2xl md:border-[5px] md:border-[#2B2B2B] md:ring-1 md:ring-white/15"
      )}>
        
        {/* Phone preview chrome (desktop preview only) */}
        <div className={cn("absolute top-2.5 left-1/2 -translate-x-1/2 w-32 h-6 bg-black rounded-full z-50 items-center justify-between px-3.5", isCompactDevice ? "hidden" : "hidden md:flex")}>
          <div className="w-2.5 h-2.5 rounded-full bg-[#1C1C1C] border border-[#2E2E2E]" />
          <div className="w-12 h-1 bg-[#1A1A1A] rounded-full" />
        </div>

        {/* Phone preview status bar (desktop preview only) */}
        <div className={cn("h-10 pt-2 px-6 justify-between items-center text-xs text-stone-200 mt-1 select-none z-40 bg-transparent shrink-0", isCompactDevice ? "hidden" : "hidden md:flex")}>
          {/* Time with silent badge */}
          <div className="flex items-center gap-1.5 font-bold font-mono text-[13px] tracking-tight text-white select-none">
            <span>{simTime}</span>
            <span className="text-[10px] text-stone-400">🔕</span>
          </div>
          
          {/* Status info bar */}
          <div className="flex items-center gap-2 text-white">
            {/* Cellular Signal Bar SVG */}
            <svg className="w-4 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
              <rect x="1" y="16" width="3" height="5" rx="0.5" />
              <rect x="6" y="12" width="3" height="9" rx="0.5" />
              <rect x="11" y="8" width="3" height="13" rx="0.5" />
              <rect x="16" y="4" width="3" height="17" rx="0.5" />
            </svg>
            
            {/* WiFi Icon SVG */}
            <svg className="w-4 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 21a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm0-6.5a6.5 6.5 0 0 0-6.12-4.3c-.42 0-.75.33-.75.75v.5c0 .37.27.69.64.74A4.5 4.5 0 0 1 12 13.5a4.5 4.5 0 0 1 6.23-1.31c.37-.05.64-.37.64-.74v-.5c0-.42-.33-.75-.75-.75A6.5 6.5 0 0 0 12 14.5zM12 8a11 11 0 0 0-9.62-5.75.75.75 0 0 0-.75.75v.5c0 .35.25.66.6.72A9 9 0 0 1 12 10a9 9 0 0 1 9.77-5.78c.35-.06.6-.37.6-.72v-.5a.75.75 0 0 0-.75-.75A11 11 0 0 0 12 8z" />
            </svg>

            {/* Low Battery 5% badge (From image) */}
            <div className="flex items-center gap-1 bg-[#F87171]/20 border border-[#F87171]/40 text-[#F87171] font-mono text-[9px] font-bold px-1 rounded scale-90">
              ⚡ 5%
            </div>
            
            <div className="w-5.5 h-3 border border-stone-400 rounded-sm p-0.5 flex items-center">
              <div className="w-2.5 h-full bg-[#E11D48] rounded-2xs" />
            </div>
          </div>
        </div>

        {/* Internal body container */}
        <div className={cn(
          "flex-1 overflow-hidden relative flex flex-col bg-[#191919] text-[#E3E3E3] border border-white/5 shadow-inner",
          !isCompactDevice && "md:rounded-t-[32px] md:rounded-b-[38px]"
        )}>
          
          {/* VIEW: MAIN CLIENT VIEW SCENE */}
          {!mobileEditingPageId ? (
            <div 
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              className="flex-1 flex flex-col overflow-hidden"
            >
              
              {/* Top Navigation Headers row (exactly like image) */}
              <div 
                style={{ paddingTop: 'calc(12px + env(safe-area-inset-top))' }}
                className="pb-2 px-4 border-b border-stone-800 flex items-center gap-1 select-none overflow-x-auto no-scrollbar shrink-0 pt-safe"
              >
                {/* J Profile circle */}
                <button
                  onClick={() => { triggerHaptic(50); onOpenPages ? onOpenPages() : setIsWorkspaceMenuOpen(true); }}
                  className="w-11 h-11 min-w-11 rounded-full bg-stone-800 border border-stone-700 font-bold font-mono text-stone-300 text-sm flex items-center justify-center hover:bg-stone-700 transition-colors shrink-0 mr-1.5 cursor-pointer relative"
                  aria-label="Open pages menu"
                >
                  {(workspaceName.trim()[0] || 'W').toUpperCase()}
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-[#191919] rounded-full animate-ping" />
                </button>

                {/* Home tab button */}
                <button
                  onClick={() => { triggerHaptic(50); setActiveTab('home'); setMobileEditingPageId(null); }}
                  className={`h-11 min-w-11 rounded-full px-4 flex items-center gap-1.5 transition-all duration-200 shrink-0 text-sm font-semibold cursor-pointer ${
                    activeTab === 'home'
                      ? 'bg-stone-800 text-white shadow-md font-bold border border-stone-700'
                      : 'bg-stone-900/40 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  <Home size={15} />
                  {activeTab === 'home' && <span>Home</span>}
                </button>

                {/* Chats tab button */}
                <button
                  onClick={() => { triggerHaptic(50); setActiveTab('chats'); }}
                  className={`h-11 min-w-11 rounded-full px-4 flex items-center gap-1.5 transition-all duration-200 shrink-0 text-sm font-semibold cursor-pointer ${
                    activeTab === 'chats'
                      ? 'bg-stone-800 text-white shadow-md font-bold border border-stone-700'
                      : 'bg-stone-900/40 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  <MessageSquare size={15} />
                  {activeTab === 'chats' && <span>Chats</span>}
                </button>

                {/* Meeting tab button */}
                <button
                  onClick={() => { triggerHaptic(50); setActiveTab('meeting'); }}
                  className={`h-11 min-w-11 rounded-full px-4 flex items-center gap-1.5 transition-all duration-200 shrink-0 text-sm font-semibold cursor-pointer ${
                    activeTab === 'meeting'
                      ? 'bg-stone-800 text-white shadow-md font-bold border border-stone-700'
                      : 'bg-stone-900/40 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  <Calendar size={15} />
                  {activeTab === 'meeting' && <span>Meeting</span>}
                </button>

                {/* Inbox tab button */}
                <button
                  onClick={() => { triggerHaptic(50); setActiveTab('inbox'); }}
                  className={`h-11 min-w-11 rounded-full px-4 flex items-center gap-1.5 transition-all duration-200 shrink-0 text-sm font-semibold cursor-pointer ${
                    activeTab === 'inbox'
                      ? 'bg-stone-800 text-white shadow-md font-bold border border-stone-700'
                      : 'bg-stone-900/40 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  <Inbox size={15} />
                  {activeTab === 'inbox' && <span>Inbox</span>}
                </button>
              </div>

              {/* Dynamic Viewport Container */}
              <div className="flex-1 overflow-y-auto px-4 py-4 select-none">
                
                {/* View A: HOME PAGE */}
                {activeTab === 'home' && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 hover:bg-stone-850 px-2 py-1 rounded-md cursor-pointer transition-colors text-stone-300 font-bold text-sm">
                        <span>Private</span>
                        <ChevronDown size={14} className="text-stone-500" />
                      </div>
                      <button className="text-stone-400 hover:text-stone-200 p-1 rounded-md hover:bg-stone-850 cursor-pointer transition-colors">
                        <MoreHorizontal size={18} />
                      </button>
                    </div>

                    <div className="space-y-1.5 mt-2">
                      {pages.map(page => {
                        const isSwiped = swipedPageId === page.id;
                        return (
                          <div 
                            key={page.id} 
                            className="relative overflow-hidden rounded-lg w-full flex items-center transition-all duration-200"
                            onTouchStart={(e) => handlePageTouchStart(e, page.id)}
                            onTouchEnd={(e) => handlePageTouchEnd(e, page.id)}
                          >
                            <div 
                              className={`w-full flex items-center px-3 py-3 hover:bg-stone-850 text-left font-medium text-[15px] text-stone-200 transition-transform duration-200 hover:scale-101 border border-transparent hover:border-stone-800 group cursor-pointer ${
                                isSwiped ? '-translate-x-20' : 'translate-x-0'
                              }`}
                              onClick={() => {
                                if (isSwiped) {
                                  setSwipedPageId(null);
                                } else {
                                  setMobileEditingPageId(page.id);
                                }
                              }}
                            >
                              <span className="mr-3 text-lg flex-shrink-0 origin-center group-hover:scale-115 transition-transform">
                                {page.icon || '📄'}
                              </span>
                              <span className="truncate flex-1 font-sans pr-4">
                                {page.title || 'Untitled page'}
                              </span>
                              {!isSwiped && <ChevronRight size={14} className="text-stone-600 group-hover:text-stone-400 transition-colors" />}
                            </div>
                            
                            {isSwiped && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  triggerHaptic(50);
                                  onDeletePage(page.id);
                                  setSwipedPageId(null);
                                }}
                                className="absolute right-0 top-0 bottom-0 w-20 bg-red-600 hover:bg-red-700 text-white flex items-center justify-center font-bold text-xs uppercase tracking-wider transition-colors z-10 cursor-pointer"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Creative additions: Hot tip banners */}
                    <div className="p-4 bg-purple-950/20 rounded-xl border border-purple-900/30 font-medium text-xs text-purple-200 space-y-2 mt-4">
                      <div className="flex items-center gap-1.5 text-purple-400 font-bold tracking-wider uppercase text-[10px] ">
                        <Sparkles size={11} className="text-purple-400" />
                        <span>Mobile AI Integration Core</span>
                      </div>
                      <p className="leading-relaxed opacity-90 text-stone-300">
                        Tap the profile J circle to invite team members, access Settings or explore deleted files in the Trash recycle bin!
                      </p>
                    </div>
                  </div>
                )}

                {/* View B: CHATS PAGE (Image 3) */}
                {activeTab === 'chats' && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="px-1 pt-1">
                      <span className="text-xs font-semibold text-stone-500 uppercase tracking-widest font-mono">Past 30 days</span>
                    </div>

                    <div className="space-y-1">
                      {/* Interactive Chat Row 1 */}
                      <button 
                        onClick={() => {
                          setIsAiChatOpen(true);
                          setChatMessages([
                            { role: 'model', text: 'Hi! Let me retrieve your "AI book summary agent note" records. How would you like to process them?', id: 'preset-chat-1' }
                          ]);
                        }}
                        className="w-full flex items-center p-3 hover:bg-stone-850 rounded-xl text-left cursor-pointer transition-colors group"
                      >
                        <div className="w-9 h-9 rounded-full bg-purple-950/30 border border-purple-900/40 text-purple-400 flex items-center justify-center mr-3 group-hover:scale-105 transition-transform">
                          <MessageSquare size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-[14px] font-semibold text-stone-100 truncate">AI book summary agent note</h4>
                          <span className="text-[11px] text-stone-500">23d ago</span>
                        </div>
                        <ChevronRight size={14} className="text-stone-700" />
                      </button>

                      {/* Interactive Chat Row 2 */}
                      <button 
                        onClick={() => {
                          setIsAiChatOpen(true);
                          setChatMessages([
                            { role: 'model', text: 'Opening "Help with coding" logs. I can answer TypeScript, Docker, and other platform questions directly!', id: 'preset-chat-2' }
                          ]);
                        }}
                        className="w-full flex items-center p-3 hover:bg-stone-850 rounded-xl text-left cursor-pointer transition-colors group"
                      >
                        <div className="w-9 h-9 rounded-full bg-blue-950/20 border border-blue-900/30 text-blue-400 flex items-center justify-center mr-3 group-hover:scale-105 transition-transform">
                          <MessageSquare size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-[14px] font-semibold text-stone-100 truncate">Help with coding</h4>
                          <span className="text-[11px] text-stone-500">27d ago</span>
                        </div>
                        <ChevronRight size={14} className="text-stone-700" />
                      </button>
                    </div>

                    {/* Fun hint */}
                    <div className="flex flex-col items-center justify-center text-center p-4 pt-12 space-y-3">
                      <div className="w-12 h-12 bg-stone-900 rounded-full flex items-center justify-center text-stone-600 border border-stone-800">
                        <MessageSquare size={20} />
                      </div>
                      <h3 className="text-stone-300 font-bold text-sm">Full chat archives</h3>
                      <p className="text-xs text-stone-500 max-w-xs leading-relaxed">
                        These archives preserve discussions with your intelligent AI helpers inside the space.
                      </p>
                    </div>
                  </div>
                )}

                {/* View C: MEETING PAGE (Image 4) */}
                {activeTab === 'meeting' && (
                  <div className="flex-1 flex flex-col justify-center h-full min-h-[400px] animate-in fade-in duration-200">
                    {isProcessingMeeting ? (
                      <div className="flex flex-col items-center justify-center text-center py-10 space-y-4">
                        <div className="w-12 h-12 rounded-xl bg-stone-900 border border-stone-850 flex items-center justify-center text-stone-400 shadow-lg">
                          <span className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                        <div className="space-y-1.5 px-6">
                          <h3 className="text-[15px] font-bold text-stone-200 font-sans">Processing transcript...</h3>
                          <p className="text-[12px] text-stone-500 leading-relaxed font-sans px-2">
                            Creating key summaries and extracting action tasks with AI.
                          </p>
                        </div>
                      </div>
                    ) : !isRecordingMeeting ? (
                      <div className="flex flex-col items-center justify-center text-center py-10 space-y-4">
                        <div className="w-16 h-16 rounded-2xl bg-stone-900/80 border border-stone-800 flex flex-col items-center justify-center text-stone-400 shadow-lg relative glow-effect">
                          <Mic size={24} className="text-purple-400" />
                          <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
                        </div>

                        <div className="space-y-1.5 px-6">
                          <h3 className="text-[17px] font-bold text-stone-100 font-sans">No meetings yet</h3>
                          <p className="text-[13px] text-stone-400 leading-relaxed font-sans px-2">
                            Capture conversations anywhere with AI Meeting Notes
                          </p>
                        </div>

                        <button 
                          type="button"
                          onClick={() => void startMeetingRecording()}
                          className="text-[#007AFF] text-[15px] font-bold hover:underline cursor-pointer transition-all pt-1 min-h-11"
                        >
                          Start new meeting
                        </button>
                      </div>
                    ) : (
                      // Interactive Meeting sync waveform screen!
                      <div className="flex-1 flex flex-col justify-between pt-4 pb-8 h-full space-y-4 animate-in slide-in-from-bottom duration-250">
                        <div className="space-y-1 text-center">
                          <span className="text-stone-500 text-[11px] font-bold tracking-widest font-mono uppercase">AI Meeting Sync Session</span>
                          <h4 className="text-stone-200 text-lg font-bold">Listening to Audio...</h4>
                          <span className="text-purple-400 font-mono text-sm font-bold bg-purple-950/50 px-2.5 py-1 rounded-full border border-purple-900/30">
                            {Math.floor(meetingTimer / 60)}:{(meetingTimer % 60).toString().padStart(2, '0')}
                          </span>
                        </div>

                        {/* Animated waveforms! */}
                        <div className="flex items-center justify-center gap-1.5 h-16 px-4">
                          {[1, 2, 3, 4, 1, 2, 3, 4, 3, 2, 1, 4, 2, 3, 1].map((lvl, index) => {
                            const heights = ["h-3", "h-7", "h-11", "h-14", "h-6"];
                            return (
                              <div 
                                key={index} 
                                className={`w-1.5 bg-purple-500 rounded-full transition-all duration-300 ${heights[Math.floor(Math.random() * heights.length)]} animate-pulse`} 
                              />
                            );
                          })}
                        </div>

                        {/* Real-time transcribed output log box */}
                        <div className="flex-1 bg-[#1F1F1F] rounded-xl border border-stone-800 p-3 overflow-y-auto max-h-48 text-left space-y-1.5 font-mono text-xs text-stone-300">
                          {meetingTranscript.map((line, i) => (
                            <p key={i} className="leading-relaxed border-l border-purple-900/50 pl-2">
                              {line}
                            </p>
                          ))}
                          <div className="h-1 bg-purple-500 w-2 rounded animate-pulse inline-block" />
                        </div>

                        <div className="flex justify-center items-center gap-4">
                          <button 
                            onClick={() => {
                              triggerHaptic(50);
                              setIsRecordingMeeting(false);
                            }}
                            className="px-4 py-2 bg-stone-800 hover:bg-stone-750 text-stone-300 font-medium text-xs rounded-lg cursor-pointer transition-colors"
                          >
                            Cancel
                          </button>
                          
                          <button 
                            onClick={() => {
                              triggerHaptic(50);
                              finishMeetingRecording();
                            }}
                            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl cursor-pointer transition-colors flex items-center gap-1.5 shadow-md shadow-purple-950/40"
                          >
                            <Check size={14} /> Output notes page
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* View D: INBOX PAGE (Image 5) */}
                {activeTab === 'inbox' && (
                  <div className="flex-1 flex flex-col justify-center h-full min-h-[400px] animate-in fade-in duration-200">
                    <div className="flex flex-col items-center justify-center text-center py-10 space-y-4">
                      
                      {/* Check inside box customized inbox logo */}
                      <div className="w-16 h-16 rounded-2xl bg-stone-900/80 border border-stone-800 flex flex-col items-center justify-center text-stone-400 shadow-lg">
                        <CheckSquare size={24} className="text-emerald-400" />
                      </div>

                      <div className="space-y-1.5 px-6">
                        <h3 className="text-[17px] font-bold text-stone-105 font-sans">You&apos;re all caught up</h3>
                        <p className="text-[13px] text-stone-400 leading-relaxed font-sans px-4">
                          You&apos;ll be notified here for @mentions, page activity and more
                        </p>
                      </div>

                      <button 
                        onClick={() => showToast('Inbox filters will sync with workspace activity in a future update.', 'info')}
                        className="text-[#007AFF] text-[15px] font-bold hover:underline cursor-pointer transition-all pt-1"
                      >
                        Change filter
                      </button>
                    </div>
                  </div>
                )}

              </div>

              {/* Dynamic Sleek Floating Bottom bar/dock exactly as shown */}
              <div 
                style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}
                className="pt-3 px-6 border-t border-stone-850 flex items-center justify-between bg-[#191919] select-none shrink-0 relative z-30 pb-safe"
              >
                {/* Search button (Image 1, Left) */}
                <button 
                  onClick={() => setIsSearchOverlayOpen(true)}
                  className="w-11 h-11 rounded-full bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800 flex items-center justify-center cursor-pointer hover:scale-105 transition-all shadow-md shrink-0"
                >
                  <Search size={18} />
                </button>

                {/* Ask AI Pill (Image 1, Center) */}
                <button 
                  onClick={() => setIsAiChatOpen(true)}
                  className="flex-1 max-w-[200px] h-11 mx-3 rounded-full bg-stone-900 hover:bg-stone-800 border border-stone-800 flex items-center justify-center px-4 gap-2 text-stone-300 cursor-pointer hover:scale-[1.02] transition-all duration-200 shadow-md group shrink-0"
                >
                  {/* MotionAI split face outline representation */}
                  <div className="w-5 h-5 bg-white text-black font-bold font-sans text-[11px] rounded-full flex items-center justify-center group-hover:rotate-12 transition-transform shadow-sm">
                    {/* Simplified face symbol of split eye */}
                    👁
                  </div>
                  <span className="font-sans font-bold text-[14px]">Ask AI</span>
                </button>

                {/* Compose button (Image 1, Right) */}
                <button 
                  onClick={() => setIsComposeMenuOpen(!isComposeMenuOpen)}
                  className={`w-11 h-11 rounded-full text-stone-300 border flex items-center justify-center cursor-pointer hover:scale-105 transition-all shadow-md shrink-0 ${
                    isComposeMenuOpen 
                      ? 'bg-purple-650 border-purple-500 hover:bg-purple-700' 
                      : 'bg-stone-900 border-stone-850 hover:bg-stone-800'
                  }`}
                >
                  {isComposeMenuOpen ? <X size={18} /> : <Edit3 size={18} />}
                </button>
              </div>

            </div>
          ) : activeMobilePage?.pageType && activeMobilePage.pageType !== 'block' ? (
            <MobileRichPageFallback
              page={activeMobilePage}
              onBack={() => {
                setMobileEditingPageId(null);
                setAddingBlockType(null);
              }}
              onOpenDesktopHint={onRequestDesktopView}
            />
          ) : activeMobilePage ? (
            <MobileBlockEditorView
              page={activeMobilePage}
              onUpdatePage={onUpdatePage}
              onBack={() => {
                setMobileEditingPageId(null);
                setAddingBlockType(null);
              }}
              onLockWorkspace={() => window.dispatchEvent(new CustomEvent('motionai-local-lock'))}
            />
          ) : null}

          {/* 2. OVERLAY: SWITCH WORKSPACE & PROFILE DROPDOWN (Image 2) */}
          {isWorkspaceMenuOpen && (
            <div className="absolute inset-0 bg-black/70 backdrop-blur-xs z-50 flex flex-col justify-end">
              <div className="absolute inset-0" onClick={() => setIsWorkspaceMenuOpen(false)} />
              
              <div className="h-2/3 bg-[#1F1F1F] rounded-t-[28px] border-t border-white/10 p-5 flex flex-col justify-between shadow-2xl relative z-20 animate-in slide-in-from-bottom duration-250 select-none">
                <div className="space-y-4">
                  
                  {/* Top drag pill handle */}
                  <div className="w-10 h-1 bg-stone-700 rounded-full mx-auto" />
                  
                  {/* Header profile details */}
                  <div className="flex items-center gap-3 pt-2">
                    <div className="w-10 h-10 rounded-full bg-stone-800 border border-stone-700 text-stone-200 text-sm font-bold font-mono flex items-center justify-center">
                      {(workspaceName.trim()[0] || 'W').toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-[15px] font-bold text-white">{workspaceName}</h4>
                      <p className="text-[11px] text-stone-500">{userEmail || 'Local workspace'}</p>
                    </div>
                  </div>

                  {/* Menu buttons (Image 2) */}
                  <div className="space-y-0.5 pt-4">
                    
                    {/* Item A: Switch Workspace */}
                    <button 
                      onClick={() => {
                        setIsWorkspaceMenuOpen(false);
                        onOpenPages?.();
                      }}
                      className="w-full flex items-center gap-3.5 px-3.5 py-3 text-left hover:bg-stone-850 rounded-xl transition-colors cursor-pointer"
                    >
                      <ArrowRightLeft size={16} className="text-stone-400" />
                      <span className="text-[14px] font-semibold text-stone-200">All pages</span>
                    </button>



                    {/* Item C: Settings */}
                    <button 
                      onClick={() => {
                        setIsWorkspaceMenuOpen(false);
                        if (onOpenSettings) {
                          onOpenSettings();
                        } else {
                          setActiveSubDialog('settings');
                        }
                      }}
                      className="w-full flex items-center gap-3.5 px-3.5 py-3 text-left hover:bg-stone-850 rounded-xl transition-colors cursor-pointer"
                    >
                      <Settings size={16} className="text-stone-400" />
                      <span className="text-[14px] font-semibold text-stone-200">Settings</span>
                    </button>

                    {/* Item D: Members */}
                    <button 
                      onClick={() => {
                        setIsWorkspaceMenuOpen(false);
                        setActiveSubDialog('members');
                      }}
                      className="w-full flex items-center gap-3.5 px-3.5 py-3 text-left hover:bg-stone-850 rounded-xl transition-colors cursor-pointer"
                    >
                      <Users size={16} className="text-stone-400" />
                      <span className="text-[14px] font-semibold text-stone-200">Members</span>
                    </button>

                    {/* Item E: Bin */}
                    <button 
                      onClick={() => {
                        setIsWorkspaceMenuOpen(false);
                        setActiveSubDialog('bin');
                      }}
                      className="w-full flex items-center gap-3.5 px-3.5 py-3 text-left hover:bg-stone-850 rounded-xl transition-colors cursor-pointer"
                    >
                      <Trash2 size={16} className="text-stone-400" />
                      <span className="text-[14px] font-semibold text-stone-200">Bin</span>
                    </button>

                    {/* Item F: Help and support */}
                    <button 
                      onClick={() => {
                        setIsWorkspaceMenuOpen(false);
                        setActiveSubDialog('help');
                      }}
                      className="w-full flex items-center gap-3.5 px-3.5 py-3 text-left hover:bg-stone-850 rounded-xl transition-colors cursor-pointer"
                    >
                      <HelpCircle size={16} className="text-stone-400" />
                      <span className="text-[14px] font-semibold text-stone-200">Help and support</span>
                    </button>

                  </div>
                </div>

                {/* Close drawer banner */}
                <button 
                  onClick={() => setIsWorkspaceMenuOpen(false)}
                  className="w-full text-center py-2 text-stone-500 hover:text-stone-300 font-semibold text-xs border-t border-stone-850 cursor-pointer pt-3 mt-4"
                >
                  Close Menu Drawer
                </button>
              </div>
            </div>
          )}

          {/* 3. OVERLAY: CHAT ASSISTANT (Image 7) */}
          {isAiChatOpen && (
            <div className="absolute inset-0 bg-[#191919] z-50 flex flex-col justify-between select-none animate-in fade-in zoom-in-95 duration-200">
              
              {/* Header block with Clock icon & Create new logs */}
              <div 
                style={{ paddingTop: 'calc(12px + env(safe-area-inset-top))' }}
                className="pb-2.5 px-4 bg-stone-900 border-b border-stone-850 flex items-center justify-between shrink-0 select-none pt-safe"
              >
                <button 
                  onClick={() => {
                    setChatMessages([
                      { role: 'model', text: 'History reset correctly. Start typing a new query...', id: 'reset-ai' }
                    ]);
                  }}
                  className="w-8 h-8 rounded-full hover:bg-stone-800 text-stone-400 hover:text-stone-200 flex items-center justify-center cursor-pointer transition-colors"
                  title="Reset history log"
                >
                  <Clock size={16} />
                </button>

                {/* Center logo label */}
                <div className="flex flex-col items-center select-none scale-102">
                  <div className="w-7 h-7 bg-white text-black font-sans font-bold text-[13px] rounded-full flex items-center justify-center shadow-lg border border-white/20 select-none animate-bounce">
                    👁
                  </div>
                  <span className="text-[11.5px] font-bold tracking-widest text-[#E3E3E3] uppercase font-mono mt-1 select-none">MotionAI</span>
                </div>

                <button 
                  onClick={() => setIsAiChatOpen(false)}
                  className="w-8 h-8 rounded-full hover:bg-stone-800 text-stone-400 hover:text-stone-200 flex items-center justify-center cursor-pointer font-bold font-mono transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Conversational timeline */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 text-left select-none scroll-smooth">
                {chatMessages.map((msg, idx) => (
                  <div 
                    key={msg.id || idx} 
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in duration-200`}
                  >
                    <div className={`max-w-[85%] rounded-2xl p-3 text-sm select-text ${
                      msg.role === 'user' 
                        ? 'bg-purple-650 text-white font-medium rounded-tr-xs shadow-md' 
                        : 'bg-stone-900 text-stone-200 rounded-tl-xs border border-stone-800 leading-relaxed font-sans'
                    }`}>
                      {msg.role === 'user' ? (
                        <div className="whitespace-pre-wrap">{msg.text}</div>
                      ) : (
                        <div className="space-y-1.5 leading-relaxed font-sans">
                          {msg.text.split('\n').map((line, lineIdx) => {
                            const match = line.match(/^(\s*)-\s*\[\s*\]\s*(.*)$/);
                            if (match) {
                              const indent = match[1];
                              const taskContent = match[2].trim();
                              const taskKey = `${msg.id || idx}-${lineIdx}`;
                              const status = taskStatus[taskKey] || 'idle';
                              return (
                                <div 
                                  key={lineIdx} 
                                  style={{ paddingLeft: `${indent.length * 8}px` }}
                                  className="flex items-center justify-between gap-3 bg-[#1D1D1D] hover:bg-[#252525] p-2.5 rounded-xl border border-stone-800/60 my-1 group transition-all duration-200 select-none animate-in fade-in zoom-in-95"
                                >
                                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                                    <span className="text-purple-400 mt-1 shrink-0 font-bold">&#9634;</span>
                                    <span className="text-[13px] text-stone-200 break-words leading-snug font-medium select-text">
                                      {taskContent}
                                    </span>
                                  </div>
                                  
                                  <button
                                    onClick={() => handleAddTaskToGoogle(taskContent, taskKey)}
                                    disabled={status === 'loading' || status === 'success'}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold font-sans tracking-wide shrink-0 transition-all ${
                                      status === 'success'
                                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                                        : status === 'loading'
                                        ? 'bg-purple-950/40 border border-purple-500/20 text-purple-300 animate-pulse cursor-not-allowed'
                                        : status === 'error'
                                        ? 'bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-stone-800'
                                        : 'bg-purple-650 hover:bg-purple-700 active:scale-95 text-white shadow-sm cursor-pointer'
                                    }`}
                                  >
                                    {status === 'success' ? (
                                      <>
                                        <Check size={11} className="stroke-[3]" />
                                        <span>Saved</span>
                                      </>
                                    ) : status === 'loading' ? (
                                      <>
                                        <RefreshCw size={11} className="animate-spin" />
                                        <span>Saving</span>
                                      </>
                                    ) : (
                                      <>
                                        <Plus size={11} className="stroke-[3]" />
                                        <span>Add Task</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              );
                            }
                            return (
                              <div key={lineIdx} className="whitespace-pre-wrap select-text">
                                {line}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isAiTyping && (
                  <div className="flex justify-start animate-pulse">
                    <div className="bg-stone-900 border border-stone-800 rounded-2xl rounded-tl-xs p-3 text-xs text-purple-400 flex items-center gap-1.5 font-bold font-sans">
                      <Sparkles size={12} className="animate-spin" />
                      <span>MotionAI thinking...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Bot preset action query rows */}
              <div className="px-3 py-1.5 overflow-x-auto no-scrollbar flex gap-1.5 shrink-0 bg-stone-900/40 border-t border-stone-850">
                {PRESET_QUERIES.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendAiChat(p)}
                    className="px-3 py-1.5 bg-stone-850 hover:bg-stone-800 text-[#E3E3E3] border border-stone-800 rounded-lg text-xs font-semibold shrink-0 cursor-pointer whitespace-nowrap transition-transform hover:scale-102"
                  >
                    ✨ {p}
                  </button>
                ))}
              </div>

              {/* Bottom Custom Prompt Box (exactly like Image 7) */}
              <div 
                style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}
                className="bg-[#1A1A1A] p-4 border-t border-stone-850 space-y-3 select-none pb-safe"
              >
                <div className="bg-[#242424] rounded-2xl border border-stone-800 p-2 flex items-center gap-2">
                  <button 
                    onClick={() => showToast('Shortcuts are saved to this device.', 'success')}
                    className="w-8 h-8 rounded-full bg-stone-850 text-stone-400 hover:text-stone-200 flex items-center justify-center cursor-pointer shrink-0 transition-colors"
                  >
                    <Plus size={16} />
                  </button>

                  <button 
                    className="w-8 h-8 rounded-full bg-stone-850 text-stone-400 hover:text-stone-200 flex items-center justify-center cursor-pointer shrink-0 transition-colors"
                  >
                    <Sliders size={14} />
                  </button>

                  <input 
                    type="text"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    placeholder={isChatVoiceActive ? "🎙️ Dictating to AI..." : "Ask, search or make anything..."}
                    className="flex-1 bg-transparent text-sm text-stone-100 outline-none placeholder-stone-500 min-w-0"
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSendAiChat();
                    }}
                  />

                  {/* Mic Dictation trigger inside AI Chat */}
                  <button 
                    type="button"
                    onClick={handleChatVoiceDictate}
                    className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer shrink-0 transition-all ${
                      isChatVoiceActive 
                        ? "bg-red-500 text-white animate-pulse" 
                        : "bg-stone-850 text-stone-400 hover:text-[#007AFF] hover:bg-stone-800"
                    }`}
                    title={isChatVoiceActive ? "Stop speech typing" : "Dictate your question"}
                  >
                    <Mic size={14} />
                  </button>

                  <button 
                    onClick={() => handleSendAiChat()}
                    disabled={!chatInput.trim() || isAiTyping}
                    className="w-8 h-8 rounded-full bg-purple-650 hover:bg-purple-700 disabled:opacity-40 text-white flex items-center justify-center cursor-pointer shrink-0 transition-all shadow"
                  >
                    <Send size={13} />
                  </button>
                </div>

                {/* Custom tactile soft-keyboard for easy mobile preview entry! */}
                <div className="pt-1.5 border-t border-stone-800 select-none">
                  <div className="grid grid-cols-10 gap-1 text-[11px] font-semibold text-center select-none text-stone-400">
                    {["Q","W","E","R","T","Y","U","I","O","P"].map(l => (
                      <button 
                        key={l}
                        onClick={() => setChatInput(v => v + l.toLowerCase())}
                        className="py-1.5 bg-stone-850 hover:bg-stone-800 rounded-sm cursor-pointer select-none active:bg-purple-900 border border-transparent active:border-purple-800 transition-all font-mono"
                      >
                        {l}
                      </button>
                    ))}
                    {["A","S","D","F","G","H","J","K","L"].map((l, i) => (
                      <button 
                        key={l}
                        onClick={() => setChatInput(v => v + l.toLowerCase())}
                        className={`py-1.5 bg-stone-850 hover:bg-stone-800 rounded-sm cursor-pointer select-none font-mono ${i===0?'col-start-1 col-span-1':''}`}
                      >
                        {l}
                      </button>
                    ))}
                    {["Z","X","C","V","B","N","M"].map((l, i) => (
                      <button 
                        key={l}
                        onClick={() => setChatInput(v => v + l.toLowerCase())}
                        className={`py-1.5 bg-stone-850 hover:bg-stone-800 rounded-sm cursor-pointer select-none font-mono ${i===0?'col-start-2 col-span-1':''}`}
                      >
                        {l}
                      </button>
                    ))}
                    <button 
                      onClick={() => setChatInput('')}
                      className="col-span-3 py-1.5 bg-stone-800 hover:bg-stone-750 text-[10px] uppercase tracking-wide text-red-400 rounded-sm font-semibold select-none cursor-pointer"
                    >
                      Clear
                    </button>
                    <button 
                      onClick={() => setChatInput(v => v + ' ')}
                      className="col-span-5 py-1.5 bg-stone-800 hover:bg-stone-750 rounded-sm select-none cursor-pointer font-bold text-stone-200"
                    >
                      Space
                    </button>
                    <button 
                      onClick={() => setChatInput(v => v.slice(0, -1))}
                      className="col-span-2 py-1.5 bg-stone-800 hover:bg-stone-750 rounded-sm select-none text-stone-500 cursor-pointer font-bold font-mono"
                    >
                      ⌫
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* 4. OVERLAY: SEARCH MODULE (Image 6) */}
          {isSearchOverlayOpen && (
            <div className="absolute inset-0 bg-[#191919] z-50 flex flex-col justify-between select-none animate-in fade-in zoom-in-95 duration-200">
              
              <div 
                style={{ paddingTop: 'calc(16px + env(safe-area-inset-top))' }}
                className="flex-1 flex flex-col overflow-hidden px-4 pb-4 space-y-4 pt-safe"
              >
                {/* Custom search head (Image 6) */}
                <div className="flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-1.5 select-none text-left">
                    <span className="text-xl">👁</span>
                    <h3 className="text-xs font-bold text-stone-400 uppercase font-mono tracking-wider">Ask AI in {workspaceName}</h3>
                  </div>
                  <button 
                    onClick={() => setIsSearchOverlayOpen(false)}
                    className="w-7 h-7 rounded-full bg-stone-850 hover:bg-stone-800 text-stone-400 flex items-center justify-center font-bold tracking-normal cursor-pointer select-none"
                  >
                    ✕
                  </button>
                </div>

                {/* Input block filter */}
                <div className="flex items-center gap-2 bg-[#252525] rounded-xl border border-stone-800 p-2.5 shrink-0">
                  <Search size={15} className="text-stone-500" />
                  <input 
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search or ask AI"
                    className="flex-1 bg-transparent text-sm text-stone-100 outline-none placeholder-stone-500"
                  />
                  <button className="text-stone-500 hover:text-stone-300 p-0.5">
                    <Sliders size={14} />
                  </button>
                </div>

                {/* List categories - scrollable to ensure no vertical overscroll leaks */}
                <div className="flex-1 overflow-y-auto overscroll-contain scroll-smooth [webkit-overflow-scrolling:touch] space-y-4 pr-1 text-left">
                  
                  {/* Today Group */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider font-mono">Today</span>
                    
                    <button 
                      onClick={() => {
                        const target = pages.find(p => p.title.toLowerCase().includes("book") || p.title.toLowerCase().includes("agent"));
                        if (target) {
                          setMobileEditingPageId(target.id);
                        } else {
                          createNewMobilePage('📚', 'Agent idea: Trending book summarizer + 15–30 min "full book" audio');
                        }
                        setIsSearchOverlayOpen(false);
                      }}
                      className="w-full flex items-start gap-3 p-3 hover:bg-stone-850 rounded-xl transition-colors cursor-pointer"
                    >
                      <span className="text-lg">📚</span>
                      <div className="min-w-0">
                        <h4 className="text-[13px] font-semibold text-[#E3E3E3] leading-snug">Agent idea: Trending book summarizer + 15–30 min &ldquo;full book&rdquo; audio</h4>
                        <p className="text-[11px] text-stone-500 mt-0.5">in private pages</p>
                      </div>
                    </button>
                  </div>

                  {/* This Month Group */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider font-mono">This month</span>

                    <button 
                      onClick={() => {
                        const target = pages.find(p => p.title.toLowerCase().includes("start") || p.title.toLowerCase().includes("mobile"));
                        if (target) {
                          setMobileEditingPageId(target.id);
                        } else {
                          createNewMobilePage('👋', 'Getting Started on Mobile');
                        }
                        setIsSearchOverlayOpen(false);
                      }}
                      className="w-full flex items-start gap-3 p-3 hover:bg-stone-850 rounded-xl transition-colors cursor-pointer"
                    >
                      <span className="text-lg">👋</span>
                      <div className="min-w-0">
                        <h4 className="text-[13px] font-semibold text-[#E3E3E3] leading-snug">Getting Started on Mobile</h4>
                        <p className="text-[11px] text-stone-500 mt-0.5">in private pages</p>
                      </div>
                    </button>
                  </div>

                  {/* Dynamically search results fallback */}
                  {searchQuery.trim() !== '' && filteredSearchPages.length === 0 && (
                    <div className="p-6 text-center text-stone-600 bg-stone-900 rounded-xl border border-stone-800">
                      No matching pages found for &ldquo;{searchQuery}&rdquo;
                    </div>
                  )}

                </div>
              </div>

              {/* Close Search Button bottom */}
              <div 
                style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}
                className="p-4 border-t border-stone-850 bg-stone-900/30 shrink-0 pb-safe"
              >
                <button 
                  onClick={() => setIsSearchOverlayOpen(false)}
                  className="w-full py-2 bg-stone-850 hover:bg-stone-800 rounded-xl text-stone-300 font-bold text-xs cursor-pointer select-none"
                >
                  Close Search Overlay
                </button>
              </div>

            </div>
          )}

          {/* 5. OVERLAY: COMPOSE FLOATING SUBMENU (Image 8) */}
          {isComposeMenuOpen && (
            <div className="absolute inset-0 bg-transparent z-40 flex flex-col justify-end select-none">
              {/* Back blocker clicker */}
              <div className="absolute inset-0 bg-black/40 backdrop-blur-3xs" onClick={() => setIsComposeMenuOpen(false)} />
              
              {/* Menu pops from compose element right corner (Slide up popup modal image 8) */}
              <div className="absolute bottom-24 right-6 w-52 bg-[#1F1F1F] rounded-2xl border border-white/10 p-2.5 shadow-2xl z-50 animate-in slide-in-from-bottom-3 duration-200">
                <div className="space-y-0.5 text-left">
                  
                  {/* Option A: AI Meeting Notes */}
                  <button 
                    type="button"
                    onClick={() => {
                      setIsComposeMenuOpen(false);
                      void startMeetingRecording();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-stone-800 rounded-lg text-stone-200 transition-colors cursor-pointer group min-h-11"
                  >
                    <Mic size={15} className="text-purple-400 group-hover:scale-110 transition-transform flex-shrink-0" />
                    <span className="text-[13.5px] font-bold">AI Meeting Notes</span>
                  </button>

                  {/* Option B: Chat */}
                  <button 
                    onClick={() => {
                      setIsComposeMenuOpen(false);
                      setIsAiChatOpen(true);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-stone-800 rounded-lg text-stone-200 transition-colors cursor-pointer group"
                  >
                    <MessageSquare size={15} className="text-blue-400 group-hover:scale-110 transition-transform flex-shrink-0" />
                    <span className="text-[13.5px] font-bold">Chat</span>
                  </button>

                  {/* Option C: Page */}
                  <button 
                    onClick={() => createNewMobilePage()}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-stone-800 rounded-lg text-stone-200 transition-colors cursor-pointer group"
                  >
                    <FileText size={15} className="text-emerald-400 group-hover:scale-110 transition-transform flex-shrink-0" />
                    <span className="text-[13.5px] font-bold">Page</span>
                  </button>

                </div>
              </div>
            </div>
          )}

          {/* 6. OVERLAYS: SUB DIALOGS FOR SETTINGS / UPGRADE / MEMBERS / BIN / HELP */}
          {activeSubDialog && (
            <div className="absolute inset-0 bg-black/85 backdrop-blur-xs z-50 flex items-center justify-center p-4">
              <div className="w-full max-w-[340px] bg-[#1F1F1F] rounded-2xl border border-stone-800 p-5 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
                
                {/* Settings Dialog */}
                {activeSubDialog === 'settings' && (
                  <div className="space-y-3 text-left">
                    <h3 className="font-bold text-base text-stone-100 text-center pb-1">Workspace Settings</h3>
                    
                    <div className="space-y-2.5 text-xs text-stone-200">
                      <div className="flex justify-between items-center bg-stone-900/60 p-2.5 rounded-lg border border-stone-850">
                        <span>Workspace Notifications</span>
                        <div className="w-8 h-4 bg-purple-650 rounded-full p-0.5 cursor-pointer flex justify-end">
                          <div className="w-3 h-3 bg-white rounded-full" />
                        </div>
                      </div>

                      <div className="flex justify-between items-center bg-stone-900/60 p-2.5 rounded-lg border border-stone-850">
                        <span>Local Document Storage</span>
                        <span className="text-stone-500 bg-stone-850 px-1.5 py-0.5 rounded font-mono text-[9px] font-bold">Enabled</span>
                      </div>

                      <div className="flex justify-between items-center bg-stone-900/60 p-2.5 rounded-lg border border-stone-850">
                        <span>Auto-Backup Pool</span>
                        <div className="w-8 h-4 bg-purple-650 rounded-full p-0.5 cursor-pointer flex justify-end">
                          <div className="w-3 h-3 bg-white rounded-full" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Members Dialog */}
                {activeSubDialog === 'members' && (
                  <div className="space-y-3 text-left">
                    <h3 className="font-bold text-base text-stone-100 text-center">Active Members</h3>
                    <p className="text-[11px] text-stone-400 text-center leading-normal">
                      Share workspaces, trigger dynamic snapshots, or view collaborators.
                    </p>
                    
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {[
                        { name: userEmail ? `${userEmail} (you)` : 'You (local)', role: 'Owner', active: true },
                      ].map((m, i) => (
                        <div key={i} className="flex justify-between items-center p-2 bg-stone-900 rounded-lg border border-stone-850 text-xs">
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full shrink-0" />
                            <span className="font-semibold text-stone-200">{m.name}</span>
                          </div>
                          <span className="text-[10px] text-stone-500 font-mono font-bold uppercase">{m.role}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bin Dialog */}
                {activeSubDialog === 'bin' && (
                  <div className="space-y-3 text-left">
                    <h3 className="font-bold text-base text-stone-100 text-center">Recycle Bin</h3>
                    <p className="text-[11px] text-stone-400 text-center">
                      Deleted documents are stored here. Restoring adds them back instantly.
                    </p>
                    
                    {trashEntries.length === 0 ? (
                      <div className="p-4 text-center text-xs text-stone-600 bg-stone-900 rounded-lg border border-stone-850">
                        Your recycle bin is empty.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {trashEntries.map(entry => (
                          <div key={entry.page.id} className="flex items-center justify-between gap-2 p-2 bg-stone-900 rounded-lg border border-stone-850 text-xs">
                            <span className="truncate font-medium text-stone-200">{entry.page.icon} {entry.page.title || 'Untitled'}</span>
                            <button
                              type="button"
                              onClick={() => {
                                onRestorePage(entry.page);
                                setTrashEntries(getTrash(workspaceId));
                                showToast('Page restored', 'success');
                              }}
                              className="shrink-0 min-h-9 px-3 rounded-lg bg-emerald-700 text-white font-bold"
                            >
                              Restore
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            clearTrash(workspaceId);
                            setTrashEntries([]);
                            showToast('Bin emptied', 'info');
                          }}
                          className="w-full min-h-9 text-[10px] font-bold text-red-400 hover:text-red-300"
                        >
                          Empty bin permanently
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Help Dialog */}
                {activeSubDialog === 'help' && (
                  <div className="space-y-3 text-left">
                    <h3 className="font-bold text-base text-stone-100 text-center">Help & Support</h3>
                    <div className="space-y-2 text-xs text-stone-300">
                      <p className="font-semibold text-stone-100">💡 Tip: / slash commands</p>
                      <p className="leading-relaxed text-stone-400 text-[11px]">
                        Inside pages, you can add dynamic list blocks using paragraph buttons or edit values in real-time.
                      </p>
                      <p className="font-semibold text-stone-100">🎙️ Tip: Voice meeting synthesis</p>
                      <p className="leading-relaxed text-stone-400 text-[11px]">
                        Tap AI Meeting Notes inside the compose tab to record real-time speech logs and convert them to written draft databases instantly.
                      </p>
                    </div>
                  </div>
                )}

                {/* Ok button to pull dialog outline back */}
                <button 
                  onClick={() => setActiveSubDialog(null)}
                  className="w-full py-2 bg-stone-800 hover:bg-stone-750 text-stone-200 font-bold text-xs rounded-xl cursor-pointer transition-colors"
                >
                  OK, Got it
                </button>

              </div>
            </div>
          )}

        </div>

        {/* iOS standalone PWA installer instructions dialog overlay */}
        {showIOSInstallDialog && (
          <div className="absolute bottom-4 left-4 right-4 bg-stone-900 border border-stone-850 rounded-2xl p-4 shadow-2xl z-50 text-left space-y-3 animate-in slide-in-from-bottom-5 duration-300">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center text-white font-sans font-extrabold text-[15px] select-none">
                  M
                </div>
                <div>
                  <h4 className="text-xs font-bold text-stone-200">Install MotionAI</h4>
                  <p className="text-[10px] text-stone-500">Add to Home Screen for fullscreen + mic access</p>
                </div>
              </div>
              <button 
                onClick={() => setShowIOSInstallDialog(false)}
                className="text-stone-500 hover:text-stone-300 p-0.5 cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>
            
            <div className="text-[11px] text-stone-350 space-y-2 leading-relaxed font-sans">
              <p>Add to your home screen for native fullscreen view and notch optimization:</p>
              <ol className="list-decimal list-inside space-y-1.5 text-stone-400 font-medium">
                <li>
                  Tap the iOS Share button <span className="inline-block align-middle font-bold text-stone-200 px-1 bg-stone-850 rounded">⎙</span> (square with arrow up).
                </li>
                <li>
                  Scroll down the options list and select <span className="text-stone-200 font-bold">Add to Home Screen</span>.
                </li>
                <li>
                  Tap <span className="text-purple-400 font-bold">Add</span> in the top right corner.
                </li>
              </ol>
            </div>
          </div>
        )}

      </div>

      {!isCompactDevice && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 max-w-md text-center">
          <p className="text-stone-500 text-xs font-mono select-none">
            Desktop mobile preview — open on your phone and Add to Home Screen for the full PWA.
          </p>
        </div>
      )}

    </div>
  );
}
