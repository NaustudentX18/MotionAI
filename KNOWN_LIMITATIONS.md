# Known Limitations

This document is intentionally conservative. If a capability is not backed by code and a repeatable check, treat it as experimental or planned rather than production-ready.

## Credential-free local verification

These checks do not require Gemini, OpenAI, Ollama, Firebase login, Google OAuth, or a Tailscale peer:

```bash
npm run verify:static
npm run lint
npm run test:ai
npm run test:spellcheck
npm run test:workspace
npm run test:import-export
npm run test:smoke
npm run test:migration
npm run build
```

The full bundled gate is:

```bash
npm run verify
```

## Current implementation limits

- **AI requires user/provider configuration.** The multi-provider abstraction supports Gemini, OpenAI-compatible providers, Ollama, LM Studio, vLLM, and disabled mode. Without a configured provider, AI endpoints should fail safely instead of pretending generation worked.
- **Provider keys are local/user-supplied.** Real provider credentials belong in `.env` or browser-local settings, not in Git. `.env.example` contains placeholders only.
- **Rate limiting is single-node.** `src/lib/rateLimit.ts` supports in-memory and file-backed state. It is suitable for a private single-node homelab service, not a distributed public API tier.
- **Google Workspace requires interactive auth.** Drive, Calendar, and Tasks helpers are token-gated. Credential-free tests verify guard behavior, not real Google API success.
- **Firebase config is not backend readiness.** The checked-in Firebase app config is not a secret, but Firestore rules, OAuth consent, allowed domains, and production project settings must be verified in Firebase/Google Cloud before inviting users.
- **Y.js collaboration is still hardening.** Y.Doc persistence, y-indexeddb, y-webrtc wiring, and peer presence exist. Production-grade concurrent editing still needs deeper browser E2E coverage and multi-peer conflict testing.
- **E2EE is encryption-at-rest, not a complete secure multi-peer protocol.** The editor works on plaintext in memory after unlock. Multi-peer key exchange and encrypted collaboration semantics are not production-complete.
- **Backlinks are local index data.** `[[Wiki Links]]` parsing and an IndexedDB index exist; graph visualization is not implemented.
- **Canvas pages are an early prototype.** A canvas page type is present, but this is not yet a full tldraw/Fabric-style infinite whiteboard product.
- **Tauri is a prototype.** The `src-tauri/` project is present for ARM64 Linux builds, but release signing, auto-update, and cross-platform QA are not complete.
- **Browser E2E exists but is not exhaustive.** Playwright scaffolding and smoke checks exist. Coverage should expand around persistence, settings, E2EE unlock, collaboration, and import/export.
- **Public exposure needs a separate security review.** Before binding outside a trusted LAN/tailnet, review HTTPS termination, CSRF, auth, request limits, logging, and secret handling.

## Deployment caveats

- Do not commit `.env`, real API keys, runtime data, build outputs, node modules, `.omc/`, or Tauri target artifacts.
- Set `MOTIONAI_API_SECRET` before exposing Express AI endpoints beyond localhost/private trusted network.
- Keep `VITE_SIGNALING_URLS` aligned with the signaling service users can actually reach. The local Pi service runs on port `3005`.
- Rebuild the Vite bundle after changing `VITE_*` values; Vite embeds those at build time.

## Audit follow-ups

- Add browser E2E coverage for first render, editor typing persistence, settings provider flow, E2EE lock/unlock, and backlinks display.
- Add a two-browser Y.js convergence test against the local signaling server.
- Add a credentialed deployment checklist for Firebase, Google OAuth, and provider-specific AI probes.
- Decide whether the GitHub-facing name should remain MotionAI while the UI brand remains MotionAI, or unify the product name.

## Browser compatibility

MotionAI is tested and supported on the following browser versions:

| Browser | Minimum version | Notes |
|---------|----------------|-------|
| Chrome / Edge | 90+ | Best performance and WebRTC support |
| Firefox | 100+ | Full feature support |
| Safari (desktop + iOS) | 16+ | PWA standalone mode supported on iOS 16.4+ |
| Samsung Internet | 20+ | Basic feature support |

Unsupported browsers: Internet Explorer, legacy Edge (EdgeHTML), Opera Mini.

- WebRTC collaboration requires a browser with WebRTC support (all listed browsers).
- Push notifications require HTTPS (or localhost) and browser permission grant.
- IndexedDB persistence is used for workspace storage and is available in all listed browsers.

## WebRTC / signaling

- WebRTC collaboration requires a running signaling server (default: `ws://localhost:3005`).
- When the signaling server is unreachable, the workspace degrades to single-user mode. All local edits and persistence continue to work normally; real-time sync is simply unavailable.
- Configure signaling server URLs via the `VITE_SIGNALING_URLS` or `VITE_SIGNALING_URL` environment variable. Multiple URLs can be comma-separated — y-webrtc tries them in order and fails over automatically.
- ICE/STUN server configuration is available in Settings > Collaboration. Google's free STUN servers are pre-configured.
- Direct peer connections (WebRTC) may fail on restrictive networks. A TURN server is required for NAT traversal in such environments.
