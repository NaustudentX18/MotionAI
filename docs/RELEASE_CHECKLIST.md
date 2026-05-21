# Release Checklist

MotionAI releases are for a free, open-source, self-hostable workspace. Treat release notes as an operator handoff, not marketing copy: every shipped claim must point to code, docs, test output, or a known limitation.

## 1. Freeze the release scope

- [ ] Confirm the release commit, branch, tag name, and target audience.
- [ ] List user-visible changes, migrations, configuration changes, and known limitations.
- [ ] Keep scope labels conservative:
  - **Implemented** requires working code plus repeatable test evidence or direct file evidence.
  - **Implemented, still hardening** means working but not fully release/security/compatibility hardened.
  - **Prototype** means present but not release-hardened.
  - **Planned** means roadmap-only.
- [ ] Do not claim production-ready multi-user security, hosted SaaS readiness, encrypted collaboration, signed desktop releases, or public-Internet hardening without dedicated tests and security review.

## 2. Protect secrets and private data

- [ ] Verify no provider keys, OAuth tokens, API secrets, private URLs, user data, `.env` contents, or exploit details appear in commits, fixtures, logs, screenshots, release notes, or issue/PR text.
- [ ] Use placeholder values for examples, for example `your-secret-here`.
- [ ] If a vulnerability is involved, keep exploit details and sensitive reproduction data out of public release artifacts.

## 3. Run credential-free verification

Record exact command output in the release PR or release notes.

```bash
npm run verify
npm run build
```

`npm run verify` currently covers static checks, TypeScript, AI contract tests, spellcheck schema tests, workspace mock tests, browser smoke tests, and migration tests. Add targeted checks when the release changes a specific path, for example:

```bash
npm run test:e2e
npm run test:import-export
```

If any check cannot run on the release machine, document the blocker and the closest completed check.

## 4. Self-hosted operator checks

- [ ] Start from a clean checkout or clean worktree where possible.
- [ ] Install dependencies with `npm install`.
- [ ] Build with `npm run build`.
- [ ] Smoke the production server with `npm run start` after building, or document why a live smoke was not possible.
- [ ] Confirm required environment variables and optional provider settings are documented without real secrets.
- [ ] Confirm migrations and local-first data behavior are covered by test evidence and rollback notes where relevant.
- [ ] For public-Internet exposure, perform a separate HTTPS, auth, CSRF, request-limit, logging, and secret-handling review before recommending deployment.

## 5. Documentation and release notes

- [ ] Align README, ROADMAP, `docs/SHIPPED.md`, `KNOWN_LIMITATIONS.md`, and `SECURITY.md` when public capability claims change.
- [ ] Link release notes to the verification commands and any targeted/manual checks.
- [ ] Call out known limitations clearly, especially collaboration, encryption, desktop packaging, public hosting, and multi-user security boundaries.
- [ ] Include upgrade, migration, rollback, and configuration notes for self-hosted operators.

## 6. Tag and publish

- [ ] Confirm the worktree only contains intentional release changes.
- [ ] Create an annotated tag for the release commit.
- [ ] Publish release notes with test evidence, known limitations, and self-hosted upgrade notes.
- [ ] After publishing, verify the tag/release page and any linked artifacts resolve correctly.
- [ ] Open follow-up issues for deferred hardening work instead of hiding gaps in release language.
