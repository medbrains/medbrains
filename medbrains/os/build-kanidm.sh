#!/usr/bin/env bash
# Compiles the identity provider (Kanidm) from one pinned release with zigbuild. build.sh stages the
# result into the image. No Docker, and no image of theirs. Its web UI is server-rendered, so there
# is no JavaScript build: the static files ship as they are, with our override.css in the image.
#
#   os/build-kanidm.sh [--arch arm64|x86-64]
#
# OS_WORK (source and output) and OS_TARGET_DIR (cargo's target) move it.
# --version picks another pinned release, for stepping an older machine through upgrades.
#
# Pinned three ways, so a changed upstream fails here: the commit and SHA-256 of the source, the SHA-256
# of Cargo.lock, which holds a checksum for every dependency, and a build from a vendored copy with
# --frozen, which cargo checks against that lock and which cannot reach the network.
# Upgrading: read its advisories, then add a row with the commit and both hashes.
set -euo pipefail

# Prints the pinned commit, source hash and lock hash of a release, or nothing if it is not pinned.
pins_of() {
    case "$1" in
        1.12.0) echo a52b723ce8efb1f4d0a6bc2a2c36b4071f95317d b4589475d0f12f259c98c4934fd65b924819afb51c4d12ce256f9e9fe4d137bf fe28b5c2b5793fcc690f1298247e78a39af0e7ccc6e6a9ac913b6e849d3f3782 ;;
        1.11.2) echo 547933867e87da737e79d26942dc9261adaa5ee9 8feb9485647d18ae4327447931b2b821b9f15fb140c5f0f2e6c7d52c820a0074 43686a6ba8b26ba80b1408d0d2331a847c583b5bd68a55ea95663670dbadef55 ;;
    esac
}
# Its reqwest links OpenSSL, so the headers and libraries come from the Debian release the image
# runs, and it uses the image's own libssl3 at run time. ponytail: Debian removes superseded debs,
# so these hashes fail on the next OpenSSL fix; bump them.
OPENSSL_POOL=https://security.debian.org/debian-security/pool/updates/main/o/openssl
OPENSSL_VERSION=3.5.7-1~deb13u3
SSL_DEV_arm64=ee3ce1214925d3905a8ad54ea1250b016438322f73a9719474fcd0ece6243a8e
SSL_LIB_arm64=d0681293a160392186c6ef85a165e40603d1628a099936137d24d391bd591f97
SSL_DEV_amd64=c5f5f0383cac45209fefe85b3c3308e5ef6743663597d89bedcb96aaa06b8342
SSL_LIB_amd64=ff16bc048bcd7d1b256094450b79c77947d8e76fe2a24bd99b91021d591fa074
ARCH=arm64
KANIDM_VERSION=1.12.0
while [[ $# -gt 0 ]]; do
    case "$1" in
        --arch) ARCH="$2"; shift 2 ;;
        --version) KANIDM_VERSION="$2"; shift 2 ;;
        *) echo "unknown option: $1" >&2; exit 2 ;;
    esac
done
read -r KANIDM_COMMIT KANIDM_SHA256 KANIDM_LOCK_SHA256 <<<"$(pins_of "$KANIDM_VERSION")"
[[ -n "${KANIDM_COMMIT:-}" ]] || { echo "Kanidm $KANIDM_VERSION is not pinned" >&2; exit 2; }
case "$ARCH" in
    arm64) TRIPLE=aarch64-unknown-linux-gnu; DEB_ARCH=arm64; MULTIARCH=aarch64-linux-gnu ;;
    x86-64) TRIPLE=x86_64-unknown-linux-gnu; DEB_ARCH=amd64; MULTIARCH=x86_64-linux-gnu ;;
    *) echo "unsupported arch: $ARCH" >&2; exit 2 ;;
esac

HERE="$(cd "$(dirname "$0")" && pwd)"
OS_WORK="${OS_WORK:-/tmp/mb-osimage}"
OS_TARGET_DIR="${OS_TARGET_DIR:-/tmp/mb-target-kanidm}"
SRC="$OS_WORK/kanidm-src-$KANIDM_VERSION"
ARCHIVE="$OS_WORK/kanidm-$KANIDM_VERSION.tar.gz"
VENDOR="$OS_WORK/kanidm-vendor-$KANIDM_VERSION"
OUT="$OS_WORK/kanidm-$ARCH"
[[ "$KANIDM_VERSION" == 1.12.0 ]] || OUT="$OS_WORK/kanidm-$KANIDM_VERSION-$ARCH"

# Fails the build if a file's SHA-256 is not the pinned one.
require_sha256() {
    echo "$2  $1" | shasum -a 256 -c - >/dev/null || { echo "$1 is not the pinned Kanidm $KANIDM_VERSION" >&2; exit 1; }
}

mkdir -p "$OS_WORK"
[[ -f "$ARCHIVE" ]] || curl --proto '=https' --tlsv1.2 -fsSL -o "$ARCHIVE" "https://codeload.github.com/kanidm/kanidm/tar.gz/$KANIDM_COMMIT"
require_sha256 "$ARCHIVE" "$KANIDM_SHA256"
# From the archive every time, so nothing edited on disk reaches a build.
rm -rf "$SRC"; mkdir -p "$SRC"
tar xzf "$ARCHIVE" -C "$SRC" --strip-components=1
# The 1.12.0 tag's Cargo.lock still names Kanidm's own crates as -pre, and nothing else differs.
sed -i.orig 's/^version = "1\.12\.0-pre"$/version = "1.12.0"/' "$SRC/Cargo.lock"
require_sha256 "$SRC/Cargo.lock" "$KANIDM_LOCK_SHA256"

SSL="$OS_WORK/kanidm-openssl-$ARCH"
# Unpacks one verified Debian package into $SSL.
unpack_openssl_deb() {
    local deb sha_var="$2"
    deb="$(mktemp)"
    curl --proto '=https' --tlsv1.2 -fsSL -o "$deb" "$OPENSSL_POOL/${1}_${OPENSSL_VERSION}_${DEB_ARCH}.deb"
    echo "${!sha_var}  $deb" | shasum -a 256 -c - >/dev/null
    (cd "$SSL" && ar p "$deb" data.tar.xz | tar xJ)
    rm -f "$deb"
}
if [[ ! -e "$SSL/usr/lib/$MULTIARCH/libssl.so.3" ]]; then
    rm -rf "$SSL"; mkdir -p "$SSL"
    unpack_openssl_deb libssl-dev "SSL_DEV_$DEB_ARCH"
    unpack_openssl_deb libssl3t64 "SSL_LIB_$DEB_ARCH"
    cp -R "$SSL/usr/include/$MULTIARCH/openssl/." "$SSL/usr/include/openssl/"
fi

# Our one change to Kanidm: see the patch. Refuses to build if it does not apply exactly.
for carried in "$HERE"/patches/kanidm-*.patch; do
    (cd "$SRC" && patch -p1 --forward --fuzz=0 < "$carried")
done

bash "$HERE/../scripts/build_guard.sh" --wait
if [[ ! -f "$VENDOR.config" ]]; then
    (cd "$SRC" && RUSTUP_TOOLCHAIN=1.99.1 cargo vendor --locked --versioned-dirs "$VENDOR") > "$VENDOR.config.new"
    mv "$VENDOR.config.new" "$VENDOR.config"
fi
cat "$VENDOR.config" >> "$SRC/.cargo/config.toml"
# The trailing .2.41 is trixie's glibc: Debian's libssl needs symbols older targets lack.
# Debug info off: its release profile keeps it, and it would only add to the image.
(cd "$SRC" && env -u MAKEFLAGS -u ARCH RUSTUP_TOOLCHAIN=1.99.1 CARGO_TARGET_DIR="$OS_TARGET_DIR" \
    KANIDM_BUILD_PROFILE=release_linux CARGO_PROFILE_RELEASE_DEBUG=false CARGO_PROFILE_RELEASE_STRIP=debuginfo \
    OPENSSL_INCLUDE_DIR="$SSL/usr/include" OPENSSL_LIB_DIR="$SSL/usr/lib/$MULTIARCH" \
    cargo zigbuild --release --frozen --target="$TRIPLE.2.41" -p daemon --bin kanidmd)

rm -rf "$OUT"; mkdir -p "$OUT"
install -m 0755 "$OS_TARGET_DIR/$TRIPLE/release/kanidmd" "$OUT/kanidmd"
cp -R "$SRC/server/core/static" "$OUT/hpkg"
ls -lh "$OUT"
