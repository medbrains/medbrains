#!/usr/bin/env python3
"""SQLx compile-time guard — stop the runtime-SQL count from growing.

CLAUDE.md states the standard plainly: compile-time SQL only, via
`sqlx::query!`, `sqlx::query_as!` and `sqlx::query_scalar!`. The workspace is
a long way from it — roughly 3,971 runtime queries against 93 checked ones —
and that gap is not abstract. Every schema defect found in the 2026-09-06
sweep was a runtime query naming a column that does not exist: a dashboard
counting `beds.status`, a prescription audit reading `audit_log.performed_by`,
an order set writing `prescriptions.status`, a settlement upserting against a
conflict target matching no index. Around twenty of them, across eleven
crates. Under the macro form none would have compiled.

Converting all of them in one push is the wrong trade. It is a mechanical
rewrite of 19,079 bind sites across every data path in a hospital system,
where a transcription slip silently *changes* a query rather than failing
loudly, and it would add ~4,000 compile-time query checks to a build that
already needs a guard script to stop two jobs taking the machine down.

So this is a ratchet, not a gate. `scripts/sqlx_runtime_baseline.txt` records
the runtime-query count per crate. The check fails when a crate's count goes
UP. It never has to be zero; it only has to shrink.

Two counts are tracked separately because they are different jobs:

  runtime   `sqlx::query(`, `sqlx::query_as::<`, `sqlx::query_scalar::<`
            — convertible to the macro form.
  select_*  `SELECT *` / `RETURNING *` — these must have their columns named
            before any macro can check them, and naming them is most of the
            benefit on its own. `SELECT *` decoded into a hand-written struct
            is exactly what produced the worst finds in that sweep: the
            settlement struct declared four columns the table lacks, the
            substitutes struct wanted `created_by` and `updated_at`, and a
            duplicate onboarding struct wanted three more. In each case the
            query could not decode and the handler had never once worked.

  python3 scripts/check_sqlx_compile_time.py            # check
  python3 scripts/check_sqlx_compile_time.py --detail   # per-crate table
  python3 scripts/check_sqlx_compile_time.py --update   # regenerate baseline
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CRATES = ROOT / "crates"
BASELINE_FILE = Path(__file__).resolve().parent / "sqlx_runtime_baseline.txt"

# Runtime query constructors. The macro forms (`query!`) are deliberately not
# matched: `query(` requires the `(` so `query!` cannot satisfy it.
RUNTIME = re.compile(r"sqlx::query(?:_as|_scalar)?(?:::<|\()")
# The macro forms, counted only to report progress.
MACRO = re.compile(r"sqlx::query(?:_as|_scalar)?!")
# Star projections, in a SQL string literal.
STAR = re.compile(r"(?:SELECT|RETURNING)\s+\*", re.I)

# Crates excluded from the ratchet, with the reason. Generated and test-only
# code is not where the standard needs enforcing.
EXCLUDED = {
    "medbrains-loadtest": "generated goose transactions, regenerated wholesale",
    "medbrains-db": "migration runner and pool plumbing, not domain queries",
}


def crate_counts() -> dict[str, tuple[int, int, int]]:
    """{crate -> (runtime, star, macro)} over each crate's src tree."""
    out: dict[str, tuple[int, int, int]] = {}
    for crate_dir in sorted(CRATES.iterdir()):
        if not (crate_dir / "src").is_dir() or crate_dir.name in EXCLUDED:
            continue
        runtime = star = macro = 0
        for path in (crate_dir / "src").rglob("*.rs"):
            text = path.read_text(encoding="utf-8", errors="replace")
            runtime += len(RUNTIME.findall(text))
            star += len(STAR.findall(text))
            macro += len(MACRO.findall(text))
        if runtime or star or macro:
            out[crate_dir.name] = (runtime, star, macro)
    return out


def load_baseline() -> dict[str, tuple[int, int]]:
    """Parse `crate: runtime, star` lines."""
    if not BASELINE_FILE.exists():
        return {}
    out: dict[str, tuple[int, int]] = {}
    for line in BASELINE_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or ":" not in line:
            continue
        crate, nums = line.split(":", 1)
        parts = [p.strip() for p in nums.split(",")]
        if len(parts) == 2 and all(p.isdigit() for p in parts):
            out[crate.strip()] = (int(parts[0]), int(parts[1]))
    return out


def write_baseline(counts: dict[str, tuple[int, int, int]]) -> None:
    header = (
        "# SQLx runtime-query baseline — per crate: runtime_queries, star_projections\n"
        "#\n"
        "# A RATCHET, not a target. These numbers may fall and must never rise.\n"
        "# New queries use sqlx::query!/query_as!/query_scalar! so the compiler\n"
        "# checks them against .sqlx metadata; existing ones convert under the\n"
        "# Boy Scout rule, starting with the star projections.\n"
        "#\n"
        "# Regenerate with: python3 scripts/check_sqlx_compile_time.py --update\n"
        "# Only ever regenerate to record a REDUCTION.\n"
    )
    lines = [f"{c}: {r}, {s}" for c, (r, s, _m) in sorted(counts.items())]
    BASELINE_FILE.write_text(header + "\n".join(lines) + "\n", encoding="utf-8")


def main(argv: list[str]) -> int:
    if not CRATES.is_dir():
        print(f"check-sqlx: crates dir not found: {CRATES}", file=sys.stderr)
        return 2

    counts = crate_counts()
    tot_runtime = sum(r for r, _s, _m in counts.values())
    tot_star = sum(s for _r, s, _m in counts.values())
    tot_macro = sum(m for _r, _s, m in counts.values())
    checked_pct = 100.0 * tot_macro / (tot_macro + tot_runtime) if (tot_macro + tot_runtime) else 0.0

    if "--update" in argv:
        write_baseline(counts)
        print(
            f"check-sqlx: baseline written — {len(counts)} crate(s), "
            f"{tot_runtime} runtime, {tot_star} star projection(s)"
        )
        return 0

    if "--detail" in argv:
        print(f"{'crate':38} {'runtime':>8} {'SELECT *':>9} {'macro':>7}")
        for crate, (r, s, m) in sorted(counts.items(), key=lambda kv: -kv[1][0]):
            if r or s:
                print(f"{crate:38} {r:>8} {s:>9} {m:>7}")
        print()

    baseline = load_baseline()
    if not baseline:
        print(
            "check-sqlx: no baseline recorded yet.\n"
            "  Run: python3 scripts/check_sqlx_compile_time.py --update",
            file=sys.stderr,
        )
        return 2

    grown: list[str] = []
    for crate, (runtime, star, _macro) in sorted(counts.items()):
        base_runtime, base_star = baseline.get(crate, (0, 0))
        if runtime > base_runtime:
            grown.append(
                f"  {crate}: runtime queries {base_runtime} -> {runtime} "
                f"(+{runtime - base_runtime})"
            )
        if star > base_star:
            grown.append(
                f"  {crate}: star projections {base_star} -> {star} (+{star - base_star})"
            )

    print(
        f"sqlx: {tot_macro} compile-time checked, {tot_runtime} runtime "
        f"({checked_pct:.1f}% checked), {tot_star} star projection(s)"
    )

    if grown:
        print("\ncheck-sqlx: FAILED — runtime SQL grew:\n", file=sys.stderr)
        print("\n".join(grown), file=sys.stderr)
        print(
            "\nNew queries must use the compile-time macros:\n"
            "    sqlx::query_as!(Row, \"SELECT a, b FROM t WHERE id = $1\", id)\n"
            "so the compiler checks them against committed .sqlx metadata. A runtime\n"
            "query naming a column that does not exist compiles, ships, and fails only\n"
            "when it runs — and if the caller swallows the error, not even then.\n"
            "\n"
            "If a reduction elsewhere makes this legitimate, re-record the baseline:\n"
            "    python3 scripts/check_sqlx_compile_time.py --update",
            file=sys.stderr,
        )
        return 1

    shrunk = sum(
        max(0, baseline.get(c, (0, 0))[0] - r) for c, (r, _s, _m) in counts.items()
    )
    tail = f", {shrunk} fewer than baseline" if shrunk else ""
    print(f"check-sqlx: OK — no crate grew its runtime SQL{tail}.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
