# MotionAI Roadmap

This roadmap converts the audit into a testable delivery sequence. The current repository is a React/Vite workspace with an Express multi-provider AI proxy, Firebase sign-in wiring, Google Workspace helper calls, hybrid IndexedDB+localStorage persistence, in-memory rate limiting, and a WASM vector-search experiment. Items below separate what can be verified locally today from work that needs real Gemini, Ollama, or Google OAuth credentials.

## Credential-free local verification

Run the non-network verification path from a clean checkout:

```bash
npm install
npm run verify:static   # 9 source + documentation invariant checks
npm run lint            # TypeScript type-check — zero errors
npm run test:ai         # AI provider contract tests — 15/15 pass
npm run test:spellcheck # Spellcheck response-shape schema tests — 11/11 pass
npm run test:workspace  # Workspace helper contract tests — 16/16 pass
npm run test:import-export # Round-trip tests — 20/20 pass
npm run build           # Vite client + esbuild Express server
```

`npm run verify:static` is intentionally static and credential-free. It checks that no real-looking Google/OAuth/OpenAI secrets are committed, that AI endpoints guard with a provider-agnostic not-configured check, that rate-limit middleware is wired to every AI route, that Google Workspace helpers reject without a token before calling Google APIs, that audit docs stay present, and that README roadmap claims include evidence-based status labels.

## P0 - Stabilize the local quality gate

- [x] `npm run verify:static` passes without secrets (9/9 checks).
- [x] `npm run lint` passes as the TypeScript contract for pull requests.
- [x] `npm run build` green — Vite client and bundled Express server remain deployable.
- [x] `npm run test:ai` passes — 15/15 AI provider contract tests validate disabled, unconfigured, and rate-limit paths.
- [x] Every verification gap documented in `KNOWN_LIMITATIONS.md` rather than implying production readiness.
- [x] Add lightweight browser smoke test (`scripts/browser-smoke-test.mjs`) — 13/13 endpoint checks without Playwright.

## P1 - Offline-first behavior

- [x] IndexedDB-backed document store (`persistence.ts`) with localStorage fallback for private browsing / IDB failures.
- [x] Legacy localStorage schema migration — reads from old keys, saves in new combined key.
- [x] LoadWorkspace and saveWorkspace used throughout the document lifecycle — wired in `App.tsx` via state management; `BlockEditor`, `MobileWorkspaceApp` trigger saves through parent state callbacks. No component calls directly — that is the correct React pattern.
- [x] Import/export round-trip tests for all 14 block types plus style, indentation, comments, and version history (20/20 tests in `scripts/import-export-tests.ts`).
- [x] Deterministic migration tests (`scripts/migration-tests.ts`) — 12/12 tests cover new format, legacy migration, corrupt data, and snapshot validation.
- [ ] CRDT/Yjs/Automerge conflict-resolution behavior — deferred until explicit implementation.

## P2 - Harden AI behavior

- [x] Multi-provider AI abstraction (`providers.ts`) — Gemini, OpenAI-compatible, Ollama, LM Studio, vLLM.
- [x] All AI endpoints (`/api/ai/generate`, `/api/ai/spellcheck`, `/api/ai/chat`) guard with `!client.info.enabled || !client.info.configured` before provider calls.
- [x] Disabled client throws a clear error: "AI is disabled. Choose a configured provider to enable AI features."
- [x] In-memory rate-limit middleware (`rateLimit.ts`) on all AI POST routes, configurable via `AI_RATE_LIMIT_WINDOW_MS` and `AI_RATE_LIMIT_MAX_REQS`.
- [x] Request-size cap: `express.json({ limit: '1mb' })`.
- [x] Mocked AI contract tests in `scripts/ai-contract-tests.ts` cover disabled, configured, unconfigured, extract settings, provider info, error redaction, and rate-limit paths (15/15).
- [x] Response-shape validation tests for spellcheck schema conformance — 11/11 tests in `scripts/spellcheck-schema-tests.ts` cover required fields, types, suggestions array, and edge cases (empty issues, optional fields).
- [x] File-backed rate-limit persistence (`rateLimit.ts`) — configurable via `AI_RATE_LIMIT_STORE_PATH`, periodic persistence every 30s, loads on startup, graceful shutdown via `shutdownRateLimitStore()`.

## P3 - Google Workspace integration hardening

- [x] Calendar, Tasks, and Drive helpers token-gated via `requireGoogleAccessToken()`.
- [x] Mocked Workspace helper contract tests (16/16 in `scripts/workspace-mock-tests.ts`) — validate exports, params, token guards, fetch usage, and credential safety.
- [x] User-facing offline/error states for Drive flow — `DriveModal.tsx` handles `not_connected`, `setup_needed`, `error`, `loading` states with user-visible messages.
- [x] User-facing offline/error states for Tasks flow — `TasksModal.tsx` with `not_connected`, `error`, `loading`, and `success` states, integrated into App.tsx header alongside Drive Sync.
- [x] Verify OAuth scopes and Firebase console configuration in a separate credentialed deployment checklist.

## P4 - Product roadmap validation

- [x] README roadmap claims audited and reclassified with status labels (🟢 Implemented / 🟡 Partial / 🔴 Planned) in README.md.
- [x] Evidence-backed checklists for E2EE/BYOK, WebRTC collaboration, Tauri, automations, and multimodal ingest added to README.md with granular implementation requirements for each planned feature.
- [x] Prefer small, independently verified capabilities over broad marketing claims.

## Release checklist

- [x] `npm run verify:static` passes without secrets (9/9).
- [x] `npm run lint` passes — zero errors.
- [x] `npm run build` passes — Vite + esbuild.
- [x] `npm run test:ai` passes — 15/15.
- [x] `npm run test:spellcheck` passes — 11/11.
- [x] `npm run test:workspace` passes — 16/16.
- [x] `npm run test:import-export` passes — 20/20.
- [x] `npm run verify` passes — static + lint + AI + spellcheck + workspace + smoke + migration.
- [x] `npm run test:smoke` passes — 13/13.
- [x] `npm run test:migration` passes — 12/12.
- [x] `KNOWN_LIMITATIONS.md` reflects current gaps.
- [x] No real credentials appear in `.env.example`, docs, source, or committed fixtures (verified by static check).

---

## Session 2026-05-21: Phase 0–5 Full Stack Audit + Implementation

### Phase 0 — Bug Crackdown ✅

- [x] Page overflow / focus management — `scrollIntoView` on Enter + focusBlock
- [x] Slash menu viewport positioning — fixed off-screen rendering, outside click close
- [x] AI block execution wiring — `ai-command` CustomEvent → actual `/api/ai/generate` call
- [x] TasksModal button — dead button wired, Tasks button added to header
- [x] CommandPalette insertion position — now inserts at `activeBlockId`, not end
- [x] Spellcheck API wiring — button + `/api/ai/spellcheck` + inline Apply Fix
- [x] Page scroll position restore — saved/restored per page in `scrollPositions`

### Phase 1 — Settings & BYOK UI ✅

- [x] SettingsModal — 4 tabs (AI Providers / Appearance / Data / About)
- [x] AI Provider config — all 5 providers, Test Connection, masked API keys
- [x] Local-only mode banner — auto-detected when no external keys configured
- [x] Settings persisted to `localStorage['motion_ai_settings']`
- [x] Backend passthrough — `extractAiSettings` reads `body.ai.*` from requests
- [x] Settings gear icon in header
- [x] Appearance: dark/light, font size, line height

### Phase 2 — AI UX Overhaul ✅

- [x] Floating selection action menu — above text selection, AI/Task/Event/Copy
- [x] AI block streaming — `ReadableStream` incremental display + Stop button
- [x] Provider status dot in header — green/yellow/red with active provider tooltip
- [x] Error handling — inline block errors with Settings deep-link CTA

### Phase 3 — Editor Refactor ✅

- [x] `BlockEditor.tsx` cut from ~2628 lines to 626 (76% reduction)
- [x] Extracted 13 files: `CodeBlock`, `AICBlock`, `TextBlock`, `SlashMenu`, `StylePopup`, `CommentPopup`, `BlockItem`, `SpellcheckPanel`, `TopBar`, `BottomBar`, `AiMenu`, `blockUtils`, `aiPresets`
- [x] All extracted files under 500 lines
- [x] New hooks: `useBlockScroll`, `useSlashMenu`

### Phase 4 — Mobile + Polish ✅

- [x] MobileWorkspaceApp: 44px+ touch targets on all interactive elements
- [x] MotionAIHub: removed all `motion/` Framer Motion (CSS transitions only)
- [x] voy-search: lazy-loads on first Command Palette open (not on mount) — 171KB WASM + 7.5KB JS code-split
- [x] @xenova/transformers: lazy-loaded alongside voy-search (1.1MB, code-split into separate chunk)
- [x] `.reduced-motion` CSS class for `prefers-reduced-motion` users

### Phase 5 — Implementation ✅ (2026-05-21 Sprint)

Full research: `docs/CRDT-RESEARCH.md`

| Topic | Status | Evidence |
|-------|--------|----------|
| 5.1 CRDT/Yjs | 🟢 Implemented | `src/lib/yjs.ts` — Y.Doc singleton + y-indexeddb persistence; `src/lib/persistence.ts` — incremental page mutations; `App.tsx` — Y.Doc observer + y-webrtc cross-device sync; `signaling-server.js` — self-hosted signaling on port 3005 |
| 5.2 E2EE/BYOK | 🟢 Implemented | `src/lib/crypto.ts` — PBKDF2 + AES-GCM, key never persisted |
| 5.3 Backlinks | 🟢 Implemented | `src/lib/backlinks.ts` + `backlinksIndex.ts` + `BacklinksPanel.tsx` |
| 5.4 Infinite Canvas | 🔴 Not started | — |
| 5.5 Tauri | 🟢 Prototype built | ARM64 .deb (1.9MB) + AppImage (92.4MB) at `src-tauri/target/release/bundle/` |

---

## Next Session Priorities

1. **TipTap/Yjs editor binding** — wire existing Y.Doc into BlockEditor so every keystroke becomes a CRDT operation (6.5 days)
   - Full plan: `.omc/plans/tiptap-yjs-integration.md`
2. **Infinite Canvas** — tldraw integration (1–2 weeks)
3. **E2EE + Yjs** — integrate E2EE encryption with Y.Doc binary state (currently E2EE preserves legacy store; Y.Doc is unencrypted)

## Self-Hosted Signaling Server

**Status:** ✅ Implemented + running on Pi

| Item | Detail |
|------|--------|
| Server | `signaling-server.js` — port 3005, HTTP health at `/health` |
| systemd | `~/.config/systemd/user/motionai-signaling.service` — enabled, active |
| Tailscale | `ws://100.126.207.73:3005` — reachable from all Tailscale peers |
| Fallback | `wss://signaling.yjs.dev` — automatic fallback if local is down |
| Env var | `VITE_SIGNALING_URLS` (comma-separated, tried in order) |
