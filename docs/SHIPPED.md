# MotionAI — Shipped Status

**Snapshot date:** 2026-05-23T09:08:21+10:00  
**Project:** `/home/pi/OpenNotion`  
**Repository:** `NaustudentX18/MotionAI`  
**Status:** private/self-hosted local-first app; public SaaS, production multi-user security, and hosted cloud readiness are **not claimed**

This file records what is present in the repository today. It intentionally mirrors the conservative wording in [`README.md`](../README.md), [`ROADMAP.md`](../ROADMAP.md), and [`KNOWN_LIMITATIONS.md`](../KNOWN_LIMITATIONS.md). Some local implementation work is ahead of the live GitHub issue state; keep issues open until the acceptance criteria are verified on GitHub.

## Verification snapshot

## Credential-free local verification

Credential-free checks available from the repo:

```bash
npm run verify:static
npm run lint
npm run test:ai
npm run test:spellcheck
npm run test:workspace
npm run test:import-export
npm run test:smoke
npm run test:migration
npm run test:reliability
npm run test:torture
npm run test:importers
npm run build
```

The bundled gate is:

```bash
npm run verify
```

`npm run verify:static` is the required lightweight check after public docs/claim edits.

## Shipped capabilities

| Capability | Status | Evidence |
| --- | --- | --- |
| React/Vite workspace app and Express server | Implemented | `src/App.tsx`, `server.ts`, `vite.config.ts`, `npm run build` |
| Block editor workspace | Implemented | `src/components/BlockEditor.tsx`, `src/hooks/useBlockEditor.ts`, `src/components/blocks/` |
| Local-first persistence and migrations | Implemented, still hardening | `src/lib/persistence.ts`, `src/lib/yjs.ts`, `src/lib/yjs-migration.ts`, `scripts/migration-tests.ts` |
| Import/export JSON workspace backups | Implemented | `src/lib/workspaceImportExport.ts`, `scripts/import-export-tests.ts`, `docs/EXPORT_IMPORT_GUARANTEES.md` |
| Secret redaction / API responses not returning provider keys | Implemented | `keysReturned: false` in `server.ts`, `src/lib/ai/providers.ts`, `scripts/ai-contract-tests.ts`, `scripts/secret-redaction-tests.ts` |
| Multi-provider BYO/local AI proxy | Implemented | `server.ts`, `src/lib/ai/providers.ts`, `scripts/ai-contract-tests.ts` |
| AI actions: summarize, draft, rewrite, spellcheck, custom prompts | Implemented, still hardening | `src/components/blocks/AiMenu.tsx`, `src/hooks/useAICommands.ts`, `src/components/CommandPalette.tsx` |
| Workspace Copilot / RAG-style assistant | Implemented, still hardening | `src/components/copilot/WorkspaceCopilot.tsx` |
| Safe-agent guardrail primitives | Implemented, not a shipped autonomous agent | `src/lib/ai/safeAgentMode.ts`, `docs/AI_SAFETY_AND_PROVIDER_GUARANTEES.md` |
| Spellcheck response validation | Implemented | `scripts/spellcheck-schema-tests.ts` |
| Google Workspace helper guards | Implemented behind auth | `src/lib/workspace.ts`, `scripts/workspace-mock-tests.ts` |
| Backlinks and wiki links | Implemented | `src/lib/backlinks.ts`, `src/lib/backlinksIndex.ts`, `src/components/BacklinksPanel.tsx` |
| Backlinks graph / relationship explorer | Implemented | `src/components/BacklinksGraph.tsx`, `src/components/PageAddons.tsx` |
| Peer presence | Implemented | `src/lib/presence.ts`, `src/components/PresenceIndicator.tsx` |
| Y.js CRDT foundation | Implemented, still hardening | `src/lib/yjs.ts`, `src/lib/extensions/YjsBlockExtension.ts`, `docs/CRDT_CONFLICT_RESOLUTION.md` |
| WebRTC document sync | Experimental | `src/App.tsx`, `signaling-server.js`, `e2e/webrtc-sync.spec.ts`, `docs/CRDT_CONFLICT_RESOLUTION.md` |
| Sync/save/encryption status UI | Implemented, still hardening | `src/hooks/useSyncStatus.ts`, `src/App.tsx`, `src/components/PageAddons.tsx` |
| Optional encryption-at-rest | Implemented, with caveats | `src/lib/crypto.ts`, `src/lib/persistence.ts`, `KNOWN_LIMITATIONS.md` |
| Canvas pages and canvas templates | Implemented prototype | `src/components/CanvasEditor.tsx`, `src/lib/canvasTemplates.ts`, `src/types.ts` |
| Database objects, views, formula-lite, and templates | Implemented, still hardening | `src/components/blocks/DatabaseBlock.tsx`, `src/components/database/`, `src/lib/ai/AiFormulaEngine.ts` |
| Task properties, My Tasks/Home, Inbox, dashboard, time tracking | Implemented, still hardening | `src/components/tasks/TaskPropertiesPanel.tsx`, `src/components/tasks/taskAdapter.ts`, `src/components/dashboard/DashboardWidget.tsx` |
| Durable notifications/reminder scheduling | Implemented, still hardening | `src/hooks/useReminders.ts`, `src/components/tasks/TaskPropertiesPanel.tsx`, `src/components/dashboard/DashboardWidget.tsx`; browser notifications are local-device only and require permission |
| Spaces/folders/project hierarchy | Implemented, still hardening | `src/types.ts`, `src/components/SpaceFolderPicker.tsx`, `src/components/Sidebar.tsx`, `src/App.tsx` |
| Workspace templates | Implemented | `src/lib/workspaceTemplates.ts`, `src/components/Sidebar.tsx` |
| Automations rule builder and settings UI | Implemented, still hardening | `src/lib/automations/ruleBuilder.ts`, `src/components/SettingsModal.tsx` |
| Webhook/API automation execution | Experimental | `server.ts`, `docs/WEBHOOK_API.md`, `scripts/secret-redaction-tests.ts` |
| Telemetry-free diagnostics export | Implemented | `src/lib/diagnostics.ts`, `src/components/SettingsModal.tsx` |
| Mobile browser workspace/capture shell | Prototype | `src/components/MobileWorkspaceApp.tsx` |
| Tauri desktop app | Prototype | `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` |
| Production multi-user security | Not claimed | `KNOWN_LIMITATIONS.md`, `SECURITY.md` |

## Experimental or prototype surfaces

- **WebRTC/Y.js collaboration:** wiring and a two-browser spec exist, but production-grade concurrent editing still needs routine browser/signaling validation and multi-peer conflict testing.
- **Canvas:** pages, live cards, and templates exist; AI canvas actions and release-grade whiteboard behavior are not complete.
- **Mobile:** a browser-oriented mobile shell exists; native mobile apps and measured two-tap/one-second capture targets are not proven.
- **Tauri:** project files exist; signed releases, auto-update, cross-platform QA, and release packaging are not complete.
- **Automations/webhooks:** local rule builder exists; public webhook execution routes and deployment security review are not complete.
- **Safe agent mode:** policy/audit/prompt-injection helpers exist; autonomous agent execution is not shipped or claimed.

## Not shipped as production-ready

- Production-ready encrypted multi-peer collaboration or key exchange.
- Public Internet API exposure without an auth/reverse-proxy/security review.
- Durable cross-device notification delivery and reminder scheduling.
- Full autonomous AI agent mode with side-effect execution.
- Signed desktop releases, auto-update, cross-platform desktop QA, or native mobile app packages.
- Full Notion/ClickUp parity across every database, task, dashboard, permissions, and automation feature.

## Live GitHub state

Live GitHub was inspected with `gh` on 2026-05-23 local time:

- `NaustudentX18/MotionAI` is public, default branch `main`.
- Issues #1–#35 are open and assigned to Phase 0–Phase 8 milestones; no recent closed issues were returned.
- Milestones Phase 0 through Phase 8 plus `Backlog — Needs shaping` exist; Phase 6-8 now have issue coverage.
- Owner project **MotionAI Public Roadmap** exists with 35 items and `gh project list` reports it is public.

See [`docs/GITHUB_ROADMAP_STATUS.md`](GITHUB_ROADMAP_STATUS.md) for the issue and milestone mapping.

## Local deployment facts

The previous Pi handover notes reported these local services as active on 2026-05-21:

```bash
systemctl --user status motionai.service
systemctl --user status motionai-signaling.service
curl -I http://127.0.0.1:3003
curl http://127.0.0.1:3005/health
```

Those checks are deployment facts for this host, not a guarantee for every clone. Re-run them before claiming the current service state.

## Documentation alignment

- Product positioning and future phases: [`ROADMAP.md`](../ROADMAP.md)
- Conservative caveats: [`KNOWN_LIMITATIONS.md`](../KNOWN_LIMITATIONS.md)
- Naming direction: follow the naming status in [`ROADMAP.md`](../ROADMAP.md) unless a dedicated naming RFC is later added.
- Phase 0 GitHub issue drafts and live mapping: [`docs/PHASE_0_ISSUES.md`](PHASE_0_ISSUES.md), [`docs/GITHUB_ROADMAP_STATUS.md`](GITHUB_ROADMAP_STATUS.md)
