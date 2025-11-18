#!/bin/bash

# Local Docker Run Script for Conductor App
set -e

echo "🚀 Starting Conductor App locally with Docker..."

# Build the image
echo "📦 Building Docker image..."
docker build -t conductor-app:local .

# Run the container
echo "🏃 Running container..."
docker run -d \
  --name conductor-app-local \
  -p 3001:3001 \
  -e NODE_ENV=development \
  -e DATABASE_URL=postgresql://app:app_pw@host.docker.internal:5432/conductor \
  conductor-app:local

echo "✅ Container started successfully!"
echo "🌐 Application available at: http://localhost:3001"
echo "🏥 Health check: http://localhost:3001/api/health"
echo ""
echo "📋 Useful commands:"
echo "  View logs: docker logs conductor-app-local"
echo "  Stop app:  docker stop conductor-app-local"
echo "  Remove:    docker rm conductor-app-local"
