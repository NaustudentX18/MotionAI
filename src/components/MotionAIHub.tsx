import React, { useState, useEffect } from "react";
import {
  Sparkles,
  CheckCircle2,
  Circle,
  Terminal,
  Copy,
  ExternalLink,
  RefreshCw,
  Flame,
  Database,
  Lock,
  Network,
  Code,
  BookOpen,
  HelpCircle,
  Smartphone,
  Laptop,
  Layers,
  ArrowRight,
  ShieldAlert,
  Info,
} from "lucide-react";

interface RoadmapItem {
  id: string;
  category: "Local" | "AI" | "Security" | "UI" | "Integrations";
  title: string;
  difficulty: "Medium" | "Hard" | "Extreme";
  legacyGap: string;
  solution: string;
  checked: boolean;
}

export function MotionAIHub() {
  // Navigation tabs inside the Hub
  const [activeTab, setActiveTab] = useState<
    "roadmap" | "deployment" | "architecture" | "branding"
  >("roadmap");

  // Active Loading state
  const [isLoadingActive, setIsLoadingActive] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [loadingLogs, setLoadingLogs] = useState<string[]>([]);

  // Local Roadmaps state synced to localStorage
  const [roadmap, setRoadmap] = useState<RoadmapItem[]>(() => {
    const saved = localStorage.getItem("motion_ai_roadmap");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error reading roadmap from local storage", e);
      }
    }
    return [
      {
        id: "gap-1",
        category: "Local",
        title: "Offline-First & Local-First Collibrative DB",
        difficulty: "Hard",
        legacyGap:
          "Traditional web tools rely heavily on server roundtrips, making editing on flights or unstable connections lag-prone.",
        solution:
          "Implement Yjs (CRDTs) or Automerge synced over IndexedDB inside the web browser with background replication.",
        checked: false,
      },
      {
        id: "gap-2",
        category: "AI",
        title: "Local Documents Semantics Core (RAG)",
        difficulty: "Extreme",
        legacyGap:
          "Standard document AI searches globally block-by-block, but lacks localized multi-modal filtering or pipeline customization.",
        solution:
          "Integrate Vector store indexing (e.g. Pinecone or a local WASM-based Vector DB) on client pages to run semantic searches.",
        checked: true,
      },
      {
        id: "gap-3",
        category: "Security",
        title: "User-Held Cryptographic Key (E2EE) & BYOK",
        difficulty: "Extreme",
        legacyGap:
          "Typical cloud-hosted suites grant system admins access to notebooks; strict groups require custom encryption keys.",
        solution:
          "Add AES-GCM 256-bit encryption in the client using the browser Web Crypto API before syncing content to Firebase. Bring-Your-Own-Key protocols.",
        checked: false,
      },
      {
        id: "gap-4",
        category: "UI",
        title: "Bi-directional Backlink Visual Network Graph",
        difficulty: "Medium",
        legacyGap:
          "Legacy platforms offer list-based links inside document metadata but lack immersive visual maps of document connections.",
        solution:
          "Inject a D3.js force-directed interactive node canvas mapping the referencing ids of blocks across pages.",
        checked: false,
      },
      {
        id: "gap-5",
        category: "Integrations",
        title: "Docker Self-Host Stack with Port Ingress",
        difficulty: "Medium",
        legacyGap:
          "Standard cloud suites are proprietary and cloud-hosted only, preventing offline or sovereign network deployment.",
        solution:
          "Provide a robust docker-compose stack mapping port 3000 with a local SQLite backend running on custom NAS environments.",
        checked: true,
      },
      {
        id: "gap-6",
        category: "Local",
        title: "P2P WebRTC Collaboration Mesh",
        difficulty: "Extreme",
        legacyGap:
          "Centralized platform servers are needed to view real-time cursor actions or coordinate simultaneous updates.",
        solution:
          "Decentralized multiplayer scaling using WebRTC networking. Devices sync and collaborate locally without internet.",
        checked: false,
      },
      {
        id: "gap-7",
        category: "UI",
        title: "Generative Infinite Spatial Canvas",
        difficulty: "Hard",
        legacyGap:
          "Block editors are traditionally strictly vertical and linear, forcing users into compartmentalized text boundaries.",
        solution:
          "Fully integrated tldraw/Fabric.js spatial canvas blocks dynamically parsed semantically by the AI model.",
        checked: false,
      },
      {
        id: "gap-8",
        category: "Integrations",
        title: "Secure Local Lambda Automations",
        difficulty: "Hard",
        legacyGap:
          "Typically demands premium external flow services like Zapier or Make.com to orchestrate workflow patterns.",
        solution:
          "Built-in webhooks and local triggered automations using isolated WASM runtimes.",
        checked: false,
      },
      {
        id: "gap-9",
        category: "Local",
        title: "Native Core Performance (Tauri integration)",
        difficulty: "Medium",
        legacyGap:
          "Heavy app wrapper engines chew through high machine RAM without tight, integrated operating system callbacks.",
        solution:
          'Compiling out decoupled frontend natively via Tauri (Rust backend), enabling zero-latency "Spotlight" search.',
        checked: false,
      },
      {
        id: "gap-10",
        category: "AI",
        title: "Multi-modal AI Ingestors (Whisper & Parsers)",
        difficulty: "Hard",
        legacyGap:
          "No built-in capability exists to passively buffer surrounding speech files or read flat structured text out of scanned documents.",
        solution:
          "Client-side speech-to-text integration using lightweight Whisper models in WASM.",
        checked: false,
      },
    ];
  });

  // Copied alert feedback
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Sync state changes
  useEffect(() => {
    localStorage.setItem("motion_ai_roadmap", JSON.stringify(roadmap));
  }, [roadmap]);

  // Handle deployment bootstrapper sequence
  const startBootloaderTest = () => {
    setIsLoadingActive(true);
    setLoadingStep(0);
    setLoadingLogs(["⚡ INITIALIZING MOTIONAI DEPLOYMENT HYPERVISOR v4.2"]);
  };

  useEffect(() => {
    if (!isLoadingActive) return;

    const steps = [
      {
        t: 400,
        txt: "🐳 Checking Docker Compose context & port 3000 ingress loops...",
      },
      {
        t: 900,
        txt: "🔑 Confirming Node.js environment variables (.env.example verification)...",
      },
      {
        t: 1400,
        txt: "📡 Handshaking Firebase Auth & Firestore rules sandbox pools...",
      },
      {
        t: 1900,
        txt: "🧠 Sparking connection to Gemini-3.5-flash AI core models...",
      },
      { t: 2400, txt: "🚀 ALL SYSTEMS GREEN! MotionAI active and optimized." },
    ];

    if (loadingStep < steps.length) {
      const timer = setTimeout(
        () => {
          setLoadingLogs((prev) => [...prev, steps[loadingStep].txt]);
          setLoadingStep((s) => s + 1);
        },
        steps[loadingStep].t - (loadingStep > 0 ? steps[loadingStep - 1].t : 0),
      );
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        setIsLoadingActive(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isLoadingActive, loadingStep]);

  const handleToggleRoadmap = (id: string) => {
    setRoadmap(
      roadmap.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item,
      ),
    );
  };

  const handleCopyCode = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // SVG Custom MotionAI logo block
  const MotionAiLogo = ({ size = 64, isDark = true }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="drop-shadow-lg"
    >
      {/* Structural Isometric Background cube/card */}
      <rect
        x="10"
        y="10"
        width="80"
        height="80"
        rx="18"
        fill={isDark ? "#121212" : "#FFFFFF"}
        stroke={isDark ? "#FFFFFF" : "#121212"}
        strokeWidth="6"
      />

      {/* Left Column of 'M' */}
      <path
        d="M26 72V28"
        stroke={isDark ? "#FFFFFF" : "#121212"}
        strokeWidth="7"
        strokeLinecap="round"
      />
      {/* Isometric angled folding elements inside M */}
      <path
        d="M26 28L50 54"
        stroke={isDark ? "#FFFFFF" : "#121212"}
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M50 54L74 28"
        stroke={isDark ? "#FFFFFF" : "#121212"}
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Right Column of 'M' */}
      <path
        d="M74 28V72"
        stroke={isDark ? "#FFFFFF" : "#121212"}
        strokeWidth="7"
        strokeLinecap="round"
      />

      {/* Isometric hand drawn stylistic hatch overlap aesthetic style */}
      <circle cx="50" cy="54" r="3.5" fill={isDark ? "#9333EA" : "#7C3AED"} />
    </svg>
  );

  const envContent = `# .env.example - MotionAI Deployment Configuration
PORT=3000
NODE_ENV=production

# Core Gemini API Key (Secret Server-Side Variable)
GEMINI_API_KEY=your_gemini_api_key_here

# Firebase Admin SDK Configuration (Optional for cloud sync)
FIREBASE_PROJECT_ID=thinking-reality-98gvj
`;

  const dockerContent = `# docker-compose.yml - Deploy MotionAI On Your NAS File Server
version: '3.8'

services:
  motionai:
    image: node:20-alpine
    container_name: motionai-core
    working_dir: /app
    volumes:
      - .:/app
    environment:
      - PORT=3000
      - NODE_ENV=production
      - GEMINI_API_KEY=\${GEMINI_API_KEY}
    ports:
      - "3000:3000"
    command: sh -c "npm install && npm run build && npm run start"
    restart: unless-stopped
`;

  // Calculated roadmap statistics
  const checkedCount = roadmap.filter((r) => r.checked).length;
  const totalCount = roadmap.length;
  const percentComplete = Math.round((checkedCount / totalCount) * 100);

  return (
    <div className="w-full min-h-screen bg-[#191919] text-[#E3E3E3] flex flex-col font-sans select-none overflow-y-auto pb-16">
      {/* Hero Header Space */}
      <header className="py-10 px-8 border-b border-stone-850 bg-[#121212]/40 text-center relative overflow-hidden shrink-0">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-stone-700 to-emerald-500 animate-pulse" />

        {/* Animated sparkling background details */}
        <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(#C084FC_1px,transparent_1px)] [background-size:16px_16px]" />

        <div className="max-w-4xl mx-auto flex flex-col items-center space-y-4">
          <div className="flex items-center gap-4">
            <MotionAiLogo size={68} isDark={true} />
            <div className="text-left">
              <span className="bg-purple-950/40 text-purple-400 border border-purple-900/40 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-widest font-mono">
                Repository Grounding Active
              </span>
              <h1 className="text-3xl font-extrabold text-white tracking-tight leading-none mt-1.5 flex items-center gap-2">
                Motion
                <span className="text-purple-400 font-serif italic">AI</span>{" "}
                Portal
              </h1>
              <p className="text-stone-400 text-xs font-medium font-mono mt-1">
                TRANSFORMING CLUTTER INTO ISOMETRIC STRUCTURED DATABASES
              </p>
            </div>
          </div>

          <p className="text-sm text-stone-300 max-w-xl leading-relaxed">
            Welcome to the centralized MotionAI flight commander. This
            interactive control dashboard presents the ultimate Workspace-gap
            analysis roadmap, automated deployment blueprints, and system
            architecture snapshots.
          </p>

          {/* Quick Stats Pillbar */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-xs">
            <div className="flex items-center gap-1.5 bg-stone-900/80 px-3.5 py-1.5 rounded-xl border border-stone-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-stone-400">Node Ingress:</span>
              <span className="font-mono font-bold text-emerald-400">
                Port 3000 Only
              </span>
            </div>

            <div className="flex items-center gap-1.5 bg-stone-900/80 px-3.5 py-1.5 rounded-xl border border-stone-800">
              <Sparkles size={13} className="text-purple-400" />
              <span className="text-stone-400">AI Engine:</span>
              <span className="font-mono font-bold text-purple-400">
                Gemini-3.5-flash
              </span>
            </div>

            <div className="flex items-center gap-1.5 bg-stone-900/80 px-3.5 py-1.5 rounded-xl border border-stone-800">
              <Database size={13} className="text-blue-400" />
              <span className="text-stone-400">Sync Pipeline:</span>
              <span className="font-mono font-bold text-blue-400">
                Firebase Auth + Core
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Grid View */}
      <div className="max-w-4xl w-full mx-auto px-4 sm:px-6 pt-8 flex-1 flex flex-col md:flex-row gap-6">
        {/* Tab Selection Column */}
        <aside className="w-full md:w-56 shrink-0 flex flex-row md:flex-col gap-1 overflow-x-auto no-scrollbar border-b md:border-b-0 md:border-r border-stone-850 pb-4 md:pb-0 md:pr-4">
          <button
            onClick={() => setActiveTab("roadmap")}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer shrink-0 text-left ${
              activeTab === "roadmap"
                ? "bg-purple-650/15 border border-purple-900/40 text-purple-300"
                : "hover:bg-stone-850 text-stone-400 hover:text-stone-200 border border-transparent"
            }`}
          >
            <Sparkles size={15} />
            <span>Feature Gaps Roadmap</span>
            <span className="ml-auto font-mono text-[9px] bg-stone-900 px-1.5 py-0.5 rounded-full text-stone-400 font-bold">
              {percentComplete}%
            </span>
          </button>

          <button
            onClick={() => setActiveTab("deployment")}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer shrink-0 text-left ${
              activeTab === "deployment"
                ? "bg-purple-650/15 border border-purple-900/40 text-purple-300"
                : "hover:bg-stone-850 text-stone-400 hover:text-stone-200 border border-transparent"
            }`}
          >
            <Terminal size={15} />
            <span>Deploy Master Guide</span>
          </button>

          <button
            onClick={() => setActiveTab("architecture")}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer shrink-0 text-left ${
              activeTab === "architecture"
                ? "bg-purple-650/15 border border-purple-900/40 text-purple-300"
                : "hover:bg-stone-850 text-stone-400 hover:text-stone-200 border border-transparent"
            }`}
          >
            <Layers size={15} />
            <span>Interactive Snapshot Map</span>
          </button>

          <button
            onClick={() => setActiveTab("branding")}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer shrink-0 text-left ${
              activeTab === "branding"
                ? "bg-purple-650/15 border border-purple-900/40 text-purple-300"
                : "hover:bg-stone-850 text-stone-400 hover:text-stone-200 border border-transparent"
            }`}
          >
            <Flame size={15} />
            <span>MotionAI Brand Kit</span>
          </button>

          <div className="pt-6 mt-6 border-t border-stone-850 hidden md:block">
            <button
              onClick={startBootloaderTest}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-stone-900 border border-stone-800 hover:bg-stone-800 rounded-xl text-xs font-bold font-mono transition-all text-stone-300 cursor-pointer"
            >
              <RefreshCw
                size={13}
                className={
                  isLoadingActive ? "animate-spin text-purple-500" : ""
                }
              />
              <span>Test Suite Bootloader</span>
            </button>
          </div>
        </aside>

        {/* Diagnostic Loading Console Dropdown block */}
        <div className="flex-1 min-w-0">
          {isLoadingActive && (
              <div className="mb-6 p-4 bg-black rounded-xl border border-stone-800 font-mono text-xs text-stone-300 space-y-1 shadow-inner relative">
                <div className="absolute top-2 right-2 flex items-center gap-1.5 text-[10px] text-purple-400 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-ping" />
                  <span>BOOT DIAGNOSTICS</span>
                </div>
                {loadingLogs.map((log, i) => (
                  <p
                    key={i}
                    className={
                      i === loadingLogs.length - 1
                        ? "text-purple-400 font-bold"
                        : "text-stone-400"
                    }
                  >
                    {log}
                  </p>
                ))}
              </div>
            )}

          {/* TAB CONTENT: 1. ROADMAP OVERVIEW */}
          {activeTab === "roadmap" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Progress Panel component */}
              <div className="bg-stone-900/50 rounded-2xl border border-stone-850 p-5 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-stone-300 uppercase letter tracking-wider font-mono">
                    Workspace Gaps Roadmap Analyzer
                  </span>
                  <span className="font-mono text-purple-400 font-bold">
                    {checkedCount} of {totalCount} Ideas Evaluated
                  </span>
                </div>
                <div className="w-full h-2.5 bg-[#1F1F1F] rounded-full overflow-hidden border border-stone-800">
                  <div
                    className="h-full bg-gradient-to-r from-purple-600 to-indigo-500 rounded-full transition-all duration-500"
                    style={{ width: `${percentComplete}%` }}
                  />
                </div>
                <p className="text-xs text-stone-400 leading-relaxed">
                  We researched the largest pain points users experience inside
                  traditional workspaces (offline lag, file privacy, lack of E2E crypto keys,
                  and complex docker self-hosting options). Use the checkboxes
                  below to toggle development priorities!
                </p>
              </div>

              {/* Dynamic Categories Roadmap List */}
              <div className="space-y-3.5">
                {roadmap.map((item) => (
                  <div
                    key={item.id}
                    className={`p-4 bg-stone-900/30 rounded-xl border transition-all text-left group select-none ${
                      item.checked
                        ? "border-purple-950/40 bg-purple-950/5"
                        : "border-stone-850 hover:bg-stone-850"
                    }`}
                  >
                    <div className="flex gap-4 items-start">
                      <button
                        onClick={() => handleToggleRoadmap(item.id)}
                        className="cursor-pointer pt-0.5"
                      >
                        {item.checked ? (
                          <CheckCircle2 size={18} className="text-purple-500" />
                        ) : (
                          <Circle
                            size={18}
                            className="text-stone-600 hover:text-stone-400"
                          />
                        )}
                      </button>

                      <div className="flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider font-mono px-2 py-0.5 rounded ${
                              item.category === "Local"
                                ? "bg-[#1E1E2F] text-blue-400 border border-blue-900/30"
                                : item.category === "AI"
                                  ? "bg-purple-950 text-purple-400 border border-purple-900/30"
                                  : item.category === "Security"
                                    ? "bg-red-950 text-red-400 border border-red-900/30"
                                    : item.category === "UI"
                                      ? "bg-emerald-950 text-emerald-400 border border-emerald-900/30"
                                      : "bg-stone-900 text-stone-300 border border-stone-800"
                            }`}
                          >
                            {item.category}-First
                          </span>

                          <span className="text-[10px] font-bold uppercase tracking-wider font-mono px-2 py-0.5 rounded bg-stone-900 text-stone-400 border border-stone-800">
                            Diff: {item.difficulty}
                          </span>

                          <h3
                            className={`text-[14px] font-bold font-sans tracking-tight ${item.checked ? "text-purple-200 line-through opacity-80" : "text-stone-100"}`}
                          >
                            {item.title}
                          </h3>
                        </div>

                        {/* Gap analysis */}
                        <div className="space-y-1 pt-1">
                          <div className="text-xs text-stone-400">
                            <span className="font-mono font-bold text-red-400/80 mr-1">
                              Legacy Pain Point:
                            </span>
                            {item.legacyGap}
                          </div>
                          <div className="text-xs text-stone-300">
                            <span className="font-mono font-bold text-emerald-400/80 mr-1">
                              MotionAI Solution:
                            </span>
                            {item.solution}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB CONTENT: 2. DEPLOYMENT Master file guides */}
          {activeTab === "deployment" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="p-4 bg-purple-950/20 rounded-xl border border-purple-900/30 text-xs text-purple-200 flex gap-3">
                <Info size={18} className="text-purple-400 shrink-0" />
                <p className="leading-relaxed">
                  <strong>Sandbox environment configuration complete!</strong>{" "}
                  Your application binds all connections with automated reverse
                  proxies to port 3000 inside Cloud Run. Use the following
                  guides to host it on self-managed Docker stacks.
                </p>
              </div>

              {/* Master step list */}
              <div className="space-y-5">
                {/* Step 1: Environment */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-stone-400 font-mono">
                      STEP 1: .env configuration config
                    </span>
                    <button
                      onClick={() => handleCopyCode(envContent, "env")}
                      className="text-[11px] text-purple-400 font-bold hover:underline flex items-center gap-1.5 cursor-pointer"
                    >
                      <Copy size={12} />
                      {copiedText === "env" ? "Copied!" : "Copy env codes"}
                    </button>
                  </div>
                  <pre className="p-4 bg-black rounded-xl border border-stone-800 text-xs font-mono text-stone-300 overflow-x-auto">
                    {envContent}
                  </pre>
                </div>

                {/* Step 2: docker compose */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-stone-400 font-mono">
                      STEP 2: Deploy using docker-compose
                    </span>
                    <button
                      onClick={() => handleCopyCode(dockerContent, "docker")}
                      className="text-[11px] text-purple-400 font-bold hover:underline flex items-center gap-1.5 cursor-pointer"
                    >
                      <Copy size={12} />
                      {copiedText === "docker" ? "Copied!" : "Copy YAML codes"}
                    </button>
                  </div>
                  <pre className="p-4 bg-black rounded-xl border border-stone-800 text-xs font-mono text-stone-300 overflow-x-auto">
                    {dockerContent}
                  </pre>
                </div>

                {/* Step 3: Firebase Admin Setup notes */}
                <div className="bg-stone-900/50 p-4 rounded-xl border border-stone-800 space-y-3">
                  <h4 className="text-xs font-bold text-stone-300 uppercase tracking-widest font-mono">
                    STEP 3: Provision FireStore Security Sandbox
                  </h4>
                  <p className="text-xs text-stone-400 leading-relaxed">
                    Make sure to upload the{" "}
                    <code className="text-purple-400">firestore.rules</code>{" "}
                    bundle to allow authorized collaborators to sync their pages
                    safely. Go to the Firebase Console {"\u2192"} Firestore{" "}
                    {"\u2192"} Rules, and paste:
                  </p>
                  <pre className="p-3.5 bg-black rounded border border-stone-800 text-[11px] font-mono text-purple-300 overflow-x-auto">
                    {`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /pages/{document} {
      allow read, write: if request.auth != null;
    }
  }
}`}
                  </pre>
                </div>

                {/* Step 4: CLI script */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-stone-400 font-mono block">
                    STEP 4: Quick Launch using Terminal
                  </span>
                  <div className="p-4 bg-black rounded-xl border border-stone-800 gap-2 flex items-center justify-between font-mono text-xs">
                    <span className="text-emerald-400">
                      npm install && npm run build && npm run start
                    </span>
                    <button
                      onClick={() =>
                        handleCopyCode(
                          "npm install && npm run build && npm run start",
                          "cli",
                        )
                      }
                      className="text-stone-500 hover:text-stone-300 cursor-pointer"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                  {copiedText === "cli" && (
                    <p className="text-[10px] text-emerald-400 font-bold font-mono">
                      Copied to clipboard!
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB CONTENT: 3. SNAPSHOT / ARCHITECTURE MAP */}
          {activeTab === "architecture" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-stone-903 p-4 rounded-2xl border border-stone-850 space-y-4">
                <span className="text-xs font-bold font-mono text-stone-400 block uppercase tracking-widest">
                  Secure Data Propagator Matrix
                </span>

                {/* Visual ASCII or stylized flow connector */}
                <div className="p-4 bg-black rounded-xl border border-stone-900 overflow-x-auto font-mono text-xs text-stone-300 leading-relaxed select-none space-y-4">
                  {/* Visual Node map */}
                  <div className="grid grid-cols-1 gap-2 border border-stone-850 p-3 rounded-lg bg-stone-950/40">
                    <div className="flex justify-between items-center border-b border-stone-900 pb-2">
                      <span className="font-bold text-stone-400">
                        Secure Client UI (React + Vite)
                      </span>
                      <span className="text-emerald-400 font-bold">
                        ● Port 3000
                      </span>
                    </div>
                    <p className="text-stone-400 text-[11px]">
                      Handles markdown rendering, LaTeX block parsing, PDF
                      compile, and IndexedDB local document caching.
                    </p>
                  </div>

                  <div className="flex justify-center py-1">
                    <span className="text-purple-500 font-bold text-sm">
                      ↓ Secure REST Handshake PIPELINE ↓
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="border border-stone-850 p-3 rounded-lg bg-stone-950/40 space-y-1">
                      <span className="font-bold text-stone-400 block border-b border-stone-900 pb-1 text-[11px]">
                        Server Proxy Gate
                      </span>
                      <p className="text-stone-400 text-[10px]">
                        Express.js endpoints proxying API keys to guard and
                        isolate secrets safely from inspect tools.
                      </p>
                    </div>

                    <div className="border border-stone-850 p-3 rounded-lg bg-stone-950/40 space-y-1">
                      <span className="font-bold text-stone-400 block border-b border-stone-900 pb-1 text-[11px]">
                        Google Workspace Sync
                      </span>
                      <p className="text-stone-400 text-[10px]">
                        Pulls pages directly from Drive or exports checked tasks
                        to Google Task databases seamlessly.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-center py-1">
                    <span className="text-purple-500 font-bold text-sm">
                      ↓ Secured API Proxy Gateway ↓
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2 border border-stone-850 p-3 rounded-lg bg-stone-950/40">
                    <div className="flex justify-between items-center border-b border-stone-900 pb-2">
                      <span className="font-bold text-stone-400">
                        Gemini generative model (SDK integration)
                      </span>
                      <span className="text-purple-400 font-bold font-mono">
                        gemini-3.5-flash
                      </span>
                    </div>
                    <p className="text-stone-400 text-[11px]">
                      Assists user with summarizing key discussion points using
                      real-time transcripts, outlining layouts, and drafting
                      text.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-bold text-stone-400 font-mono block">
                    Current Ingress Credentials Status
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-[#1E1E2F]/40 border border-blue-900/40 text-left rounded-xl space-y-1">
                      <div className="flex justify-between items-center text-[10px] text-blue-400 font-mono font-bold uppercase">
                        <span>Database Pipeline</span>
                        <span>Synced</span>
                      </div>
                      <span className="text-xs font-bold text-white">
                        Firebase Sandbox Active
                      </span>
                    </div>

                    <div className="p-3 bg-purple-950/15 border border-purple-900/40 text-left rounded-xl space-y-1">
                      <div className="flex justify-between items-center text-[10px] text-purple-400 font-mono font-bold uppercase">
                        <span>Generative AI Token</span>
                        <span>Bound</span>
                      </div>
                      <span className="text-xs font-bold text-white">
                        Gemini-3.5 API Active
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB CONTENT: 4. BRAND SUITE */}
          {activeTab === "branding" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-[#1C1C1C] rounded-2xl border border-stone-850 p-6 space-y-6">
                <span className="text-xs font-bold text-stone-400 font-mono uppercase tracking-widest block font-bold">
                  MotionAI Visual Brand Asset Suite
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Brand logo card 1 */}
                  <div className="bg-[#121212] p-5 rounded-xl border border-stone-800/80 flex flex-col items-center justify-center text-center space-y-4">
                    <MotionAiLogo size={80} isDark={true} />
                    <div>
                      <h4 className="text-white font-bold text-sm">
                        MotionAI Slate Logo
                      </h4>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        High definition, modern tech-slate theme.
                      </p>
                    </div>
                  </div>

                  {/* Brand logo card 2 */}
                  <div className="bg-white p-5 rounded-xl border border-stone-200 flex flex-col items-center justify-center text-center space-y-4">
                    <MotionAiLogo size={80} isDark={false} />
                    <div>
                      <h4 className="text-stone-900 font-extrabold text-sm">
                        MotionAI Classic Light
                      </h4>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        Minimal off-white layout profile.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-bold text-stone-400 font-mono block">
                    Design Concept & Typography pairing
                  </span>
                  <p className="text-xs text-stone-400 leading-relaxed">
                    The MotionAI logo keeps the humble and tactile rectangular
                    canvas frame of traditional workspace brand styles but bends
                    and merges the inner pillars to form a crisp isometric{" "}
                    <strong>"M"</strong> shape. An elegant point marks the
                    central anchor reflecting intelligent AI alignment. Perfect
                    for browser shortcuts and application launching.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
