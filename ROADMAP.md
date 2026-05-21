# MotionAI Roadmap

MotionAI is a free, open-source, self-hostable local-first workspace where docs, tasks, automations, calendar, canvas, and AI share one inspectable object graph that can run on a laptop, Pi, homelab, or company server.

## Naming status

The project is fully branded as **MotionAI**. The repository name remains `MotionAI` for legacy GitHub routing.

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

`npm run verify` is the default credential-free gate for pull requests. Tests that need real provider keys, Google OAuth, or multiple browsers must be documented separately and should never be implied by the local gate.

## Current verified baseline

| Capability | Current status | Evidence |
| --- | --- | --- |
| React/Vite app with Express server | Implemented | `src/App.tsx`, `server.ts`, `vite.config.ts`, `npm run build` |
| Block workspace/editor | Implemented | `src/components/BlockEditor.tsx`, `src/hooks/useBlockEditor.ts`, `src/components/blocks/` |
| Local-first persistence and migrations | Implemented, still hardening | `src/lib/persistence.ts`, `src/lib/yjs.ts`, `src/lib/yjs-migration.ts`, `scripts/migration-tests.ts` |
| Y.js CRDT foundation | Implemented, still hardening | `src/lib/yjs.ts`, `src/lib/extensions/YjsBlockExtension.ts`, `KNOWN_LIMITATIONS.md` |
| WebRTC document sync | Experimental | `src/App.tsx`, `signaling-server.js`, `docs/CRDT_CONFLICT_RESOLUTION.md` |
| Peer presence | Implemented | `src/lib/presence.ts`, `src/components/PresenceIndicator.tsx` |
| Encryption-at-rest | Implemented, with caveats | `src/lib/crypto.ts`, `src/lib/persistence.ts`, `KNOWN_LIMITATIONS.md` |
| Multi-provider BYO/local AI proxy | Implemented | `server.ts`, `src/lib/ai/providers.ts`, `scripts/ai-contract-tests.ts` |
| Google Workspace helpers | Implemented behind auth | `src/lib/workspace.ts`, `scripts/workspace-mock-tests.ts` |
| Backlinks | Implemented | `src/lib/backlinks.ts`, `src/lib/backlinksIndex.ts`, `src/components/BacklinksPanel.tsx` |
| Canvas pages | Early prototype | `src/components/CanvasEditor.tsx`, `src/types.ts` |
| Tauri desktop app | Prototype | `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` |
| Production multi-user security | Not claimed | `KNOWN_LIMITATIONS.md`, `SECURITY.md` |

## Product principles

1. **Fast core beats feature theater.** Every major capability needs a performance budget and repeatable proof.
2. **Local-first by default.** Cloud and sync are options, not requirements for single-user work.
3. **BYO AI and local AI are first-class.** Gemini, OpenAI-compatible endpoints, Ollama, LM Studio, vLLM, and disabled mode are supported without forced hosted AI.
4. **Docs and tasks should share one object graph.** A task should be usable as a block, database row, calendar item, dashboard source, or canvas card without duplicating data.
5. **Open-source trust over marketing.** Public claims must link to code, docs, tests, or known limitations.
6. **Composable, not cluttered.** Power should ship through optional modules, templates, command palette flows, and clear settings.

## Phase 0 — Trust and positioning cleanup

Phase 0 exists to make the public repo credible before adding more product surface. GitHub-ready issue drafts live in [`docs/PHASE_0_ISSUES.md`](docs/PHASE_0_ISSUES.md).

- [x] Reconcile README, roadmap, and shipped docs around Y.js, WebRTC sync, canvas, E2EE, Tauri, and production-security claims.
- [x] Document naming direction and avoid implying affiliation with Notion or ClickUp.
- [x] Add open-source contribution, security, code-of-conduct, and issue-template files.
- [x] Extend static verification so required community files and conservative claim boundaries stay present.
- [ ] Open or copy the Phase 0 GitHub issues from [`docs/PHASE_0_ISSUES.md`](docs/PHASE_0_ISSUES.md).
- [ ] Add first “good first issue” labels and project board once GitHub repo settings are available.

## Phase 1 — Local-first reliability moat

- [ ] Add a two-browser Y.js convergence Playwright test against the self-hosted signaling server.
- [ ] Add persistence torture tests for large workspaces: 1k pages, 10k blocks, long docs, repeated reloads, and offline/reconnect flows.
- [ ] Add sync status UI: local saved, peer connected, conflict/replay queue, encrypted/unlocked state.
- [ ] Add export guarantees: Markdown, JSON, HTML zip, attachments manifest.
- [ ] Define workspace object schema versioning and migration policy.

## Phase 2 — Document/database foundation

- [ ] Implement real database objects: tables, properties, formulas-lite, relations, and rollups-lite.
- [ ] Build table, board, calendar, gallery/list, and timeline-lite views.
- [ ] Add page templates and database templates.
- [ ] Add backlinks graph view and page relationship explorer.
- [ ] Add importers for Notion markdown/HTML export, CSV, and ClickUp CSV/tasks export where feasible.

## Phase 3 — Execution layer

- [ ] Make tasks first-class objects: assignee, status, due date, priority, custom fields, dependencies.
- [ ] Add My Tasks/Home, Inbox, notifications, and reminders.
- [ ] Add dashboards: task counts, overdue work, workload, time estimates, and simple charts.
- [ ] Add time tracking and timesheets-lite.
- [ ] Add project hierarchy: Workspace → Space → Folder → Project/List → Task/Subtask, while allowing docs/databases anywhere.
- [ ] Add guest/collaborator permissions for self-hosted teams.

## Phase 4 — BYO/local AI workspace brain

- [ ] Harden provider registry UI for Gemini, OpenAI-compatible endpoints, Ollama, LM Studio, vLLM, and custom endpoints.
- [ ] Add local RAG over pages, tasks, and files with user-visible index state.
- [ ] Add AI actions: summarize page, convert meeting notes to tasks, auto-tag, draft project plan, find stale tasks, and explain dashboard.
- [ ] Add safe agent mode: read-only default, tool permission prompts, audit log, and prompt-injection warnings for external content.
- [ ] Keep keys local/browser/server-configurable and preserve tests that prove secrets are not returned in API responses.

## Phase 5 — Automations and integrations

- [ ] Add rule builder: trigger → conditions → action.
- [ ] Support triggers for status changes, due dates, new pages/tasks, mentions, webhooks, and schedules.
- [ ] Support actions to create/update tasks, append doc blocks, send webhooks, call local scripts, and run AI classify/summarize steps.
- [ ] Harden Google Calendar/Drive/Tasks behind credentialed deployment checks.
- [ ] Add open webhook/API docs and local n8n-style recipe examples.

## Phase 6 — Canvas and spatial planning

- [ ] Upgrade the starter canvas page into a workspace object surface.
- [ ] Allow docs, tasks, and database rows to appear as live canvas cards.
- [ ] Add whiteboard templates: project kickoff, sprint map, content calendar, and research wall.
- [ ] Add AI canvas actions such as clustering sticky notes and turning a canvas into tasks.

## Phase 7 — Desktop/mobile packaging

- [ ] Harden Tauri: signed releases, auto-update path, keychain support, filesystem import/export.
- [ ] Add mobile-first capture mode: quick task, quick note, voice note, photo/PDF ingest.
- [ ] Keep mobile task capture under two taps and common actions under one second perceived response.

## Phase 8 — Community launch loop

- [ ] Publish a public demo, roadmap, and “good first issue” board.
- [ ] Position honestly against open-source workspace alternatives: execution + docs + BYO/local AI, not “open Notion” alone.
- [ ] Build templates: student planner, agency CRM, product roadmap, homelab ops, personal wiki, sprint board.
- [ ] Add a telemetry-free diagnostics bundle users can export when filing bugs.

## Claim policy

- Use **Implemented** only when the repo contains working code and at least one repeatable check or direct file evidence.
- Use **Experimental** for wired features that need multi-user, multi-device, credentialed, or long-running validation.
- Use **Prototype** for present code/artifacts without release hardening.
- Use **Planned** for roadmap-only work.
- Do not describe multi-user security, encrypted collaboration, or hosted production readiness as complete until tests and security review back that claim.
