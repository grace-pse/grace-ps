#!/usr/bin/env bash
# Block E smoke — Assessment Snapshots
# Requires API running on :3002 (workaround for Windows-side :3001 conflict).
# Re-uses the block-b-smoke tenant; re-seeds the IN_REVIEW assessment fresh.
set -eu
API=${API:-http://127.0.0.1:3002/api}
echo "API=$API"

echo "[0] re-seed IN_REVIEW assessment"
node /root/csmp_v2/scripts/seed-in-review-assessment.mjs | tee /tmp/seed-out.txt
ASSESSMENT_ID=$(grep '^ASSESSMENT_ID=' /tmp/seed-out.txt | cut -d= -f2)
echo "  ASSESSMENT_ID=$ASSESSMENT_ID"

TENANT=block-b-smoke

login() {
  local email=$1
  curl -sS -X POST "$API/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"password123!\",\"organizationSlug\":\"$TENANT\"}" \
    | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])'
}

LEAD_TOKEN=$(login lead@block-b.test)
REVIEWER_TOKEN=$(login reviewer@block-b.test)
echo "  lead+reviewer tokens acquired"

echo ""
echo "[1] GET snapshots (expect empty — just reseeded)"
curl -sS "$API/assessments/$ASSESSMENT_ID/snapshots" -H "Authorization: Bearer $LEAD_TOKEN" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print("  count=", len(d["items"]))'

echo ""
echo "[2] POST manual snapshot (lead)"
curl -sS -X POST "$API/assessments/$ASSESSMENT_ID/snapshots" \
  -H "Authorization: Bearer $LEAD_TOKEN" -H 'Content-Type: application/json' \
  -d '{"note":"Manual checkpoint before reviewer hands over."}' \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print("  saved:", d["reason"], "-", d["note"])'

echo ""
echo "[3] GET snapshots (expect 1)"
curl -sS "$API/assessments/$ASSESSMENT_ID/snapshots" -H "Authorization: Bearer $LEAD_TOKEN" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin)
print("  count=", len(d["items"]))
for s in d["items"]:
  print("  -", s["reason"], s["capturedByName"], s["note"])'

echo ""
echo "[4] Reviewer approves (expect second snapshot auto-captured)"
curl -sS -X POST "$API/assessments/$ASSESSMENT_ID/review" \
  -H "Authorization: Bearer $REVIEWER_TOKEN" -H 'Content-Type: application/json' \
  -d '{"action":"approve","notes":"Looks good — approving."}' \
  | python3 -c 'import sys,json;d=json.load(sys.stdin)
print("  new status:", d["status"], "review:", d["reviewStatus"])'

echo ""
echo "[5] GET snapshots (expect 2 — manual + APPROVED)"
curl -sS "$API/assessments/$ASSESSMENT_ID/snapshots" -H "Authorization: Bearer $LEAD_TOKEN" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin)
print("  count=", len(d["items"]))
for s in d["items"]:
  print("  -", s["reason"], s["capturedByName"], "note=", s["note"])'

echo ""
echo "[6] GET first snapshot detail (verify payload shape)"
SID=$(curl -sS "$API/assessments/$ASSESSMENT_ID/snapshots" -H "Authorization: Bearer $LEAD_TOKEN" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["items"][0]["id"])')
curl -sS "$API/assessments/$ASSESSMENT_ID/snapshots/$SID" -H "Authorization: Bearer $LEAD_TOKEN" \
  | python3 -c 'import sys,json
d=json.load(sys.stdin)
p=d["payload"]
print("  reason=", d["reason"])
print("  payload keys=", sorted(p.keys()))
print("  threats=", len(p["threats"]))
print("  actionPlans=", len(p["actionPlans"]))
t0=p["threats"][0]
print("  threat[0] tearStrategy=", t0.get("tearStrategy"), "priority=", t0.get("riskTreatmentPriority"))'

echo ""
echo "[7] Re-seed + reviewer rejects → expect REJECTED snapshot"
node /root/csmp_v2/scripts/seed-in-review-assessment.mjs | tee /tmp/seed-out-2.txt > /dev/null
ASSESSMENT_ID_2=$(grep '^ASSESSMENT_ID=' /tmp/seed-out-2.txt | cut -d= -f2)
curl -sS -X POST "$API/assessments/$ASSESSMENT_ID_2/review" \
  -H "Authorization: Bearer $REVIEWER_TOKEN" -H 'Content-Type: application/json' \
  -d '{"action":"reject","notes":"Needs more evidence."}' \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print("  status:", d["status"], "review:", d["reviewStatus"])'
curl -sS "$API/assessments/$ASSESSMENT_ID_2/snapshots" -H "Authorization: Bearer $LEAD_TOKEN" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin)
reasons=[s["reason"] for s in d["items"]]
print("  reasons:", reasons)
assert "REJECTED" in reasons, "expected REJECTED snapshot"'

echo ""
echo "=== Block E smoke: OK ==="
