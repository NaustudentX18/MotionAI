# AI Safety and Provider Guarantees

Phase 4 trust/safety slice for MotionAI's BYO/local AI surface.

This document is intentionally scoped to the behavior visible in `server.ts`,
`src/lib/ai/providers.ts`, and `scripts/ai-contract-tests.ts`. It is not a
claim that every model response is safe, private, or correct.

## What is implemented

### Provider selection is explicit and conservative

MotionAI resolves AI settings from the request body through
`extractAiSettings`, then builds a provider client through `createAiClient`.
The supported provider IDs are:

- `disabled` / no AI
- `gemini`
- `openai-compatible`
- `ollama`
- `lmstudio`
- `vllm`

The disabled path is a first-class provider. When AI is disabled, generation is
not attempted and the provider is reported as enabled `false`.

### BYO and local-provider defaults are supported

The server accepts per-request AI settings such as provider, model, base URL,
API key, timeout, and disabled state. Local OpenAI-compatible providers have
local defaults in `src/lib/ai/providers.ts`:

- Ollama: `http://localhost:11434/v1`
- LM Studio: `http://localhost:1234/v1`
- vLLM: `http://localhost:8000/v1`

For generic OpenAI-compatible providers, a non-local base URL requires an API
key before the provider is considered configured. Local base URLs do not require
a user-supplied key to be considered configured.

### AI endpoints guard unconfigured providers before generation

The server checks `client.info.enabled` and `client.info.configured` before
calling `generateText` on the generate, spellcheck, and chat endpoints. If the
selected provider is disabled or unconfigured, the endpoint returns a `503`
provider-not-configured response instead of attempting a model request.

### AI endpoint responses do not return provider secrets

AI provider metadata uses the response marker `keysReturned: false`, and the
server includes `keysReturned: false` on AI health, provider listing, probe,
generate, spellcheck, and chat responses. The credential-free AI contract tests
also assert that `getConfiguredProviders()` returns provider records with
`keysReturned: false`.

This is a response-shape guarantee: these endpoints are designed not to echo API
keys or provider secrets back in JSON responses. It is not a guarantee about
browser extensions, reverse proxies, server logs outside this codebase, or the
privacy behavior of the selected upstream model/provider.

### Provider error messages are redacted before response

`safeErrorMessage` redacts known environment secrets, per-request provider keys,
and inline key-like patterns such as authorization, bearer, token, and API-key
fields. The AI endpoints use `safeErrorMessage` for provider failure responses,
and `scripts/ai-contract-tests.ts` includes redaction tests for explicit fake
keys and bearer-style inline secrets.

### AI POST endpoints are rate-limited and can require an app secret

The AI POST routes use `rateLimitMiddleware`. They also pass through
`requireAuth`, which enforces the `x-motionai-secret` header when
`MOTIONAI_API_SECRET` is configured. If `MOTIONAI_API_SECRET` is not configured,
`requireAuth` intentionally allows local/open access.

## What is not claimed

- No claim that generated content is factually correct, policy-safe, or suitable
  for unattended execution.
- No claim that prompts or document context remain local if a remote provider is
  selected.
- No claim that `keysReturned: false` proves secrets can never appear in logs,
  infrastructure, browser tooling, or provider-side telemetry.
- No claim of production multi-user isolation or enterprise data-loss prevention.
- No claim that local model endpoints are sandboxed; local providers still run
  with whatever permissions their host process has.

## Operator guidance

- Use `provider: "disabled"` or `disabled: true` when AI should be unavailable.
- Prefer Ollama, LM Studio, or vLLM with loopback base URLs for local-only model
  traffic.
- Set `MOTIONAI_API_SECRET` when exposing the server beyond a trusted local
  machine.
- Treat `apiKey` as request-scoped sensitive input. Do not paste real secrets
  into issues, logs, screenshots, or docs.
- Run `npm run test:ai` after changing AI provider behavior and
  `npm run verify:static` after changing public trust/safety claims.

## Verification anchors

- `server.ts` — AI endpoint response shapes, provider guards, rate limiting, and
  optional `MOTIONAI_API_SECRET` authentication.
- `src/lib/ai/providers.ts` — provider IDs, provider defaults, configured-state
  logic, `keysReturned: false` metadata, timeout handling, and error redaction.
- `scripts/ai-contract-tests.ts` — credential-free provider contract tests,
  disabled-provider behavior, `keysReturned: false` checks, and redaction checks.
- `scripts/static-verify.mjs` — static guard that this document exists and that
  source-level secret non-return claims remain represented in code/tests.
