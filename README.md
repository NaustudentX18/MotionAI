<div align="center">

<!-- Responsive SVG Logo that dynamically adapts to GitHub Light/Dark Mode -->
<img src="docs/media/motionai-logo.svg" width="600" alt="MotionAI Logo" style="max-width: 100%; height: auto;" />

<h3>✨ A self-hostable, local-first intelligent workspace for notes, tasks, docs, and automations. ✨</h3>

<p>
  MotionAI combines a polished block editor, BYO/local AI actions, Y.js-backed persistence, Google Workspace integrations, experimental collaboration, and a Tauri desktop build — without locking your workspace into a vendor cloud.
</p>

[![CI Build](https://github.com/NaustudentX18/MotionAI/actions/workflows/ci.yml/badge.svg)](https://github.com/NaustudentX18/MotionAI/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)
[![Local-first](https://img.shields.io/badge/local--first-Y.js%20%2B%20IndexedDB-22c55e?style=flat-square&logo=gitkraken)](https://github.com/yjs/yjs)
[![AI Architecture](https://img.shields.io/badge/AI-BYO%2Flocal%20providers-8b5cf6?style=flat-square&logo=openai)](https://github.com/NaustudentX18/MotionAI)
[![Status](https://img.shields.io/badge/status-single--user%20self--hosted-0ea5e9?style=flat-square)](KNOWN_LIMITATIONS.md)

<p>
  <a href="#-why-motionai"><b>Why MotionAI?</b></a> •
  <a href="#-see-it"><b>Visual Showcase</b></a> •
  <a href="#-quick-start"><b>Quick Start</b></a> •
  <a href="#-features"><b>Features</b></a> •
  <a href="#-architecture"><b>Architecture</b></a> •
  <a href="ROADMAP.md"><b>Roadmap</b></a> •
  <a href="KNOWN_LIMITATIONS.md"><b>Limitations</b></a>
</p>

---

</div>

## 💡 Why MotionAI?

Most workspace tools force a trade-off: polished UX **or** local control, AI features **or** privacy, collaboration **or** portability. MotionAI is an open-source workspace built to ensure that a private, self-hosted option feels premium, modern, and highly interactive.

* **🧠 Bring Your Own AI** — Seamlessly connect to Gemini, OpenAI-compatible endpoints, Ollama, LM Studio, vLLM, or disable it entirely.
* **💾 Keep Data Local-First** — Powered by Y.js + IndexedDB persistence with automated schema migrations, easy import/export, and optional AES-GCM encryption-at-rest.
* **✍️ Polished Block Editing** — A clean TipTap-powered editor featuring slash commands, backlinks, inline comments, image uploads, PDF export, audio dictation, and keyboard-first navigation.
* **🐳 Run Anywhere** — Simple local Vite + Express server setups, ready-to-go Docker Compose configurations, and early-stage Tauri desktop builds.
* **🛡️ Clear Boundaries** — Hardened security boundaries and experimental surfaces are clearly documented instead of marketed away.

> [!IMPORTANT]
> **Current Project Status:** MotionAI is production-ready for private, single-user self-hosted environments. Multi-user cloud security, public-Internet hardening, encrypted network collaboration, signed desktop releases, and hosted cloud syncing are Not claimed. Refer to [`KNOWN_LIMITATIONS.md`](KNOWN_LIMITATIONS.md) and [`SECURITY.md`](SECURITY.md) for details.

---

## 📸 See It

### Workspace Dashboards
| 🎛️ Hub Dashboard | 📝 Interactive Editor |
| --- | --- |
| ![MotionAI hub](docs/media/motionai-hub-live.png) | ![MotionAI editor](docs/media/motionai-editor-live.png) |

### Controls & Responsiveness
| ⚙️ Settings Panel | 📱 Mobile View |
| --- | --- |
| ![MotionAI settings](docs/media/motionai-settings-live.png) | ![MotionAI mobile](docs/media/motionai-mobile-live.png) |

🎥 **Video Demonstration:** [Watch the short live app walkthrough](docs/media/motionai-live-demo.webm)

---

## ⚡ Quick Start

### 1. Run Locally
Get the application up and running on your local machine:
```bash
git clone https://github.com/NaustudentX18/MotionAI.git
cd MotionAI
npm install
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser. The Express API is served by the same dev entry point.

> [!NOTE]
> If your local checkout directory is still named `OpenNotion`, run the commands from that directory. The public GitHub repository name is `MotionAI`.

### 2. Production Build
Prepare the project for production:
```bash
npm run build
npm start
```

### 3. Docker Compose
Deploy locally via containerization:
```bash
docker compose up --build
```

### 4. Codebase Verification
Verify static structure and run tests without configuring credentials:
```bash
npm install
npm run build
npm run verify
```
`npm run build` bundles the server, and `npm run verify` checks TypeScript, documentation contracts, spellcheck schemas, AI provider adapters, import/export integrity, and large-workspace stress tests.

**Targeted Verification Sub-commands:**
```bash
npm run verify:static       # Invariant & documentation checks
npm run lint                # TypeScript type-checking & lint
npm run test:ai             # Mocked multi-provider AI contracts
npm run test:spellcheck     # Spellcheck response schema checks
npm run test:workspace      # Google Workspace credentials/auth guards
npm run test:import-export  # Workspace JSON/Y.js export/import round-trips
npm run test:smoke          # Headless browser & API smoke tests
npm run test:migration      # Persistence schema migration validations
npm run test:reliability    # Heavy database stress testing
```

---

## 🚀 Features

### 🛠️ Workspace & Editor
* **Block Editor:** Support for paragraphs, headings, task lists, blockquotes, callout blocks, custom dividers, code blocks (with syntax highlights), drag-and-drop handles, inline comments, image uploads, markdown shortcuts, auto-saving, and PDF export.
* **Knowledge Graph:** Backlinks and wiki-links powered by real-time local indexing for fully connected notes.
* **MotionAI Command Portal:** Interactive workspace hub, central command palette (`Cmd/Ctrl + K`), unified search, AI composer window, inline highlight-actions, and quick shortcuts.
* **Spatial Canvas:** Early-stage infinite canvas page layout powered by `tldraw`.
* **Mobile Shell:** Custom responsive workspace design optimization for reading/editing from any mobile web browser.

### 🤖 Intelligent AI Proxy & Integrations
* **BYO/Local AI:** Built-in adapter layer for Gemini, OpenAI-compatible APIs, local Ollama endpoints, LM Studio, vLLM, and disabled mode.
* **Contextual AI Actions:** Instant prompts to write, summarize, expand drafts, fix grammar/spelling, rewrite tone, or run custom prompts.
* **Secrets Security:** AI API keys are stored solely in your local `.env` configuration or browser localStorage. The server ensures keys are never returned back to client sessions (`keysReturned: false`).
* **Google Workspace:** Driver flows for Calendar, Drive, and Task lists isolated behind interactive authorization guards.

### 🔒 Local-First Foundation
* **Y.js Engine:** Document state built on top of CRDTs with IndexedDB persistence and secure localStorage recovery fallbacks.
* **Multi-workspace Support:** Easily create, delete, switch, export, or import clean JSON database dumps.
* **Schema Migrations:** Integrated database version tracking ensures backwards compatibility and safety during upgrades.
* **Encryption at Rest:** Optional client-side AES-GCM database encryption (see limitations).
* **Sync Wiring:** WebRTC/Y.js signaling framework ready for peer synchronization (currently experimental).
* **Desktop Packaging:** Local desktop builds utilizing Tauri.

---

## Current status by capability

| Capability | Status | Reference Code / Verification |
| :--- | :--- | :--- |
| **React/Vite Core & Express API** | Implemented | [App.tsx](file:///home/pi/OpenNotion/src/App.tsx), [server.ts](file:///home/pi/OpenNotion/server.ts), [vite.config.ts](file:///home/pi/OpenNotion/vite.config.ts) |
| **TipTap & Y.js Block Editor** | Implemented | [BlockEditor.tsx](file:///home/pi/OpenNotion/src/components/BlockEditor.tsx), [useBlockEditor.ts](file:///home/pi/OpenNotion/src/hooks/useBlockEditor.ts) |
| **IndexedDB & Migrations** | Implemented, still hardening | [persistence.ts](file:///home/pi/OpenNotion/src/lib/persistence.ts), [yjs-migration.ts](file:///home/pi/OpenNotion/src/lib/yjs-migration.ts) |
| **Import & Export Round-trips** | Implemented | `scripts/import-export-tests.ts` |
| **Multi-provider AI Proxy** | Implemented | [providers.ts](file:///home/pi/OpenNotion/src/lib/ai/providers.ts), `scripts/ai-contract-tests.ts` |
| **Google Workspace Helper Guards**| Implemented | [workspace.ts](file:///home/pi/OpenNotion/src/lib/workspace.ts) |
| **Backlinks & Wiki-links** | Implemented | [backlinks.ts](file:///home/pi/OpenNotion/src/lib/backlinks.ts), [BacklinksPanel.tsx](file:///home/pi/OpenNotion/src/components/BacklinksPanel.tsx) |
| **AES-GCM Encryption-at-Rest** | Implemented, with caveats | [crypto.ts](file:///home/pi/OpenNotion/src/lib/crypto.ts) |
| **WebRTC Document Synchronization**| Experimental | [signaling-server.js](file:///home/pi/OpenNotion/signaling-server.js) |
| **tldraw Canvas Interface** | Early prototype | [CanvasEditor.tsx](file:///home/pi/OpenNotion/src/components/CanvasEditor.tsx) |
| **Tauri Desktop Application** | Prototype | [tauri.conf.json](file:///home/pi/OpenNotion/src-tauri/tauri.conf.json) |
| **Production multi-user security** | Not claimed | [`KNOWN_LIMITATIONS.md`](KNOWN_LIMITATIONS.md), [`SECURITY.md`](SECURITY.md) |

---

## 🔌 Supported AI Providers
You can configure your provider credentials directly in your local `.env` file or from the application settings page (**Settings → AI Providers**).

| Provider | Setup Variable | Default Endpoint |
| :--- | :--- | :--- |
| **Google Gemini** | `GEMINI_API_KEY` | Native Google Vertex / GenAI URL |
| **OpenAI-Compatible**| `OPENAI_API_KEY` | Customize via `OPENAI_BASE_URL` |
| **Ollama** | — | `http://localhost:11434` |
| **LM Studio** | — | `http://localhost:1234` |
| **vLLM** | — | `http://localhost:8000` |
| **Disabled Mode** | — | Fails safely with visual placeholders |

---

## 🏗️ Architecture

```text
src/
├── App.tsx                    # App shell, navigation routing, workspace state
├── components/
│   ├── BlockEditor.tsx        # TipTap + Y.js editor component
│   ├── CanvasEditor.tsx       # tldraw spatial canvas prototype
│   ├── CommandPalette.tsx     # Ctrl/Cmd+K search & quick actions
│   ├── SettingsModal.tsx      # AI provider, export/import, and encryption config
│   ├── Sidebar.tsx            # Pages, workspace switcher, and folder views
│   └── blocks/                # Block UI components, AI prompts, and menus
├── hooks/                     # Custom hooks (editor, comments, settings, spellcheck)
├── lib/
│   ├── ai/providers.ts        # AI adapter layer & model credentials validation
│   ├── crypto.ts              # Local AES-GCM database encryption helpers
│   ├── persistence.ts         # IndexedDB operations and schema migrations
│   ├── yjs.ts                 # CRDT state syncing and IndexedDB listeners
│   ├── backlinks.ts           # Automatic wiki-link extractor
│   └── workspace.ts           # Google calendar/tasks driver guards
├── main.tsx                   # React client application entry
└── index.css                  # Tailwind styles and dark mode themes
```

---

## 📈 Contributing

We welcome community contributions, particularly around document editor stabilization, database performance, E2E browser testing coverage, desktop packaging, and security hardening.

1. Review the [`CONTRIBUTING.md`](CONTRIBUTING.md) guide.
2. Read the [`KNOWN_LIMITATIONS.md`](KNOWN_LIMITATIONS.md) list.
3. Ensure the project builds and all tests pass with `npm run build` and `npm run verify` before submitting a Pull Request.

---

## ⚖️ License

Distributed under the **Apache-2.0 License**. See [`LICENSE`](LICENSE) for details.
