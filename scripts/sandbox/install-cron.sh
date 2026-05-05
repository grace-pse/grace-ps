#!/usr/bin/env bash
# Install the sandbox reset cron entry under the current user (root on the VPS).
# Idempotent: re-running it does not duplicate the entry.
#
# Reset cadence: every 48 hours at 04:00 UTC.

set -euo pipefail

ENTRY_TAG="# csmp-sandbox-reset (managed)"
RESET_SCRIPT="${RESET_SCRIPT:-/opt/csmp-v2-sandbox/scripts/sandbox/reset.sh}"
SCHEDULE="${SCHEDULE:-0 4 */2 * *}"

if [[ ! -x "$RESET_SCRIPT" ]]; then
  echo "reset.sh not executable at $RESET_SCRIPT" >&2
  exit 1
fi

CURRENT=$(crontab -l 2>/dev/null || true)
if printf '%s\n' "$CURRENT" | grep -Fq "$ENTRY_TAG"; then
  echo "cron entry already installed — refreshing it"
  REMAINING=$(printf '%s\n' "$CURRENT" | grep -Fv "$ENTRY_TAG" | grep -Fv "$RESET_SCRIPT" || true)
else
  REMAINING="$CURRENT"
fi

{
  if [[ -n "$REMAINING" ]]; then
    printf '%s\n' "$REMAINING"
  fi
  printf '%s\n%s %s >> /var/log/csmp-sandbox-reset.log 2>&1\n' "$ENTRY_TAG" "$SCHEDULE" "$RESET_SCRIPT"
} | crontab -

echo "installed: $SCHEDULE  $RESET_SCRIPT"
