#!/usr/bin/env python3
"""Raw interactive-HTML guard — keep the app off hand-rolled form controls.

Raw `<button>`, `<input>`, `<select>`, and `<textarea>` bypass the design
system and, more importantly, the accessibility guarantees baked into the
`@/components/ui` seam (e.g. IconButton *requires* an aria-label, inputs wire
label/error/aria via Mantine). Use the seam primitives — Button / IconButton /
Input / Select / SegmentedControl — or a Mantine component, never a raw tag.

Allowed exceptions:
  - `<input type="hidden">`            (React Hook Form Controller field)
  - lines carrying a `biome-ignore`    (already reviewed + justified)
  - the input styling showcase page    (intentional raw-element demo)
  - *.stories.tsx / *.test.tsx         (not shipped UI)

  python3 scripts/check_raw_html.py    # wired into `make check-raw-html`
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "apps" / "web" / "src"

# Files allowed to contain raw interactive elements (relative to SRC).
ALLOWLIST = {
    "pages/components-inputs.tsx",  # deliberate raw-input styling showcase
}

# Raw opening tags that should never appear in shipped JSX.
TAG_RE = re.compile(r"<(button|select|textarea)(\s|>|/)")
INPUT_RE = re.compile(r"<input(\s|>|/)")


def is_violation(line: str) -> bool:
    if "biome-ignore" in line:
        return False
    if TAG_RE.search(line):
        return True
    if INPUT_RE.search(line) and 'type="hidden"' not in line:
        return True
    return False


def main() -> int:
    violations: list[str] = []
    for path in sorted(SRC.rglob("*.tsx")):
        name = path.name
        if name.endswith((".stories.tsx", ".test.tsx")):
            continue
        rel = path.relative_to(SRC).as_posix()
        if rel in ALLOWLIST:
            continue
        for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if is_violation(line):
                violations.append(f"  {rel}:{lineno}: {line.strip()[:90]}")

    if violations:
        print("Raw interactive HTML — use the @/components/ui seam (or a Mantine component):\n")
        print("\n".join(violations))
        print(
            "\nButton/IconButton/Input/Select/SegmentedControl replace raw "
            "<button>/<input>/<select>/<textarea>. Icon-only buttons need an aria-label "
            "(IconButton enforces it). If a raw tag is genuinely required, add a justified "
            "`biome-ignore` on the line."
        )
        return 1

    print("check-raw-html: OK. No raw interactive HTML in shipped JSX.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
