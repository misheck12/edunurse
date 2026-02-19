#!/bin/bash
set -e

echo "=========================================="
echo "EduNurse CI/CD Setup Script"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running on server
if [ ! -d "/var/www/livingilabs/edunurse" ]; then
    echo -e "${RED}Error: This script should be run on the production server${NC}"
    echo "Expected directory: /var/www/livingilabs/edunurse"
    exit 1
fi

cd /var/www/livingilabs/edunurse

echo -e "${GREEN}✓${NC} Found project directory"

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗${NC} Docker is not installed"
    echo "Please install Docker first: https://docs.docker.com/engine/install/"
    exit 1
fi
echo -e "${GREEN}✓${NC} Docker is installed"

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}✗${NC} docker-compose is not installed"
    echo "Please install docker-compose first"
    exit 1
fi
echo -e "${GREEN}✓${NC} docker-compose is installed"

# Check if user can run docker without sudo
if ! docker ps &> /dev/null; then
    echo -e "${YELLOW}!${NC} User cannot run docker without sudo"
    echo "Adding user to docker group..."
    sudo usermod -aG docker $USER
    echo -e "${GREEN}✓${NC} User added to docker group"
    echo -e "${YELLOW}Note: You need to log out and log back in for this to take effect${NC}"
fi

# Check if .env.server exists
if [ ! -f "deploy/.env.server" ]; then
    echo -e "${RED}✗${NC} deploy/.env.server not found"
    echo "Please create deploy/.env.server with all required environment variables"
    exit 1
fi
echo -e "${GREEN}✓${NC} Environment file exists"

# Check if git is configured
if ! git config user.email &> /dev/null; then
    echo -e "${YELLOW}!${NC} Git user not configured"
    echo "Configuring git..."
    git config user.email "deploy@edunurse.bwangubwangu.net"
    git config user.name "Deploy Bot"
    echo -e "${GREEN}✓${NC} Git configured"
fi

# Test GitHub Container Registry access
echo ""
echo "Testing GitHub Container Registry access..."
echo "You'll need to provide a GitHub Personal Access Token with read:packages permission"
echo "Or the deployment will use the token from GitHub Actions"
echo ""

# Create a test docker-compose override for CI/CD
cat > deploy/docker-compose.ci.yml << 'EOF'
# This file is used by CI/CD to override image sources
version: '3.8'

services:
  backend:
    image: ${BACKEND_IMAGE:-edunurse-backend:local}
    build:
      context: ../backend
      dockerfile: Dockerfile
      target: runner

  worker:
    image: ${WORKER_IMAGE:-edunurse-worker:local}
    build:
      context: ../backend
      dockerfile: Dockerfile
      target: worker

  frontend:
    image: ${FRONTEND_IMAGE:-edunurse-frontend:local}
    build:
      context: ..
      dockerfile: Dockerfile.frontend

  migrator:
    image: ${MIGRATOR_IMAGE:-edunurse-migrator:local}
    build:
      context: ../backend
      dockerfile: Dockerfile
      target: migrator
EOF

echo -e "${GREEN}✓${NC} Created docker-compose.ci.yml"

# Test database connection
echo ""
echo "Testing database connection..."
if docker-compose -f deploy/docker-compose.server.yml --env-file deploy/.env.server ps postgres | grep -q "Up"; then
    echo -e "${GREEN}✓${NC} Database is running"
else
    echo -e "${YELLOW}!${NC} Database is not running"
    echo "Starting database..."
    docker-compose -f deploy/docker-compose.server.yml --env-file deploy/.env.server up -d postgres
    sleep 10
    echo -e "${GREEN}✓${NC} Database started"
fi

# Test Nginx configuration
echo ""
echo "Checking Nginx configuration..."
if [ -f "/etc/nginx/sites-available/edunurse" ]; then
    echo -e "${GREEN}✓${NC} Nginx configuration exists"
    if sudo nginx -t &> /dev/null; then
        echo -e "${GREEN}✓${NC} Nginx configuration is valid"
    else
        echo -e "${RED}✗${NC} Nginx configuration has errors"
        sudo nginx -t
    fi
else
    echo -e "${YELLOW}!${NC} Nginx configuration not found at /etc/nginx/sites-available/edunurse"
fi

# Summary
echo ""
echo "=========================================="
echo "Setup Summary"
echo "=========================================="
echo ""
echo -e "${GREEN}✓${NC} Project directory: /var/www/livingilabs/edunurse"
echo -e "${GREEN}✓${NC} Docker installed and configured"
echo -e "${GREEN}✓${NC} Environment file ready"
echo -e "${GREEN}✓${NC} Git configured"
echo ""
echo "Next steps:"
echo "1. Configure GitHub Secrets in your repository:"
echo "   - SERVER_HOST: Your server hostname/IP"
echo "   - SERVER_USER: $USER"
echo "   - SERVER_SSH_KEY: Your SSH private key"
echo "   - SERVER_PORT: 22 (or your SSH port)"
echo ""
echo "2. Enable GitHub Actions in your repository"
echo ""
echo "3. Push to main branch to trigger deployment:"
echo "   git push origin main"
echo ""
echo "4. Monitor deployment at:"
echo "   https://github.com/YOUR_USERNAME/edunurse/actions"
echo ""
echo -e "${GREEN}Setup complete!${NC}"
