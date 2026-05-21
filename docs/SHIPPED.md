# MotionAI — Shipped Status

**Date:** 2026-05-21  
**Project:** `/home/pi/OpenNotion`  
**Status:** private/self-hosted Pi deployment, not a public SaaS claim

This file records what is present in the repository today. It intentionally mirrors the conservative wording in [`README.md`](../README.md), [`ROADMAP.md`](../ROADMAP.md), and [`KNOWN_LIMITATIONS.md`](../KNOWN_LIMITATIONS.md).

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
npm run build
```

The bundled gate is:

```bash
npm run verify
```

## Shipped capabilities

| Capability | Status | Evidence |
| --- | --- | --- |
| React/Vite workspace app and Express server | Implemented | `src/App.tsx`, `server.ts`, `vite.config.ts`, `npm run build` |
| Block editor workspace | Implemented | `src/components/BlockEditor.tsx`, `src/hooks/useBlockEditor.ts`, `src/components/blocks/` |
| Local-first persistence and migrations | Implemented, still hardening | `src/lib/persistence.ts`, `src/lib/yjs.ts`, `src/lib/yjs-migration.ts`, `scripts/migration-tests.ts` |
| Import/export round trips | Implemented | `scripts/import-export-tests.ts` |
| Multi-provider BYO/local AI proxy | Implemented | `server.ts`, `src/lib/ai/providers.ts`, `scripts/ai-contract-tests.ts` |
| Spellcheck response validation | Implemented | `scripts/spellcheck-schema-tests.ts` |
| Google Workspace helper guards | Implemented behind auth | `src/lib/workspace.ts`, `scripts/workspace-mock-tests.ts` |
| Backlinks | Implemented | `src/lib/backlinks.ts`, `src/lib/backlinksIndex.ts`, `src/components/BacklinksPanel.tsx` |
| Peer presence | Implemented | `src/lib/presence.ts`, `src/components/PresenceIndicator.tsx` |
| Y.js CRDT foundation | Implemented, still hardening | `src/lib/yjs.ts`, `src/lib/extensions/YjsBlockExtension.ts`, `docs/CRDT_CONFLICT_RESOLUTION.md` |
| WebRTC document sync | Experimental | `src/App.tsx`, `signaling-server.js`, local `motionai-signaling.service` deployment notes |
| Optional encryption-at-rest | Implemented, with caveats | `src/lib/crypto.ts`, `src/lib/persistence.ts`, `KNOWN_LIMITATIONS.md` |
| Canvas pages | Early prototype | `src/components/CanvasEditor.tsx`, `src/types.ts` |
| Tauri desktop app | Prototype | `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` |
| Production multi-user security | Not claimed | `KNOWN_LIMITATIONS.md`, `SECURITY.md` |

## Not shipped as production-ready

- Full Notion-grade databases, formulas, relations, rollups, and templates.
- ClickUp-grade task hierarchy, dashboards, workload, notifications, and time tracking.
- Production-ready encrypted multi-peer collaboration or key exchange.
- Public Internet API exposure without an auth/reverse-proxy/security review.
- Signed desktop releases, auto-update, cross-platform desktop QA, or mobile app packages.
- Full infinite canvas/whiteboard workspace behavior.

## Local deployment facts

The Pi handover notes reported these local services as active on 2026-05-21:

```bash
systemctl --user status motionai.service
systemctl --user status motionai-signaling.service
curl -I http://127.0.0.1:3003
curl http://127.0.0.1:3005/health
```

Those checks are deployment facts for this host, not a guarantee for every clone.

## Documentation alignment

- Product positioning and future phases: [`ROADMAP.md`](../ROADMAP.md)
- Conservative caveats: [`KNOWN_LIMITATIONS.md`](../KNOWN_LIMITATIONS.md)
- Naming direction: [`docs/PRODUCT_NAMING.md`](PRODUCT_NAMING.md)
- Phase 0 GitHub issue drafts: [`docs/PHASE_0_ISSUES.md`](PHASE_0_ISSUES.md)
