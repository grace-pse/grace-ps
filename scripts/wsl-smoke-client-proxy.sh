#!/usr/bin/env bash
# Simulate the browser flow against the Vite dev server proxy:
#   client at :5173  -> /api/* proxied to :3001
# 1. login via proxy, 2. fetch assessment via proxy, 3. download PDF via proxy.
set -euo pipefail

CLIENT=http://127.0.0.1:5173
EMAIL='lead@block-b.test'
PASS='password123!'
SLUG='block-b-smoke'
ASSESSMENT_ID='8aab1987-e91d-4589-9dab-d59a44fdf1f6'

echo ">> 1. login via vite proxy"
LOGIN=$(curl -sS -X POST "$CLIENT/api/auth/login" \
  -H 'Content-Type: application/json' \
  --data "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"organizationSlug\":\"$SLUG\"}")
TOKEN=$(echo "$LOGIN" | node -e 'process.stdin.on("data",d=>{try{const j=JSON.parse(d);console.log(j.token||j.access_token||"")}catch(e){}})')
if [[ -z "$TOKEN" ]]; then
  echo "❌ no token via proxy; response: $(echo "$LOGIN" | head -c 200)"; exit 1
fi
echo "   token via proxy: ${TOKEN:0:40}..."

echo ">> 2. fetch assessment via proxy"
curl -sS -H "Authorization: Bearer $TOKEN" "$CLIENT/api/assessments/$ASSESSMENT_ID" \
  | node -e 'let d="";process.stdin.on("data",x=>d+=x);process.stdin.on("end",()=>{const j=JSON.parse(d);console.log("   title:",j.title,"status:",j.status,"reviewStatus:",j.reviewStatus,"threats:",(j.threats||[]).length)})'

echo ">> 3. download PDF via proxy"
HTTP=$(curl -sS -w '%{http_code}\n%{size_download}\n%{content_type}\n' \
  -o /tmp/report-via-proxy.pdf \
  -H "Authorization: Bearer $TOKEN" \
  "$CLIENT/api/assessments/$ASSESSMENT_ID/report.pdf")
echo "   http+size+type:"
echo "$HTTP" | sed 's/^/     /'

echo ">> 4. validate"
ls -la /tmp/report-via-proxy.pdf
if head -c 5 /tmp/report-via-proxy.pdf | grep -q '%PDF-'; then
  echo "   ✅ valid PDF header via proxy"
else
  echo "   ❌ NOT a PDF"; exit 1
fi
cp /tmp/report-via-proxy.pdf /mnt/c/Users/marek/Documents/Claude/Projects/csmp_v2/scripts/block-b-report-via-proxy.pdf
echo ">> saved to scripts/block-b-report-via-proxy.pdf"
