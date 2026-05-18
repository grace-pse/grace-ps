#!/usr/bin/env bash
# Block F smoke — Asset Relationship graph
set -eu
API=${API:-http://127.0.0.1:3001/api}
echo "API=$API"

TOKEN=$(curl -sS -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"lead@block-b.test","password":"password123!"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
echo "  token acquired"

echo ""
echo "[1] seed relationships"
node /root/csmp_v2/scripts/seed-relationships.mjs

echo ""
echo "[2] GET /assets/graph — nodes + edges"
curl -sS "$API/assets/graph" -H "Authorization: Bearer $TOKEN" \
  | python3 -c 'import sys,json
d=json.load(sys.stdin)
print("  nodes=", len(d["nodes"]))
print("  edges=", len(d["edges"]))
for e in d["edges"]:
  print("   -", e["relationshipType"], "dir=", e["direction"], "impact=", e["impactPropagation"])
assert len(d["nodes"]) > 0, "expected nodes"
assert len(d["edges"]) >= 3, "expected at least 3 edges from seed"'

echo ""
echo "[3] POST /assets/relationships — create a one-off edge"
IDS=$(curl -sS "$API/assets?pageSize=5" -H "Authorization: Bearer $TOKEN" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d["items"][0]["id"], d["items"][1]["id"])')
SRC=$(echo $IDS | cut -d" " -f1); DST=$(echo $IDS | cut -d" " -f2)
NEW=$(curl -sS -X POST "$API/assets/relationships" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"sourceAssetId\":\"$SRC\",\"targetAssetId\":\"$DST\",\"relationshipType\":\"SERVES\",\"description\":\"smoke\"}" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d["id"])')
echo "  new edge id: $NEW"

echo ""
echo "[4] DELETE /assets/relationships/:id"
HTTP=$(curl -sS -o /dev/null -w "%{http_code}" -X DELETE "$API/assets/relationships/$NEW" \
  -H "Authorization: Bearer $TOKEN")
echo "  status=$HTTP"
test "$HTTP" = "204" || { echo "expected 204"; exit 1; }

echo ""
echo "[5] self-loop rejected"
HTTP=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "$API/assets/relationships" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"sourceAssetId\":\"$SRC\",\"targetAssetId\":\"$SRC\",\"relationshipType\":\"SERVES\"}")
echo "  status=$HTTP (expect 400)"
test "$HTTP" = "400" || { echo "expected 400"; exit 1; }

echo ""
echo "[6] non-existent asset rejected (fake uuid)"
HTTP=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "$API/assets/relationships" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"sourceAssetId\":\"$SRC\",\"targetAssetId\":\"00000000-0000-0000-0000-000000000000\",\"relationshipType\":\"SERVES\"}")
echo "  status=$HTTP (expect 404)"
test "$HTTP" = "404" || { echo "expected 404"; exit 1; }

echo ""
echo "[7] final graph state"
curl -sS "$API/assets/graph" -H "Authorization: Bearer $TOKEN" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print("  nodes=", len(d["nodes"]), "edges=", len(d["edges"]))'

echo ""
echo "=== Block F smoke: OK ==="
