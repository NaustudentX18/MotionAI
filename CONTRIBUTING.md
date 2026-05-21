# Contributing to MotionAI

Thanks for helping build a free, open-source, self-hostable workspace for local-first docs, ClickUp-style execution, and BYO/local AI.

## Local setup

```bash
git clone git@github.com:NaustudentX18/OpenNotion.git
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
