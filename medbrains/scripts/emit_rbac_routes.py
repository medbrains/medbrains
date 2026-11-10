#!/usr/bin/env python3
"""Emit every guarded API route with the permission codes its handler requires.

Input to `apps/web/scripts/generate-api-rbac-deny.mjs`, which turns each
route into one Playwright case: call it as a role that holds none of the
codes and expect the permission refusal. The route → permission parse is the
access-control audit's (`audit_access_control.py`), the only parser here that
resolves handlers registered in one file and defined in another.

Left out, each with its reason counted on stderr: routes that are open by
design (webhooks, public, login), routes accepted without a permission,
stubs, handlers the parser cannot find, the patient portal (a different
auth stack), and routes whose only permission checks sit inside branches —
a role lacking those may still reach the handler.

Usage: python3 scripts/emit_rbac_routes.py apps/web/e2e/generated/rbac-routes.json
"""

from __future__ import annotations

import json
import os
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import audit_access_control as audit  # noqa: E402
import generate_openapi as openapi  # noqa: E402

SKIP_PREFIXES = ("/api/portal/", "/ws")


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__, file=sys.stderr)
        return 2
    out_path = sys.argv[1]
    sources = audit.rust_sources()
    bodies = audit.handler_bodies(sources)
    constants = openapi.permission_map(None)
    reasons: Counter[str] = Counter()
    routes: list[dict] = []
    for route in audit.backend_routes(sources, bodies):
        method, path = route["method"], route["path"]
        if path.startswith(SKIP_PREFIXES):
            reasons["portal or websocket"] += 1
            continue
        if audit.is_intentionally_open(path, method):
            reasons["open by design"] += 1
            continue
        if not route["found"]:
            reasons["handler not found"] += 1
            continue
        if route["stub"]:
            reasons["stub"] += 1
            continue
        body = bodies.get(f"{route['file']}::{route['handler']}") or bodies.get(route["handler"], "")
        expression = audit.permission_expression(body)
        all_of = openapi.resolve_refs(expression["all_of"], constants)
        any_of = openapi.resolve_refs(expression["any_of"], constants)
        conditional = openapi.resolve_refs(expression["conditional"], constants)
        if not all_of and not any_of:
            reasons["no unconditional permission"] += 1
            continue
        routes.append(
            {
                "method": method,
                "path": path,
                # A denier must lack every code, branches included.
                "codes": sorted(set(all_of) | set(any_of) | set(conditional)),
            }
        )
    routes.sort(key=lambda r: (r["path"], r["method"]))
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as handle:
        json.dump(routes, handle, indent=1)
        handle.write("\n")
    skipped = ", ".join(f"{k} {v}" for k, v in sorted(reasons.items()))
    print(f"guarded routes: {len(routes)} → {out_path}  (skipped: {skipped})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
