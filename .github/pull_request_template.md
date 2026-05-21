## Summary

- What changed:
- Why it is needed:
- Scope intentionally left out:

## Claim policy

Before merging, keep public claims conservative and evidence-backed:

- Use **Implemented** only when working code is present and this PR lists a repeatable check or direct file evidence.
- Use **Implemented, still hardening** for working features that need more compatibility, security, or release coverage.
- Use **Prototype** for present code or artifacts that are not release-hardened.
- Use **Planned** for roadmap-only work.
- Do not claim production-ready multi-user security, hosted SaaS readiness, signed desktop releases, encrypted collaboration, or public-Internet hardening unless this PR includes the tests/review that prove it.

## Test evidence

Paste exact commands and results. If a check cannot run locally, explain why and list the closest check that did run.

- [ ] `npm run verify`
- [ ] `npm run build`
- [ ] Targeted check(s) for the changed area:
- [ ] Manual/self-hosted smoke proof, if user-facing:

## Security and secrets

- [ ] No provider keys, OAuth tokens, API secrets, private URLs, user data, `.env` contents, or exploit details are included in commits, screenshots, logs, fixtures, or PR text.
- [ ] New logs/errors avoid printing secrets or private document content.
- [ ] Any security-sensitive behavior is documented with current limitations rather than marketing claims.

## Self-hosted release impact

- [ ] Configuration or migration changes are documented for self-hosted operators.
- [ ] Backward compatibility, data migration, and rollback notes are included when relevant.
- [ ] README/ROADMAP/docs claim updates are aligned with `KNOWN_LIMITATIONS.md`, `SECURITY.md`, and `docs/SHIPPED.md` when public capability claims change.
