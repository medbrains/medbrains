#!/usr/bin/env python3
"""
UI ↔ API Coverage Checker — verifies every page uses valid API methods
and finds unused API methods.

Statically parses:
  - apps/web/src/pages/**/*.tsx  → api.methodName references
  - packages/api/src/client.ts   → exported API method definitions

No running server required.

Usage:
    python3 scripts/check_ui_api_coverage.py
    # or from medbrains/ or root:
    make check-ui-api

Exit codes:
    0  No missing references (pages only call methods that exist)
    1  Missing references found (page calls api.X but X doesn't exist)
"""

import re
import sys
from pathlib import Path

# ── Paths ────────────────────────────────────────────────────────────

REPO_ROOT = Path(__file__).resolve().parent.parent
PAGES_DIR = REPO_ROOT / "medbrains" / "apps" / "web" / "src" / "pages"
CLIENT_TS = REPO_ROOT / "medbrains" / "packages" / "api" / "src" / "client.ts"

# Also scan components that may call api methods
COMPONENTS_DIR = REPO_ROOT / "medbrains" / "apps" / "web" / "src" / "components"

# ── API method extraction from client.ts ─────────────────────────────

# Match method definitions inside the `export const api = { ... }` block.
# Pattern: methodName: (args) => request<...>(
RE_API_METHOD = re.compile(r"^\s+(\w+)\s*:\s*\(", re.MULTILINE)


def extract_api_methods() -> dict[str, int]:
    """
    Extract all method names from client.ts with their line numbers.
    Returns {method_name: line_number}.
    """
    source = CLIENT_TS.read_text()
    lines = source.split("\n")
    methods: dict[str, int] = {}

    # Find the start of `export const api = {`
    api_start = None
    for i, line in enumerate(lines):
        if re.search(r"export\s+const\s+api\s*=\s*\{", line):
            api_start = i
            break

    if api_start is None:
        print("WARNING: Could not find 'export const api = {' in client.ts")
        return methods

    # Track brace depth to find the end of the api object
    depth = 0
    in_api = False
    for i in range(api_start, len(lines)):
        line = lines[i]

        for ch in line:
            if ch == "{":
                depth += 1
                in_api = True
            elif ch == "}":
                depth -= 1
                if in_api and depth == 0:
                    # End of api object
                    return methods

        if not in_api:
            continue

        # Only match at depth 1 (top-level methods in the api object)
        # This is approximate — we check that the line starts with
        # whitespace + identifier + colon
        # Pattern handles both: `methodName: (args)` and `methodName: async (args)`
        m = re.match(r"^\s{2,6}(\w+)\s*:\s*(?:async\s*)?\(", line)
        if m:
            name = m.group(1)
            methods[name] = i + 1  # 1-based line number

    return methods


# ── Page scanning for api.method references ──────────────────────────

# Match api.methodName( or api.methodName, or api.methodName;
# Also match destructured: const { method1, method2 } = api;
# But the main pattern is direct usage: api.methodName
RE_API_CALL = re.compile(r"\bapi\.(\w+)")


def scan_file_for_api_refs(file_path: Path) -> list[tuple[str, int]]:
    """
    Scan a .tsx/.ts file for api.methodName references.
    Returns [(method_name, line_number), ...].
    """
    refs: list[tuple[str, int]] = []
    try:
        source = file_path.read_text()
    except (OSError, UnicodeDecodeError):
        return refs

    for i, line in enumerate(source.split("\n"), 1):
        # Skip comments
        stripped = line.strip()
        if stripped.startswith("//") or stripped.startswith("*"):
            continue
        for m in RE_API_CALL.finditer(line):
            method_name = m.group(1)
            refs.append((method_name, i))

    return refs


def scan_pages() -> dict[str, list[tuple[str, int]]]:
    """
    Scan all page files for API method references.
    Returns {relative_path: [(method_name, line_number), ...]}.
    """
    results: dict[str, list[tuple[str, int]]] = {}

    for tsx_file in sorted(PAGES_DIR.rglob("*.tsx")):
        refs = scan_file_for_api_refs(tsx_file)
        if refs:
            rel_path = str(tsx_file.relative_to(PAGES_DIR))
            results[rel_path] = refs

    # Also scan components directory
    if COMPONENTS_DIR.exists():
        for tsx_file in sorted(COMPONENTS_DIR.rglob("*.tsx")):
            refs = scan_file_for_api_refs(tsx_file)
            if refs:
                rel_path = "components/" + str(
                    tsx_file.relative_to(COMPONENTS_DIR)
                )
                results[rel_path] = refs

    return results


# ── Main ─────────────────────────────────────────────────────────────


def main():
    if not CLIENT_TS.exists():
        print(f"ERROR: Frontend API file not found: {CLIENT_TS}")
        sys.exit(2)
    if not PAGES_DIR.exists():
        print(f"ERROR: Pages directory not found: {PAGES_DIR}")
        sys.exit(2)

    # Extract data
    api_methods = extract_api_methods()
    page_refs = scan_pages()

    # Build coverage data
    all_referenced: set[str] = set()
    missing_refs: list[tuple[str, int, str]] = []  # (page, line, method)
    page_method_map: dict[str, set[str]] = {}

    for page, refs in page_refs.items():
        methods_in_page: set[str] = set()
        for method_name, line_no in refs:
            methods_in_page.add(method_name)
            all_referenced.add(method_name)
            if method_name not in api_methods:
                missing_refs.append((page, line_no, method_name))
        page_method_map[page] = methods_in_page

    unused_methods = {
        name: line
        for name, line in api_methods.items()
        if name not in all_referenced
    }

    used_count = len(all_referenced & set(api_methods.keys()))

    # ── Output ───────────────────────────────────────────────────

    print("=== UI ↔ API Coverage ===")
    print(f"Pages scanned:  {len(page_refs):,}")
    print(f"API methods:    {len(api_methods):,}")
    print()

    # Coverage by page (sorted by method count, descending)
    print("Coverage by page (top 30):")
    sorted_pages = sorted(
        page_method_map.items(), key=lambda x: len(x[1]), reverse=True
    )
    for page, methods in sorted_pages[:30]:
        method_list = ", ".join(sorted(methods)[:5])
        suffix = ", ..." if len(methods) > 5 else ""
        print(f"  {page:<50} → {len(methods):>3} methods ({method_list}{suffix})")

    if len(sorted_pages) > 30:
        remaining = len(sorted_pages) - 30
        print(f"  ... and {remaining} more pages")
    print()

    # Unused methods
    if unused_methods:
        print(f"Unused API methods (defined but never called from any page): {len(unused_methods)}")
        for name, line in sorted(unused_methods.items()):
            print(f"  api.{name:<50} (client.ts:{line})")
        print()

    # Missing references
    if missing_refs:
        print(f"Missing references (page calls api.X but X doesn't exist): {len(missing_refs)}")
        for page, line_no, method in sorted(missing_refs):
            print(f"  {page}:{line_no} → api.{method}")
        print()

    # Summary
    print("─" * 60)
    print(
        f"Summary: {used_count:,} used / {len(unused_methods):,} unused / "
        f"{len(missing_refs)} missing"
    )

    if missing_refs:
        print("\nFAILED — pages reference API methods that don't exist in client.ts.")
        sys.exit(1)
    else:
        print("\nPASSED — all page API references resolve to existing methods.")
        sys.exit(0)


if __name__ == "__main__":
    main()
