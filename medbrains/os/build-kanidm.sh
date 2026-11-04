#!/usr/bin/env bash
# Compiles the identity provider (Kanidm) from one pinned release with zigbuild. build.sh stages the
# result into the image. No Docker, and no image of theirs. Its web UI is server-rendered, so there
# is no JavaScript build: the static files ship as they are, with our override.css in the image.
#
#   os/build-kanidm.sh [--arch arm64|x86-64]
#
# OS_WORK (source and output) and OS_TARGET_DIR (cargo's target) move it.
# Upgrading: change KANIDM_VERSION, KANIDM_COMMIT and KANIDM_SHA256 after reading its advisories.
set -euo pipefail

KANIDM_VERSION=v1.12.0
KANIDM_COMMIT=a52b723ce8efb1f4d0a6bc2a2c36b4071f95317d
KANIDM_SHA256=b4589475d0f12f259c98c4934fd65b924819afb51c4d12ce256f9e9fe4d137bf
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
[[ "${1:-}" == --arch ]] && ARCH="$2"
case "$ARCH" in
    arm64) TRIPLE=aarch64-unknown-linux-gnu; DEB_ARCH=arm64; MULTIARCH=aarch64-linux-gnu ;;
    x86-64) TRIPLE=x86_64-unknown-linux-gnu; DEB_ARCH=amd64; MULTIARCH=x86_64-linux-gnu ;;
    *) echo "unsupported arch: $ARCH" >&2; exit 2 ;;
esac

HERE="$(cd "$(dirname "$0")" && pwd)"
OS_WORK="${OS_WORK:-/tmp/mb-osimage}"
OS_TARGET_DIR="${OS_TARGET_DIR:-/tmp/mb-target-kanidm}"
SRC="$OS_WORK/kanidm-src-$KANIDM_VERSION"
OUT="$OS_WORK/kanidm-$ARCH"

if [[ ! -f "$SRC/Cargo.lock" ]]; then
    archive="$(mktemp)"
    curl -fsSL -o "$archive" "https://codeload.github.com/kanidm/kanidm/tar.gz/$KANIDM_COMMIT"
    echo "$KANIDM_SHA256  $archive" | shasum -a 256 -c - >/dev/null
    rm -rf "$SRC"; mkdir -p "$SRC"
    tar xzf "$archive" -C "$SRC" --strip-components=1
    rm -f "$archive"
fi

SSL="$OS_WORK/kanidm-openssl-$ARCH"
# Unpacks one verified Debian package into $SSL.
unpack_openssl_deb() {
    local deb sha_var="$2"
    deb="$(mktemp)"
    curl -fsSL -o "$deb" "$OPENSSL_POOL/${1}_${OPENSSL_VERSION}_${DEB_ARCH}.deb"
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

# The tag's Cargo.lock still names Kanidm's own crates as -pre. Nothing else may differ: --locked
# below refuses any other change, so third-party versions stay as they pinned them.
sed -i.orig 's/^version = "1\.12\.0-pre"$/version = "1.12.0"/' "$SRC/Cargo.lock"

bash "$HERE/../scripts/build_guard.sh" --wait
# The trailing .2.41 is trixie's glibc: Debian's libssl needs symbols older targets lack.
# Debug info off: its release profile keeps it, and it would only add to the image.
(cd "$SRC" && env -u MAKEFLAGS -u ARCH RUSTUP_TOOLCHAIN=1.99.0 CARGO_TARGET_DIR="$OS_TARGET_DIR" \
    KANIDM_BUILD_PROFILE=release_linux CARGO_PROFILE_RELEASE_DEBUG=false CARGO_PROFILE_RELEASE_STRIP=debuginfo \
    OPENSSL_INCLUDE_DIR="$SSL/usr/include" OPENSSL_LIB_DIR="$SSL/usr/lib/$MULTIARCH" \
    cargo zigbuild --release --locked --target="$TRIPLE.2.41" -p daemon --bin kanidmd)

rm -rf "$OUT"; mkdir -p "$OUT"
install -m 0755 "$OS_TARGET_DIR/$TRIPLE/release/kanidmd" "$OUT/kanidmd"
cp -R "$SRC/server/core/static" "$OUT/hpkg"
ls -lh "$OUT"
