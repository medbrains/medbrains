#!/usr/bin/env bash
# build-kanidm.sh must stop before compiling anything if upstream changed: a tampered source archive, a
# changed lock file, or a version nobody pinned. Runs alone, with no VM.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
BUILD="$HERE/../build-kanidm.sh"
GOOD_ARCHIVE="${1:?usage: kanidm-pin-test.sh path/to/pinned-kanidm-1.12.0.tar.gz}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Passes only if the build exits non-zero and says it is not pinned, proving it stopped at the check.
expect_refused() {
    local name="$1" script="$2" arch_work="$3" output
    shift 3
    if output="$(OS_WORK="$arch_work" bash "$script" "$@" 2>&1)"; then
        echo "FAIL  $name: the build went on"
        exit 1
    fi
    if ! grep -q 'not pinned\|not the pinned' <<<"$output"; then
        echo "FAIL  $name: it failed for another reason: $(tail -1 <<<"$output")"
        exit 1
    fi
    echo "PASS  $name"
}

mkdir -p "$WORK/unpinned"
expect_refused "a version nobody pinned is refused" "$BUILD" "$WORK/unpinned" --version 1.10.3

mkdir -p "$WORK/tampered/x"
tar xzf "$GOOD_ARCHIVE" -C "$WORK/tampered/x" --strip-components=1 '*/README.md'
echo tampered >> "$WORK/tampered/x/README.md"
tar czf "$WORK/tampered/kanidm-1.12.0.tar.gz" -C "$WORK/tampered" x
rm -rf "$WORK/tampered/x"
expect_refused "a changed source archive is refused" "$BUILD" "$WORK/tampered"

# A changed dependency shows as a changed lock file inside an archive with the same pin otherwise, so
# this copy of the script accepts the archive and must still refuse the lock.
mkdir -p "$WORK/lock/x"
tar xzf "$GOOD_ARCHIVE" -C "$WORK/lock/x" --strip-components=1
echo '# one changed dependency' >> "$WORK/lock/x/Cargo.lock"
tar czf "$WORK/lock/kanidm-1.12.0.tar.gz" -C "$WORK/lock/x" .
rm -rf "$WORK/lock/x"
archive_hash="$(shasum -a 256 "$WORK/lock/kanidm-1.12.0.tar.gz" | cut -d' ' -f1)"
sed "s/b4589475d0f12f259c98c4934fd65b924819afb51c4d12ce256f9e9fe4d137bf/$archive_hash/" "$BUILD" > "$WORK/build-lock.sh"
# --strip-components=1 in the script drops the leading ./ this archive has, so put one level back.
mkdir -p "$WORK/lock/y"
tar xzf "$WORK/lock/kanidm-1.12.0.tar.gz" -C "$WORK/lock/y"
tar czf "$WORK/lock/kanidm-1.12.0.tar.gz" -C "$WORK/lock" y
rm -rf "$WORK/lock/y"
archive_hash2="$(shasum -a 256 "$WORK/lock/kanidm-1.12.0.tar.gz" | cut -d' ' -f1)"
sed -i.bak "s/$archive_hash/$archive_hash2/" "$WORK/build-lock.sh"
expect_refused "a changed Cargo.lock is refused" "$WORK/build-lock.sh" "$WORK/lock"
echo "ALL PASSED"
