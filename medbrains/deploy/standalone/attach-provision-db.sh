#!/usr/bin/env bash
# Create the dedicated Postgres role for an attach deploy, and record the
# connection string where terraform reads it.
#
#   ./attach-provision-db.sh                 # show what it would do
#   ./attach-provision-db.sh --apply         # create the role, write the URL
#
# Why a dedicated role rather than reusing one that already works: on an
# attached host the existing accounts own somebody else's data. The box this
# was written for runs an ERP whose `alagappa_admin` owns two databases and
# 390,000 marks rows. Handing that account to a second application means any
# bug in one can drop the other's tables, and it makes the audit question
# "who wrote this row" unanswerable.
#
# The password is generated here and written only to infra/.env, which is
# gitignored. It is never passed as a command argument - arguments are visible
# in `ps` to every user on the machine and are echoed by SSM into CloudWatch.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${ENV_FILE:-$HERE/../../infra/.env}"
INSTANCE_ID="${INSTANCE_ID:-i-08e9496a3e110ebdc}"
DB_NAME="${DB_NAME:-medbrains}"
DB_USER="${DB_USER:-medbrains}"
APPLY=0
[[ "${1:-}" == "--apply" ]] && APPLY=1

command -v aws >/dev/null || { echo "aws cli not found"; exit 1; }

if grep -q '^TF_VAR_attach_database_url=' "$ENV_FILE" 2>/dev/null; then
    echo "TF_VAR_attach_database_url is already set in $ENV_FILE."
    echo "Delete that line first if you intend to re-provision."
    exit 0
fi

# Alphanumeric only. Postgres accepts punctuation happily; connection-string
# parsers and shell quoting are less reliable about it, and a URL-safe password
# removes a whole class of "works locally, fails on the box" problems.
#
# openssl rather than `tr -dc ... | head -c`: head closes the pipe early, tr
# takes SIGPIPE, and `set -o pipefail` turns that into a fatal error - the
# first version of this script died at exit 141 every time.
PW="$(openssl rand -base64 48 | LC_ALL=C tr -cd 'A-Za-z0-9' | cut -c1-32)"
[[ ${#PW} -eq 32 ]] || { echo "password generation failed"; exit 1; }

if [[ "$APPLY" == "0" ]]; then
    echo "dry run - nothing changed"
    echo "  instance : $INSTANCE_ID"
    echo "  role     : $DB_USER"
    echo "  database : $DB_NAME (owner $DB_USER)"
    echo "  env file : $ENV_FILE"
    echo
    echo "run with --apply to create the role and write the connection string"
    exit 0
fi

# Idempotent: Postgres has no CREATE ROLE IF NOT EXISTS, so the DO block does
# the check. Re-running resets the password rather than failing, which is what
# you want when a previous run wrote a URL you no longer have.
read -r -d '' SQL <<SQLEOF || true
DO \$\$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$DB_USER') THEN
        ALTER ROLE $DB_USER WITH LOGIN PASSWORD '$PW';
    ELSE
        CREATE ROLE $DB_USER WITH LOGIN PASSWORD '$PW';
    END IF;
END
\$\$;
SELECT 'role ready';
SQLEOF

# The SQL carries the password, so it goes to the host base64-encoded in a
# single parameter rather than as readable inline commands. SSM records the
# command text; it should not record a credential.
B64="$(printf '%s' "$SQL" | base64 | tr -d '\n')"

CID=$(aws ssm send-command \
    --instance-ids "$INSTANCE_ID" \
    --document-name AWS-RunShellScript \
    --parameters "commands=[\"echo $B64 | base64 -d | sudo -u postgres psql -v ON_ERROR_STOP=1 -q\",\"sudo -u postgres psql -tAc \\\"SELECT 1 FROM pg_database WHERE datname='$DB_NAME'\\\" | grep -q 1 || sudo -u postgres createdb -O $DB_USER $DB_NAME\",\"sudo -u postgres psql -tAc \\\"SELECT datname, pg_catalog.pg_get_userbyid(datdba) FROM pg_database WHERE datname='$DB_NAME'\\\"\"]" \
    --query Command.CommandId --output text)

for _ in $(seq 1 20); do
    ST=$(aws ssm get-command-invocation --command-id "$CID" --instance-id "$INSTANCE_ID" \
         --query Status --output text 2>/dev/null || echo Pending)
    case "$ST" in Success|Failed) break;; esac
    sleep 3
done

OUT=$(aws ssm get-command-invocation --command-id "$CID" --instance-id "$INSTANCE_ID" \
      --query StandardOutputContent --output text 2>/dev/null || true)
ERR=$(aws ssm get-command-invocation --command-id "$CID" --instance-id "$INSTANCE_ID" \
      --query StandardErrorContent --output text 2>/dev/null || true)

if [[ "$ST" != "Success" ]]; then
    echo "provisioning failed ($ST)"
    [[ -n "$ERR" ]] && echo "$ERR" | head -5
    exit 1
fi
echo "$OUT" | sed 's/^/  /'

# 127.0.0.1 rather than localhost: the app runs on the same host, and pg_hba
# rules are written against the address, not the name.
printf '\n# Written by attach-provision-db.sh. Credential - keep out of git.\nTF_VAR_attach_database_url=postgres://%s:%s@127.0.0.1:5432/%s\n' \
    "$DB_USER" "$PW" "$DB_NAME" >> "$ENV_FILE"

URL="postgres://$DB_USER:$PW@127.0.0.1:5432/$DB_NAME"

# Parameter Store is where this estate already keeps database credentials, so
# the password survives this machine and is recoverable without re-running the
# script and resetting the role.
PARAM="/medbrains/alagappa/database_url"
if aws ssm put-parameter --name "$PARAM" --type SecureString --value "$URL" \
      --overwrite >/dev/null 2>&1; then
    echo "  stored in Parameter Store: $PARAM"
else
    echo "  WARNING: could not write to Parameter Store - the copy in"
    echo "           $ENV_FILE is the only one. Back it up."
fi

echo
echo "  role and database ready; connection string appended to $ENV_FILE"
echo
echo "  ---------------- credential, shown once ----------------"
echo "    user:     $DB_USER"
echo "    database: $DB_NAME"
echo "    password: $PW"
echo "  --------------------------------------------------------"
echo "  Recover later with:"
echo "    aws ssm get-parameter --name $PARAM --with-decryption --query Parameter.Value --output text"
