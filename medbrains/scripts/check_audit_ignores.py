#!/usr/bin/env python3
"""Every ignored advisory carries a reason and an expiry; an expired one fails CI.

An ignore with no end date is a vulnerability nobody will look at again. The
two lists:

  deny.toml            [advisories] ignore = [{ id = "RUSTSEC-…", reason = "… expires YYYY-MM-DD" }]
  pnpm-workspace.yaml  auditConfig.ignoreGhsas:  - GHSA-…  # … expires YYYY-MM-DD

`--cargo-audit-args` prints the deny.toml ids as `--ignore ID …` so cargo-audit
uses the same list instead of a second copy.
"""

import datetime
import pathlib
import re
import sys
import tomllib

ROOT = pathlib.Path(__file__).resolve().parent.parent
EXPIRES = re.compile(r"expires (\d{4}-\d{2}-\d{2})")
GHSA_LINE = re.compile(r"^\s*-\s*(GHSA-[\w-]+)\s*(?:#\s*(.*))?$")


def cargo_ignores() -> list[tuple[str, str]]:
    deny = tomllib.loads((ROOT / "deny.toml").read_text())
    out = []
    for entry in deny["advisories"].get("ignore", []):
        if isinstance(entry, str):
            out.append((entry, ""))
        else:
            out.append((entry["id"], entry.get("reason", "")))
    return out


def pnpm_ignores() -> list[tuple[str, str]]:
    lines = (ROOT / "pnpm-workspace.yaml").read_text().splitlines()
    out, inside = [], False
    for line in lines:
        if line.strip().startswith("ignoreGhsas:"):
            inside = True
            continue
        if not inside:
            continue
        if line.strip().startswith("#") or not line.strip():
            continue
        match = GHSA_LINE.match(line)
        if not match:
            break
        out.append((match.group(1), match.group(2) or ""))
    return out


def problems(entries: list[tuple[str, str]], today: datetime.date) -> list[str]:
    found = []
    for advisory, reason in entries:
        expiry = EXPIRES.search(reason)
        if not expiry:
            found.append(f"{advisory}: needs a reason ending 'expires YYYY-MM-DD'")
        elif datetime.date.fromisoformat(expiry.group(1)) < today:
            found.append(f"{advisory}: ignore expired {expiry.group(1)} — re-decide it")
    return found


def main() -> int:
    if "--cargo-audit-args" in sys.argv:
        sys.stdout.write(" ".join(f"--ignore {a}" for a, _ in cargo_ignores()) + "\n")
        return 0
    today = datetime.date.today()
    found = problems(cargo_ignores(), today) + problems(pnpm_ignores(), today)
    for line in found:
        sys.stderr.write(line + "\n")
    return 1 if found else 0


def _selftest() -> None:
    day = datetime.date(2026, 10, 23)
    assert problems([("A", "x expires 2026-10-24")], day) == []
    assert problems([("A", "x expires 2026-10-22")], day)
    assert problems([("A", "no date")], day)


if __name__ == "__main__":
    _selftest()
    sys.exit(main())
