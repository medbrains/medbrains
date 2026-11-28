#!/usr/bin/env bash
# Runnable check for medbrains-rollback: a rollback replaces a binary that is
# running, a release that fails its health check is put back, and installing
# the same release twice keeps .prev. No framework and no root: it works in a
# temp directory, with stand-ins for systemctl and curl on PATH.
#   bash deploy/standalone/test-rollback.sh
set -euo pipefail
umask 022

HERE="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d)"
# `|| true`: under `set -e` a failing kill here (the process is already gone)
# would become the script's exit status and skip the clean-up.
trap 'kill "${RUNNING:-}" 2>/dev/null || true; rm -rf "$TMP"' EXIT
export MEDBRAINS_BIN_DIR="$TMP/bin" MEDBRAINS_WEB_ROOT="$TMP/www/medbrains"
export MEDBRAINS_RELEASE_STATE="$TMP/state/release" MEDBRAINS_ENV_FILE="$TMP/env"
export MEDBRAINS_HEALTH_TRIES=1 PATH="$TMP/fake:$HERE:$PATH"
mkdir -p "$TMP/bin" "$TMP/www" "$TMP/fake"
fail=0
# shellcheck disable=SC2016 # the stand-ins expand these themselves
# systemctl stand-in: logs each call; `is-enabled` says no, the rest succeed.
printf '#!/bin/sh\necho "$*" >> "%s/systemctl.log"\n[ "$1" != is-enabled ]\n' "$TMP" > "$TMP/fake/systemctl"
# curl stand-in: healthy only while the live web tree is not the one named in $TMP/sick.
printf '#!/bin/sh\n! grep -qsf "%s/sick" "%s/index.html"\n' "$TMP" "$MEDBRAINS_WEB_ROOT" > "$TMP/fake/curl"
chmod +x "$TMP/fake/systemctl" "$TMP/fake/curl"
echo none > "$TMP/sick"
# Prints PASS or FAIL for one named condition, given as the remaining args.
check() {
    local name="$1"
    shift
    if "$@"; then echo "PASS $name"; else echo "FAIL $name"; fail=1; fi
}

# Stages release $1: a real executable as the server (a copy of bash, which
# runs under any name, with the release name appended so each differs), an
# archive binary and a web build.
make_release() {
    mkdir -p "$TMP/$1/medbrains-web"
    { cat "$BASH"; echo "$1"; } > "$TMP/$1/medbrains-server"
    echo "archive $1" > "$TMP/$1/medbrains-archive"
    echo "<html>$1</html>" > "$TMP/$1/medbrains-web/index.html"
}

# Installs staged release $1 the way install.sh does.
install_release() {
    "$HERE/medbrains-rollback" install "$TMP/$1" medbrains-server medbrains-archive > /dev/null
}

# True when the live server binary, archive binary and web tree are all release $1's.
# shellcheck disable=SC2329 # called through check()
live_is() {
    cmp -s "$TMP/$1/medbrains-server" "$TMP/bin/medbrains-server" \
        && grep -qx "archive $1" "$TMP/bin/medbrains-archive" \
        && grep -q "<html>$1</html>" "$MEDBRAINS_WEB_ROOT/index.html"
}

# True when .prev (server binary and web tree) holds release $1.
# shellcheck disable=SC2329 # called through check()
prev_is() {
    cmp -s "$TMP/$1/medbrains-server" "$TMP/bin/medbrains-server.prev" \
        && grep -q "<html>$1</html>" "$MEDBRAINS_WEB_ROOT.prev/index.html"
}

# Runs the rollback, keeping only its exit status.
roll_back() {
    "$HERE/medbrains-rollback" > /dev/null
}

if "$HERE/medbrains-rollback" > /dev/null 2>&1; then echo "FAIL rollback with no .prev succeeded"; fail=1; fi

make_release r1
make_release r2
install_release r1
install_release r2
check "r2 live, r1 kept as .prev" live_is r2
check ".prev holds r1" prev_is r1
install_release r2
check "installing r2 again keeps r1 in .prev" prev_is r1
check "state file names both releases" grep -q "^previous=r1 " "$TMP/state/release"

# The live server binary is executing, as on a real host, while it is rolled back.
# It blocks opening a pipe nobody writes to, so it holds no child process.
mkfifo "$TMP/hold"
# shellcheck disable=SC2016 # expanded by the stand-in server, not here
"$TMP/bin/medbrains-server" -c 'read -r _ < "$0"' "$TMP/hold" 2> /dev/null &
RUNNING=$!
sleep 1
# macOS kills a modified copy of a signed binary on exec; Linux (CI, every
# host) must run it, or the check below proves nothing.
WAS_RUNNING=0
if kill -0 "$RUNNING" 2> /dev/null; then WAS_RUNNING=1; fi
if [[ "$(uname)" == Linux ]]; then check "the stand-in server is running" test "$WAS_RUNNING" = 1; fi
check "rollback over a running binary succeeds" roll_back
check "rollback puts r1 live" live_is r1
check "rollback keeps r2 as .prev" prev_is r2
if [[ "$WAS_RUNNING" == 1 ]]; then check "the running process was left alone" kill -0 "$RUNNING"; fi
check "services were stopped, the start limit cleared, then started" \
    test "$(grep -c -e '^stop medbrains-server' -e '^reset-failed medbrains-server' -e '^start medbrains-server' "$TMP/systemctl.log")" = 3
check "a unit that is not enabled was left alone" test "$(grep -c -e 'stop medbrains-proxy' "$TMP/systemctl.log")" = 0
check "state file follows the rollback" grep -q "^current=r1 " "$TMP/state/release"

# r2 is live after a second rollback; make r1 fail its health check and roll back to it.
roll_back
check "second rollback rolls forward to r2" live_is r2
echo "<html>r1</html>" > "$TMP/sick"
if "$HERE/medbrains-rollback" > "$TMP/out" 2>&1; then echo "FAIL unhealthy rollback reported success"; fail=1; fi
check "health failure restores r2" live_is r2
check "health failure keeps r1 in .prev" prev_is r1
check "health failure is said out loud" grep -q "ROLLBACK FAILED" "$TMP/out"
check "state file still says r2 is live" grep -q "^current=r2 " "$TMP/state/release"
echo none > "$TMP/sick"
# A rollback killed half-way (binary swapped, web not yet) is finished by running it again.
# shellcheck disable=SC2016 # expanded by the inner shell, which has the helper's functions
bash -c 'source <(sed "/^case /,\$d" "$0"); write_plan; swap_path "$1" "$(sum_of "$1.prev")"' \
    "$HERE/medbrains-rollback" "$TMP/bin/medbrains-server"
roll_back
check "an interrupted rollback is completed, not undone" live_is r1

# r1 is live with r2 in .prev. r3 ships binaries only: the web build stays r1's,
# so a rollback must return to r1's server with r1's web, not r2's.
make_release r3
rm -rf "$TMP/r3/medbrains-web"
install_release r3
check "binaries-only install puts r3's server live" cmp -s "$TMP/r3/medbrains-server" "$TMP/bin/medbrains-server"
check "binaries-only install leaves r1's web live" grep -q "<html>r1</html>" "$MEDBRAINS_WEB_ROOT/index.html"
roll_back
check "rollback after a binaries-only install pairs r1's server with r1's web" live_is r1
roll_back
check "rolling forward again keeps r1's web under r3's server" \
    grep -q "<html>r1</html>" "$MEDBRAINS_WEB_ROOT/index.html"
check "rolling forward again puts r3's server live" cmp -s "$TMP/r3/medbrains-server" "$TMP/bin/medbrains-server"

exit "$fail"
