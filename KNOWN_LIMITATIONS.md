# Known Limitations

This file records the audit caveats that matter for safe local development and deployment. It is deliberately conservative: if a capability is not backed by code and a repeatable check, treat it as a limitation or roadmap item.

## Credential-free local verification

Use this path when no Gemini key, Firebase login, or Google OAuth token is available:

```bash
npm run verify:static   # source invariants + documentation checks (8 checks)
npm run lint            # TypeScript type-check
npm run test:ai         # AI provider contract tests (16+ tests)
npm run build           # Vite client + esbuild server
```

The static verification path does not contact Gemini, Firebase, Google Calendar, Google Tasks, or Google Drive. It only validates local source and documentation invariants that should hold in every environment.

## Current implementation limits

- **AI requires an API key.** The multi-provider abstraction (`providers.ts`) supports Gemini, OpenAI-compatible, Ollama, LM Studio, and vLLM. All AI endpoints return a `503` "not configured" error when the chosen provider is not available. This is safe for local smoke checks, but it means generation, spellcheck, and chat are not end-to-end verified without a credentialed environment.
- **Rate limiting is in-memory and per-process.** The `rateLimit.ts` middleware uses a local `Map` with a sliding window. Rate-limit state does not survive server restarts and is not shared across processes. This is appropriate for a single-user homelab deployment but not for multi-user or load-balanced setups.
- **Google Workspace actions require interactive auth.** Calendar, Tasks, and Drive helpers depend on a Firebase Google sign-in access token. The credential-free checks verify token guards, not real Google API success.
- **Firebase configuration is app configuration, not proof of backend readiness.** The repository contains `firebase-applet-config.json`, but Firestore rules, OAuth consent, allowed domains, and production project settings must be verified outside this local static check.
- **Persistence is hybrid IndexedDB + localStorage fallback.** The `persistence.ts` module writes to IndexedDB with a compact localStorage fallback copy. CRDT sync, E2EE/BYOK, and robust multi-device replication should be treated as roadmap until implemented and tested.
- **Collaboration UI is partly simulated.** Peer presence and mock edits are useful for product demos but are not proof of a real multi-user sync layer.
- **Vector search is opportunistic.** The client initializes a WASM vector index (voy-search) in the background. There is no coverage yet for model download availability, memory pressure, or search quality.
- **No browser e2e dependency is installed.** The current smoke path is static TypeScript/build verification plus AI contract tests. Add Playwright or an equivalent only when the team explicitly accepts the dependency and CI/runtime cost.
- **Security hardening is baseline.** Rate limits and 1 MB request-size limits are in place on AI endpoints, but there are no CSRF protections, authentication gates around local Express AI endpoints beyond the missing-key guard, or HTTPS termination.

## Deployment caveats

- Do not commit `.env` or real API keys.
- Keep `GEMINI_API_KEY` and other provider keys server-side only.
- Validate Firebase and Google OAuth settings in the target project before inviting users.
- Treat Docker/home-lab exposure as a separate security review, especially if binding beyond a private LAN or tailnet.

## Audit follow-ups

- Add response-shape validation tests for spellcheck JSON output.
- Add Playwright browser smoke test for first render, default page creation, and offline persistence.
- Add documentation status labels that distinguish implemented features from aspirational roadmap items.
- Add authentication gate for Express AI endpoints when exposed beyond trusted network.
- Add rate-limit store that survives server restarts (e.g., file-backed or SQLite).
