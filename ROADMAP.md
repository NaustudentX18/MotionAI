# MotionAI Roadmap

MotionAI is a free, open-source, self-hostable local-first workspace where docs, tasks, automations, calendar, canvas, and AI share one inspectable object graph that can run on a laptop, Pi, homelab, or company server.

## Naming status

The project is fully branded as **MotionAI**. The local checkout may still be named `OpenNotion`; the public GitHub repository is `NaustudentX18/MotionAI` for legacy routing. Do not imply affiliation with Notion, ClickUp, or Motion.

## Credential-free local verification

Run the non-network verification path from a clean checkout:

```bash
npm install
npm run verify:static       # source + documentation invariant checks
npm run lint                # TypeScript type-check
npm run test:ai             # mocked AI provider contract tests
npm run test:spellcheck     # spellcheck response-shape schema tests
npm run test:workspace      # Google Workspace helper contract tests
npm run test:import-export  # import/export round-trip tests
npm run test:smoke          # lightweight browser/API smoke checks
npm run test:migration      # persistence migration tests
npm run build               # Vite client + bundled Express server
```

`npm run verify` is the default credential-free gate for pull requests. Tests that need real provider keys, Google OAuth, real multi-browser installs, or public deployment must be documented separately and should never be implied by the local gate.

## Current verified baseline

This table reflects the local repository state inspected on **2026-05-26** (post phases-1-6 pass). It intentionally separates shipped code from experimental/prototype surfaces and from GitHub issues that are still open.

| Capability | Current status | Evidence |
| --- | --- | --- |
| React/Vite app with Express server | Implemented | `src/App.tsx`, `server.ts`, `vite.config.ts`, `npm run build` |
| Block workspace/editor | Implemented | `src/components/BlockEditor.tsx`, `src/hooks/useBlockEditor.ts`, `src/components/blocks/` |
| Local-first persistence and migrations | Implemented, still hardening | `src/lib/persistence.ts`, `src/lib/yjs.ts`, `src/lib/yjs-migration.ts`, `scripts/migration-tests.ts` |
| Y.js CRDT foundation | Implemented, still hardening | `src/lib/yjs.ts`, `src/lib/extensions/YjsBlockExtension.ts`, `docs/CRDT_CONFLICT_RESOLUTION.md` |
| WebRTC document sync | Experimental | `src/App.tsx`, `signaling-server.js`, `e2e/webrtc-sync.spec.ts`, `docs/CRDT_CONFLICT_RESOLUTION.md` |
| Sync/save/encryption status UI | Implemented, still hardening | `src/hooks/useSyncStatus.ts`, `src/App.tsx`, `src/components/PageAddons.tsx` |
| Peer presence | Implemented | `src/lib/presence.ts`, `src/components/PresenceIndicator.tsx` |
| Encryption-at-rest | Implemented, with caveats | `src/lib/crypto.ts`, `src/lib/persistence.ts`, `KNOWN_LIMITATIONS.md` |
| Multi-provider BYO/local AI proxy | Implemented | `server.ts`, `src/lib/ai/providers.ts`, `scripts/ai-contract-tests.ts` |
| AI secret non-return/redaction checks | Implemented | `keysReturned: false` markers in `server.ts`, `src/lib/ai/providers.ts`, `scripts/ai-contract-tests.ts`, `scripts/secret-redaction-tests.ts` |
| Google Workspace helpers | Implemented behind auth | `src/lib/workspace.ts`, `scripts/workspace-mock-tests.ts` |
| Backlinks and relationship graph | Implemented | `src/lib/backlinks.ts`, `src/lib/backlinksIndex.ts`, `src/components/BacklinksPanel.tsx`, `src/components/BacklinksGraph.tsx` |
| Canvas pages and templates | Implemented prototype | `src/components/CanvasEditor.tsx`, `src/lib/canvasTemplates.ts`, `src/types.ts` |
| Databases, formula-lite, and database templates | Implemented, still hardening | `src/components/blocks/DatabaseBlock.tsx`, `src/components/database/`, `src/lib/ai/AiFormulaEngine.ts` |
| Task properties, My Tasks/Home, Inbox, dashboard, time tracking | Implemented, still hardening | `src/components/tasks/TaskPropertiesPanel.tsx`, `src/components/tasks/taskAdapter.ts`, `src/components/dashboard/DashboardWidget.tsx` |
| Reminder scheduling and notifications | Planned/partial | `DashboardWidget.tsx` documents no reminder field; `src/lib/automations/ruleBuilder.ts` has a due-date reminder rule template only |
| Workspace hierarchy: spaces/folders/parent IDs | Implemented, still hardening | `src/types.ts`, `src/components/SpaceFolderPicker.tsx`, `src/components/Sidebar.tsx`, `src/App.tsx` |
| Workspace templates | Implemented | `src/lib/workspaceTemplates.ts`, `src/components/Sidebar.tsx` |
| Workspace Copilot/RAG-style assistant | Implemented, still hardening | `src/components/copilot/WorkspaceCopilot.tsx` |
| Safe-agent guardrail primitives | Implemented, not a shipped autonomous agent | `src/lib/ai/safeAgentMode.ts`, `docs/AI_SAFETY_AND_PROVIDER_GUARANTEES.md` |
| Automations rule builder and settings UI | Implemented, still hardening | `src/lib/automations/ruleBuilder.ts`, `src/components/SettingsModal.tsx` |
| Webhook/API execution surface | Experimental | `server.ts` has `POST /api/webhooks/:path` behind `MOTIONAI_API_SECRET`; `docs/WEBHOOK_API.md`; `scripts/secret-redaction-tests.ts` |
| Telemetry-free diagnostics export | Implemented | `src/lib/diagnostics.ts`, `src/components/SettingsModal.tsx` |
| Tauri desktop app | Prototype | `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` |
| Mobile browser workspace/capture shell | Prototype | `src/components/MobileWorkspaceApp.tsx` |
| Production multi-user security | Not claimed | `KNOWN_LIMITATIONS.md`, `SECURITY.md` |

## Live GitHub roadmap state

Live GitHub was checked with `gh` on 2026-05-23 local time:

- Repository: `NaustudentX18/MotionAI`, public, default branch `main`.
- Issues: #1–#35 are open; no closed issues were returned by `gh issue list --state closed --limit 50`.
- Milestones: Phase 0 through Phase 8 plus `Backlog — Needs shaping` exist. Phase 0 has five open issues; Phase 1 has six; Phase 2 has five; Phase 3 has four; Phase 4 has four; Phase 5 has one; Phase 6 has three; Phase 7 has three; Phase 8 has four.
- Project board: owner project **MotionAI Public Roadmap** exists with 35 items and `gh project list` reports `public: true`.
- Details and issue mapping: [`docs/GITHUB_ROADMAP_STATUS.md`](docs/GITHUB_ROADMAP_STATUS.md).

## Level-up research (2026)

Full-stack audit and phased backlog: [`docs/LEVEL_UP_RESEARCH.md`](docs/LEVEL_UP_RESEARCH.md) — frontend, backend, UI polish, and competitive patterns (Notion, Obsidian, Affine, etc.). Phase A implementation targets trust, performance, and mobile parity foundations.

## Product principles

1. **Fast core beats feature theater.** Every major capability needs a performance budget and repeatable proof.
2. **Local-first by default.** Cloud and sync are options, not requirements for single-user work.
3. **BYO AI and local AI are first-class.** Gemini, OpenAI-compatible endpoints, Ollama, LM Studio, vLLM, custom endpoints, and disabled mode are supported without forced hosted AI.
4. **Docs and tasks should share one object graph.** A task should be usable as a block, database row, calendar item, dashboard source, or canvas card without duplicating data.
5. **Open-source trust over marketing.** Public claims must link to code, docs, tests, or known limitations.
6. **Composable, not cluttered.** Power should ship through optional modules, templates, command palette flows, and clear settings.

## Phase 0 — Trust and positioning cleanup

Phase 0 exists to make the public repo credible before adding more product surface. The original GitHub-ready drafts live in [`docs/PHASE_0_ISSUES.md`](docs/PHASE_0_ISSUES.md); live issue mapping lives in [`docs/GITHUB_ROADMAP_STATUS.md`](docs/GITHUB_ROADMAP_STATUS.md).

- [x] Reconcile README, roadmap, and shipped docs around Y.js, WebRTC sync, canvas, E2EE, Tauri, and production-security claims.
- [x] Document naming direction and avoid implying affiliation with Notion, ClickUp, or Motion.
- [x] Add open-source contribution, security, code-of-conduct, and issue-template files.
- [x] Extend static verification so required community files and conservative claim boundaries stay present.
- [x] Open/copy the Phase 0 GitHub issues from [`docs/PHASE_0_ISSUES.md`](docs/PHASE_0_ISSUES.md). _(Live: Phase 0 issues #1, #2, #3, #6, and #7 are open; former drafts #4 and #5 are now Phase 1 issues.)_
- [x] Add first `good first issue` label usage and create the roadmap project. _(Live: issue #3 has `good first issue`; owner project exists.)_
- [x] Make the roadmap project public or update wording if it remains private. _(Live: `gh project list` reports `public: true`.)_
- [ ] Close or update Phase 0 issues only after their acceptance criteria are independently verified on GitHub.

## Phase 1 — Local-first reliability moat

- [x] Add a two-browser Y.js convergence Playwright test against the self-hosted signaling server. _(`e2e/webrtc-sync.spec.ts` exists; still needs routine browser/signaling execution before broad collaboration claims.)_
- [x] Add persistence torture tests for large workspaces: 1k pages, 10k blocks, long docs, repeated reloads, and offline/reconnect flows. _(`scripts/persistence-torture-tests.ts`, run via `npm run test:torture`.)_
- [x] Add sync status UI: local saved, encrypted/unlocked state, and collaboration mode cues. _(`useSyncStatus.ts`, `App.tsx`, `PageAddons.tsx`; peer/replay detail still hardening.)_
- [x] Add export guarantees: JSON envelope with schema versioning, secret redaction, and import/append/replace modes. _(`src/lib/workspaceImportExport.ts`, `scripts/import-export-tests.ts`, wired in `SettingsModal.tsx`.)_
- [x] Define workspace object schema versioning and migration policy. _(`WORKSPACE_SCHEMA_VERSION` in `workspaceSchema.ts`, `docs/WORKSPACE_SCHEMA.md`, `scripts/workspace-schema-tests.ts`.)_
- [ ] Reconcile or close live Phase 1 GitHub issues #4, #5, #8, #9, #10, and #11 after the corresponding checks are run on the target branch.

## Phase 2 — Document/database foundation

- [x] Implement real database objects: tables, properties, formulas-lite, relations, and rollups-lite.
- [x] Build table, board, calendar, gallery/list, and timeline-lite views.
- [x] Add page templates and database templates. _(`src/lib/workspaceTemplates.ts`, `src/components/database/databaseTemplates.ts`, wired in Sidebar and DatabaseBlock.)_
- [x] Add backlinks graph view and page relationship explorer. _(`src/components/BacklinksGraph.tsx`, `PageAddons.tsx`.)_
- [x] Add importers for Notion markdown/HTML export and ClickUp JSON export. _(`src/lib/importers/notionImporter.ts`, `clickupImporter.ts`, run via `npm run test:importers`.)_
- [ ] Reconcile or close live Phase 2 GitHub issues #12–#16 after branch verification.

## Phase 3 — Execution layer

- [x] Make tasks first-class objects: assignee, status, due date, priority, custom fields, dependencies-lite, estimated time, actual time, and timer state. _(`src/types.ts`, `TaskPropertiesPanel.tsx`, task/database components.)_
- [x] Add My Tasks/Home and Inbox surfaces. _(`DashboardWidget.tsx`, `taskAdapter.ts`.)_
- [x] Add durable notifications and reminder scheduling. _(Local browser notifications with SW push support, snooze/dismiss, and inactivity auto-lock.)_
- [x] Add dashboards: task counts, overdue work, workload, time estimates, and simple charts. _(`DashboardWidget.tsx`.)_
- [x] Add time tracking and timesheets-lite fields/surfaces. _(`src/types.ts`, `TaskPropertiesPanel.tsx`, `DashboardWidget.tsx`.)_
- [x] Add project hierarchy: Workspace → Space → Folder → Project/List → Task/Subtask, while allowing docs/databases anywhere. _(`PAGE_TYPES` includes `space` and `folder`; parent movement UI exists.)_
- [ ] Add guest/collaborator permissions for self-hosted teams.
- [ ] Reconcile or close live Phase 3 GitHub issues #17–#20 after the implemented parts are verified and the planned security RFCs remain open.

## Phase 4 — BYO/local AI workspace brain

- [x] Harden provider registry UI for Gemini, OpenAI-compatible endpoints, Ollama, LM Studio, vLLM, custom endpoints, and disabled mode. _(`SettingsModal.tsx`, `src/lib/ai/providers.ts`.)_
- [x] Add local RAG-style workspace copilot over pages/tasks/files with user-visible assistant state. _(`src/components/copilot/WorkspaceCopilot.tsx`.)_
- [x] Add AI actions for summarize/draft/rewrite/spellcheck/custom commands. _(`AiMenu.tsx`, `useAICommands.ts`, command palette.)_
- [ ] Add a verified meeting-notes-to-tasks AI action. _(Meeting capture exists in the mobile shell, but live issue #23 remains open and no dedicated test was found.)_
- [x] Add safe-agent guardrail primitives: read-only policy helpers, tool permission prompt state, audit log, and prompt-injection detection. _(`src/lib/ai/safeAgentMode.ts`.)_
- [ ] Ship full autonomous agent mode. _(Not claimed; see `docs/AI_SAFETY_AND_PROVIDER_GUARANTEES.md`.)_
- [x] Keep keys local/browser/server-configurable and preserve tests that prove secrets are not returned in API responses. _(`keysReturned: false`, `scripts/ai-contract-tests.ts`, `scripts/secret-redaction-tests.ts`.)_
- [ ] Reconcile or close live Phase 4 GitHub issues #21–#24 after the implemented pieces are verified on GitHub.

## Phase 5 — Automations and integrations

- [x] Add rule builder: trigger → conditions → action. _(`src/lib/automations/ruleBuilder.ts` with status-change, due-date, new-page, new-task, mention, webhook, and scheduled triggers.)_
- [x] Wire rule builder UI into settings. _(`SettingsModal.tsx` Automations tab.)_
- [x] Add automation execution history, retry, and diagnostics. _(AutomationHistoryPanel, IndexedDB-persisted logs, trigger reliability tests.)_
- [x] Add open webhook/API execution and local n8n-style recipe examples. _(`server.ts`, `docs/WEBHOOK_API.md`, `npm run test:secret-redaction`.)_
- [ ] Reconcile live Phase 5 issue #25 once the RFC/docs and route implementation agree.

## Phase 6 — Canvas and spatial planning

- [x] Upgrade the starter canvas page into a workspace object surface. _(`CanvasEditor.tsx` with page embedding and live cards.)_
- [x] Allow docs, tasks, and database rows to appear as live canvas cards.
- [x] Add whiteboard templates: project kickoff, sprint map, content calendar, and research wall. _(`src/lib/canvasTemplates.ts`.)_
- [ ] Add AI canvas actions such as clustering sticky notes and turning a canvas into tasks.
- [x] Create live GitHub issues for Phase 6 work. _(Live: issues #26-#28.)_

## Phase 7 — Desktop/mobile packaging

- [x] Tauri keychain/keyring integration for AI provider secrets. _(`src/lib/keychain.ts`, `tauriAiProxy.ts`)_
- [ ] Harden Tauri: signed releases, auto-update path, filesystem import/export.
- [x] Add mobile-first browser capture mode prototype: quick note/task surfaces, meeting capture, voice/transcript flow, and phone-oriented navigation. _(`MobileWorkspaceApp.tsx`; not a native mobile package.)_
- [x] Optimize Mobile PWA: iOS safe area notches, edge-swipe gestures, web app manifest, and Safari standalone installer guides.
- [ ] Keep mobile task capture under two taps and common actions under one second perceived response with repeatable mobile checks.
- [x] Create live GitHub issues for Phase 7 work. _(Live: issues #29-#31.)_

## Phase 8 — Community launch loop

- [ ] Publish a public demo, roadmap, and public “good first issue” board. _(Media/demo files and public project board exist; public demo/linking still need launch polish.)_
- [ ] Position honestly against open-source workspace alternatives: execution + docs + BYO/local AI, not “open Notion” alone.
- [x] Build templates: student planner, agency CRM, product roadmap, homelab ops, personal wiki, sprint board. _(`src/lib/workspaceTemplates.ts`.)_
- [x] Add a telemetry-free diagnostics bundle users can export when filing bugs. _(`src/lib/diagnostics.ts`, wired in `SettingsModal.tsx`.)_
- [x] Create live GitHub issues for Phase 8 work. _(Live: issues #32-#35.)_

## Phase 9 — Swarm Optimization Moat (Completed in this pass)

- [x] **Offline PWA Service Worker:** Service worker caches static assets and serves from cache on fetch failure. Push notification support for reminders.
- [x] **Reminders Notification Pipeline:** Local browser notifications with SW push, snooze/dismiss UI, inactivity auto-lock.
- [x] **Automation Execution History:** Persistent IndexedDB history with retry, filtering, and diagnostics export.
- [x] **ICE/STUN Config UI:** Settings panel for WebRTC server configuration with connection tester.
- [x] **Schema Invariant Tests:** Automated checks for version bumps and migration coverage.
- [x] **Meeting Parser Contract Tests:** Provider-mocked tests for the AI meeting-to-tasks pipeline.
- [x] **Backward-compat Fixtures:** Migration tests for legacy task/page fields.
- [x] **Changelog + Versioning:** `scripts/generate-changelog.sh`, `docs/VERSIONING.md`, `docs/ROLLBACK.md`.
- [x] **Chunk Budget Check:** `scripts/chunk-budget-check.mjs` for CI bundle size enforcement.
- [ ] **CSV Database Importer:** Exists at `src/lib/importers/csvImporter.ts` — coverage may need expansion.

## Claim policy

- Use **Implemented** only when the repo contains working code and at least one repeatable check or direct file evidence.
- Use **Implemented, still hardening** for working features that need more compatibility, security, UX, or release coverage before stronger public claims.
- Use **Experimental** for wired features that need multi-user, multi-device, credentialed, or long-running validation.
- Use **Prototype** for present code/artifacts without release hardening.
- Use **Planned** for roadmap-only work.
- Do not describe multi-user security, encrypted collaboration, autonomous agents, public webhook execution, or hosted production readiness as complete until tests and security review back that claim.
