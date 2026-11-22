#!/usr/bin/env bash
# Bakes a MedBrains cloud image on a stock Debian 13 machine, as root. Installs one
# pinned signed release (never built here), the packages its kit needs, and the
# first-boot unit; then seals the disk so every machine cloned from it makes its own
# keys, passwords and identity. The kit's install.sh does NOT run here: it creates
# secrets, so it runs on each clone's first boot (medbrains-cloud-setup).
#   bake.sh <release-tag> <kit.tar> [dir already holding the release files]
set -euo pipefail

TAG="${1:?usage: bake.sh <release-tag> <kit.tar> [release-dir]}"
KIT_TAR="${2:?usage: bake.sh <release-tag> <kit.tar> [release-dir]}" SRC="${3:-}"
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO=medbrains/medbrains
# The exact signer: the release workflow at this tag. Never a pattern, which would
# also accept a branch build (RFC-ONE-RELEASE-LEGO-BRICKS, "Exact signer identity").
IDENTITY="https://github.com/$REPO/.github/workflows/release.yml@refs/tags/$TAG"
ISSUER=https://token.actions.githubusercontent.com
DEST=/usr/local/lib/medbrains-image
# On disk, not /tmp: Debian 13 keeps /tmp in memory and the tarballs are large.
WORK="$(mktemp -d -p /var/tmp)"
case "$(uname -m)" in
    aarch64) ARCH=arm64 ;;
    x86_64) ARCH=x86-64 ;;
    *) echo "ERROR: unsupported architecture $(uname -m)" >&2; exit 1 ;;
esac
BINS="medbrains-server-bins-linux-$ARCH.tar.gz" WEB=medbrains-web-dist.tar.gz
export DEBIAN_FRONTEND=noninteractive

# Installs what the kit's install.sh would fetch, so first boot installs nothing new,
# and PostgreSQL 17 from the kit's own pinned repository without creating a cluster.
install_packages() {
    apt-get update -qq
    # A marketplace scan refuses an image with known-fixable package vulnerabilities.
    apt-get upgrade -y
    apt-get install -y --no-install-recommends ca-certificates curl gnupg lsb-release openssl \
        certbot age unzip awscli unattended-upgrades iproute2 cosign
    # shellcheck source=../standalone/native-postgres.sh
    . "$DEST/kit/native-postgres.sh"
    pg_native_repo
    sed -i -E 's/^#?[[:space:]]*create_main_cluster.*/create_main_cluster = false/' \
        /etc/postgresql-common/createcluster.conf
    apt-get update -qq
    apt-get install -y --no-install-recommends "postgresql-$PG_MAJOR" "postgresql-client-$PG_MAJOR"
    pg_native_check_version
}

# Brings the release files into $WORK: from the given folder, else from the public release.
fetch_release() {
    local f
    for f in "$BINS" "$WEB" SHA256SUMS SHA256SUMS.sigstore.json; do
        if [[ -n "$SRC" ]]; then
            cp "$SRC/$f" "$WORK/$f"
        else
            curl -fsSL --retry 3 -o "$WORK/$f" "https://github.com/$REPO/releases/download/$TAG/$f"
        fi
    done
}

# Refuses the release unless SHA256SUMS is signed by the exact release workflow for
# this tag and both tarballs match it.
verify_release() {
    cosign verify-blob --bundle "$WORK/SHA256SUMS.sigstore.json" \
        --certificate-identity "$IDENTITY" --certificate-oidc-issuer "$ISSUER" "$WORK/SHA256SUMS"
    grep -E " \*?($BINS|$WEB)\$" "$WORK/SHA256SUMS" > "$WORK/wanted"
    [[ "$(wc -l < "$WORK/wanted")" -eq 2 ]] || { echo "ERROR: SHA256SUMS does not list $BINS and $WEB" >&2; exit 1; }
    (cd "$WORK" && sha256sum -c wanted)
}

# Unpacks the kit and the verified release where first boot reads them: root's, writable by nobody else.
stage_release() {
    install -d -m 0700 "$DEST" "$DEST/kit" "$DEST/release" "$DEST/release/medbrains-web"
    tar --no-same-owner -xf "$KIT_TAR" -C "$DEST/kit"
    [[ -f "$DEST/kit/install.sh" ]] || { echo "ERROR: $KIT_TAR holds no install.sh" >&2; exit 1; }
    fetch_release
    install_packages
    verify_release
    tar --no-same-owner -xzf "$WORK/$BINS" -C "$DEST/release"
    tar --no-same-owner -xzf "$WORK/$WEB" -C "$DEST/release/medbrains-web" --strip-components 1
    echo "$TAG" > "$DEST/release-tag"
    install -m 0755 "$HERE/seal-check.sh" "$DEST/seal-check.sh"
    chown -R root:root "$DEST" && chmod -R go-w "$DEST"
}

# Key-only SSH and no root login, in a file read before the distribution's own, plus the first-boot unit.
install_first_boot() {
    printf '%s\n' 'PasswordAuthentication no' 'KbdInteractiveAuthentication no' \
        'PermitEmptyPasswords no' 'PermitRootLogin no' > /etc/ssh/sshd_config.d/00-medbrains.conf
    install -m 0755 "$HERE/medbrains-cloud-setup" /usr/local/sbin/medbrains-cloud-setup
    install -m 0644 "$HERE/medbrains-first-boot.service" /etc/systemd/system/
    systemctl enable medbrains-first-boot.service
}

# Removes everything that must differ per machine or that only the build needed.
seal() {
    apt-get purge -y --auto-remove cosign >/dev/null && apt-get clean
    passwd -l root >/dev/null
    if command -v cloud-init >/dev/null; then cloud-init clean --logs --seed; fi
    # ssl-cert (a PostgreSQL dependency) made a private key at install; first boot makes a new one.
    rm -f /etc/ssh/ssh_host_* /etc/ssl/private/ssl-cert-snakeoil.key /etc/ssl/certs/ssl-cert-snakeoil.pem \
        /var/lib/dbus/machine-id
    : > /etc/machine-id
    find /root /home -xdev \( -name 'authorized_keys*' -o -name '.*_history' -o -name .lesshst \
        -o -name .viminfo -o -name .aws -o -name .gnupg \) -exec rm -rf {} +
    rm -rf /var/lib/apt/lists/* /var/log/journal/* /tmp/* /var/tmp/* "$WORK"
    find /var/log -type f -exec truncate -s 0 {} +
}

stage_release
install_first_boot
seal
"$DEST/seal-check.sh" /
echo "baked $TAG ($ARCH) and sealed"
