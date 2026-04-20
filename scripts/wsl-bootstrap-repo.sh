#!/usr/bin/env bash
# Copy the repo (sans node_modules) into WSL home, install deps, generate Prisma, build shared.
set -euo pipefail

SRC=/mnt/c/Users/marek/Documents/Claude/Projects/csmp_v2
DST=/root/csmp_v2

echo ">> rsync repo"
mkdir -p "$DST"
rsync -a --delete \
  --exclude 'node_modules' --exclude 'dist' --exclude '.env.example' \
  --exclude '.git/objects' \
  "$SRC/" "$DST/"

cd "$DST"

echo ">> pnpm install"
pnpm install --frozen-lockfile 2>&1 | tail -15

echo ">> prisma generate"
pnpm --filter server exec prisma generate 2>&1 | tail -5

echo ">> build shared package"
pnpm --filter @csmp/shared build 2>&1 | tail -5 || echo "(no build script for shared — ignored)"

echo ">> done; repo root is $DST"
