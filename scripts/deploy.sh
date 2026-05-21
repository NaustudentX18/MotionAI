#!/usr/bin/env bash
set -euo pipefail

# MotionAI Deploy Script
# Usage: ./scripts/deploy.sh [--port PORT] [--docker|--systemd|--direct]

PORT="${PORT:-3000}"
MODE="${1:---systemd}"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== MotionAI Deploy ==="
echo "Mode: $MODE"
echo "Port: $PORT"
echo "App:  $APP_DIR"

cd "$APP_DIR"

# Build if needed
if [ ! -f dist/server.cjs ] || [ ! -f dist/index.html ]; then
  echo "Building..."
  npm run build
fi

case "$MODE" in
  --direct|direct)
    echo "Starting directly on port $PORT..."
    PORT="$PORT" NODE_ENV=production node dist/server.cjs
    ;;

  --systemd|systemd)
    echo "Installing systemd user service..."
    mkdir -p "$HOME/.config/systemd/user"
    cat > "$HOME/.config/systemd/user/motionai.service" << SERVICE
[Unit]
Description=MotionAI Document Space
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node dist/server.cjs
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=$PORT
Environment=AI_RATE_LIMIT_STORE_PATH=$HOME/.local/share/motionai/rate-limit-store.json
EnvironmentFile=-$APP_DIR/.env

[Install]
WantedBy=default.target
SERVICE

    mkdir -p "$HOME/.local/share/motionai"
    systemctl --user daemon-reload
    systemctl --user enable motionai.service
    systemctl --user restart motionai.service
    echo "Service installed. Check: systemctl --user status motionai.service"
    ;;

  --docker|docker)
    echo "Building Docker image..."
    docker build -t motionai:latest .
    echo "Starting container on port $PORT..."
    docker run -d \
      --name motionai \
      -p "$PORT:3000" \
      -e NODE_ENV=production \
      -e AI_RATE_LIMIT_STORE_PATH=/data/rate-limit-store.json \
      -v motionai_data:/data \
      --restart unless-stopped \
      motionai:latest
    echo "Container started. Check: docker logs motionai"
    ;;

  *)
    echo "Usage: $0 [--direct|--systemd|--docker]"
    exit 1
    ;;
esac

echo "=== Done ==="
