#!/usr/bin/env python3
"""Fix useTranslation inserted inside parameter destructuring.

Pattern to fix:
  function Foo({
    const { t } = useTranslation("ns");  <-- WRONG, inside params
    prop1,

Should become:
  function Foo({
    prop1,
    ...
  }) {
    const { t } = useTranslation("ns");  <-- CORRECT, inside body
"""

import re
from pathlib import Path

FILES = [
    "pages/opd.tsx",
    "pages/lab.tsx",
    "pages/patients.tsx",
    "pages/ipd.tsx",
    "pages/emergency.tsx",
    "pages/billing.tsx",
    "pages/pharmacy.tsx",
]


def fix_file(filepath: str) -> int:
    with open(filepath) as f:
        lines = f.readlines()

    fixes = 0
    i = 0
    while i < len(lines):
        line = lines[i]
        # Check if this is a useTranslation line
        match = re.match(r'^(\s*)const \{ t \} = useTranslation\("(\w+)"\);', line)
        if match:
            indent = match.group(1)
            ns = match.group(2)

            # Check if we're inside function params (look backward for unclosed `({`)
            # If previous non-empty lines are part of destructured params, this is wrong
            prev_idx = i - 1
            while prev_idx >= 0 and lines[prev_idx].strip() == '':
                prev_idx -= 1

            if prev_idx >= 0:
                prev = lines[prev_idx].strip()
                # If prev line ends with `({` or is `function Foo({` or is a param like `prop,`
                is_in_params = (
                    prev.endswith('({') or
                    re.match(r'^(export\s+)?function\s+\w+\(\{', prev) or
                    (prev.endswith(',') and not prev.startswith('const') and not prev.startswith('let'))
                )

                if is_in_params:
                    # Remove this line
                    removed_line = lines.pop(i)

                    # Find the closing `}) {` or `}: TypeAnnotation) {`
                    j = i
                    while j < len(lines):
                        if re.search(r'\)\s*\{', lines[j]) or re.search(r'\}\)\s*\{', lines[j]):
                            # Insert after this line
                            lines.insert(j + 1, f'{indent}const {{ t }} = useTranslation("{ns}");\n')
                            fixes += 1
                            break
                        j += 1
                    continue  # Don't increment i since we removed a line
        i += 1

    if fixes > 0:
        with open(filepath, 'w') as f:
            f.writelines(lines)

    return fixes


def main():
    base = Path(__file__).parent.parent / "apps" / "web" / "src"
    total = 0
    for rel in FILES:
        fp = str(base / rel)
        n = fix_file(fp)
        if n > 0:
            print(f"  Fixed {n} misplaced useTranslation in {rel}")
            total += n
    print(f"\nTotal: {total} syntax fixes")


if __name__ == "__main__":
    main()
