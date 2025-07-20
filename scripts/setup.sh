#!/usr/bin/env bash
set -e

# Install dependencies
sudo apt-get update
sudo apt-get install -y curl git

# Install Node.js 20 LTS via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Ensure project directories exist
mkdir -p src/commands src/config src/events src/utils src/types

# Copy environment example if .env is missing
if [ ! -f .env ] && [ -f .env.example ]; then
  cp .env.example .env
fi

# Install npm packages
npm install

echo "Setup complete."

