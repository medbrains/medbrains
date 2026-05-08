#!/usr/bin/env python3
"""
Per-screen ↔ backend audit grid.

For every page under apps/web/src/pages/, walk the chain
  page.tsx → api.<method>(...) → routes/mod.rs registration → handler
and emit a Markdown grid plus a JSON sidecar for CI strictness checks.

Outputs:
  medbrains/docs/audit/screen-backend.md       — human-readable grid
  medbrains/docs/audit/screen-backend.json     — machine-readable
  exit 0 always; exit 1 only when --strict is passed and a row is red

Usage:
  python3 scripts/audit_screens.py
  python3 scripts/audit_screens.py --strict   # CI gate
"""

from __future__ import annotations

import json
import re
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
MEDBRAINS = REPO_ROOT / "medbrains"
PAGES_DIR = MEDBRAINS / "apps" / "web" / "src" / "pages"
CLIENT_TS = MEDBRAINS / "packages" / "api" / "src" / "client.ts"
ROUTES_DIR = MEDBRAINS / "crates" / "medbrains-server" / "src" / "routes"
ROUTES_MOD = ROUTES_DIR / "mod.rs"
OUT_DIR = MEDBRAINS / "docs" / "audit"
OUT_MD = OUT_DIR / "screen-backend.md"
OUT_JSON = OUT_DIR / "screen-backend.json"

# ── Page parsing ─────────────────────────────────────────────────────

RE_API_CALL = re.compile(r"\bapi\.(\w+)")
RE_GUARD = re.compile(r"useRequirePermission\(\s*([^)\s,]+)")
RE_HAS_PERM = re.compile(r"useHas(?:All|Any)?Permission(?:s)?\(\s*([^)\s,]+)")
RE_USEQUERY = re.compile(r"\b(useQuery|useQueries|useMutation|useMutations|useInfiniteQuery)\b")


@dataclass
class PageRow:
    rel_path: str
    lines: int
    guard: str | None  # permission code passed to useRequirePermission
    element_perms: list[str] = field(default_factory=list)
    api_methods: list[str] = field(default_factory=list)
    has_query_hooks: bool = False
    # populated later
    methods_resolved: int = 0
    methods_missing: list[str] = field(default_factory=list)
    handlers_stub: list[str] = field(default_factory=list)
    handlers_unregistered: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)

    @property
    def status(self) -> str:
        if self.methods_missing or self.handlers_unregistered:
            return "RED"
        if not self.guard and "onboarding" not in self.rel_path and self.api_methods:
            return "AMBER"
        if self.handlers_stub:
            return "AMBER"
        return "GREEN"


def scan_page(path: Path) -> PageRow:
    src = path.read_text(errors="replace")
    lines = src.count("\n") + 1
    guard_m = RE_GUARD.search(src)
    guard = guard_m.group(1).strip() if guard_m else None
    element_perms = sorted({m.group(1).strip() for m in RE_HAS_PERM.finditer(src)})
    methods = sorted({m.group(1) for m in RE_API_CALL.finditer(src)})
    has_hooks = bool(RE_USEQUERY.search(src))
    rel = str(path.relative_to(PAGES_DIR))
    return PageRow(
        rel_path=rel,
        lines=lines,
        guard=guard,
        element_perms=element_perms,
        api_methods=methods,
        has_query_hooks=has_hooks,
    )


# ── client.ts → method → (path, http) ────────────────────────────────

# Reuse logic from check_api_contract.py — minimal version inline.
RE_METHOD_DEF = re.compile(r"^\s{2,6}(\w+)\s*:\s*(?:async\s*)?\(", re.MULTILINE)
RE_REQ_LINE = re.compile(r'request<[^>]*>\s*\(\s*([`"])')
RE_HTTP_METHOD = re.compile(r'method:\s*"(GET|POST|PUT|DELETE|PATCH)"')


def parse_client_ts() -> dict[str, tuple[str, str]]:
    """Return {method_name: (http_method, normalized_path)}."""
    src = CLIENT_TS.read_text()
    out: dict[str, tuple[str, str]] = {}

    # Walk top-level methods inside `export const api = {`
    api_start = src.find("export const api")
    if api_start < 0:
        api_start = 0

    for m in RE_METHOD_DEF.finditer(src, api_start):
        name = m.group(1)
        # Reserved words / non-method keys to skip
        if name in {"if", "return", "const", "let", "this"}:
            continue
        # Find next request<...>( within ~2000 chars
        chunk = src[m.end() : m.end() + 2000]
        rm = RE_REQ_LINE.search(chunk)
        if not rm:
            continue
        # Extract path string
        quote = rm.group(1)
        start = rm.end()
        if quote == '"':
            end = chunk.find('"', start)
            raw = chunk[start:end]
        else:
            # Template literal — naive parse, replace ${...} with {param}
            depth = 0
            buf = []
            i = start
            while i < len(chunk):
                ch = chunk[i]
                if depth > 0:
                    if ch == "{":
                        depth += 1
                    elif ch == "}":
                        depth -= 1
                    i += 1
                    continue
                if ch == "`":
                    break
                if ch == "$" and i + 1 < len(chunk) and chunk[i + 1] == "{":
                    buf.append("{param}")
                    depth = 1
                    i += 2
                    continue
                buf.append(ch)
                i += 1
            raw = "".join(buf)
            end = i
        # HTTP method (defaults to GET). Scan only until the closing
        # `)` of THIS request<>() call — without bounding, a follow-on
        # `createX` method's `method: "POST"` leaks into a preceding
        # `listX` method's match.
        tail = chunk[end:]
        depth = 1
        stop = 0
        for ci, ch in enumerate(tail):
            if ch == "(":
                depth += 1
            elif ch == ")":
                depth -= 1
                if depth == 0:
                    stop = ci
                    break
        call_args = tail[:stop] if stop > 0 else tail[:200]
        hm = RE_HTTP_METHOD.search(call_args)
        http = hm.group(1) if hm else "GET"
        # Normalize: strip query, ensure /api prefix, then canonicalize
        # path params to match the routes/mod.rs side.
        path = raw.split("?", 1)[0].rstrip("/")
        # `${qs}` templates often inline the query string AND its `?`,
        # so the parsed path may end with `{param}` directly attached
        # to a static segment (no leading `/`). Strip those — they're
        # query-string appends, not path params.
        path = re.sub(r"(?<!/)\{[^}]+\}$", "", path)
        if not path.startswith("/api/"):
            path = "/api/" + path.lstrip("/")
        path = canonicalize_path(path)
        out.setdefault(name, (http, path))
    return out


# ── routes/mod.rs → registered routes ────────────────────────────────

RE_ROUTE_PATH = re.compile(r'\.route\(\s*"(/api/[^"]+)"', re.DOTALL)
RE_HANDLER_FN = re.compile(r"\b(get|post|put|delete|patch)\s*\(\s*([\w:]+)")
RE_AXUM_COLON = re.compile(r":(\w+)")
RE_PATH_PARAM = re.compile(r"\{[^}]+\}")


def canonicalize_path(p: str) -> str:
    # Both extractors flatten path params to a single sentinel `{*}` so
    # `/api/foo/{id}` (backend) and `/api/foo/{param}` (frontend) match.
    return RE_PATH_PARAM.sub("{*}", p.rstrip("/"))


def parse_routes_mod() -> dict[tuple[str, str], str]:
    """Return {(http, canonicalized_path): handler_fn_name}.

    Walk each `.route("/api/...", ...)` block; the handler chain can
    span multiple `.method(...)` invocations so we scan from the path
    string up to the next `.route(` (or end of string), capturing every
    `get|post|put|delete|patch(handler)` along the way.
    """
    src = ROUTES_MOD.read_text()
    out: dict[tuple[str, str], str] = {}

    matches = list(RE_ROUTE_PATH.finditer(src))
    for i, m in enumerate(matches):
        raw_path = m.group(1)
        path = canonicalize_path(RE_AXUM_COLON.sub(r"{\1}", raw_path))
        # Scan from end of this match to start of next .route( (or EOF)
        chunk_end = matches[i + 1].start() if i + 1 < len(matches) else len(src)
        chunk = src[m.end() : chunk_end]
        for hm in RE_HANDLER_FN.finditer(chunk):
            http = hm.group(1).upper()
            handler = hm.group(2).split("::")[-1]
            out[(http, path)] = handler
    return out


# ── handler bodies → length per fn name ──────────────────────────────


def scan_handlers() -> dict[str, int]:
    """Return {handler_fn_name: body_line_count} across all routes/*.rs."""
    out: dict[str, int] = {}
    fn_re = re.compile(r"^pub async fn (\w+)\s*\(", re.MULTILINE)
    for rs in ROUTES_DIR.rglob("*.rs"):
        if rs.name == "mod.rs":
            continue
        src = rs.read_text(errors="replace")
        lines = src.split("\n")
        for m in fn_re.finditer(src):
            name = m.group(1)
            start_idx = src[: m.start()].count("\n")
            # Walk forward to find the opening { of the body, then count
            # lines until matching close at depth 0.
            depth = 0
            body_lines = 0
            seen_open = False
            for i in range(start_idx, len(lines)):
                line = lines[i]
                for ch in line:
                    if ch == "{":
                        depth += 1
                        seen_open = True
                    elif ch == "}":
                        depth -= 1
                if seen_open:
                    body_lines += 1
                    if depth == 0:
                        break
            # Subtract the brace-only opening + closing lines for a fairer count
            out[name] = max(0, body_lines - 2)
    return out


# ── Audit ────────────────────────────────────────────────────────────


def audit() -> list[PageRow]:
    client = parse_client_ts()
    routes = parse_routes_mod()  # (http, path) → handler
    # Reverse index: handler_name → (http, path)
    handler_to_route = {v: k for k, v in routes.items()}
    handler_sizes = scan_handlers()

    rows: list[PageRow] = []
    for tsx in sorted(PAGES_DIR.rglob("*.tsx")):
        row = scan_page(tsx)
        for method in row.api_methods:
            if method not in client:
                row.methods_missing.append(method)
                continue
            row.methods_resolved += 1
            http, path = client[method]
            handler = routes.get((http, path))
            if not handler:
                row.handlers_unregistered.append(f"{method} {http} {path}")
                continue
            sz = handler_sizes.get(handler, 0)
            if sz <= 5:
                row.handlers_stub.append(f"{handler} ({sz}L)")
        if row.api_methods and not row.has_query_hooks:
            row.notes.append("api refs without useQuery/useMutation")
        # Only flag missing guard for top-level pages. Tab components
        # under admin/settings/, analytics/, audit/, care-view/ etc. are
        # rendered inside a parent that owns the page-level guard via
        # settings-tabs.ts / similar config. The parent filters tabs by
        # `requiredPermission` before mounting them, so per-tab guards
        # would be redundant (and would redirect from the tab even when
        # the parent permission is granted).
        is_partial = (
            "/" in row.rel_path
            and any(
                row.rel_path.startswith(prefix)
                for prefix in (
                    "admin/settings/",
                    "analytics/",
                    "audit/",
                    "care-view/",
                    "Pharmacy/",
                    "Ipd/",
                )
            )
        )
        if (
            not row.guard
            and row.api_methods
            and "onboarding" not in row.rel_path
            and not is_partial
            and row.rel_path not in {"login.tsx", "landing.tsx", "index.tsx"}
        ):
            row.notes.append("no useRequirePermission guard")
        rows.append(row)
    return rows


# ── Render ───────────────────────────────────────────────────────────


def render_markdown(rows: list[PageRow]) -> str:
    by_status: dict[str, int] = {"RED": 0, "AMBER": 0, "GREEN": 0}
    for r in rows:
        by_status[r.status] += 1
    lines = []
    lines.append("# Screen ↔ Backend Audit\n")
    lines.append(
        f"_Generated by `scripts/audit_screens.py`. Pages: {len(rows)} "
        f"(GREEN {by_status['GREEN']}, AMBER {by_status['AMBER']}, "
        f"RED {by_status['RED']})._\n"
    )
    lines.append("")
    lines.append("Status legend: **RED** = missing handler / unregistered route;")
    lines.append("**AMBER** = no permission guard or stub handler (≤5 line body);")
    lines.append("**GREEN** = guarded + every api method resolves to a handler with a real body.")
    lines.append("")

    # Group by top-level dir
    groups: dict[str, list[PageRow]] = {}
    for r in rows:
        top = r.rel_path.split("/", 1)[0] if "/" in r.rel_path else "_root"
        groups.setdefault(top, []).append(r)

    for top in sorted(groups):
        lines.append(f"## `{top}/` ({len(groups[top])} pages)\n")
        lines.append(
            "| Page | Lines | Guard | API calls | Resolved | Missing | Unregistered | Stub handlers | Status | Notes |"
        )
        lines.append("|---|---:|---|---:|---:|---|---|---|:---:|---|")
        for r in sorted(groups[top], key=lambda x: x.rel_path):
            guard = r.guard or "—"
            missing = ", ".join(r.methods_missing) if r.methods_missing else "—"
            unreg = (
                "; ".join(r.handlers_unregistered[:3])
                + (f" (+{len(r.handlers_unregistered) - 3})" if len(r.handlers_unregistered) > 3 else "")
            ) if r.handlers_unregistered else "—"
            stubs = ", ".join(r.handlers_stub) if r.handlers_stub else "—"
            notes = "; ".join(r.notes) if r.notes else ""
            lines.append(
                f"| `{r.rel_path}` | {r.lines} | `{guard}` | {len(r.api_methods)} | "
                f"{r.methods_resolved} | {missing} | {unreg} | {stubs} | {r.status} | {notes} |"
            )
        lines.append("")
    return "\n".join(lines)


def main() -> int:
    strict = "--strict" in sys.argv
    rows = audit()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    OUT_MD.write_text(render_markdown(rows))
    OUT_JSON.write_text(json.dumps([asdict(r) for r in rows], indent=2))
    red = [r for r in rows if r.status == "RED"]
    amber = [r for r in rows if r.status == "AMBER"]
    print(f"audit: {len(rows)} pages — {len(red)} RED, {len(amber)} AMBER")
    print(f"wrote {OUT_MD.relative_to(REPO_ROOT)}")
    print(f"wrote {OUT_JSON.relative_to(REPO_ROOT)}")
    if strict and red:
        for r in red:
            print(
                f"  RED  {r.rel_path}: missing={r.methods_missing} "
                f"unregistered={r.handlers_unregistered}"
            )
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
