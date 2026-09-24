#!/usr/bin/env python3
"""
Migration files may be added. They may never be modified.

sqlx stores a checksum of each migration it applies and refuses to start when
the file on disk no longer matches. A comment, a reformat, a fixed typo — any
byte — stops every database that already ran it from booting the next build.
This compares every migration in the working tree against the version on
`origin/master`: a file that exists there and differs here fails.

  python3 scripts/check_migration_immutable.py            # against origin/master
  python3 scripts/check_migration_immutable.py --base HEAD~1
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
MIGRATIONS = Path("medbrains/crates/medbrains-db-migrations/src/migrations")


def git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=REPO_ROOT, capture_output=True, text=True, check=False).stdout


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="origin/master")
    args = ap.parse_args()

    if not git("rev-parse", "--verify", args.base).strip():
        print(f"base {args.base} not found — fetch first, or pass --base", file=sys.stderr)
        return 2

    on_base = set(git("ls-tree", "-r", "--name-only", args.base, "--", MIGRATIONS.as_posix()).split())
    changed = [
        line
        for line in git("diff", "--name-only", args.base, "--", MIGRATIONS.as_posix()).split()
        if line in on_base and (REPO_ROOT / line).exists()
    ]
    if changed:
        print(f"{len(changed)} applied migration(s) modified — sqlx will refuse to start:")
        for path in changed:
            print(f"  ✗ {path}")
        print("\nA migration already on master is immutable. Write a new migration instead.")
        return 1
    # Git is only half the answer. A migration committed locally and already
    # applied to a database is just as frozen, and `origin/master` does not
    # know about it yet: editing one passed this check and then stopped the
    # server with `VersionMismatch(1016)` on the next restart. `sqlx` stores
    # the SHA-384 of each applied file, so ask the database it was applied to.
    drifted = applied_checksum_drift()
    if drifted:
        print(f"{len(drifted)} migration(s) differ from what the local database has applied:")
        for name in drifted:
            print(f"  ✗ {name}")
        print("\nsqlx checks these on startup and refuses to run. Restore the file and")
        print("write a new migration; if the change is wanted locally, reset the database.")
        return 1

    print(f"✓ no migration on {args.base} has been modified")
    return 0


def applied_checksum_drift() -> list[str]:
    """Applied migrations whose file no longer matches its recorded checksum.

    Silent when no database is reachable — this is a belt on top of the git
    braces above, not a reason to fail a check on a machine with no Postgres.
    """
    import hashlib
    import subprocess

    try:
        out = subprocess.run(
            [
                "docker", "compose", "exec", "-T", "postgres",
                "psql", "-U", "medbrains", "-d", "medbrains", "-Atc",
                "SELECT version, encode(checksum, 'hex') FROM _sqlx_migrations",
            ],
            cwd=REPO_ROOT / "medbrains",
            capture_output=True,
            text=True,
            timeout=30,
        )
    except Exception:
        return []
    if out.returncode != 0:
        return []

    recorded = {}
    for line in out.stdout.splitlines():
        if "|" in line:
            version, checksum = line.split("|", 1)
            recorded[version.strip()] = checksum.strip()
    if not recorded:
        return []

    drifted = []
    for path in sorted((REPO_ROOT / MIGRATIONS).glob("*.sql")):
        version = path.name.split("_", 1)[0].lstrip("0") or "0"
        want = recorded.get(version)
        if want and hashlib.sha384(path.read_bytes()).hexdigest() != want:
            drifted.append(path.name)
    return drifted


if __name__ == "__main__":
    raise SystemExit(main())
