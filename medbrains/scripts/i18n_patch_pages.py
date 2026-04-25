#!/usr/bin/env python3
"""Patch TSX pages to use useTranslation and t() calls.

For each page that has a locale JSON file, this script:
1. Adds useTranslation import if missing
2. Adds const { t } = useTranslation("ns") if missing
3. Replaces label="Text" with label={t("key")} for known keys
4. Replaces placeholder="Text" with placeholder={t("key")}
5. Replaces title="Text" with title={t("key")}
6. Replaces aria-label="Text" with aria-label={t("common:aria.key")}

Usage:
    python3 scripts/i18n_patch_pages.py
"""

import json
import os
import re
from pathlib import Path


# Page → namespace mapping
PAGES = {
    "pages/dashboard.tsx": "dashboard",
    "pages/patients.tsx": "patients",
    "pages/opd.tsx": "opd",
    "pages/lab.tsx": "lab",
    "pages/pharmacy.tsx": "pharmacy",
    "pages/billing.tsx": "billing",
    "pages/ipd.tsx": "ipd",
    "pages/emergency.tsx": "emergency",
}

# Common aria-label → common namespace key
ARIA_KEYS = {
    "Edit": "common:aria.edit",
    "Delete": "common:aria.delete",
    "View details": "common:aria.viewDetails",
    "Close": "common:aria.close",
    "Search": "common:aria.search",
    "Refresh": "common:aria.refresh",
    "Add": "common:aria.add",
    "Confirm": "common:aria.confirm",
    "Download": "common:aria.download",
    "Print": "common:aria.print",
    "Copy": "common:aria.copy",
    "More actions": "common:aria.moreActions",
    "Settings": "common:aria.settings",
    "Filter": "common:aria.filter",
    "Expand": "common:aria.expand",
    "Collapse": "common:aria.collapse",
}


def load_locale(locales_dir: str, namespace: str) -> dict:
    path = os.path.join(locales_dir, "en", f"{namespace}.json")
    if not os.path.exists(path):
        return {}
    with open(path) as f:
        return json.load(f)


def flatten_keys(d: dict, prefix: str = "") -> dict:
    """Flatten nested dict to dot-separated keys."""
    result = {}
    for k, v in d.items():
        key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            result.update(flatten_keys(v, key))
        else:
            result[key] = v
    return result


def build_reverse_map(flat: dict) -> dict:
    """Map English text → i18n key."""
    return {v: k for k, v in flat.items() if isinstance(v, str)}


def add_import(content: str) -> str:
    """Add useTranslation import if not present."""
    if "useTranslation" in content:
        return content

    # Find last import line
    lines = content.split("\n")
    last_import_idx = 0
    for i, line in enumerate(lines):
        if line.strip().startswith("import "):
            last_import_idx = i

    lines.insert(last_import_idx + 1, 'import { useTranslation } from "react-i18next";')
    return "\n".join(lines)


def add_hook(content: str, namespace: str) -> str:
    """Add useTranslation hook call if not present."""
    if f'useTranslation("{namespace}")' in content:
        return content

    # Find the main export function and add after the first line with useRequirePermission or useState
    pattern = re.compile(
        r"(export function \w+\([^)]*\)\s*\{[\s\S]*?"
        r"(?:useRequirePermission|useState|useNavigate|useHasPermission)\([^)]*\);)"
    )
    match = pattern.search(content)
    if match:
        insert_pos = match.end()
        content = (
            content[:insert_pos]
            + f'\n  const {{ t }} = useTranslation("{namespace}");'
            + content[insert_pos:]
        )
    return content


def patch_props(content: str, reverse_map: dict, namespace: str) -> tuple:
    """Replace prop="English" with prop={t("key")} for known strings."""
    count = 0

    for prop in ["label", "placeholder", "title", "subtitle", "description", "message"]:
        for english, key in reverse_map.items():
            # Skip very short strings that might cause false positives
            if len(english) < 3:
                continue

            old = f'{prop}="{english}"'
            if old in content:
                new = f'{prop}={{t("{key}")}}'
                content = content.replace(old, new)
                count += 1

    return content, count


def patch_aria_labels(content: str) -> tuple:
    """Replace aria-label="English" with aria-label={t("common:aria.key")}."""
    count = 0
    for english, key in ARIA_KEYS.items():
        old = f'aria-label="{english}"'
        if old in content:
            new = f'aria-label={{t("{key}")}}'
            content = content.replace(old, new)
            count += 1
    return content, count


def patch_jsx_children(content: str, reverse_map: dict) -> tuple:
    """Replace >English Text< with >{t("key")}< for specific patterns."""
    count = 0

    for english, key in reverse_map.items():
        if len(english) < 4:
            continue

        # Only replace in specific component children
        for tag in ["Button", "Text", "Title"]:
            old = f">{english}</{tag}>"
            if old in content:
                new = f">{{t(\"{key}\")}}</{tag}>"
                content = content.replace(old, new, 1)
                count += 1

    return content, count


def process_page(src_dir: str, locales_dir: str, rel_path: str, namespace: str) -> int:
    filepath = os.path.join(src_dir, rel_path)
    if not os.path.exists(filepath):
        print(f"  SKIP: {rel_path} not found")
        return 0

    locale = load_locale(locales_dir, namespace)
    if not locale:
        print(f"  SKIP: {namespace}.json empty")
        return 0

    flat = flatten_keys(locale)
    reverse_map = build_reverse_map(flat)

    with open(filepath) as f:
        content = f.read()

    original = content
    total = 0

    # Step 1: Add import
    content = add_import(content)

    # Step 2: Add hook
    content = add_hook(content, namespace)

    # Step 3: Patch props
    content, n = patch_props(content, reverse_map, namespace)
    total += n

    # Step 4: Patch aria-labels
    content, n = patch_aria_labels(content)
    total += n

    # Step 5: Patch JSX children (conservative)
    content, n = patch_jsx_children(content, reverse_map)
    total += n

    if content != original:
        with open(filepath, "w") as f:
            f.write(content)

    return total


def main():
    base = Path(__file__).parent.parent / "apps" / "web"
    src = str(base / "src")
    locales = str(base / "public" / "locales")

    total = 0
    for rel_path, namespace in PAGES.items():
        count = process_page(src, locales, rel_path, namespace)
        print(f"  {count:4d} replacements in {rel_path}")
        total += count

    print(f"\nTotal: {total} string replacements across {len(PAGES)} pages")


if __name__ == "__main__":
    main()
