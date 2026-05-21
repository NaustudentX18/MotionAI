# Phase 0 GitHub-Ready Issues

These issues are ready to copy into GitHub. Phase 0 is about trust, positioning, and contribution readiness before expanding the product surface.

## Issue 1 — Reconcile public docs capability drift

**Labels:** `docs`, `phase-0`, `trust`

### Summary
Keep `README.md`, `ROADMAP.md`, `docs/SHIPPED.md`, and `KNOWN_LIMITATIONS.md` aligned so public claims match tested capabilities.

### Background
The project is positioning itself as a self-hostable local-first workspace with BYO/local AI, Y.js collaboration foundations, canvas starter, and Tauri prototype. Any mismatch between shipped docs and limitations docs erodes trust.

### Acceptance criteria
- [ ] Every implemented/experimental/prototype/planned claim has file or test evidence.
- [ ] Y.js, WebRTC sync, E2EE, canvas, Tauri, and production-security claims use the same status language across docs.
- [ ] `npm run verify:static` fails if the required trust docs disappear.
- [ ] README links to roadmap, limitations, security policy, and contribution docs.

### Verification
```bash
npm run verify:static
npm run lint
```

## Issue 2 — Decide public product naming direction

**Labels:** `product`, `phase-0`, `rfc`

### Summary
Choose whether to keep MotionAI, keep MotionAI, or adopt a fresh unique name before broader launch.

### Background
The repo is `MotionAI`, the app label is `MotionAI Document Space`, and the roadmap aims beyond a Notion clone into docs + tasks + BYO/local AI. A unique name may reduce trademark/confusion risk and better fit the ClickUp-style execution direction.

### Acceptance criteria
- [ ] Open a short RFC with name options, risks, migration cost, and recommendation.
- [ ] Avoid any wording that implies affiliation with Notion or ClickUp.
- [ ] Update README/package metadata/app copy consistently after a decision.
- [ ] Preserve redirects/aliases or migration notes for existing repo users.

### Verification
```bash
rg -n "MotionAI|MotionAI|Notion|ClickUp" README.md ROADMAP.md docs package.json src
npm run verify:static
```

## Issue 3 — Finish community health files and templates

**Labels:** `community`, `phase-0`, `good first issue`

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

**Labels:** `tests`, `collaboration`, `phase-1`

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

**Labels:** `architecture`, `rfc`, `phase-1`

### Summary
Define the shared object graph that will let docs, tasks, databases, canvas cards, and AI actions reference the same workspace data.

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
