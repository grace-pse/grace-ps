#!/usr/bin/env bash
# Create the Postgres template database used by reset.sh.
#
# Run ONCE after the first successful seed of the sandbox stack. Afterward
# every reset.sh run rebuilds csmp_v2 from this template (sub-second).
#
# Idempotent — re-running is a no-op if the template already exists.
#
# Required env vars:
#   COMPOSE_PROJECT  default: csmp-v2-sandbox
#   POSTGRES_CONTAINER  default: csmp-v2-sandbox-postgres
#   POSTGRES_USER       default: csmp
#   POSTGRES_DB         default: csmp_v2
#   TEMPLATE_DB         default: csmp_demo_template

set -euo pipefail

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-csmp-v2-sandbox-postgres}"
POSTGRES_USER="${POSTGRES_USER:-csmp}"
POSTGRES_DB="${POSTGRES_DB:-csmp_v2}"
TEMPLATE_DB="${TEMPLATE_DB:-csmp_demo_template}"

log() {
  printf '[snapshot %s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"
}

psql_admin() {
  docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d postgres -At "$@"
}

log "checking for existing template '$TEMPLATE_DB'…"
EXISTS=$(psql_admin -c "SELECT 1 FROM pg_database WHERE datname = '$TEMPLATE_DB'")
if [[ -n "$EXISTS" ]]; then
  log "template '$TEMPLATE_DB' already exists — nothing to do"
  exit 0
fi

log "checking for source DB '$POSTGRES_DB'…"
SRC_EXISTS=$(psql_admin -c "SELECT 1 FROM pg_database WHERE datname = '$POSTGRES_DB'")
if [[ -z "$SRC_EXISTS" ]]; then
  log "ERROR: source database '$POSTGRES_DB' does not exist — start the stack and let it seed first"
  exit 1
fi

log "terminating live connections to '$POSTGRES_DB' before snapshot…"
psql_admin -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$POSTGRES_DB' AND pid <> pg_backend_pid();" >/dev/null

log "creating template database…"
psql_admin -c "CREATE DATABASE $TEMPLATE_DB TEMPLATE $POSTGRES_DB OWNER $POSTGRES_USER;"
psql_admin -c "UPDATE pg_database SET datistemplate = TRUE WHERE datname = '$TEMPLATE_DB';"

log "snapshot complete — '$TEMPLATE_DB' is now the reset baseline"
