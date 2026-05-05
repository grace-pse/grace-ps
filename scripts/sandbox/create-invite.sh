#!/usr/bin/env bash
# Create a new reviewer invite via the admin API.
# Usage:
#   scripts/sandbox/create-invite.sh "Jane Doe @ Acme" jane@acme.com [days]
#
# Required env:
#   OWNER_TOKEN              owner-only secret matching API's OWNER_TOKEN
#   SANDBOX_BASE_URL         e.g. https://demo.csmp.marekmalczewski.pl

set -euo pipefail

LABEL="${1:?label required}"
EMAIL="${2:-}"
EXPIRES_DAYS="${3:-}"
BASE_URL="${SANDBOX_BASE_URL:?SANDBOX_BASE_URL required}"
OWNER_TOKEN="${OWNER_TOKEN:?OWNER_TOKEN required}"

PAYLOAD=$(jq -nc \
  --arg label "$LABEL" \
  --arg email "$EMAIL" \
  --argjson days "${EXPIRES_DAYS:-null}" \
  '{label:$label}
   + (if $email != "" then {email:$email} else {} end)
   + (if $days != null then {expiresInDays:($days|tonumber)} else {} end)')

RESP=$(curl -fsS -X POST "$BASE_URL/admin/invites" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: $OWNER_TOKEN" \
  -d "$PAYLOAD")

TOKEN=$(printf '%s' "$RESP" | jq -r .token)
ID=$(printf '%s' "$RESP" | jq -r .id)

echo "Invite created: $ID"
echo "Reviewer link:  $BASE_URL/?invite=$TOKEN"
