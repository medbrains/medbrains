#!/usr/bin/env python3
"""Every PHI list route must be covered by the audit middleware.

    python3 scripts/check_phi_audit_coverage.py

`audit_layer` records three kinds of request: state changes, GETs on a detail
route (any path ending in a UUID), and GETs on a PHI *list* route. The third is
decided by `PHI_LIST_PREFIXES` — a hand-maintained allowlist in
`crates/medbrains-server-core/src/middleware/audit.rs`.

Hand-maintained allowlists fall behind. This one had eight entries and did not
include `/api/sensitive-patients`, so `GET /api/sensitive-patients/{uuid}` was
audited (it ends in a UUID) while `GET /api/sensitive-patients` — the whole
register of VIP and restricted patients, with the reason each was flagged — was
not. The detail read of one protected patient left a trail; enumerating all of
them left none.

That is the failure worth preventing: not a missing check, but a list of routes
that stopped matching the routes that exist.

A route counts as a PHI list here when its handler is a `list_*`/`search_*`
that touches patient data and its path has no trailing `{id}` — i.e. exactly
the shape `path_is_detail_route` will not catch.
"""

from __future__ import annotations

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CRATES = os.path.join(ROOT, "crates")
AUDIT = os.path.join(CRATES, "medbrains-server-core/src/middleware/audit.rs")

ROUTE = re.compile(r'\.route\(\s*"([^"]+)"\s*,\s*((?:[a-z]+\([a-z_0-9]+\)\.?)+)', re.S)
VERB = re.compile(r"([a-z]+)\(([a-z_0-9]+)\)")
HANDLER = re.compile(r"^pub async fn (\w+)\s*\(", re.M)
PHI = re.compile(
    r"\bpatient_id\b|FROM patients|FROM encounters|FROM admissions|"
    r"FROM prescriptions|FROM diagnoses|FROM vitals"
)

# Reviewed and deliberately excluded, with the reason.
ACCEPTED: dict[str, str] = {}


def covered_prefixes() -> list[str]:
    with open(AUDIT, encoding="utf-8") as handle:
        text = handle.read()
    block = re.search(r"PHI_LIST_PREFIXES[^=]*=\s*&\[(.*?)\];", text, re.S)
    if not block:
        raise SystemExit("could not find PHI_LIST_PREFIXES — has audit.rs been restructured?")
    return re.findall(r'"([^"]+)"', block.group(1))


def phi_list_routes() -> list[tuple[str, str, str]]:
    """(path, handler, crate) for GET list routes whose handler touches PHI."""
    found = []
    for dirpath, dirs, files in os.walk(CRATES):
        dirs[:] = [d for d in dirs if d != "target"]
        for name in files:
            if not name.endswith(".rs"):
                continue
            path = os.path.join(dirpath, name)
            try:
                text = open(path, encoding="utf-8", errors="replace").read()
            except OSError:
                continue
            if "pub fn router" not in text:
                continue
            crate = os.path.relpath(path, CRATES).split(os.sep)[0]

            bodies = {}
            marks = [(m.group(1), m.start()) for m in HANDLER.finditer(text)]
            for i, (hname, start) in enumerate(marks):
                end = marks[i + 1][1] if i + 1 < len(marks) else len(text)
                bodies[hname] = text[start:end]

            for m in ROUTE.finditer(text[text.index("pub fn router"):]):
                route_path, spec = m.group(1), m.group(2)
                # a trailing {param} is a detail route; the middleware sees those
                if route_path.rstrip("/").endswith("}"):
                    continue
                for verb, hname in VERB.findall(spec):
                    if verb != "get":
                        continue
                    body = bodies.get(hname, "")
                    if PHI.search(body):
                        found.append((route_path, hname, crate))
    return found


def main() -> int:
    prefixes = covered_prefixes()
    routes = phi_list_routes()
    uncovered = [
        (p, h, c)
        for p, h, c in routes
        if not any(p.startswith(prefix) for prefix in prefixes) and p not in ACCEPTED
    ]

    print(f"PHI list routes: {len(routes)}   audit prefixes: {len(prefixes)}")

    if not uncovered:
        print("\n✓ every PHI list route is covered by the audit middleware.")
        return 0

    print(f"\n{len(uncovered)} PHI list route(s) the audit middleware does not record:\n")
    for route_path, handler, crate in sorted(uncovered):
        print(f"   {route_path}")
        print(f"      {crate} :: {handler}")
    print(
        "\nAdd a covering prefix to PHI_LIST_PREFIXES in\n"
        "crates/medbrains-server-core/src/middleware/audit.rs, or add the route to\n"
        "ACCEPTED in this script with the reason it need not be audited.\n"
        "Note the asymmetry these produce: the detail route of one record is\n"
        "audited automatically, while listing every record of the same kind is not."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
