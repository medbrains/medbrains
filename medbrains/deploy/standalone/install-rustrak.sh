#!/usr/bin/env bash
# Rustrak — the error tracker, on this host. Called by install.sh when
# INSTALL_RUSTRAK=1; safe to run again on its own:
#
#   sudo DOMAIN=hims.example.in ADMIN_EMAIL=ops@example.in bash install-rustrak.sh
#
# What it does, once, and never again on a re-run:
#   - generates Rustrak's session key and admin password into
#     /etc/medbrains/rustrak.env (root only — the HMS never reads it);
#   - starts the pinned container (docker-compose.prod.yml, profile rustrak);
#   - signs in as that admin, creates an API token and the "medbrains"
#     project, sets 30-day retention;
#   - writes SENTRY_DSN (loopback), RUSTRAK_API_TOKEN and RUSTRAK_PUBLIC_URL to
#     /etc/medbrains/env, which turns error tracking on at the next restart.
#
# The dashboard is https://errors.<domain>, served by Pingora (install.sh adds
# the route and the certificate name). No secret is printed or put in argv.

set -euo pipefail

: "${DOMAIN:?DOMAIN is required}"
: "${ADMIN_EMAIL:?ADMIN_EMAIL is required}"
ETC="${MEDBRAINS_ETC:-/etc/medbrains}"
ENV_FILE="$ETC/env"
SECRETS="$ETC/rustrak.env"
COMPOSE_ENV="$ETC/.compose-env"
PORT="${RUSTRAK_PORT:-8180}"
PUBLIC_URL="https://errors.$DOMAIN"
API="http://127.0.0.1:$PORT"
RETENTION_DAYS=30

value() {
    awk -F= -v k="$1" '$1 == k { v = substr($0, index($0, "=") + 1) } END { print v }' "$2" 2>/dev/null
}

# Replace KEY in FILE, keeping the file's mode and owner (awk + cat, not sed -i,
# so it behaves the same on every platform and with any character in a value).
set_value() {
    local key="$1" val="$2" file="$3" tmp
    tmp="$(mktemp)"
    awk -F= -v k="$key" '$1 != k' "$file" > "$tmp"
    printf '%s=%s\n' "$key" "$val" >> "$tmp"
    cat "$tmp" > "$file"
    rm -f "$tmp"
}

for tool in docker curl openssl python3; do
    command -v "$tool" >/dev/null 2>&1 || { echo "ERROR: install-rustrak.sh needs $tool"; exit 1; }
done

echo "==> Rustrak: secrets"
if [[ ! -f "$SECRETS" ]]; then
    install -m 600 /dev/null "$SECRETS"
fi
[[ -n "$(value RUSTRAK_SESSION_SECRET_KEY "$SECRETS")" ]] \
    || set_value RUSTRAK_SESSION_SECRET_KEY "$(openssl rand -hex 32)" "$SECRETS"
[[ -n "$(value RUSTRAK_ADMIN_EMAIL "$SECRETS")" ]] \
    || set_value RUSTRAK_ADMIN_EMAIL "$ADMIN_EMAIL" "$SECRETS"
[[ -n "$(value RUSTRAK_ADMIN_PASSWORD "$SECRETS")" ]] \
    || set_value RUSTRAK_ADMIN_PASSWORD "$(openssl rand -base64 24 | tr -d '/=+')" "$SECRETS"
SESSION_KEY="$(value RUSTRAK_SESSION_SECRET_KEY "$SECRETS")"
LOGIN_EMAIL="$(value RUSTRAK_ADMIN_EMAIL "$SECRETS")"
LOGIN_PASSWORD="$(value RUSTRAK_ADMIN_PASSWORD "$SECRETS")"
if [[ "${#SESSION_KEY}" -lt 64 || "${#LOGIN_PASSWORD}" -lt 16 ]]; then
    echo "ERROR: $SECRETS holds a short session key or admin password — refusing."
    exit 1
fi

echo "==> Rustrak: starting the container on 127.0.0.1:$PORT"
[[ -f "$COMPOSE_ENV" ]] || install -m 600 /dev/null "$COMPOSE_ENV"
set_value RUSTRAK_PORT "$PORT" "$COMPOSE_ENV"
set_value RUSTRAK_SESSION_SECRET_KEY "$SESSION_KEY" "$COMPOSE_ENV"
set_value RUSTRAK_CREATE_SUPERUSER "$LOGIN_EMAIL:$LOGIN_PASSWORD" "$COMPOSE_ENV"
set_value RUSTRAK_PUBLIC_URL "$PUBLIC_URL" "$COMPOSE_ENV"
docker compose --env-file "$COMPOSE_ENV" -f "$ETC/docker-compose.yml" \
    --profile rustrak up -d rustrak

for _ in $(seq 1 30); do
    curl -fsS --max-time 2 "$API/health" >/dev/null 2>&1 && break
    sleep 2
done
curl -fsS --max-time 2 "$API/health" >/dev/null || { echo "ERROR: Rustrak did not come up"; exit 1; }

if [[ -n "$(value RUSTRAK_API_TOKEN "$ENV_FILE")" && -n "$(value SENTRY_DSN "$ENV_FILE")" ]]; then
    echo "    already bootstrapped — SENTRY_DSN and RUSTRAK_API_TOKEN are set"
    exit 0
fi

echo "==> Rustrak: token, project, ${RETENTION_DAYS}-day retention"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
chmod 700 "$WORK"

# Bodies and the bearer header go through files, so no secret is in argv.
LOGIN_EMAIL="$LOGIN_EMAIL" LOGIN_PASSWORD="$LOGIN_PASSWORD" python3 -c \
    'import json, os; print(json.dumps({"email": os.environ["LOGIN_EMAIL"], "password": os.environ["LOGIN_PASSWORD"]}))' \
    > "$WORK/login.json"
curl -fsS -c "$WORK/jar" -H 'Content-Type: application/json' \
    --data-binary "@$WORK/login.json" "$API/auth/login" >/dev/null
curl -fsS -b "$WORK/jar" -H 'Content-Type: application/json' \
    -d '{"description":"medbrains-server (admin screen + source maps)"}' "$API/api/tokens" \
    | python3 -c 'import json, sys; print("Authorization: Bearer " + json.load(sys.stdin)["token"])' \
    > "$WORK/auth"

DSN="$(curl -fsS -H "@$WORK/auth" "$API/api/projects?per_page=100" | python3 -c '
import json, sys
items = json.load(sys.stdin)["items"]
print(next((p["dsn"] for p in items if p["slug"] == "medbrains"), ""))')"
if [[ -z "$DSN" ]]; then
    DSN="$(curl -fsS -H "@$WORK/auth" -H 'Content-Type: application/json' \
        -d '{"name":"MedBrains","slug":"medbrains"}' "$API/api/projects" \
        | python3 -c 'import json, sys; print(json.load(sys.stdin)["dsn"])')"
fi

curl -fsS -X PUT -H "@$WORK/auth" -H 'Content-Type: application/json' \
    -d "{\"defaults\":{\"events_days\":$RETENTION_DAYS,\"transactions_days\":$RETENTION_DAYS,\"logs_days\":$RETENTION_DAYS},\"overrides\":[],\"frequency\":\"daily\",\"hour\":21,\"weekday\":0}" \
    "$API/api/storage/retention" >/dev/null

# The DSN Rustrak prints names its public URL. The server reaches it over
# loopback instead, so its reports never go out and back in through the edge.
LOCAL_DSN="$(DSN="$DSN" PORT="$PORT" python3 -c '
import os, urllib.parse as u
d = u.urlsplit(os.environ["DSN"])
print(u.urlunsplit(("http", d.username + "@127.0.0.1:" + os.environ["PORT"], d.path, "", "")))')"
TOKEN="$(sed 's/^Authorization: Bearer //' "$WORK/auth")"

set_value SENTRY_DSN "$LOCAL_DSN" "$ENV_FILE"
set_value RUSTRAK_API_TOKEN "$TOKEN" "$ENV_FILE"
set_value RUSTRAK_PUBLIC_URL "$PUBLIC_URL" "$ENV_FILE"
echo "    error tracking on: SENTRY_DSN points at 127.0.0.1:$PORT"
echo "    dashboard: $PUBLIC_URL — admin login in $SECRETS (sudo cat it)"
