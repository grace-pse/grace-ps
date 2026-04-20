#!/usr/bin/env bash
# Install Node 20 + corepack/pnpm + Chromium inside WSL Ubuntu.
# Idempotent.
set -euo pipefail

# --- Node 20 via NodeSource ---
if ! command -v node >/dev/null 2>&1 || [[ "$(node --version)" != v20.* ]]; then
  echo ">> installing Node 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  DEBIAN_FRONTEND=noninteractive sudo apt-get install -y -qq nodejs
fi
node --version

# --- pnpm via corepack ---
if ! command -v pnpm >/dev/null 2>&1; then
  echo ">> enabling corepack + pnpm"
  sudo corepack enable
  corepack prepare pnpm@9.15.0 --activate
fi
pnpm --version

# --- Chromium + fonts for Puppeteer ---
if [[ ! -x /usr/bin/chromium ]]; then
  echo ">> installing chromium + fonts"
  DEBIAN_FRONTEND=noninteractive sudo apt-get install -y -qq --no-install-recommends \
    chromium-browser fonts-liberation fonts-dejavu-core \
    libnss3 libxss1 libasound2t64 libatk-bridge2.0-0 libdrm2 libgbm1 libxkbcommon0 \
    || DEBIAN_FRONTEND=noninteractive sudo apt-get install -y -qq --no-install-recommends \
         chromium fonts-liberation fonts-dejavu-core \
         libnss3 libxss1 libasound2t64 libatk-bridge2.0-0 libdrm2 libgbm1 libxkbcommon0
fi
if [[ -x /usr/bin/chromium-browser ]]; then
  echo "chromium=/usr/bin/chromium-browser"
elif [[ -x /usr/bin/chromium ]]; then
  echo "chromium=/usr/bin/chromium"
else
  echo "no chromium found"; exit 1
fi
echo "--- done ---"
