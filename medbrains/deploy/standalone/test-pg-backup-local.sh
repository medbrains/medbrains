#!/usr/bin/env bash
# Runnable check for medbrains-pg-backup's local (BACKUP_DIR) destination.
# That path ends in `find -delete` over a directory of PHI dumps and runs
# as root on a host we do not own, so the guards get a test.
#
#   bash deploy/standalone/test-pg-backup-local.sh
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$HERE/medbrains-pg-backup"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Stub pg_dump so the script runs with no postgres. Real archive bytes are
# not the point here; the destination logic is.
mkdir -p "$TMP/bin"
cat > "$TMP/bin/pg_dump" <<'STUB'
#!/bin/sh
printf 'PGDMP-fake-archive'
STUB
chmod +x "$TMP/bin/pg_dump"
# Hide docker so the script takes the DATABASE_URL branch deterministically.
cat > "$TMP/bin/docker" <<'STUB'
#!/bin/sh
exit 1
STUB
chmod +x "$TMP/bin/docker"

run() { # run <BACKUP_DIR> [extra env assignments...]
    env -i PATH="$TMP/bin:/usr/bin:/bin" HOME="$TMP" \
        POSTGRES_USER=medbrains POSTGRES_DB=medbrains \
        DATABASE_URL="postgres://u:p@127.0.0.1:5432/medbrains" \
        BACKUP_DIR="$1" "${@:2}" bash "$SCRIPT" 2>&1
}

fail=0
ok()   { echo "ok   $1"; }
bad()  { echo "FAIL $1"; fail=1; }

# 1-2. Dangerous BACKUP_DIR values must be refused before any find runs.
for dangerous in / /var /etc /root relative/path ""; do
    out="$(run "$dangerous")"; rc=$?
    label="refuses BACKUP_DIR='$dangerous'"
    if [[ $rc -ne 0 ]]; then ok "$label"; else bad "$label (exited 0)"; fi
done

# 3. No destination at all is an error, not a silent skip.
out="$(env -i PATH="$TMP/bin:/usr/bin:/bin" POSTGRES_USER=u POSTGRES_DB=d \
        bash "$SCRIPT" 2>&1)"; rc=$?
if [[ $rc -ne 0 && "$out" == *"no backup destination"* ]]; then
    ok "no destination fails loudly"
else bad "no destination fails loudly (rc=$rc)"; fi

# 4. Happy path writes exactly one dump and leaves no .partial behind.
DIR="$TMP/backups/medbrains"
out="$(run "$DIR")"; rc=$?
dumps=$(find "$DIR" -maxdepth 1 -name '*.dump' 2>/dev/null | wc -l | tr -d ' ')
parts=$(find "$DIR" -maxdepth 1 -name '*.partial' 2>/dev/null | wc -l | tr -d ' ')
if [[ $rc -eq 0 && "$dumps" == "1" && "$parts" == "0" ]]; then
    ok "writes one dump, no .partial left"
else bad "writes one dump, no .partial left (rc=$rc dumps=$dumps partial=$parts): $out"; fi

# 5. The directory is not world-readable — these are patient records.
mode=$(stat -f '%Lp' "$DIR" 2>/dev/null || stat -c '%a' "$DIR")
[[ "$mode" == "700" ]] && ok "backup dir is 0700" || bad "backup dir is 0700 (got $mode)"

# 6. Retention deletes what is past the window and keeps what is inside it.
touch -t "$(date -v-40d +%Y%m%d0000 2>/dev/null || date -d '40 days ago' +%Y%m%d0000)" "$DIR/old.dump"
touch -t "$(date -v-2d  +%Y%m%d0000 2>/dev/null || date -d '2 days ago'  +%Y%m%d0000)" "$DIR/recent.dump"
run "$DIR" BACKUP_KEEP_DAYS=14 > /dev/null
[[ ! -f "$DIR/old.dump" ]]   && ok "prunes a dump past the window"  || bad "prunes a dump past the window"
[[ -f "$DIR/recent.dump" ]]  && ok "keeps a dump inside the window" || bad "keeps a dump inside the window"

# 7. A stale .partial from a died dump is cleared, not kept forever.
touch -t "$(date -v-3d +%Y%m%d0000 2>/dev/null || date -d '3 days ago' +%Y%m%d0000)" "$DIR/dead.dump.partial"
run "$DIR" > /dev/null
[[ ! -f "$DIR/dead.dump.partial" ]] && ok "clears a stale .partial" || bad "clears a stale .partial"

exit "$fail"
