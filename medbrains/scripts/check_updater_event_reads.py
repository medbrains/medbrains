#!/usr/bin/env python3
"""Fail when a React state updater reads the event's currentTarget.

    onChange={(e) => setForm((p) => ({ ...p, name: e.currentTarget.value }))}

React clears `currentTarget` once the handler returns, and the updater runs
later, during render — so this throws "Cannot read properties of null" and the
whole screen falls to its error boundary. On 2026-10-16 fifty of these were in
the web app, including the bedside risk calculators. Read the value first:

    onChange={(e) => { const next = e.currentTarget.value; setForm((p) => ({ ...p, name: next })); }}
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent / "apps" / "web" / "src"
UPDATER = re.compile(r"set\w+\(\s*\(\s*\w+\s*\)\s*=>")


def updater_bodies(source: str):
    for m in UPDATER.finditer(source):
        open_at = m.start() + source[m.start():].index("(")
        depth, end = 0, open_at
        while end < len(source):
            if source[end] == "(":
                depth += 1
            elif source[end] == ")":
                depth -= 1
                if depth == 0:
                    break
            end += 1
        yield m.start(), source[open_at:end]


def main() -> int:
    hits = []
    for path in sorted(ROOT.rglob("*.tsx")):
        source = path.read_text(encoding="utf-8")
        for start, body in updater_bodies(source):
            if re.search(r"\b\w+\.currentTarget\b", body):
                line = source.count("\n", 0, start) + 1
                hits.append(f"{path.relative_to(ROOT.parent.parent.parent)}:{line}")
    if hits:
        print("A state updater reads the event's currentTarget (null by then):")
        for h in hits:
            print(f"  {h}")
        print("Read the value into a local before calling the setter.")
        return 1
    print("✓ No state updater reads an event's currentTarget.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
