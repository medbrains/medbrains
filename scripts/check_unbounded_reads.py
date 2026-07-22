#!/usr/bin/env python3
"""
Unbounded multi-row read check.

CLAUDE.md makes bounding a rule: "bound every loop/traversal/fan-out (depth
caps, LIMIT, no unbounded growth)". The codebase mostly follows it — 198
`query_as` SELECTs carry a LIMIT — but a query with neither a LIMIT nor a
WHERE returns the whole table for the tenant, and grows with the tenant.

Most SELECTs without a LIMIT are fine and are not flagged: `WHERE invoice_id =
$1` is bounded by how many items one invoice has, and adding a LIMIT there says
nothing. What this looks for is the pair — no LIMIT *and* no WHERE — where
nothing bounds the result at all.

Three exist. Two are bounded by their own shape:

    medbrains-db/src/audit.rs           SELECT DISTINCT tenant_id FROM audit_log
                                        — one row per tenant, for a rollup job
    medbrains-sso-login/src/lib.rs      sso_active_providers_by_host($1)
                                        — a set-returning function, parameterised

The third was `list_sensitive_patients`, which returned every flagged patient
for the tenant along with their name, while the seven other list queries in
that same file all use LIMIT 5000. Bounded in #4542.

Exit codes:
    0  Unbounded reads match what is recorded
    1  A new one appeared
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
CRATES = REPO_ROOT / "medbrains" / "crates"

# Reads with no LIMIT and no WHERE whose result is bounded by something the
# query itself cannot express. Removing an entry is welcome; a new one fails.
RECORDED_UNBOUNDED = {
    "medbrains-db/src/audit.rs",
    "medbrains-sso-login/src/lib.rs",
}

QUERY_AS = re.compile(
    r'sqlx::query_as(?:::<[^>]*>)?\(\s*((?:"(?:[^"\\]|\\.)*"\s*\\?\s*)+),?\s*\)', re.S
)


def main() -> int:
    if not CRATES.exists():
        print(f"ERROR: {CRATES} not found", file=sys.stderr)
        return 2

    bounded = 0
    failures: list[str] = []

    for path in sorted(CRATES.rglob("*.rs")):
        if "/tests/" in str(path) or "/bin/" in str(path):
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        for match in QUERY_AS.finditer(text):
            sql = re.sub(
                r"\s+", " ", " ".join(re.findall(r'"((?:[^"\\]|\\.)*)"', match.group(1)))
            ).strip()
            if not sql.upper().startswith("SELECT"):
                continue
            # Only multi-row reads can run away.
            if "fetch_all" not in text[match.end() : match.end() + 400]:
                continue
            has_limit = re.search(r"\bLIMIT\b", sql, re.I)
            has_where = re.search(r"\bWHERE\b", sql, re.I)
            if has_limit or has_where:
                bounded += 1
                continue
            relative = str(path.relative_to(CRATES))
            if relative in RECORDED_UNBOUNDED:
                continue
            line = text[: match.start()].count("\n") + 1
            failures.append(f"{relative}:{line} — {sql[:90]}")

    print(f"multi-row reads bounded by a LIMIT or a WHERE: {bounded}")

    if failures:
        print(f"\n=== {len(failures)} READ WITH NEITHER A LIMIT NOR A WHERE ===")
        for failure in failures:
            print(f"  ✗ {failure}")
        print(
            "\nNothing bounds this result, so it grows with the tenant. Add a LIMIT "
            "(5000 is what the rest of the codebase uses), narrow it with a WHERE, "
            "or record it with the reason its shape already bounds it."
        )
        return 1

    print("✓ Unbounded reads match what is recorded.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
