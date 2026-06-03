# MotionAI Level-Up Research (2026)

**Mission:** Make MotionAI feel as polished as Notion, Obsidian, or Affine — while staying local-first, BYO-AI, and self-hostable.

**Research team outputs:** Frontend audit, backend audit, competitive UX patterns (Notion, Obsidian, Anytype, Affine, Capacities, Reflect, Mem).

**Build team:** Phase A implementation on branch `cursor/level-up-special-4583` (this document + code).

---

## Executive summary

MotionAI already has rare depth for an OSS workspace: TipTap blocks, Y.js, databases, backlinks, copilot, automations, mobile PWA shell. The gap to “something special” is **cohesion**, **performance**, **trust**, and **one editor everywhere** — not more half-finished surfaces.

### North-star principles

1. **One object graph** — tasks, docs, DB rows, canvas cards share IDs and relations.
2. **Instant local writes** — never block typing on network; sync is ambient.
3. **AI with citations** — suggestions, not silent overwrites.
4. **Premium feel** — typography, motion, command palette, empty states.
5. **Honest security** — fail-closed APIs, clear E2EE boundaries.

---

## Phase map (implementation backlog)

| Phase | Theme | Effort | Impact |
|-------|--------|--------|--------|
| **A** | Trust + perf + bugfixes | 1–2 weeks | High — shipped in PR |
| **B** | Design system + motion | 2–3 weeks | High UX |
| **C** | TipTap on mobile (editor unity) | 3–5 weeks | Critical parity |
| **D** | Workspace store refactor | 2–4 weeks | Maintainability |
| **E** | AI streaming + citations UI | 2–3 weeks | Differentiation |
| **F** | Collaboration + E2EE policy | 4+ weeks | Hard |
| **G** | Semantic graph + daily capture | 3–4 weeks | Retention |

---

## Frontend (top priorities)

### Critical

| # | Item | Why | Files |
|---|------|-----|-------|
| F1 | **Unify mobile + desktop on TipTap** | 2,200-line duplicate editor; image/DB blocks break on phone | `MobileWorkspaceApp.tsx`, `BlockEditor.tsx` |
| F2 | **Extract workspace store from App.tsx** | 1,344 lines, 30+ useState, prop drilling | `App.tsx` → `useWorkspace.tsx` |
| F3 | **Lazy-load heavy features** | 5.6MB main chunk; tldraw, settings, hub eager | `App.tsx`, `vite.config.ts` |
| F4 | **Fix `handleSaveSnapshot` nesting bug** | Move/template handlers trapped inside snapshot | `App.tsx` |
| F5 | **Wire Sidebar move + templates** | `SpaceFolderPicker` imported but never rendered | `App.tsx`, `Sidebar.tsx` |

### High

| # | Item | Why |
|---|------|-----|
| F6 | Design tokens (CSS variables) — drop `!important` hex overrides | Dark mode fragility |
| F7 | Shared modal/dialog primitives | 6 modals, 6 overlay implementations |
| F8 | Mobile page-type routing (canvas, database, dashboard) | Read-only fallback minimum |
| F9 | Desktop PWA shortcut URLs (`?action=`) | Manifest shortcuts ignored on desktop |
| F10 | Delete dead hooks (`useSlashMenu`, `useBlockScroll`, duplicate SW) | Confusion |
| F11 | Remove redundant BlockEditor localStorage autosave | Double I/O with Yjs |
| F12 | Dynamic-import PDF export (jspdf/html2canvas) | Editor chunk size |

### Polish

| # | Item | Pattern from |
|---|------|----------------|
| F13 | Cmd+K palette as primary nav — preview pane, scopes | Obsidian, Reflect |
| F14 | Backlinks rail always visible on desktop | Obsidian |
| F15 | Daily note + quick capture (FAB / shortcut) | Obsidian, Mem |
| F16 | Block drag on touch — long-press reorder | Mobile standard |
| F17 | `prefers-reduced-motion` on all `animate-in` | A11y |
| F18 | Self-host Inter font (offline PWA) | Performance |

---

## Backend (top priorities)

### Critical (security)

| # | Item | Why | Files |
|---|------|-----|-------|
| B1 | **Auth end-to-end** — client sends `x-motionai-secret`; prod requires secret | Open AI routes if unset | `server.ts`, `apiClient.ts` |
| B2 | **SSRF guard** on `baseUrl` + TTS `localEndpointUrl` | Arbitrary fetch from server | `providers.ts`, new `ssrfGuard.ts` |
| B3 | **Secure `/api/upload/image`** — auth, rate limit, size cap | Open upload today | `server.ts` |
| B4 | **Protect presence/signaling** — auth or signed tokens | Open relay | `server.ts`, `signaling-server.js` |

### High

| # | Item | Why |
|---|------|-----|
| B5 | Shared AI route handlers (dedupe `tauriAiProxy`) | Two copies of logic |
| B6 | Unified AI settings resolution (env + client, no raw keys on web prod) | Inconsistent provider config |
| B7 | Wire webhooks → automation engine | Stub today |
| B8 | E2EE policy: disable WebRTC when encrypted until key agreement | Plaintext sync + encrypted store |
| B9 | Server integration tests in `npm run verify` | upload/auth/429 |
| B10 | Structured logs + request IDs + `trust proxy` | Ops behind nginx |

### AI differentiation

| # | Item | Pattern |
|---|------|---------|
| B11 | SSE streaming for chat/generate | ChatGPT-like feel |
| B12 | Background AI jobs (auto-link, tag, summarize) as dismissible chips | Mem, Reflect |
| B13 | Hybrid retrieval: BM25 + embeddings + graph proximity | Mem Q&A |
| B14 | Prompt length caps + structural delimiters | Safety |

---

## UI / “something special” (top priorities)

| # | Item | What users feel |
|---|------|-----------------|
| U1 | **Typography system** — 17–18px prose, tight metadata labels | “Calm premium” |
| U2 | **Motion with purpose** — 180ms panel/block transitions, reduced-motion | Crafted |
| U3 | **AI diff preview** — never silent overwrite | Trust |
| U4 | **Citations on AI answers** — link to source blocks | Grounded |
| U5 | **Empty states that teach** — templates, not marketing | Faster onboarding |
| U6 | **Graph/backlinks as hero** — split pane, filters | Networked thought |
| U7 | **Sync status ambient dot** — saved / syncing / offline | Local-first confidence |
| U8 | **Dark/light with semantic tokens** — not inverted hex | Consistency |
| U9 | **Mobile bottom nav** — Home / Search / Capture / AI | Native PWA |
| U10 | **Hub → product** — MotionAIHub is deploy docs; separate from user workspace | Less confusion |

---

## Competitive moat (what to double down on)

1. **Self-hosted + BYO AI** — few competitors do both well.
2. **Inspectable object graph** — databases + tasks + docs in one JSON/Yjs doc.
3. **No vendor lock-in** — export Markdown + graph JSON (already started).
4. **Homelab / Pi / Tailscale** — signaling + single-node deploy story.

Avoid competing on: hosted SaaS scale, Figma-grade multiplayer, Notion-scale templates marketplace.

---

## Phase A — implemented in this branch

- [x] Research document (this file)
- [x] Fix `App.tsx` handler nesting + wire page move picker
- [x] Design tokens foundation (`src/styles/tokens.css`)
- [x] `apiClient` with optional `x-motionai-secret`
- [x] Harden image upload (auth + rate limit + size cap)
- [x] Service worker `SKIP_WAITING` + consolidate registration
- [x] Vite `manualChunks` for vendor/editor/canvas/pdf/ml
- [x] Lazy-load Hub, Settings, CommandPalette, Canvas, modals
- [x] Desktop deep-link handler for manifest shortcuts
- [x] Mobile rich-page fallback (canvas/database/dashboard)
- [x] Mobile AI chat uses `apiClient`

---

## Recommended next PRs (build team queue)

1. **PR: TipTap mobile editor** — replace `MobileWorkspaceApp` block JSX with `BlockEditor` + bottom toolbar.
2. **PR: Design system** — `components/ui/*`, migrate header/sidebar/modals.
3. **PR: Workspace context** — peel `App.tsx` state into provider.
4. **PR: AI streaming + citation UI** — SSE endpoint + `AiSuggestion` component.
5. **PR: SSRF + integration tests** — `scripts/server-integration-tests.ts` in CI.
6. **PR: Daily note + capture** — `/?action=capture`, today page on open.

---

## Success metrics

| Metric | Target |
|--------|--------|
| Initial JS (gzip) | < 400 KB main + lazy feature chunks |
| Mobile editor parity | 100% block types render |
| Lighthouse PWA | Installable + offline shell |
| `npm run verify` | Green including server integration |
| Time to first capture | < 2s from home screen icon |

---

*Generated by research pass across codebase + ROADMAP + KNOWN_LIMITATIONS + competitive patterns. Update when phases ship.*
