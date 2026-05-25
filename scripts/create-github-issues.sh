#!/bin/bash
# Run this when network to GitHub is available to create Phase 0 issues.
# Requires: gh CLI authenticated (token already saved to ~/.config/gh/hosts.yml)
set -euo pipefail

REPO="NaustudentX18/MotionAI"

echo "Creating Phase 0 issues..."

# Issue 1 — Reconcile public docs capability drift
gh issue create \
  --repo "$REPO" \
  --title "Reconcile public docs capability drift" \
  --label "docs,phase-0,trust" \
  --body '## Summary
Keep `README.md`, `ROADMAP.md`, `docs/SHIPPED.md`, and `KNOWN_LIMITATIONS.md` aligned so public claims match tested capabilities.

## Background
The project positions itself as a self-hostable local-first workspace with BYO/local AI, Y.js collaboration foundations, canvas templates, and Tauri prototype. Mismatches between shipped docs and limitations docs erode trust.

## Acceptance criteria
- Every implemented/experimental/prototype/planned claim has file or test evidence.
- Y.js, WebRTC sync, E2EE, canvas, Tauri, and production-security claims use the same status language across docs.
- `npm run verify:static` fails if the required trust docs disappear.
- README links to roadmap, limitations, security policy, and contribution docs.

## Verification
```bash
npm run verify:static
npm run lint
```'

echo "  ✓ Issue 1 created"

# Issue 2 — Decide public product naming direction
gh issue create \
  --repo "$REPO" \
  --title "Decide public product naming direction" \
  --label "product,phase-0,rfc" \
  --body '## Summary
Choose whether to keep "MotionAI" or adopt a fresh unique name before broader launch.

## Background
The repo is `MotionAI`, the app label is `MotionAI Document Space`, and the roadmap aims beyond a Notion clone into docs + tasks + BYO/local AI. A unique name may reduce trademark/confusion risk.

## Acceptance criteria
- Open a short RFC with name options, risks, migration cost, and recommendation.
- Avoid any wording that implies affiliation with Notion or ClickUp.
- Update README/package metadata/app copy consistently after a decision.
- Preserve redirects/aliases or migration notes for existing repo users.

## Verification
```bash
rg -n "MotionAI|MotionAI|Notion|ClickUp" README.md ROADMAP.md docs package.json src
npm run verify:static
```'

echo "  ✓ Issue 2 created"

# Issue 3 — Finish community health files and templates
gh issue create \
  --repo "$REPO" \
  --title "Finish community health files and templates" \
  --label "community,phase-0,good first issue" \
  --body '## Summary
Make the project welcoming and safe for external contributors by keeping contributor, security, conduct, and issue-template files current.

## Acceptance criteria
- `CONTRIBUTING.md` explains setup, tests, claim policy, and PR expectations.
- `SECURITY.md` explains supported surface, reporting path, and no-production-security claim.
- `CODE_OF_CONDUCT.md` sets concise participation expectations.
- `.github/ISSUE_TEMPLATE/` includes bug, feature, docs drift, and security-safe guidance.
- Templates steer reporters away from posting secrets.

## Verification
```bash
find .github/ISSUE_TEMPLATE -maxdepth 1 -type f -print | sort
npm run verify:static
```'

echo "  ✓ Issue 3 created"

# Issue 4 — Add first reliability tests for collaboration claims
gh issue create \
  --repo "$REPO" \
  --title "Add first reliability tests for collaboration claims" \
  --label "tests,collaboration,phase-1" \
  --body '## Summary
Add browser-level proof for Y.js/WebRTC claims before expanding collaboration language.

## Acceptance criteria
- Add a two-browser Playwright test that edits the same document from two contexts.
- Use the self-hosted signaling server where available, with clear fallback/skipped behavior.
- Assert both browsers converge on the same document state.
- Document any flake risks and required local service commands.

## Verification
```bash
npm run test:e2e
npm run verify
```'

echo "  ✓ Issue 4 created"

# Issue 5 — Write workspace object schema RFC
gh issue create \
  --repo "$REPO" \
  --title "Write workspace object schema RFC" \
  --label "architecture,rfc,phase-1" \
  --body '## Summary
Define the shared object graph that lets docs, tasks, databases, canvas cards, and AI actions reference the same workspace data.

## Acceptance criteria
- Define object IDs, schema versions, migrations, attachments, and tombstones.
- Describe how pages, blocks, tasks, database rows, calendar events, and canvas cards relate.
- Include import/export compatibility goals.
- Include performance and migration test requirements.

## Verification
```bash
npm run verify:static
npm run test:migration
```'

echo "  ✓ Issue 5 created"

echo ""
echo "All 5 Phase 0 issues created successfully."
echo "Next: add good-first-issue labels and create project board at https://github.com/$REPO"
