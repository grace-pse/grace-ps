#!/usr/bin/env bash
set -eu
API=http://127.0.0.1:3001/api
ASSESSMENT_ID=0ba2b240-3eca-47e0-9a14-87f01c762ce7

TOKEN=$(curl -sS -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"lead@block-b.test","password":"password123!","organizationSlug":"block-b-smoke"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')

echo "[1] threat tags in detail:"
curl -sS "$API/assessments/$ASSESSMENT_ID" -H "Authorization: Bearer $TOKEN" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin)
for t in d["threats"]:
  print(" ", t["adversaryType"], t["actionType"], "->", t["complianceTags"])'

echo ""
echo "[2] action-plan tags:"
curl -sS "$API/assessments/$ASSESSMENT_ID/action-plans" -H "Authorization: Bearer $TOKEN" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin)
for p in d["items"]:
  print(" ", p["actionRequired"][:60], "->", p["complianceTags"])'

echo ""
echo "[3] list filter complianceTag=NIS2_ART_23:"
curl -sS "$API/assessments?complianceTag=NIS2_ART_23" -H "Authorization: Bearer $TOKEN" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin)
print("  total=", d["total"])
for i in d["items"]:
  print(" ", i["title"], "(", i["reviewStatus"], ")")'

echo ""
echo "[4] list filter complianceTag=ISO_28000 (expect empty):"
curl -sS "$API/assessments?complianceTag=ISO_28000" -H "Authorization: Bearer $TOKEN" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print("  total=", d["total"])'

echo ""
echo "[5] patch threat tags:"
TID=$(curl -sS "$API/assessments/$ASSESSMENT_ID" -H "Authorization: Bearer $TOKEN" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["threats"][0]["id"])')
curl -sS -X PATCH "$API/assessments/$ASSESSMENT_ID/threats/$TID" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"complianceTags":["ISO_28000","CER"]}' \
  | python3 -c 'import sys,json;print("  new tags:", json.load(sys.stdin)["complianceTags"])'

echo ""
echo "[6] list filter complianceTag=ISO_28000 after patch (expect 1):"
curl -sS "$API/assessments?complianceTag=ISO_28000" -H "Authorization: Bearer $TOKEN" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print("  total=", d["total"])'

echo ""
echo "[7] PDF export (should contain Compliance coverage matrix):"
curl -sS "$API/assessments/$ASSESSMENT_ID/report.pdf" -H "Authorization: Bearer $TOKEN" \
  -o /tmp/csmp-report.pdf
SIZE=$(stat -c %s /tmp/csmp-report.pdf)
echo "  PDF size: $SIZE bytes"
echo "  head: $(head -c 8 /tmp/csmp-report.pdf | od -c | head -1)"
