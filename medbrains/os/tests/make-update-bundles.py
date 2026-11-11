#!/usr/bin/env python3
"""Makes every bundle the update tests offer, from a built debug image.

  make-update-bundles.py OUT WORK BUNDLE_TOOL FIRST_VERSION NEXT_VERSION [ARCH]

WORK is the build's OS_WORK: images are in WORK/out-ARCH and the test key is WORK/update-test.key. If a real image
of NEXT_VERSION was built it is used. The rest are made from the first image's root and kernel, with a new
hash tree and boot file for each, because a boot file carries its system's root hash. Test only: uses the
test key.
"""
import os
import shutil
import struct
import subprocess
import sys

ARCH = sys.argv[6] if len(sys.argv) > 6 else "arm64"
OUT, WORK, TOOL, FIRST, NEXT = sys.argv[1:6]
OTHER_ARCH = "x86-64" if ARCH == "arm64" else "arm64"
IMAGES = os.path.join(WORK, f"out-{ARCH}")
KEY = os.path.join(WORK, "update-test.key")
# The keys the image was built to trust, where build.sh put them: the signing tool checks KEY against them.
TRUSTED = os.path.join(WORK, f"extra-{ARCH}", "usr", "share", "medbrains", "update-keys")
BUILDER = "medbrains-os-builder:arm64"
ROOT_FILE, VERITY_FILE, BOOT_FILE = "root.img.zst", "verity.img.zst", "boot.efi"
MANIFEST, SIGNATURES = "manifest.json", "manifest.sig"


def run(*args):
    """Runs a command, stopping everything if it fails."""
    subprocess.run(args, check=True)


def make(name, version, min_version, root, verity, boot, upgrades_from="0.0", *extra):
    """Makes and signs one bundle."""
    folder = os.path.join(OUT, name)
    run(TOOL, "make", folder, version, ARCH, min_version, root, verity, boot, "--upgrades-from", upgrades_from, *extra)
    run(TOOL, "sign", folder, "test-1", KEY, TRUSTED)
    return folder


def clone(source, name):
    """Copies a bundle cheaply, so one payload can back many refusals."""
    folder = os.path.join(OUT, name)
    shutil.rmtree(folder, ignore_errors=True)
    os.makedirs(folder)
    for file in os.listdir(source):
        os.link(os.path.join(source, file), os.path.join(folder, file))
    return folder


def resign(folder, key=KEY, key_id="test-1", trusted=TRUSTED):
    """Replaces the signature, as whoever made the change would have to."""
    os.remove(os.path.join(folder, SIGNATURES))
    run(TOOL, "sign", folder, key_id, key, trusted)


def edit_manifest(folder, old, new, sign=True):
    """Changes the manifest, signing the result only if asked."""
    path = os.path.join(folder, MANIFEST)
    with open(path, encoding="utf8") as file:
        text = file.read()
    assert old in text, old
    os.remove(path)
    with open(path, "w", encoding="utf8") as file:
        file.write(text.replace(old, new))
    if sign:
        resign(folder)


def flip_byte(folder, name):
    """Changes one byte of a payload file, in its own copy."""
    path = os.path.join(folder, name)
    copy = path + ".new"
    run("cp", "-c", path, copy)
    with open(copy, "r+b") as file:
        file.seek(4096)
        byte = file.read(1)
        file.seek(4096)
        file.write(bytes([byte[0] ^ 1]))
    os.replace(copy, path)


def refused_bundles(next_bundle):
    """Every bundle a machine must refuse, each from the good one, with only one thing wrong."""
    unsigned = clone(next_bundle, "unsigned")
    os.remove(os.path.join(unsigned, SIGNATURES))
    bad_key = clone(next_bundle, "bad-key")
    other = os.path.join(OUT, "other-key")
    for suffix in (".pub", ".key"):
        if os.path.exists(other + suffix):
            os.remove(other + suffix)
    run(TOOL, "keygen", other)
    # Signed by a key the image does not trust: the tool signs only with a key it can name.
    resign(bad_key, other + ".key", "other-key", OUT)
    tampered = clone(next_bundle, "tampered-manifest")
    edit_manifest(tampered, f'"version": "{NEXT}"', '"version": "9.9.9"', sign=False)
    flip_byte(clone(next_bundle, "tampered-root"), ROOT_FILE)
    flip_byte(clone(next_bundle, "tampered-boot"), BOOT_FILE)
    flip_byte(clone(next_bundle, "tampered-verity"), VERITY_FILE)
    edit_manifest(clone(next_bundle, "wrong-arch"), f'"arch": "{ARCH}"', f'"arch": "{OTHER_ARCH}"')
    edit_manifest(clone(next_bundle, "too-big"), '"raw_size": 2147483648', '"raw_size": 3221225472')
    edit_manifest(clone(next_bundle, "older"), f'"version": "{NEXT}"', '"version": "1.0.0"')
    edit_manifest(clone(next_bundle, "same"), f'"version": "{NEXT}"', f'"version": "{FIRST}"')
    edit_manifest(clone(next_bundle, "below-floor"), f'"version": "{NEXT}"', '"version": "1.0.2.1"')
    expired = clone(next_bundle, "expired")
    run(TOOL, "refresh", expired, "0")
    run(TOOL, "sign", expired, "test-1", KEY, TRUSTED)
    security = clone(next_bundle, "next-security")
    edit_manifest(security, '"security": false', '"security": true')
    edit_manifest(security, '"summary": ""', '"summary": "Fixes a flaw in the kernel."')
    channel = os.path.join(OUT, "channel", ARCH)
    shutil.rmtree(channel, ignore_errors=True)
    os.makedirs(os.path.dirname(channel), exist_ok=True)
    os.symlink(next_bundle, channel)


def later_bundles(next_bundle, after, bad_server):
    """Bundles that need the later versions: a mix of two releases, catching up in order, and a channel
    still offering a version that failed here."""
    mixed = clone(next_bundle, "mixed")
    os.remove(os.path.join(mixed, BOOT_FILE))
    os.link(os.path.join(after, BOOT_FILE), os.path.join(mixed, BOOT_FILE))
    steps = clone(after, os.path.join("channel-steps", ARCH))
    os.symlink(next_bundle, os.path.join(steps, NEXT))
    bad = os.path.join(OUT, "channel-bad", ARCH)
    os.makedirs(os.path.dirname(bad), exist_ok=True)
    os.symlink(bad_server, bad)


SCRIPT = r"""
set -euo pipefail
version="$1" broken="$2" arch="$3"
cd /w
if [[ "$broken" == server ]]; then debugfs -w -R 'rm /usr/bin/medbrains-server' root.img; fi
if [[ "$broken" == init ]]; then debugfs -w -R 'rm /usr/lib/systemd/systemd' root.img; fi
debugfs -R 'cat /usr/lib/os-release' root.img | sed "s/^IMAGE_VERSION=.*/IMAGE_VERSION=\"$version\"/" > os-release
debugfs -w -R 'rm /usr/lib/os-release' root.img
debugfs -w -R 'write os-release /usr/lib/os-release' root.img
debugfs -w -R 'sif /usr/lib/os-release mode 0100644' root.img
e2fsck -fy root.img >/dev/null || [[ $? -le 2 ]]
# A changed system needs a new tree, and its root hash goes on the boot file's command line.
command -v veritysetup >/dev/null || { apt-get update -qq && apt-get install -qq -y cryptsetup-bin >/dev/null; }
rm -f verity.img
veritysetup format --root-hash-file=roothash root.img verity.img >/dev/null
sed -i "s/roothash=[0-9a-f]*/roothash=$(cat roothash)/" cmdline
if [[ "$arch" == arm64 ]]; then
    stub=/usr/lib/systemd/boot/efi/linuxaa64.efi.stub
else
    # This builder runs natively on arm64, so the x86-64 stub comes from Debian's package.
    dpkg --add-architecture amd64
    apt-get update -qq
    apt-get download -qq systemd-boot-efi:amd64
    dpkg-deb -x systemd-boot-efi_*amd64.deb stubs
    stub=stubs/usr/lib/systemd/boot/efi/linuxx64.efi.stub
fi
signing=()
[[ -e pcr.key ]] && signing=(--pcr-private-key pcr.key --pcr-public-key pcr.pub)
ukify build --stub "$stub" --linux vmlinuz --initrd initrd --cmdline "@cmdline" \
    --os-release @os-release ${signing[@]+"${signing[@]}"} --output boot.efi >/dev/null
"""


def pe_section(path, name):
    """One text section of a boot file."""
    with open(path, "rb") as file:
        data = file.read()
    pe = struct.unpack_from("<I", data, 0x3c)[0]
    count, = struct.unpack_from("<H", data, pe + 6)
    optional, = struct.unpack_from("<H", data, pe + 20)
    for index in range(count):
        at = pe + 24 + optional + index * 40
        if data[at:at + 8].rstrip(b"\0") == name.encode():
            size, = struct.unpack_from("<I", data, at + 8)
            start, = struct.unpack_from("<I", data, at + 20)
            return data[start:start + size].decode().rstrip("\0\n")
    raise SystemExit(f"{path} has no {name}")


def derived(name, version, min_version, broken="", key=None, upgrades_from="0.0"):
    """Makes a bundle from the first image's root and kernel, under a new version. A real second image
    build proves more, and costs 5 GB and 8 minutes: pass its version as NEXT once one is built."""
    work = os.path.join(OUT, f"derive-{name}")
    shutil.rmtree(work, ignore_errors=True)
    os.makedirs(work)
    base = os.path.join(IMAGES, f"medbrains-os_{FIRST}")
    root = os.path.join(work, "root.img")
    run(TOOL, "extract", base + ".raw", f"medbrains_{FIRST}", root)
    run("cp", "-c", base + ".vmlinuz", os.path.join(work, "vmlinuz"))
    run("cp", "-c", base + ".initrd", os.path.join(work, "initrd"))
    line = pe_section(base + ".efi", ".cmdline")
    with open(os.path.join(work, "cmdline"), "w", encoding="utf8") as file:
        file.write(line)
    pcr_key = key or os.path.join(WORK, "throwaway-pcr.key")
    if os.path.exists(pcr_key):
        run("cp", pcr_key, os.path.join(work, "pcr.key"))
        run("openssl", "pkey", "-in", pcr_key, "-pubout", "-out", os.path.join(work, "pcr.pub"))
    run("docker", "run", "--rm", "--platform", "linux/arm64", "-v", f"{work}:/w", BUILDER,
        "bash", "-c", SCRIPT, "_", version, broken, ARCH)
    folder = make(name, version, min_version, root, os.path.join(work, "verity.img"),
                  os.path.join(work, BOOT_FILE), upgrades_from)
    shutil.rmtree(work)
    return folder


def usb_stick(next_bundle):
    """A FAT stick holding the good bundle, as a real one would."""
    image = os.path.join(OUT, "usb.img")
    size = sum(os.path.getsize(os.path.join(next_bundle, name)) for name in (ROOT_FILE, VERITY_FILE, BOOT_FILE))
    with open(image, "wb") as file:
        file.truncate(size + 128 * 1024 * 1024)
    script = ("mkfs.vfat -F 32 /o/usb.img >/dev/null; mmd -i /o/usb.img ::medbrains-update; "
              "mcopy -i /o/usb.img /o/next/* ::medbrains-update/")
    run("docker", "run", "--rm", "--platform", "linux/arm64", "-v", f"{OUT}:/o", BUILDER, "bash", "-c", script)


def unsealed(next_bundle, after):
    """A bundle signed and whole, whose system is not the one its boot file's root hash seals: a release
    built wrong. The machine must never name such a slot."""
    work = os.path.join(OUT, "derive-unsealed")
    shutil.rmtree(work, ignore_errors=True)
    os.makedirs(work)
    for name in (ROOT_FILE, VERITY_FILE):
        run("zstd", "-q", "-d", os.path.join(next_bundle, name), "-o", os.path.join(work, name[:-4]))
    make("unsealed", "1.0.6", "1.0.0", os.path.join(work, "root.img"), os.path.join(work, "verity.img"),
         os.path.join(after, BOOT_FILE), "0.0", "--unchecked-seal")
    shutil.rmtree(work)


def main():
    """Makes everything."""
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, "first-version"), "w", encoding="utf8") as file:
        file.write(FIRST + "\n")
    real = os.path.join(IMAGES, f"medbrains-os_{NEXT}")
    if os.path.exists(real + ".raw"):
        root, verity = os.path.join(OUT, "next-root.img"), os.path.join(OUT, "next-verity.img")
        run(TOOL, "extract", real + ".raw", f"medbrains_{NEXT}", root)
        run(TOOL, "extract", real + ".raw", f"medbrains_{NEXT}_verity", verity)
        next_bundle = make("next", NEXT, "1.0.0", root, verity, real + ".efi")
        os.remove(root)
        os.remove(verity)
    else:
        next_bundle = derived("next", NEXT, "1.0.0")
    refused_bundles(next_bundle)
    usb_stick(next_bundle)
    if ARCH == "arm64":
        after = derived("after", "1.0.3", "1.0.3", upgrades_from=NEXT)
        bad_server = derived("bad-server", "1.0.4", "1.0.0", "server")
        derived("bad-init", "1.0.5", "1.0.0", "init")
        later_bundles(next_bundle, after, bad_server)
        unsealed(next_bundle, after)
    else:
        other_key = os.path.join(OUT, "other-pcr.key")
        run("openssl", "genrsa", "-out", other_key, "2048")
        derived("other-seal", NEXT, "1.0.0", key=other_key)


main()
