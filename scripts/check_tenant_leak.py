#!/usr/bin/env python3
"""
Tenant Leak Check — ratchets raw SQL inside route handlers.

Rule: route handlers under `crates/medbrains-server/src/routes/` should NOT
write SQL via `sqlx::query*` — they should consume typed helpers from
`medbrains-db` so tenant scoping, RLS context, and audit logging stay
centralized.

Reality: 600+ existing call sites pre-date this rule. Hard ratchet:

  - Per-file baseline in scripts/.tenant_leak_baseline.json
  - PRs may NOT increase the count for any file (new violation = fail)
  - Removing violations is always free; baseline auto-tightens on
    `--update-baseline` after intentional cleanup PR
  - New files default to baseline 0 (no new raw SQL allowed in routes)

Other infrastructure code (middleware, seed, events, orchestration) is NOT
gated — it runs with admin context.

Escape hatch: `// allow-raw-sql: <reason>` on the same line suppresses
that line entirely (does not count toward the baseline either).

Usage:
    python3 scripts/check_tenant_leak.py              # CI mode
    python3 scripts/check_tenant_leak.py --update-baseline  # after cleanup

Exit codes:
    0  Counts at or below baseline
    1  One or more files exceed their baseline
"""

import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
ROUTES_DIR = REPO_ROOT / "medbrains" / "crates" / "medbrains-server" / "src" / "routes"
BASELINE_FILE = REPO_ROOT / "scripts" / ".tenant_leak_baseline.json"

# raw SQL call sites we forbid outside medbrains-db
PATTERNS = [
    re.compile(r"\bsqlx::query\s*[!(]", ),
    re.compile(r"\bsqlx::query_as\s*[!(]"),
    re.compile(r"\bsqlx::query_scalar\s*[!(]"),
    re.compile(r"\bPgPool::execute\b"),
    re.compile(r"\bPgConnection::execute\b"),
]

ALLOW_COMMENT_RE = re.compile(r"//\s*allow-raw-sql\b")


def collect_violations() -> tuple[dict[str, int], int, int]:
    """Returns (per_file_counts, total_violations, total_suppressed)."""
    per_file: dict[str, int] = {}
    suppressed = 0

    for rs_file in ROUTES_DIR.rglob("*.rs"):
        try:
            text = rs_file.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        rel = str(rs_file.relative_to(REPO_ROOT))
        count = 0
        for line in text.splitlines():
            if not any(p.search(line) for p in PATTERNS):
                continue
            if ALLOW_COMMENT_RE.search(line):
                suppressed += 1
            else:
                count += 1
        if count > 0:
            per_file[rel] = count
    total = sum(per_file.values())
    return per_file, total, suppressed


def load_baseline() -> dict[str, int]:
    if not BASELINE_FILE.exists():
        return {}
    try:
        return json.loads(BASELINE_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def write_baseline(per_file: dict[str, int]) -> None:
    sorted_data = dict(sorted(per_file.items()))
    BASELINE_FILE.write_text(
        json.dumps(sorted_data, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def main() -> int:
    if not ROUTES_DIR.exists():
        print(f"ERROR: routes dir not found: {ROUTES_DIR}", file=sys.stderr)
        return 2

    update_mode = "--update-baseline" in sys.argv

    per_file, total, suppressed = collect_violations()

    if update_mode:
        write_baseline(per_file)
        print(f"✓ Baseline updated: {len(per_file)} files, {total} violations.")
        print(f"  Saved to {BASELINE_FILE.relative_to(REPO_ROOT)}")
        return 0

    baseline = load_baseline()
    if not baseline:
        # First run — establish baseline rather than failing
        write_baseline(per_file)
        print(
            f"NOTE: no baseline file. Created at {BASELINE_FILE.relative_to(REPO_ROOT)} "
            f"with {len(per_file)} files, {total} violations."
        )
        print("Subsequent runs ratchet against this baseline.")
        return 0

    increased: list[tuple[str, int, int]] = []  # (path, baseline, current)
    new_files: list[tuple[str, int]] = []        # (path, count)
    decreased = 0

    for path, count in per_file.items():
        bl = baseline.get(path, 0)
        if path not in baseline:
            new_files.append((path, count))
        elif count > bl:
            increased.append((path, bl, count))
        elif count < bl:
            decreased += bl - count

    if decreased:
        print(f"NOTE: {decreased} violations removed since baseline (good!).")
        print(f"      Run with --update-baseline to ratchet down.")

    if new_files:
        print(f"\n=== {len(new_files)} NEW FILES WITH RAW SQL (not in baseline) ===")
        for path, count in new_files:
            print(f"  ✗ {path}: {count} new violation(s)")

    if increased:
        print(f"\n=== {len(increased)} FILES EXCEEDED BASELINE ===")
        for path, bl, count in increased:
            print(f"  ✗ {path}: {bl} → {count} (+{count - bl})")

    if increased or new_files:
        print()
        print("PRs must not add new raw SQL in routes/. Options:")
        print("  - Move SQL into crates/medbrains-db as a typed helper")
        print("  - Use existing `medbrains_db::*` functions")
        print("  - Add `// allow-raw-sql: <reason>` on the line (reviewed)")
        return 1

    print(
        f"✓ Baseline OK. {total} violations across {len(per_file)} files "
        f"(no increases). {suppressed} explicit suppressions."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
