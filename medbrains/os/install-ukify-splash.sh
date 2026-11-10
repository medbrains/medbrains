#!/bin/sh
# Installs the ukify wrapper that adds the MedBrains logo to the boot file. mkosi 25 has
# no splash setting and ukify 257 reads no default config. Needs root; changes only the
# build machine, never the image. Safe to run twice.
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
install -D -m 0644 "$HERE/mkosi.splash.bmp" /usr/share/medbrains/splash.bmp
# Added to the boot file's initrd: mkosi 25 has no setting for extra initrd files either.
(cd "$HERE/trial-initrd" && find . | cpio -o -H newc --quiet --owner=0:0) > /usr/share/medbrains/trial-initrd.cpio
if [ ! -f /usr/lib/systemd/ukify.real ]; then
    cp --remove-destination "$(readlink -f /usr/bin/ukify)" /usr/lib/systemd/ukify.real
    rm -f /usr/bin/ukify /usr/lib/systemd/ukify
    install -m 0755 "$HERE/ukify-splash.py" /usr/bin/ukify
    ln -s /usr/bin/ukify /usr/lib/systemd/ukify
fi
