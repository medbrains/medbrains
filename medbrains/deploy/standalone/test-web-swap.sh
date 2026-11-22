#!/usr/bin/env bash
# Runnable check for medbrains-web-swap: an open tab's old chunk survives a
# swap, a failed install leaves the live tree alone, and rollback restores
# .prev. No framework and no root: it works in a temp directory it owns.
#   bash deploy/standalone/test-web-swap.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SWAP="$HERE/medbrains-web-swap"
TMP="$(mktemp -d)"
trap 'chmod -R u+w "$TMP" 2>/dev/null; rm -rf "$TMP"' EXIT
chmod 0755 "$TMP"
export MEDBRAINS_WEB_ROOT="$TMP/www/medbrains"
mkdir -m 0755 "$TMP/www"
LIVE="$MEDBRAINS_WEB_ROOT"
fail=0

# Prints PASS or FAIL for one named condition, given as the remaining args.
check() {
    local name="$1"
    shift
    if "$@"; then echo "PASS $name"; else echo "FAIL $name"; fail=1; fi
}

# Writes a fake dist build $1 whose one hashed chunk is assets/$2.
make_build() {
    mkdir -p "$TMP/$1/assets"
    echo "<html>$1</html>" > "$TMP/$1/index.html"
    echo "chunk $1" > "$TMP/$1/assets/$2"
}

# True when the live index.html is build $1's.
# shellcheck disable=SC2329 # called through check()
live_is() {
    grep -q "<html>$1</html>" "$LIVE/index.html"
}

# A host still on the old layout: a real directory, no symlink yet.
mkdir -p "$LIVE/assets"
echo "<html>legacy</html>" > "$LIVE/index.html"
echo "chunk legacy" > "$LIVE/assets/legacy-0.js"

make_build r1 r1-aaa.js
"$SWAP" install "$TMP/r1" >/dev/null
check "legacy tree adopted, r1 live" live_is r1
check "live path is now a symlink" test -L "$LIVE"
check "legacy chunk still served after first swap" test -f "$LIVE/assets/legacy-0.js"

make_build r2 r2-bbb.js
"$SWAP" install "$TMP/r2" >/dev/null
check "r2 live" live_is r2
check "old chunk r1 still served after swap" test -f "$LIVE/assets/r1-aaa.js"
check "chunk two releases old is pruned" test ! -e "$LIVE/assets/legacy-0.js"
check ".prev holds r1" grep -q "<html>r1</html>" "$LIVE.prev/index.html"
check "only live and prev trees kept" test "$(find "$LIVE.d" -mindepth 1 -maxdepth 1 | wc -l | tr -d ' ')" = 2
check "no tree writable by group or others" \
    test -z "$(find "$LIVE.d" \( -perm -002 -o -perm -020 \) -print -quit)"

# A build that cannot be copied (an unreadable file) must not touch the live tree.
make_build bad bad-ccc.js
chmod 000 "$TMP/bad/assets/bad-ccc.js"
if "$SWAP" install "$TMP/bad" >/dev/null 2>&1; then echo "FAIL failed copy reported success"; fail=1; fi
check "failed install leaves r2 live" live_is r2
check "failed install leaves no half-built tree" \
    test "$(find "$LIVE.d" -mindepth 1 -maxdepth 1 | wc -l | tr -d ' ')" = 2
check "failed install leaves .prev as r1" grep -q "<html>r1</html>" "$LIVE.prev/index.html"

# A build others can write to is refused before anything is copied.
make_build loose loose-ddd.js
chmod 0666 "$TMP/loose/index.html"
if "$SWAP" install "$TMP/loose" >/dev/null 2>&1; then echo "FAIL writable build accepted"; fail=1; fi
check "writable build refused, r2 live" live_is r2

"$SWAP" rollback >/dev/null
check "rollback restores r1 from .prev" live_is r1
check "rollback keeps r2 as .prev" grep -q "<html>r2</html>" "$LIVE.prev/index.html"
"$SWAP" rollback >/dev/null
check "second rollback rolls forward to r2" live_is r2

# A web root whose parent others can write to is refused outright.
chmod 0777 "$TMP/www"
if "$SWAP" rollback >/dev/null 2>&1; then echo "FAIL world-writable parent accepted"; fail=1; fi
chmod 0755 "$TMP/www"

exit "$fail"
