# MotionAI — Phased Execution TODO

**Generated:** 2026-05-26
**Repo:** `NaustudentX18/MotionAI` → `/home/pi/OpenNotion`
**Current branch:** `roadmap/l8-inactivity-lock` (ahead of `origin/main` by 6 files)
**Live GitHub issues:** 35 open (#1–#35), 0 closed
**Latest merged PR:** #36 — `roadmap/p1-yjs-convergence` landed on `main`

---

This TODO breaks remaining work into sequential phases. Each phase has a clear
stopping condition and swarm annotations for parallelisable lanes.

---

## Phase 0 — Issue closeout + git hygiene

**Target:** Close every GitHub issue whose acceptance criteria are satisfied by
code already on `origin/main`, and clean up git noise.

| Step | Details | Swarm? |
|------|---------|--------|
| 0.1 | Add `playwright-report/`, `test-results/`, `.tmp/` to `.gitignore` | single |
| 0.2 | Close **Phase 0** issues (#1, #2, #3, #6, #7) with proof links | single |
| 0.3 | Close **Phase 1** issues (#4, #5, #8, #9, #10, #11) with proof links | single |
| 0.4 | Close **Phase 2** issues (#12, #13, #14, #15, #16) with proof links | single |
| 0.5 | Refresh `docs/GITHUB_ROADMAP_STATUS.md` after closures | single |
| 0.6 | Push `roadmap/l8-inactivity-lock` → open PR #37 → merge | single |

**Verification:** `gh issue list --state open` drops from 35 to ≤28. Git status
clean after merge.

---

## Phase 1 — Notification pipeline + meeting parser final mile

**Target:** Ship the two remaining P0 gaps from the last swarm pass.

| Step | Details | Swarm? |
|------|---------|--------|
| 1.1 | **Service-worker background notifications** — register `public/sw.js` to receive `push` events; pipe browser `Notification` API for reminders when app is backgrounded. Persist permission state. | L3-lane |
| 1.2 | **Provider-mocked meeting parser tests** — add contract tests that inject a mock provider and verify the `/api/ai/meeting-parser` response shape, fallback behavior, and secret redaction. | L4-lane |
| 1.3 | **Tauri keychain integration** — wire `src-tauri/` to use OS keyring/keychain for storing AI provider secrets instead of `.env` files. Document macOS/Linux/Windows coverage. | L7-lane |

**Verification:** `npm run test:secret-redaction` still green. New mock-provider
tests pass. Service worker registers in browser devtools. Tauri build compiles
with keychain feature.

---

## Phase 2 — Automations hardening + canvas depth

**Target:** Close remaining Phase 5 and Phase 6 gaps that need implementation,
not just docs.

| Step | Details | Swarm? |
|------|---------|--------|
| 2.1 | **Automation execution history** — add `src/lib/automations/automationHistory.ts` with status log (triggered/skipped/failed/error), retry button, and settings UI. | L5-lane |
| 2.2 | **Trigger reliability tests** — add scheduled-trigger and event-trigger tests under `scripts/automation-trigger-tests.ts` with T=0 + T+delay verification. | L5-lane |
| 2.3 | **Integration health diagnostics** — expose automation + WebRTC + persistence health tiles in Settings > Diagnostics. | L5-lane |
| 2.4 | **Canvas field-mapping preview** — before canvas-selection-to-task writes, show a modal mapping canvas card fields → task fields. Let user adjust before applying. | L6-lane |
| 2.5 | **Canvas action e2e tests** — add Playwright spec for sticky-note cluster + selection-to-task happy path. | L6-lane |

**Verification:** `npm run test:automations` (new) green. Canvas e2e spec passes
on headless Chromium. `npm run verify` still green.

---

## Phase 3 — Auth, schema, collaboration hardening

**Target:** Eliminate drift risk and close the security/schema/collab hardening
loopholes.

| Step | Details | Swarm? |
|------|---------|--------|
| 3.1 | **Auth state migration** — add versioning to `localAuth` state shape so future auth changes don't break existing locked workspaces. | L8-lane |
| 3.2 | **Schema version bump invariants** — enforce in tests that `WORKSPACE_SCHEMA_VERSION` bumps are accompanied by a documented migration plan. | L9-lane |
| 3.3 | **Backward-compat migration fixtures** — add a fixture for every new task/page field that exercises old→new schema migration. | L9-lane |
| 3.4 | **ICE/STUN config UI** — expose WebRTC ICE server list in Settings > Collaboration with add/remove/validation. | L10-lane |
| 3.5 | **Signaling fallback docs** — document WebRTC behavior when signaling server is unreachable (degraded single-user mode). | L10-lane |
| 3.6 | **Browser-compat notes** — add supported browser matrix to `KNOWN_LIMITATIONS.md`. | L10-lane |

**Verification:** `npm run test:migration` covers new fixtures. Auth state
versioning tested. WebRTC settings render and persist.

---

## Phase 4 — Mobile + desktop polish

**Target:** Make Tauri and mobile surfaces shippable for power users.

| Step | Details | Swarm? |
|------|---------|--------|
| 4.1 | **Signed Tauri releases** — configure `TAURI_SIGNING_PRIVATE_KEY` + CI signing step. Produce a draft release with signed `.deb`/`.AppImage` artifacts. | L7-lane |
| 4.2 | **Tauri auto-update** — wire `@tauri-apps/plugin-updater` with a release feed. | L7-lane |
| 4.3 | **Mobile capture budget** — measure `/capture` route startup; keep cold load under 2 s on a mid-range device. | L7-lane |
| 4.4 | **Two-tap quick capture** — validate that creating a quick task from the mobile shell is ≤2 taps and ≤1 s perceived response. | L7-lane |
| 4.5 | **Voice memo reliability** — add auto-save on interruption + inbox fallback for failed transcription. | L7-lane |

**Verification:** `npm run build` produces release artifacts. `/capture` loads
under 2 s cold. Two-tap capture flow verified in Playwright mobile emulation.

---

## Phase 5 — Performance, offline, bundle budgets

**Target:** Make MotionAI feel fast and work offline on first visit.

| Step | Details | Swarm? |
|------|---------|--------|
| 5.1 | **Offline service worker** — write `public/sw.js` that caches the Vite-built client bundle (`dist/assets/`) and serves it on fetch failure. Include a "You are offline" banner. | L12-lane |
| 5.2 | **Chunk budget CI check** — add a script that fails CI if any chunk exceeds 500 kB gzipped. Wire into `npm run verify:static`. | L12-lane |
| 5.3 | **Startup perf baseline** — add `scripts/startup-perf.ts` that measures `Time to Interactive` via Playwright and records it. | L12-lane |
| 5.4 | **Lazy-load heavy modules** — identify `transformers`, charting, and large vendor chunks. Code-split with `React.lazy` + preload hints. | L12-lane |
| 5.5 | **Low-memory runtime check** — add `navigator.deviceMemory` detection; disable heavy animations/rendering on low-memory devices. | L12-lane |

**Verification:** Workspace loads with no network (after first visit). CI fails
if a chunk exceeds budget. `startup-perf` script produces a baseline report.

---

## Phase 6 — Launch readiness + community

**Target:** Make the repo welcoming and launch-credible.

| Step | Details | Swarm? |
|------|---------|--------|
| 6.1 | **Refresh CONTRIBUTING.md** — update with current test gates, branch conventions, and review expectations. | L11-lane |
| 6.2 | **Good-first-issue pass** — audit open issues, label remaining `good first issue` candidates, write helpful issue bodies. | L11-lane |
| 6.3 | **Changelog workflow** — add `scripts/generate-changelog.sh` that reads git log since last tag and formats markdown. | L13-lane |
| 6.4 | **Rollback runbook** — write `docs/ROLLBACK.md` covering server, signaling, and client rollback steps. | L13-lane |
| 6.5 | **Versioning policy** — document semver-ish scheme in `docs/VERSIONING.md`. Tag current HEAD as `v0.1.0`. | L13-lane |
| 6.6 | **Public demo / landing page** — polish `index.html` with demo GIF, feature callouts, and link to live issues. | single |

**Verification:** `gh issue list --label "good first issue"` shows ≥3 grabable
issues. `npm run verify` green after each doc/artifact change.

---

## Phase 7 — Long-term roadmap (future)

These are not yet ready for implementation — they need RFCs, design decisions,
or external dependency evaluation first.

| Item | Phase | Pre-req | Notes |
|------|-------|---------|-------|
| Guest/collaborator permissions | Phase 3 (#20) | Phase 6 done | Needs security RFC + permissions model |
| Full autonomous agent mode | Phase 4 (#24) | Phase 6 done | Safe-agent primitives exist; full mode needs execution sandbox |
| Multi-user production security | Post-roadmap | Phase 7 done | Beyond scope of single-user self-hosted |
| AI canvas actions (cluster → task) | Phase 6 (#26) | Phase 2 done | Scaffold exists; needs AI contract + field mapping |
| Tauri signed releases + auto-update | Phase 7 | Phase 6 done | Depends on signing CI + updater plugin |
| Desktop cross-platform QA | Phase 7 | Phase 4 done | Needs macOS + Windows CI runners |

---

## Swarm execution guidance

- **Parallelisable** lanes are marked in the `Swarm?` column above.
- Run lanes independently; use `src/App.tsx`, `src/types.ts`, `server.ts` as
  single-owner merge gates (one lane at a time touches these).
- Before each phase: `npm run verify && npm run build` must be green.
- After each phase: update `docs/SHIPPED.md`, `docs/GITHUB_ROADMAP_STATUS.md`,
  and close the corresponding GitHub issues.
- **Stop condition per phase:** all checklist items verified, docs updated,
  no regressions in `npm run verify`.

## Verification gate (run this after every phase)

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
npm run test:e2e    # if Playwright browsers are installed
```
