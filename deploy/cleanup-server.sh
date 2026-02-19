#!/bin/bash

# Server cleanup script for stateless deployment
# Run this on your server to prepare for the new deployment method

set -euo pipefail

DEPLOY_PATH="/var/www/livingilabs/edunurse"

echo "🧹 Cleaning up server for stateless deployment..."

# Stop any running containers
if [ -d "$DEPLOY_PATH" ]; then
    cd "$DEPLOY_PATH"
    
    # Try to stop containers if docker-compose files exist
    if [ -f "deploy/docker-compose.server.yml" ]; then
        echo "Stopping existing containers..."
        docker-compose -f deploy/docker-compose.server.yml down || true
    fi
    
    if [ -f "docker-compose.yml" ]; then
        echo "Stopping containers from docker-compose.yml..."
        docker-compose down || true
    fi
fi

# Backup any important data (optional)
if [ -d "$DEPLOY_PATH" ]; then
    echo "Creating backup of deployment directory..."
    sudo cp -r "$DEPLOY_PATH" "${DEPLOY_PATH}.backup.$(date +%Y%m%d_%H%M%S)" || true
fi

# Remove the git repository and source code
echo "Removing source code directory..."
sudo rm -rf "$DEPLOY_PATH"

# Create clean deployment directory
echo "Creating clean deployment directory..."
sudo mkdir -p "$DEPLOY_PATH"
sudo chown -R $USER:$USER "$DEPLOY_PATH"

# Clean up unused Docker images (optional)
echo "Cleaning up unused Docker images..."
docker system prune -f || true

echo "✅ Server cleanup complete!"
echo ""
echo "The server is now ready for stateless deployment."
echo "Your next GitHub Actions deployment will:"
echo "  1. Create docker-compose.yml and .env files dynamically"
echo "  2. Pull container images from GitHub Container Registry"
echo "  3. Run the application without any source code on the server"
echo ""
echo "Make sure your GitHub repository has all the required secrets and variables configured."