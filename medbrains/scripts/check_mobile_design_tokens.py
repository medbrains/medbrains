#!/usr/bin/env python3
"""Design-system rules for the device surfaces, enforced.

Two things kept going wrong by hand, and both are cheap to catch.

**Raw hex.** `docs/DEVICE-SURFACE-DESIGN-RULES.md` says Carbon is the brand and
colour comes from tokens, never a literal. `packages/ui-mobile` had 24 of them
across three components — several were Carbon steps typed out by hand
(`#EFEEFF` is violet[0] exactly) which had then drifted. A ward board and a
desktop screen are only the same colour if they read the same value.

**Colours as React keys.** Two palette tokens can resolve to the same hex —
`navActiveBg`, `tint` and `navChildActiveBg` are all blue[0] — so a gradient
keyed by colour hands React two children with the same key. That shipped in
`Card` for months, and the fix reintroduced it in `AppBarGradient` within the
hour, which is exactly why it needs a check rather than care.

Run: `make check-mobile-tokens`
"""

from __future__ import annotations

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# The token core is where literals are allowed — it is the boundary with Carbon.
ALLOWED_LITERAL_FILES = {"packages/ui-mobile/src/tokens.ts"}

SCANNED = ["packages/ui-mobile/src", "packages/mobile-shell/src"]

HEX = re.compile(r"#[0-9A-Fa-f]{6}\b")
# `key={color}` / `key={stop}` — a key bound to something colour-shaped.
COLOUR_KEY = re.compile(r"key=\{\s*(color|colour|stop|hex|shade|tone)\s*\}")


def source_files() -> list[str]:
    found: list[str] = []
    for base in SCANNED:
        root = os.path.join(ROOT, base)
        if not os.path.isdir(root):
            continue
        for dirpath, _dirs, files in os.walk(root):
            for name in files:
                if name.endswith((".ts", ".tsx")) and not name.endswith(".test.ts"):
                    found.append(os.path.join(dirpath, name))
    return sorted(found)


def strip_comments(text: str) -> str:
    """A hex named in prose is documentation, not a colour the app renders."""
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    return re.sub(r"//[^\n]*", "", text)


def main() -> int:
    literal_hits: list[str] = []
    key_hits: list[str] = []

    for path in source_files():
        rel = os.path.relpath(path, ROOT)
        body = strip_comments(open(path, encoding="utf-8").read())

        if rel not in ALLOWED_LITERAL_FILES:
            for match in HEX.finditer(body):
                line = body[: match.start()].count("\n") + 1
                literal_hits.append(f"{rel}:{line}  {match.group(0)}")

        for match in COLOUR_KEY.finditer(body):
            line = body[: match.start()].count("\n") + 1
            key_hits.append(f"{rel}:{line}  {match.group(0)}")

    if literal_hits:
        print("=== raw colour literals — use a Carbon token ===")
        for hit in literal_hits:
            print(f"  {hit}")
        print(
            "\n  Colour comes from `@medbrains/design-system/tokens` or "
            "`ui-mobile`'s COLORS.\n"
        )

    if key_hits:
        print("=== React keys bound to a colour ===")
        for hit in key_hits:
            print(f"  {hit}")
        print(
            "\n  Two tokens can be the same hex, which makes two children share "
            "a key.\n  A gradient stop's identity is its position: "
            "key={`${index}-${color}`}.\n"
        )

    if literal_hits or key_hits:
        print(f"FAILED — {len(literal_hits)} literal(s), {len(key_hits)} colour key(s)")
        return 1

    print("device UI colours come from tokens, and no key is a colour")
    return 0


if __name__ == "__main__":
    sys.exit(main())
