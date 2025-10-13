#!/bin/bash

# Script to reset Docker environment for absinthe-adapters
# This script stops containers, removes volumes, and restarts the services

set -e  # Exit on any error

echo "🛑 Stopping Docker Compose services..."
sudo docker compose down

echo "📋 Listing Docker volumes..."
sudo docker volume ls

echo "🗑️  Removing Docker volumes..."
# Get all volume names and remove them (excluding the one that might be in use)
VOLUMES=$(sudo docker volume ls -q)
if [ ! -z "$VOLUMES" ]; then
    echo "Found volumes to remove: $VOLUMES"
    for volume in $VOLUMES; do
        echo "Attempting to remove volume: $volume"
        sudo docker volume rm "$volume" 2>/dev/null || echo "⚠️  Could not remove volume $volume (might be in use)"
    done
else
    echo "No volumes found to remove"
fi

echo "🚀 Starting Docker Compose services..."
sudo docker compose up -d

echo "✅ Docker environment reset complete!"
echo "📊 Current running containers:"
sudo docker ps
