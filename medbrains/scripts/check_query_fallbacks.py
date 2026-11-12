#!/usr/bin/env python3
"""Query data defaulted to `[]` or `false` only ever goes down (ratchet, #5474).

    python3 scripts/check_query_fallbacks.py            # check (CI)
    python3 scripts/check_query_fallbacks.py --update   # record an improvement
    python3 scripts/check_query_fallbacks.py --report   # per-file triage list
    python3 scripts/check_query_fallbacks.py --self-test

`data ?? []` (or `data || []`) turns a failed or loading query into an empty list, and
`data ?? false` turns it into a refusal. Rendered, both make a claim the
system cannot back: a blank ward reads as a fact about the ward (authz law,
rule 6). The default is sometimes harmless — a table that also gets `error`,
or a count nobody sees — which is why this is a per-file ratchet, not a ban:
new code checks `isError` / `error` and shows `QueryError`
(`@/components/QueryError`), or passes `error` to `DataTable`.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "apps/web/src"
BASELINE = ROOT / "scripts/query_fallbacks.baseline.json"

FALLBACK = r"(?:\?\?|\|\|)\s*(?:\[\]|false\b)"
PATTERNS = [
    # data?.patients ?? []   data ?? false   roster.data ?? []   bedsData ?? []
    re.compile(r"\b(?:\w*[dD]ata|\w+\.data)(?:\??\.\w+)*\s*" + FALLBACK),
    # const { data = [] } = useQuery(...)   const { data: beds = [] } = useQuery(...)
    re.compile(r"\{[^{}]*\bdata(?:\s*:\s*\w+)?\s*=\s*(?:\[\]|false)[^{}]*\}\s*=\s*use\w*Query\b"),
]


def count(text: str) -> int:
    """Query-data fallbacks in one file's text."""
    return sum(len(p.findall(text)) for p in PATTERNS)


def measure() -> dict[str, int]:
    """Per-file counts across the web app, tests and stories excluded."""
    out: dict[str, int] = {}
    for path in sorted(SRC.rglob("*.ts*")):
        if ".test." in path.name or ".stories." in path.name or path.suffix not in {".ts", ".tsx"}:
            continue
        n = count(path.read_text(encoding="utf-8"))
        if n:
            out[str(path.relative_to(ROOT))] = n
    return out


def self_test() -> None:
    """Fail if the patterns stop telling query data from other defaults."""
    assert count("const patients = data?.patients ?? [];") == 1
    assert count("const beds = (bedsData ?? []) as Bed[];") == 1
    assert count("data={roster.data ?? []}") == 1
    assert count("const ok = perms.data?.allowed ?? false;") == 1
    assert count("const { data = [] } = useQuery({") == 1
    assert count("const rows = data?.rows || [];") == 1
    assert count("const { data: queue = [], isLoading } = useQuery({") == 1
    assert count("const tags = props.tags ?? [];") == 0
    assert count("const { value = [] } = useForm({") == 0
    print("self-test passed")


def main() -> int:
    """Compare today's per-file counts with the baseline; any rise fails."""
    if "--self-test" in sys.argv:
        self_test()
        return 0
    now = measure()
    if "--report" in sys.argv:
        for path, n in sorted(now.items(), key=lambda kv: -kv[1]):
            print(f"{n:4}  {path}")
        print(f"\n{sum(now.values())} fallbacks in {len(now)} files")
        return 0
    if "--update" in sys.argv:
        BASELINE.write_text(json.dumps(now, indent=1) + "\n", encoding="utf-8")
        print(f"baseline written: {sum(now.values())} fallbacks in {len(now)} files")
        return 0
    baseline: dict[str, int] = json.loads(BASELINE.read_text(encoding="utf-8"))
    worse = {k: v for k, v in now.items() if v > baseline.get(k, 0)}
    for path, n in sorted(worse.items()):
        print(
            f"{path}: {baseline.get(path, 0)} -> {n} query fallbacks to []/false. "
            "Check isError and show QueryError, or pass error to DataTable."
        )
    better = sorted(k for k, v in baseline.items() if now.get(k, 0) < v)
    if better:
        print(f"improved: {len(better)} files. Run with --update to lock it in.")
    if not worse:
        print(f"query-fallbacks: {sum(now.values())} in {len(now)} files, none new")
    return 1 if worse else 0


if __name__ == "__main__":
    sys.exit(main())
