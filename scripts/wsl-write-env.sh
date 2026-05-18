#!/usr/bin/env bash
set -euo pipefail
cat > /root/csmp_v2/server/.env <<'EOF'
DATABASE_URL="postgresql://csmp:csmp@127.0.0.1:5432/csmp_v2?schema=public"
JWT_SECRET="dev-local-smoke-test-secret-block-b-puppeteer-2026-04-20-32chars+"
JWT_EXPIRES_IN="7d"
PORT=3001
HOST=0.0.0.0
NODE_ENV=development
CORS_ORIGIN="http://localhost:5173,http://localhost:8080"
EOF
echo ">> /root/csmp_v2/server/.env written"
cat /root/csmp_v2/server/.env | grep -v SECRET
