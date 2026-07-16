#!/usr/bin/env python3
"""
API Contract Check — verifies every frontend API method has a matching backend route.

Statically parses:
  - packages/api/src/client.ts  → frontend endpoints
  - crates/medbrains-server/src/routes/mod.rs → backend routes

No running server required.

Usage:
    python3 scripts/check_api_contract.py
    # or from medbrains/ or root:
    make check-api

Exit codes:
    0  All frontend endpoints have matching backend routes
    1  One or more frontend endpoints have no backend route
"""

import re
import sys
from pathlib import Path

# ── Paths ────────────────────────────────────────────────────────────

REPO_ROOT = Path(__file__).resolve().parent.parent
CLIENT_TS = REPO_ROOT / "medbrains" / "packages" / "api" / "src" / "client.ts"
ROUTES_RS = REPO_ROOT / "medbrains" / "crates" / "medbrains-server" / "src" / "routes" / "mod.rs"

# ── Frontend extraction ──────────────────────────────────────────────

# Match: method: "POST" etc.
RE_METHOD = re.compile(r'method:\s*"(GET|POST|PUT|DELETE|PATCH)"')


def extract_template_literal_path(source: str, start: int) -> str | None:
    """
    Extract the path portion of a template literal starting at `start`
    (the character AFTER the opening backtick).
    Handles nested template literals like `?${qs}` by tracking brace depth.
    """
    depth = 0  # brace nesting depth
    i = start
    path_chars = []

    while i < len(source):
        ch = source[i]

        if ch == '\\':
            # Escaped char — skip
            i += 2
            continue

        if depth > 0:
            # Inside ${...} — track braces
            if ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
            i += 1
            continue

        # We're at template-literal top level (depth == 0)
        if ch == '`':
            # End of template literal
            break
        elif ch == '$' and i + 1 < len(source) and source[i + 1] == '{':
            # Start of ${...} expression
            # Everything so far is the static path prefix
            # The ${...} might be a path param or a query string append
            # Emit a placeholder and track brace depth
            path_chars.append('${...}')
            depth = 1
            i += 2
            continue
        else:
            path_chars.append(ch)
            i += 1

    return ''.join(path_chars) if path_chars else None


def normalize_frontend_path(raw_path: str) -> str:
    """Normalize a frontend path to canonical form: /api/path/{param}"""
    path = raw_path

    # The ${...} placeholders can be:
    # 1. Path segments: text before ends with / → e.g., /patients/${id} → path param
    # 2. Query string appends: text before does NOT end with / → e.g., /audit-log${qs}
    # 3. Terminal path param: /patients/${id} at end → last segment is a param

    # Split on ${...} and analyze each gap
    parts = path.split('${...}')

    rebuilt = parts[0]
    for idx, part in enumerate(parts[1:], 1):
        preceding = rebuilt

        if preceding.endswith('/'):
            # ${...} is a path segment (preceded by /)
            rebuilt += '{param}' + part
        elif part.startswith('/'):
            # ${...} is a path segment (followed by /)
            rebuilt += '{param}' + part
        else:
            # ${...} is a query string append — stop here
            break

    path = rebuilt

    # Strip query string (anything after ?)
    if '?' in path:
        path = path[:path.index('?')]

    # Strip trailing slash
    path = path.rstrip('/')

    # Ensure /api prefix
    if path.startswith('/api/'):
        pass  # already has prefix
    elif path.startswith('/'):
        path = '/api' + path
    else:
        path = '/api/' + path

    return path


def extract_frontend_endpoints() -> list[tuple[str, str, int, str]]:
    """
    Extract (method, path, line_number, func_name) from client.ts.
    """
    source = CLIENT_TS.read_text()
    lines = source.split('\n')
    endpoints = []

    # Find all request<...>( calls by scanning the full source.
    # We find 'request<' then balance angle brackets to handle nested generics
    # like Record<string, unknown> or Array<Foo & { bar: string }>.
    req_start_pattern = re.compile(r'request<')

    for m in req_start_pattern.finditer(source):
        # Balance angle brackets starting after 'request<'
        pos = m.end()
        angle_depth = 1
        while pos < len(source) and angle_depth > 0:
            ch = source[pos]
            if ch == '<':
                angle_depth += 1
            elif ch == '>':
                angle_depth -= 1
            pos += 1
        if angle_depth != 0:
            continue
        # pos is now right after the closing '>' of request<TYPE>
        # Skip whitespace and expect '('
        rest = source[pos:pos + 20]
        paren_match = re.match(r'\s*\(\s*(["`])', rest)
        if not paren_match:
            continue
        quote = paren_match.group(1)
        path_start = pos + paren_match.end()

        # Determine line number
        line_no = source[:m.start()].count('\n') + 1

        if quote == '"':
            # Simple string — find closing quote
            end = source.index('"', path_start)
            raw_path = source[path_start:end]
            # The rest of the request() call is after the closing quote
            call_rest_start = end + 1
        else:
            # Template literal — use our custom parser
            raw = extract_template_literal_path(source, path_start)
            if raw is None:
                continue
            raw_path = raw
            # Find closing backtick position to know where rest of call starts
            call_rest_start = path_start
            depth = 0
            while call_rest_start < len(source):
                ch = source[call_rest_start]
                if ch == '\\':
                    call_rest_start += 2
                    continue
                if depth > 0:
                    if ch == '{': depth += 1
                    elif ch == '}': depth -= 1
                    call_rest_start += 1
                    continue
                if ch == '`':
                    call_rest_start += 1
                    break
                if ch == '$' and call_rest_start + 1 < len(source) and source[call_rest_start + 1] == '{':
                    depth = 1
                    call_rest_start += 2
                    continue
                call_rest_start += 1

        # Determine HTTP method — only look within the same request() call.
        # After the path string, there may be a comma + options object with method:.
        # We look at the text between the path end and the next ')' that closes request().
        # Limit to 200 chars to avoid crossing into the next function.
        call_rest = source[call_rest_start:min(call_rest_start + 200, len(source))]
        # Find the closing paren of request(...) — track brace depth
        paren_depth = 0
        call_end = len(call_rest)
        for ci, ch in enumerate(call_rest):
            if ch == '(':
                paren_depth += 1
            elif ch == ')':
                if paren_depth == 0:
                    call_end = ci
                    break
                paren_depth -= 1
        call_args = call_rest[:call_end]

        method = 'GET'
        method_match = RE_METHOD.search(call_args)
        if method_match:
            method = method_match.group(1)

        normalized = normalize_frontend_path(raw_path)

        # Skip empty or obviously broken paths
        if normalized in ('/api', '/api/'):
            continue

        # Find function name — look backwards from this line
        func_name = '?'
        line_idx = line_no - 1
        for k in range(line_idx, max(line_idx - 8, -1), -1):
            fn_match = re.search(r'^\s*(\w+)\s*[:=]', lines[k])
            if fn_match:
                func_name = fn_match.group(1)
                break

        endpoints.append((method, normalized, line_no, func_name))

    return endpoints


# ── Backend extraction ───────────────────────────────────────────────

# Match: .route("/api/path", get(handler).post(handler2))
RE_ROUTE = re.compile(
    r'\.route\(\s*"(/api/[^"]+)"\s*,\s*([^)]+\)(?:\s*\.\s*\w+\([^)]*\))*)',
    re.DOTALL,
)

# Match individual method handlers: get(...), post(...), put(...), delete(...), patch(...)
RE_HANDLER = re.compile(r'\b(get|post|put|delete|patch)\s*\(')

# Axum path param :name → {name}
RE_AXUM_COLON_PARAM = re.compile(r':(\w+)')


def normalize_backend_path(raw_path: str) -> str:
    """Normalize a backend route path."""
    path = raw_path.strip()
    # Convert :param to {param} (for older Axum syntax)
    path = RE_AXUM_COLON_PARAM.sub(r'{\1}', path)
    path = path.rstrip('/')
    return path


def backend_route_sources() -> list[Path]:
    """
    Route definitions live in routes/mod.rs plus each extracted leaf domain
    crate's `router()` (RFC-SERVER-CRATE-SPLIT). Scan mod.rs and every workspace
    crate source file that registers routes (`.route(`), deduped.
    """
    sources = [ROUTES_RS]
    crates_dir = REPO_ROOT / "medbrains" / "crates"
    for rs in sorted(crates_dir.glob("medbrains-*/src/**/*.rs")):
        if rs == ROUTES_RS:
            continue
        try:
            if ".route(" in rs.read_text():
                sources.append(rs)
        except OSError:
            continue
    return sources


def extract_backend_endpoints() -> list[tuple[str, str, int]]:
    """
    Extract (method, path, line_number) from routes/mod.rs and all leaf-crate routers.
    """
    endpoints = []

    for source_file in backend_route_sources():
        source = source_file.read_text()
        for match in RE_ROUTE.finditer(source):
            raw_path = match.group(1)
            handler_chain = match.group(2)
            line_no = source[:match.start()].count('\n') + 1

            normalized_path = normalize_backend_path(raw_path)

            methods = [m.group(1).upper() for m in RE_HANDLER.finditer(handler_chain)]
            if not methods:
                continue

            for method in methods:
                endpoints.append((method, normalized_path, line_no))

    return endpoints


# ── Comparison ───────────────────────────────────────────────────────

def normalize_param_names(path: str) -> str:
    """Replace all {param_name} with {_} for comparison."""
    return re.sub(r'\{[^}]+\}', '{_}', path)


def main():
    if not CLIENT_TS.exists():
        print(f"ERROR: Frontend file not found: {CLIENT_TS}")
        sys.exit(2)
    if not ROUTES_RS.exists():
        print(f"ERROR: Backend file not found: {ROUTES_RS}")
        sys.exit(2)

    fe_endpoints = extract_frontend_endpoints()
    be_endpoints = extract_backend_endpoints()

    # Build lookup dicts with normalized param names
    fe_set: dict[str, list[tuple[int, str]]] = {}  # "METHOD /path" → [(line, func), ...]
    for method, path, line_no, func in fe_endpoints:
        key = f"{method} {normalize_param_names(path)}"
        fe_set.setdefault(key, []).append((line_no, func))

    be_set: dict[str, list[int]] = {}  # "METHOD /path" → [line, ...]
    for method, path, line_no in be_endpoints:
        key = f"{method} {normalize_param_names(path)}"
        be_set.setdefault(key, []).append(line_no)

    # Find mismatches
    missing_in_backend = []
    for key, refs in sorted(fe_set.items()):
        if key not in be_set:
            for line_no, func in refs:
                missing_in_backend.append((key, line_no, func))

    missing_in_frontend = []
    for key, ref_lines in sorted(be_set.items()):
        if key not in fe_set:
            for line_no in ref_lines:
                missing_in_frontend.append((key, line_no))

    matched = len(set(fe_set.keys()) & set(be_set.keys()))

    # ── Output ───────────────────────────────────────────────────

    print("=== API Contract Check ===")
    print(f"Frontend endpoints: {len(fe_set):,}")
    print(f"Backend endpoints:  {len(be_set):,}")
    print(f"Matched:            {matched:,}")
    print()

    if missing_in_backend:
        print(f"MISSING IN BACKEND ({len(missing_in_backend)} frontend calls with no backend route):")
        for key, line_no, func in missing_in_backend:
            parts = key.split(' ', 1)
            method = parts[0]
            path = parts[1] if len(parts) > 1 else '?'
            print(f"  {method:<6} {path:<60} (client.ts:{line_no} → {func})")
        print()

    if missing_in_frontend:
        print(f"MISSING IN FRONTEND ({len(missing_in_frontend)} backend routes with no frontend call):")
        for key, line_no in missing_in_frontend:
            parts = key.split(' ', 1)
            method = parts[0]
            path = parts[1] if len(parts) > 1 else '?'
            print(f"  {method:<6} {path:<60} (mod.rs:{line_no})")
        print()

    # Summary
    print("\u2500" * 60)
    print(f"Summary: {len(missing_in_backend)} missing in backend, "
          f"{len(missing_in_frontend)} missing in frontend, "
          f"{matched} matched")

    if missing_in_backend:
        print("\nFAILED \u2014 frontend has API calls with no matching backend route.")
        sys.exit(1)
    else:
        print("\nPASSED \u2014 all frontend endpoints have matching backend routes.")
        sys.exit(0)


if __name__ == "__main__":
    main()
