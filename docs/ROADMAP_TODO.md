# MotionAI Massive Pass — Execution Backlog & Swarm Checklist

**Updated:** 2026-05-25T23:02:25+10:00
**Repo:** `/home/pi/OpenNotion` → `NaustudentX18/MotionAI`
**Branch:** `roadmap/p1-yjs-convergence`
**Mode:** Execution backlog plus current pass evidence. Keep GitHub issue closures conservative until changes land on GitHub/default branch.

---

## 1) Objective

Create and execute a large, evidence-backed roadmap pass that subagents can keep tackling without overclaiming shipped state. The target is a local-first MotionAI app with stronger reminders, meeting parsing, canvas-to-task flow, local privacy lock, webhook hardening, schema coverage, and live local/Tailnet verification.

---

## 2) Current Baseline / Evidence

- Branch: `roadmap/p1-yjs-convergence`
- Safety checkpoint: `.tmp/checkpoints/pre-swarm-20260525-224038.diff`
- Live GitHub repo: public `NaustudentX18/MotionAI`
- Live roadmap inventory: 35 open issues, no closed issues returned by `gh` at 2026-05-25.
- Verification passed in this pass:
  - `npm run verify`
  - `npm run build`
  - `npm run test:secret-redaction`
  - `PLAYWRIGHT_PORT=43107 npm run test:e2e`
- Live runtime proof after restart:
  - `systemctl --user restart motionai.service motionai-signaling.service`
  - `curl http://127.0.0.1:3003/api/health` → HTTP 200 / `ok:true`
  - `curl http://100.126.207.73:3003/api/health` → HTTP 200 / `ok:true`
  - `curl http://127.0.0.1:3005/health` → HTTP 200 / signaling `status:ok`

---

## 3) Lane Graph

### Wave A — foundation / blockers

- **L0:** Branch hygiene + conflict protocol
- **L1:** Green baseline verification
- **L2:** GitHub roadmap reconciliation
- **L3:** Reminders/notifications core gap
- **L4:** Meeting-notes-to-tasks core gap

### Wave B — depth and hardening

- **L5:** Automations/integrations hardening
- **L6:** Canvas intelligence actions
- **L8:** Local auth/security hardening
- **L9:** Schema/migration contract hardening
- **L10:** WebRTC resilience

### Wave C — release quality and moat

- **L7:** Desktop/mobile hardening
- **L11:** Docs truthfulness + launch narrative
- **L12:** Perf/offline/bundle budgets
- **L13:** Release operations

---

## 4) Subagent Lane Plan

| Lane | Scope | Priority | Depends on | Current status |
|---|---|---|---|---|
| L0 | Branch safety, snapshots, conflict map | P0 | none | ✅ checkpoint + ownership map captured |
| L1 | Fix lint break + verify gate | P0 | L0 | ✅ green full verify/build/e2e |
| L2 | GitHub issue/milestone/project reconciliation | P0 | L0 | 🟡 live audit complete; no mass closures yet |
| L3 | Reminder schema + runtime notification pipeline | P0 | L1 | 🟡 local reminder pipeline implemented; push/service-worker reminders still future |
| L4 | AI meeting-notes-to-tasks endpoint + preview UI | P0 | L1 | 🟡 endpoint + fallback + redaction tests done; preview UI still future |
| L5 | Rule-builder/webhook reliability hardening | P1 | L1, L2 | 🟡 webhook path validation + replay guard done; automation history still future |
| L6 | Canvas AI actions | P1 | L4 | 🟡 selection-to-task action done; e2e coverage still future |
| L7 | Tauri/mobile hardening path | P1 | L1 | ☐ docs/plans exist; no new signed release pipeline in this pass |
| L8 | Local auth lockscreen + PIN hardening | P1 | L1, L3 | 🟡 PIN lock, lockscreen, throttled failures, tests done; inactivity option still future |
| L9 | Schema/version/migration drift elimination | P1 | L1 | 🟡 reminder schema/docs/import/Yjs drift closed; broader fixtures remain future |
| L10 | WebRTC stress + ICE/STUN UX + diagnostics | P1 | L1, L9 | 🟡 existing resilience + e2e tests passed; ICE UI still future |
| L11 | README/ROADMAP/SHIPPED truth reconciliation | P1 | L2 | 🟡 roadmap/shipped/schema/webhook docs updated |
| L12 | Offline SW + perf + chunk budgets | P2 | L1 | ☐ build warnings captured; budget enforcement future |
| L13 | Release gate, changelog, rollback runbook | P2 | L1, L11, L12 | 🟡 release checklist exists; final release notes future |

---

## 5) Massive Checklist

## L0 — Branch hygiene + execution safety [P0]
- [x] Create safety checkpoint for current WIP
- [x] Decide keep/park/drop for pre-existing untracked files: keep `LockScreen`, `useReminders`, `localAuth` and finish them with tests
- [ ] Add local artifact ignore hygiene (`playwright-report`, `test-results`, temporary outputs) if git status exposes noise
- [x] Create file-ownership map for high-churn files
- [x] Define merge protocol for parallel lane PRs: one lane per feature surface; rerun `npm run verify` before merge
- [x] Add minimal pre-merge check set per lane: lint + targeted script + full verify before push

## L1 — Green baseline verification [P0]
- [x] Fix `WorkspaceSnapshot` typing contract in reminders path
- [x] Make `npm run lint` pass
- [x] Run `npm run verify`
- [x] Run `npm run build`
- [x] Run `npm run test:secret-redaction`
- [x] Run `PLAYWRIGHT_PORT=43107 npm run test:e2e`
- [x] Save verification log references in this roadmap doc

## L2 — GitHub roadmap reconciliation [P0]
- [x] Re-audit live issue/milestone/project counts via `gh`
- [x] Identify stale `claim:*` labels and issues needing split/closure proof
- [ ] Update stale GitHub labels after branch lands and acceptance criteria are checked
- [ ] Add closure checklist template comments to roadmap issues as follow-up
- [ ] Close issues that are truly complete with proof after push/PR review
- [x] Refresh `docs/GITHUB_ROADMAP_STATUS.md`

## L3 — Reminders + notifications core gap [P0]
- [x] Add `reminderDate` to canonical task/page schema
- [x] Wire reminder editor controls into task properties UI
- [x] Integrate `useReminders` into app bootstrap safely
- [x] Add dedupe/re-fire behavior across session boundaries
- [ ] Add dismiss/snooze interaction model
- [x] Add tests for reminder data scheduling buckets and schema/import/export retention
- [x] Add denied-permission no-op behavior in notification hook
- [ ] Add service-worker/Tauri background notification path for inactive app reminders

## L4 — Meeting-notes-to-tasks AI pipeline [P0]
- [x] Define normalized response contract for extracted tasks
- [x] Add `/api/ai/meeting-parser` endpoint contract
- [x] Add deterministic fallback and malformed-output normalization
- [ ] Add preview-before-write checklist UI
- [ ] Add selective apply (check/uncheck generated tasks)
- [ ] Add provider-mocked contract tests beyond redaction/fallback coverage
- [x] Add secret-redaction assertions for this endpoint

## L5 — Automations/integrations hardening [P1]
- [x] Reconcile webhook docs vs implementation
- [x] Add webhook replay protection + stronger path validation
- [ ] Add automation execution status + retry history
- [ ] Add trigger reliability tests (schedule + event)
- [ ] Add integration health diagnostics in settings
- [x] Document secure deployment notes for webhooks

## L6 — Canvas intelligence [P1]
- [x] Add sticky-note clustering action scaffold/alignment path
- [x] Add canvas multi-select to task conversion pipeline
- [ ] Add field-mapping preview before object writes
- [x] Keep conversion bulk action additive and page-create safe
- [ ] Add canvas action contract/e2e tests

## L7 — Desktop/mobile hardening [P1]
- [ ] Tauri keychain/keyring storage implementation for local secrets
- [ ] Native desktop file dialog integration implementation (import/export)
- [ ] Signed release + auto-update pipeline implementation
- [ ] `/capture` route startup budget checks on mobile
- [ ] Two-tap quick capture interaction validation
- [ ] Voice memo to inbox autosave reliability plan

## L8 — Local auth/security hardening [P1]
- [x] Integrate lockscreen gating into app lifecycle
- [x] Document local PIN threat model and limitations in UI copy
- [x] Add retry throttling / short lockout policy
- [ ] Add inactivity auto-lock option
- [ ] Add auth state migration/versioning checks
- [x] Add lock/unlock/session persistence tests

## L9 — Schema + migration contract hardening [P1]
- [x] Audit type/schema/docs drift for reminder/task model changes
- [ ] Enforce schema version bump invariants in tests
- [ ] Add backward-compat migration fixtures for every new task field
- [x] Update workspace schema docs for task/reminder fields
- [x] Preserve `reminderDate` through Yjs and import/export tests

## L10 — Collaboration/WebRTC resilience [P1]
- [x] Existing offline/reconnect convergence suite passes
- [ ] Add ICE/STUN config UI + validation
- [ ] Add peer diagnostics panel (connectivity + sync lag)
- [ ] Add signaling fallback behavior documentation
- [ ] Add browser-compat and network constraint notes

## L11 — Truthful docs + launch narrative [P1]
- [x] Reconcile ROADMAP/SHIPPED/schema/webhook docs with verified evidence from this pass
- [x] Use conservative status terms (`implemented`, `experimental`, `planned`, `still hardening`)
- [x] Keep not-yet-shipped background push/Tauri reminders marked future
- [ ] Refresh contributor onramp + good-first-issue mapping after issue labels are updated

## L12 — Performance/offline/bundle budgets [P2]
- [ ] Review and finalize offline service-worker strategy
- [ ] Add chunk-size budget checks to CI
- [ ] Capture startup performance baseline script
- [ ] Identify lazy-load wins for heavy modules (`transformers`, large app chunk)
- [ ] Add low-memory runtime checks

## L13 — Release ops [P2]
- [x] Existing release checklist defines go/no-go evidence shape
- [ ] Add changelog generation workflow
- [ ] Add rollback runbook for client/server artifacts
- [x] Use deployment smoke wrapper command set in this pass (`systemctl`, local curl, Tailnet curl)
- [ ] Define versioning policy for release candidates

---

## 6) Parallelization blueprint for remaining work

- **Issue/label pass:** L2 + L11 after this branch lands.
- **UX pass:** L3 snooze/dismiss + L4 preview UI + L6 field preview.
- **Hardening pass:** L8 inactivity lock + L10 ICE diagnostics + L12 bundle budgets.
- **Release pass:** L7 packaging + L13 changelog/rollback/versioning.

---

## 7) Stop condition for this pass

This pass is ready to push when the final diff is intentional, `npm run verify`, `npm run build`, `npm run test:secret-redaction`, and Playwright E2E are green, MotionAI is restarted locally, and both local + Tailnet health endpoints return HTTP 200.
