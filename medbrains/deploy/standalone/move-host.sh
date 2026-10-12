#!/usr/bin/env bash
# Move a running install to a new hostname, keeping the old one as a
# permanent redirect so links already sent (SMS, email, bookmarks) still land.
#
#   sudo bash move-host.sh <new-host> <old-host> [--apply]
#   REDIRECT="medbrains.in=https://www.medbrains.in" sudo -E bash move-host.sh …
#     also answers another name on this host with a permanent redirect
#     (a bare domain whose DNS cannot point at the website's CDN).
#
# Without --apply it only prints what it would change. With --apply it:
#   1. points the server's env at the new host (CORS keeps both while users move),
#   2. renames the site in Caddy and adds a redirect block for the old host,
#      validating before reload and restoring the backup if validation fails,
#   3. updates the hospital's custom_domain, which login resolves the tenant by,
#   4. restarts the server and checks both names answer as they should.
# Run it only after <new-host> resolves to this machine: Caddy needs the DNS
# to get a certificate.
set -euo pipefail

NEW="${1:?new host, e.g. app.medbrains.in}"
OLD="${2:?old host, e.g. medbrains.amh.org.in}"
APPLY="${3:-}"
ENV_FILE=/etc/medbrains/env
CADDYFILE="${CADDYFILE:-/etc/caddy/Caddyfile}"
STAMP="$(date +%Y%m%d-%H%M%S)"
REDIRECT="${REDIRECT:-}"
REDIRECT_HOST="${REDIRECT%%=*}"
REDIRECT_TO="${REDIRECT#*=}"

say() { printf '==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

[[ -f "$ENV_FILE" ]] || die "$ENV_FILE not found — is this the MedBrains host?"
[[ -f "$CADDYFILE" ]] || die "$CADDYFILE not found (set CADDYFILE=...)"
grep -qE "^${OLD//./\\.}[[:space:]]*\{" "$CADDYFILE" \
  || die "no '$OLD {' site block in $CADDYFILE — edit it by hand"
resolved="$(getent hosts "$NEW" | awk '{print $1}' | head -1)"
[[ -n "$resolved" ]] || die "$NEW does not resolve yet — apply the DNS first"

# DATABASE_URL's last path segment, without a query string.
db_name="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | sed -E 's|.*/([^/?]+)(\?.*)?$|\1|')"
[[ -n "$db_name" ]] || die "could not read the database name from DATABASE_URL"

say "new host $NEW resolves to $resolved; database $db_name"
say "env:   COOKIE_DOMAIN=$NEW, CORS_ORIGIN=https://$NEW,https://$OLD, base URLs → https://$NEW"
say "caddy: '$OLD {' becomes '$NEW {'; '$OLD' redirects to https://$NEW{uri}"
say "db:    tenants.custom_domain $OLD → $NEW"
[[ -n "$REDIRECT" ]] && say "caddy: '$REDIRECT_HOST' redirects to $REDIRECT_TO{uri}"
if [[ "$APPLY" != "--apply" ]]; then
  say "dry run — re-run with --apply to make these changes"
  exit 0
fi

say "backing up env and Caddyfile (.$STAMP)"
cp -p "$ENV_FILE" "$ENV_FILE.$STAMP"
cp -p "$CADDYFILE" "$CADDYFILE.$STAMP"

set_env() { # key value — replace the line, or add it if absent
  if grep -qE "^$1=" "$ENV_FILE"; then sed -i "s|^$1=.*|$1=$2|" "$ENV_FILE"; else echo "$1=$2" >> "$ENV_FILE"; fi
}
set_env COOKIE_DOMAIN "$NEW"
set_env CORS_ORIGIN "https://$NEW,https://$OLD"
grep -qE '^WHO_ICD_API_BASE_URL=https://'"${OLD//./\\.}" "$ENV_FILE" && set_env WHO_ICD_API_BASE_URL "https://$NEW"
grep -qE '^MEDBRAINS_PUBLIC_BASE_URL=' "$ENV_FILE" && set_env MEDBRAINS_PUBLIC_BASE_URL "https://$NEW"

if ! grep -qE "^${NEW//./\\.}[[:space:]]*\{" "$CADDYFILE"; then
  sed -i -E "s|^${OLD//./\\.}([[:space:]]*\{)|$NEW\1|" "$CADDYFILE"
  printf '\n# Moved to %s on %s — keep while old links are in circulation.\n%s {\n\tredir https://%s{uri} permanent\n}\n' \
    "$NEW" "$STAMP" "$OLD" "$NEW" >> "$CADDYFILE"
fi
if [[ -n "$REDIRECT" ]] && ! grep -qE "^${REDIRECT_HOST//./\\.}[[:space:]]*\{" "$CADDYFILE"; then
  printf '\n%s {\n\tredir %s{uri} permanent\n}\n' "$REDIRECT_HOST" "$REDIRECT_TO" >> "$CADDYFILE"
fi
if ! caddy validate --config "$CADDYFILE" --adapter caddyfile >/dev/null 2>&1; then
  cp -p "$CADDYFILE.$STAMP" "$CADDYFILE"
  cp -p "$ENV_FILE.$STAMP" "$ENV_FILE"
  die "Caddyfile did not validate — both files restored, nothing reloaded"
fi

say "updating the hospital's domain"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$db_name" -c \
  "UPDATE tenants SET custom_domain = '$NEW' WHERE lower(custom_domain) = lower('$OLD');"

say "reloading Caddy, restarting the server"
systemctl reload caddy
systemctl restart medbrains-server

say "checking"
sleep 5
for i in $(seq 1 24); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "https://$NEW/api/health" || true)"
  [[ "$code" == "200" ]] && break
  sleep 5
done
[[ "$code" == "200" ]] || die "https://$NEW/api/health answered $code — backups are at *.$STAMP"
redirect="$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "https://$OLD/login" || true)"
say "https://$NEW/api/health → 200"
say "https://$OLD/login → $redirect"
say "done. Backups: $ENV_FILE.$STAMP $CADDYFILE.$STAMP"
