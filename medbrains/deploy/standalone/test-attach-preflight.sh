#!/usr/bin/env bash
# Runnable check for attach-preflight.sh. No framework: bash + asserts.
#   bash deploy/standalone/test-attach-preflight.sh
set -euo pipefail

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

export MEDBRAINS_PORTS_FILE="$TMP/ports"
# shellcheck source=./attach-preflight.sh
. "$(cd "$(dirname "$0")" && pwd)/attach-preflight.sh"

fail=0
check() { # check <label> <expected> <actual>
    if [[ "$2" == "$3" ]]; then
        echo "ok   $1"
    else
        echo "FAIL $1: expected '$2', got '$3'"
        fail=1
    fi
}

# A busy port must be stepped over, never taken.
port_taken() { [[ "$1" == "3000" || "$1" == "3001" ]]; }
check "steps over a port another app holds" 3002 "$(choose_port PORT 3000 server)"

# A free preferred port is used as-is.
port_taken() { return 1; }
check "takes the preferred port when free" 7811 "$(choose_port EDGE_PORT 7811 edge)"

# Second run: the port is busy because WE hold it. Re-probing would walk
# the service to a new port and silently break the operator's proxy.
printf 'PORT=3002\n' > "$MEDBRAINS_PORTS_FILE"
port_taken() { [[ "$1" == "3002" ]]; }
check "keeps the port it already claimed" 3002 "$(choose_port PORT 3000 server)"

# Reusing the host's postgres must not claim a postgres port at all.
rm -f "$MEDBRAINS_PORTS_FILE"
port_taken() { return 1; }
ATTACH_REUSE_POSTGRES=1 ATTACH_DATABASE_URL="postgres://u:p@127.0.0.1:5432/db" attach_claim_ports
check "no postgres port when reusing the host's" "" "$PG_PORT"
check "claims are recorded for the next run" 3000 "$(env_file_value PORT "$MEDBRAINS_PORTS_FILE")"

# Every consecutive port busy = an operator problem, not a wider scan.
port_taken() { return 0; }
rm -f "$MEDBRAINS_PORTS_FILE"
if choose_port PORT 3000 server 2>/dev/null; then
    echo "FAIL gives up when nothing is free"
    fail=1
else
    echo "ok   gives up when nothing is free"
fi

exit "$fail"
