#!/usr/bin/env bash
# Proves the recipe with no cloud account. In throwaway Debian 13 systemd containers:
# bakes the image with bake.sh (real signature check), runs the seal check on the
# stopped image, then boots two clones and requires each to reach health on loopback
# only, with no secret in common. Needs docker and the release files in a folder.
#   test-local.sh <release-tag> <dir with the tarballs, SHA256SUMS and its .sigstore.json>
set -Eeuo pipefail

TAG="${1:?usage: test-local.sh <release-tag> <release-dir>}"
SRC="${2:?usage: test-local.sh <release-tag> <release-dir>}"
HERE="$(cd "$(dirname "$0")" && pwd)" N="mbimg$$" OUT="$(mktemp -d)"

# Removes every container and image this run made.
cleanup() {
    docker rm -f -v "$N-build" "$N-a" "$N-b" >/dev/null 2>&1 || true
    docker rmi -f "$N-sealed" "$N-base" >/dev/null 2>&1 || true
    rm -rf "$OUT"
}
trap cleanup EXIT

# Boots container $1 from image $2 with systemd as PID 1 (privileged only for that).
boot() {
    docker run -d --name "$1" --privileged --cgroupns=private --tmpfs /run --tmpfs /run/lock \
        --cpus 2 --memory 2g "$2" >/dev/null
    docker exec "$1" systemctl is-system-running --wait >/dev/null 2>&1 || true
}

# Boots clone $1, waits for its first boot, checks health and listeners, and writes
# a hash per secret (never the secret) to $OUT/$1.
clone() {
    boot "$1" "$N-sealed"
    docker exec "$1" bash -c 'for _ in $(seq 1 240); do
        [[ -e /var/lib/medbrains-first-boot.done ]] && exit 0
        systemctl is-failed -q medbrains-first-boot && break; sleep 5; done
        journalctl -u medbrains-first-boot --no-pager | tail -40; exit 1'
    docker exec "$1" curl -fsS --max-time 5 http://127.0.0.1:3000/api/health >/dev/null
    # Only sshd may listen beyond loopback before the operator names a domain.
    if docker exec "$1" ss -ltnH | awk '{print $4}' | grep -vE '^(127\.0\.0\.1|\[::1\]):|:22$'; then
        echo "FAIL: $1 listens on a public address" >&2; return 1
    fi
    docker exec "$1" bash -c 'set -e
        { grep -E "^(JWT_|MIGRATION_DATABASE_URL=|MEDBRAINS_[A-Z_]*(KEY|PASSWORD)=)" /etc/medbrains/env
          cat /etc/machine-id /etc/medbrains/initial-admin-password /root/medbrains-backup-identity.txt \
              /etc/ssl/private/ssl-cert-snakeoil.key | grep -vE "^(#|-----)"
        } | while IFS= read -r line; do printf %s "$line" | sha256sum; done | sort -u' > "$OUT/$1"
    docker rm -f -v "$1" >/dev/null
}

docker build -q -t "$N-base" - >/dev/null <<'DOCKERFILE'
FROM debian:trixie
# What a stock cloud image has, plus leftovers the seal must remove.
RUN apt-get update && apt-get install -y --no-install-recommends systemd systemd-sysv dbus openssh-server \
      sudo ca-certificates curl && ssh-keygen -A && echo 'ls' > /root/.bash_history \
 && mkdir -p /root/.ssh && echo 'ssh-ed25519 AAAA build' > /root/.ssh/authorized_keys
STOPSIGNAL SIGRTMIN+3
CMD ["/sbin/init"]
DOCKERFILE
boot "$N-build" "$N-base"
# Piped, not `docker cp`: /tmp is a tmpfs on Debian 13, which `docker cp` cannot see.
docker exec "$N-build" install -d -m 0700 /tmp/in/release /tmp/in/cloud-image
COPYFILE_DISABLE=1 tar -C "$HERE" -c . | docker exec -i "$N-build" tar -x --no-same-owner -C /tmp/in/cloud-image
# From the top of the repository: in a subfolder `git archive` writes an empty archive.
git -C "$(git -C "$HERE" rev-parse --show-toplevel)" archive --format=tar "$TAG:medbrains/deploy/standalone" | docker exec -i "$N-build" tee /tmp/in/kit.tar >/dev/null
COPYFILE_DISABLE=1 tar -C "$SRC" -c . | docker exec -i "$N-build" tar -x --no-same-owner -C /tmp/in/release
docker exec "$N-build" bash /tmp/in/cloud-image/bake.sh "$TAG" /tmp/in/kit.tar /tmp/in/release
docker stop "$N-build" >/dev/null
docker commit "$N-build" "$N-sealed" >/dev/null
docker run --rm "$N-sealed" /usr/local/lib/medbrains-image/seal-check.sh /
clone "$N-a"
clone "$N-b"
count="$(wc -l < "$OUT/$N-a" | tr -d ' ')"
[[ "$count" -ge 12 ]] || { echo "FAIL: only $count secrets found on a clone" >&2; exit 1; }
[[ -z "$(comm -12 "$OUT/$N-a" "$OUT/$N-b")" ]] || { echo "FAIL: two clones share a secret" >&2; exit 1; }
echo "PASS: $TAG baked, sealed, and two clones healthy with $count secrets each, none shared"
