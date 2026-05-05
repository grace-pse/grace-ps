#!/usr/bin/env bash
# Reset the sandbox demo database back to the seeded baseline.
#
# Strategy:
#   1. stop the api container so its connection pool releases
#   2. terminate any stragglers connected to the demo DB
#   3. DROP DATABASE csmp_v2; CREATE DATABASE csmp_v2 TEMPLATE csmp_demo_template
#   4. record the reset timestamp to /var/lib/csmp-sandbox/last-reset.txt
#      (mounted into the api container so /api/sandbox/status can serve it)
#   5. start the api container; maybe-seed.mjs sees existing users and no-ops
#
# Cron entry installed by install-cron.sh:
#   0 4 */2 * * /opt/csmp-v2-sandbox/scripts/sandbox/reset.sh
#
# This must be run as a user able to talk to docker (root or in docker group).
# Logs to /var/log/csmp-sandbox-reset.log.

set -euo pipefail

COMPOSE_PROJECT="${COMPOSE_PROJECT:-csmp-v2-sandbox}"
COMPOSE_FILES="${COMPOSE_FILES:--f docker/docker-compose.yml -f docker/docker-compose.sandbox.yml}"
COMPOSE_DIR="${COMPOSE_DIR:-/opt/csmp-v2-sandbox}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-csmp-v2-sandbox-postgres}"
POSTGRES_USER="${POSTGRES_USER:-csmp}"
POSTGRES_DB="${POSTGRES_DB:-csmp_v2}"
TEMPLATE_DB="${TEMPLATE_DB:-csmp_demo_template}"
LAST_RESET_FILE="${LAST_RESET_FILE:-/var/lib/csmp-sandbox/last-reset.txt}"
LOG_FILE="${LOG_FILE:-/var/log/csmp-sandbox-reset.log}"

mkdir -p "$(dirname "$LAST_RESET_FILE")"
mkdir -p "$(dirname "$LOG_FILE")"

log() {
  printf '[reset %s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" | tee -a "$LOG_FILE"
}

err() {
  printf '[reset %s] ERROR: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" | tee -a "$LOG_FILE" >&2
  exit 1
}

psql_admin() {
  docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d postgres -At "$@"
}

cd "$COMPOSE_DIR" || err "compose dir $COMPOSE_DIR missing"

log "verifying template '$TEMPLATE_DB' exists…"
EXISTS=$(psql_admin -c "SELECT 1 FROM pg_database WHERE datname = '$TEMPLATE_DB'") || true
if [[ -z "$EXISTS" ]]; then
  err "template '$TEMPLATE_DB' missing — run scripts/sandbox/snapshot.sh first"
fi

log "stopping api container to drop its connection pool…"
# shellcheck disable=SC2086
docker compose -p "$COMPOSE_PROJECT" $COMPOSE_FILES stop api >>"$LOG_FILE" 2>&1 || err "could not stop api"

log "terminating any remaining connections to '$POSTGRES_DB'…"
psql_admin -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$POSTGRES_DB' AND pid <> pg_backend_pid();" >/dev/null

log "dropping and recreating '$POSTGRES_DB' from template '$TEMPLATE_DB'…"
psql_admin -c "DROP DATABASE IF EXISTS $POSTGRES_DB;"
psql_admin -c "CREATE DATABASE $POSTGRES_DB TEMPLATE $TEMPLATE_DB OWNER $POSTGRES_USER;"

date -u +%s > "$LAST_RESET_FILE"
log "wrote reset timestamp to $LAST_RESET_FILE ($(cat "$LAST_RESET_FILE"))"

log "starting api container…"
# shellcheck disable=SC2086
docker compose -p "$COMPOSE_PROJECT" $COMPOSE_FILES start api >>"$LOG_FILE" 2>&1 || err "could not start api"

log "reset complete"
