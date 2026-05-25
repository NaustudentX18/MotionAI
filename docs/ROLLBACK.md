# Rollback Runbook

## Server rollback

```bash
# 1. Stop current service
systemctl --user stop motionai.service

# 2. Checkout previous version
git checkout <previous-tag-or-commit>

# 3. Rebuild
npm ci
npm run build

# 4. Restart
systemctl --user start motionai.service
systemctl --user status motionai.service
```

## Signaling server rollback

```bash
systemctl --user stop motionai-signaling.service
# Same checkout + rebuild steps as above
systemctl --user start motionai-signaling.service
```

## Client-only rollback

If only the client bundle changed, serve the previous build from cache or
re-deploy the previous `dist/` directory without restarting the server.

## Verification after rollback

```bash
curl http://127.0.0.1:3003/api/health    # should return HTTP 200 / ok:true
curl http://127.0.0.1:3005/health         # signaling health
```

## Database / persistence

- Workspace data is stored in IndexedDB on the client side — it is NOT affected
  by server rollbacks.
- Server-side config (`.env`) is NOT version-controlled. Preserve a backup
  before rolling back if `.env` changed between versions.
