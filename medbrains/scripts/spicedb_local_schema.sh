#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SPICEDB_ENDPOINT="${SPICEDB_ENDPOINT:-http://localhost:50051}"
SPICEDB_TOKEN="${SPICEDB_TOKEN:-devsecret}"
SPICEDB_SCHEMA_FILE="${SPICEDB_SCHEMA_FILE:-$ROOT_DIR/infra/spicedb/schema.zed}"
SPICEDB_SKIP_START="${SPICEDB_SKIP_START:-false}"

if [[ "$SPICEDB_SKIP_START" != "true" ]]; then
  echo "Starting local SpiceDB..."
  docker compose up -d spicedb
fi

echo "Loading local SpiceDB schema from $SPICEDB_SCHEMA_FILE..."
SPICEDB_ENDPOINT="$SPICEDB_ENDPOINT" \
SPICEDB_TOKEN="$SPICEDB_TOKEN" \
  cargo run -q -p medbrains-authz --bin spicedb-schema-write -- "$SPICEDB_SCHEMA_FILE"
echo "Local SpiceDB schema ready at $SPICEDB_ENDPOINT."
