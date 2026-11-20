#!/usr/bin/env bash
# migrate-docker-postgres-to-native.sh — move an existing standalone install
# from the old kit's Postgres container (medbrains-postgres, postgres:17-alpine)
# to the native PostgreSQL 17 cluster the kit now runs (native-postgres.sh).
#
#   sudo bash migrate-docker-postgres-to-native.sh --dry-run   # every check, no change
#   sudo bash migrate-docker-postgres-to-native.sh             # the move
#
# Logical copy only (pg_dumpall --globals-only + pg_dump -Fc), never the data
# directory: the container is musl, the host glibc, and their en_US.utf8
# collations sort text differently, so copied btree indexes would be silently
# wrong. pg_restore builds every index fresh under glibc; amcheck proves them.
#
# Order, chosen so the hospital is down only between steps 4 and 8:
#   1 preflight: versions, databases, password hashes, disk, newest backup
#   2 a fresh backup through medbrains-pg-backup.service
#   3 native PostgreSQL 17 installed on TEMP_PORT (5433) beside the container
#   4 writers stopped: medbrains-server, -edge, -archive, every medbrains timer
#   5 dump from the container, restore into native, ANALYZE
#   6 verify: per-table row counts, sequences, extensions, RLS policies, roles,
#     indexes/constraints/triggers equal on both sides; amcheck on every btree
#     index; every role in /etc/medbrains/env logs in with its own password
#   7 switch: the container is stopped and set --restart=no (kept, volume
#     untouched), native moves to 5432; the URLs do not change
#   8 the kit's native-only scripts and units installed, writers restarted,
#     /api/health checked, one backup taken
#
# Fails safe: any failure before step 7 restarts the writers on the container,
# which was never changed. A failure while switching puts the container back.
# After the switch nothing is undone automatically; the rollback commands are
# printed at the start and the end, and written to the log.
#
# Re-runnable: a run that stopped part way starts the copy again from the
# container (the native copy is replaced; the container is the truth until
# the switch). After a completed switch it only re-checks and re-starts.
# Never removes docker, the container or its volume: that is a later step,
# after a week of good backups (docs/ops/BACKUP-RESTORE.md).

set -euo pipefail

DRY_RUN=0
case "${1:-}" in
    --dry-run) DRY_RUN=1 ;;
    "") ;;
    *) echo "usage: $0 [--dry-run]" >&2; exit 2 ;;
esac
[[ $EUID -eq 0 ]] || { echo "run as root" >&2; exit 1; }

HERE="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=./native-postgres.sh
. "$HERE/native-postgres.sh"
CONTAINER="${CONTAINER:-medbrains-postgres}"
TEMP_PORT="${TEMP_PORT:-5433}"
ENV_FILE=/etc/medbrains/env
WORK=/var/lib/medbrains-migrate
LOG="/var/log/medbrains-migrate-$(date -u +%Y%m%dT%H%M%SZ).log"
umask 077
exec > >(tee -a "$LOG") 2>&1
STAGE=check

# A step heading, an error that stops the run, and one value from the env file.
say() { echo "==> $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }
env_get() { awk -F= -v k="$1" '$1 == k { v = substr($0, index($0, "=") + 1) } END { print v }' "$ENV_FILE"; }
PGUSER_CT="$(awk -F= '$1 == "POSTGRES_USER" { print $2 }' /etc/medbrains/.compose-env 2>/dev/null || true)"
PGUSER_CT="${PGUSER_CT:-medbrains}"

# SQL in the container, as its superuser, over its socket.
ct_sql() { docker exec -i "$CONTAINER" psql -X -q -At -v ON_ERROR_STOP=1 -U "$PGUSER_CT" "$@"; }
# SQL on the native cluster, as postgres, over the socket.
nat_sql() { local port="$1"; shift; pg_native_psql "$port" -At "$@"; }

# The commands that put the container back, for the services this host has.
rollback_text() {
    local svc
    svc="$(for u in medbrains-server.service medbrains-edge.service; do
        if systemctl cat "$u" >/dev/null 2>&1; then printf '%s ' "$u"; fi; done)"
    cat <<EOF
ROLLBACK (writes made on the native cluster after the switch are lost):
  sudo systemctl stop $svc
  sudo systemctl disable --now $PG_UNIT
  sudo docker update --restart=unless-stopped $CONTAINER
  sudo docker start $CONTAINER
  sudo tar -C / -xf $WORK/prev-tooling.tar      # the old container-aware scripts and units
  sudo systemctl daemon-reload
  sudo systemctl start $svc
  curl -fsS http://127.0.0.1:$(env_get PORT | grep . || echo 3000)/api/health
EOF
}

# The writers this run stopped come back, in either direction.
# reset-failed first: each run stops and starts the server once, and its
# StartLimitBurst would otherwise refuse the start after a few re-runs,
# leaving the hospital down behind a "start-limit-hit".
start_writers() {
    local u bad=""
    while read -r u; do
        [[ -n "$u" ]] || continue
        systemctl reset-failed "$u" 2>/dev/null || true
        systemctl start "$u" || bad+=" $u"
    done < "$WORK/units.active"
    [[ -z "$bad" ]] || echo "ERROR: did not start:$bad — systemctl status$bad" >&2
}

# On failure, undoes what the stage reached allows undoing: writers back on
# the untouched container before the switch, the container back during it,
# and after it only the rollback commands (native may hold new writes).
on_exit() {
    local rc=$?
    [[ $rc -eq 0 ]] && return
    case "$STAGE" in
        stopped)
            echo "FAILED before the switch: restarting the writers on the container (unchanged)." >&2
            start_writers ;;
        switching)
            echo "FAILED while switching: putting the container back on 5432." >&2
            systemctl stop "$PG_UNIT" || true
            docker update --restart=unless-stopped "$CONTAINER" >/dev/null || true
            docker start "$CONTAINER" >/dev/null || true
            start_writers ;;
        switched) rollback_text >&2 ;;
    esac
    echo "log: $LOG" >&2
}
trap on_exit EXIT
# A failing command under set -e says which one, in the log.
trap 'echo "ERROR: line $LINENO: $BASH_COMMAND" >&2' ERR

# One line per fact, sorted, identical on both sides when the copy is whole.
# Superuser on both, so row level security filters nothing.
FINGERPRINT_SQL=$(cat <<'SQL'
SELECT x FROM (
  SELECT 'rows|' || n.nspname || '.' || c.relname || '|' ||
         (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM ONLY %I.%I',
                n.nspname, c.relname), false, true, '')))[1]::text AS x
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE c.relkind = 'r' AND n.nspname NOT IN ('pg_catalog', 'information_schema')
         AND n.nspname NOT LIKE 'pg\_toast%'
  UNION ALL SELECT 'seq|' || schemaname || '.' || sequencename || '|' || coalesce(last_value::text, 'unused') FROM pg_sequences
  UNION ALL SELECT 'ext|' || extname || '|' || extversion FROM pg_extension
  UNION ALL SELECT 'policies|' || count(*) FROM pg_policies
  UNION ALL SELECT 'rls_tables|' || count(*) FILTER (WHERE relrowsecurity) || '|forced|' || count(*) FILTER (WHERE relforcerowsecurity) FROM pg_class
  UNION ALL SELECT 'role|' || rolname || '|' || concat_ws(',', rolsuper, rolinherit, rolcreaterole, rolcreatedb,
                   rolcanlogin, rolreplication, rolbypassrls, rolconnlimit) FROM pg_roles
             WHERE rolname !~ '^pg_' AND rolname <> 'postgres'
  UNION ALL SELECT 'member|' || r.rolname || '|' || m.rolname || '|' || a.admin_option || ',' || a.inherit_option
              FROM pg_auth_members a JOIN pg_roles r ON r.oid = a.roleid JOIN pg_roles m ON m.oid = a.member
             WHERE r.rolname !~ '^pg_'
  UNION ALL SELECT 'setting|' || coalesce(r.rolname, '*') || '|' || coalesce(d.datname, '*') || '|' || array_to_string(s.setconfig, ',')
              FROM pg_db_role_setting s LEFT JOIN pg_roles r ON r.oid = s.setrole LEFT JOIN pg_database d ON d.oid = s.setdatabase
  UNION ALL SELECT 'indexes|' || count(*) FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
             JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname NOT IN ('pg_catalog', 'pg_toast', 'information_schema')
  UNION ALL SELECT 'constraints|' || count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
             WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
  UNION ALL SELECT 'triggers|' || count(*) FROM pg_trigger WHERE NOT tgisinternal
  UNION ALL SELECT 'functions|' || count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
) f ORDER BY x COLLATE "C";
SQL
)
# Every valid btree index (partitioned parents have no storage; their
# partitions' indexes are checked), heap included: a glibc-built index that disagrees
# with its table, or a table with rows no index finds, raises an error here.
AMCHECK_SQL=$(cat <<'SQL'
CREATE EXTENSION IF NOT EXISTS amcheck;
SELECT count(bt_index_check(index => c.oid, heapallindexed => true))
  FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid JOIN pg_am a ON a.oid = c.relam
 WHERE a.amname = 'btree' AND c.relkind = 'i' AND i.indisvalid AND i.indisready AND c.relpersistence <> 't';
SQL
)

# ── 1. preflight ──────────────────────────────────────────────────────
say "preflight (log: $LOG)"
command -v docker >/dev/null || die "docker is not installed: nothing to migrate from"
[[ -r "$ENV_FILE" ]] || die "no $ENV_FILE"
rollback_text
for key in DATABASE_URL MIGRATION_DATABASE_URL WORKER_DATABASE_URL REPORT_DATABASE_URL; do
    url="$(env_get "$key")"
    [[ -z "$url" || "$url" == *@127.0.0.1:5432/* || "$url" == *@localhost:5432/* ]] \
        || die "$key does not point at 127.0.0.1:5432; this script only moves the local container"
done
native_port="$(pg_conftool -s "$PG_MAJOR" "$PG_CLUSTER" show port 2>/dev/null || true)"
if [[ "$native_port" == 5432 && -s "$PG_MARKER" ]] && ! docker ps -q --filter "name=^${CONTAINER}$" | grep -q .; then
    say "already switched: native $PG_UNIT on 5432, $CONTAINER stopped"
    STAGE=switched
else
    docker ps -q --filter "name=^${CONTAINER}$" | grep -q . || die "container $CONTAINER is not running"
    [[ -z "$native_port" || -s "$PG_MARKER" ]] || die "a cluster $PG_MAJOR/$PG_CLUSTER exists that MedBrains did not make"
    ver="$(ct_sql -d postgres -c 'SHOW server_version_num')"
    (( ver / 10000 == PG_MAJOR )) || die "container runs PostgreSQL $ver, this script moves $PG_MAJOR only"
    # Its pg_dump/pg_dumpall make the copy, so the security floor applies to them too.
    (( ver >= PG_MIN_VERSION_NUM )) \
        || die "container runs $((ver / 10000)).$((ver % 10000)), below the floor $((PG_MIN_VERSION_NUM / 10000)).$((PG_MIN_VERSION_NUM % 10000)); pull the newer postgres:$PG_MAJOR-alpine first"
    others="$(ct_sql -d postgres -c "SELECT string_agg(datname, ' ') FROM pg_database WHERE datname NOT IN ('medbrains', 'postgres', 'template0', 'template1')")"
    [[ -z "$others" ]] || die "the container also holds databases: $others — move them by hand first"
    [[ "$(ct_sql -d postgres -c 'SHOW archive_mode')" == off ]] \
        || die "WAL archiving is on in the container; turn PITR off first, set it up again on native"
    weak="$(ct_sql -d postgres -c "SELECT string_agg(rolname, ' ') FROM pg_authid WHERE rolcanlogin AND rolpassword IS NOT NULL AND rolpassword NOT LIKE 'SCRAM-SHA-256\$%'")"
    [[ -z "$weak" ]] || die "roles with non-SCRAM passwords (cannot log in under scram-sha-256): $weak. Re-set them: ALTER ROLE … PASSWORD …"
    size="$(ct_sql -d postgres -c "SELECT pg_database_size('medbrains')")"
    need=$(( size * 3 / 1024 + 2 * 1048576 ))
    free="$(df -Pk /var/lib | awk 'NR == 2 {print $4}')"
    (( free > need )) || die "not enough disk on /var/lib: $((free / 1024)) MB free, need $((need / 1024)) MB"
    if [[ "$native_port" != "$TEMP_PORT" ]] && ss -Hltn "sport = :$TEMP_PORT" | grep -q .; then
        die "port $TEMP_PORT is in use; set TEMP_PORT to a free one"
    fi
    last="$(ct_sql -d medbrains -c "SELECT status || '|' || extract(epoch FROM now() - started_at)::int FROM backup_history WHERE backup_type = 'pg_dump' ORDER BY started_at DESC LIMIT 1")"
    [[ "${last%|*}" == completed && "${last#*|}" -lt 93600 ]] \
        || die "the newest backup is not a completed one from the last 26 hours ($last); fix backups first"
    curl -fsSI --max-time 10 "https://apt.postgresql.org/pub/repos/apt/dists/$(. /etc/os-release && echo "$VERSION_CODENAME")-pgdg/Release" >/dev/null \
        || die "cannot reach apt.postgresql.org"
    echo "    container PostgreSQL $((ver / 10000)).$((ver % 10000)), database $((size / 1048576)) MB, $((free / 1048576)) GB free, newest backup ${last#*|} s old"
fi
if [[ "$DRY_RUN" == 1 ]]; then
    [[ "$STAGE" == switched ]] || ct_sql -d medbrains -c "$FINGERPRINT_SQL" | cut -d'|' -f1 | sort | uniq -c
    say "dry run: every check passed, nothing changed"
    exit 0
fi
install -d -m 0700 "$WORK"

if [[ "$STAGE" != switched ]]; then
    # ── 2. fresh backup, 3. native beside the container ───────────────
    say "fresh backup through medbrains-pg-backup.service"
    systemctl start medbrains-pg-backup.service
    say "installing PostgreSQL $PG_MAJOR on $TEMP_PORT"
    pg_native_install "$TEMP_PORT"

    # ── 4. stop the writers ───────────────────────────────────────────
    [[ -f "$WORK/units.active" ]] || {
        systemctl list-units --state=active --no-legend --plain 'medbrains-*.timer' | awk '{print $1}'
        for u in medbrains-server.service medbrains-edge.service; do systemctl is-active --quiet "$u" && echo "$u"; done
    } > "$WORK/units.active"
    say "stopping writers: $(tr '\n' ' ' < "$WORK/units.active")"
    STAGE=stopped
    # shellcheck disable=SC2046
    systemctl stop $(cat "$WORK/units.active") medbrains-archive.service medbrains-pg-backup.service 2>/dev/null || true
    # A stopped client's backend lives on until its query ends (Postgres
    # notices a gone client only when it next reads or writes). After 10 s
    # those are ended; a session that comes back is a writer this script
    # does not know about, and the copy would miss its rows.
    busy_sql="SELECT string_agg(usename || '/' || coalesce(nullif(application_name, ''), '?') || '@' || coalesce(client_addr::text, 'socket'), ' ')
                FROM pg_stat_activity WHERE datname = 'medbrains' AND pid <> pg_backend_pid()"
    for _ in $(seq 1 10); do
        busy="$(ct_sql -d postgres -c "$busy_sql")"; [[ -z "$busy" ]] && break; sleep 1
    done
    if [[ -n "$busy" ]]; then
        echo "    ending sessions left by stopped clients: $busy"
        ct_sql -d postgres -c "SELECT count(pg_terminate_backend(pid)) FROM pg_stat_activity WHERE datname = 'medbrains' AND pid <> pg_backend_pid()" >/dev/null
        sleep 5
        busy="$(ct_sql -d postgres -c "$busy_sql")"
        [[ -z "$busy" ]] || die "something reconnected to medbrains after the writers stopped: $busy"
    fi

    # ── 5. dump, restore ──────────────────────────────────────────────
    say "dumping from $CONTAINER"
    docker exec "$CONTAINER" pg_dumpall -U "$PGUSER_CT" --globals-only > "$WORK/globals.sql"
    docker exec "$CONTAINER" pg_dump -U "$PGUSER_CT" -d medbrains -Fc > "$WORK/medbrains.dump"
    chgrp postgres "$WORK" "$WORK/globals.sql" "$WORK/medbrains.dump"
    chmod 0750 "$WORK"; chmod 0640 "$WORK/globals.sql" "$WORK/medbrains.dump"
    ct_sql -d medbrains -c "$FINGERPRINT_SQL" > "$WORK/source.fp"

    say "restoring into native ($TEMP_PORT)"
    nat_sql "$TEMP_PORT" -d postgres -c 'DROP DATABASE IF EXISTS medbrains WITH (FORCE)' >/dev/null
    # Roles keep their SCRAM hashes, so every password in the env still works.
    # CREATE ROLE is made re-runnable; the postgres role is the native one's.
    # The container's bootstrap superuser granted every membership; here the
    # bootstrap superuser is postgres, and PostgreSQL 16+ refuses GRANTED BY a
    # superuser that is not the bootstrap one, so those grants are re-made by
    # postgres (the same meaning: granted by the cluster's bootstrap role).
    # shellcheck disable=SC2016 # $mb$ is SQL dollar quoting, not a shell variable
    sed -E -e '/^(CREATE|ALTER) ROLE postgres[ ;]/d' \
        -e 's/^CREATE ROLE (.+);$/DO $mb$ BEGIN CREATE ROLE \1; EXCEPTION WHEN duplicate_object THEN NULL; END $mb$;/' \
        -e "s/^(GRANT .*) GRANTED BY \"?${PGUSER_CT}\"?;\$/\\1;/" \
        "$WORK/globals.sql" | nat_sql "$TEMP_PORT" -d postgres >/dev/null
    pg_native_database "$TEMP_PORT" medbrains
    runuser -u postgres -- "$PG_BIN/pg_restore" -p "$TEMP_PORT" -d medbrains --exit-on-error < "$WORK/medbrains.dump"
    runuser -u postgres -- "$PG_BIN/vacuumdb" -p "$TEMP_PORT" -d medbrains --analyze-only -q

    # ── 6. verify ─────────────────────────────────────────────────────
    say "verifying"
    nat_sql "$TEMP_PORT" -d medbrains -c "$FINGERPRINT_SQL" > "$WORK/target.fp"
    if ! diff "$WORK/source.fp" "$WORK/target.fp"; then
        die "the native copy differs from the container (diff above; < container, > native)"
    fi
    echo "    identical: $(grep -c '^rows|' "$WORK/source.fp") tables' row counts, $(grep -c '^seq|' "$WORK/source.fp") sequences, $(grep '^policies|' "$WORK/source.fp"), extensions $(grep '^ext|' "$WORK/source.fp" | cut -d'|' -f2 | tr '\n' ' ')"
    checked="$(nat_sql "$TEMP_PORT" -d medbrains -c "$AMCHECK_SQL" | tail -1)"
    nat_sql "$TEMP_PORT" -d medbrains -c 'DROP EXTENSION amcheck' >/dev/null
    echo "    amcheck: $checked btree indexes consistent with their tables"
    for key in DATABASE_URL MIGRATION_DATABASE_URL WORKER_DATABASE_URL REPORT_DATABASE_URL; do
        url="$(env_get "$key")"; [[ -n "$url" ]] || continue
        pw="$(sed -nE 's|^[a-z]+://[^:@/]*:([^@]*)@.*$|\1|p' <<<"$url")"
        nopw="$(sed -E -e 's|^([a-z]+://[^:@/]*):[^@]*@|\1@|' -e "s|:5432/|:$TEMP_PORT/|" <<<"$url")"
        PGPASSWORD="$pw" "$PG_BIN/psql" -X -q -At -c 'SELECT 1' "$nopw" >/dev/null \
            || die "$key's role cannot log in to the native copy"
    done
    echo "    every role in $ENV_FILE logs in with its own password"

    # ── 7. switch ─────────────────────────────────────────────────────
    say "switching: $CONTAINER stopped (kept), native to 5432"
    STAGE=switching
    docker update --restart=no "$CONTAINER" >/dev/null
    docker stop "$CONTAINER" >/dev/null
    ! ss -Hltn 'sport = :5432' | grep -q . || die "5432 is still taken after stopping $CONTAINER"
    pg_native_config 5432
    systemctl restart "$PG_UNIT"
    pg_native_wait 5432
    STAGE=switched
    rm -f "$WORK/globals.sql" "$WORK/medbrains.dump"
fi

# ── 8. native-only tooling, writers back, health, one backup ──────────
TOOLS=(medbrains-pg-backup medbrains-backup-report medbrains-daily-report medbrains-host-check
       medbrains-tenant-export medbrains-restore-test medbrains-wal-g)
UNITS=(medbrains-server.service medbrains-pg-backup.service medbrains-restore-test.service
       medbrains-tenant-export.service medbrains-backup-report@.service medbrains-daily-report.service
       medbrains-host-check.service medbrains-wal-g-backup.service medbrains-wal-push.service)
if [[ ! -f "$WORK/prev-tooling.tar" ]]; then
    prev=()
    for t in "${TOOLS[@]}"; do [[ -f "/usr/local/bin/$t" ]] && prev+=("usr/local/bin/$t"); done
    for u in "${UNITS[@]}"; do [[ -f "/etc/systemd/system/$u" ]] && prev+=("etc/systemd/system/$u"); done
    tar -C / -cf "$WORK/prev-tooling.tar" "${prev[@]}"
fi
for t in "${TOOLS[@]}"; do install -m 0755 "$HERE/$t" "/usr/local/bin/$t"; done
for u in "${UNITS[@]}"; do install -m 0644 "$HERE/$u" "/etc/systemd/system/$u"; done
systemctl daemon-reload
say "starting writers"
start_writers
port="$(env_get PORT)"
for _ in $(seq 1 30); do
    curl -fsS --max-time 3 "http://127.0.0.1:${port:-3000}/api/health" >/dev/null 2>&1 && break
    sleep 2
done
curl -fsS --max-time 3 "http://127.0.0.1:${port:-3000}/api/health" >/dev/null || die "/api/health does not answer"
sessions="$(nat_sql 5432 -d postgres -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'medbrains'")"
(( sessions > 0 )) || die "/api/health answers but nothing is connected to the native cluster"
echo "    /api/health ok, $sessions sessions on the native cluster"
if [[ -n "$(env_get BACKUP_BUCKET)$(env_get BACKUP_DIR)" ]]; then
    say "one backup from the native cluster"
    systemctl start medbrains-pg-backup.service || die "the first native backup failed: journalctl -u medbrains-pg-backup"
fi
say "done. $CONTAINER is stopped with --restart=no and its volume is untouched."
echo "    Remove docker and the volume only after a week of good backups."
rollback_text
