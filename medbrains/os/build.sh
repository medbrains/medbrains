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
#   OS_PCR_KEY, OS_PCR_CERT  RSA key and certificate signing the boot file's expected PCR 11. Without them
#                         a release image's disk seal covers only PCR 7. --debug makes a throwaway.
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
OS_UPDATE="$(dirname "$SERVER")/medbrains-os-update"
FRONT="$(dirname "$SERVER")/medbrains-front"
AGENT="$(dirname "$SERVER")/medbrains-agent"
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
if [[ ! -x "$OS_UPDATE" ]]; then
    echo "no updater at $OS_UPDATE — cross-build medbrains-os-update with the server" >&2
    exit 1
fi
if [[ ! -x "$FRONT" ]]; then
    echo "no front at $FRONT — cross-build medbrains-front from medbrains-proxy with the server" >&2
    exit 1
fi
if [[ ! -x "$AGENT" ]]; then
    echo "no agent at $AGENT — cross-build medbrains-agent with the server" >&2
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
# The MedBrains design on the one stylesheet Kanidm leaves for this: the design system's tokens, refused
# unless they meet WCAG 2.2 AA, then our rules, and the web app's IBM Plex fonts.
# The screen's colours and mascot are generated from the same tokens; a drifted or failing copy stops the build.
python3 -I "$HERE/shell-tokens.py" --check >/dev/null || { echo "The shell's colours drifted or fail WCAG 2.2 AA: run os/shell-tokens.py --check" >&2; exit 1; }
python3 -I "$HERE/kanidm-tokens.py" --check >/dev/null || { echo "Kanidm's colours fail WCAG 2.2 AA: run os/kanidm-tokens.py --check" >&2; exit 1; }
{ python3 -I "$HERE/kanidm-tokens.py"; cat "$HERE/kanidm-override.css"; } > "$EXTRA/usr/share/kanidm/ui/hpkg/override.css"
install -d "$EXTRA/usr/share/kanidm/ui/hpkg/fonts"
for font in sans-400 sans-500 sans-600 mono-400; do
    install -m 0644 "$(ls "$WEB"/assets/ibm-plex-"${font%-*}"-latin-"${font#*-}"-normal-*.woff2 | head -1)" \
        "$EXTRA/usr/share/kanidm/ui/hpkg/fonts/plex-$font.woff2"
done
install -m 0755 "$OS_SETUP" "$EXTRA/usr/bin/medbrains-os-setup"
install -m 0755 "$OS_UPDATE" "$EXTRA/usr/bin/medbrains-os-update"
# Public keys that may sign updates. Release keys live in the repository; none exists yet, and an image with
# no key says so on its Settings screen and refuses every bundle.
KEYS="$EXTRA/usr/share/medbrains/update-keys"
install -d "$KEYS"
find "$HERE/update-keys" -name '*.pub' -exec install -m 0644 {} "$KEYS/" \;
if find "$KEYS" -name 'test-*' | grep -q .; then
    echo "a test key is in os/update-keys: it would reach release images" >&2
    exit 1
fi
install -m 0755 "$FRONT" "$EXTRA/usr/bin/medbrains-front"
install -m 0755 "$AGENT" "$EXTRA/usr/bin/medbrains-agent"
cp -R "$WEB" "$EXTRA/usr/share/medbrains/web"
# Pre-compressed copies are for a CDN; on the appliance the server compresses as it sends.
find "$EXTRA/usr/share/medbrains/web" \( -name '*.br' -o -name '*.gz' -o -name '*.map' \) -delete
install -m 0644 "$REPO/deploy/standalone/db-roles.sh" "$EXTRA/usr/lib/medbrains/db-roles.sh"
# The screen uses the web app's own logo.
install -d "$EXTRA/usr/share/medbrains/shell"
install -m 0644 "$WEB/logo/medbrains-mark.svg" "$EXTRA/usr/share/medbrains/shell/logo.svg"

# Versions are plain dotted numbers, so every machine and the boot loader agree on their order. Without
# OS_VERSION the commit's time gives a number that grows with every commit.
VERSION="${OS_VERSION:-0.0.$(git -C "$REPO" show -s --format=%ct HEAD)}"
if [[ ! "$VERSION" =~ ^(0|[1-9][0-9]*)(\.(0|[1-9][0-9]*)){1,3}$ ]]; then
    echo "OS_VERSION must be dotted numbers: $VERSION" >&2
    exit 2
fi
DEBUG_ARGS=()
# A root shell on whichever serial port this VM has: ttyAMA0 under QEMU, hvc0 under Apple
# Virtualization. A udev rule starts it when the port appears, so a VM without one of them has no
# failed unit, unlike systemd.debug_shell, which takes one fixed tty and fails if it is missing.
# It needs no login or PAM, so a broken boot can still be inspected.
if [[ "$DEBUG" == 1 ]]; then
    install -d "$EXTRA/usr/lib/systemd/system" "$EXTRA/usr/lib/udev/rules.d"
    install -m 0644 "$HERE/debug/medbrains-debug-shell@.service" "$EXTRA/usr/lib/systemd/system/"
    install -m 0644 "$HERE/debug/90-medbrains-debug-shell.rules" "$EXTRA/usr/lib/udev/rules.d/"
    # A test key for updates, trusted only because of the mark next to it. Never for a release image.
    TEST_KEY="$OS_WORK/update-test.key"
    if [[ ! -f "$TEST_KEY" ]]; then
        openssl genpkey -algorithm ed25519 -outform DER 2>/dev/null | tail -c 32 | base64 > "$TEST_KEY"
        chmod 600 "$TEST_KEY"
    fi
    base64 -d < "$TEST_KEY" > "$OS_WORK/update-test.seed"
    (printf '\x30\x2e\x02\x01\x00\x30\x05\x06\x03\x2b\x65\x70\x04\x22\x04\x20'; cat "$OS_WORK/update-test.seed") |
        openssl pkey -inform DER -pubout -outform DER | tail -c 32 | base64 > "$KEYS/test-1.pub"
    rm -f "$OS_WORK/update-test.seed"
    : > "$KEYS/THIS-IS-A-DEBUG-IMAGE"
    install -m 0755 "$HERE/debug/pcr11-replay" "$EXTRA/usr/lib/medbrains/pcr11-replay"
    # A clearly marked sign-in for trying the Identity app. Never in a release image.
    install -m 0755 "$HERE/debug/kanidm-debug-account" "$EXTRA/usr/lib/medbrains/kanidm-debug-account"
    install -m 0644 "$HERE/debug/kanidm-debug-account.service" "$EXTRA/usr/lib/systemd/system/"
    # The shell replaces the login prompt that systemd would put on both ports. wtype and grim let
    # a test type and take screenshots under Apple Virtualization, which has no QMP. hostapd and iw make
    # a test Wi-Fi network with mac80211_hwsim.
    DEBUG_ARGS=(--kernel-command-line "systemd.mask=serial-getty@ttyAMA0.service systemd.mask=serial-getty@hvc0.service systemd.mask=serial-getty@ttyS0.service"
                --package strace --package xz-utils --package tpm2-tools --package wtype --package grim --package hostapd --package iw)
fi

# A debug image gets a throwaway signing key, so the signed path is what gets tested. Never for release.
if [[ "$DEBUG" == 1 && -z "${OS_PCR_KEY:-}" ]]; then
    OS_PCR_KEY="$OS_WORK/throwaway-pcr.key"
    OS_PCR_CERT="$OS_WORK/throwaway-pcr.crt"
    [[ -f "$OS_PCR_KEY" ]] || openssl req -x509 -newkey rsa:2048 -nodes -days 30 -subj /CN=throwaway \
        -keyout "$OS_PCR_KEY" -out "$OS_PCR_CERT" 2>/dev/null
fi
SIGN_ARGS=()
SIGN_MOUNTS=()
if [[ -n "${OS_PCR_KEY:-}" ]]; then
    SIGN_ARGS=(--sign-expected-pcr yes --sign-expected-pcr-key "$OS_PCR_KEY" --sign-expected-pcr-certificate "$OS_PCR_CERT")
    SIGN_MOUNTS=(-v "$OS_PCR_KEY:$OS_PCR_KEY:ro" -v "$OS_PCR_CERT:$OS_PCR_CERT:ro")
fi

ROOT_ARG="root=PARTLABEL=medbrains_$VERSION"

# Runs mkosi on this Linux machine: a CI runner or a hospital's own build box. Needs root.
build_on_linux() {
    "$HERE/install-ukify-splash.sh"
    local work
    work="$(mktemp -d)"
    cp -R "$HERE/." "$work/"
    cp -R "$REPO/crates/medbrains-shell" "$work/medbrains-shell"
    (cd "$work" && mkosi --architecture "$ARCH" --extra-tree "$EXTRA" --kernel-command-line "$ROOT_ARG" \
        --output-directory "$OS_WORK/out-$ARCH" --cache-directory "$OS_WORK/cache-$ARCH" \
        --image-version "$VERSION" ${DEBUG_ARGS[@]+"${DEBUG_ARGS[@]}"} ${SIGN_ARGS[@]+"${SIGN_ARGS[@]}"} -f build)
    rm -rf "$work"
}

# Mac fallback only: a privileged Debian container, because mkosi needs Linux. The workspace
# stays inside the container (a real Linux filesystem, removed with it); only the package
# cache and the output are on the host. Nothing in the image depends on Docker.
build_on_mac_with_docker() {
    # The builder runs natively: emulated x86-64 lacks the mount calls mkosi's sandbox uses (ENOSYS on
    # Apple silicon). --architecture still picks the image's architecture.
    [[ "$(uname -m)" == arm64 ]] && PLATFORM=linux/arm64
    docker build -q --platform "$PLATFORM" -t "medbrains-os-builder:${PLATFORM#linux/}" \
        -f "$HERE/builder.Dockerfile" "$HERE" >/dev/null
    # An anonymous volume for /var/tmp: mkosi's build overlay cannot sit on Docker's own overlay.
    docker run --rm --privileged --platform "$PLATFORM" -v /var/tmp \
        -v "$HERE:/src:ro" -v "$REPO/crates/medbrains-shell:/shell:ro" -v "$EXTRA:/extra:ro" \
        -v "$OS_WORK/out-$ARCH:/out" -v "$OS_WORK/cache-$ARCH:/cache" ${SIGN_MOUNTS[@]+"${SIGN_MOUNTS[@]}"} \
        "medbrains-os-builder:${PLATFORM#linux/}" \
        bash -c 'cp -R /src /build && cp -R /shell /build/medbrains-shell && cd /build && mkosi "$@" -f build' _ \
        --architecture "$ARCH" --extra-tree /extra --kernel-command-line "$ROOT_ARG" --output-directory /out \
        --cache-directory /cache --image-version "$VERSION" ${DEBUG_ARGS[@]+"${DEBUG_ARGS[@]}"} \
        ${SIGN_ARGS[@]+"${SIGN_ARGS[@]}"}
}

if [[ "$(uname -s)" == Linux ]]; then build_on_linux; else build_on_mac_with_docker; fi

ls -lh "$OS_WORK/out-$ARCH"
