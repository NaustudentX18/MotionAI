# MotionAI

**MotionAI** is a free, open-source, self-hostable, local-first intelligent workspace for documents, tasks, and AI actions. It features a polished block editor, multi-provider BYO/local AI, Google Workspace helpers, local persistence via Y.js, experimental collaboration, and a Tauri desktop prototype — all running on your own hardware without vendor lock-in.

> **Status:** Production-ready for single-user self-hosted use. Multi-user security and cloud sync are not yet claimed; see [`KNOWN_LIMITATIONS.md`](KNOWN_LIMITATIONS.md).

---

- [Quick Start](#quick-start)
- [Capabilities](#capabilities)
- [AI Providers](#ai-providers)
- [Architecture](#architecture)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Quick Start

```bash
git clone https://github.com/NaustudentX18/MotionAI.git
cd OpenNotion
npm install
npm run dev
```

Then open http://localhost:5173 (Vite dev server). The Express API runs on the same port.

### Production Build

```bash
npm run build
npm start
```

### Docker

```bash
docker compose up --build
```

### Credential-Free Local Verification

```bash
npm install
npm run verify
```

This runs 90+ tests covering AI contracts, spellcheck schemas, workspace helpers, import/export round-trips, persistence migrations, workspace schema validation, and reliability/large-workspace stress tests — all without API keys, network access, or Google OAuth.

```bash
npm run verify:static   # source + documentation invariant checks (12)
npm run lint            # TypeScript type-check
npm run test:ai         # mocked AI provider contract tests (18)
npm run test:spellcheck # spellcheck response-shape schema tests (11)
npm run test:workspace  # Google Workspace helper contract tests (16)
npm run test:import-export # import/export round-trip tests (20)
npm run test:smoke      # lightweight browser/API smoke checks (13)
npm run test:migration  # persistence migration tests (12)
npm run test:schema     # workspace schema validation tests (9)
npm run test:reliability # large-workspace torture tests (12)
```

---

## Capabilities

### Block Editor

A full-featured block-based editor powered by TipTap + Y.js:

| Feature | Status |
|---|---|
| Paragraphs, headings (H1–H3) | ✓ |
| To-do lists with checkboxes | ✓ |
| Bullet lists, dividers, callouts, quotes | ✓ |
| Code blocks with syntax highlighting | ✓ |
| Inline styles (bold, italic, underline, color) | ✓ |
| Markdown shortcuts (`# `, `- `, `[] `, `**bold**`) | ✓ |
| Slash command menu | ✓ |
| Drag-to-reorder blocks | ✓ |
| Image upload & embedding | ✓ |
| Block comments (threaded) | ✓ |
| Auto-save (5s interval) | ✓ |
| PDF export | ✓ |
| Speech-to-text dictation | ✓ |
| Backlinks / wiki-links (`[[Page Title]]`) | ✓ |

### MotionAI Portal

A central hub with workspace overview, AI action shortcuts, and a command palette for rapid navigation:

- Smart search across pages, blocks, and AI suggestions
- Command palette (`Cmd/Ctrl+K`) for quick actions
- AI composer for drafting, rewriting, summarizing, brainstorming
- AI spellcheck with inline corrections
- Floating AI selection menu for on-the-fly text transformations

### Canvas

Experimental infinite spatial canvas powered by [tldraw](https://tldraw.dev) — accessible as a page type toggle from the sidebar.

### Local Persistence

- Workspace data persisted via **Y.js** + IndexedDB (browser) and localStorage fallback
- Multi-workspace CRUD (create, rename, delete, switch)
- Import/export full workspace as JSON
- Schema versioning and migration from legacy storage formats

### Encryption

Optional **AES-GCM 256-bit encryption** at rest using Web Crypto API. Key derived from passphrase via PBKDF2. Toggle from Settings → Security tab.

### Peer Presence

Experimental WebRTC-based peer presence with BroadcastChannel + HTTP signaling. Shows which collaborators are viewing the same page. Proof of concept — real document sync requires the Y.js CRDT collaboration stack.

---

## AI Providers

BYO key or local endpoint. Configured via environment variables or the in-app Settings → AI Providers tab:

| Provider | Config | Default |
|---|---|---|
| **Gemini** (primary) | `GEMINI_API_KEY` | `https://generativelanguage.googleapis.com/v1beta` |
| **OpenAI-compatible** | `OPENAI_API_KEY` + `OPENAI_BASE_URL` | — |
| **Ollama** (local) | `OLLAMA_BASE_URL` | `http://localhost:11434` |
| **LM Studio** (local) | `LM_STUDIO_BASE_URL` | `http://localhost:1234` |
| **vLLM** (local) | `VLLM_BASE_URL` | `http://localhost:8000` |
| **Disabled** | — | Keys/endpoints never sent, API calls return descriptive guard messages |

All providers support `generate`, `summarize`, `draft`, `rewrite`, `spellcheck`, and `custom` commands. Endpoint selection and runtime switching happen from Settings without restarting the server.

---

## Architecture

```
src/
├── App.tsx                  # Main app shell, routing, state
├── components/
│   ├── BlockEditor.tsx      # TipTap + Y.js block editor
│   ├── CanvasEditor.tsx     # tldraw infinite canvas
│   ├── CommandPalette.tsx   # Cmd/Ctrl+K command palette
│   ├── SettingsModal.tsx    # AI, data, security settings
│   ├── Sidebar.tsx          # Page list + navigation
│   ├── MobileWorkspaceApp.tsx # Mobile-optimized view
│   └── blocks/              # Sub-components (SlashMenu, AiMenu, etc.)
├── hooks/
│   ├── useBlockEditor.ts    # TipTap editor lifecycle
│   ├── useAICommands.ts     # AI state + action handlers
│   ├── useBlockComments.ts  # Block comment CRUD
│   ├── useSpellcheck.ts     # Spellcheck state + corrections
│   ├── useBlockScroll.ts    # Scroll-into-view for focused blocks
│   ├── useSettings.tsx      # Settings context provider
│   └── useSlashMenu.ts     # Slash menu positioning + query
├── lib/
│   ├── yjs.ts              # Y.Doc + y-indexeddb persistence
│   ├── persistence.ts      # Workspace CRUD, migration, encryption
│   ├── ai/providers.ts     # Multi-provider AI client
│   ├── crypto.ts           # AES-GCM 256-bit encryption
│   ├── presence.ts         # WebRTC peer presence
│   ├── backlinks.ts        # [[wiki-link]] extraction
│   ├── workspace.ts        # Google Workspace helpers
│   └── vectorStore.ts      # voy-search semantic search
├── main.tsx                # React entry point
└── index.css               # Tailwind v4 styles + dark mode

server.ts                   # Express API: AI proxy, auth, presence, uploads
signaling-server.js         # y-webrtc signaling (WebSocket)
```

---

## Roadmap

See [`ROADMAP.md`](ROADMAP.md) for the full product roadmap and [`KNOWN_LIMITATIONS.md`](KNOWN_LIMITATIONS.md) for current scope boundaries.

---

## Contributing

Contributions are welcome. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for guidelines, and [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) for community standards.

---

## License

Apache 2.0. See [`LICENSE`](LICENSE).
