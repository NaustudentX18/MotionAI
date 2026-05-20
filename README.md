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

[![Release](https://img.shields.io/badge/Release-v4.2.0--LTS-blueviolet?style=for-the-badge)](https://github.com/JakeMalby/MotionAI)
[![Stack](https://img.shields.io/badge/Stack-React%2019--Vite--TypeScript-blue?style=for-the-badge&logo=react)](https://vite.dev)
[![Engine](https://img.shields.io/badge/AI--Engine-Gemini--3.5--Flash-emerald?style=for-the-badge&logo=google)](https://ai.google.dev)
[![Database](https://img.shields.io/badge/Firebase-Firestore%20Sandbox-orange?style=for-the-badge&logo=firebase)](https://firebase.google.com)

Welcome to **MotionAI**, an elite visual workspace customized for family, partners, and homelab environments. Designed from the ground up to solve the core architectural gaps of traditional cloud suites (offline-first lags, lack of customer-held encryption keys, and centralized hosting dependencies), MotionAI provides a gorgeous, desktop-grade and mobile-fluid notebook environment.

---

## 🗺️ The Ultimate Roadmap: What Traditional Workspaces are Missing (and how we build it!)

Below is a detailed engineering analysis of the primary product flaws in traditional cloud workspaces, accompanied by **MotionAI's massive roadmap and progressive solutions** to become the ultimate power tool.

### 1. 🌐 Offline-First Database & CRDT Sync Engine

- **The Traditional Flaw:** Legacy tools do not handle offline editing gracefully. Working on a flight, train, or high-latency network results in warning blocks and slow synchronization lockouts.
- **The MotionAI Solution:** Implementation of a hybrid **Yjs / Automerge** replication layer directly over the browser's IndexedDB. Your changes persist instantly to cache state on the client, and seamlessly replicate to the cloud only when network indicators turn green.

### 2. 🔐 Zero-Knowledge Cryptographic Client Encryption (E2EE) & BYOK

- **The Traditional Flaw:** Typical cloud platform administrators have access to read your notebooks in plaintext. Strict enterprise and privacy-focused groups cannot hold their own cryptographic keys.
- **The MotionAI Solution:** Pure AES-GCM 256-bit encryption managed in the browser using the **Web Crypto API**. Before syncing payload blocks to the cloud databases, documents are wrapped with a key known only to your devices. Bring-Your-Own-Key (BYOK) protocols for ultimate sovereignty.

### 3. 🧠 Smart Semantic Local Knowledge Retrieval (RAG)

- **The Traditional Flaw:** Standard productivity AI searches globally or performs keyword lookups, but lacks personalized, context-aware semantic block categorization or local multi-modal transcript extraction.
- **The MotionAI Solution:** Run a client-side vector search index (WASM-based). It chunks user documents and files, matches similarity distances, and injects relevant page blocks into the Gemini API prompt matrix on demand.

### 4. 🕸️ Obsidian-style Bi-directional Backlink Graph

- **The Traditional Flaw:** Typical note systems list backlinks inside basic text elements, but lack geometric visualizations of how your documents and resources relate as a cerebral network.
- **The MotionAI Solution:** An interactive, 3D/2D **Force-Directed Graph** rendered in high contrast directly within our sidebar, mapping references dynamically with clustering algorithms to discover hidden semantic links.

### 5. 🐳 HomeLab Self-Hosting & Absolute Sovereignty

- **The Traditional Flaw:** Leading productivity platforms are entirely closed-source, SaaS-bound, and vendor-locked.
- **The MotionAI Solution:** Lightweight Docker Compose orchestrations with built-in Reverse Proxy templates that publish solely on port `3000` to sit cleanly behind custom OpenMediaVault (OMV), Synology, or standard server stacks.

### 6. ⚡ P2P WebRTC Collaboration Mesh

- **The Traditional Flaw:** Requires centralized proprietary servers to see cursor positions and live edits.
- **The MotionAI Solution:** Decentralized multiplayer scaling using WebRTC networking. Devices can sync and collaborate locally even without external internet access, syncing state dynamically when isolated edge nodes reconnect.

### 7. 🎨 Generative Infinite Spatial Canvas (Whiteboards)

- **The Traditional Flaw:** Block editors are strictly vertical and linear. Visual canvas systems require external embeds that break the unified UX model.
- **The MotionAI Solution:** Fully integrated tldraw/Fabric.js spatial canvas blocks where notes, images, diagramming, and UI wireframes can be dynamically organized across an infinite zoomable plane, parsed semantically by the AI model.

### 8. ⚙️ Secure Local Lambda Automations

- **The Traditional Flaw:** Demands expensive third-party automation accounts for robust operations.
- **The MotionAI Solution:** Built-in webhooks and local triggered automations using isolated WASM runtimes. Set up recurring cron jobs, local file-system watchers, and programmatic logic paths that execute directly on your synced state.

### 9. 📱 Native Core Performance (Tauri integration)

- **The Traditional Flaw:** Sluggish native wrappers taking heavy RAM tolls without deep OS integrations.
- **The MotionAI Solution:** Compiling our decoupled frontend natively via Tauri (Rust backend), enabling zero-latency "Spotlight" quick-search commands anywhere on your desktop and deeply integrated mobile biometric secure containers.

### 10. 🎙️ Multi-modal AI Ingestors (Whisper & Layout Parsers)

- **The Traditional Flaw:** No mechanism to passively capture ambient audio notes or instantly decipher complex scanned PDF layouts.
- **The MotionAI Solution:** Client-side speech-to-text integration using lightweight Whisper models in WASM, and Gemini vision passes that transform heavy manuals or audio lectures natively into block architectures and flashcards.

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
