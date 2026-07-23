#!/usr/bin/env bash
#
# Build a migrated schema database by applying every migration in order.
#
# `prepare-sqlx` and `check-sqlx` both need a database that already carries the
# schema, and `smoke-test` needs one behind a running backend, but nothing
# created one — the only path was `make db`, which needs Docker. This applies
# the same migrations directly, so any reachable PostgreSQL will do.
#
# The database is dropped and rebuilt, so it is for schema work only. The
# production guard lives in the Makefile target; this script refuses a
# non-local host on its own as well, since a wrong argument here is destructive.
#
#   make schema-db
#   SQLX_DATABASE_URL=postgres://me@127.0.0.1:5432/mb_schema make schema-db

set -euo pipefail

URL="${1:?usage: schema_db.sh <postgres-url>}"
MIGRATIONS="$(cd "$(dirname "$0")/.." && pwd)/crates/medbrains-db/src/migrations"

host="$(printf '%s' "$URL" | sed -E 's|.*@([^:/]+).*|\1|')"
case "$host" in
    localhost | 127.0.0.1 | ::1 | "$URL") ;;
    *)
        echo "refusing to drop and rebuild a database on '$host' — local hosts only" >&2
        exit 1
        ;;
esac

name="$(printf '%s' "$URL" | sed -E 's|.*/([^/?]+).*|\1|')"
admin="${URL%/*}/postgres"

echo "rebuilding $name"
psql "$admin" -qtAc "DROP DATABASE IF EXISTS \"$name\" WITH (FORCE)"
psql "$admin" -qtAc "CREATE DATABASE \"$name\""

# Applied through sqlx rather than psql so `_sqlx_migrations` is populated.
# Feeding the files to psql directly leaves that table empty, and the server
# runs `sqlx::migrate!()` at boot — it would try to replay migration 1 and die
# on "type already exists".
DATABASE_URL="$URL" sqlx migrate run --source "$MIGRATIONS"

echo "migrated $name"
