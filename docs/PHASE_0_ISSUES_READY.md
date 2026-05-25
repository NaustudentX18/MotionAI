# Phase 0 GitHub Issues — Opened / Reconciliation Copy

These drafts were originally prepared for copying into GitHub. They are now represented by live issues on `NaustudentX18/MotionAI`; use this file as a compact operator checklist, not as a queue of unopened issues.

For the current live snapshot, see [`docs/GITHUB_ROADMAP_STATUS.md`](GITHUB_ROADMAP_STATUS.md).

## Opened issue map

| Draft | Live issue | Milestone | Current reconciliation |
| --- | --- | --- | --- |
| Reconcile public docs capability drift | [#1](https://github.com/NaustudentX18/MotionAI/issues/1) | Phase 0 | This docs pass updates the roadmap/shipped docs; verify before closing. |
| Decide public product naming direction | [#2](https://github.com/NaustudentX18/MotionAI/issues/2) | Phase 0 | MotionAI is current brand; RFC may remain open for public-launch decision. |
| Finish community health files and templates | [#3](https://github.com/NaustudentX18/MotionAI/issues/3) | Phase 0 | Files/templates exist locally; verify on target branch. |
| Add first reliability tests for collaboration claims | [#4](https://github.com/NaustudentX18/MotionAI/issues/4) | Phase 1 | `e2e/webrtc-sync.spec.ts` exists; collaboration remains experimental. |
| Write workspace object schema RFC | [#5](https://github.com/NaustudentX18/MotionAI/issues/5) | Phase 1 | Schema docs/tests exist; verify before closing. |
| Create public roadmap label set | [#6](https://github.com/NaustudentX18/MotionAI/issues/6) | Phase 0 | Labels are in use; issue still open. |
| Create MotionAI public roadmap board | [#7](https://github.com/NaustudentX18/MotionAI/issues/7) | Phase 0 | Project exists and is public according to `gh project list`; verify fields/issue coverage before closing. |

---

## Issue 1 — Reconcile public docs capability drift

**Labels:** `type:docs`, `area:trust`, `phase-0`, `claim:not-claimed`

### Summary
Keep `README.md`, `ROADMAP.md`, `docs/SHIPPED.md`, and `KNOWN_LIMITATIONS.md` aligned so public claims match tested capabilities.

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

---

## Issue 2 — Decide public product naming direction

**Labels:** `type:rfc`, `area:trust`, `phase-0`, `needs-rfc`

### Summary
Choose whether to keep MotionAI or adopt a fresh unique name before broader launch.

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

---

## Issue 3 — Finish community health files and templates

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

---

## Issue 4 — Add first reliability tests for collaboration claims

**Labels:** `type:test`, `area:collaboration`, `phase-1`, `claim:experimental`

### Summary
Add browser-level proof for Y.js/WebRTC claims before expanding collaboration language.

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

---

## Issue 5 — Write workspace object schema RFC

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
