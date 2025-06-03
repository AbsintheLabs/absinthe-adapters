#!/bin/bash
set -e

echo "[ABS] 🔁 Redeploying abs-app..."
ENV_PATH="/home/admin/ops/absinthe-api/.env" 
# Stop and remove existing container if it exists
if podman ps -a --format '{{.Names}}' | grep -q '^abs-app$'; then
  echo "[ABS] 🧹 Removing existing abs-app container..."
  podman rm -f abs-app
fi

# Pull latest image
echo "[ABS] 📦 Pulling latest image..."
podman pull ghcr.io/absinthelabs/absinthe-abs-app:abs-app

# Start new container
echo "[ABS] 🚀 Starting new abs-app container..."
podman run -d \
  --name abs-app \
  --network absinthe-net \
  --env-file $ENV_PATH \
  -p 3000:3000 \
  ghcr.io/absinthelabs/absinthe-abs-app:abs-app

# Health check
echo "[ABS] 🔍 Waiting for health check..."
for i in {1..10}; do
  if curl -sf http://localhost:3000/health; then
    echo "[ABS] ✅ abs-app is healthy!"
    exit 0
  fi
  echo "  ...retry $i"
  sleep 2
done

echo "[ABS] ❌ Health check failed."
exit 1
