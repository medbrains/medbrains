#!/usr/bin/env bash
# MedBrains standalone deploy — bootstrap a single Ubuntu/Debian
# server to run the HMS behind the MedBrains Pingora edge proxy.
#
#   sudo bash install.sh hims.amh.org.in admin@example.com [backup-bucket]
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

# ── Attach tier ─────────────────────────────────────────────────────
# ATTACH_MODE=1 says this host already belongs to somebody: other sites,
# another proxy, another Postgres. Nothing below may take a port or stop
# a service that is already serving one of them.
ATTACH_MODE="${ATTACH_MODE:-0}"
ATTACH_REUSE_TLS="${ATTACH_REUSE_TLS:-$ATTACH_MODE}"
ATTACH_REUSE_POSTGRES="${ATTACH_REUSE_POSTGRES:-$ATTACH_MODE}"
ATTACH_DATABASE_URL="${ATTACH_DATABASE_URL:-}"

# Both reuse flags are meaningless on a dedicated host — there is
# nothing there to reuse — and dangerous if honoured by accident.
if [[ "$ATTACH_MODE" != "1" ]]; then
    ATTACH_REUSE_TLS=0
    ATTACH_REUSE_POSTGRES=0
fi

# Reuse asked for but no database handed over. Starting our own on a
# free port is the safe reading of that: it still never touches the
# Postgres already running here.
if [[ "$ATTACH_REUSE_POSTGRES" == "1" && -z "$ATTACH_DATABASE_URL" ]]; then
    ATTACH_REUSE_POSTGRES=0
fi

# Docker exists in this kit to run Postgres. Reusing the host's means we
# have no reason to install a container runtime on somebody's server.
NEED_DOCKER=1
[[ "$ATTACH_REUSE_POSTGRES" == "1" ]] && NEED_DOCKER=0

if [[ -z "$DOMAIN" || -z "$ADMIN_EMAIL" ]]; then
    cat <<USAGE
Usage:  sudo bash install.sh <domain> <admin-email> [backup-bucket]

Examples:
  sudo bash install.sh hims.amh.org.in ops@amh.org.in

Attach tier (host already runs other applications):
  ATTACH_MODE=1 \
  ATTACH_DATABASE_URL=postgres://user:pw@127.0.0.1:5432/medbrains \
      sudo -E bash install.sh hims.example.org ops@example.org
  Picks free ports, never touches 80/443, never stops another proxy.

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
PACKAGES=(ca-certificates curl gnupg lsb-release openssl)
# certbot is only ours to run when we own 80/443. On an attach host the
# proxy already there holds them and renews its own certificates.
[[ "$ATTACH_REUSE_TLS" == "1" ]] || PACKAGES+=(certbot)
# pg_dump for the backup timer, which cannot shell into a container that
# does not exist when the host's own Postgres is the database.
[[ "$ATTACH_REUSE_POSTGRES" == "1" ]] && PACKAGES+=(postgresql-client)
apt-get install -y --no-install-recommends "${PACKAGES[@]}"

# Docker CE + compose plugin from Docker's official apt repo.
# Ubuntu 24.04 noble doesn't ship docker-compose-plugin; the
# legacy docker.io package also lacks `docker compose`.
if [[ "$NEED_DOCKER" == "1" ]] && ! command -v docker >/dev/null 2>&1; then
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

env_value() {
    local key="$1"
    awk -F= -v key="$key" '$1 == key { value = substr($0, index($0, "=") + 1) } END { print value }' /etc/medbrains/env
}

# ── Attach: claim ports before anything binds one ───────────────────
if [[ "$ATTACH_MODE" == "1" ]]; then
    echo "==> [3b/9] Attach — claiming ports nothing else is using"
    # shellcheck source=./attach-preflight.sh
    . "$DEPLOY_DIR/attach-preflight.sh"
    attach_claim_ports
    attach_report_ports

    sed -i "s|^PORT=.*|PORT=$APP_PORT|" /etc/medbrains/env

    # Rewritten by line, not by sed: a database password may contain any
    # character sed would read as a delimiter or a backreference.
    if [[ "$ATTACH_REUSE_POSTGRES" == "1" ]]; then
        NEW_DB_URL="$ATTACH_DATABASE_URL"
    else
        DBPW_NOW="$(grep '^DATABASE_URL=' /etc/medbrains/env | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|')"
        NEW_DB_URL="postgres://medbrains:$DBPW_NOW@127.0.0.1:$PG_PORT/medbrains"
    fi
    {
        grep -v '^DATABASE_URL=' /etc/medbrains/env
        echo "DATABASE_URL=$NEW_DB_URL"
    } > /etc/medbrains/env.attach
    cat /etc/medbrains/env.attach > /etc/medbrains/env
    rm -f /etc/medbrains/env.attach
fi

echo "==> [4/9] Bringing up postgres-17 via docker compose"
install -m 0644 "$DEPLOY_DIR/docker-compose.prod.yml" /etc/medbrains/docker-compose.yml
# Pull the postgres password out of /etc/medbrains/env for the
# compose file to consume.
DBPW="$(grep '^DATABASE_URL=' /etc/medbrains/env | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|')"
ICD_LOCAL_SERVICE="$(env_value MEDBRAINS_ICD_LOCAL_SERVICE)"
ICD_API_ACCEPT_LICENSE="$(env_value ICD_API_ACCEPT_LICENSE)"
ICD_API_PORT="$(env_value ICD_API_PORT)"
ICD_API_INCLUDE="$(env_value ICD_API_INCLUDE)"
ICD_API_SAVE_ANALYTICS="$(env_value ICD_API_SAVE_ANALYTICS)"
# The env file carries the default 8382; the attach preflight already
# decided whether this host can give us that port. Its answer wins.
if [[ "$ATTACH_MODE" == "1" ]]; then
    ICD_API_PORT="$ICD_PORT"
fi
cat > /etc/medbrains/.compose-env <<COMPOSE_ENV
POSTGRES_DB=medbrains
POSTGRES_USER=medbrains
POSTGRES_PASSWORD=$DBPW
ICD_API_ACCEPT_LICENSE=${ICD_API_ACCEPT_LICENSE:-false}
ICD_API_PORT=${ICD_API_PORT:-8382}
ICD_API_INCLUDE=${ICD_API_INCLUDE:-2026-01_en}
ICD_API_SAVE_ANALYTICS=${ICD_API_SAVE_ANALYTICS:-false}
PG_PORT=${PG_PORT:-5432}
GOTENBERG_PORT=${GOTENBERG_PORT:-3005}
COMPOSE_ENV
chmod 600 /etc/medbrains/.compose-env

# If a container exists with the bind-mount layout from earlier
# install runs, tear it down + drop the broken pgdata so the new
# named-volume layout can init cleanly. No user data risk on first
# bootstrap: the database hasn't been migrated yet at this point.
if [[ "$NEED_DOCKER" == "1" ]] && docker container inspect medbrains-postgres >/dev/null 2>&1; then
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
if [[ "${RESET_PGDATA:-0}" == "1" && "$NEED_DOCKER" == "1" ]]; then
    echo "    RESET_PGDATA=1 — wiping named volume + all data"
    docker compose --env-file /etc/medbrains/.compose-env \
        -f /etc/medbrains/docker-compose.yml down -v 2>/dev/null || true
fi

if [[ "$ATTACH_REUSE_POSTGRES" == "1" ]]; then
    echo "    Reusing the Postgres already on this host — no container started."
else
    docker compose --env-file /etc/medbrains/.compose-env \
        -f /etc/medbrains/docker-compose.yml up -d postgres
fi

if [[ "${ICD_LOCAL_SERVICE:-false}" == "true" ]]; then
    if ! command -v docker >/dev/null 2>&1; then
        echo "ERROR: MEDBRAINS_ICD_LOCAL_SERVICE=true needs docker, which was not"
        echo "       installed because this host's own Postgres is being reused."
        echo "       Install docker on the host, or leave the ICD sidecar off."
        exit 1
    fi
    if [[ "${ICD_API_ACCEPT_LICENSE:-false}" != "true" ]]; then
        echo "ERROR: MEDBRAINS_ICD_LOCAL_SERVICE=true requires ICD_API_ACCEPT_LICENSE=true in /etc/medbrains/env"
        echo "       Review WHO ICD-API license terms before enabling the local ICD sidecar."
        exit 1
    fi
    echo "    Starting local WHO ICD-API sidecar on 127.0.0.1:${ICD_API_PORT:-8382}"
    docker compose --env-file /etc/medbrains/.compose-env \
        -f /etc/medbrains/docker-compose.yml --profile icd up -d icd-api
else
    echo "    WHO ICD-API local sidecar disabled; using cloud OAuth or local cache based on /etc/medbrains/env."
fi

if [[ "$ATTACH_REUSE_POSTGRES" != "1" ]]; then
    echo "    Waiting for postgres ready…"
    for _ in {1..30}; do
        if docker exec medbrains-postgres pg_isready -U medbrains >/dev/null 2>&1; then
            break
        fi
        sleep 1
    done
fi

echo "==> [5/9] Installing binaries to /usr/local/bin"
for bin in medbrains-server medbrains-archive medbrains-proxy medbrains-edge; do
    if [[ ! -f "/tmp/$bin" ]]; then
        echo "ERROR: /tmp/$bin missing. Build and copy target/release/$bin to /tmp/$bin on this host."
        exit 1
    fi
    # Keep the running version for one-command rollback (medbrains-rollback).
    if [[ -f "/usr/local/bin/$bin" ]]; then
        cp -p "/usr/local/bin/$bin" "/usr/local/bin/$bin.prev"
    fi
    install -m 0755 "/tmp/$bin" "/usr/local/bin/$bin"
done

# Host-side rollback helper — swaps every .prev binary and the previous
# SPA back into place and restarts services. Invoked via `make rollback`.
cat > /usr/local/bin/medbrains-rollback <<'ROLLBACK'
#!/usr/bin/env bash
set -euo pipefail
swapped=0
for bin in medbrains-server medbrains-archive medbrains-proxy medbrains-edge; do
    if [[ -f "/usr/local/bin/$bin.prev" ]]; then
        cp -p "/usr/local/bin/$bin" "/usr/local/bin/$bin.rolledback" || true
        cp -p "/usr/local/bin/$bin.prev" "/usr/local/bin/$bin"
        swapped=1
        echo "rolled back $bin"
    fi
done
if [[ -d /var/www/medbrains.prev ]]; then
    rm -rf /var/www/medbrains.rolledback
    mv /var/www/medbrains /var/www/medbrains.rolledback || true
    cp -r /var/www/medbrains.prev /var/www/medbrains
    chown -R medbrains:medbrains /var/www/medbrains
    swapped=1
    echo "rolled back SPA"
fi
if [[ "$swapped" == "0" ]]; then
    echo "nothing to roll back — no .prev artifacts found"
    exit 1
fi
systemctl restart medbrains-server.service
systemctl restart medbrains-proxy.service || true
systemctl restart medbrains-edge.service || true
echo "rollback complete — verify /api/health"
ROLLBACK
chmod 0755 /usr/local/bin/medbrains-rollback

echo "==> [6/9] Installing SPA static files to /var/www/medbrains"
if [[ -d /tmp/medbrains-web ]]; then
    if [[ -d /var/www/medbrains ]]; then
        rm -rf /var/www/medbrains.prev
        mv /var/www/medbrains /var/www/medbrains.prev
    fi
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
if [[ -n "${EDGE_PORT:-}" ]]; then
    sed -i -E "s|^listen[[:space:]]*=.*|listen        = \"127.0.0.1:$EDGE_PORT\"|" /etc/medbrains/edge.toml
fi
chmod 640 /etc/medbrains/edge.toml
chown root:medbrains /etc/medbrains/edge.toml
# Renewal hooks stop and start our proxy around certbot. On a shared
# host certbot renews the OTHER applications' certificates too, and
# these hooks would fire on every one of those renewals. We do not
# install ourselves into somebody else's renewal path.
if [[ "$ATTACH_REUSE_TLS" != "1" ]]; then
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
fi

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

# Bound journald so logs can never fill the root volume silently.
mkdir -p /etc/systemd/journald.conf.d
cat > /etc/systemd/journald.conf.d/medbrains.conf <<'JOURNALD'
[Journal]
SystemMaxUse=1G
SystemKeepFree=2G
MaxRetentionSec=30day
JOURNALD
systemctl restart systemd-journald || true

# The shipped unit hard-requires docker.service because the dedicated
# shape runs Postgres in a container. When the host's own Postgres is
# the database there is no docker, and Requires= would fail the unit.
if [[ "$NEED_DOCKER" != "1" ]]; then
    mkdir -p /etc/systemd/system/medbrains-server.service.d
    cat > /etc/systemd/system/medbrains-server.service.d/attach.conf <<'DROPIN'
[Unit]
Requires=
After=network-online.target
DROPIN
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

if [[ "$ATTACH_REUSE_TLS" == "1" ]]; then
    echo "==> [8/9] TLS left to the proxy already on this host"
    echo "    Not stopping caddy or nginx, not running certbot, not binding 80/443."
    echo "    Pingora is not installed in this mode — it needs to own both ports."
    attach_proxy_snippet "$DOMAIN"
else
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
fi

echo "==> [9/9] Verification — wait up to 30s for service to be active + healthy"

ATTEMPTS=15
SLEEP_SECS=2
HEALTHY=0
for i in $(seq 1 "$ATTEMPTS"); do
    STATE="$(systemctl is-active medbrains-server.service 2>/dev/null || true)"
    if [[ "$STATE" == "active" ]] && \
       curl -fsS --max-time 3 "http://127.0.0.1:${APP_PORT:-3000}/api/health" >/dev/null 2>&1; then
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
echo "    health probe: OK — http://127.0.0.1:${APP_PORT:-3000}/api/health responded"
echo
if [[ "$ATTACH_REUSE_TLS" == "1" ]]; then
    echo "Reachable at http://127.0.0.1:${APP_PORT:-3000} — add the proxy block"
    echo "printed above to the proxy already serving TLS here, then reload it."
    echo "Public URL after that reload: https://$DOMAIN"
else
    echo "Public URL once Pingora finishes TLS setup: https://$DOMAIN"
    echo "First boot may take ~30s for Let's Encrypt; tail with:"
    echo "    journalctl -u medbrains-proxy -f"
fi
