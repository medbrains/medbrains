#!/usr/bin/env python3
"""Revert t() calls in module-level constants back to hardcoded strings.

t() can only be called inside React components (hooks rule).
This script finds t("key") in const/let/var declarations at module level
and reverts them to the English string from locale files.
"""

import json
import os
import re
from pathlib import Path

PAGES = {
    "pages/billing.tsx": "billing",
    "pages/emergency.tsx": "emergency",
    "pages/ipd.tsx": "ipd",
    "pages/lab.tsx": "lab",
    "pages/opd.tsx": "opd",
    "pages/patients.tsx": "patients",
    "pages/pharmacy.tsx": "pharmacy",
    "pages/dashboard.tsx": "dashboard",
}


def flatten_keys(d, prefix=""):
    result = {}
    for k, v in d.items():
        key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            result.update(flatten_keys(v, key))
        else:
            result[key] = v
    return result


def fix_file(filepath: str, namespace: str, locales_dir: str) -> int:
    locale_path = os.path.join(locales_dir, "en", f"{namespace}.json")
    if not os.path.exists(locale_path):
        return 0

    with open(locale_path) as f:
        locale = json.load(f)
    flat = flatten_keys(locale)

    with open(filepath) as f:
        content = f.read()
    original = content

    # Find all t("key") calls and check if they're inside a function body
    lines = content.split("\n")
    in_function = False
    brace_depth = 0
    function_starts = set()

    # Track which lines are inside function bodies
    inside_function = [False] * len(lines)
    for i, line in enumerate(lines):
        stripped = line.strip()
        if re.match(r"^(export\s+)?function\s+\w+", stripped):
            in_function = True
        if in_function:
            brace_depth += line.count("{") - line.count("}")
            inside_function[i] = True
            if brace_depth <= 0:
                in_function = False
                brace_depth = 0

    # Revert t() calls on lines NOT inside functions
    fixes = 0
    new_lines = []
    for i, line in enumerate(lines):
        if not inside_function[i]:
            # Revert t("key") back to "english"
            def revert_match(m):
                nonlocal fixes
                key = m.group(1)
                english = flat.get(key, key)
                fixes += 1
                return f'"{english}"'

            line = re.sub(r'\{t\("([^"]+)"\)\}', revert_match, line)
            line = re.sub(r't\("([^"]+)"\)', revert_match, line)
        new_lines.append(line)

    content = "\n".join(new_lines)

    # Also remove unused t declarations (TS6133)
    # Find functions where t is declared but never used in the body
    # This is complex — skip for now, let TypeScript handle it

    if content != original:
        with open(filepath, "w") as f:
            f.write(content)

    return fixes


def main():
    base = Path(__file__).parent.parent / "apps" / "web"
    src = base / "src"
    locales = str(base / "public" / "locales")

    total = 0
    for rel, ns in PAGES.items():
        filepath = str(src / rel)
        if not os.path.exists(filepath):
            continue
        n = fix_file(filepath, ns, locales)
        if n > 0:
            print(f"  Reverted {n} module-level t() calls in {rel}")
            total += n
    print(f"\nTotal: {total} reverted")


if __name__ == "__main__":
    main()
