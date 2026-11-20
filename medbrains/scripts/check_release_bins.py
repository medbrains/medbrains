#!/usr/bin/env python3
"""The server tarball carries every binary install.sh installs.

    python3 medbrains/scripts/check_release_bins.py                 # CI: install.sh vs release.yml
    python3 medbrains/scripts/check_release_bins.py --tarball X.tgz  # release: vs the packed file
    python3 medbrains/scripts/check_release_bins.py --self-test

install.sh refuses to run without each binary in its BINARIES array, and the
release packs `medbrains-server-bins-linux-*.tar.gz` from the names in the
build-backend "Collect" loop. The two lists drifted once (medbrains-proxy was
never packed), so a hospital could download a release that could not install.
"""

from __future__ import annotations

import re
import sys
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
INSTALL = ROOT / "medbrains/deploy/standalone/install.sh"
RELEASE = ROOT / ".github/workflows/release.yml"


def install_binaries(text: str) -> set[str]:
    """Every name assigned or appended to install.sh's BINARIES array."""
    names: set[str] = set()
    for body in re.findall(r"^\s*BINARIES\+?=\(([^)]*)\)", text, re.M):
        names.update(body.split())
    return names


def collected_binaries(text: str) -> set[str]:
    """The names build-backend copies into the tarball's directory."""
    match = re.search(r"for b in ([^;]+); do\s*\n\s*cp \"target/", text)
    return set(match.group(1).split()) if match else set()


def tarball_binaries(path: str) -> set[str]:
    """File names at any depth inside a packed tarball."""
    with tarfile.open(path) as tar:
        return {Path(m.name).name for m in tar.getmembers() if m.isfile()}


def report(needed: set[str], shipped: set[str], where: str) -> int:
    """Print what install.sh needs that `where` lacks; 1 if anything."""
    if not needed:
        print("ERROR: found no BINARIES array in install.sh", file=sys.stderr)
        return 1
    missing = sorted(needed - shipped)
    for name in missing:
        print(f"ERROR: install.sh installs {name}, but {where} does not ship it", file=sys.stderr)
    if not missing:
        print(f"ok: {where} ships all {len(needed)} binaries install.sh installs")
    return 1 if missing else 0


def self_test() -> int:
    """The parsers read the shapes the real files use, and a gap is caught."""
    sh = "BINARIES=(a b)\nif x; then\n    BINARIES+=(c)\nfi\n"
    yml = '          for b in a b; do\n            cp "target/x/release/$b" ../bins/\n'
    assert install_binaries(sh) == {"a", "b", "c"}
    assert collected_binaries(yml) == {"a", "b"}
    assert report({"a", "b", "c"}, {"a", "b"}, "test") == 1
    assert report({"a"}, {"a", "b"}, "test") == 0
    assert report(set(), {"a"}, "test") == 1
    print("self-test ok")
    return 0


def main(argv: list[str]) -> int:
    """Compare install.sh with the release workflow, or with a tarball."""
    if argv[:1] == ["--self-test"]:
        return self_test()
    needed = install_binaries(INSTALL.read_text())
    if argv[:1] == ["--tarball"] and len(argv) == 2:
        return report(needed, tarball_binaries(argv[1]), argv[1])
    return report(needed, collected_binaries(RELEASE.read_text()), "release.yml build-backend")


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
