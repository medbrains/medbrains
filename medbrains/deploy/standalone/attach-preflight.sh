#!/usr/bin/env bash
# Attach tier — port arbitration for a host that already belongs to
# somebody else's applications.
#
# The dedicated install assumes it owns the box: it takes 3000, 5432,
# 7811, 8382, 3005 and both 80 and 443, and stops whatever is holding
# them. On a host already serving an ERP and thirty other names that is
# not an install, it is an outage.
#
# Sourced by install.sh when ATTACH_MODE=1. Kept in its own file so the
# arbitration can be tested without running the installer — see
# test-attach-preflight.sh.

PORTS_FILE="${MEDBRAINS_PORTS_FILE:-/etc/medbrains/ports}"

# port_taken <port> — true when anything is already listening.
port_taken() {
    if command -v ss >/dev/null 2>&1; then
        [[ -n "$(ss -ltnH "sport = :$1" 2>/dev/null)" ]]
    else
        netstat -ltn 2>/dev/null | awk '{ print $4 }' | grep -qE "[:.]$1\$"
    fi
}

# env_file_value <key> <file> — value of KEY= in an env file, or empty.
env_file_value() {
    [[ -r "$2" ]] || return 0
    awk -F= -v k="$1" '$1 == k { v = substr($0, index($0, "=") + 1) } END { print v }' "$2"
}

# choose_port <key> <preferred> <label>
#
# A port this install already claimed wins over probing. On the second
# deploy the port is busy *because we are the ones using it*, and a
# fresh probe would walk the service onto a new port every run, which
# breaks the reverse-proxy config the operator wrote by hand.
choose_port() {
    local key="$1" preferred="$2" label="$3"
    local claimed port tries=0

    claimed="$(env_file_value "$key" "$PORTS_FILE")"
    if [[ -n "$claimed" ]]; then
        printf '%s' "$claimed"
        return 0
    fi

    port="$preferred"
    # ponytail: linear scan, 20 ports. A host with 20 consecutive ports
    # busy from the preferred one wants an operator, not a wider scan.
    while port_taken "$port"; do
        tries=$((tries + 1))
        if [[ "$tries" -gt 20 ]]; then
            echo "ERROR: no free port for $label in ${preferred}-$((preferred + 20))" >&2
            return 1
        fi
        port=$((port + 1))
    done
    printf '%s' "$port"
}

# attach_claim_ports — resolve every port this install needs and record
# the choices. Sets APP_PORT / EDGE_PORT / GOTENBERG_PORT / ICD_PORT /
# PG_PORT.
attach_claim_ports() {
    APP_PORT="$(choose_port PORT 3000 medbrains-server)" || return 1
    EDGE_PORT="$(choose_port EDGE_PORT 7811 medbrains-edge)" || return 1
    GOTENBERG_PORT="$(choose_port GOTENBERG_PORT 3005 gotenberg)" || return 1
    ICD_PORT="$(choose_port ICD_API_PORT "${ICD_API_PORT:-8382}" 'WHO ICD-API')" || return 1

    if [[ "${ATTACH_REUSE_POSTGRES:-0}" == "1" && -n "${ATTACH_DATABASE_URL:-}" ]]; then
        PG_PORT=""
    else
        PG_PORT="$(choose_port PG_PORT 5432 postgres)" || return 1
    fi

    mkdir -p "$(dirname "$PORTS_FILE")"
    cat > "$PORTS_FILE" <<PORTS
PORT=$APP_PORT
EDGE_PORT=$EDGE_PORT
GOTENBERG_PORT=$GOTENBERG_PORT
ICD_API_PORT=$ICD_PORT
PG_PORT=$PG_PORT
PORTS
    chmod 644 "$PORTS_FILE"
}

# attach_report_ports — what we took, and what we deliberately did not.
attach_report_ports() {
    echo "    medbrains-server  127.0.0.1:$APP_PORT"
    echo "    medbrains-edge    127.0.0.1:$EDGE_PORT"
    echo "    gotenberg         127.0.0.1:$GOTENBERG_PORT"
    if [[ -z "$PG_PORT" ]]; then
        echo "    postgres          reusing the host's — no container started"
    else
        echo "    postgres          127.0.0.1:$PG_PORT"
    fi
    if [[ "${ATTACH_REUSE_TLS:-0}" == "1" ]]; then
        echo "    80 / 443          left alone — the host's proxy keeps them"
    fi
}

# attach_proxy_snippet <domain> — the reverse-proxy config the operator
# adds to whatever already terminates TLS on this host. Printed rather
# than written: we do not edit another application's proxy config.
attach_proxy_snippet() {
    local domain="$1"
    cat <<SNIPPET

    ── Add this to the proxy already serving TLS on this host ──

    Caddy (/etc/caddy/Caddyfile):

      $domain {
          request_body { max_size 25MB }
          reverse_proxy /ws*  127.0.0.1:$EDGE_PORT
          reverse_proxy       127.0.0.1:$APP_PORT
      }

    nginx (server block for $domain, inside your existing TLS config):

      location /ws {
          proxy_pass http://127.0.0.1:$EDGE_PORT;
          proxy_http_version 1.1;
          proxy_set_header Upgrade \$http_upgrade;
          proxy_set_header Connection "upgrade";
          proxy_read_timeout 3600s;
      }
      location / {
          proxy_pass http://127.0.0.1:$APP_PORT;
          proxy_set_header Host \$host;
          proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto \$scheme;
          client_max_body_size 25m;
      }

    Then reload that proxy. MedBrains never touches 80 or 443 in this mode.

    Pingora is not running here, so the limits it normally applies at the
    edge are now this proxy's job. The body cap above is the one that
    matters; the rest - per-route timeouts, method allowlists, no-store
    on /api - are defence in depth the application also enforces.
SNIPPET
}
