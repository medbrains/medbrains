#!/usr/bin/env bash
set -euo pipefail

# Push the local SpiceDB authorization schema.
#
# This used to be the slowest step in `make dev`, and not because SpiceDB is
# slow: writing the schema means `cargo run -p medbrains-authz`, which builds
# tonic, prost and the SpiceDB client before it can send a file that changes
# perhaps once a month. On a cold target that is minutes, every single start.
#
# So the write is skipped when nothing that matters has changed. The stamp
# covers two things:
#
#   * the schema file's hash — an edited schema must be pushed;
#   * the SpiceDB container's id — a recreated container has an empty schema
#     even though the file is untouched, and skipping there would leave every
#     authz check failing against a schema that was never loaded.
#
# Force a write with SPICEDB_FORCE_SCHEMA=true.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SPICEDB_ENDPOINT="${SPICEDB_ENDPOINT:-http://localhost:50051}"
SPICEDB_TOKEN="${SPICEDB_TOKEN:-devsecret}"
SPICEDB_SCHEMA_FILE="${SPICEDB_SCHEMA_FILE:-$ROOT_DIR/infra/spicedb/schema.zed}"
SPICEDB_SKIP_START="${SPICEDB_SKIP_START:-false}"
SPICEDB_FORCE_SCHEMA="${SPICEDB_FORCE_SCHEMA:-false}"

STAMP_FILE="$ROOT_DIR/var/spicedb-schema.stamp"

if [[ "$SPICEDB_SKIP_START" != "true" ]]; then
  echo "Starting local SpiceDB..."
  docker compose up -d spicedb
fi

schema_hash="$(shasum -a 256 "$SPICEDB_SCHEMA_FILE" | cut -d' ' -f1)"
# Empty when docker is unreachable, which simply means no skip — the safe way
# to be wrong, since a missed write leaves every authz check broken.
container_id="$(docker compose ps -q spicedb 2>/dev/null || true)"
want="${schema_hash}:${container_id}"

if [[ "$SPICEDB_FORCE_SCHEMA" != "true" && -n "$container_id" && -f "$STAMP_FILE" ]]; then
  if [[ "$(cat "$STAMP_FILE")" == "$want" ]]; then
    echo "SpiceDB schema unchanged — skipping write (SPICEDB_FORCE_SCHEMA=true to override)."
    exit 0
  fi
fi

echo "Loading local SpiceDB schema from $SPICEDB_SCHEMA_FILE..."
SPICEDB_ENDPOINT="$SPICEDB_ENDPOINT" \
SPICEDB_TOKEN="$SPICEDB_TOKEN" \
  cargo run -q -p medbrains-authz --bin spicedb-schema-write -- "$SPICEDB_SCHEMA_FILE"

# Stamped only after a successful write — `set -e` means a failure never gets
# here, so a broken run cannot mark itself done and be skipped next time.
mkdir -p "$(dirname "$STAMP_FILE")"
printf '%s' "$want" > "$STAMP_FILE"

echo "Local SpiceDB schema ready at $SPICEDB_ENDPOINT."
