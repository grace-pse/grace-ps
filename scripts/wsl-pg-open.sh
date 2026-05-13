#!/usr/bin/env bash
set -euo pipefail
HBA="/etc/postgresql/16/main/pg_hba.conf"
# idempotent append
if ! grep -qE '^host\s+all\s+all\s+0\.0\.0\.0/0\s+trust' "$HBA"; then
  echo "host    all    all    0.0.0.0/0    trust" | sudo tee -a "$HBA" >/dev/null
fi
sudo pg_ctlcluster 16 main reload
echo "--- last 5 lines of pg_hba.conf ---"
tail -5 "$HBA"
