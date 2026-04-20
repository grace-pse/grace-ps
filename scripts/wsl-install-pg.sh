#!/usr/bin/env bash
# One-shot: install Postgres 16 in WSL Ubuntu, create csmp_v2 DB, expose on 0.0.0.0:5432 (WSL).
set -euo pipefail

grep -E '^(NAME|VERSION)=' /etc/os-release

if ! command -v psql >/dev/null 2>&1; then
  echo ">> installing postgresql"
  DEBIAN_FRONTEND=noninteractive apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends \
    postgresql postgresql-contrib
fi

PG_VER=$(ls /etc/postgresql/ | head -1)
PG_CONF="/etc/postgresql/${PG_VER}/main/postgresql.conf"
PG_HBA="/etc/postgresql/${PG_VER}/main/pg_hba.conf"

echo ">> configuring postgres ${PG_VER}"
sed -i "s/^#*listen_addresses.*/listen_addresses = '*'/" "${PG_CONF}"
# Make sure we have a trust line for local dev
grep -qE '^host\s+all\s+all\s+127\.0\.0\.1/32\s+trust' "${PG_HBA}" \
  || echo "host    all    all    127.0.0.1/32    trust" >> "${PG_HBA}"
grep -qE '^host\s+all\s+all\s+::1/128\s+trust' "${PG_HBA}" \
  || echo "host    all    all    ::1/128    trust" >> "${PG_HBA}"

# (re)start via pg_ctlcluster (works without systemd)
pg_ctlcluster "${PG_VER}" main stop 2>/dev/null || true
pg_ctlcluster "${PG_VER}" main start

# Create DB + user
sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='csmp'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE ROLE csmp LOGIN SUPERUSER PASSWORD 'csmp';"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='csmp_v2'" | grep -q 1 \
  || sudo -u postgres createdb -O csmp csmp_v2

echo ">> postgres ready:"
pg_isready -h 127.0.0.1 -p 5432
sudo -u postgres psql -c "\l" | grep csmp_v2
