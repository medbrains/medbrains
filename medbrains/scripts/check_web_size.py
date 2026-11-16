#!/usr/bin/env python3
"""Web functions and files may only shrink (ratchet, class A size rules).

    python3 scripts/check_web_size.py                 # CI: fail when anything grew
    python3 scripts/check_web_size.py FILE...         # the edit hook: only these files
    python3 scripts/check_web_size.py --tighten       # write the lower numbers after a refactor
    python3 scripts/check_web_size.py --update        # owner only: accept today's numbers
    python3 scripts/check_web_size.py --self-test

Rules (docs/SOFTWARE-CLASSES.md): a function body is at most 60 lines, cognitive
complexity at most 15, and a file at most 300 lines. Biome measures functions with
its own rules (`noExcessiveLinesPerFunction`, `noExcessiveCognitiveComplexity`),
configured in `scripts/web-size/biome.json`.

Today's code breaks these thousands of times, so each file has a baseline: the
lines its functions run over 60, the complexity over 15, and the file's length if
it is over 300. A file fails when any of the three grows. Totals rather than counts
are kept so that splitting a 600-line function into two 300-line ones passes,
because the total over the limit falls, while a new 61-line function fails.
`--tighten` only lowers numbers, so anyone may run it after a refactor; raising a
number takes `--update`, which is the owner's call. A file moved with git keeps its
allowance where main's history is present (ponytail: CI's shallow checkout has none, so a
move there needs `--update`; fetch the history if moves become common). A file split out of another is new code, so it must meet the limits.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
WEB = os.path.join(ROOT, "apps", "web")
CONFIG = os.path.join(ROOT, "scripts", "web-size")
BASELINE = os.path.join(ROOT, "scripts", "web_size.baseline.json")
MAX_FUNCTION_LINES = 60
MAX_COMPLEXITY = 15
MAX_FILE_LINES = 300
BIOME_PATHS = (os.path.join(ROOT, "node_modules", ".bin", "biome"), os.path.join(WEB, "node_modules", ".bin", "biome"))
SKIP = (".test.", ".spec.", ".stories.", "/test/", "__tests__/", "__fixtures__", "test-fixtures",
        "/transport/mock", ".generated.", ".d.ts")
OUR_RULES = ("lint/complexity/noExcessiveLinesPerFunction", "lint/complexity/noExcessiveCognitiveComplexity")
LINES_RE = re.compile(r"too many lines \((\d+)\)")
COMPLEXITY_RE = re.compile(r"complexity of (\d+)")


def web_files() -> list[str]:
    """Every shipped TS/TSX file under apps/web/src, relative to apps/web; tests excluded."""
    out = subprocess.run(["git", "ls-files", "src"], cwd=WEB, capture_output=True, text=True, check=True)
    return [f for f in out.stdout.split() if f.endswith((".ts", ".tsx")) and not any(s in f for s in SKIP)]


def biome_findings(files: list[str]) -> list[dict]:
    """Run only the two size rules over `files` and return Biome's JSON diagnostics."""
    biome = next((p for p in BIOME_PATHS if os.path.exists(p)), "biome")
    cmd = [biome, "lint", f"--config-path={CONFIG}", "--reporter=json", "--max-diagnostics=none", *files]
    out = subprocess.run(cmd, cwd=WEB, capture_output=True, text=True, check=False)
    if not out.stdout.strip():
        raise SystemExit(f"biome gave no report (exit {out.returncode}): {out.stderr.strip()[:300]}")
    report = json.loads(out.stdout)
    # A suppression for a rule this config leaves off reads as "unused" here: not a measuring failure.
    other = [d for d in report.get("diagnostics", [])
             if d.get("category") not in OUR_RULES and not str(d.get("category", "")).startswith("suppressions/")]
    if other:
        first = other[0]
        raise SystemExit(f"biome could not measure {first.get('location', {}).get('path')}: "
                         f"{first.get('category')} {first.get('message')}")
    return [d for d in report.get("diagnostics", []) if d.get("category") in OUR_RULES]


def over_limits(findings: list[dict]) -> dict[str, dict[str, int]]:
    """Sum, per file, the function lines over 60 and the complexity over 15."""
    totals: dict[str, dict[str, int]] = {}
    for d in findings:
        path = d.get("location", {}).get("path", {})
        path = path.get("file", "") if isinstance(path, dict) else str(path)
        text = str(d.get("description") or d.get("message") or "")
        entry = totals.setdefault(path, {"function_lines": 0, "complexity": 0})
        if m := LINES_RE.search(text):
            entry["function_lines"] += int(m.group(1)) - MAX_FUNCTION_LINES
        elif m := COMPLEXITY_RE.search(text):
            entry["complexity"] += int(m.group(1)) - MAX_COMPLEXITY
    return totals


def measure(files: list[str]) -> dict[str, dict[str, int]]:
    """Today's numbers for `files`, keeping only files that break a rule."""
    totals = over_limits(biome_findings(files)) if files else {}
    result: dict[str, dict[str, int]] = {}
    for f in files:
        with open(os.path.join(WEB, f), encoding="utf-8") as fh:
            lines = sum(1 for _ in fh)
        entry = dict(totals.get(f, {"function_lines": 0, "complexity": 0}))
        entry["file_lines"] = lines if lines > MAX_FILE_LINES else 0
        if any(entry.values()):
            result[f] = entry
    return result


def grown(now: dict[str, dict[str, int]], base: dict[str, dict[str, int]]) -> list[str]:
    """Each number that is above its baseline; a file with no baseline has none allowed."""
    problems = []
    for f, entry in sorted(now.items()):
        allowed = base.get(f, {})
        for key, value in entry.items():
            if value > allowed.get(key, 0):
                problems.append(f"{f}: {key} {value} (allowed {allowed.get(key, 0)})")
    return problems


def tightened(now: dict[str, dict[str, int]], base: dict[str, dict[str, int]]) -> dict[str, dict[str, int]]:
    """The baseline with every number lowered to today's where today's is lower."""
    out = {}
    for f, entry in base.items():
        lower = {k: min(v, now.get(f, {}).get(k, 0)) for k, v in entry.items()}
        if any(lower.values()):
            out[f] = lower
    return out


def write(baseline: dict[str, dict[str, int]]) -> None:
    """Save the baseline, sorted so its diffs stay readable."""
    with open(BASELINE, "w", encoding="utf-8") as fh:
        json.dump(dict(sorted(baseline.items())), fh, indent=1)
        fh.write("\n")


def self_test() -> None:
    """The rules the ratchet must keep, checked without Biome."""
    base = {"a.tsx": {"function_lines": 534, "complexity": 27, "file_lines": 900}}
    split = {"a.tsx": {"function_lines": 480, "complexity": 27, "file_lines": 900}}
    assert grown(split, base) == [], "splitting a long function must pass"
    assert grown({"a.tsx": {"function_lines": 535, "complexity": 27, "file_lines": 900}}, base)
    assert grown({"b.tsx": {"function_lines": 1, "complexity": 0, "file_lines": 0}}, base), "new file, new debt"
    assert grown({"a.tsx": {"function_lines": 0, "complexity": 0, "file_lines": 901}}, base)
    assert tightened(split, base)["a.tsx"]["function_lines"] == 480
    assert tightened({}, base) == {}, "a cleaned file leaves the baseline"
    finding = {"location": {"path": {"file": "a.tsx"}}, "description": "This function has too many lines (90)."}
    assert over_limits([finding]) == {"a.tsx": {"function_lines": 30, "complexity": 0}}
    assert web_relative(os.path.join(WEB, "src", "x.tsx")) == os.path.join("src", "x.tsx")
    assert web_relative(os.path.join(ROOT, "packages", "api", "src", "client.ts")) is None
    assert web_relative(os.path.join(WEB, "src", "a.stories.tsx")) is None
    print("web-size self-test: ok")


def web_relative(arg: str) -> str | None:
    """`arg` as a path relative to apps/web when it is a measured file under src/, else None."""
    real = os.path.realpath(arg)
    rel = os.path.relpath(real, WEB)
    if rel.startswith("src" + os.sep) and rel.endswith((".ts", ".tsx")) and not any(s in rel for s in SKIP):
        return rel
    return None


def renames() -> dict[str, str]:
    """New path → old path for files this branch moved, against its merge base with main."""
    base = subprocess.run(["git", "merge-base", "HEAD", "origin/main"], cwd=WEB, capture_output=True, text=True)
    if base.returncode != 0:
        return {}
    diff = subprocess.run(["git", "diff", "-M", "--relative", "--name-status", base.stdout.strip(), "--", "src"],
                          cwd=WEB, capture_output=True, text=True, check=False)
    moved = {}
    for line in diff.stdout.splitlines():
        parts = line.split("\t")
        if parts[0].startswith("R") and len(parts) == 3:
            moved[parts[2]] = parts[1]
    return moved


def load_baseline(must_exist: bool) -> dict[str, dict[str, int]]:
    """The saved baseline, with each moved file's allowance carried to its new path."""
    if not os.path.exists(BASELINE):
        if must_exist:
            raise SystemExit(f"no baseline at {BASELINE}: the owner creates it with --update")
        return {}
    with open(BASELINE, encoding="utf-8") as fh:
        base = json.load(fh)
    for new, old in renames().items():
        if old in base and new not in base:
            base[new] = base[old]
    return base


def main(argv: list[str]) -> int:
    """Check, tighten or rewrite the baseline, for all web files or the ones given."""
    if "--self-test" in argv:
        self_test()
        return 0
    args = [a for a in argv if not a.startswith("--")]
    if args and ("--update" in argv or "--tighten" in argv):
        raise SystemExit("--update and --tighten work on every file; give no file names")
    files = sorted({f for f in map(web_relative, args) if f}) if args else web_files()
    base = load_baseline(must_exist="--update" not in argv)
    now = measure(files)
    if "--update" in argv:
        write(now)
        print(f"web-size: baseline rewritten, {len(now)} files over a limit")
        return 0
    if "--tighten" in argv:
        write(tightened(now, base))
        print("web-size: baseline tightened")
        return 0
    problems = grown(now, base)
    for p in problems:
        print(f"GREW  {p}: split the function or file; never raise the baseline to pass")
    if problems:
        return 1
    print(f"web-size: {len(files)} files checked, nothing grew")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
