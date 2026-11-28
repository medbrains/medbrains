#!/usr/bin/env python3
"""Fails if a built OS image would leave a file the system needs unreadable.

  os/tests/check-image-modes.py IMAGE.raw     the release's disk image, read offline
  os/tests/check-image-modes.py --self-test   needs mkfs.ext4 and git (the os-image job has both)

v3.35.6 shipped with every file the OS adds readable by root alone: the build ran under the signing
keys' umask 077 (fix: PR #6308). The network unit, the app manifests and the units' scripts were
0600, so services running as their own users could not read them and the box could not be set up.
Nothing caught it, because nothing looked inside the built artefact. This does, before upload.

It reads the ext4 system partition straight from the file (no mount, no root, works on a Mac) and
checks, against git, which is the source of truth for modes:
  - every file in os/mkosi.extra has at least the read and execute bits git gives it (git stores
    only 0644 and 0755, so a 0644 source must be world-readable in the image);
  - everything under /usr/share/medbrains is world-readable, and its directories world-searchable;
  - the binaries build.sh installs are world-executable;
  - every directory on the way to these is world-searchable, and everything is owned by root.
"""
import os, stat, struct, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
EXTRA = os.path.join(os.path.dirname(HERE), "mkosi.extra")
ROOT_LABEL = "medbrains_"  # slot A's label is medbrains_<version> (mkosi.repart/10-root-a.conf)
TREES = ["/usr/share/medbrains", "/usr/share/kanidm"]  # staged by build.sh; every file is public
BINARIES = ["/usr/bin/medbrains-server", "/usr/bin/medbrains-os-setup", "/usr/bin/medbrains-os-update",
            "/usr/bin/medbrains-front", "/usr/bin/medbrains-agent", "/usr/bin/kanidmd"]
MAX_ENTRIES = 200_000  # ponytail: a bound on the tree walk; the image holds about 3,000 files today
EXTENTS_FL = 0x80000


class Ext4:
    """Read-only view of one ext4 filesystem at a byte offset in a file."""

    def __init__(self, path, offset):
        """Opens the filesystem and reads the superblock fields the walk needs."""
        self.f, self.part = open(path, "rb"), offset
        sb = self.read(1024, 1024)
        if struct.unpack_from("<H", sb, 56)[0] != 0xEF53:
            raise SystemExit(f"{path}: no ext4 filesystem at byte {offset}")
        self.bs = 1024 << struct.unpack_from("<I", sb, 24)[0]
        self.ipg, self.isz = struct.unpack_from("<I", sb, 40)[0], struct.unpack_from("<H", sb, 88)[0]
        self.dsz = struct.unpack_from("<H", sb, 254)[0] if struct.unpack_from("<I", sb, 96)[0] & 0x80 else 32
        self.gdt = self.bs if self.bs > 1024 else 2048

    def read(self, off, n):
        """Bytes at an offset inside the filesystem."""
        self.f.seek(self.part + off)
        return self.f.read(n)

    def inode(self, n):
        """Raw inode n."""
        g, idx = divmod(n - 1, self.ipg)
        d = self.read(self.gdt + g * self.dsz, self.dsz)
        tbl = struct.unpack_from("<I", d, 8)[0] | ((struct.unpack_from("<I", d, 40)[0] << 32) if self.dsz >= 64 else 0)
        return self.read(tbl * self.bs + idx * self.isz, self.isz)

    def stat(self, n):
        """(mode, uid, gid) of inode n."""
        ino = self.inode(n)
        mode, uid_lo = struct.unpack_from("<HH", ino, 0)
        uid_hi, gid_hi = struct.unpack_from("<HH", ino, 120)
        return mode, uid_lo | uid_hi << 16, struct.unpack_from("<H", ino, 24)[0] | gid_hi << 16

    def blocks(self, n):
        """Physical blocks of inode n, following its extent tree."""
        ino = self.inode(n)
        if not struct.unpack_from("<I", ino, 32)[0] & EXTENTS_FL:
            raise SystemExit(f"inode {n} is not extent-mapped; this reader handles extents only")

        def walk(node):
            """Blocks under one extent node, depth first."""
            magic, entries, _, depth = struct.unpack_from("<HHHH", node, 0)
            if magic != 0xF30A:
                raise SystemExit(f"inode {n}: damaged extent header")
            for i in range(entries):
                e = node[12 + 12 * i: 24 + 12 * i]
                if depth == 0:
                    _, ln, hi, lo = struct.unpack("<IHHI", e)
                    yield from range((hi << 32) | lo, ((hi << 32) | lo) + (ln if ln <= 32768 else ln - 32768))
                else:
                    _, lo, hi, _ = struct.unpack("<IIHH", e)
                    yield from walk(self.read(((hi << 32) | lo) * self.bs, self.bs))
        yield from walk(ino[40:100])

    def entries(self, n):
        """(name, inode) of each entry in directory n, without . and .."""
        for b in self.blocks(n):
            data, o = self.read(b * self.bs, self.bs), 0
            while o < self.bs - 8:
                child, rl, nl = struct.unpack_from("<IHB", data, o)
                if rl < 8:
                    break
                name = data[o + 8:o + 8 + nl].decode(errors="replace")
                if child and name not in (".", ".."):
                    yield name, child
                o += rl

    def walk_path(self, path):
        """Inodes from / down to path (None at the end if it is missing), not following symlinks."""
        chain, n = [("/", 2)], 2
        for comp in [c for c in path.split("/") if c]:
            if not stat.S_ISDIR(self.stat(n)[0]):
                return chain + [(path, None)]
            n = dict(self.entries(n)).get(comp)
            chain.append((chain[-1][0].rstrip("/") + "/" + comp, n))
            if n is None:
                break
        return chain


def root_partition(path):
    """Byte offset of the system partition in a GPT disk image, or 0 for a bare filesystem."""
    with open(path, "rb") as f:
        f.seek(512)
        hdr = f.read(92)
        if hdr[:8] != b"EFI PART":
            return 0
        ent_lba, n_ent, ent_sz = struct.unpack_from("<QII", hdr, 72)
        for i in range(n_ent):
            f.seek(ent_lba * 512 + i * ent_sz)
            e = f.read(ent_sz)
            if e[:16] != b"\0" * 16 and e[56:128].decode("utf-16le").rstrip("\0").startswith(ROOT_LABEL):
                return struct.unpack_from("<Q", e, 32)[0] * 512
    raise SystemExit(f"{path}: no partition labelled {ROOT_LABEL}*")


def git_modes(extra):
    """{image path: git mode} for the files in the extra tree; symlinks and the vfat ESP are left out."""
    out = subprocess.run(["git", "-C", extra, "ls-files", "-s", "--full-name", "."],
                         capture_output=True, text=True, check=True).stdout
    top = subprocess.run(["git", "-C", extra, "rev-parse", "--show-prefix"],
                         capture_output=True, text=True, check=True).stdout.strip()
    modes = {}
    for line in out.splitlines():
        meta, name = line.split("\t", 1)
        mode = int(meta.split()[0], 8)
        rel = "/" + name[len(top):]
        if stat.S_ISREG(mode) and not rel.startswith("/efi/"):
            modes[rel] = mode
    return modes


def problems(fs, wanted):
    """What is wrong in fs, given {path: the bits it must have} (a path ending / is a whole tree)."""
    found, seen_dirs, count = [], set(), 0

    def check(path, n, need):
        """Records a problem if inode n lacks bits of need or is not root's."""
        mode, uid, gid = fs.stat(n)
        if stat.S_ISLNK(mode):
            return
        if uid or gid:
            found.append(f"{path}: owned by {uid}:{gid}, not root")
        missing = need & ~mode & 0o777
        if missing:
            found.append(f"{path}: {oct(mode & 0o7777)} lacks {oct(missing)} (needs at least {oct(need)})")

    for path, need in sorted(wanted.items()):
        chain = fs.walk_path(path.rstrip("/"))
        if chain[-1][1] is None:
            found.append(f"{chain[-1][0]}: missing from the image")
            continue
        for d, n in chain[:-1]:
            if d not in seen_dirs:
                seen_dirs.add(d)
                check(d, n, 0o111)
        if not path.endswith("/"):
            check(path, chain[-1][1], need)
            continue
        stack = [(path.rstrip("/"), chain[-1][1])]
        while stack:
            d, n = stack.pop()
            check(d, n, 0o555)
            for name, child in fs.entries(n):
                count += 1
                if count > MAX_ENTRIES:
                    raise SystemExit(f"more than {MAX_ENTRIES} entries under {path}: raise MAX_ENTRIES on purpose")
                if stat.S_ISDIR(fs.stat(child)[0]):
                    stack.append((f"{d}/{name}", child))
                else:
                    check(f"{d}/{name}", child, 0o444)
    return found


def check_image(image, extra=EXTRA):
    """The list of problems in one disk image."""
    wanted = {p: m & 0o555 for p, m in git_modes(extra).items()}
    wanted.update({t + "/": 0o555 for t in TREES})
    wanted.update({b: 0o555 for b in BINARIES})
    return problems(Ext4(image, root_partition(image)), wanted)


def self_test():
    """A good tree passes; a 0600 copy of a 0644 source fails, as v3.35.6 did."""
    global TREES, BINARIES
    with tempfile.TemporaryDirectory() as tmp:
        src, tree, img = f"{tmp}/repo/extra", f"{tmp}/tree", f"{tmp}/fs.img"
        for d in (f"{src}/etc/systemd/network", f"{tree}/etc/systemd/network", f"{tree}/usr/share/medbrains/apps"):
            os.makedirs(d)
        for base in (src, tree):
            with open(f"{base}/etc/systemd/network/80-wired.network", "w") as f:
                f.write("[Match]\n")
        with open(f"{tree}/usr/share/medbrains/apps/medbrains.json", "w") as f:
            f.write("{}\n")
        subprocess.run(["git", "init", "-q", f"{tmp}/repo"], check=True)
        subprocess.run(["git", "-C", f"{tmp}/repo", "add", "."], check=True)
        TREES, BINARIES = ["/usr/share/medbrains"], []
        for d, _, files in os.walk(tree):
            os.chmod(d, 0o755)
            for name in files:
                os.chmod(f"{d}/{name}", 0o644)

        def run():
            """Makes the filesystem from the tree and checks it."""
            if os.path.exists(img):
                os.unlink(img)
            subprocess.run(["mkfs.ext4", "-q", "-E", "root_owner=0:0", "-d", tree, img, "8M"], check=True)
            return check_image(img, src)

        assert run() == [], run()
        os.chmod(f"{tree}/etc/systemd/network/80-wired.network", 0o600)
        assert any("80-wired.network" in p for p in run()), "a 0600 network unit was not caught"
        os.chmod(f"{tree}/etc/systemd/network/80-wired.network", 0o644)
        os.chmod(f"{tree}/usr/share/medbrains/apps", 0o700)
        assert any("/apps:" in p for p in run()), "an unsearchable manifest directory was not caught"
    print("check-image-modes: self-test passed")


def main():
    """Checks the image named on the command line, or runs the self-test."""
    if sys.argv[1:] == ["--self-test"]:
        return self_test()
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    found = check_image(sys.argv[1])
    for p in found:
        print(f"UNREADABLE {p}")
    if found:
        raise SystemExit(f"{len(found)} file mode problems in {sys.argv[1]}: the box could not set itself up")
    print(f"check-image-modes: {sys.argv[1]}: every file the OS adds is readable where it must be")


if __name__ == "__main__":
    main()
