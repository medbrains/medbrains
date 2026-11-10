#!/usr/bin/env python3
"""Kanidm's pages in the MedBrains colours: prints the design system's `--mb-*` tokens as CSS for Kanidm's light
and dark themes, read from the generated colour file, so the stylesheet never holds a colour of its own.

  os/kanidm-tokens.py            the CSS, for build.sh to put ahead of kanidm-override.css
  os/kanidm-tokens.py --check    fails unless every pair the stylesheet uses meets WCAG 2.2 AA, in both themes
"""
import re
import sys
from pathlib import Path

COLOURS = Path(__file__).resolve().parent.parent / "packages/design-system/src/theme/colors.generated.ts"
# Kanidm's own script sets data-bs-theme from the browser's colour scheme.
SELECTORS = {"light": ':root, [data-bs-theme="light"]', "dark": '[data-bs-theme="dark"]'}
# Each pair kanidm-override.css draws, with the contrast it needs: 4.5 for text, 3 for edges and large text.
PAIRS = [
    ("on-surface", "surface", 4.5), ("on-surface", "surface-container-lowest", 4.5),
    ("on-surface", "surface-container-low", 4.5), ("on-surface", "surface-container", 4.5),
    ("on-surface", "surface-container-high", 4.5), ("on-success-container", "success-container", 4.5),
    ("on-warning-container", "warning-container", 4.5),
    ("on-surface-variant", "surface", 4.5), ("on-surface-variant", "surface-container", 4.5),
    ("primary-text", "surface", 4.5), ("primary-text", "surface-container-low", 4.5),
    ("on-primary", "primary", 4.5), ("on-error", "error", 4.5), ("error", "surface", 4.5),
    ("error", "surface-container-lowest", 4.5), ("on-primary-container", "primary-container", 4.5),
    ("on-error-container", "error-container", 4.5), ("on-success", "success", 4.5),
    ("on-warning", "warning", 4.5), ("outline", "surface-container", 3), ("primary-text", "surface-container", 3),
]


def tokens():
    """The light and dark `--mb-*` values, by scheme."""
    text = COLOURS.read_text()
    block = text[text.index("export const roleCssVars"):]
    found = {}
    for scheme in ("light", "dark"):
        body = re.search(scheme + r": \{(.*?)\n  \}", block, re.S).group(1)
        found[scheme] = dict(re.findall(r'"(--mb-[a-z0-9-]+)": "(#[0-9a-fA-F]{6,8})"', body))
    return found


def luminance(colour):
    """WCAG relative luminance of a #rrggbb colour."""
    channels = [int(colour[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    linear = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in channels]
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]


def contrast(a, b):
    """WCAG contrast ratio of two colours."""
    high, low = sorted((luminance(a), luminance(b)), reverse=True)
    return (high + 0.05) / (low + 0.05)


def check(found):
    """Prints each pair's ratio; returns the pairs that fall short."""
    short = []
    for scheme, values in found.items():
        for fore, back, need in PAIRS:
            ratio = contrast(values[f"--mb-{fore}"], values[f"--mb-{back}"])
            print(f"{scheme:5} {fore:22} on {back:26} {ratio:5.2f} (needs {need})")
            if ratio < need:
                short.append((scheme, fore, back, round(ratio, 2)))
    return short


def main():
    """CSS by default; the contrast check with --check."""
    found = tokens()
    if sys.argv[1:] == ["--check"]:
        short = check(found)
        print("FAILED: " + str(short) if short else "every pair meets WCAG 2.2 AA")
        return 1 if short else 0
    print(f"/* Generated from {COLOURS.name} by os/kanidm-tokens.py. Do not edit. */")
    for scheme, values in found.items():
        print(SELECTORS[scheme] + " {")
        print("".join(f"    {name}: {value};\n" for name, value in values.items()), end="")
        print("}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
