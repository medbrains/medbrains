#!/usr/bin/env bash
# Database roles — gives the two roles of migrations 0981 and 0984 a password
# and points the env file at them:
#
#   DATABASE_URL            medbrains_app            requests; row level security applies
#   MIGRATION_DATABASE_URL  the owner                migrations and seeding
#   WORKER_DATABASE_URL     medbrains_outbox_worker  background passes; crosses tenants
#
# Until this runs, everything connects as the owner, and Postgres skips row
# level security for the owner. See docs/ops/DB-ROLES.md.
#
# Sourced by install.sh and test-db-roles.sh. Run directly for the one-time
# switch of an existing install:
#
#   sudo bash db-roles.sh /etc/medbrains/env
#
# The roles are created here if migrations have not created them yet (a fresh
# install writes the env before the server's first boot runs migrations), with
# the attributes the migrations give them; grants stay with the migrations.
# Passwords already in the env file are kept, so a re-run changes nothing.
# Nothing is written unless both roles have just logged in with the new URLs.
# No password is printed or passed as a command argument.

DB_APP_ROLE=medbrains_app
DB_WORKER_ROLE=medbrains_outbox_worker
# The dedicated install's Postgres container. When it exists, admin SQL runs
# inside it over the socket; otherwise over the owner's URL.
DB_ROLES_CONTAINER="${DB_ROLES_CONTAINER:-medbrains-postgres}"

db_env_get() { # key file
    [[ -r "$2" ]] || return 0
    awk -F= -v k="$1" '$1 == k { v = substr($0, index($0, "=") + 1) } END { print v }' "$2"
}

# Rewritten by line through ENVIRON: a URL may hold any character sed would
# read as a delimiter. `cat >` keeps the file's owner and mode.
db_env_set() { # key value file
    local tmp
    tmp="$(mktemp "$3.XXXXXX")"
    K="$1" V="$2" awk '
        BEGIN { k = ENVIRON["K"]; v = ENVIRON["V"] }
        index($0, k "=") == 1 { if (!done) print k "=" v; done = 1; next }
        { print }
        END { if (!done) print k "=" v }' "$3" > "$tmp"
    cat "$tmp" > "$3"
    rm -f "$tmp"
}

# ponytail: assumes an unencoded password (ours are alphanumeric). A
# percent-encoded owner password would need decoding before PGPASSWORD.
db_url_user() { sed -E 's|^[a-z]+://([^:@/]*).*$|\1|' <<<"$1"; }
db_url_password() { sed -nE 's|^[a-z]+://[^:@/]*:([^@]*)@.*$|\1|p' <<<"$1"; }
db_url_dbname() { sed -E 's|.*/([^/?]+)(\?.*)?$|\1|' <<<"$1"; }
db_url_as() { # url user [password] — same host, port, database and options
    local rest="${1#*@}" scheme="${1%%://*}"
    if [[ -n "${3:-}" ]]; then
        printf '%s://%s:%s@%s' "$scheme" "$2" "$3" "$rest"
    else
        printf '%s://%s@%s' "$scheme" "$2" "$rest"
    fi
}
db_new_password() { openssl rand -base64 48 | LC_ALL=C tr -cd 'A-Za-z0-9' | cut -c1-32; }

# The owner lives in MIGRATION_DATABASE_URL once split, in DATABASE_URL before.
db_roles_owner_key() { # file
    if [[ -n "$(db_env_get MIGRATION_DATABASE_URL "$1")" ]]; then
        echo MIGRATION_DATABASE_URL
    else
        echo DATABASE_URL
    fi
}

# A role's existing password, if the env file already names that role.
db_kept_password() { # file key role
    local url
    url="$(db_env_get "$2" "$1")"
    [[ -n "$url" && "$(db_url_user "$url")" == "$3" ]] && db_url_password "$url"
    return 0
}

db_roles_sql() { # app_password worker_password
    cat <<SQL
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$DB_APP_ROLE') THEN
        CREATE ROLE $DB_APP_ROLE LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
            NOINHERIT NOREPLICATION NOBYPASSRLS;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$DB_WORKER_ROLE') THEN
        CREATE ROLE $DB_WORKER_ROLE LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
            NOINHERIT NOREPLICATION BYPASSRLS;
    END IF;
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO $DB_APP_ROLE, $DB_WORKER_ROLE',
                   current_database());
END \$\$;
ALTER ROLE $DB_APP_ROLE LOGIN PASSWORD '$1';
ALTER ROLE $DB_WORKER_ROLE LOGIN PASSWORD '$2';
SQL
}

db_use_container() {
    command -v docker >/dev/null 2>&1 &&
        docker container inspect "$DB_ROLES_CONTAINER" >/dev/null 2>&1
}

# SQL on stdin, as the owner. On a reused host Postgres whose owner may not
# create a BYPASSRLS role, the local postgres superuser is the fallback.
db_admin_psql() { # owner_url
    local sql user
    sql="$(cat)"
    user="$(db_url_user "$1")"
    if db_use_container; then
        docker exec -i "$DB_ROLES_CONTAINER" psql -X -q -v ON_ERROR_STOP=1 \
            -U "$user" -d "$(db_url_dbname "$1")" <<<"$sql"
        return
    fi
    PGPASSWORD="$(db_url_password "$1")" psql -X -q -v ON_ERROR_STOP=1 \
        "$(db_url_as "$1" "$user")" <<<"$sql" 2>/dev/null && return 0
    id postgres >/dev/null 2>&1 && command -v sudo >/dev/null 2>&1 &&
        sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 -d "$(db_url_dbname "$1")" <<<"$sql"
}

# Proves a role logs in with a password over TCP — what the server will do.
db_login_psql() { # url
    local user
    user="$(db_url_user "$1")"
    if db_use_container; then
        PGPASSWORD="$(db_url_password "$1")" docker exec -i -e PGPASSWORD "$DB_ROLES_CONTAINER" \
            psql -X -q -tA -v ON_ERROR_STOP=1 -h 127.0.0.1 -U "$user" -d "$(db_url_dbname "$1")"
    else
        PGPASSWORD="$(db_url_password "$1")" psql -X -q -tA -v ON_ERROR_STOP=1 \
            "$(db_url_as "$1" "$user")"
    fi
}

db_roles_configure() { # env_file
    local file="$1" owner_url app_pw worker_pw app_url worker_url url
    owner_url="$(db_env_get "$(db_roles_owner_key "$file")" "$file")"
    if [[ -z "$owner_url" ]]; then
        echo "ERROR: no owner database URL in $file" >&2
        return 1
    fi
    case "$(db_url_user "$owner_url")" in
        "$DB_APP_ROLE" | "$DB_WORKER_ROLE")
            echo "ERROR: the owner URL names $(db_url_user "$owner_url"); set MIGRATION_DATABASE_URL to the owner" >&2
            return 1 ;;
    esac

    app_pw="$(db_kept_password "$file" DATABASE_URL "$DB_APP_ROLE")"
    worker_pw="$(db_kept_password "$file" WORKER_DATABASE_URL "$DB_WORKER_ROLE")"
    [[ -n "$app_pw" ]] || app_pw="$(db_new_password)"
    [[ -n "$worker_pw" ]] || worker_pw="$(db_new_password)"
    app_url="$(db_url_as "$owner_url" "$DB_APP_ROLE" "$app_pw")"
    worker_url="$(db_url_as "$owner_url" "$DB_WORKER_ROLE" "$worker_pw")"

    if ! db_roles_sql "$app_pw" "$worker_pw" | db_admin_psql "$owner_url" >/dev/null; then
        echo "ERROR: could not create or set passwords for $DB_APP_ROLE / $DB_WORKER_ROLE" >&2
        return 1
    fi
    for url in "$app_url" "$worker_url"; do
        if ! db_login_psql "$url" <<<'SELECT 1' >/dev/null 2>&1; then
            echo "ERROR: $(db_url_user "$url") cannot log in (check pg_hba.conf); $file unchanged" >&2
            return 1
        fi
    done

    db_env_set MIGRATION_DATABASE_URL "$owner_url" "$file"
    db_env_set DATABASE_URL "$app_url" "$file"
    db_env_set WORKER_DATABASE_URL "$worker_url" "$file"
    echo "    database roles: requests=$DB_APP_ROLE, workers=$DB_WORKER_ROLE, migrations=$(db_url_user "$owner_url")"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
    set -euo pipefail
    db_roles_configure "${1:-/etc/medbrains/env}"
fi
