#!/usr/bin/env bash
# Builds the MedBrains OS disk image with mkosi: directly on Linux, in a Debian container
# on a Mac.
#
#   ./build.sh [--arch arm64|x86-64] [--debug]
#
# Inputs (defaults in brackets):
#   MEDBRAINS_SERVER_BIN  the server for the target arch
#                         [$CARGO_TARGET_DIR/<triple>/release/medbrains-server]
#   MEDBRAINS_WEB_DIST    the built web app [../apps/web/dist]
#   KANIDM_DIR            the identity provider, from build-kanidm.sh [$OS_WORK/kanidm-<arch>]
#   OS_WORK               build cache + output [/tmp/mb-osimage]
#
# --debug adds a root shell on the serial console, for verification only.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
ARCH=arm64
DEBUG=0
while [[ $# -gt 0 ]]; do
    case "$1" in
        --arch) ARCH="$2"; shift 2 ;;
        --debug) DEBUG=1; shift ;;
        *) echo "unknown option: $1" >&2; exit 2 ;;
    esac
done
case "$ARCH" in
    arm64) TRIPLE=aarch64-unknown-linux-gnu; PLATFORM=linux/arm64 ;;
    x86-64) TRIPLE=x86_64-unknown-linux-gnu; PLATFORM=linux/amd64 ;;
    *) echo "unsupported arch: $ARCH" >&2; exit 2 ;;
esac

OS_WORK="${OS_WORK:-/tmp/mb-osimage}"
SERVER="${MEDBRAINS_SERVER_BIN:-${CARGO_TARGET_DIR:-$REPO/target}/$TRIPLE/release/medbrains-server}"
KANIDM="${KANIDM_DIR:-$OS_WORK/kanidm-$ARCH}"
OS_SETUP="$(dirname "$SERVER")/medbrains-os-setup"
SIGNIN_LIMIT="$(dirname "$SERVER")/medbrains-signin-limit"
WEB="${MEDBRAINS_WEB_DIST:-$REPO/apps/web/dist}"
if [[ ! -x "$SERVER" ]]; then
    echo "no server binary at $SERVER — cross-build it with zigbuild for $TRIPLE (see README)" >&2
    exit 1
fi
if [[ ! -x "$KANIDM/kanidmd" ]]; then
    echo "no identity provider at $KANIDM — run os/build-kanidm.sh --arch $ARCH" >&2
    exit 1
fi
if [[ ! -x "$OS_SETUP" ]]; then
    echo "no setup service at $OS_SETUP — cross-build medbrains-os-setup with the server" >&2
    exit 1
fi
if [[ ! -x "$SIGNIN_LIMIT" ]]; then
    echo "no sign-in limit at $SIGNIN_LIMIT — cross-build medbrains-signin-limit with the server" >&2
    exit 1
fi
if [[ ! -f "$WEB/index.html" ]]; then
    echo "no web app at $WEB — pnpm turbo run build --filter=@medbrains/web..." >&2
    exit 1
fi

# The second extra tree: what this repo builds, staged fresh every time.
EXTRA="$OS_WORK/extra-$ARCH"
rm -rf "$EXTRA"
install -d "$EXTRA/usr/bin" "$EXTRA/usr/share/medbrains" "$EXTRA/usr/lib/medbrains" \
    "$OS_WORK/out-$ARCH" "$OS_WORK/cache-$ARCH"
install -m 0755 "$SERVER" "$EXTRA/usr/bin/medbrains-server"
install -m 0755 "$KANIDM/kanidmd" "$EXTRA/usr/bin/kanidmd"
install -d "$EXTRA/usr/share/kanidm/ui"
cp -R "$KANIDM/hpkg" "$EXTRA/usr/share/kanidm/ui/hpkg"
# Only a debug image may run the identity provider on an unencrypted disk.
if [[ "$DEBUG" == 1 ]]; then install -m 0644 /dev/null "$EXTRA/usr/lib/medbrains/debug-image"; fi
# The hospital's colours, on the one stylesheet Kanidm leaves for this.
install -m 0644 "$HERE/kanidm-override.css" "$EXTRA/usr/share/kanidm/ui/hpkg/override.css"
install -m 0755 "$OS_SETUP" "$EXTRA/usr/bin/medbrains-os-setup"
install -m 0755 "$SIGNIN_LIMIT" "$EXTRA/usr/bin/medbrains-signin-limit"
cp -R "$WEB" "$EXTRA/usr/share/medbrains/web"
# Pre-compressed copies are for a CDN; on the appliance Caddy compresses.
find "$EXTRA/usr/share/medbrains/web" \( -name '*.br' -o -name '*.gz' -o -name '*.map' \) -delete
install -m 0644 "$REPO/deploy/standalone/db-roles.sh" "$EXTRA/usr/lib/medbrains/db-roles.sh"
# The screen uses the web app's own logo.
install -d "$EXTRA/usr/share/medbrains/shell"
install -m 0644 "$WEB/logo/medbrains-mark.svg" "$EXTRA/usr/share/medbrains/shell/logo.svg"

VERSION="${OS_VERSION:-$(git -C "$REPO" rev-parse --short HEAD)}"
DEBUG_ARGS=()
# A root shell on whichever serial port this VM has: ttyAMA0 under QEMU, hvc0 under Apple
# Virtualization. A udev rule starts it when the port appears, so a VM without one of them has no
# failed unit, unlike systemd.debug_shell, which takes one fixed tty and fails if it is missing.
# It needs no login or PAM, so a broken boot can still be inspected.
if [[ "$DEBUG" == 1 ]]; then
    install -d "$EXTRA/usr/lib/systemd/system" "$EXTRA/usr/lib/udev/rules.d"
    install -m 0644 "$HERE/debug/medbrains-debug-shell@.service" "$EXTRA/usr/lib/systemd/system/"
    install -m 0644 "$HERE/debug/90-medbrains-debug-shell.rules" "$EXTRA/usr/lib/udev/rules.d/"
    # A clearly marked sign-in for trying the Identity app. Never in a release image.
    install -m 0755 "$HERE/debug/kanidm-debug-account" "$EXTRA/usr/lib/medbrains/kanidm-debug-account"
    install -m 0644 "$HERE/debug/kanidm-debug-account.service" "$EXTRA/usr/lib/systemd/system/"
    # The shell replaces the login prompt that systemd would put on both ports. wtype and grim let
    # a test type and take screenshots under Apple Virtualization, which has no QMP. hostapd and iw make
    # a test Wi-Fi network with mac80211_hwsim.
    DEBUG_ARGS=(--kernel-command-line "systemd.mask=serial-getty@ttyAMA0.service systemd.mask=serial-getty@hvc0.service"
                --package strace --package wtype --package grim --package hostapd --package iw)
fi

# Runs mkosi on this Linux machine: a CI runner or a hospital's own build box. Needs root.
build_on_linux() {
    "$HERE/install-ukify-splash.sh"
    local work
    work="$(mktemp -d)"
    cp -R "$HERE/." "$work/"
    cp -R "$REPO/crates/medbrains-shell" "$work/medbrains-shell"
    (cd "$work" && mkosi --architecture "$ARCH" --extra-tree "$EXTRA" \
        --output-directory "$OS_WORK/out-$ARCH" --cache-directory "$OS_WORK/cache-$ARCH" \
        --image-version "$VERSION" ${DEBUG_ARGS[@]+"${DEBUG_ARGS[@]}"} -f build)
    rm -rf "$work"
}

# Mac fallback only: a privileged Debian container, because mkosi needs Linux. The workspace
# stays inside the container (a real Linux filesystem, removed with it); only the package
# cache and the output are on the host. Nothing in the image depends on Docker.
build_on_mac_with_docker() {
    docker build -q --platform "$PLATFORM" -t "medbrains-os-builder:$ARCH" \
        -f "$HERE/builder.Dockerfile" "$HERE" >/dev/null
    # An anonymous volume for /var/tmp: mkosi's build overlay cannot sit on Docker's own overlay.
    docker run --rm --privileged --platform "$PLATFORM" -v /var/tmp \
        -v "$HERE:/src:ro" -v "$REPO/crates/medbrains-shell:/shell:ro" -v "$EXTRA:/extra:ro" \
        -v "$OS_WORK/out-$ARCH:/out" -v "$OS_WORK/cache-$ARCH:/cache" \
        "medbrains-os-builder:$ARCH" \
        bash -c 'cp -R /src /build && cp -R /shell /build/medbrains-shell && cd /build && mkosi "$@" -f build' _ \
        --architecture "$ARCH" --extra-tree /extra --output-directory /out \
        --cache-directory /cache --image-version "$VERSION" ${DEBUG_ARGS[@]+"${DEBUG_ARGS[@]}"}
}

if [[ "$(uname -s)" == Linux ]]; then build_on_linux; else build_on_mac_with_docker; fi

ls -lh "$OS_WORK/out-$ARCH"
