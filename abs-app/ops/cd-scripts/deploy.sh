#!/bin/bash
set -e

ENV_PATH="/home/admin/ops/absinthe-api/.env"
NETWORK_NAME="absinthe-net"
APP_NAME="abs-app"
REDIS_CONTAINER_NAME="redis"

echo "[ABS] 🌐 Ensuring $NETWORK_NAME network exists..."
if ! podman network exists "$NETWORK_NAME"; then
  podman network create "$NETWORK_NAME"
  echo "[ABS] ✅ Created network $NETWORK_NAME"
fi

echo "[ABS] 🔁 Redeploying $APP_NAME..."

# Stop and remove existing app container if it exists
if podman ps -a --format '{{.Names}}' | grep -q "^$APP_NAME$"; then
  echo "[ABS] 🧹 Removing existing $APP_NAME container..."
  podman rm -f "$APP_NAME"
fi

# Pull latest image
echo "[ABS] 📦 Pulling latest image..."
podman pull ghcr.io/absinthelabs/absinthe-abs-app:latest

# Start new container on shared network
echo "[ABS] 🚀 Starting new $APP_NAME container..."
podman run -d \
  --name "$APP_NAME" \
  --network "$NETWORK_NAME" \
  --env-file "$ENV_PATH" \
  -p 3000:3000 \
  ghcr.io/absinthelabs/absinthe-abs-app:latest

# Health check
echo "[ABS] 🔍 Waiting for health check..."
for i in {1..10}; do
  if curl -sf http://localhost:3000/health; then
    echo "[ABS] ✅ $APP_NAME is healthy!"
    exit 0
  fi
  echo "  ...retry $i"
  sleep 2
done

echo "[ABS] ❌ Health check failed."
exit 1
