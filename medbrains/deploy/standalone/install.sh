#!/usr/bin/env bash
# MedBrains standalone deploy — bootstrap a single Ubuntu/Debian
# server to run the HMS behind Caddy with auto Let's Encrypt.
#
#   sudo bash install.sh hims.alagappahospital.com admin@example.com
#
# Idempotent: re-running advances state without breaking anything.

set -euo pipefail

DOMAIN="${1:-}"
ADMIN_EMAIL="${2:-}"

if [[ -z "$DOMAIN" || -z "$ADMIN_EMAIL" ]]; then
    cat <<USAGE
Usage:  sudo bash install.sh <domain> <admin-email>

Examples:
  sudo bash install.sh hims.alagappahospital.com ops@alagappahospital.com

Prerequisites:
  - Ubuntu 22.04 / 24.04 or Debian 12 host (root access)
  - DNS A/AAAA record for <domain> already pointing at this server's
    public IP — Let's Encrypt verification needs port 80 reachable
  - Pre-built binaries on this host:
      /tmp/medbrains-server      (the Rust API server)
      /tmp/medbrains-archive     (the storage sweeper)
      /tmp/medbrains-web/        (apps/web/dist contents)
USAGE
    exit 1
fi

if [[ "${EUID}" -ne 0 ]]; then
    echo "ERROR: must run as root (sudo bash install.sh ...)"
    exit 1
fi

DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> [1/9] Installing system packages"
apt-get update -qq
apt-get install -y --no-install-recommends \
    ca-certificates curl gnupg lsb-release \
    docker.io docker-compose-plugin caddy openssl

echo "==> [2/9] Creating medbrains system user + directory tree"
if ! id -u medbrains >/dev/null 2>&1; then
    useradd --system --home /var/lib/medbrains --shell /usr/sbin/nologin medbrains
fi
install -d -o medbrains -g medbrains -m 0750 \
    /var/lib/medbrains \
    /var/lib/medbrains/objects \
    /var/lib/medbrains/cold \
    /var/lib/medbrains/archive \
    /var/lib/medbrains/pgdata \
    /var/log/medbrains \
    /etc/medbrains \
    /var/www/medbrains
chown -R medbrains:medbrains /var/lib/medbrains /var/log/medbrains /var/www/medbrains

echo "==> [3/9] Writing /etc/medbrains/env (preserving existing if present)"
if [[ ! -f /etc/medbrains/env ]]; then
    cp "$DEPLOY_DIR/env.example" /etc/medbrains/env
    sed -i "s|hims.alagappahospital.com|$DOMAIN|g" /etc/medbrains/env

    # Generate Ed25519 JWT keypair if not already in place.
    PRIV="$(openssl genpkey -algorithm Ed25519 2>/dev/null | base64 -w0)"
    PUB="$(echo "$PRIV" | base64 -d | openssl pkey -pubout 2>/dev/null | base64 -w0)"
    sed -i "s|^JWT_PRIVATE_KEY=$|JWT_PRIVATE_KEY=$PRIV|" /etc/medbrains/env
    sed -i "s|^JWT_PUBLIC_KEY=$|JWT_PUBLIC_KEY=$PUB|" /etc/medbrains/env

    # Generate a random postgres password.
    DBPW="$(openssl rand -base64 24 | tr -d /=+ | head -c 32)"
    sed -i "s|CHANGEME|$DBPW|" /etc/medbrains/env

    chmod 600 /etc/medbrains/env
    chown root:medbrains /etc/medbrains/env
    chmod 640 /etc/medbrains/env
    echo "    Generated JWT keypair + random postgres password."
else
    echo "    /etc/medbrains/env already exists — leaving alone."
fi

echo "==> [4/9] Bringing up postgres-17 via docker compose"
install -m 0644 "$DEPLOY_DIR/docker-compose.prod.yml" /etc/medbrains/docker-compose.yml
# Pull the postgres password out of /etc/medbrains/env for the
# compose file to consume.
DBPW="$(grep '^DATABASE_URL=' /etc/medbrains/env | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|')"
cat > /etc/medbrains/.compose-env <<COMPOSE_ENV
POSTGRES_DB=medbrains
POSTGRES_USER=medbrains
POSTGRES_PASSWORD=$DBPW
COMPOSE_ENV
chmod 600 /etc/medbrains/.compose-env
docker compose --env-file /etc/medbrains/.compose-env \
    -f /etc/medbrains/docker-compose.yml up -d postgres
echo "    Waiting for postgres ready…"
for _ in {1..30}; do
    if docker exec medbrains-postgres pg_isready -U medbrains >/dev/null 2>&1; then
        break
    fi
    sleep 1
done

echo "==> [5/9] Installing binaries to /usr/local/bin"
for bin in medbrains-server medbrains-archive; do
    if [[ ! -f "/tmp/$bin" ]]; then
        echo "ERROR: /tmp/$bin missing. Build with: cargo build -p medbrains-server --release --bin $bin"
        echo "       and copy target/release/$bin to /tmp/$bin on this host."
        exit 1
    fi
    install -m 0755 "/tmp/$bin" "/usr/local/bin/$bin"
done

echo "==> [6/9] Installing SPA static files to /var/www/medbrains"
if [[ -d /tmp/medbrains-web ]]; then
    rm -rf /var/www/medbrains
    mkdir -p /var/www/medbrains
    cp -r /tmp/medbrains-web/. /var/www/medbrains/
    chown -R medbrains:medbrains /var/www/medbrains
else
    echo "    /tmp/medbrains-web/ not found — leaving SPA static dir as-is."
fi

echo "==> [7/9] Installing systemd units"
install -m 0644 "$DEPLOY_DIR/medbrains-server.service" /etc/systemd/system/
install -m 0644 "$DEPLOY_DIR/medbrains-archive.service" /etc/systemd/system/
install -m 0644 "$DEPLOY_DIR/medbrains-archive.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now medbrains-server.service
systemctl enable --now medbrains-archive.timer

echo "==> [8/9] Configuring Caddy reverse proxy with auto Let's Encrypt"
sed -e "s|{{DOMAIN}}|$DOMAIN|g" -e "s|{{ADMIN_EMAIL}}|$ADMIN_EMAIL|g" \
    "$DEPLOY_DIR/Caddyfile.tmpl" > /etc/caddy/Caddyfile
systemctl reload caddy || systemctl restart caddy

echo "==> [9/9] Verification"
sleep 3
echo "    server status:"
systemctl is-active medbrains-server.service || true
echo "    archive timer:"
systemctl list-timers medbrains-archive.timer --no-pager | head -3 || true
echo "    health probe:"
if curl -fsS "http://127.0.0.1:3000/api/health" >/dev/null; then
    echo "    OK — http://127.0.0.1:3000/api/health responded"
else
    echo "    NOT YET — check journalctl -u medbrains-server.service"
fi
echo
echo "Public URL once Caddy finishes ACME: https://$DOMAIN"
echo "First boot may take ~30s for Let's Encrypt; tail with:"
echo "    journalctl -u caddy -f"
