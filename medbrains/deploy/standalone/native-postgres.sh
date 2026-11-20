#!/usr/bin/env bash
# Native PostgreSQL for the standalone kit — no container runtime.
#
# Sourced by install.sh and migrate-docker-postgres-to-native.sh. Gives
# MedBrains one cluster of its own from the PGDG apt repository:
#
#   packages   postgresql-$PG_MAJOR + client (default 17) from apt.postgresql.org,
#              signed-by the PGDG key (fingerprint checked), major pinned by
#              the package name, so apt brings minor releases only
#   service    postgresql@<major>-<cluster> under systemd; release floor below
#   listens    127.0.0.1 and ::1 only
#   auth       scram-sha-256 over loopback for every MedBrains role; peer on
#              the socket for postgres (and spicedb); nothing else
#   locale     en_US.UTF-8 (generated when the host lacks it), data checksums
#
# A cluster this kit made is recorded in $PG_MARKER before it is created, so
# a re-run (or a run that crashed half way) finishes it, and a cluster of the
# same name that somebody else made is refused rather than taken over.

# The major is one variable: moving to 18 is PG_MAJOR=18, its floor below,
# and CI (scripts/ci_postgres.sh) on the same major.
PG_MAJOR="${PG_MAJOR:-17}"
# Lowest release accepted, server and client tools alike: 17.12 is the
# 2026-11-12 security release (52 CVEs, including pg_dump and pg_restore
# running code from a crafted archive). Raise it with each security release.
PG_MIN_VERSION_NUM="${PG_MIN_VERSION_NUM:-170012}"
PG_CLUSTER="${PG_CLUSTER:-main}"
PG_BIN="/usr/lib/postgresql/$PG_MAJOR/bin"
PG_LOCALE=en_US.UTF-8
PG_MARKER=/etc/medbrains/postgres-cluster
PG_CONF_DIR="/etc/postgresql/$PG_MAJOR/$PG_CLUSTER"
PG_UNIT="postgresql@$PG_MAJOR-$PG_CLUSTER.service"
# PostgreSQL Debian/Ubuntu repository signing key (www.postgresql.org/download/linux/ubuntu).
PGDG_FPR=B97B0AFCAA1A47F044F244A07FCC7D46ACCC4CF8
# No prompts, and needrestart only lists what it would restart: an apt run
# here must never bounce docker (and the container still serving) or sshd.
export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=l

# Adds apt.postgresql.org to apt. Prefers the key postgresql-common ships
# (it came through the distribution's own signed archive); downloads it only
# when that package is too old to carry it. Either way the fingerprint must
# match, or nothing is written.
pg_native_repo() {
    local key=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc codename
    apt-get install -y --no-install-recommends postgresql-common gnupg curl ca-certificates locales
    if [[ ! -s "$key" ]]; then
        key=/etc/apt/keyrings/apt.postgresql.org.asc
        install -d -m 0755 /etc/apt/keyrings
        curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc -o "$key.new"
        mv "$key.new" "$key"
        chmod 0644 "$key"
    fi
    if ! gpg --show-keys --with-colons "$key" 2>/dev/null | grep -q "^fpr:::::::::$PGDG_FPR:"; then
        echo "ERROR: $key is not the PGDG signing key ($PGDG_FPR) — not adding the repository" >&2
        return 1
    fi
    codename="$(. /etc/os-release && echo "$VERSION_CODENAME")"
    echo "deb [signed-by=$key] https://apt.postgresql.org/pub/repos/apt ${codename}-pgdg main" \
        > /etc/apt/sources.list.d/pgdg.list
    # Readable by apt's unprivileged fetcher whatever the caller's umask.
    chmod 0644 /etc/apt/sources.list.d/pgdg.list
}

# Generates en_US.UTF-8 when the host does not have it. Debian's locale-gen
# takes no arguments, so the line is enabled in /etc/locale.gen (both distros
# read it).
pg_native_locale() {
    locale -a 2>/dev/null | grep -qix 'en_US.utf8' && return 0
    sed -i -E 's/^#[[:space:]]*(en_US\.UTF-8 UTF-8)/\1/' /etc/locale.gen
    grep -q '^en_US.UTF-8 UTF-8' /etc/locale.gen || echo 'en_US.UTF-8 UTF-8' >> /etc/locale.gen
    locale-gen >/dev/null
}

# Installs PostgreSQL 17 and brings MedBrains' cluster up on <port>.
# Idempotent: a second run only re-asserts the config files and the port.
pg_native_install() { # port
    local port="$1" marker="$PG_MAJOR $PG_CLUSTER"
    pg_native_repo
    # Our cluster is created explicitly below, with our locale and port; the
    # package's automatic one would take the host's locale and 5432.
    sed -i -E 's/^#?[[:space:]]*create_main_cluster.*/create_main_cluster = false/' \
        /etc/postgresql-common/createcluster.conf
    apt-get update -qq
    apt-get install -y --no-install-recommends "postgresql-$PG_MAJOR" "postgresql-client-$PG_MAJOR"
    pg_native_check_version
    pg_native_locale
    # Every MedBrains unit that runs psql or pg_dump reads its PATH from here
    # (EnvironmentFile=), so the major is named once.
    install -d -m 0755 /etc/medbrains
    echo "PATH=$PG_BIN:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" > /etc/medbrains/postgres.env
    chmod 0644 /etc/medbrains/postgres.env

    if [[ -d "$PG_CONF_DIR" && "$(cat "$PG_MARKER" 2>/dev/null)" != "$marker" ]]; then
        echo "ERROR: cluster $PG_MAJOR/$PG_CLUSTER exists and MedBrains did not make it ($PG_MARKER)." >&2
        echo "       Not taking it over. Reuse it (ATTACH_MODE=1 ATTACH_DATABASE_URL=…), pick another" >&2
        echo "       PG_CLUSTER, or, if it is empty: pg_dropcluster --stop $PG_MAJOR $PG_CLUSTER" >&2
        return 1
    fi
    if [[ ! -d "$PG_CONF_DIR" ]]; then
        install -d -m 0755 /etc/medbrains
        echo "$marker" > "$PG_MARKER"
        chmod 0644 "$PG_MARKER"
        # Never removes a data directory: pg_createcluster refuses a
        # non-empty one, and that refusal is the right answer here too.
        pg_createcluster --locale "$PG_LOCALE" --encoding UTF8 -p "$port" "$PG_MAJOR" "$PG_CLUSTER" \
            -- --data-checksums --auth-local=peer --auth-host=scram-sha-256 >/dev/null
    fi
    pg_native_config "$port"
    systemctl enable "$PG_UNIT" >/dev/null 2>&1
    systemctl restart "$PG_UNIT"
    pg_native_wait "$port"
}

# Refuses a server or client tool below PG_MIN_VERSION_NUM, and prints the
# version installed, so the log of every install and migration names it.
pg_native_check_version() {
    local bin v num
    (( PG_MIN_VERSION_NUM / 10000 == PG_MAJOR )) || {
        echo "ERROR: PG_MIN_VERSION_NUM=$PG_MIN_VERSION_NUM is not a $PG_MAJOR.x floor; set both together" >&2
        return 1
    }
    for bin in postgres psql pg_dump pg_dumpall pg_restore; do
        v="$("$PG_BIN/$bin" --version | grep -oE '[0-9]+\.[0-9]+' | head -1)"
        num=$(( ${v%%.*} * 10000 + ${v#*.} ))
        if (( num < PG_MIN_VERSION_NUM )); then
            echo "ERROR: $PG_BIN/$bin is $v, below the floor $((PG_MIN_VERSION_NUM / 10000)).$((PG_MIN_VERSION_NUM % 10000)) — apt-get update, then re-run" >&2
            return 1
        fi
    done
    echo "    PostgreSQL $v installed (server and client tools; floor $((PG_MIN_VERSION_NUM / 10000)).$((PG_MIN_VERSION_NUM % 10000)))"
}

# Loopback listeners, SCRAM, and the client-auth file. Written whole each
# run, so a hand edit is replaced by the reviewed one.
pg_native_config() { # port
    pg_conftool "$PG_MAJOR" "$PG_CLUSTER" set port "$1"
    install -d -o postgres -g postgres -m 0755 "$PG_CONF_DIR/conf.d"
    cat > "$PG_CONF_DIR/conf.d/00-medbrains.conf" <<'CONF'
# MedBrains (native-postgres.sh). Loopback only: the server, the backup
# scripts and the edge are on this host; nothing else may reach Postgres.
listen_addresses = '127.0.0.1,::1'
password_encryption = 'scram-sha-256'
CONF
    cat > "$PG_CONF_DIR/pg_hba.conf" <<'HBA'
# MedBrains (native-postgres.sh). Anything not listed is refused.
# TYPE  DATABASE  USER      ADDRESS        METHOD
local   all       postgres                 peer
local   spicedb   spicedb                  peer
host    all       all       127.0.0.1/32   scram-sha-256
host    all       all       ::1/128        scram-sha-256
HBA
    chown postgres:postgres "$PG_CONF_DIR/pg_hba.conf" "$PG_CONF_DIR/conf.d/00-medbrains.conf"
    chmod 0640 "$PG_CONF_DIR/pg_hba.conf"
}

# psql as the postgres superuser over the socket (peer), on <port>.
pg_native_psql() { # port psql-args...
    local port="$1"
    shift
    runuser -u postgres -- "$PG_BIN/psql" -X -q -v ON_ERROR_STOP=1 -p "$port" "$@"
}

# Waits up to 60 s for the cluster on <port> to answer a query.
pg_native_wait() { # port
    local _
    for _ in $(seq 1 60); do
        pg_native_psql "$1" -d postgres -tAc 'SELECT 1' >/dev/null 2>&1 && return 0
        sleep 1
    done
    echo "ERROR: Postgres on port $1 did not answer within 60 s (journalctl -u $PG_UNIT)" >&2
    return 1
}

# A fresh install's owner role and database. The owner is a superuser, as
# POSTGRES_USER was in the container: migrations 0981/0984 create a BYPASSRLS
# role, which only a superuser may do. The password travels on stdin.
pg_native_owner() { # port password
    pg_native_psql "$1" -d postgres >/dev/null <<SQL
DO \$\$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'medbrains') THEN
        CREATE ROLE medbrains LOGIN SUPERUSER;
    END IF;
END \$\$;
ALTER ROLE medbrains LOGIN PASSWORD '$2';
SQL
    pg_native_database "$1" medbrains
}

# Creates <db> owned by medbrains in en_US.UTF-8 unless it exists.
pg_native_database() { # port db
    if [[ "$(pg_native_psql "$1" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$2'")" != 1 ]]; then
        pg_native_psql "$1" -d postgres -c \
            "CREATE DATABASE $2 OWNER medbrains TEMPLATE template0 ENCODING 'UTF8' LOCALE '$PG_LOCALE'"
    fi
}
