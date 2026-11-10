#!/usr/bin/env bash
# shellcheck disable=SC2015 # ok/bad always return 0, so A && ok || bad is if/else
# End-to-end proof of the encrypted backup + restore drill, on a laptop:
# a throwaway Postgres 17 container, a throwaway age key, and a local
# directory standing in for the S3 bucket (`aws` stubbed onto it).
#
#   bash deploy/standalone/test-backup-drill-e2e.sh
#
# Proves: the object that leaves the host is age ciphertext (no pg_dump
# magic, no secret values, pg_restore cannot read it, the wrong key cannot
# open it); S3 refuses to be used without a key; each run is recorded in
# backup_history; the drill restores it to identical row counts and lists
# the sealed secrets by name only; a tampered object fails the drill.
# Needs docker, age, and pg_dump/pg_restore/psql 17 on PATH.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d)"
NAME="mb-backup-e2e-$$"
trap 'docker rm -f "$NAME" >/dev/null 2>&1; rm -rf "$TMP"' EXIT

fail=0
ok()  { echo "ok   $1"; }
bad() { echo "FAIL $1"; fail=1; }
for tool in docker age age-keygen pg_dump pg_restore psql; do
    command -v "$tool" >/dev/null || { echo "SKIP: $tool not on PATH"; exit 0; }
done

# ── fixtures ──────────────────────────────────────────────────────────
age-keygen -o "$TMP/key.txt" 2>/dev/null
age-keygen -y "$TMP/key.txt" > "$TMP/recipients.txt"
age-keygen -o "$TMP/wrong.txt" 2>/dev/null
mkdir -p "$TMP/etc/medbrains" "$TMP/s3" "$TMP/bin"
echo "MEDBRAINS_IDENTIFIER_HMAC_KEY=e2e-secret-value-do-not-leak" > "$TMP/etc/medbrains/env"

docker run -d --name "$NAME" -e POSTGRES_PASSWORD=e2e -p 127.0.0.1::5432 postgres:17-alpine >/dev/null
PORT="$(docker port "$NAME" 5432/tcp | head -1 | sed 's/.*://')"
SERVER="postgres://postgres:e2e@127.0.0.1:${PORT}"
for _ in $(seq 1 60); do psql -XAq "$SERVER/postgres" -c 'SELECT 1' >/dev/null 2>&1 && break; sleep 1; done
psql -XAq -v ON_ERROR_STOP=1 "$SERVER/postgres" -c 'CREATE DATABASE medbrains' >/dev/null
SRC="$SERVER/medbrains"
psql -XAq -v ON_ERROR_STOP=1 "$SRC" >/dev/null <<'SQL'
CREATE ROLE medbrains_app NOLOGIN;
CREATE TABLE tenants (id serial PRIMARY KEY, name text);
CREATE TABLE users (id serial PRIMARY KEY, tenant_id int REFERENCES tenants, name text);
CREATE TABLE patients (id serial PRIMARY KEY, tenant_id int REFERENCES tenants, name text);
CREATE TABLE audit_log (id serial PRIMARY KEY, created_at timestamptz DEFAULT now());
CREATE TABLE _sqlx_migrations (version bigint PRIMARY KEY, success boolean NOT NULL);
CREATE TABLE backup_history (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY, tenant_id uuid, backup_type text NOT NULL,
    backup_name text NOT NULL, file_path text, file_size_bytes bigint, status text,
    started_at timestamptz DEFAULT now() NOT NULL, completed_at timestamptz,
    retention_days int, expires_at timestamptz, error_message text,
    created_at timestamptz DEFAULT now() NOT NULL);
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON patients TO medbrains_app USING (true);
GRANT SELECT ON ALL TABLES IN SCHEMA public TO medbrains_app;
INSERT INTO tenants (name) SELECT 'tenant ' || g FROM generate_series(1, 3) g;
INSERT INTO users (tenant_id, name) SELECT 1 + g % 3, 'user ' || g FROM generate_series(1, 250) g;
INSERT INTO patients (tenant_id, name) SELECT 1 + g % 3, 'patient ' || g FROM generate_series(1, 4000) g;
INSERT INTO audit_log SELECT g FROM generate_series(1, 9000) g;
INSERT INTO _sqlx_migrations VALUES (1, true), (2, true), (1222, true);
SQL

# `aws` onto a directory: cp - <url> writes, ls <url-prefix> lists like S3.
cat > "$TMP/bin/aws" <<STUB
#!/usr/bin/env bash
root="$TMP/s3"
case "\$1 \$2" in
  "s3 cp")  [[ "\$3" == "-" ]] || exit 9
            dest="\$root/\${4#s3://*/}"; mkdir -p "\$(dirname "\$dest")"; cat > "\$dest" ;;
  "s3 ls")  p="\${3#s3://*/}"; found=1
            for f in \$(cd "\$root" && find . -type f | sed 's#^\./##' | sort); do
              [[ "\$f" == "\$p"* ]] || continue
              echo "\$(date -u '+%Y-%m-%d %H:%M:%S') \$(wc -c < "\$root/\$f" | tr -d ' ') \${f##*/}"; found=0
            done; exit \$found ;;
  *) exit 0 ;;
esac
STUB
chmod +x "$TMP/bin/aws"

backup() { # backup [extra env...]
    env -i PATH="$TMP/bin:$PATH" HOME="$TMP" POSTGRES_USER=postgres POSTGRES_DB=medbrains \
        DATABASE_URL="$SRC" BACKUP_BUCKET=bkt BACKUP_FILES_ROOTS="$TMP/no-files" \
        BACKUP_AGE_RECIPIENTS_FILE="$TMP/recipients.txt" BACKUP_SECRETS_DIR="$TMP/etc/medbrains" \
        "$@" bash "$HERE/medbrains-pg-backup" 2>&1
}
host="$(hostname)"

# ── 1. without a key, S3 is refused and the refusal is recorded ───────
out="$(backup BACKUP_AGE_RECIPIENTS_FILE="$TMP/none.txt")"; rc=$?
if [[ $rc -ne 0 && "$out" == *"refusing to send an unencrypted dump"* && -z "$(find "$TMP/s3" -type f)" ]]; then
    ok "S3 without a public key: refused, nothing uploaded"
else bad "S3 without a public key (rc=$rc): $out"; fi

# ── 2. two runs: first of the month goes monthly, the next daily ──────
out1="$(backup)"; rc1=$?
out2="$(backup)"; rc2=$?
monthly="$(find "$TMP/s3/pg-backups-monthly/$host" -name '*.dump.age' 2>/dev/null | head -1)"
daily="$(find "$TMP/s3/pg-backups/$host" -name '*.dump.age' 2>/dev/null | head -1)"
if [[ $rc1 -eq 0 && $rc2 -eq 0 && -n "$monthly" && -n "$daily" ]]; then
    ok "first run → pg-backups-monthly/, second → pg-backups/ (both .dump.age)"
else bad "runs (rc=$rc1/$rc2): $out1 // $out2"; fi

# ── 3. what left the host is ciphertext ───────────────────────────────
[[ "$(head -c 21 "$daily")" == "age-encryption.org/v1" ]] && ok "object is an age file" || bad "object is an age file"
grep -q PGDMP "$daily" && bad "pg_dump magic visible in the object" || ok "no pg_dump magic in the object"
pg_restore --list "$daily" >/dev/null 2>&1 && bad "pg_restore read the object" || ok "pg_restore cannot read the object"
age -d -i "$TMP/wrong.txt" "$daily" >/dev/null 2>&1 && bad "wrong key opened it" || ok "the wrong key cannot open it"
secrets="$(find "$TMP/s3/secrets-backups/$host" -name '*.tar.age' | head -1)"
if [[ -n "$secrets" ]] && ! grep -q e2e-secret-value "$secrets"; then
    ok "secrets archive sealed (value not in the object)"
else bad "secrets archive sealed"; fi

# ── 4. every run is recorded for System health ────────────────────────
hist="$(psql -XAt "$SRC" -c "SELECT string_agg(status, ',' ORDER BY created_at) FROM backup_history")"
[[ "$hist" == "failed,completed,completed" ]] && ok "backup_history: failed,completed,completed" || bad "backup_history: $hist"

# ── 5. the drill restores to identical counts ─────────────────────────
counts() {
    psql -XAt -F $'\t' "$1" <<'SQL'
SELECT table_name,
       (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM public.%I', table_name), false, true, '')))[1]::text::bigint
  FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 1
SQL
}
drill="$(PATH="$TMP/bin:$PATH" bash "$HERE/medbrains-restore-drill" --from "$TMP/s3/pg-backups/$host" \
    --identity "$TMP/key.txt" --target-url "$SERVER/postgres" \
    --secrets-from "$TMP/s3/secrets-backups/$host" --counts-out "$TMP/restored.tsv" 2>&1)"; rc=$?
[[ $rc -eq 0 && "$drill" == *"RESTORE DRILL PASSED"* ]] && ok "drill passes" || bad "drill passes (rc=$rc): $drill"
# backup_history gains a row after each dump, so it differs by design.
if diff <(counts "$SRC" | grep -v '^backup_history') <(grep -v '^backup_history' "$TMP/restored.tsv") >/dev/null; then
    ok "restored row counts identical to the source ($(wc -l < "$TMP/restored.tsv" | tr -d ' ') tables)"
else bad "restored row counts differ: $(diff <(counts "$SRC") "$TMP/restored.tsv")"; fi
[[ "$drill" == *"grants restored"* ]] && ok "drill checked medbrains_app grants" || bad "drill checked medbrains_app grants"
if [[ "$drill" == *MEDBRAINS_IDENTIFIER_HMAC_KEY* && "$drill" != *e2e-secret-value* ]]; then
    ok "drill lists secret names, never values"
else bad "drill secrets listing: $drill"; fi
[[ -z "$(psql -XAt "$SERVER/postgres" -c "SELECT datname FROM pg_database WHERE datname LIKE 'medbrains_drill_%'")" ]] \
    && ok "drill dropped its scratch database" || bad "drill left a scratch database"

# ── 6. with no --target-url the drill brings its own Postgres 17 ──────
drill="$(PATH="$TMP/bin:$PATH" bash "$HERE/medbrains-restore-drill" --from "$monthly" --identity "$TMP/key.txt" 2>&1)"; rc=$?
if [[ $rc -eq 0 && "$drill" == *"RESTORE DRILL PASSED"* ]] \
    && [[ -z "$(docker ps -aq --filter name=medbrains-restore-drill-)" ]]; then
    ok "drill in its own throwaway container passes and removes it"
else bad "drill in its own container (rc=$rc): $drill"; fi

# ── 7. a tampered object fails the drill ──────────────────────────────
cp "$daily" "$TMP/tampered.dump.age"
size="$(wc -c < "$TMP/tampered.dump.age" | tr -d ' ')"
printf 'X' | dd of="$TMP/tampered.dump.age" bs=1 seek=$((size - 100)) conv=notrunc 2>/dev/null
PATH="$TMP/bin:$PATH" bash "$HERE/medbrains-restore-drill" --from "$TMP/tampered.dump.age" \
    --identity "$TMP/key.txt" --target-url "$SERVER/postgres" >/dev/null 2>&1 \
    && bad "tampered object passed the drill" || ok "tampered object fails the drill"

exit "$fail"
