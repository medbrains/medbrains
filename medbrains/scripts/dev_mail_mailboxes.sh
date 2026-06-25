#!/usr/bin/env bash
#
# Dev convenience: give every seeded user a real mailbox in the local Stalwart
# so the app's outbound mail (verification, invites, notifications) is actually
# delivered locally and readable in a mail client. Without this, sending to
# e.g. admin@medbrains.localhost bounces — Stalwart hosts the domain but has no
# mailbox for that address.
#
# Drives the app's OWN API — POST /api/admin/mail/mailboxes (the create_mailbox
# handler) — rather than re-implementing the Stalwart principal call. That
# endpoint already owns the correct payload (secrets array + roles:["user"]),
# so this stays a thin loop over the addresses and never duplicates it.
#
# Idempotent: an "already exists" from the API is ignored. Every mailbox gets
# the same dev password (DEV_MAILBOX_PASSWORD, default medbrains_dev_pw).
#
# Usage:  make dev-mail-mailboxes     (backend must be running)
#
set -uo pipefail

APP="${APP_BASE_URL:-http://localhost:3000}"
DB_URL="${DATABASE_URL:-postgres://medbrains:medbrains_dev@localhost:5435/medbrains}"
ADMIN_USER="${DEV_ADMIN_USER:-admin}"
ADMIN_PASS="${DEV_ADMIN_PASSWORD:-admin123}"
PASSWORD="${DEV_MAILBOX_PASSWORD:-medbrains_dev_pw}"
DOMAIN="${DEV_MAIL_DOMAIN:-medbrains.localhost}"

JAR="$(mktemp)"
trap 'rm -f "$JAR"' EXIT

# Authenticate (cookie-based JWT + CSRF token in the body).
login="$(curl -s -c "$JAR" -X POST "$APP/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}")"
csrf="$(printf '%s' "$login" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("csrf_token",""))' 2>/dev/null)"
if [[ -z "$csrf" ]]; then
  echo "Login failed (is the backend up at $APP?): $login"
  exit 1
fi

# Ensure the domain exists in the mail server (idempotent), via the app API.
curl -s -b "$JAR" -H "X-CSRF-Token: $csrf" -H 'Content-Type: application/json' \
  -X POST "$APP/api/admin/mail/provision-domain" -d "{\"domain\":\"$DOMAIN\"}" >/dev/null

emails="$(psql "$DB_URL" -tA -c \
  "SELECT DISTINCT lower(email) FROM users WHERE email LIKE '%@$DOMAIN' ORDER BY 1")"
if [[ -z "$emails" ]]; then
  echo "No @$DOMAIN user emails found — is the DB seeded?"
  exit 0
fi

created=0 existed=0 failed=0
while IFS= read -r email; do
  [[ -z "$email" ]] && continue
  resp="$(curl -s -b "$JAR" -H "X-CSRF-Token: $csrf" -H 'Content-Type: application/json' \
    -X POST "$APP/api/admin/mail/mailboxes" \
    -d "{\"email\":\"$email\",\"password\":\"$PASSWORD\"}")"
  case "$resp" in
    *'"created":true'*)            created=$((created + 1)); printf '  + %s\n' "$email" ;;
    *exist*|*fieldAlreadyExists*)  existed=$((existed + 1)) ;;
    *)                             failed=$((failed + 1)); printf '  ! %s -> %s\n' "$email" "$resp" ;;
  esac
done <<<"$emails"

echo "mailboxes: $created created, $existed already existed, $failed failed (password: $PASSWORD)"
[[ "$failed" -eq 0 ]]
