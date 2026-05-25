# Contributing to MotionAI

Thanks for helping build a free, open-source, self-hostable workspace for local-first docs, ClickUp-style execution, and BYO/local AI.

## Local setup

```bash
git clone git@github.com:NaustudentX18/MotionAI.git
cd OpenNotion
npm install
cp .env.example .env
npm run dev
```

Do not put real provider keys in commits, screenshots, issue bodies, or test fixtures.

## Verification before a pull request

Run the credential-free gate whenever possible:

```bash
npm run verify
npm run build
```

For docs-only changes, run at least:

```bash
npm run verify:static
```

Add targeted tests when changing behavior. If a check cannot run locally, explain why in the PR and list the closest check you did run.

## Claim policy

Public docs must stay honest:

- **Implemented** means working code plus repeatable test or direct file evidence.
- **Experimental** means wired but not yet proven across real-world/multi-user/credentialed cases.
- **Prototype** means present but not release-hardened.
- **Planned** means roadmap-only.

Do not call collaboration, encryption, desktop packaging, public hosting, or multi-user security production-ready unless tests and review back the claim.

## Pull request expectations

- Keep diffs small and reversible.
- Prefer existing utilities and patterns before adding abstractions.
- Do not add dependencies without a clear reason.
- Update `README.md`, `ROADMAP.md`, `docs/SHIPPED.md`, and `KNOWN_LIMITATIONS.md` together when changing public capability claims.
- Include test evidence in the PR description.

## Development notes

- Provider keys belong in `.env` or browser-local settings only.
- The Express AI API should not be exposed outside a trusted private network without an auth/security review.
- Local build artifacts such as `dist/`, `node_modules/`, `.omc/`, `data/`, and Tauri targets should stay uncommitted.

## Verification gates

Before opening a PR, run the full credential-free verification suite:

```bash
npm run verify
```

This runs: static checks, TypeScript lint, AI contract tests, spellcheck schema
tests, workspace helper tests, import/export round-trip tests, smoke tests,
migration tests, reliability tests, torture tests, and the builder.

Individual gates for faster iteration:

| Check | Command | When to run |
|-------|---------|-------------|
| Static/docs invariants | `npm run verify:static` | After doc/claim changes |
| TypeScript | `npm run lint` | After any code change |
| Build | `npm run build` | Before pushing |
| AI contracts | `npm run test:ai` | After AI provider changes |
| Import/export | `npm run test:import-export` | After persistence changes |
| Migrations | `npm run test:migration` | After schema changes |
| Automation triggers | `npx tsx scripts/automation-trigger-tests.ts` | After rule engine changes |
| Meeting parser | `npx tsx scripts/meeting-parser-contract-tests.ts` | After AI pipeline changes |
| Schema invariants | `npx tsx scripts/schema-invariant-tests.ts` | After version bumps |
| E2E | `npm run test:e2e` | Before major releases |

## Working with branches

- Feature branches are named `roadmap/<lane>-<short-description>` (e.g. `roadmap/l8-inactivity-lock`).
- Keep changes focused on one lane per branch.
- Run `npm run verify` before every merge.
- All merges go through PRs to `main`.

## Commit conventions

We use the **Lore commit protocol** for decision-tracking:

```
<intent line: why the change was made>

<optional body: constraints and approach rationale>

Constraint: <external constraint>
Rejected: <alternative> | <reason>
Confidence: <low|medium|high>
Scope-risk: <narrow|moderate|broad>
Directive: <forward-looking warning>
Tested: <what was verified>
Not-tested: <known gaps>
```

## Good first issues

Browse the [issue tracker](https://github.com/NaustudentX18/MotionAI/issues) for
issues labelled `good first issue`. These are scoped, documented, and have
mentor notes.
