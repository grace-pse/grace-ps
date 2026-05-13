#!/usr/bin/env bash
# Smoke-test the PDF endpoint end-to-end:
#  1. Login as lead assessor, grab JWT.
#  2. Fetch the approved assessment.
#  3. Download the PDF.
#  4. Validate magic bytes + size.
set -euo pipefail

API=http://127.0.0.1:3001/api
EMAIL='lead@block-b.test'
PASS='password123!'
ASSESSMENT_ID='8aab1987-e91d-4589-9dab-d59a44fdf1f6'

echo ">> 1. login"
LOGIN=$(curl -sS -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  --data "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"organizationSlug\":\"block-b-smoke\"}")
echo "response: $(echo "$LOGIN" | head -c 200)"
TOKEN=$(echo "$LOGIN" | node -e 'process.stdin.on("data",d=>{try{const j=JSON.parse(d);console.log(j.token||j.access_token||"")}catch(e){}})')
if [[ -z "$TOKEN" ]]; then
  echo "❌ no token"; exit 1
fi
echo "token: ${TOKEN:0:40}..."

echo ">> 2. fetch assessment detail"
curl -sS -H "Authorization: Bearer $TOKEN" "$API/assessments/$ASSESSMENT_ID" \
  | node -e 'let d="";process.stdin.on("data",x=>d+=x);process.stdin.on("end",()=>{const j=JSON.parse(d);console.log("   title:",j.title,"status:",j.status,"reviewStatus:",j.reviewStatus,"threats:",(j.threats||[]).length)})'

echo ">> 3. download PDF to /tmp/report.pdf"
HTTP=$(curl -sS -w '%{http_code}\n%{size_download}\n%{content_type}\n' \
  -o /tmp/report.pdf \
  -H "Authorization: Bearer $TOKEN" \
  "$API/assessments/$ASSESSMENT_ID/report.pdf")
echo "   http headers+size:"
echo "$HTTP" | sed 's/^/     /'

echo ">> 4. validate"
ls -la /tmp/report.pdf
MAGIC=$(head -c 8 /tmp/report.pdf | hexdump -C | head -1)
echo "   magic: $MAGIC"
if head -c 5 /tmp/report.pdf | grep -q '%PDF-'; then
  echo "   ✅ valid PDF header"
else
  echo "   ❌ NOT a PDF"; exit 1
fi
PAGES=$(grep -aoE '/Type[[:space:]]*/Page[^s]' /tmp/report.pdf | wc -l)
echo "   pages detected (rough): $PAGES"
echo ">> saving to /mnt/c/Users/marek/Documents/Claude/Projects/csmp_v2/scripts/block-b-report.pdf"
cp /tmp/report.pdf /mnt/c/Users/marek/Documents/Claude/Projects/csmp_v2/scripts/block-b-report.pdf
