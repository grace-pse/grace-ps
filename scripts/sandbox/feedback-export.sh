#!/usr/bin/env bash
# Dump the sandbox feedback DB to a CSV on the VPS.
# Usage: scripts/sandbox/feedback-export.sh [output.csv]
set -euo pipefail

FEEDBACK_CONTAINER="${FEEDBACK_CONTAINER:-csmp-v2-sandbox-feedback-postgres}"
FEEDBACK_USER="${FEEDBACK_USER:-csmp}"
FEEDBACK_DB="${FEEDBACK_DB:-csmp_feedback}"
OUTPUT="${1:-/tmp/csmp-sandbox-feedback-$(date -u +%Y%m%dT%H%M%SZ).csv}"

docker exec "$FEEDBACK_CONTAINER" psql -U "$FEEDBACK_USER" -d "$FEEDBACK_DB" -At -c "\
  COPY (
    SELECT f.id, f.created_at, ri.label AS reviewer, f.user_email, f.user_role,
           f.category, f.page, f.ip, f.message
      FROM feedback f
 LEFT JOIN reviewer_invites ri ON ri.id = f.invite_id
  ORDER BY f.created_at DESC
  ) TO STDOUT WITH CSV HEADER" > "$OUTPUT"

echo "wrote $OUTPUT"
