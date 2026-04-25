#!/usr/bin/env python3
"""Extract hardcoded strings from TSX pages and generate i18n locale files.

Scans a TSX file for common patterns of hardcoded English strings:
- label="..."
- placeholder="..."
- title="..."
- description="..."
- subtitle="..."
- >Text Content<
- Button/Badge/Text children

Generates a JSON locale file with extracted keys and patches the TSX
to use useTranslation + t() calls.

Usage:
    python3 scripts/i18n_extract.py <page.tsx> <namespace>
    python3 scripts/i18n_extract.py apps/web/src/pages/dashboard.tsx dashboard
    python3 scripts/i18n_extract.py --all   # Process top 10 pages
"""

import re
import json
import sys
import os
from pathlib import Path
from collections import OrderedDict


def slugify(text: str) -> str:
    """Convert text to a translation key."""
    # Remove special chars, lowercase, replace spaces with camelCase
    text = text.strip().strip('"').strip("'")
    if not text or len(text) > 80:
        return ""
    # Simple camelCase conversion
    words = re.split(r"[\s\-_/]+", text.lower())
    words = [w for w in words if w]
    if not words:
        return ""
    result = words[0]
    for w in words[1:]:
        result += w.capitalize()
    return result


def is_translatable(text: str) -> bool:
    """Check if a string should be translated."""
    text = text.strip()
    if not text:
        return False
    if len(text) < 2:
        return False
    # Skip purely numeric, URLs, code patterns
    if re.match(r"^[\d\.\-\+\%\$\#]+$", text):
        return False
    if text.startswith("http") or text.startswith("/api/") or text.startswith("/"):
        return False
    if text.startswith("Icon") or text.startswith("icon"):
        return False
    if text.startswith("{") or text.startswith("$"):
        return False
    # Skip CSS values
    if re.match(r"^(xs|sm|md|lg|xl|xxl|auto|none|flex|block|grid)$", text):
        return False
    # Skip color names
    if re.match(r"^(primary|danger|warning|success|info|gray|teal|violet|blue|green|red|orange|cyan|indigo)(\.\d)?$", text):
        return False
    # Skip format strings and variables
    if "${" in text or "{{" in text:
        return False
    # Must have at least one letter
    if not re.search(r"[a-zA-Z]", text):
        return False
    return True


def extract_from_tsx(filepath: str) -> OrderedDict:
    """Extract translatable strings from a TSX file."""
    with open(filepath) as f:
        content = f.read()

    strings = OrderedDict()

    # Pattern 1: prop="string" for common translatable props
    prop_pattern = re.compile(
        r'\b(label|placeholder|title|subtitle|description|message|header)'
        r'="([^"]+)"'
    )
    for match in prop_pattern.finditer(content):
        prop_name = match.group(1)
        text = match.group(2)
        if is_translatable(text):
            key = f"{prop_name}.{slugify(text)}"
            if key and key not in strings:
                strings[key] = text

    # Pattern 2: Static JSX text in specific components
    # >Some Text</Button>, >Some Text</Text>, etc.
    jsx_text_pattern = re.compile(
        r">([A-Z][^<{}\n]+?)</(Button|Text|Title|Badge|Tab|Tabs\.Tab|Drawer|Modal)"
    )
    for match in jsx_text_pattern.finditer(content):
        text = match.group(1).strip()
        if is_translatable(text) and len(text) > 2:
            key = slugify(text)
            if key and key not in strings:
                strings[key] = text

    # Pattern 3: notifications.show({ title: "...", message: "..." })
    notif_pattern = re.compile(
        r'notifications\.show\(\{[^}]*?'
        r'(title|message):\s*"([^"]+)"'
    )
    for match in notif_pattern.finditer(content):
        prop = match.group(1)
        text = match.group(2)
        if is_translatable(text):
            key = f"notify.{slugify(text)}"
            if key and key not in strings:
                strings[key] = text

    # Pattern 4: aria-label="..."
    aria_pattern = re.compile(r'aria-label="([^"]+)"')
    for match in aria_pattern.finditer(content):
        text = match.group(1)
        if is_translatable(text):
            key = f"aria.{slugify(text)}"
            if key and key not in strings:
                strings[key] = text

    return strings


def generate_locale_file(strings: OrderedDict, output_path: str):
    """Write extracted strings to a locale JSON file."""
    # Merge with existing if file exists
    existing = {}
    if os.path.exists(output_path):
        with open(output_path) as f:
            try:
                existing = json.load(f)
            except json.JSONDecodeError:
                pass

    merged = {**existing, **strings}

    with open(output_path, "w") as f:
        json.dump(merged, f, indent=2, ensure_ascii=False)
        f.write("\n")


def process_page(page_path: str, namespace: str, locales_dir: str):
    """Extract strings from a page and generate locale file."""
    strings = extract_from_tsx(page_path)

    if not strings:
        print(f"  No translatable strings found in {page_path}")
        return 0

    output_path = os.path.join(locales_dir, "en", f"{namespace}.json")
    generate_locale_file(strings, output_path)

    # Also create empty Tamil locale
    ta_dir = os.path.join(locales_dir, "ta")
    os.makedirs(ta_dir, exist_ok=True)
    ta_path = os.path.join(ta_dir, f"{namespace}.json")
    if not os.path.exists(ta_path):
        with open(ta_path, "w") as f:
            json.dump({}, f, indent=2)
            f.write("\n")

    # Create empty Hindi locale
    hi_dir = os.path.join(locales_dir, "hi")
    os.makedirs(hi_dir, exist_ok=True)
    hi_path = os.path.join(hi_dir, f"{namespace}.json")
    if not os.path.exists(hi_path):
        with open(hi_path, "w") as f:
            json.dump({}, f, indent=2)
            f.write("\n")

    # Create empty Arabic locale (RTL)
    ar_dir = os.path.join(locales_dir, "ar")
    os.makedirs(ar_dir, exist_ok=True)
    ar_path = os.path.join(ar_dir, f"{namespace}.json")
    if not os.path.exists(ar_path):
        with open(ar_path, "w") as f:
            json.dump({}, f, indent=2)
            f.write("\n")

    return len(strings)


# Top 10 pages mapping
TOP_PAGES = {
    "dashboard": "pages/dashboard.tsx",
    "patients": "pages/patients.tsx",
    "opd": "pages/opd.tsx",
    "lab": "pages/lab.tsx",
    "pharmacy": "pages/pharmacy.tsx",
    "billing": "pages/billing.tsx",
    "ipd": "pages/ipd.tsx",
    "emergency": "pages/emergency.tsx",
    "admin": "pages/admin/settings.tsx",
}


def main():
    base = Path(__file__).parent.parent / "apps" / "web"
    src = base / "src"
    locales = base / "public" / "locales"

    if "--all" in sys.argv:
        total = 0
        for ns, rel_path in TOP_PAGES.items():
            page = src / rel_path
            if not page.exists():
                print(f"  SKIP: {rel_path} not found")
                continue
            count = process_page(str(page), ns, str(locales))
            print(f"  {count:4d} keys extracted from {rel_path} -> {ns}.json")
            total += count
        print(f"\nTotal: {total} keys across {len(TOP_PAGES)} pages")

        # Also generate common aria labels and actions
        common_additions = {
            "aria.edit": "Edit",
            "aria.delete": "Delete",
            "aria.viewDetails": "View details",
            "aria.close": "Close",
            "aria.search": "Search",
            "aria.refresh": "Refresh",
            "aria.add": "Add",
            "aria.confirm": "Confirm",
            "aria.download": "Download",
            "aria.print": "Print",
            "aria.copy": "Copy",
            "aria.moreActions": "More actions",
            "aria.settings": "Settings",
            "aria.filter": "Filter",
            "aria.expand": "Expand",
            "aria.collapse": "Collapse",
        }
        common_path = str(locales / "en" / "common.json")
        generate_locale_file(common_additions, common_path)
        print(f"  Added {len(common_additions)} aria keys to common.json")

        # Create Tamil/Hindi/Arabic skeletons for common
        for lang in ["ta", "hi", "ar"]:
            lang_dir = locales / lang
            lang_dir.mkdir(exist_ok=True)
            for ns_file in (locales / "en").glob("*.json"):
                target = lang_dir / ns_file.name
                if not target.exists():
                    target.write_text("{}\n")
                    print(f"  Created {lang}/{ns_file.name} skeleton")

    elif len(sys.argv) >= 3:
        page_path = sys.argv[1]
        namespace = sys.argv[2]
        count = process_page(page_path, namespace, str(locales))
        print(f"Extracted {count} keys from {page_path} -> {namespace}.json")
    else:
        print("Usage:")
        print("  python3 scripts/i18n_extract.py <page.tsx> <namespace>")
        print("  python3 scripts/i18n_extract.py --all")


if __name__ == "__main__":
    main()
