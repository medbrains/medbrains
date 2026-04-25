#!/usr/bin/env python3
"""Fix sub-components that use t() but don't have useTranslation.

For each function component in the file that uses t() but doesn't
declare const { t } = useTranslation(...), add the declaration.
"""

import re
import sys
from pathlib import Path

PAGES = {
    "pages/billing.tsx": "billing",
    "pages/emergency.tsx": "emergency",
    "pages/ipd.tsx": "ipd",
    "pages/lab.tsx": "lab",
    "pages/opd.tsx": "opd",
    "pages/patients.tsx": "patients",
    "pages/pharmacy.tsx": "pharmacy",
}


def fix_file(filepath: str, namespace: str) -> int:
    with open(filepath) as f:
        content = f.read()

    # Find all function components
    # Pattern: function ComponentName( ... ) {
    func_pattern = re.compile(
        r"^((?:export\s+)?function\s+\w+\s*\([^)]*\)\s*(?::\s*[^{]+)?\{)",
        re.MULTILINE,
    )

    matches = list(func_pattern.finditer(content))
    if not matches:
        return 0

    fixes = 0
    # Process from bottom to top to maintain positions
    for match in reversed(matches):
        func_start = match.start()
        func_sig_end = match.end()

        # Find the end of this function (matching brace)
        brace_count = 1
        pos = func_sig_end
        while pos < len(content) and brace_count > 0:
            if content[pos] == "{":
                brace_count += 1
            elif content[pos] == "}":
                brace_count -= 1
            pos += 1
        func_body = content[func_sig_end:pos]

        # Check if this function uses t() but doesn't declare it
        uses_t = bool(re.search(r'\bt\(', func_body))
        has_t_decl = bool(re.search(r'const\s*\{\s*t\s*\}\s*=\s*useTranslation', func_body))

        if uses_t and not has_t_decl:
            # Insert useTranslation declaration after opening brace
            insert = f'\n  const {{ t }} = useTranslation("{namespace}");'
            content = content[:func_sig_end] + insert + content[func_sig_end:]
            fixes += 1

    if fixes > 0:
        with open(filepath, "w") as f:
            f.write(content)

    return fixes


def main():
    base = Path(__file__).parent.parent / "apps" / "web" / "src"
    total = 0
    for rel, ns in PAGES.items():
        filepath = str(base / rel)
        n = fix_file(filepath, ns)
        if n > 0:
            print(f"  Fixed {n} sub-components in {rel}")
            total += n
    print(f"\nTotal: {total} sub-components fixed")


if __name__ == "__main__":
    main()
