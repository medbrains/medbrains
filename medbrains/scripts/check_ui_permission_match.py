#!/usr/bin/env python3
"""A page's permission gate must match the permission its API call requires.

    python3 scripts/check_ui_permission_match.py            # summary
    python3 scripts/check_ui_permission_match.py --detail    # per page

Three checks already touch this area and none of them closes it:

  check-ui-api                does the method the page calls exist?
  check-permission-enforcement is this UI gate enforced by SOME handler?
  check-permission-codes      is the code the gate names defined at all?

The question none of them asks is whether **this page's gate matches the
permission this page's call requires**. `check-permission-enforcement` is
existence-based: a gate on `opd.queue.list` passes because *some* handler
somewhere checks that code, even if the button next to it posts to an endpoint
demanding `opd.visit.create`.

That is the shape CLAUDE.md names as rule 7 — "the control's gate must match the
permission its call requires" — and it fails in two directions:

  under-gated  the page calls something needing P and gates on nothing, or on a
               weaker code. The control is offered to people the server will
               refuse, and the 403 arrives after they have filled in the form.
  over-gated   the page gates on a code stricter than the call needs, hiding a
               control from people who are authorised. Silent, and it looks
               like a missing feature rather than a permission bug.

The join is five links long and this is the only place it is made:

    page  ->  API method  ->  route path  ->  handler  ->  permission
                                                              vs
                                                        the page's gates

Reports rather than gates. The under-gated set is a real finding; the
over-gated set needs a human, because a page legitimately gates a whole screen
on its narrowest read and offers stricter controls inside it.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLIENT_TS = os.path.join(ROOT, "packages", "api", "src", "client.ts")
CRATES = os.path.join(ROOT, "crates")
# The whole of `src`, not just `pages`. A gate does not have to live in the
# component: `config/settings-tabs.ts` declares `requiredPermission` beside
# `component`, and walking only `pages/` never read the file holding the gate,
# so every data-driven settings tab came back as a finding.
WEB_SRC = os.path.join(ROOT, "apps", "web", "src")
PAGES = os.path.join(ROOT, "apps", "web", "src", "pages")

# `  listPatients: async (…) => request<T>("GET", "/api/patients"…` — the method
# name is the nearest preceding object key, which is how client.ts is written.
RE_KEY = re.compile(r"^\s{2}(\w+)\s*[:(]", re.M)
# The path is `request<T>`'s FIRST argument and it is RELATIVE — the client
# stores `apiBase = "/api"` and prepends it at call time, so `/lab/orders` here
# is `/api/lab/orders` on the wire. Matching on a literal `/api/` found nothing.
RE_REQUEST = re.compile(r'request<[^>]*>\s*\(\s*["`](/[^"`]*)')
RE_ROUTE = re.compile(r'\.route\(\s*"(/api/[^"]+)"\s*,\s*((?:\s*\.?\s*(?:get|post|put|patch|delete)\([a-z_0-9:]+\))+)')
RE_VERB = re.compile(r"(?:get|post|put|patch|delete)\(([a-z_0-9:]+)\)")
RE_HANDLER_DEF = re.compile(r"^pub async fn (\w+)\s*\(", re.M)
RE_PERM_USE = re.compile(r"permissions::([a-z_0-9:]+)::([A-Z_0-9]+)")
RE_GATE = re.compile(r"use(?:Require|Has)(?:All|Any)?Permissions?\(\s*\[?\s*([^)\]]+)")
RE_P_ACCESSOR = re.compile(r"P\.([A-Z_0-9.]+)")

# `<PermissionGate codes={X}>` — the seam's render-side gate. `X` is usually a
# key of a per-file table (`TAB_PERMISSIONS.consents`) rather than an inline
# array, so the identifier is resolved against `const X = { … }` in the same
# file and every code in it counted.
#
# The ceiling: this is file-granular, like the import inheritance it feeds. A
# file holding eleven separately-gated panels is credited with all eleven codes,
# so a panel gated on the wrong one of them still passes. It catches the file
# that gates on nothing, which is the failure that actually ships.
RE_PERMISSION_GATE = re.compile(r"<PermissionGate\b[^>]*?codes=\{([^}]*)\}")
RE_TABLE = re.compile(r"const (\w+)\s*=\s*\{(.*?)\n\}", re.S)

# A permission declared beside the call it guards, inside a descriptor object:
#
#     csvImport: {
#       permission: "billing.catalog.manage",
#       run: (data) => billingService.importChargeMaster(data),
#     }
#
# This is a gate on ONE method rather than on the file, which is stricter than
# anything else here understands — and it was being reported as ungated, which
# would have talked someone out of the better pattern.
RE_CALL_GATE = re.compile(
    r'permission:\s*"([a-z0-9_.]+)"[^}]{0,400}?'
    r"(?:run|queryFn|mutationFn):[^\n]*?\.(\w+)\("
)
RE_CALL = re.compile(r"\b(?:\w+Service|apiClient|api)\.(\w+)\s*\(")

# Files that enumerate codes rather than enforce them.
ENUMERATORS = ("medbrains-loadtest/src/generated.rs", "medbrains-seed/src")


def catalogue() -> dict[str, str]:
    """`a::b::CONST` -> `a.b.const`, by walking permissions.rs as a module tree."""
    path = os.path.join(CRATES, "medbrains-core", "src", "permissions.rs")
    paths: dict[str, str] = {}
    stack: list[str] = []
    for line in open(path, encoding="utf-8"):
        s = line.strip()
        if m := re.match(r"pub mod (\w+)\s*\{", s):
            stack.append(m.group(1))
            continue
        if m := re.match(r'pub const ([A-Z_0-9]+): &str = "([a-z0-9_.]+)"', s):
            paths["::".join(stack + [m.group(1)])] = m.group(2)
            continue
        if s.startswith("}") and stack:
            stack.pop()
    return paths


def method_to_path() -> dict[str, str]:
    """Frontend method name -> the API path it calls."""
    text = open(CLIENT_TS, encoding="utf-8").read()
    keys = [(m.start(), m.group(1)) for m in RE_KEY.finditer(text)]
    out: dict[str, str] = {}
    for m in RE_REQUEST.finditer(text):
        prior = [name for pos, name in keys if pos < m.start()]
        if prior:
            out.setdefault(prior[-1], normalise(m.group(1)))
    return out


def normalise(path: str) -> str:
    """Collapse path parameters and add the `/api` the client prepends at runtime.

    A trailing `${qs}` is a query string, not a segment, so it is dropped rather
    than turned into a parameter — otherwise `/lab/orders${qs}` would never match
    the route `/api/lab/orders`.
    """
    path = re.sub(r"\$\{\s*qs\s*\}", "", path)
    path = re.sub(r"\?.*$", "", path)
    path = re.sub(r"\$\{[^}]*\}", "{p}", path)
    path = re.sub(r"\{[^}]*\}", "{p}", path)
    path = path.rstrip("/")
    if not path.startswith("/api/") and path.startswith("/"):
        path = "/api" + path
    return path


def route_to_permissions(paths: dict[str, str]) -> dict[str, set[str]]:
    """API path -> the permission codes its handlers require."""
    # Keyed by (file, fn), NOT by bare function name. Keying on the name alone
    # unions every same-named handler in the workspace: `listDoctors` came back
    # needing eighteen permissions including `camp.create` and `patients.update`,
    # because a dozen crates have a `list_doctors`. A route is registered in the
    # same file as its handler, so the file is the correct scope.
    handler_perms: dict[tuple[str, str], set[str]] = defaultdict(set)
    route_handlers: dict[str, set[tuple[str, str]]] = defaultdict(set)

    for dirpath, dirs, files in os.walk(CRATES):
        dirs[:] = [d for d in dirs if d != "target"]
        for name in files:
            if not name.endswith(".rs"):
                continue
            rel = os.path.relpath(os.path.join(dirpath, name), ROOT)
            if any(e in rel for e in ENUMERATORS):
                continue
            try:
                text = open(os.path.join(dirpath, name), encoding="utf-8", errors="replace").read()
            except OSError:
                continue

            marks = [(m.group(1), m.start()) for m in RE_HANDLER_DEF.finditer(text)]
            for i, (fn, start) in enumerate(marks):
                end = marks[i + 1][1] if i + 1 < len(marks) else len(text)
                for pm in RE_PERM_USE.finditer(text[start:end]):
                    code = paths.get(f"{pm.group(1)}::{pm.group(2)}")
                    if code:
                        handler_perms[(rel, fn)].add(code)

            for rm in RE_ROUTE.finditer(text):
                for fn in RE_VERB.findall(rm.group(2)):
                    route_handlers[normalise(rm.group(1))].add((rel, fn.split("::")[-1]))

    return {
        path: {code for key in keys for code in handler_perms.get(key, ())}
        for path, keys in route_handlers.items()
    }


# `@/…` as well as `./…` — the tab registry imports every component by alias,
# so a relative-only pattern resolved none of them and the registry gate it
# declares attached to nothing.
RE_IMPORT = re.compile(
    r'^\s*import\s+([^;]*?)\s+from\s+["\']((?:\.|@/)[^"\']+)["\']', re.M
)

# A tab registry: `{ requiredPermission: "x", component: Y }`, in either order.
# This IS a gate — the shell refuses to render the component without the code —
# and it is the better pattern, because one table states every tab's permission
# instead of each component restating its own.
# Both spellings: `requiredPermission: "x"` and `requiredPermissions: [...]`.
# Seven of the thirty-three tabs use the list form, and matching only the
# singular reported every one of them as ungated.
RE_REGISTRY = re.compile(
    r'requiredPermissions?:\s*(\[[^\]]*\]|"[a-z0-9_.]+")[^}]*?component:\s*(\w+)'
    r'|component:\s*(\w+)[^}]*?requiredPermissions?:\s*(\[[^\]]*\]|"[a-z0-9_.]+")'
)


def effective_gates(
    own: dict[str, set[str]], imports: dict[str, set[str]]
) -> dict[str, set[str]]:
    """A file inherits the gates of every file that renders it.

    Without this the check is nonsense on a codebase organised in tabs. Twenty-three
    of `opd/workflow-tabs.tsx`'s calls looked ungated because the gate lives in
    `opd.tsx`, which renders it through `page-inner.tsx` — the control IS gated,
    two files up. A per-file view reports the whole tab as a finding.

    Walked to a fixed point rather than one level, because the chain here is two
    hops and nothing says it will not be three. Bounded by the file count, and the
    visited set stops a cycle from spinning.
    """
    inherited = {f: set(g) for f, g in own.items()}
    changed = True
    rounds = 0
    while changed and rounds < len(own) + 1:
        changed = False
        rounds += 1
        for importer, targets in imports.items():
            gates = inherited.get(importer, set())
            if not gates:
                continue
            for target in targets:
                before = len(inherited.setdefault(target, set()))
                inherited[target] |= gates
                if len(inherited[target]) != before:
                    changed = True
    return inherited


def page_facts(known_codes: set[str]) -> dict[str, tuple[set[str], set[str]]]:
    """Page -> (methods it calls, codes it gates on, codes gated per-method)."""
    by_code = {}
    for code in known_codes:
        seg = [s.upper() for s in code.split(".")]
        by_code[f"{seg[0]}." + ".".join(seg[1:])] = code
        by_code[f"{seg[0]}." + "_".join(seg[1:])] = code
        if len(seg) >= 4:
            by_code[f"{seg[0]}.{seg[1]}." + "_".join(seg[2:])] = code

    calls_by_file: dict[str, set[str]] = {}
    own_gates: dict[str, set[str]] = {}
    imports: dict[str, set[str]] = {}
    registry_gates: dict[str, set[str]] = {}
    call_gates: dict[str, dict[str, set[str]]] = {}

    for dirpath, dirs, files in os.walk(WEB_SRC):
        dirs[:] = [d for d in dirs if d not in ("node_modules", "dist")]
        for name in files:
            if not name.endswith((".tsx", ".ts")):
                continue
            path = os.path.join(dirpath, name)
            rel = os.path.relpath(path, ROOT)
            text = open(path, encoding="utf-8", errors="replace").read()

            calls_by_file[rel] = set(RE_CALL.findall(text))
            gates: set[str] = set()
            for gm in RE_GATE.finditer(text):
                for acc in RE_P_ACCESSOR.findall(gm.group(1)):
                    if code := by_code.get(acc):
                        gates.add(code)
                for lit in re.findall(r'"([a-z0-9_.]+)"', gm.group(1)):
                    if lit in known_codes:
                        gates.add(lit)
            tables = {m.group(1): m.group(2) for m in RE_TABLE.finditer(text)}
            for expr in RE_PERMISSION_GATE.findall(text):
                source = expr
                ident = re.match(r"\s*(\w+)", expr)
                if ident and ident.group(1) in tables:
                    source = tables[ident.group(1)]
                for lit in re.findall(r'"([a-z0-9_.]+)"', source):
                    if lit in known_codes:
                        gates.add(lit)

            for code, method in RE_CALL_GATE.findall(text):
                if code in known_codes:
                    call_gates.setdefault(rel, {}).setdefault(method, set()).add(code)

            own_gates[rel] = gates

            targets: set[str] = set()
            by_ident: dict[str, str] = {}
            for clause, spec in RE_IMPORT.findall(text):
                base = (
                    os.path.normpath(os.path.join(WEB_SRC, spec[2:]))
                    if spec.startswith("@/")
                    else os.path.normpath(os.path.join(dirpath, spec))
                )
                for ext in (".tsx", ".ts", "/index.tsx", "/index.ts"):
                    cand = base + ext
                    if os.path.isfile(cand):
                        target = os.path.relpath(cand, ROOT)
                        targets.add(target)
                        for ident in re.findall(r"\w+", clause):
                            by_ident[ident] = target
                        break
            imports[rel] = targets

            for a_codes, a_ident, b_ident, b_codes in RE_REGISTRY.findall(text):
                ident = a_ident or b_ident
                target = by_ident.get(ident)
                if not target:
                    continue
                codes = {
                    c for c in re.findall(r'"([a-z0-9_.]+)"', a_codes or b_codes)
                    if c in known_codes
                }
                if codes:
                    registry_gates.setdefault(target, set()).update(codes)

    for target, codes in registry_gates.items():
        own_gates.setdefault(target, set()).update(codes)

    gates = effective_gates(own_gates, imports)
    return {
        f: (c, gates.get(f, set()), call_gates.get(f, {}))
        for f, c in calls_by_file.items()
        if c and f.startswith(os.path.join("apps", "web", "src", "pages"))
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--detail", action="store_true")
    ap.add_argument("--limit", type=int, default=20)
    args = ap.parse_args()

    paths = catalogue()
    known = set(paths.values())
    methods = method_to_path()
    perms_by_path = route_to_permissions(paths)
    pages = page_facts(known)

    ungated: list[tuple[str, str, str]] = []
    resolved = 0
    for page, (calls, gates, per_call) in sorted(pages.items()):
        for call in sorted(calls):
            path = methods.get(call)
            if path is None:
                continue
            required = perms_by_path.get(path)
            if not required:
                continue
            resolved += 1
            # A page satisfies a call if it gates on ANY code that call accepts —
            # handlers commonly take `require_any_permission`, so demanding all of
            # them would report a page that is correctly gated.
            if not (required & (gates | per_call.get(call, set()))):
                ungated.append((page, call, ", ".join(sorted(required))))

    print(f"pages with API calls : {len(pages)}")
    print(f"calls resolved to a permission : {resolved}")
    print(f"\n  calls whose page gates on none of the required codes : {len(ungated)}")

    if args.detail:
        by_page: dict[str, list[tuple[str, str]]] = defaultdict(list)
        for page, call, required in ungated:
            by_page[page].append((call, required))
        # Worst first, not alphabetical. Sorted by name with a limit, `--detail`
        # showed twenty `admin/*` pages and silently withheld the file with the
        # most findings — a cap that reads as "that is all of them".
        ranked = sorted(by_page.items(), key=lambda kv: (-len(kv[1]), kv[0]))
        for page, items in ranked[: args.limit]:
            print(f"\n  {page}")
            for call, required in items:
                print(f"      {call}  needs one of  {required}")
        if len(ranked) > args.limit:
            withheld = sum(len(i) for _, i in ranked[args.limit :])
            print(
                f"\n  ... {len(ranked) - args.limit} further page(s), "
                f"{withheld} finding(s), not shown (--limit)"
            )
    else:
        worst = defaultdict(int)
        for page, _, _ in ungated:
            worst[page] += 1
        for page, n in sorted(worst.items(), key=lambda kv: -kv[1])[:10]:
            print(f"    {n:>3}  {page}")
        print("\n  `--detail` for the calls.")

    print(
        "\nA page that calls an endpoint requiring P and gates on none of P offers a\n"
        "control the server will refuse — the 403 arrives after the form is filled in.\n"
        "Reporting only: a page may legitimately gate its screen on the narrowest read\n"
        "and gate stricter controls individually, which this cannot see."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
