#!/usr/bin/env bash
# Copies the Debian package database and os-release out of a built image file, without booting or
# mounting it, so syft can list every installed .deb with its exact version (pkg:deb/debian/... PURLs)
# and osv-scanner can match them against Debian's security tracker. Reads the system partition with
# debugfs, as tests/check-image.sh does.
#
#   os/package-db.sh <image.raw> <out-dir>
#
# Leaves <out-dir>/var/lib/dpkg/status and <out-dir>/usr/lib/os-release. Fails if either is missing
# or the status file lists no package: an empty SBOM must never pass as "no CVEs".
set -euo pipefail

RAW="${1:?usage: package-db.sh <image.raw> <out-dir>}"
OUT="${2:?usage: package-db.sh <image.raw> <out-dir>}"

# The first sector of the running system's partition, which build.sh names medbrains_<version>.
start="$(partx --raw --noheadings -o START,NAME "$RAW" | awk '$2 ~ /^medbrains_/ {print $1; exit}')"
if [[ -z "$start" ]]; then echo "FAIL: no medbrains_<version> partition in $RAW"; exit 1; fi

mkdir -p "$OUT/var/lib/dpkg" "$OUT/usr/lib"
for f in /var/lib/dpkg/status /usr/lib/os-release; do
    debugfs -R "dump $f $OUT$f" "$RAW?offset=$((start * 512))" 2>/dev/null
    if [[ ! -s "$OUT$f" ]]; then echo "FAIL: could not read $f from $RAW"; exit 1; fi
done
count="$(grep -c '^Package: ' "$OUT/var/lib/dpkg/status" || true)"
if [[ "$count" -eq 0 ]]; then echo "FAIL: $RAW lists no installed package"; exit 1; fi
echo "$count packages"
