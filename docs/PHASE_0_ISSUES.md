# Phase 0 GitHub Issues

Phase 0 is about trust, positioning, and contribution readiness before expanding the product surface.

**Live status:** The original Phase 0 drafts have been opened on GitHub. Keep this file as the source-of-truth brief for what each issue is meant to prove, but use [`docs/GITHUB_ROADMAP_STATUS.md`](GITHUB_ROADMAP_STATUS.md) for the latest issue/milestone/project reconciliation snapshot.

## Live Phase 0 issues

| Issue | Title | Status on 2026-05-23 | Notes |
| --- | --- | --- | --- |
| [#1](https://github.com/NaustudentX18/MotionAI/issues/1) | docs: reconcile public docs capability drift | Open | This docs pass updates roadmap/shipped status; close only after PR/main verification. |
| [#2](https://github.com/NaustudentX18/MotionAI/issues/2) | product: decide public naming direction | Open | MotionAI is the current brand; keep open if a public-launch naming RFC is still required. |
| [#3](https://github.com/NaustudentX18/MotionAI/issues/3) | community: finish health files and issue templates | Open | Community files/templates exist locally; verify on target branch before closing. |
| [#6](https://github.com/NaustudentX18/MotionAI/issues/6) | labels: create public roadmap label set | Open | Labels are in use; issue still open. |
| [#7](https://github.com/NaustudentX18/MotionAI/issues/7) | project: create MotionAI public roadmap board | Open | Owner project exists and `gh project list` reports `public: true`; verify fields/issue coverage before closing. |

Issues [#4](https://github.com/NaustudentX18/MotionAI/issues/4) and [#5](https://github.com/NaustudentX18/MotionAI/issues/5) were drafted here originally but are now Phase 1 live issues.

---

## Issue 1 — Reconcile public docs capability drift

**Live issue:** <https://github.com/NaustudentX18/MotionAI/issues/1>  
**Labels:** `type:docs`, `area:trust`, `phase-0`, `claim:not-claimed`

### Summary
Keep `README.md`, `ROADMAP.md`, `docs/SHIPPED.md`, and `KNOWN_LIMITATIONS.md` aligned so public claims match tested capabilities.

### Background
The project is positioning itself as a self-hostable local-first workspace with BYO/local AI, Y.js collaboration foundations, canvas prototype, Tauri prototype, and conservative security boundaries. Any mismatch between shipped docs and limitations docs erodes trust.

### Acceptance criteria
- [ ] Every implemented/experimental/prototype/planned claim has file or test evidence.
- [ ] Y.js, WebRTC sync, E2EE/encryption-at-rest, canvas, Tauri, automations, AI-agent, and production-security claims use the same status language across docs.
- [ ] `npm run verify:static` fails if the required trust docs disappear.
- [ ] README links to roadmap, limitations, security policy, and contribution docs.

### Verification
```bash
npm run verify:static
npm run lint
```

## Issue 2 — Decide public product naming direction

**Live issue:** <https://github.com/NaustudentX18/MotionAI/issues/2>  
**Labels:** `type:rfc`, `area:trust`, `phase-0`, `needs-rfc`

### Summary
Choose whether to keep MotionAI or adopt a fresh unique name before broader launch.

### Background
The repo is `MotionAI`, some local paths still use `OpenNotion`, and the roadmap aims beyond a Notion clone into docs + tasks + BYO/local AI. A unique name may reduce trademark/confusion risk; if MotionAI remains the brand, docs should explicitly avoid implying affiliation with Notion, ClickUp, or Motion.

### Acceptance criteria
- [ ] Open or update a short RFC with name options, risks, migration cost, and recommendation.
- [ ] Avoid any wording that implies affiliation with Notion, ClickUp, or Motion.
- [ ] Update README/package metadata/app copy consistently after a decision.
- [ ] Preserve redirects/aliases or migration notes for existing repo users.

### Verification
```bash
rg -n "OpenNotion|MotionAI|Notion|ClickUp|Motion" README.md ROADMAP.md docs package.json src
npm run verify:static
```

## Issue 3 — Finish community health files and templates

**Live issue:** <https://github.com/NaustudentX18/MotionAI/issues/3>  
**Labels:** `good first issue`, `type:community`, `phase-0`, `good-first-issue`

### Summary
Make the project welcoming and safe for external contributors by keeping contributor, security, conduct, and issue-template files current.

### Acceptance criteria
- [ ] `CONTRIBUTING.md` explains setup, tests, claim policy, and PR expectations.
- [ ] `SECURITY.md` explains supported surface, reporting path, and no-production-security claim.
- [ ] `CODE_OF_CONDUCT.md` sets concise participation expectations.
- [ ] `.github/ISSUE_TEMPLATE/` includes bug, feature, docs drift, and security-safe guidance.
- [ ] Templates steer reporters away from posting secrets.

### Verification
```bash
find .github/ISSUE_TEMPLATE -maxdepth 1 -type f -print | sort
npm run verify:static
```

## Issue 4 — Add first reliability tests for collaboration claims

**Live issue:** <https://github.com/NaustudentX18/MotionAI/issues/4>  
**Milestone:** Phase 1  
**Labels:** `type:test`, `area:collaboration`, `phase-1`, `claim:experimental`

### Summary
Add browser-level proof for the Y.js/WebRTC claims before expanding collaboration language.

### Acceptance criteria
- [ ] Add a two-browser Playwright test that edits the same document from two contexts.
- [ ] Use the self-hosted signaling server where available, with clear fallback/skipped behavior.
- [ ] Assert both browsers converge on the same document state.
- [ ] Document any flake risks and required local service commands.

### Verification
```bash
npm run test:e2e
npm run verify
```

## Issue 5 — Write workspace object schema RFC

**Live issue:** <https://github.com/NaustudentX18/MotionAI/issues/5>  
**Milestone:** Phase 1  
**Labels:** `type:rfc`, `area:object-graph`, `phase-1`, `needs-rfc`

### Summary
Define the shared object graph that lets docs, tasks, databases, canvas cards, and AI actions reference the same workspace data.

### Acceptance criteria
- [ ] Define object IDs, schema versions, migrations, attachments, and tombstones.
- [ ] Describe how pages, blocks, tasks, database rows, calendar events, and canvas cards relate.
- [ ] Include import/export compatibility goals.
- [ ] Include performance and migration test requirements.

### Verification
```bash
npm run verify:static
npm run test:migration
```

## Issue 6 — Create public roadmap label set

**Live issue:** <https://github.com/NaustudentX18/MotionAI/issues/6>  
**Labels:** `type:community`, `phase-0`, `claim:implemented`

### Summary
Keep GitHub labels aligned with roadmap phases, work type, area, and claim maturity.

### Acceptance criteria
- [ ] Phase labels exist for Phase 0 through Phase 8.
- [ ] Type labels exist for docs, feature, test, RFC, security, UX, and community work.
- [ ] Claim labels distinguish implemented, experimental, planned, not-claimed, and needs-RFC work.
- [ ] Labels are applied to the initial roadmap issues.

### Verification
```bash
gh label list --limit 200
gh issue list --state open --limit 100 --json number,title,labels
```

## Issue 7 — Create MotionAI roadmap project board

**Live issue:** <https://github.com/NaustudentX18/MotionAI/issues/7>  
**Labels:** `type:community`, `phase-0`, `claim:implemented`

### Summary
Create the GitHub project board used to track roadmap issues.

### Current caveat
A project named **MotionAI Public Roadmap** exists with 35 items and `gh project list --owner NaustudentX18 --format json --limit 50` reports `public: true`. Keep it public and verify fields/issue coverage before closing the issue.

### Acceptance criteria
- [ ] Roadmap project exists and contains the initial roadmap issues.
- [ ] Project visibility matches public documentation claims.
- [ ] Board fields make phase/status/claim maturity easy to scan.

### Verification
```bash
gh project list --owner NaustudentX18 --format json --limit 50
```
