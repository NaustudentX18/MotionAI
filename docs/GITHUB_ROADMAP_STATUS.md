# GitHub Roadmap Status

**Checked:** 2026-05-25T23:02:25+10:00 with `gh` from `/home/pi/OpenNotion`
**Repository:** <https://github.com/NaustudentX18/MotionAI>
**Default branch:** `main`
**Visibility:** public repository

This file reconciles the local roadmap docs with live GitHub issue, milestone, and project state. It is a documentation snapshot only; do not treat open issues as closed just because local code now appears to satisfy some acceptance criteria.

## Summary

- Live issues #1–#35 are open.
- No closed issues were returned by `gh issue list --state closed --limit 20`.
- Milestones Phase 0 through Phase 8 plus `Backlog — Needs shaping` exist; Phase 6-8 have issue coverage.
- Owner project **MotionAI Public Roadmap** was previously verified public with 35 tracked items; project metadata was not mutated in this pass.
- This branch adds local-first reminder plumbing, a meeting-parser API, webhook replay protection, local PIN lock hardening, and canvas selection-to-task conversion. Keep GitHub issues open until the branch is pushed and acceptance criteria are checked.

## Milestones

| Milestone | Open | Closed | Live status |
| --- | ---: | ---: | --- |
| Phase 0 | 5 | 0 | open |
| Phase 1 | 6 | 0 | open |
| Phase 2 | 5 | 0 | open |
| Phase 3 | 4 | 0 | open |
| Phase 4 | 4 | 0 | open |
| Phase 5 | 1 | 0 | open |
| Phase 6 | 3 | 0 | open |
| Phase 7 | 3 | 0 | open |
| Phase 8 | 4 | 0 | open |
| Backlog — Needs shaping | 0 | 0 | open, no issues yet |

## Open issues by phase

### Phase 0

| Issue | Title | Labels | Reconciliation note |
| --- | --- | --- | --- |
| #1 | docs: reconcile public docs capability drift | `type:docs`, `area:trust`, `phase-0`, `claim:not-claimed` | This docs pass updates roadmap/shipped/issue docs; keep open until verified in PR/main. |
| #2 | product: decide public naming direction | `type:rfc`, `area:trust`, `phase-0`, `needs-rfc` | Naming status says MotionAI; still open as RFC/final launch decision. |
| #3 | community: finish health files and issue templates | `good first issue`, `type:community`, `phase-0`, `good-first-issue` | Community files/templates exist locally; keep open until verified on target branch. |
| #6 | labels: create public roadmap label set | `type:community`, `phase-0`, `claim:implemented` | Labels are in use; issue remains open. |
| #7 | project: create MotionAI public roadmap board | `type:community`, `phase-0`, `claim:implemented` | Project exists, `public: true`, and tracks 35 roadmap items; verify fields/issue coverage before closing. |

### Phase 1

| Issue | Title | Labels | Reconciliation note |
| --- | --- | --- | --- |
| #4 | tests: add two-browser Y.js convergence test | `type:test`, `area:collaboration`, `phase-1`, `claim:experimental` | `e2e/webrtc-sync.spec.ts` exists; needs routine browser/signaling validation. |
| #5 | rfc: define workspace object schema | `type:rfc`, `area:object-graph`, `phase-1`, `needs-rfc` | `docs/WORKSPACE_SCHEMA.md` and schema tests exist; verify before closing. |
| #8 | tests: add persistence torture test suite | `type:test`, `area:persistence`, `phase-1`, `claim:experimental` | `scripts/persistence-torture-tests.ts` exists. |
| #9 | ux: add sync and save status UI | `type:feature`, `type:ux`, `area:collaboration`, `phase-1`, `claim:planned` | `useSyncStatus.ts` and UI hooks exist; label/status may need update. |
| #10 | export: define and test export guarantees | `type:test`, `area:import-export`, `phase-1`, `claim:experimental` | Export/import docs and tests exist; verify before closing. |
| #11 | migrations: document schema versioning policy | `type:rfc`, `area:persistence`, `phase-1`, `needs-rfc` | Schema policy exists in docs; verify before closing. |

### Phase 2

| Issue | Title | Labels | Reconciliation note |
| --- | --- | --- | --- |
| #12 | templates: add page and database templates | `type:feature`, `phase-2`, `claim:planned` | Workspace and database templates exist locally; issue label/status may be stale. |
| #13 | databases: complete board/calendar/gallery/list/timeline-lite views | `type:feature`, `area:databases`, `phase-2`, `claim:planned` | Database view code exists; verify scope before closing. |
| #14 | graph: add backlinks graph and relationship explorer | `type:feature`, `area:docs-editor`, `phase-2`, `claim:planned` | `BacklinksGraph.tsx` exists; issue label/status may be stale. |
| #15 | import: add Notion markdown/html export importer | `type:feature`, `area:import-export`, `phase-2`, `claim:planned` | Notion importer exists; verify test coverage before closing. |
| #16 | import: add CSV task/database importer | `type:feature`, `area:import-export`, `phase-2`, `claim:planned` | No CSV importer evidence found in this pass; remains planned. |

### Phase 3

| Issue | Title | Labels | Reconciliation note |
| --- | --- | --- | --- |
| #17 | tasks: add My Tasks and Home views | `type:feature`, `area:tasks`, `phase-3`, `claim:planned` | `DashboardWidget.tsx` implements My Tasks/Home; verify before closing. |
| #18 | tasks: add inbox, notifications, and reminders | `type:feature`, `area:tasks`, `phase-3`, `claim:planned` | This branch adds schema/UI/local HTML5 reminder plumbing, dashboard reminder filters, and in-app snooze/dismiss actions. Background push/Tauri reminders remain open. |
| #19 | tasks: define project hierarchy model | `type:rfc`, `area:object-graph`, `phase-3`, `needs-rfc` | Spaces/folders/parent IDs exist locally; RFC may still be needed. |
| #20 | security: design guest/collaborator permissions | `type:rfc`, `type:security`, `phase-3`, `needs-rfc` | Still planned/not claimed. |

### Phase 4

| Issue | Title | Labels | Reconciliation note |
| --- | --- | --- | --- |
| #21 | ai: harden BYO/local provider registry UI | `type:feature`, `area:ai`, `phase-4`, `claim:experimental` | Provider registry UI exists; verify before closing. |
| #22 | ai: add summarize page action | `type:feature`, `area:ai`, `phase-4`, `claim:planned` | Summarize action exists; issue label/status may be stale. |
| #23 | ai: add meeting-notes-to-tasks action | `type:feature`, `area:tasks`, `area:ai`, `phase-4`, `claim:planned` | This branch adds `/api/ai/meeting-parser` with deterministic fallback/redaction coverage plus a preview/select/apply UI. Provider-mocked tests remain open. |
| #24 | security: design safe agent mode | `type:rfc`, `type:security`, `area:ai`, `phase-4`, `needs-rfc` | Guardrail helper exists; full agent mode remains not claimed. |

### Phase 5

| Issue | Title | Labels | Reconciliation note |
| --- | --- | --- | --- |
| #25 | automations: write rule-builder RFC | `type:rfc`, `area:automations`, `phase-5`, `needs-rfc` | This branch adds webhook path validation, replay protection, and docs. Rule execution history/RFC reconciliation remain open. |

## Project board

`gh project list --owner NaustudentX18 --format json --limit 50` returned:

| Project | Number | Items | Public | URL |
| --- | ---: | ---: | --- | --- |
| MotionAI Public Roadmap | 1 | 35 | true | <https://github.com/users/NaustudentX18/projects/1> |

Action: keep the board public and add new launch/blocker issues as roadmap scope changes.

## Current branch reconciliation notes (2026-05-25)

- `docs/ROADMAP_TODO.md` now distinguishes completed local work from remaining GitHub issue acceptance.
- `docs/WORKSPACE_SCHEMA.md` now documents task/page fields including `reminderDate`.
- `docs/WEBHOOK_API.md` now documents replay protection via `x-motionai-delivery`.
- Do not mass-close or mass-relabel issues from this branch alone; use issue comments/closures only after the pushed branch and verification evidence are visible on GitHub.
- Next pass adds in-app meeting-parser preview/select/apply UI, reminder snooze/dismiss toast, and a peer diagnostics panel in Peers & Sync.
- Follow-up pass adds device-local inactivity auto-lock settings for the PIN lockscreen, with supported timeout validation and local-auth regression coverage.

## Documentation maintenance rules

- Update this snapshot after opening, closing, splitting, or relabeling roadmap issues.
- Keep `ROADMAP.md` capability status based on current repo evidence, not GitHub labels alone.
- Keep GitHub labels honest: use `claim:implemented` only after the implementation and verification evidence are present on the target branch.
- Do not close issues in docs. Close/update them through GitHub after acceptance criteria are checked.
