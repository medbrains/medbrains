#!/usr/bin/env python3
"""Web code of one brick does not import another brick's, and the count only falls.

    python3 scripts/check_web_brick_imports.py              # check (CI)
    python3 scripts/check_web_brick_imports.py --update     # record drops (never a rise)
    python3 scripts/check_web_brick_imports.py --pairs      # today's counts, baseline format
    python3 scripts/check_web_brick_imports.py --list A B   # the imports behind one pair
    python3 scripts/check_web_brick_imports.py --self-test

`apps/web/brick-units.json` says which brick each source unit of `apps/web/src`
belongs to. A unit is `pages/<entry>`, `components/<entry>`, `features/<entry>`
or `services/<file>` (a folder and a file of the same name are one unit), any
other top-level folder, or `.` for the files beside `main.tsx`. `core` (the
shell and Administration) and `shared` (design system, hooks, shared pickers)
are not bricks.

Every import statement (`from "…"`, `import "…"`, `import("…")`, by `@/` or a
relative path) from a unit of brick A to a unit of brick B counts for the pair
`A -> B`. The check fails when a pair is above
`scripts/web_brick_imports.baseline.txt` or not in it, when a unit on disk has
no row in the map, and when a row names a unit that is gone. A pair below its
baseline passes; `--update` lowers the file and cannot raise it.

Test, story and fixture files are not counted. Imports of `@medbrains/api`
areas are not counted either: this is about web source units only.
"""

from __future__ import annotations

import json
import posixpath
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "apps" / "web" / "src"
UNITS = ROOT / "apps" / "web" / "brick-units.json"
BASELINE = ROOT / "scripts" / "web_brick_imports.baseline.txt"

NOT_A_BRICK = {"core", "shared"}
SPLIT_FOLDERS = {"pages", "components", "features", "services"}
SKIPPED = re.compile(r"\.(test|stories)\.|__fixtures__|(^|/)test/")
IMPORT = re.compile(r"""(?:from\s+|import\s*\(\s*|import\s+)["']([^"']+)["']""")
HEADER = """\
# Import statements from one brick's web source into another brick's, per pair, on 2026-11-23.
# Checked by scripts/check_web_brick_imports.py (make check-web-brick-imports).
# A pair may only fall: --update lowers a number and drops a pair at zero. It never raises one
# and never adds a pair; doing either by hand needs the owner.
"""


def unit_of(path: str) -> str:
    """The unit a path under `src/` belongs to (`pages/billing/x.tsx` -> `pages/billing`)."""
    parts = path.split("/")
    if len(parts) == 1:
        return "."
    if parts[0] in SPLIT_FOLDERS:
        return f"{parts[0]}/{parts[1].split('.')[0]}"
    return parts[0]


def resolve(source: str, spec: str) -> str | None:
    """The `src/`-relative path an import names, or None for a package or a path outside `src/`."""
    if spec.startswith("@/"):
        return spec[2:] or None
    if not spec.startswith("."):
        return None
    target = posixpath.normpath(posixpath.join(posixpath.dirname(source), spec))
    return None if target.startswith("..") or target == "." else target


def count_pairs(files: dict[str, str], units: dict[str, str]) -> tuple[Counter, list[str]]:
    """Cross-brick import counts per `(from brick, to brick)`, and one line per counted import."""
    pairs, detail = Counter(), []
    for source, text in sorted(files.items()):
        src_brick = units.get(unit_of(source))
        for spec in IMPORT.findall(text):
            target = resolve(source, spec)
            # `@/hooks` names a top-level folder; `@/i18n` a file beside main.tsx.
            dst_brick = units.get(target if target in units else unit_of(target)) if target else None
            # A bare `@/pages` or `@/components` names the folder, which is nobody's unit.
            if not src_brick or not dst_brick or (target in SPLIT_FOLDERS):
                continue
            if src_brick != dst_brick and not {src_brick, dst_brick} & NOT_A_BRICK:
                pairs[(src_brick, dst_brick)] += 1
                detail.append(f"{src_brick} -> {dst_brick}: {source} imports {spec}")
    return pairs, detail


def read_baseline(text: str) -> dict[tuple[str, str], int]:
    """The baseline as `(from, to) -> allowed count`; lines read `from -> to N`."""
    rows = (line.split() for line in text.splitlines() if line.strip() and not line.startswith("#"))
    return {(src, dst): int(count) for src, _, dst, count in rows}


def problems(files: dict[str, str], units: dict[str, str], base: dict[tuple[str, str], int]) -> list[str]:
    """Every reason to fail: unmapped units, rows for units that are gone, pairs above baseline."""
    on_disk = {unit_of(path) for path in files}
    out = [f"{unit}: no row in apps/web/brick-units.json (say which brick owns it)" for unit in sorted(on_disk - units.keys())]
    out += [f"{unit}: in apps/web/brick-units.json but not in src (delete the row)" for unit in sorted(units.keys() - on_disk)]
    pairs, _ = count_pairs(files, units)
    for (src, dst), count in sorted(pairs.items()):
        allowed = base.get((src, dst), 0)
        if count > allowed:
            out.append(f"{src} -> {dst}: {count} import statements, baseline {allowed} (see --list {src} {dst})")
    return out


def lowered(pairs: Counter, base: dict[tuple[str, str], int]) -> dict[tuple[str, str], int]:
    """The baseline after `--update`: each pair falls to its count, a pair at zero goes, none rises."""
    new = {pair: min(pairs.get(pair, 0), allowed) for pair, allowed in base.items()}
    return {pair: count for pair, count in new.items() if count}


def format_pairs(pairs: dict[tuple[str, str], int]) -> str:
    """Baseline lines for the given counts, sorted."""
    return "".join(f"{src} -> {dst} {count}\n" for (src, dst), count in sorted(pairs.items()))


def load_sources() -> dict[str, str]:
    """Every counted `.ts`/`.tsx` file under `src/`, keyed by its `src/`-relative path."""
    files = {}
    for path in SRC.rglob("*.ts*"):
        rel = path.relative_to(SRC).as_posix()
        if path.suffix in (".ts", ".tsx") and not SKIPPED.search(rel):
            files[rel] = path.read_text(encoding="utf-8", errors="ignore")
    return files


def self_test() -> int:
    """Prove a new cross-brick import fails, and that shared code and same-brick imports do not count."""
    assert unit_of("pages/billing/Invoice.tsx") == unit_of("pages/billing.tsx") == "pages/billing"
    assert unit_of("services/abha.service.ts") == "services/abha" and unit_of("hooks/useX.ts") == "hooks"
    assert unit_of("main.tsx") == "."
    assert resolve("pages/lab/a.tsx", "../../components/Lab/x") == "components/Lab/x"
    assert resolve("pages/lab/a.tsx", "@/pages/billing") == "pages/billing"
    assert resolve("pages/lab/a.tsx", "react") is None and resolve("main.tsx", "../outside") is None
    units = {"pages/lab": "lab", "components/Lab": "lab", "pages/billing": "billing", "components/ui": "shared",
             "pages/admin": "core", "components/Camp": "not-yet:camp", ".": "core"}
    files = {
        "pages/lab/a.tsx": 'import { X } from "@/components/Lab/x";\nimport { B } from "@/components/ui";\nimport "@/pages/admin/y";\n',
        "components/Lab/x.tsx": 'import { T } from "./types";\nimport React from "react";\n',
        "pages/billing/b.tsx": "export const b = 1;\n", "components/ui/index.ts": 'export * from "@/pages/lab/a";\n',
        "pages/admin/y.tsx": 'import("@/pages/billing/b");\n', "components/Camp/c.tsx": "", "main.tsx": 'import "./pages/lab/a";\n',
    }
    assert not problems(files, units, {})
    crossing = {**files, "pages/lab/a.tsx": files["pages/lab/a.tsx"] + 'const P = lazy(() => import("../billing/b"));\n'}
    assert problems(crossing, units, {}) == ["lab -> billing: 1 import statements, baseline 0 (see --list lab billing)"]
    assert not problems(crossing, units, {("lab", "billing"): 1})
    twice = {**crossing, "components/Camp/c.tsx": 'import { b } from "@/pages/billing/b";\nimport type { X } from "@/components/Lab/x";\n'}
    assert count_pairs(twice, units)[0] == {("lab", "billing"): 1, ("not-yet:camp", "billing"): 1, ("not-yet:camp", "lab"): 1}
    assert len(problems(twice, units, {("lab", "billing"): 1})) == 2
    assert problems({**files, "pages/new/n.tsx": ""}, units, {}) == ["pages/new: no row in apps/web/brick-units.json (say which brick owns it)"]
    assert problems(files, {**units, "pages/gone": "lab"}, {})[0].startswith("pages/gone: in apps/web/brick-units.json but not in src")
    # Test files are skipped on load, and --update can lower or drop a pair but never raise or add one.
    assert SKIPPED.search("pages/lab/a.test.tsx") and SKIPPED.search("test/setup.ts") and not SKIPPED.search("pages/latest/a.tsx")
    base = {("lab", "billing"): 3, ("billing", "lab"): 2}
    assert lowered(Counter({("lab", "billing"): 5, ("opd", "lab"): 1}), base) == {("lab", "billing"): 3}
    assert lowered(Counter({("lab", "billing"): 1, ("billing", "lab"): 2}), base) == {("lab", "billing"): 1, ("billing", "lab"): 2}
    assert read_baseline(HEADER + format_pairs(base)) == base
    print("✓ self-test passed")
    return 0


def main() -> int:
    """Check the web source against the unit map and the baseline; 1 on any problem."""
    if "--self-test" in sys.argv:
        return self_test()
    files, units = load_sources(), json.loads(UNITS.read_text(encoding="utf-8"))["units"]
    pairs, detail = count_pairs(files, units)
    if "--pairs" in sys.argv:
        print(format_pairs(pairs), end="")
        return 0
    if "--list" in sys.argv:
        src, dst = sys.argv[sys.argv.index("--list") + 1 :][:2]
        print("\n".join(line for line in detail if line.startswith(f"{src} -> {dst}: ")))
        return 0
    base = read_baseline(BASELINE.read_text(encoding="utf-8"))
    if "--update" in sys.argv:
        base = lowered(pairs, base)
        BASELINE.write_text(HEADER + format_pairs(base), encoding="utf-8")
    found = problems(files, units, base)
    if found:
        print("✗ web brick imports (docs/architecture/MODULE-BRICKS.md):")
        for line in found:
            print(f"  {line}")
        print("  a brick shows another brick's screen through a panel slot or a route, not an import")
        return 1
    total, allowed = sum(pairs.values()), sum(base.values())
    note = "" if total == allowed else f"; baseline allows {allowed}, lower it with --update"
    print(f"✓ {total} cross-brick import statements over {len(pairs)} brick pairs, none above baseline{note}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
