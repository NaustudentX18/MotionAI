# Security Policy

MotionAI is currently intended for private, self-hosted, local-first use. It is not yet claiming production-grade multi-user security.

## Supported surface

Security review currently covers the public `main` branch and credential-free local checks in this repository. Prototype areas such as WebRTC collaboration, encrypted multi-peer workflows, desktop packaging, and public Internet exposure are still hardening.

## Reporting a vulnerability

Please do not open public issues that include secrets, exploit details, private URLs, provider keys, OAuth tokens, or user data.

Preferred private report path:

1. Open a GitHub security advisory for `NaustudentX18/MotionAI` if available.
2. If advisories are unavailable, open a minimal public issue that says a private security report is needed, without sensitive details.

Include:

- affected commit or release,
- reproduction steps without real secrets,
- expected impact,
- whether the issue requires local access, authenticated access, or network exposure.

## Current boundaries

- Provider credentials must never be committed.
- Browser/server settings should never return raw provider keys in normal API responses.
- The in-memory editor state is plaintext after unlock so editing can work.
- Encryption-at-rest is not a complete encrypted multi-peer collaboration protocol.
- Public Internet exposure needs a separate review for HTTPS, auth, CSRF, request limits, logging, and secret handling.
