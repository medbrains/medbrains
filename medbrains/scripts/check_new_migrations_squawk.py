#!/usr/bin/env python3
"""Lint the migrations a branch adds with Squawk, so a lock or rewrite of a big table fails.

    python3 medbrains/scripts/check_new_migrations_squawk.py [base]   # default origin/main
    python3 medbrains/scripts/check_new_migrations_squawk.py --staged # pre-commit: staged new files
    python3 medbrains/scripts/check_new_migrations_squawk.py --self-test

A ratchet: only files added against the base are linted, never the ones already merged.
sqlx::migrate!() runs each file in a transaction unless its first line is `-- no-transaction`,
so those files are linted without that assumption (CREATE INDEX CONCURRENTLY is allowed there
and refused anywhere else). A deliberate exception is a `-- squawk-ignore <rule>` comment above
the statement, with its reason. Rules and why some are off: medbrains/.squawk.toml.
"""

from __future__ import annotations

import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

MEDBRAINS = Path(__file__).resolve().parent.parent
CONFIG = MEDBRAINS / ".squawk.toml"
MIGRATIONS = "medbrains/crates/medbrains-db-migrations/src/migrations/"
NO_TX_MARKER = "-- no-transaction"
# A no-transaction file is the one CONCURRENTLY statement: a SET beside it would make Postgres
# run the file as one implicit transaction and refuse the build.
NO_TX_EXTRA_EXCLUDES = ["require-lock-timeout"]
INSTALL = "install the v2.74.0 binary from https://github.com/sbdchd/squawk/releases onto PATH"


def added_migrations(base: str | None) -> list[Path]:
    """New migration files: the staged ones when `base` is None, else those added since it."""
    top = Path(subprocess.check_output(["git", "rev-parse", "--show-toplevel"], text=True).strip())
    where = ["--cached"] if base is None else [f"{base}...HEAD"]
    out = subprocess.check_output(
        ["git", "-C", str(top), "diff", "--name-only", "--no-renames", "--diff-filter=A", *where,
         "--", f"{MIGRATIONS}*.sql"],
        text=True,
    )
    return [top / line for line in out.splitlines() if line]


def is_no_transaction(path: Path) -> bool:
    """Whether sqlx runs this file outside a transaction (its first line is the marker)."""
    with path.open(encoding="utf-8") as f:
        return f.readline().startswith(NO_TX_MARKER)


def config_excluded_rules() -> list[str]:
    """The config's excluded_rules (no tomllib: the hook may run on Python 3.9)."""
    # A regex over our own one-key file; use tomllib if the config grows nested tables.
    block = re.search(r"excluded_rules\s*=\s*\[(.*?)\]", CONFIG.read_text(), re.S)
    return re.findall(r'^\s*"([a-z-]+)"', block.group(1), re.M) if block else []


def squawk(files: list[Path], in_transaction: bool) -> int:
    """Run Squawk on `files` in one transaction mode; its exit code (0 when clean)."""
    if not files:
        return 0
    mode = ["--assume-in-transaction"]
    if not in_transaction:
        # A CLI --exclude replaces the config's list, so pass the whole list.
        excluded = config_excluded_rules() + NO_TX_EXTRA_EXCLUDES
        mode = ["--no-assume-in-transaction", f"--exclude={','.join(excluded)}"]
    cmd = ["squawk", f"--config={CONFIG}", *mode, *map(str, files)]
    return subprocess.run(cmd, check=False).returncode


def lint(files: list[Path]) -> int:
    """Lint each file in the mode sqlx will run it in; nonzero when any finding is left."""
    no_tx = [f for f in files if is_no_transaction(f)]
    in_tx = [f for f in files if f not in no_tx]
    results = [squawk(in_tx, True), squawk(no_tx, False)]  # both, so every finding is shown
    return 1 if any(results) else 0


def self_test() -> int:
    """Plain or in-transaction CONCURRENTLY index builds fail; a new table, a no-tx build pass."""
    lock = "SET LOCAL lock_timeout = '5s';\n"
    concurrent = "CREATE INDEX CONCURRENTLY IF NOT EXISTS i"
    samples = {
        "bad_index.sql": f"{lock}CREATE INDEX i ON public.patients (x);\n",
        "bad_concurrent_in_tx.sql": f"{lock}{concurrent} ON public.patients (x);\n",
        "good_table.sql": f"{lock}CREATE TABLE public.t (id uuid PRIMARY KEY);\n",
        "good_concurrent.sql": f"{NO_TX_MARKER}\n{concurrent} ON public.patients (x);\n",
    }
    with tempfile.TemporaryDirectory(prefix="squawk-selftest-") as tmp:
        failures = []
        for name, sql in samples.items():
            path = Path(tmp) / name
            path.write_text(sql)
            if (lint([path]) != 0) != name.startswith("bad_"):
                failures.append(name)
    print(f"self-test: {'FAILED on ' + ', '.join(failures) if failures else 'ok'}")
    return 1 if failures else 0


def main(argv: list[str]) -> int:
    """Entry point: self-test, staged files (pre-commit) or files added against a base (CI)."""
    staged = "--staged" in argv
    base = None if staged else next((a for a in argv if not a.startswith("-")), "origin/main")
    files = [] if "--self-test" in argv else added_migrations(base)
    if not files and "--self-test" not in argv:
        return 0
    if shutil.which("squawk") is None:
        print(f"squawk not found, so new migrations were not linted; {INSTALL}", file=sys.stderr)
        return 0 if staged else 1  # pre-commit skips; CI and the self-test must have it
    if "--self-test" in argv:
        return self_test()
    print(f"squawk: linting {len(files)} new migration(s)", flush=True)
    if lint(files):
        print("A new migration locks or rewrites a table (above). Fix it, or put "
              "`-- squawk-ignore <rule>` with the reason above the statement.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
