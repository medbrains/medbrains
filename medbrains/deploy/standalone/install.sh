#!/usr/bin/env bash
# MedBrains standalone deploy — bootstrap a single Ubuntu/Debian
# server to run the HMS behind the MedBrains Pingora edge proxy.
#
#   sudo bash install.sh hims.alagappahospital.com admin@example.com [backup-bucket]
#
# Idempotent: re-running advances state without breaking anything.

set -euo pipefail

DOMAIN="${1:-}"
ADMIN_EMAIL="${2:-}"
# 3rd arg = S3 backup bucket name (passed by terraform). Optional —
# omitted = no S3 backups (timer still installed but exits noisily).
BACKUP_BUCKET="${3:-${BACKUP_BUCKET:-}}"
EDGE_PROXY="${4:-${EDGE_PROXY:-pingora}}"
if [[ "$EDGE_PROXY" != "pingora" ]]; then
    echo "ERROR: standalone edge proxy is Pingora-only; got '$EDGE_PROXY'"
    exit 1
fi

if [[ -z "$DOMAIN" || -z "$ADMIN_EMAIL" ]]; then
    cat <<USAGE
Usage:  sudo bash install.sh <domain> <admin-email> [backup-bucket]

Examples:
  sudo bash install.sh hims.alagappahospital.com ops@alagappahospital.com

Prerequisites:
  - Ubuntu 22.04 / 24.04 or Debian 12 host (root access)
  - DNS A/AAAA record for <domain> already pointing at this server's
    public IP — Let's Encrypt verification needs port 80 reachable
  - Pre-built binaries on this host:
      /tmp/medbrains-server      (the Rust API server)
      /tmp/medbrains-archive     (the storage sweeper)
      /tmp/medbrains-proxy       (the Pingora edge proxy)
      /tmp/medbrains-edge        (the Loro CRDT edge sync server)
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
    ca-certificates certbot curl gnupg lsb-release openssl

# Docker CE + compose plugin from Docker's official apt repo.
# Ubuntu 24.04 noble doesn't ship docker-compose-plugin; the
# legacy docker.io package also lacks `docker compose`.
if ! command -v docker >/dev/null 2>&1; then
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
        | gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    UBU_CODENAME="$(lsb_release -cs)"
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $UBU_CODENAME stable" \
        > /etc/apt/sources.list.d/docker.list
    apt-get update -qq
    apt-get install -y --no-install-recommends \
        docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable --now docker
fi

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
    /var/lib/medbrains-edge \
    /var/lib/medbrains-edge/docs \
    /var/lib/medbrains-edge/chain \
    /var/log/medbrains \
    /etc/medbrains \
    /var/www/medbrains
chown -R medbrains:medbrains /var/lib/medbrains /var/lib/medbrains-edge /var/log/medbrains /var/www/medbrains

echo "==> [3/9] Writing /etc/medbrains/env (preserving existing if present)"
if [[ ! -f /etc/medbrains/env ]]; then
    cp "$DEPLOY_DIR/env.example" /etc/medbrains/env
    sed -i "s|__DOMAIN__|$DOMAIN|g" /etc/medbrains/env

    # Generate Ed25519 JWT keypair.
    # - JWT_PRIVATE_KEY: PKCS#8 v1 DER (jsonwebtoken EncodingKey::from_ed_der)
    # - JWT_PUBLIC_KEY:  raw 32-byte pub key (ring's Ed25519 verifier — NOT SPKI)
    # Both base64-encoded.
    PRIV_DER="/tmp/medbrains-jwt-priv.der"
    SPKI_DER="/tmp/medbrains-jwt-pub-spki.der"
    PUB_RAW="/tmp/medbrains-jwt-pub-raw.bin"
    openssl genpkey -algorithm Ed25519 -outform DER -out "$PRIV_DER" 2>/dev/null
    openssl pkey -inform DER -in "$PRIV_DER" -pubout -outform DER -out "$SPKI_DER" 2>/dev/null
    # SPKI for Ed25519 is 44 bytes; raw 32-byte key = last 32 bytes.
    tail -c 32 "$SPKI_DER" > "$PUB_RAW"
    PRIV="$(base64 -w0 < "$PRIV_DER")"
    PUB="$(base64 -w0 < "$PUB_RAW")"
    rm -f "$PRIV_DER" "$SPKI_DER" "$PUB_RAW"
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

    # Rotate JWT keys if existing format is broken:
    #  - "LS0t..." prefix     → legacy PEM-base64 (`InvalidEddsaKey`)
    #  - PUBLIC key length 60 → SPKI-wrapped DER (decode-side wants raw 32B)
    EXISTING_PRIV="$(grep '^JWT_PRIVATE_KEY=' /etc/medbrains/env | cut -d= -f2-)"
    EXISTING_PUB="$(grep '^JWT_PUBLIC_KEY=' /etc/medbrains/env | cut -d= -f2-)"
    NEEDS_ROTATE=0
    [[ "$EXISTING_PRIV" == LS0t* ]] && NEEDS_ROTATE=1
    [[ "${#EXISTING_PUB}" -eq 60 ]] && NEEDS_ROTATE=1
    if [[ "$NEEDS_ROTATE" -eq 1 ]]; then
        echo "    JWT key format incompatible with jsonwebtoken — rotating"
        PRIV_DER="/tmp/medbrains-jwt-priv.der"
        SPKI_DER="/tmp/medbrains-jwt-pub-spki.der"
        PUB_RAW="/tmp/medbrains-jwt-pub-raw.bin"
        openssl genpkey -algorithm Ed25519 -outform DER -out "$PRIV_DER" 2>/dev/null
        openssl pkey -inform DER -in "$PRIV_DER" -pubout -outform DER -out "$SPKI_DER" 2>/dev/null
        tail -c 32 "$SPKI_DER" > "$PUB_RAW"
        PRIV="$(base64 -w0 < "$PRIV_DER")"
        PUB="$(base64 -w0 < "$PUB_RAW")"
        rm -f "$PRIV_DER" "$SPKI_DER" "$PUB_RAW"
        sed -i "s|^JWT_PRIVATE_KEY=.*|JWT_PRIVATE_KEY=$PRIV|" /etc/medbrains/env
        sed -i "s|^JWT_PUBLIC_KEY=.*|JWT_PUBLIC_KEY=$PUB|" /etc/medbrains/env
    fi
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

# If a container exists with the bind-mount layout from earlier
# install runs, tear it down + drop the broken pgdata so the new
# named-volume layout can init cleanly. No user data risk on first
# bootstrap: the database hasn't been migrated yet at this point.
if docker container inspect medbrains-postgres >/dev/null 2>&1; then
    OLD_MOUNT="$(docker inspect medbrains-postgres --format '{{ range .Mounts }}{{.Source}}{{end}}' 2>/dev/null || true)"
    if [[ "$OLD_MOUNT" == "/var/lib/medbrains/pgdata" ]]; then
        echo "    Migrating from bind-mount to named volume — tearing down old container + pgdata"
        docker compose --env-file /etc/medbrains/.compose-env \
            -f /etc/medbrains/docker-compose.yml down -v 2>/dev/null || true
        rm -rf /var/lib/medbrains/pgdata/*
    fi
fi

# Operator opt-in: RESET_PGDATA=1 forces a wipe of the named volume.
# Use this when the application binary's embedded sqlx migrations
# diverge from what's recorded in _sqlx_migrations (e.g. major sqlx
# version bump). Never set this with real production data.
if [[ "${RESET_PGDATA:-0}" == "1" ]]; then
    echo "    RESET_PGDATA=1 — wiping named volume + all data"
    docker compose --env-file /etc/medbrains/.compose-env \
        -f /etc/medbrains/docker-compose.yml down -v 2>/dev/null || true
fi

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
for bin in medbrains-server medbrains-archive medbrains-proxy medbrains-edge; do
    if [[ ! -f "/tmp/$bin" ]]; then
        echo "ERROR: /tmp/$bin missing. Build and copy target/release/$bin to /tmp/$bin on this host."
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

echo "==> [7/9] Installing systemd units + backup tooling"
install -m 0644 "$DEPLOY_DIR/medbrains-server.service" /etc/systemd/system/
install -m 0644 "$DEPLOY_DIR/medbrains-archive.service" /etc/systemd/system/
install -m 0644 "$DEPLOY_DIR/medbrains-archive.timer" /etc/systemd/system/
install -m 0644 "$DEPLOY_DIR/medbrains-pg-backup.service" /etc/systemd/system/
install -m 0644 "$DEPLOY_DIR/medbrains-pg-backup.timer" /etc/systemd/system/
install -m 0755 "$DEPLOY_DIR/medbrains-pg-backup" /usr/local/bin/medbrains-pg-backup
install -m 0644 "$DEPLOY_DIR/medbrains-edge.service" /etc/systemd/system/
install -m 0644 "$DEPLOY_DIR/medbrains-proxy.service" /etc/systemd/system/
install -m 0644 "$DEPLOY_DIR/medbrains-edge.toml.tmpl" /etc/medbrains/edge.toml
chmod 640 /etc/medbrains/edge.toml
chown root:medbrains /etc/medbrains/edge.toml
install -d -m 0755 \
    /etc/letsencrypt/renewal-hooks/pre \
    /etc/letsencrypt/renewal-hooks/deploy \
    /etc/letsencrypt/renewal-hooks/post
install -m 0755 "$DEPLOY_DIR/stop-medbrains-proxy" \
    /etc/letsencrypt/renewal-hooks/pre/stop-medbrains-proxy
install -m 0755 "$DEPLOY_DIR/copy-medbrains-proxy-cert" \
    /etc/letsencrypt/renewal-hooks/deploy/copy-medbrains-proxy-cert
install -m 0755 "$DEPLOY_DIR/start-medbrains-proxy" \
    /etc/letsencrypt/renewal-hooks/post/start-medbrains-proxy

# AWS CLI v2 — required by the pg-backup timer to upload dumps to S3.
# Ubuntu 24.04 noble dropped the apt awscli package; install Amazon's
# v2 bundle directly. Arch-aware (aarch64 vs x86_64).
if ! command -v aws >/dev/null 2>&1; then
    apt-get install -y --no-install-recommends unzip
    AWS_ARCH="$(uname -m)"
    case "$AWS_ARCH" in
        aarch64) AWSCLI_URL="https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" ;;
        x86_64)  AWSCLI_URL="https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" ;;
        *) echo "ERROR: unsupported arch $AWS_ARCH for AWS CLI"; exit 1 ;;
    esac
    curl -fsSL "$AWSCLI_URL" -o /tmp/awscliv2.zip
    unzip -q -o /tmp/awscliv2.zip -d /tmp
    /tmp/aws/install --update
    rm -rf /tmp/awscliv2.zip /tmp/aws
fi

# Persist BACKUP_BUCKET (set by install.sh's third arg from terraform)
# into /etc/medbrains/env so the systemd EnvironmentFile picks it up.
if [[ -n "${BACKUP_BUCKET:-}" ]]; then
    if grep -q '^BACKUP_BUCKET=' /etc/medbrains/env 2>/dev/null; then
        sed -i "s|^BACKUP_BUCKET=.*|BACKUP_BUCKET=$BACKUP_BUCKET|" /etc/medbrains/env
    else
        echo "BACKUP_BUCKET=$BACKUP_BUCKET" >> /etc/medbrains/env
    fi
fi

systemctl daemon-reload
systemctl enable --now medbrains-server.service
# Restart explicitly so re-runs pick up new env (JWT keys, DATABASE_URL,
# BACKUP_BUCKET) AND re-run migrations if RESET_PGDATA=1 wiped them.
systemctl restart medbrains-server.service
systemctl enable --now medbrains-archive.timer
systemctl enable --now medbrains-pg-backup.timer
systemctl enable --now medbrains-edge.service
systemctl restart medbrains-edge.service

echo "==> [8/9] Configuring Pingora edge proxy"
systemctl stop caddy 2>/dev/null || true
systemctl disable caddy 2>/dev/null || true
systemctl stop medbrains-proxy.service 2>/dev/null || true

certbot certonly --standalone --non-interactive --agree-tos \
    --email "$ADMIN_EMAIL" -d "$DOMAIN" --keep-until-expiring
bash "$DEPLOY_DIR/copy-medbrains-proxy-cert" "/etc/letsencrypt/live/$DOMAIN"

sed -e "s|{{DOMAIN}}|$DOMAIN|g" \
    "$DEPLOY_DIR/PingoraProxy.toml.tmpl" > /etc/medbrains/proxy.toml
chmod 640 /etc/medbrains/proxy.toml
chown root:medbrains /etc/medbrains/proxy.toml

systemctl enable --now certbot.timer 2>/dev/null || true
systemctl enable --now medbrains-proxy.service
systemctl restart medbrains-proxy.service

echo "==> [9/9] Verification — wait up to 30s for service to be active + healthy"

ATTEMPTS=15
SLEEP_SECS=2
HEALTHY=0
for i in $(seq 1 "$ATTEMPTS"); do
    STATE="$(systemctl is-active medbrains-server.service 2>/dev/null || true)"
    if [[ "$STATE" == "active" ]] && \
       curl -fsS --max-time 3 "http://127.0.0.1:3000/api/health" >/dev/null 2>&1; then
        HEALTHY=1
        break
    fi
    sleep "$SLEEP_SECS"
done

if [[ "$HEALTHY" -ne 1 ]]; then
    echo "    FAIL — medbrains-server.service didn't reach active+healthy within $((ATTEMPTS*SLEEP_SECS))s"
    echo "    last service status:"
    systemctl status medbrains-server.service --no-pager -l | tail -15 || true
    echo "    last 50 lines of journal:"
    journalctl -u medbrains-server.service --no-pager -n 50 || true
    exit 1
fi

echo "    server status:"
systemctl is-active medbrains-server.service
echo "    archive timer:"
systemctl list-timers medbrains-archive.timer --no-pager | head -3 || true
echo "    health probe: OK — http://127.0.0.1:3000/api/health responded"
echo
echo "Public URL once Pingora finishes TLS setup: https://$DOMAIN"
echo "First boot may take ~30s for Let's Encrypt; tail with:"
echo "    journalctl -u medbrains-proxy -f"
