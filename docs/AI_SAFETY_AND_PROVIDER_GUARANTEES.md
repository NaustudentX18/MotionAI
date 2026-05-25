# AI Safety and Provider Guarantees

Phase 4 trust/safety slice for MotionAI's BYO/local AI surface.

This document is intentionally scoped to the behavior visible in `server.ts`,
`src/lib/ai/providers.ts`, `src/lib/settings.ts`,
`src/components/SettingsModal.tsx`, and `scripts/ai-contract-tests.ts`. It is
not a claim that every model response is safe, private, correct, or suitable for
autonomous action.

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
- `custom-endpoint`

The disabled path is a first-class provider. When AI is disabled, generation is
not attempted and the provider is reported as enabled `false`.

### Settings UX separates hosted, local, custom, and disabled modes

The Settings modal now distinguishes:

- Gemini: API key plus model; no user-entered base URL is sent.
- OpenAI-compatible hosted APIs: base URL, model, and API key for remote
  endpoints.
- Ollama, LM Studio, and vLLM: loopback-friendly local defaults with optional
  API keys.
- Custom endpoint: explicit OpenAI-compatible base URL and model for proxies or
  providers not covered by the built-in presets.
- Disabled: no provider fields, no test call, and no AI provider request.

Provider cards show whether the selected provider is active, configured, or
still needs setup. Selecting a provider updates the active provider directly;
it does not merely toggle an unused flag.

### BYO and local-provider defaults are supported

The server accepts per-request AI settings such as provider, model, base URL,
API key, timeout, and disabled state. Local OpenAI-compatible providers have
local defaults in `src/lib/ai/providers.ts`:

- Ollama: `http://localhost:11434/v1`
- LM Studio: `http://localhost:1234/v1`
- vLLM: `http://localhost:8000/v1`

For generic OpenAI-compatible hosted providers, a non-local base URL requires an
API key before the provider is considered configured. Local base URLs do not
require a user-supplied key to be considered configured. Custom endpoints require
an explicit base URL and model; a key is optional because some self-hosted or
proxied endpoints use network-level authentication instead.

### AI endpoints guard disabled and unconfigured providers before generation

The server checks `client.info.enabled` and `client.info.configured` before
calling `generateText` on the generate, spellcheck, and chat endpoints. If the
selected provider is disabled or unconfigured, the endpoint returns a `503`
response with `providerUnavailableMessage(client.info)` instead of attempting a
model request.

Disabled, unconfigured, and custom-endpoint errors are intentionally actionable
but non-secret. They describe missing categories such as base URL, model name,
or API key; they do not echo provided credential values.

### AI endpoint responses do not return provider secrets

AI provider metadata uses the response marker `keysReturned: false`, and the
server includes `keysReturned: false` on AI health, provider listing, probe,
generate, spellcheck, and chat responses. The credential-free AI contract tests
also assert that provider records contain `keysReturned: false` and do not expose
an `apiKey` field.

This is a response-shape guarantee: these endpoints are designed not to echo API
keys or provider secrets back in JSON responses. It is not a guarantee about
browser extensions, reverse proxies, server logs outside this codebase, or the
privacy behavior of the selected upstream model/provider.

### Provider error messages are redacted before response

`safeErrorMessage` redacts known environment secrets, custom endpoint secrets,
per-request provider keys, and inline key-like patterns such as authorization,
bearer, token, and API-key fields. The AI endpoints use `safeErrorMessage` for
provider failure responses, and `scripts/ai-contract-tests.ts` includes
redaction tests for explicit fake keys, custom endpoint keys, and bearer-style
inline secrets.

### AI POST endpoints are rate-limited and can require an app secret

The AI POST routes use `rateLimitMiddleware`. They also pass through
`requireAuth`, which enforces the `x-motionai-secret` header when
`MOTIONAI_API_SECRET` is configured. If `MOTIONAI_API_SECRET` is not configured,
`requireAuth` intentionally allows local/open access.

## Safe agent mode design boundary

MotionAI does not currently implement an autonomous agent that can mutate files,
call tools, operate the browser, or run shell commands. If an agent mode is added,
the safety boundary should be:

1. **Read-only by default** — default capabilities may inspect the current
   document/context and draft suggestions only. They must not write, delete,
   send, execute, or call external systems.
2. **Explicit permission prompts for side effects** — every side-effect class
   needs a user-visible prompt that states the target, action, data leaving the
   workspace, and rollback expectations before the action runs.
3. **Audit log** — record timestamp, provider ID, model, action class,
   permission decision, target resource, and success/failure. Never record API
   keys, authorization headers, raw provider tokens, or full prompts containing
   secrets.
4. **Prompt-injection warnings at boundaries** — warn when untrusted document or
   web content asks the agent to ignore instructions, reveal secrets, use hidden
   tools, or perform side effects. Warnings should be boundary-specific rather
   than generic noise.
5. **Provider transparency** — show when content will leave the device because a
   remote provider is selected. Local loopback endpoints are preferred for
   private/offline workflows but are not a sandbox by themselves.

Until those boundaries exist in code, agentic behavior must remain a documented
design constraint rather than a shipped capability claim.

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
- No claim that safe agent mode is implemented; it is only a boundary design
  until explicit permission prompts and audit logging exist in code.

## Operator guidance

- Use `provider: "disabled"` or `disabled: true` when AI should be unavailable.
- Prefer Ollama, LM Studio, or vLLM with loopback base URLs for local-only model
  traffic.
- Use `custom-endpoint` only for OpenAI-compatible APIs, and verify the endpoint
  owner before sending document context.
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
  logic, `keysReturned: false` metadata, timeout handling, provider unavailable
  messages, and error redaction.
- `src/lib/settings.ts` — provider defaults, labels, and local-mode detection.
- `src/components/SettingsModal.tsx` — provider-specific setup UX, disabled
  mode, custom endpoint copy, and test-connection request shape.
- `scripts/ai-contract-tests.ts` — credential-free provider contract tests,
  disabled-provider behavior, custom endpoint behavior, `keysReturned: false`
  checks, and redaction checks.
- `scripts/static-verify.mjs` — static guard that this document exists and that
  source-level secret non-return claims remain represented in code/tests.
