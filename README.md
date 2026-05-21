# 🚀 MotionAI (Modern Workspace Core & Homelab Hub)

> Transforming messy thoughts, long-form transcripts, and markdown files into beautiful, highly structured, isometric knowledge-base databases. Powered by Gemini-3.5-flash and fully persistent on private sandboxed server networks.

---

```
   ┌────────────────────────────────────────────────────────┐
   │                                                        │
   │    ███╗   ███╗ ██████╗ ████████╗██╗ ██████╗ ███╗   ██╗ │
   │    ████╗ ████║██╔═══██╗╚══██╔══╝██║██╔═══██╗████╗  ██║ │
   │    ██╔████╔██║██║   ██║   ██║   ██║██║   ██║██╔██╗ ██║ │
   │    ██║╚██╔╝██║██║   ██║   ██║   ██║██║   ██║██║╚██╗██║ │
   │    ██║ ╚═╝ ██║╚██████╔╝   ██║   ██║╚██████╔╝██║ ╚████║ │
   │    ╚═╝     ╚═╝ ╚═════╝    ╚═╝   ╚═╝ ╚═════╝ ╚═╝  ╚═══╝ │
   │                                                🤖      │
   │                                                        │
   └────────────────────────────────────────────────────────┘
```

[![Release](https://img.shields.io/badge/Release-v0.0.0--dev-blueviolet?style=for-the-badge)](https://github.com/JakeMalby/MotionAI)
[![Stack](https://img.shields.io/badge/Stack-React%2019--Vite--TypeScript-blue?style=for-the-badge&logo=react)](https://vite.dev)
[![Engine](https://img.shields.io/badge/AI--Engine-Multi--Provider-emerald?style=for-the-badge&logo=google)](https://ai.google.dev)
[![Database](https://img.shields.io/badge/Persistence-IndexedDB%2B%20Firebase-orange?style=for-the-badgeFirebase-Firestore%20Sandbox-orange?style=for-the-badge&logo=firebaselogo=firebase)](https://firebase.google.com)

Welcome to **MotionAI**, an elite visual workspace customized for family, partners, and homelab environments. Designed from the ground up to solve the core architectural gaps of traditional cloud suites (offline-first lags, lack of customer-held encryption keys, and centralized hosting dependencies), MotionAI provides a gorgeous, desktop-grade and mobile-fluid notebook environment.

---

## 🗺️ The Ultimate Roadmap: What Traditional Workspaces are Missing (and how we build it!)

Below is a detailed engineering analysis of the primary product flaws in traditional cloud workspaces, accompanied by **MotionAI's massive roadmap and progressive solutions** to become the ultimate power tool.

### 1. 🌐 Offline-First Database & CRDT Sync Engine  🔴 Planned

- **The Traditional Flaw:** Legacy tools do not handle offline editing gracefully. Working on a flight, train, or high-latency network results in warning blocks and slow synchronization lockouts.
- **The MotionAI Solution:** Implementation of a hybrid **Yjs / Automerge** replication layer directly over the browser's IndexedDB. Your changes persist instantly to cache state on the client, and seamlessly replicate to the cloud only when network indicators turn green.
  > 🟡 **Current status:** Hybrid IndexedDB + localStorage persistence is implemented. CRDT/Yjs/Automerge replication is not yet implemented — see [ROADMAP.md](ROADMAP.md) P1.

### 2. 🔐 Zero-Knowledge Cryptographic Client Encryption (E2EE) & BYOK  🔴 Planned

- **The Traditional Flaw:** Typical cloud platform administrators have access to read your notebooks in plaintext. Strict enterprise and privacy-focused groups cannot hold their own cryptographic keys.
- **The MotionAI Solution:** Pure AES-GCM 256-bit encryption managed in the browser using the **Web Crypto API**. Before syncing payload blocks to the cloud databases, documents are wrapped with a key known only to your devices. Bring-Your-Own-Key (BYOK) protocols for ultimate sovereignty.
  > 🔴 **Current status:** No encryption implementation exists. This is a planned roadmap item — see [ROADMAP.md](ROADMAP.md) P4.

### 3. 🧠 Smart Semantic Local Knowledge Retrieval (RAG)  🟡 Partial

- **The Traditional Flaw:** Standard productivity AI searches globally or performs keyword lookups, but lacks personalized, context-aware semantic block categorization or local multi-modal transcript extraction.
- **The MotionAI Solution:** Run a client-side vector search index (WASM-based). It chunks user documents and files, matches similarity distances, and injects relevant page blocks into the AI prompt matrix on demand.
  > 🟡 **Current status:** WASM vector search (`voy-search`) is implemented and lazy-loads on first search. No coverage yet for model download availability, memory pressure, or search quality — see `KNOWN_LIMITATIONS.md`.

### 4. 🕸️ Obsidian-style Bi-directional Backlink Graph  🔴 Planned

- **The Traditional Flaw:** Typical note systems list backlinks inside basic text elements, but lack geometric visualizations of how your documents and resources relate as a cerebral network.
- **The MotionAI Solution:** An interactive, 3D/2D **Force-Directed Graph** rendered in high contrast directly within our sidebar, mapping references dynamically with clustering
  > 🔴 **Current status:** Not implemented. This is a planned roadmap item.

### 5. 🐳 HomeLab Self-Hosting & Absolute Sovereignty  🟡 Partial

- **The Traditional Flaw:** Leading productivity platforms are entirely closed-source, SaaS-bound, and vendor-locked.
- **The MotionAI Solution:** Lightweight Docker Compose orchestrations with built-in Reverse Proxy templates that publish solely on port `3000` to sit cleanly behind custom OpenMediaVault (OMV), Synology, or standard server stacks.
  > 🟡 **Current status:** Express server is deployable via `npm run build` + `npm run start`. No `docker-compose.yml` exists in the repository yet — the README example is aspirational.

### 6. ⚡ P2P WebRTC Collaboration Mesh  🔴 Planned

- **The Traditional Flaw:** Requires centralized proprietary servers to see cursor positions and live edits.
- **The MotionAI Solution:** Decentralized multiplayer scaling using WebRTC networking. Devices can sync and collaborate locally even without external internet access, syncing state dynamically when isolated edge nodes reconnect.
  > 🔴 **Current status:** Not implemented. No WebRTC code exists in the repository.

### 7. 🎨 Generative Infinite Spatial Canvas (Whiteboards)  🔴 Planned

- **The Traditional Flaw:** Block editors are strictly vertical and linear. Visual canvas systems require external embeds that break the unified UX model.
- **The MotionAI Solution:** Fully integrated tldraw/Fabric.js spatial canvas blocks where notes, images, diagramming, and UI wireframes can be dynamically organized across an infinite zoomable plane, parsed semantically by the AI model.
  > 🔴 **Current status:** Not implemented. No tldraw/Fabric.js integration exists.

### 8. ⚙️ Secure Local Lambda Automations  🔴 Planned

- **The Traditional Flaw:** Demands expensive third-party automation accounts for robust operations.
- **The MotionAI Solution:** Built-in webhooks and local triggered automations using isolated WASM runtimes. Set up recurring cron jobs, local file-system watchers, and programmatic logic paths that execute directly on your synced state.
  > 🔴 **Current status:** Not implemented. No WASM runtime or automation engine exists.

### 9. 📱 Native Core Performance (Tauri integration)  🔴 Planned

- **The Traditional Flaw:** Sluggish native wrappers taking heavy RAM tolls without deep OS integrations.
- **The MotionAI Solution:** Compiling our decoupled frontend natively via Tauri (Rust backend), enabling zero-latency "Spotlight" quick-search commands anywhere on your desktop and deeply integrated mobile biometric secure containers.
  > 🔴 **Current status:** Not implemented. No Tauri/Rust integration exists.

### 10. 🎙️ Multi-modal AI Ingestors (Whisper & Layout Parsers)  🔴 Planned

- **The Traditional Flaw:** No mechanism to passively capture ambient audio notes or instantly decipher complex scanned PDF layouts.
- **The MotionAI Solution:** Client-side speech-to-text integration using lightweight Whisper models in WASM, and Gemini vision passes that transform heavy manuals or audio lectures natively into block architectures and flashcards.
  > 🔴 **Current status:** Not implemented. No Whisper WASM or vision pipeline exists.

---

---

## ✅ What's Built (Session 2026-05-21)

### Phase 0 — Bug Crackdown
- Fixed page overflow / scroll-into-view on Enter key
- Fixed slash menu viewport positioning
- Wired AI block execution end-to-end (was event-dispatching to nowhere)
- Wired Tasks button in header (was a dead button)
- Fixed CommandPalette block insertion at cursor position
- Wired spellcheck API call
- Restored page scroll position on navigation

### Phase 1 — Settings & BYOK UI 🟡 Partial
- **Settings Modal** (`SettingsModal.tsx`) — 4 tabs: AI Providers, Appearance, Data, About
- Per-provider config: baseUrl, model, API key (masked), Test Connection button
- Local-only mode detection + banner
- Settings gear icon in header
- Appearance: dark/light, font size, line height
- Data: export/import JSON workspace, clear data

### Phase 2 — AI UX Overhaul 🟡 Partial
- **Floating Selection Menu** — appears above text selection with AI, Task, Event, Copy
- **AI Block Streaming** — incremental text display with Stop button
- **Provider Status Dot** — green (external), yellow (local), red (not configured)
- Improved error handling — inline errors with Settings deep-link

### Phase 3 — BlockEditor Refactor 🟢 Implemented
- Monolithic 2628-line `BlockEditor.tsx` → 13 focused files
- All files under 500 lines
- Hooks: `useBlockScroll`, `useSlashMenu`
- Extracted: `CodeBlock`, `AICBlock`, `TextBlock`, `SlashMenu`, `StylePopup`, `CommentPopup`, `BlockItem`, `SpellcheckPanel`, `TopBar`, `BottomBar`, `AiMenu`, `blockUtils`, `aiPresets`

### Phase 4 — Mobile + Polish 🟡 Partial
- MobileWorkspaceApp: 44px+ touch targets
- MotionAIHub: removed `motion/` Framer Motion (CSS transitions only)
- voy-search: lazy-loads on first Command Palette open
- Reduced-motion CSS support via `prefers-reduced-motion`

### Phase 5 — Research
- Full research report: `.omc/research/opennotion-phase5-research.md`
- Top recommendation: Backlinks (5.3) — highest ROI, 1-2 weeks

---

## 📋 P4: Implementation Checklists for Planned Features

The following features are aspirational roadmap items with no implementation code yet. Each checklist defines what "done" looks like.

### 🔐 E2EE & BYOK (currently 🔴 Planned)

- [ ] **AES-GCM-256 encryption module** — wrap page content using Web Crypto API before persistence, with key derived from user passphrase
- [ ] **BYOK import/export** — allow user to supply their own 256-bit key as a base64-encoded string
- [ ] **Key never leaves client** — confirm via static analysis that encryption key is never serialized to server-bound payloads
- [ ] **Encrypted persistence layer** — store ciphertext in IndexedDB/Firebase, decrypt on read, with plaintext never written to storage
- [ ] **Key rotation UI** — allow re-encrypting all content with a new key
- [ ] **Contract tests** — encrypt/decrypt round-trip with known key, wrong-key decryption failure, BYOK import validation
- [ ] **Static verify check** — no plaintext `Page` objects written to unencrypted channels

### ⚡ P2P WebRTC Collaboration (currently 🔴 Planned)

- [ ] **Signaling channel** — lightweight WebSocket or Firebase-based signaling for peer discovery
- [ ] **CRDT sync layer** — Yjs or Automerge document type initialized per page, synced via WebRTC data channels
- [ ] **Peer presence UI** — cursors, selection highlights, and user avatars from active collaborators
- [ ] **Offline resilience** — local edits queued when disconnected, synced on reconnect
- [ ] **Multi-tab support** — same user on multiple browser tabs collaborates with themselves
- [ ] **Contract tests** — two peers converge to identical document state after sync

### 🎨 Infinite Spatial Canvas (currently 🔴 Planned)

- [ ] **Canvas block type** — new `BlockType = 'canvas'` with tldraw or Fabric.js integration
- [ ] **Dual-mode editor** — toggle between block-editor and spatial-canvas per page
- [ ] **Canvas-to-block export** — extract structured text/shapes from canvas into document blocks
- [ ] **AI canvas parsing** — semantic analysis of spatial layouts (diagrams, wireframes, mind maps)

### ⚙️ Local Lambda Automations (currently 🔴 Planned)

- [ ] **Webhook receiver** — Express endpoint that accepts triggers and runs user-defined automation scripts
- [ ] **WASM runtime** — execute user-provided WASM modules in a sandboxed worker
- [ ] **Cron scheduler** — in-process scheduler (e.g., `node-cron`) for recurring automations
- [ ] **Trigger catalog** — pre-built triggers: page update, file watch, webhook, timer
- [ ] **Automation test suite** — mock trigger → WASM execution → state change verification

### 📱 Tauri Native App (currently 🔴 Planned)

- [ ] **Tauri project scaffolding** — `npm create tauri-app` with React frontend bindings
- [ ] **Spotlight search** — OS-level global shortcut that searches pages via the local IndexedDB
- [ ] **System tray integration** — background agent with quick-note and notification capabilities
- [ ] **Biometric unlock** — platform biometric API (Touch ID / Windows Hello) for E2EE key release

### 🎙️ Multi-modal AI Ingest (currently 🔴 Planned)

- [ ] **Whisper WASM integration** — client-side speech-to-text using `whisper.cpp` WASM build or transformers.js
- [ ] **Audio block type** — record or upload audio, transcribe, and insert as block content
- [ ] **Vision/layout parser** — use Gemini Vision or a WASM OCR pipeline to extract structured content from PDFs and images
- [ ] **File upload zone** — drag-and-drop PDF, image, and audio files with immediate processing
- [ ] **End-to-end test** — upload audio file → transcribed text appears in editor → editable

---

## 🛠️ Step-by-Step Deployment Master Guide

### System Hardware/Software Prerequisites

- Node.js (v20+ Recommended)
- NPM (v10+)
- Docker & Docker-Compose (Optional, for clean home hosting)

---

### Step 1: Environment Variables Configuration

Duplicate the `.env.example` file in the root directory into `.env` and configure your API tokens. Secret keys like `GEMINI_API_KEY` are safely isolated server-side.

```bash
# Clone the template
cp .env.example .env
```

Edit your `.env`:

```env
# Port bound to ingress routing (Required: 3000)
PORT=3000
NODE_ENV=production

# Core Gemini API Key (Secret Server-Side Variable)
GEMINI_API_KEY=AIzaSyYourSecretGeminiKeyHere...

# Firebase Cloud Sync Configuration
FIREBASE_PROJECT_ID=thinking-reality-98gvj
```

---

### Step 2: Provision Cloud Database Sandbox (Firestore)

Ensure authorized family or collaborators can access and sync work safely by implementing secure database rules.

Go to your **Firebase Console** → **Firestore** → **Rules**, and paste:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /pages/{document} {
      // Allows signed-in family members to sync workspaces securely
      allow read, write: if request.auth != null;
    }
  }
}
```

---

### Step 3: Deployment Options

#### Option A: Quick Manual Run (NPM)

Install dependencies and build the TypeScript Express proxy bundle.

```bash
# 1. Install production packages
npm install

# 2. Build Vite Client & compile Express Server bundle
npm run build

# 3. Spin up server on Port 3000
npm run start
```

#### Option B: Deploy on Homelab / NAS (Docker Compose)

Use this command to spin up MotionAI as an isolated background container:

```bash
docker-compose up -d --build
```

`docker-compose.yml`:

```yaml
version: "3.8"

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
      - GEMINI_API_KEY=${GEMINI_API_KEY}
    ports:
      - "3000:3000"
    command: sh -c "npm install && npm run build && npm run start"
    restart: unless-stopped
```

---

## 📊 Connection Topology & Architecture Snapshot

Below is the network data-flow layout for MotionAI. To ensure maximum safety, secret AI and third-party tokens are **never** exposed in the client browser.

```
       ┌────────────────────────────────────────────────────────┐
       │                 CLIENT BROWSER ENVIRONMENT             │
       │                                                        │
       │   ┌───────────────────────┐    ┌───────────────────┐   │
       │   │   Interactive Rich    │    │ Mobile Workspace  │   │
       │   │   Editor (React/Vite) │◄──►│ Client View       │   │
       │   └───────────────────────┘    └───────────────────┘   │
       └───────────────────────▲────────────────────────────────┘
                               │
               Handshake through exclusive PORT 3000 only
                               │
       ┌───────────────────────▼────────────────────────────────┐
       │                  SECURE BACKEND WORKSPACE              │
       │                                                        │
       │   ┌───────────────────────┐    ┌───────────────────┐   │
       │   │  Express API Proxy    │▲──►│ Google Drive      │   │
       │   │  (server.ts bundle)   ││   │ Workspace gateway │   │
       │   └───────────▲───────────┘│   └───────────────────┘   │
       └───────────────│────────────└───────────────────────────┘
                       │
             Internal Secret Handshake
                       │
       ┌───────────────▼────────────────────────────────────────┐
       │                  EXTERNAL INTEGRATION CORES            │
       │                                                        │
       │  ┌───────────────────────┐     ┌─────────────────────┐ │
       │  │ Gemini Generative Pro │     │ Firestore Database  │ │
       │  │ (gemini-3.5-flash AI) │     │ (Secure rules flow) │ │
       │  └───────────────────────┘     └─────────────────────┘ │
       └────────────────────────────────────────────────────────┘
```

---

## 🌟 The MotionAI Design Philosophy

MotionAI balances minimalist structure with rich visual feedback. Every component handles touch/desktop interactions flawlessly, prioritizing Inter font for general reading layout with JetBrains Mono for diagnostic system updates.

For any deployment feedback or feature contributions, coordinate directly with the principal workspace administrators.
