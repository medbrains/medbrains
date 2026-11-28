#!/usr/bin/env bash
# Checks a built OS image file from outside, without booting or mounting it, so it runs on any CI
# runner and on a release image (which has no shell to ask). Reads the system partition with debugfs.
#
#   os/tests/check-image.sh <image.raw>
#
# Every unit mkosi.postinst.chroot masks must still be masked in the finished image: mkosi applies
# systemd's presets after the postinst, and v3.35.6 shipped with Ctrl+Alt+Del restarting the machine
# because a preset had replaced that mask. Prints PASS, or FAIL and what is wrong.
set -euo pipefail

OS="$(cd "$(dirname "$0")/.." && pwd)"
RAW="${1:?usage: check-image.sh <image.raw>}"

# The first sector of the running system's partition, which build.sh names medbrains_<version>.
start="$(partx --raw --noheadings -o START,NAME "$RAW" | awk '$2 ~ /^medbrains_/ {print $1; exit}')"
if [[ -z "$start" ]]; then echo "FAIL: no medbrains_<version> partition in $RAW"; exit 1; fi

# What the link at path $1 in the system partition points to; empty if it is missing or not a link.
link_target() {
    debugfs -R "stat $1" "$RAW?offset=$((start * 512))" 2>/dev/null | sed -n 's/^Fast link dest: "\(.*\)"$/\1/p'
}

# The unit names after every `systemctl mask` in the postinst, following a line that ends in a backslash.
masked="$(awk '/^systemctl mask/{on=1} on{print} on&&!/\\$/{on=0}' "$OS/mkosi.postinst.chroot" |
    sed 's/^systemctl mask//; s/\\$//')"
if [[ -z "${masked// }" ]]; then echo "FAIL: found no masked unit to check in mkosi.postinst.chroot"; exit 1; fi
# The image is ours if this link reads back: a wrong offset or file system must not pass as "nothing masked".
if [[ "$(link_target /etc/systemd/system/default.target)" != */graphical.target ]]; then
    echo "FAIL: could not read the system partition of $RAW"; exit 1
fi
failed=0
for unit in $masked; do
    target="$(link_target "/etc/systemd/system/$unit")"
    if [[ "$target" != /dev/null ]]; then
        echo "FAIL: $unit is masked in mkosi.postinst.chroot but not in the image (${target:-no link})"
        failed=1
    fi
done
if [[ "$failed" == 1 ]]; then exit 1; fi
echo PASS
