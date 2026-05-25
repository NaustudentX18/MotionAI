# Webhook & API Reference

MotionAI exposes a local API for automation webhooks and n8n-style recipe integrations.

## Base URL

```
http://localhost:3003
```

## Authentication

All webhook endpoints require the `x-motionai-secret` header matching `MOTIONAI_API_SECRET` env var on the server.

```bash
curl -H "x-motionai-secret: your-secret" http://localhost:3003/api/webhooks/...
```

For idempotent deliveries, send a stable `x-motionai-delivery` value. MotionAI rejects duplicate
delivery ids for the same webhook path for five minutes with `409`, which protects local
automation rules from simple replay storms.

## Endpoints

### Webhook Triggers

Trigger automations from external services by calling webhook endpoints.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/webhooks/:path` | Fire a webhook-triggered automation rule |
| `POST` | `/api/ai/generate` | AI text generation (requires provider config) |
| `POST` | `/api/ai/spellcheck` | AI-powered spellcheck and grammar suggestions |
| `POST` | `/api/ai/probe` | Test AI provider connectivity |
| `POST` | `/api/ai/chat` | Workspace copilot chat with RAG context |
| `GET`  | `/api/ai/status` | Current AI provider status |
| `GET`  | `/api/ai/providers` | List configured providers (no secrets) |
| `GET`  | `/api/health` | Server health check |

### Automation Webhook Payload

```json
POST /api/webhooks/github-pr
Content-Type: application/json
x-motionai-secret: your-secret
x-motionai-delivery: github-pr-123

{
  "event": "pull_request.opened",
  "repository": "owner/repo",
  "title": "Add new feature",
  "url": "https://github.com/owner/repo/pull/1",
  "author": "username"
}
```

The webhook path (`github-pr` in this example) must match a rule's webhook trigger config.

## Recipe Examples

### n8n-style: GitHub PR → Create Task

```yaml
# .motionai/recipes/github-to-task.yaml
name: GitHub PR to MotionAI Task
trigger: webhook
config:
  path: github-pr

conditions:
  - field: event
    operator: equals
    value: pull_request.opened

actions:
  - type: create-task
    config:
      title: "Review PR: {{title}}"
      priority: Normal
      assignee: "{{author}}"
  - type: append-block
    config:
      content: "PR: {{url}}"
```

### n8n-style: Due Date → Slack Reminder

```yaml
# .motionai/recipes/due-date-slack.yaml
name: Due Date Slack Reminder
trigger: due-date
config:
  daysBefore: 1

conditions:
  - field: status
    operator: not-equals
    value: Done

actions:
  - type: send-webhook
    config:
      url: "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
      body: |
        {
          "text": "⏰ Task \"{{task}}\" is due tomorrow!"
        }
```

### n8n-style: New Page → AI Summarize

```yaml
# .motionai/recipes/auto-summarize.yaml
name: Auto-summarize New Pages
trigger: new-page

actions:
  - type: ai-summarize
    config:
      maxLength: 3
```

## Local Dev Setup

```bash
# Set webhook secret
export MOTIONAI_API_SECRET="your-dev-secret"

# Start server
PORT=3003 npm start

# Test webhook
curl -X POST http://localhost:3003/api/webhooks/test \
  -H "Content-Type: application/json" \
  -H "x-motionai-secret: your-dev-secret" \
  -d '{"event":"test"}'
```

## Security Notes

- All API responses include `keysReturned: false` — API keys are never serialized in responses
- Error messages are sanitized to never include provider API keys
- Workspace exports strip credential-like fields automatically
- Webhook secrets are checked with a timing-safe digest comparison
- Optional `x-motionai-delivery` replay ids are cached briefly and duplicate deliveries are rejected
