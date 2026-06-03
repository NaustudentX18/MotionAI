# AGENTS.md

Guidance for AI agents working in this repository.

## Cursor Cloud specific instructions

MotionAI is a **single Node.js app** (React + Vite frontend, Express API). Persistence is **client-side** (Y.js + IndexedDB); there is no Postgres/Redis to run locally.

### Services

| Service | Port | Start command | Notes |
|---------|------|---------------|-------|
| **App (dev)** | `3000` | `npm run dev` | Serves SPA + API via `tsx server.ts`. README mentions `:5173`; that is outdated — use **3000**. |
| **App (prod)** | `3000` | `npm run build && npm start` | Runs `dist/server.cjs` |
| **WebRTC signaling** | `3005` | `npm run signaling` | Optional; use `npm run dev:all` for app + signaling together |
| **Health check** | — | `GET /api/health` | Used by Docker, smoke tests, Playwright |

AI providers (Gemini, Ollama, etc.) and Firebase/Google OAuth are **optional** and not required for credential-free verification.

### Dependency refresh (automatic)

On VM startup, run `npm ci` from the repo root (see update script). Node **22** is required (matches `Dockerfile` and CI).

### Common commands

See `package.json` scripts and `CONTRIBUTING.md`. Quick reference:

- **Lint:** `npm run lint` (TypeScript `tsc --noEmit`)
- **Build:** `npm run build`
- **Full verify gate (CI):** `npm run verify` — static checks, lint, contract tests, smoke (spawns built server)
- **E2E:** `npx playwright install chromium` once, then `npm run test:e2e` (Playwright starts its own dev server on port `3107` unless `PLAYWRIGHT_BASE_URL` is set)

### Dev server caveats

- Copy `.env.example` to `.env` only if you need real AI keys or secrets; **`npm run verify` runs without credentials**.
- The dev server binds `0.0.0.0:3000`; hot reload is via Vite middleware inside `server.ts`.
- For WebRTC E2E (`e2e/webrtc-sync.spec.ts`), run signaling on `3005` and set `PLAYWRIGHT_BASE_URL` accordingly.

### Hello-world sanity check

With `npm run dev` running: open http://localhost:3000, click **New Page** in the sidebar, type in the TipTap editor (`.ProseMirror`). Content persists in browser IndexedDB.
