#!/bin/bash
# READ-ONLY psql against the demo database (writes are refused by the session).
# MB_DEMO_DB (default medbrains_wt_g2shots) on MB_DEMO_PGPORT (default 5435); password from medbrains/.env.
ENV_FILE="$(cd "$(dirname "$0")/../.." && pwd)/.env"
PW=$(grep '^DATABASE_URL' "$ENV_FILE" | sed -E 's#.*//[^:]+:([^@]+)@.*#\1#')
PGPASSWORD="$PW" PGOPTIONS='-c default_transaction_read_only=on' psql -h localhost -p "${MB_DEMO_PGPORT:-5435}" \
  -U medbrains -d "${MB_DEMO_DB:-medbrains_wt_g2shots}" -X -A -F'|' -c "$1"
