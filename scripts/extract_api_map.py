#!/usr/bin/env python3
"""
Extract a complete mapping of every API method in client.ts to its HTTP method,
URL path, body presence, and parameter info. Outputs JSON to stdout.

Usage:
    python3 scripts/extract_api_map.py
    python3 scripts/extract_api_map.py --pretty
"""

import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
CLIENT_TS = REPO_ROOT / "medbrains" / "packages" / "api" / "src" / "client.ts"

RE_METHOD = re.compile(r'method:\s*"(GET|POST|PUT|DELETE|PATCH)"')


def extract_template_literal_path(source: str, start: int) -> tuple[str, int]:
    """
    Extract the path from a template literal starting at `start`
    (the character AFTER the opening backtick).
    Returns (path_string, position_after_closing_backtick).
    Template expressions ${...} are replaced with {param_N}.
    """
    depth = 0
    i = start
    path_chars: list[str] = []
    param_counter = 0

    while i < len(source):
        ch = source[i]

        if ch == '\\':
            i += 2
            continue

        if depth > 0:
            if ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
            i += 1
            continue

        if ch == '`':
            return ''.join(path_chars), i + 1
        elif ch == '$' and i + 1 < len(source) and source[i + 1] == '{':
            param_counter += 1
            path_chars.append(f'{{param_{param_counter}}}')
            depth = 1
            i += 2
            continue
        else:
            path_chars.append(ch)
            i += 1

    return ''.join(path_chars), i


def normalize_path(raw_path: str) -> str:
    """
    Normalize a raw path:
    - Convert template param placeholders to proper {param_N} style
    - Strip query string template appends (${...} not preceded by /)
    - Strip literal query strings
    - Strip trailing slash
    """
    # The path has {param_N} placeholders from extract_template_literal_path.
    # Determine which are path params vs query string appends:
    #   - If preceded by '/' or followed by '/' → path param
    #   - Otherwise → query string append (strip from here onward)
    parts = re.split(r'(\{param_\d+\})', raw_path)
    rebuilt = ''
    for i, part in enumerate(parts):
        if re.match(r'\{param_\d+\}', part):
            preceding = rebuilt
            following = ''.join(parts[i + 1:]) if i + 1 < len(parts) else ''
            if preceding.endswith('/') or following.startswith('/'):
                rebuilt += part
            else:
                # Query string append — stop here
                break
        else:
            rebuilt += part

    raw_path = rebuilt

    # Strip query string
    if '?' in raw_path:
        raw_path = raw_path[:raw_path.index('?')]

    return raw_path.rstrip('/')


def find_method_body_end(source: str, start: int) -> int:
    """
    From `start` (the position of the method name in the api object),
    find the end of this method's body by tracking balanced braces/parens
    and looking for the comma or closing brace that ends this property.
    """
    # We need to find where this property value ends.
    # Strategy: skip past the colon, then balance all brackets until
    # we hit a comma at depth 0 or a closing brace at depth -1.
    i = start
    # Find the colon
    while i < len(source) and source[i] != ':':
        i += 1
    i += 1  # skip colon

    depth_paren = 0
    depth_brace = 0
    depth_bracket = 0
    in_string = None  # None, '"', "'", '`'
    template_depth = 0

    while i < len(source):
        ch = source[i]

        # Handle strings
        if in_string:
            if ch == '\\':
                i += 2
                continue
            if in_string == '`':
                if ch == '$' and i + 1 < len(source) and source[i + 1] == '{':
                    template_depth += 1
                    i += 2
                    continue
                if ch == '}' and template_depth > 0:
                    template_depth -= 1
                    i += 1
                    continue
                if ch == '`' and template_depth == 0:
                    in_string = None
            elif ch == in_string:
                in_string = None
            i += 1
            continue

        if ch in ('"', "'", '`'):
            in_string = ch
            i += 1
            continue

        if ch == '(':
            depth_paren += 1
        elif ch == ')':
            depth_paren -= 1
        elif ch == '{':
            depth_brace += 1
        elif ch == '}':
            depth_brace -= 1
            if depth_paren == 0 and depth_brace < 0:
                # End of the api object — this was the last method
                return i
        elif ch == '[':
            depth_bracket += 1
        elif ch == ']':
            depth_bracket -= 1

        if ch == ',' and depth_paren == 0 and depth_brace == 0 and depth_bracket == 0:
            return i

        i += 1

    return i


def extract_params(source: str, start: int, end: int) -> tuple[int, list[str]]:
    """
    Extract function parameters from the method body.
    Look for patterns like:
      (data: Type) =>
      (id: string) =>
      (id: string, data: Type) =>
      async (data: Type): Promise<...> =>
      () =>
    """
    body = source[start:end]

    # Find the arrow function parameters
    # Look for pattern: (params) => or async (params) =>
    # The parameters are between the first ( and the matching )
    # But we need to find the right ( — it's the one in the function signature

    # Find ': ' or '= ' after method name, then look for '(' or 'async ('
    colon_pos = body.find(':')
    if colon_pos == -1:
        return 0, []

    after_colon = body[colon_pos + 1:].lstrip()

    # Handle async
    if after_colon.startswith('async'):
        after_colon = after_colon[5:].lstrip()

    if not after_colon.startswith('('):
        # Might be () => request<...> format
        # Or might be a non-arrow function
        return 0, []

    # Find the matching closing paren
    depth = 0
    param_start = None
    param_end = None
    offset = colon_pos + 1 + (len(body[colon_pos + 1:]) - len(body[colon_pos + 1:].lstrip()))

    # Re-find from the actual position
    search_start = body.find('(', colon_pos)
    if search_start == -1:
        return 0, []

    i = search_start
    while i < len(body):
        ch = body[i]
        if ch == '(':
            if depth == 0:
                param_start = i + 1
            depth += 1
        elif ch == ')':
            depth -= 1
            if depth == 0:
                param_end = i
                break
        i += 1

    if param_start is None or param_end is None:
        return 0, []

    params_str = body[param_start:param_end].strip()
    if not params_str:
        return 0, []

    # Parse parameter names — handle complex types with nested braces/generics
    params: list[str] = []
    current_param = []
    depth_brace = 0
    depth_angle = 0
    depth_paren = 0

    for ch in params_str:
        if ch == '{':
            depth_brace += 1
            current_param.append(ch)
        elif ch == '}':
            depth_brace -= 1
            current_param.append(ch)
        elif ch == '<':
            depth_angle += 1
            current_param.append(ch)
        elif ch == '>':
            depth_angle -= 1
            current_param.append(ch)
        elif ch == '(':
            depth_paren += 1
            current_param.append(ch)
        elif ch == ')':
            depth_paren -= 1
            current_param.append(ch)
        elif ch == ',' and depth_brace == 0 and depth_angle == 0 and depth_paren == 0:
            params.append(''.join(current_param).strip())
            current_param = []
        else:
            current_param.append(ch)

    if current_param:
        params.append(''.join(current_param).strip())

    # Extract just the names (before the colon or ?)
    param_names = []
    for p in params:
        p = p.strip()
        if not p:
            continue
        # Could be "data: Type" or "{ field1, field2 }: Type" or "id: string"
        name_match = re.match(r'^(\w+)\s*[?:]', p)
        if name_match:
            param_names.append(name_match.group(1))
        elif p.startswith('{'):
            # Destructured param — use "data" as generic name
            param_names.append('data')
        else:
            param_names.append(p.split(':')[0].split('?')[0].strip())

    return len(param_names), param_names


def extract_api_methods() -> list[dict]:
    """Extract all API methods from client.ts."""
    source = CLIENT_TS.read_text()
    lines = source.split('\n')

    # Find the start of `export const api = {`
    api_start_match = re.search(r'export\s+const\s+api\s*=\s*\{', source)
    if not api_start_match:
        print("ERROR: Could not find 'export const api = {' in client.ts", file=sys.stderr)
        sys.exit(1)

    api_start = api_start_match.end()

    # Find all method properties within the api object.
    # Methods are defined as: methodName: (...) => ... or methodName: async (...) => ...
    # We scan for patterns like `  methodName:` at the top level of the object.

    methods: list[dict] = []

    # Strategy: find each top-level property in the api object
    # by looking for `\n  identifier:` or `\n  identifier:` patterns
    # and then extracting the request<> call within each method body.

    # First, find all method names and their positions
    method_pattern = re.compile(r'\n\s{2}(\w+)\s*:\s*(?:async\s*)?\(|^\s{2}(\w+)\s*:\s*(?:async\s*)?\(', re.MULTILINE)

    # Better approach: find method names by looking for lines like "  methodName: " at indent 2
    # within the api object body
    prop_pattern = re.compile(r'^  (?! )(\w+)\s*:', re.MULTILINE)

    # Find the end of the api object
    depth = 1
    api_end = api_start
    in_string = None
    tmpl_depth = 0
    while api_end < len(source) and depth > 0:
        ch = source[api_end]
        if in_string:
            if ch == '\\':
                api_end += 2
                continue
            if in_string == '`':
                if ch == '$' and api_end + 1 < len(source) and source[api_end + 1] == '{':
                    tmpl_depth += 1
                    api_end += 2
                    continue
                if ch == '}' and tmpl_depth > 0:
                    tmpl_depth -= 1
                    api_end += 1
                    continue
                if ch == '`' and tmpl_depth == 0:
                    in_string = None
            elif ch == in_string:
                in_string = None
            api_end += 1
            continue
        if ch in ('"', "'", '`'):
            in_string = ch
            api_end += 1
            continue
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
        api_end += 1

    api_body = source[api_start_match.start():api_end]

    # Now find all top-level properties in the api object.
    # They appear at exactly 2-space indent (not more) within the object.
    prop_positions: list[tuple[str, int]] = []  # (name, absolute_position)

    for m in prop_pattern.finditer(source, api_start, api_end):
        name = m.group(1)
        prop_positions.append((name, m.start()))

    # For each property, extract its body and find request<> calls
    for idx, (name, pos) in enumerate(prop_positions):
        # Determine the end of this method body
        if idx + 1 < len(prop_positions):
            body_end = prop_positions[idx + 1][1]
        else:
            body_end = api_end

        method_body = source[pos:body_end]
        line_no = source[:pos].count('\n') + 1

        # Extract parameters
        param_count, param_names = extract_params(source, pos, body_end)

        # Find request<...>( calls within this method body
        req_pattern = re.compile(r'request<')
        req_matches = list(req_pattern.finditer(method_body))

        if not req_matches:
            continue

        # Use the first request<> call (some methods like login have one)
        rm = req_matches[0]
        # Balance angle brackets
        rpos = rm.end()
        angle_depth = 1
        while rpos < len(method_body) and angle_depth > 0:
            ch = method_body[rpos]
            if ch == '<':
                angle_depth += 1
            elif ch == '>':
                angle_depth -= 1
            rpos += 1

        # Now find opening paren and the path argument
        rest = method_body[rpos:rpos + 20]
        paren_match = re.match(r'\s*\(\s*(["`])', rest)
        if not paren_match:
            # Might use a variable for the path — skip
            continue

        quote = paren_match.group(1)
        path_start_in_body = rpos + paren_match.end()
        path_start_abs = pos + path_start_in_body

        if quote == '"':
            # Simple string literal
            end_quote = method_body.index('"', path_start_in_body)
            raw_path = method_body[path_start_in_body:end_quote]
            call_rest_start_in_body = end_quote + 1
        else:
            # Template literal
            raw_path, end_pos = extract_template_literal_path(method_body, path_start_in_body)
            call_rest_start_in_body = end_pos

        # Determine HTTP method
        # Look at the rest of the request() call for method: "..."
        call_rest = method_body[call_rest_start_in_body:call_rest_start_in_body + 300]
        # Find closing paren of request(...)
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

        http_method = 'GET'
        method_match = RE_METHOD.search(call_args)
        if method_match:
            http_method = method_match.group(1)

        # Check for body
        has_body = 'body:' in call_args or 'body:' in method_body[:call_rest_start_in_body]
        # More precise: check only within the request() options
        has_body = 'body:' in call_args

        # Normalize path
        path = normalize_path(raw_path)

        # Skip health check (not under /api)
        # Keep all paths as-is (relative to base URL which already has /api)

        methods.append({
            'name': name,
            'httpMethod': http_method,
            'path': path,
            'hasBody': has_body,
            'paramCount': param_count,
            'paramNames': param_names,
            'line': line_no,
        })

    return methods


def main():
    pretty = '--pretty' in sys.argv

    methods = extract_api_methods()

    if pretty:
        print(json.dumps(methods, indent=2))
    else:
        print(json.dumps(methods))

    print(f"\nTotal methods: {len(methods)}", file=sys.stderr)


if __name__ == "__main__":
    main()
