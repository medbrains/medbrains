#!/usr/bin/env bash
# Install and manage SpiceDB — the ReBAC graph index MedBrains checks
# relationships against.
#
# This existed on the Alagappa host for months as a hand-installed service
# nobody could rebuild: a binary somebody fetched, a unit somebody wrote, a
# database somebody created, and a schema somebody loaded. It worked, and it
# would not have survived losing the host. That is the gap this closes.
#
# Idempotent throughout. Re-running upgrades the binary if the pinned version
# changed, reconciles the schema, and leaves relationship data alone.
#
# It does NOT switch MedBrains over to SpiceDB. Installing the index and
# trusting it for authorization decisions are separate acts — see the note at
# the end of this script.
set -euo pipefail

SPICEDB_VERSION="${SPICEDB_VERSION:-1.56.1}"
DEPLOY_DIR="${DEPLOY_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
SCHEMA_FILE="${SCHEMA_FILE:-$DEPLOY_DIR/spicedb-schema.zed}"

say() { printf '    %s\n' "$*"; }

case "$(uname -m)" in
    aarch64|arm64) SPICEDB_ARCH=arm64 ;;
    x86_64|amd64)  SPICEDB_ARCH=amd64 ;;
    *) echo "ERROR: unsupported architecture $(uname -m)"; exit 1 ;;
esac

# ── binary ────────────────────────────────────────────────────────────
current=""
if [ -x /usr/local/bin/spicedb ]; then
    current="$(/usr/local/bin/spicedb version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || true)"
fi

if [ "$current" = "$SPICEDB_VERSION" ]; then
    say "spicedb $SPICEDB_VERSION already installed"
else
    say "installing spicedb $SPICEDB_VERSION ($SPICEDB_ARCH), was '${current:-none}'"
    tmp="$(mktemp -d)"
    trap 'rm -rf "$tmp"' EXIT
    url="https://github.com/authzed/spicedb/releases/download/v${SPICEDB_VERSION}/spicedb_${SPICEDB_VERSION}_linux_${SPICEDB_ARCH}.tar.gz"
    curl -fsSL "$url" -o "$tmp/spicedb.tar.gz"
    tar -xzf "$tmp/spicedb.tar.gz" -C "$tmp" spicedb
    install -m 0755 "$tmp/spicedb" /usr/local/bin/spicedb
    say "installed $(/usr/local/bin/spicedb version 2>/dev/null | head -1)"
fi

# ── service account ───────────────────────────────────────────────────
if ! id spicedb >/dev/null 2>&1; then
    say "creating spicedb system user"
    useradd --system --no-create-home --shell /usr/sbin/nologin spicedb
fi

# ── datastore ─────────────────────────────────────────────────────────
# Its own database and its own role, never the one owning the hospital's
# other applications. The unit connects over the local socket as peer, so
# no password exists to leak.
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='spicedb'" | grep -q 1; then
    say "creating postgres role spicedb"
    sudo -u postgres psql -qc "CREATE ROLE spicedb LOGIN" >/dev/null
fi
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='spicedb'" | grep -q 1; then
    say "creating database spicedb"
    sudo -u postgres createdb -O spicedb spicedb
fi

# ── preshared key ─────────────────────────────────────────────────────
# Generated once and kept. Rotating it silently would leave MedBrains
# holding a key the server no longer accepts, and every authorization check
# would start failing at once.
install -d -m 0750 -o spicedb -g spicedb /etc/spicedb
if [ ! -f /etc/spicedb/env ]; then
    say "generating preshared key"
    key="$(head -c 32 /dev/urandom | base64 | tr -d '=+/' | cut -c1-40)"
    printf 'SPICEDB_GRPC_PRESHARED_KEY=%s\n' "$key" > /etc/spicedb/env
    chown spicedb:spicedb /etc/spicedb/env
    chmod 0600 /etc/spicedb/env
else
    say "preshared key already present, left alone"
fi

# ── migrate + serve ───────────────────────────────────────────────────
say "running datastore migrations"
sudo -u spicedb /usr/local/bin/spicedb datastore migrate head \
    --datastore-engine postgres \
    --datastore-conn-uri "postgres:///spicedb?host=/var/run/postgresql" >/dev/null

install -m 0644 "$DEPLOY_DIR/spicedb.service" /etc/systemd/system/spicedb.service
systemctl daemon-reload
systemctl enable --now spicedb
say "service: $(systemctl is-active spicedb)"

# ── schema ────────────────────────────────────────────────────────────
# The schema is the policy. It lives in the repository at
# infra/spicedb/schema.zed and is applied here, so the authoritative copy is
# the one in version control rather than whatever happens to be loaded.
if [ -f "$SCHEMA_FILE" ]; then
    for _ in $(seq 1 20); do
        grep -q . /dev/null
        if /usr/local/bin/spicedb version >/dev/null 2>&1 && \
           ss -ltn 2>/dev/null | grep -q 127.0.0.1:50051; then break; fi
        sleep 1
    done
    # shellcheck disable=SC1091
    . /etc/spicedb/env
    say "applying schema from $(basename "$SCHEMA_FILE")"
    if command -v zed >/dev/null 2>&1; then
        zed context set local 127.0.0.1:50051 "$SPICEDB_GRPC_PRESHARED_KEY" --insecure >/dev/null 2>&1 || true
        zed schema write "$SCHEMA_FILE" --insecure >/dev/null && say "schema applied"
    else
        # zed is a separate download; the HTTP API takes the same schema.
        payload="$(python3 -c 'import json,sys; print(json.dumps({"schema": open(sys.argv[1]).read()}))' "$SCHEMA_FILE")"
        code="$(curl -s -o /tmp/spicedb-schema-write.out -w '%{http_code}' \
            -X POST http://127.0.0.1:8443/v1/schema/write \
            -H "Authorization: Bearer $SPICEDB_GRPC_PRESHARED_KEY" \
            -H 'Content-Type: application/json' \
            --data "$payload")"
        if [ "$code" = "200" ]; then
            say "schema applied"
        else
            say "WARNING: schema write returned $code — see /tmp/spicedb-schema-write.out"
        fi
    fi
else
    say "no schema file at $SCHEMA_FILE — leaving the loaded schema as-is"
fi

echo
say "SpiceDB is installed and serving on 127.0.0.1:50051."
say
say "MedBrains is NOT using it yet, and this script deliberately does not"
say "switch it over. SPICEDB_ENDPOINT and SPICEDB_TOKEN in /etc/medbrains/env"
say "are what move authorization decisions onto it, and that is a cutover:"
say "the tuples must be backfilled first, and both backends must agree"
say "before one of them starts deciding who may see a patient."
