#!/usr/bin/env bash
# Proves the chosen password leaves the env, and only once the server has answered. Linux only
# (GNU sed): run in the image builder or on a machine. Fails if console-status stops doing this.
set -euo pipefail
[[ "$(uname -s)" == Linux ]] || { echo "SKIP: needs GNU sed"; exit 0; }

HERE="$(cd "$(dirname "$0")" && pwd)"
work="$(mktemp -d)"
trap 'kill "${server:-}" "${script:-}" 2>/dev/null; rm -rf "$work"' EXIT
printf 'MEDBRAINS_ENV=production\nMEDBRAINS_SEED_ADMIN_PASSWORD="Ward-Seven7"\nMEDBRAINS_SEED_HOSPITAL_NAME="City"\n' > "$work/env"

MEDBRAINS_ENV_FILE="$work/env" MEDBRAINS_HEALTH_URL=http://127.0.0.1:38765/ MEDBRAINS_POLL_S=1 \
    bash "$HERE/../mkosi.extra/usr/lib/medbrains/console-status" &
script=$!
sleep 2
grep -q Ward-Seven7 "$work/env" || { echo "FAIL: stripped before the server answered"; exit 1; }

(cd "$work" && exec python3 -m http.server 38765 --bind 127.0.0.1 >/dev/null 2>&1) &
server=$!
wait "$script"
if grep -q MEDBRAINS_SEED_ "$work/env"; then echo "FAIL: seed lines left"; exit 1; fi
grep -q '^MEDBRAINS_ENV=production$' "$work/env" || { echo "FAIL: other settings lost"; exit 1; }
echo PASS
