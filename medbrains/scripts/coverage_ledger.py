#!/usr/bin/env python3
"""
Coverage ledger — what the e2e suites actually exercise, per module, computed.

Sibling of `authz_ledger.py`. Coverage is tracked, not remembered: a module is
not "tested" because someone wrote a spec for it once; it is tested when the
ledger, reading routes and specs from disk, says so.

Cells (per module = first segment after /api/):
  api.smoke      GET routes with a case in the generated smoke specs
  api.write      non-GET routes whose path a hand-written spec touches
  api.perm       routes whose path an rbac spec touches
  screens        <Route path> entries in App.tsx under this module's slug
  ui.touched     of those, paths a spec navigates to

Every count is a *path literal appearing in a spec*, so it is an upper bound
on real coverage and an honest floor for "nobody has looked". The header warns
when the generated smoke specs are older than the routes they were generated
from — the failure that let `make e2e-full` stay green against specs dated
18 May while the routes had moved to 58 other files.

  python3 scripts/coverage_ledger.py                 # table
  python3 scripts/coverage_ledger.py --module lab    # one module, with the uncovered paths
  python3 scripts/coverage_ledger.py --json
  python3 scripts/coverage_ledger.py --check         # ratchet against the baseline
  python3 scripts/coverage_ledger.py --update-baseline
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

MEDBRAINS = Path(__file__).resolve().parent.parent
REPO_ROOT = MEDBRAINS.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))

from check_api_contract import (  # noqa: E402  (repo-root script, imported for its extractors)
    backend_route_sources,
    extract_backend_endpoints,
    normalize_param_names,
)

E2E = MEDBRAINS / "apps" / "web" / "e2e"
SMOKE_DIR = E2E / "smoke" / "api"
APP_TSX = MEDBRAINS / "apps" / "web" / "src" / "App.tsx"
BASELINE = MEDBRAINS / "scripts" / "coverage_ledger.baseline.json"

RE_API_LITERAL = re.compile(r"""["'`](/api/[^"'`\s]*)["'`]""")
RE_TEMPLATE_SEG = re.compile(r"\$\{[^}]*\}")
# Generated smoke specs carry concrete seed values (a UUID, a number) where the
# route has {id}; fold those back so a route and its spec compare equal.
RE_CONCRETE_SEG = re.compile(r"/(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+)(?=/|$)")
RE_ROUTE_PATH = re.compile(r'<Route\s+path="([^"]+)"')
RE_GOTO = re.compile(r"""(?:goto|navigateTo)\(\s*(?:page\s*,\s*)?["'`](/[^"'`?\s]*)""")
CELLS = ("api.smoke", "api.write", "api.neg.validation", "api.neg.notfound", "api.perm", "ui.touched")


def module_of(path: str) -> str:
    m = re.match(r"^/api/([A-Za-z0-9_-]+)", path)
    return m.group(1) if m else "_misc"


def norm(path: str) -> str:
    """Template segments → {_}, then the contract checker's own normaliser."""
    folded = RE_CONCRETE_SEG.sub("/{_}", RE_TEMPLATE_SEG.sub("{_}", path))
    return normalize_param_names(folded.rstrip("/"))


def spec_touches() -> tuple[set[str], set[str], set[str], set[str]]:
    """(paths in smoke specs, paths in hand-written specs, paths in rbac specs, screens navigated)."""
    smoke: set[str] = set()
    hand: set[str] = set()
    rbac: set[str] = set()
    screens: set[str] = set()
    for spec in E2E.rglob("*.spec.ts"):
        text = spec.read_text(errors="ignore")
        paths = {norm(p) for p in RE_API_LITERAL.findall(text)}
        rel = spec.relative_to(E2E).as_posix()
        if rel.startswith("smoke/api/"):
            smoke |= paths
        elif rel.startswith("writes/"):
            # Generated negatives: counted through their manifest, never as
            # hand-written coverage of the write itself.
            continue
        else:
            hand |= paths
            if rel.startswith("rbac/"):
                rbac |= paths
        screens |= {p.rstrip("/") or "/" for p in RE_GOTO.findall(text)}
    return smoke, hand, rbac, screens


RE_ROUTE_OPEN = re.compile(r'<Route\s+path="([^"]+)"([^>]*)>')


def app_routes() -> list[tuple[str, str | None]]:
    """Every `<Route>` in App.tsx as (absolute path, element component or None).

    Routes nest: `<Route path="admin">` wraps children declared with relative
    paths, so "devices" is really "/admin/devices". Walked with a stack of
    open layout routes — a `<Route path=…>` with no `element` that does not
    self-close is a parent until its `</Route>`.
    """
    if not APP_TSX.exists():
        return []
    stack: list[str] = []
    out: list[tuple[str, str | None]] = []
    for line in APP_TSX.read_text().splitlines():
        s = line.strip()
        m = RE_ROUTE_OPEN.search(s)
        if m:
            path, attrs = m.group(1), m.group(2)
            if path in ("*", ""):
                continue
            segments = [p.strip("/") for p in [*stack, path] if p.strip("/")]
            full = "/" + "/".join(segments) if not path.startswith("/") else path
            if path.startswith("/") and stack:
                full = path
            comp = re.search(r"element=\{<(\w+)", attrs)
            redirect = re.search(r'<Navigate\s+to="([^"#]+)', attrs)
            # A `<Navigate>` route is an alias, recorded as its target path.
            out.append((full, redirect.group(1) if redirect else comp.group(1) if comp else None))
            if not attrs.rstrip().endswith("/") and "element=" not in attrs:
                stack.append(path)
        elif s.startswith("</Route>") and stack:
            stack.pop()
    return out


def app_screens() -> dict[str, list[str]]:
    """App.tsx route paths grouped by their first segment (the module slug)."""
    out: dict[str, list[str]] = defaultdict(list)
    seen: set[str] = set()
    for full, _comp in app_routes():
        if ":" in full or full in seen:
            continue
        seen.add(full)
        out[full.split("/")[1] or "_root"].append(full)
    return out


RE_LAZY = re.compile(r'const\s+(\w+)\s*=\s*lazy\(\(\)\s*=>\s*import\("\./pages/([^"]+)"\)')
RE_ROUTE_ELEMENT = re.compile(r'<Route\s+path="([^"]+)"\s+element=\{<(\w+)')
RE_PAGE_GUARD = re.compile(r"useRequirePermission\(\s*([^)]+?)\s*\)")
RE_P_REF = re.compile(r"\bP\.([A-Z_0-9.]+)")
PERMISSIONS_TS = MEDBRAINS / "packages" / "types" / "src" / "permissions.ts"


def p_accessor_map() -> dict[str, str]:
    """`P.NURSE.CODE_BLUE.VIEW` and `P.NURSE.CODE_BLUE_VIEW` → "nurse.code_blue.view".

    Walks the generated `P` object by brace depth, so nested and flat
    accessors both resolve — guessing the code from the accessor's spelling
    fails wherever a segment carries an underscore.
    """
    text = PERMISSIONS_TS.read_text()
    start = text.find("export const P = {")
    if start < 0:
        return {}
    stack: list[str] = []
    out: dict[str, str] = {}
    for line in text[start:].splitlines()[1:]:
        s = line.strip()
        if s.startswith("}"):
            if not stack:
                break
            stack.pop()
            continue
        m = re.match(r"([A-Z_0-9]+):\s*\{", s)
        if m:
            stack.append(m.group(1))
            continue
        m = re.match(r'([A-Z_0-9]+):\s*"([^"]+)"', s)
        if m:
            out[".".join([*stack, m.group(1)])] = m.group(2)
    return out


def page_gates() -> dict[str, dict[str, object]]:
    """`{"gates": route → codes its page's `useRequirePermission` accepts,
    "aliases": redirect route → target route}`.

    The nav item's permission is what shows the link; the page's own guard is
    what decides who may stay. They differ wherever a page gates on any-of
    several codes. This is the page's side, for the screen matrix to judge by.
    A `<Navigate>` alias carries its target's gates and lands on the target.
    """
    if not APP_TSX.exists():
        return {"gates": {}, "aliases": {}}
    app = APP_TSX.read_text()
    lazy = {name: file for name, file in RE_LAZY.findall(app)}
    accessors = p_accessor_map()
    pages_dir = MEDBRAINS / "apps" / "web" / "src" / "pages"
    out: dict[str, list[str]] = {}
    for path, component in app_routes():
        if ":" in path or component is None or component not in lazy:
            continue
        rel = lazy[component]
        candidates = [pages_dir / f"{rel}.tsx", pages_dir / rel / "index.tsx"]
        src = next((c.read_text() for c in candidates if c.exists()), None)
        if src is None:
            continue
        guard = RE_PAGE_GUARD.search(src)
        if not guard:
            continue
        arg = guard.group(1)
        refs = RE_P_REF.findall(arg)
        if not refs:
            # An identifier: a const array declared in the same file.
            ident = arg.strip().strip("[]")
            const = re.search(rf"const\s+{re.escape(ident)}\s*=\s*\[(.*?)\]", src, re.S)
            refs = RE_P_REF.findall(const.group(1)) if const else []
        codes = [accessors[r] for r in refs if r in accessors]
        if codes:
            out[path if path.startswith("/") else f"/{path}"] = codes
    aliases: dict[str, str] = {}
    for path, component in app_routes():
        if component and component.startswith("/") and "*" not in path and component in out:
            aliases[path] = component
            out[path] = out[component]
    return {"gates": out, "aliases": aliases}


def write_negatives() -> tuple[set[str], set[str]]:
    """("METHOD path" with a validation case, with a not-found case), from the
    manifest generate-api-writes.mjs leaves beside its specs."""
    manifest = E2E / "generated" / "writes-manifest.json"
    if not manifest.exists():
        return set(), set()
    data = json.loads(manifest.read_text())

    def keys(kind: str) -> set[str]:
        out = set()
        for entry in data.get(kind, []):
            method, _, path = entry.partition(" ")
            out.add(f"{method} {norm(path)}")
        return out

    return keys("validation"), keys("notfound")


def smoke_is_stale() -> bool:
    if not SMOKE_DIR.exists():
        return True
    newest_route = max((p.stat().st_mtime for p in backend_route_sources()), default=0.0)
    specs = list(SMOKE_DIR.glob("*.spec.ts"))
    if not specs:
        return True
    oldest_spec = min(p.stat().st_mtime for p in specs)
    return oldest_spec < newest_route


def build() -> dict:
    endpoints = extract_backend_endpoints()
    smoke, hand, rbac, navigated = spec_touches()
    neg_validation, neg_notfound = write_negatives()
    screens = app_screens()

    modules: dict[str, dict] = {}
    for method, path, _line in endpoints:
        n = norm(path)
        m = modules.setdefault(
            module_of(path),
            {
                "get": set(), "get_smoke": set(),
                "write": set(), "write_hand": set(),
                "neg_validation": set(), "neg_notfound": set(),
                "all": set(), "perm": set(),
            },
        )
        key = f"{method} {n}"
        m["all"].add(key)
        if n in rbac:
            m["perm"].add(key)
        if method == "GET":
            m["get"].add(key)
            if n in smoke:
                m["get_smoke"].add(key)
        else:
            m["write"].add(key)
            if n in hand:
                m["write_hand"].add(key)
            if key in neg_validation:
                m["neg_validation"].add(key)
            if key in neg_notfound:
                m["neg_notfound"].add(key)

    rows = []
    for name in sorted(set(modules) | set(screens)):
        m = modules.get(name)
        scr = screens.get(name, [])
        touched = [s for s in scr if s in navigated]
        rows.append(
            {
                "module": name,
                "routes": len(m["all"]) if m else 0,
                "get": len(m["get"]) if m else 0,
                "api.smoke": len(m["get_smoke"]) if m else 0,
                "write": len(m["write"]) if m else 0,
                "api.write": len(m["write_hand"]) if m else 0,
                "api.neg.validation": len(m["neg_validation"]) if m else 0,
                "api.neg.notfound": len(m["neg_notfound"]) if m else 0,
                "api.perm": len(m["perm"]) if m else 0,
                "screens": len(scr),
                "ui.touched": len(touched),
                "_uncovered_get": sorted(m["get"] - m["get_smoke"]) if m else [],
                "_uncovered_write": sorted(m["write"] - m["write_hand"]) if m else [],
                "_untouched_screens": sorted(set(scr) - set(touched)),
            }
        )
    return {
        "routes": len(endpoints),
        "screens": sum(len(v) for v in screens.values()),
        "smoke_stale": smoke_is_stale(),
        "rows": rows,
    }


def pct(part: int, whole: int) -> str:
    return "  -" if whole == 0 else f"{100 * part // whole:3d}"


def print_table(data: dict, only: str | None) -> None:
    rows = [r for r in data["rows"] if not only or r["module"] == only]
    if data["smoke_stale"]:
        print("WARNING: smoke specs are older than the routes — run `make e2e-smoke-generate`\n")
    print(
        f"COVERAGE LEDGER  routes {data['routes']}  screens {data['screens']}"
        "  (a cell = the path appears in a spec; an upper bound on real coverage)\n"
    )
    print(
        f"{'module':22} {'GET':>4} {'smoke%':>6} {'W':>4} {'write%':>6} {'val':>4} {'nf':>4} "
        f"{'perm':>5} {'scr':>4} {'touched%':>8}"
    )
    for r in rows:
        print(
            f"{r['module']:22} {r['get']:4d} {pct(r['api.smoke'], r['get']):>6} "
            f"{r['write']:4d} {pct(r['api.write'], r['write']):>6} "
            f"{r['api.neg.validation']:4d} {r['api.neg.notfound']:4d} {r['api.perm']:5d} "
            f"{r['screens']:4d} {pct(r['ui.touched'], r['screens']):>8}"
        )
    tot = {
        k: sum(r[k] for r in data["rows"])
        for k in (
            "get", "api.smoke", "write", "api.write", "api.neg.validation", "api.neg.notfound",
            "api.perm", "screens", "ui.touched",
        )
    }
    print(
        f"\n{'TOTAL':22} {tot['get']:4d} {pct(tot['api.smoke'], tot['get']):>6} "
        f"{tot['write']:4d} {pct(tot['api.write'], tot['write']):>6} "
        f"{tot['api.neg.validation']:4d} {tot['api.neg.notfound']:4d} {tot['api.perm']:5d} "
        f"{tot['screens']:4d} {pct(tot['ui.touched'], tot['screens']):>8}"
    )
    if only and rows:
        r = rows[0]
        for label, key in (
            ("GET routes with no smoke case", "_uncovered_get"),
            ("write routes no spec touches", "_uncovered_write"),
            ("screens no spec navigates to", "_untouched_screens"),
        ):
            print(f"\n{label} ({len(r[key])}):")
            for item in r[key][:60]:
                print(f"  {item}")
            if len(r[key]) > 60:
                print(f"  … {len(r[key]) - 60} more")


def counts(data: dict) -> dict[str, dict[str, int]]:
    return {r["module"]: {c: r[c] for c in CELLS} for r in data["rows"]}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--module")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--check", action="store_true", help="fail if any cell fell below the baseline")
    ap.add_argument("--update-baseline", action="store_true")
    ap.add_argument(
        "--emit-page-gates",
        metavar="PATH",
        help="write {route: [permission codes]} from each page's useRequirePermission and exit",
    )
    args = ap.parse_args()

    if args.emit_page_gates:
        gates = page_gates()
        Path(args.emit_page_gates).parent.mkdir(parents=True, exist_ok=True)
        Path(args.emit_page_gates).write_text(json.dumps(gates, indent=1, sort_keys=True) + "\n")
        print(
            f"page gates for {len(gates['gates'])} routes "
            f"({len(gates['aliases'])} aliases) → {args.emit_page_gates}"
        )
        return 0

    data = build()
    if args.update_baseline:
        BASELINE.write_text(json.dumps(counts(data), indent=1, sort_keys=True) + "\n")
        print(f"baseline written: {BASELINE.relative_to(MEDBRAINS)}")
        return 0
    if args.check:
        if not BASELINE.exists():
            print("no baseline — run `make coverage-ledger-update-baseline` first", file=sys.stderr)
            return 2
        base = json.loads(BASELINE.read_text())
        now = counts(data)
        drops = [
            f"{mod}.{cell}: {base[mod][cell]} → {now.get(mod, {}).get(cell, 0)}"
            for mod in base
            for cell in CELLS
            if now.get(mod, {}).get(cell, 0) < base[mod].get(cell, 0)
        ]
        if data["smoke_stale"]:
            drops.append("smoke specs are older than the routes (run make e2e-smoke-generate)")
        if drops:
            print("coverage ratchet failed — these cells fell:")
            for d in drops:
                print(f"  ✗ {d}")
            return 1
        print("coverage ratchet: OK (no cell below baseline)")
        return 0
    if args.json:
        print(json.dumps({k: v for k, v in data.items()}, indent=1, default=list))
        return 0
    print_table(data, args.module)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
