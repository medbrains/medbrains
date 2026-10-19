#!/usr/bin/env bash
# make safe-prepare-sqlx — refresh .sqlx without ever losing it.
#
# `cargo sqlx prepare` clears .sqlx first; when the workspace then fails to
# compile it writes nothing back, and 189 committed files are gone. So:
# compile first and refuse on failure, back .sqlx up, and put the backup
# back if prepare fails or leaves an empty directory.
#
# Usage: scripts/safe_prepare_sqlx.sh <database-url> [cargo args...]
set -euo pipefail
cd "$(dirname "$0")/.."
db_url=${1:?database url}
shift

count() { find .sqlx -name 'query-*.json' 2>/dev/null | wc -l | tr -d ' '; }

bash scripts/build_guard.sh --wait
echo "== compile check against $db_url"
if ! SQLX_OFFLINE=false DATABASE_URL="$db_url" cargo check "$@"; then
  echo "Refusing: the workspace does not compile, so prepare would wipe .sqlx."
  exit 1
fi

backup=$(mktemp -d "${TMPDIR:-/tmp}/sqlx-backup.XXXXXX")
cp -R .sqlx "$backup/"
before=$(count)
echo "== backed up $before files to $backup/.sqlx"

restore() {
  echo "Restoring .sqlx from $backup/.sqlx ($1)"
  rm -rf .sqlx && cp -R "$backup/.sqlx" .sqlx
  exit 1
}

bash scripts/build_guard.sh --wait
SQLX_OFFLINE=false DATABASE_URL="$db_url" cargo sqlx prepare --workspace -- "$@" \
  || restore "prepare failed"
after=$(count)
[ "$after" -gt 0 ] || restore "prepare left no metadata"
echo "== .sqlx: $before -> $after files (backup kept at $backup/.sqlx)"
git status --short .sqlx | head -20
