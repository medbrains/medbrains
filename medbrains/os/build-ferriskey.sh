#!/usr/bin/env bash
# Compiles the identity provider (FerrisKey) from one pinned commit: the API with zigbuild, the
# console with pnpm. build.sh stages the result into the image. No Docker, and no image of theirs.
#
#   os/build-ferriskey.sh [--arch arm64|x86-64]
#
# OS_WORK (source and output) and OS_TARGET_DIR (cargo's target) move it.
# Upgrading: change FK_COMMIT after reading its advisories, then rebuild.
set -euo pipefail

FK_COMMIT=15a1148a20cf78106b85a7723dcaaca36fe198c5 # v0.10.2
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
    arm64) TRIPLE=aarch64-unknown-linux-gnu; DEB_ARCH=arm64; MULTIARCH=aarch64-linux-gnu; GOARCH=arm64 ;;
    x86-64) TRIPLE=x86_64-unknown-linux-gnu; DEB_ARCH=amd64; MULTIARCH=x86_64-linux-gnu; GOARCH=amd64 ;;
    *) echo "unsupported arch: $ARCH" >&2; exit 2 ;;
esac

HERE="$(cd "$(dirname "$0")" && pwd)"
OS_WORK="${OS_WORK:-/tmp/mb-osimage}"
OS_TARGET_DIR="${OS_TARGET_DIR:-/tmp/mb-target-ferriskey}"
SRC="$OS_WORK/ferriskey-src"
OUT="$OS_WORK/ferriskey-$ARCH"

if [[ "$(git -C "$SRC" rev-parse HEAD 2>/dev/null)" != "$FK_COMMIT" ]]; then
    rm -rf "$SRC"
    git init -q "$SRC"
    git -C "$SRC" fetch -q --depth 1 https://github.com/ferriskey/ferriskey.git "$FK_COMMIT"
    git -C "$SRC" -c advice.detachedHead=false checkout -q FETCH_HEAD
fi
# Git checks every object against the commit hash, so this is the hash check on the whole tree.
[[ "$(git -C "$SRC" rev-parse HEAD)" == "$FK_COMMIT" ]]
git -C "$SRC" fsck --no-progress --connectivity-only >/dev/null

SSL="$OS_WORK/ferriskey-openssl-$ARCH"
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

bash "$HERE/../scripts/build_guard.sh" --wait
# The trailing .2.41 is trixie's glibc: Debian's libssl needs symbols older targets lack.
(cd "$SRC" && env -u MAKEFLAGS -u ARCH RUSTUP_TOOLCHAIN=1.99.0 CARGO_TARGET_DIR="$OS_TARGET_DIR" \
    OPENSSL_INCLUDE_DIR="$SSL/usr/include" OPENSSL_LIB_DIR="$SSL/usr/lib/$MULTIARCH" \
    cargo zigbuild --release --locked --target="$TRIPLE.2.41" -p ferriskey-api --bin ferriskey-api)

(cd "$SRC/front" && CI=true pnpm install --frozen-lockfile --ignore-scripts &&
    VITE_API_URL="" pnpm run build)

rm -rf "$OUT"; mkdir -p "$OUT"
install -m 0755 "$OS_TARGET_DIR/$TRIPLE/release/ferriskey-api" "$OUT/ferriskey-api"
cp -R "$SRC/front/dist" "$OUT/web"
find "$OUT/web" \( -name '*.map' -o -name '*.br' -o -name '*.gz' \) -delete
# The console finds its API here; upstream's image fills this in at container start.
printf '{ "api_url": "/api" }\n' > "$OUT/web/config.json"
mkdir "$OUT/migrations"
cp "$SRC"/core/migrations/*.up.sql "$OUT/migrations/"
ls -lh "$OUT"
