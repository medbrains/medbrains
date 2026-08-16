#!/usr/bin/env python3
"""Join every layer of authorization into one manifest.

    python3 scripts/generate_authz_manifest.py            # write docs/authz-manifest.json
    python3 scripts/generate_authz_manifest.py --report    # coverage summary only

## Why a join rather than a new file

Every layer already exists somewhere:

    entities + actions + relations   infra/spicedb/schema.zed
    permission codes                 crates/medbrains-core/src/permissions.rs
    api -> permission                docs/openapi.json  (generated from the router)
    role -> permissions              crates/medbrains-core/src/access/roles.rs
    ui page -> api method            apps/web/src/pages/**/*.tsx
    api method -> path               packages/api/src/client.ts
    permission label/description     packages/types/src/permissions.ts

What has never existed is the join. Nobody can answer "who can reach this
endpoint, from which screen, and does it check the record or only the role"
without opening six files, which is why three patient-safety endpoints sat
behind `admin.roles.list` and 105 permissions cannot be granted from the UI.

Authoring this by hand would be a seventh copy to drift. Deriving it means it
is answerable on every run, and wrong only where the sources are wrong — which
is itself the finding.

## The one thing that is NOT derivable

`permission -> (entity, action)`, the bridge between the RBAC code
(`patients.view`) and the ReBAC permission (`patient#view`). Nothing in the
tree states it. It is inferred here by name and reported as an inference, never
as fact — see `entity_action_confidence`.
"""

from __future__ import annotations

import argparse
import collections
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "authz-manifest.json")


def spicedb_entities() -> dict[str, list[str]]:
    """`entity -> [actions]` from the Zanzibar schema."""
    path = os.path.join(ROOT, "infra/spicedb/schema.zed")
    if not os.path.exists(path):
        return {}
    text = open(path, encoding="utf-8").read()
    out: dict[str, list[str]] = {}
    for block in re.finditer(r"definition\s+([a-z_]+)\s*\{(.*?)\n\}", text, re.S):
        name, body = block.group(1), block.group(2)
        out[name] = re.findall(r"permission\s+([a-z_]+)\s*=", body)
    return out


def api_methods() -> dict[str, str]:
    """`clientMethodName -> "/path"` from the TypeScript client."""
    path = os.path.join(ROOT, "packages/api/src/client.ts")
    text = open(path, encoding="utf-8").read()
    out: dict[str, str] = {}
    # `listApiKeys: () => request<T>("/admin/api-keys")` and template forms.
    for match in re.finditer(
        r"(\w+)\s*:\s*\([^)]*\)\s*=>\s*(?:\{[^}]*?)?request<[^>]*>\(\s*[`\"]([^`\"]+)", text
    ):
        out.setdefault(match.group(1), "/api" + match.group(2).split("?")[0])
    return out


def pages_using_methods(methods: set[str]) -> dict[str, list[str]]:
    """`methodName -> [page files]` — which screen triggers which call."""
    out: dict[str, list[str]] = collections.defaultdict(list)
    pages_root = os.path.join(ROOT, "apps/web/src/pages")
    for dirpath, _dirs, files in os.walk(pages_root):
        for name in files:
            if not name.endswith((".tsx", ".ts")):
                continue
            full = os.path.join(dirpath, name)
            try:
                text = open(full, encoding="utf-8", errors="replace").read()
            except OSError:
                continue
            relative = os.path.relpath(full, ROOT)
            for method in re.findall(r"\bapi\.(\w+)\s*\(", text):
                if method in methods:
                    out[method].append(relative)
            # Services indirect one hop: `xService.foo` wrapping `api.foo`.
            for method in re.findall(r"\b\w+Service\.(\w+)\s*\(", text):
                if method in methods:
                    out[method].append(relative)
    return {k: sorted(set(v)) for k, v in out.items()}


def role_permissions() -> dict[str, list[str]]:
    """`role code -> [permission constants]`, parsed from the Rust definitions."""
    path = os.path.join(ROOT, "crates/medbrains-core/src/access/roles.rs")
    text = open(path, encoding="utf-8").read()
    constants = permission_constants()
    out: dict[str, list[str]] = {}
    # Each role is a struct literal with `code: "nurse"` and a permissions list.
    for block in re.finditer(r'code:\s*"([a-z_]+)"(.*?)\n\s*\},', text, re.S):
        code, body = block.group(1), block.group(2)
        codes = [
            constants[ref]
            for ref in re.findall(r"permissions::([a-z_:]+::[A-Z_0-9]+)", body)
            if ref in constants
        ]
        if codes:
            out[code] = sorted(set(codes))
    return out


def permission_constants() -> dict[str, str]:
    """`rust::path::CONST -> "dotted.code"`."""
    path = os.path.join(ROOT, "crates/medbrains-core/src/permissions.rs")
    lines = open(path, encoding="utf-8").read().split("\n")
    stack: list[str] = []
    depth_of: list[int] = []
    depth = 0
    out: dict[str, str] = {}
    module = re.compile(r"pub\s+mod\s+([a-z_0-9]+)")
    constant = re.compile(r'pub\s+const\s+([A-Z_0-9]+)\s*:\s*&str\s*=\s*"([^"]+)"')
    for line in lines:
        if match := module.search(line):
            stack.append(match.group(1))
            depth_of.append(depth)
        if match := constant.search(line):
            out["::".join(stack + [match.group(1)])] = match.group(2)
        depth += line.count("{") - line.count("}")
        while depth_of and depth <= depth_of[-1]:
            stack.pop()
            depth_of.pop()
    return out


def ui_catalogue() -> dict[str, dict]:
    """`code -> {label, description}` — what the admin UI can offer."""
    path = os.path.join(ROOT, "packages/types/src/permissions.ts")
    text = open(path, encoding="utf-8").read()
    out: dict[str, dict] = {}
    for block in re.finditer(
        r'\{\s*code:\s*"([a-z_.]+)",\s*label:\s*"([^"]*)",\s*description:\s*"([^"]*)"', text
    ):
        out[block.group(1)] = {"label": block.group(2), "description": block.group(3)}
    return out


def infer_entity_action(code: str, entities: dict[str, list[str]]) -> tuple[str | None, str | None, str]:
    """Guess the ReBAC (entity, action) a permission corresponds to.

    Inference, not fact — the tree never states it. `patients.view` looks like
    `patient#view`, but `billing.invoices.list` could be `invoice#view` and
    nothing says so. Reported with its confidence so a reader can tell a
    derived link from an asserted one.
    """
    parts = code.split(".")
    action = parts[-1]
    singular = {"patients": "patient", "encounters": "encounter", "invoices": "invoice",
                "admissions": "admission", "orders": "lab_order"}
    for part in reversed(parts[:-1]):
        entity = singular.get(part, part)
        if entity in entities:
            verb = {"list": "view", "view": "view", "create": "edit", "update": "edit",
                    "delete": "delete", "share": "share"}.get(action, action)
            if verb in entities[entity]:
                return entity, verb, "name-match"
    return None, None, "none"


def build() -> dict:
    entities = spicedb_entities()
    methods = api_methods()
    pages = pages_using_methods(set(methods))
    roles = role_permissions()
    constants = permission_constants()
    catalogue = ui_catalogue()

    spec_path = os.path.join(ROOT, "docs/openapi.json")
    spec = json.load(open(spec_path, encoding="utf-8")) if os.path.exists(spec_path) else {"paths": {}}

    # permission -> roles holding it
    holders: dict[str, list[str]] = collections.defaultdict(list)
    for role, codes in roles.items():
        for code in codes:
            holders[code].append(role)

    # path -> client methods that call it
    by_path: dict[str, list[str]] = collections.defaultdict(list)
    for method, path in methods.items():
        by_path[path].append(method)

    operations = []
    for path, verbs in spec["paths"].items():
        for verb, op in verbs.items():
            code = op.get("x-required-permission")
            entity, action, confidence = infer_entity_action(code, entities) if code else (None, None, "none")
            callers = by_path.get(path, [])
            operations.append({
                "method": verb.upper(),
                "path": path,
                "permission": code,
                "permission_label": catalogue.get(code, {}).get("label") if code else None,
                "grantable_in_ui": bool(code and code in catalogue),
                "roles_with_it": sorted(holders.get(code, [])) if code else [],
                "entity": entity,
                "entity_action": action,
                "entity_action_confidence": confidence,
                "ui_methods": sorted(callers),
                "ui_pages": sorted({p for m in callers for p in pages.get(m, [])}),
                "unauthenticated": not op.get("security"),
                "unbuilt": bool(op.get("deprecated")),
            })

    return {
        "entities": entities,
        "roles": roles,
        "permissions": {c: catalogue.get(c, {}) for c in sorted(set(constants.values()))},
        "operations": sorted(operations, key=lambda o: (o["path"], o["method"])),
    }


def report(manifest: dict) -> None:
    ops = [o for o in manifest["operations"] if not o["unbuilt"] and not o["unauthenticated"]]
    total = len(ops)
    def pct(n: int) -> str:
        return f"{n:5} ({100*n//total if total else 0:3}%)"

    print(f"authorization manifest — {total} built, authenticated operations\n")
    print(f"  carry a permission              {pct(sum(1 for o in ops if o['permission']))}")
    print(f"  that permission grantable in UI {pct(sum(1 for o in ops if o['grantable_in_ui']))}")
    print(f"  at least one role holds it      {pct(sum(1 for o in ops if o['roles_with_it']))}")
    print(f"  reachable from a UI page        {pct(sum(1 for o in ops if o['ui_pages']))}")
    print(f"  maps to a ReBAC entity/action   {pct(sum(1 for o in ops if o['entity']))}")
    print(f"\n  entities in the SpiceDB schema  {len(manifest['entities'])}")
    print(f"  roles defined in code           {len(manifest['roles'])}")
    print(f"  permissions declared            {len(manifest['permissions'])}")

    orphan = [o for o in ops if o["permission"] and not o["roles_with_it"]]
    print(f"\n  permissions NO built-in role holds: {len({o['permission'] for o in orphan})}")
    for o in orphan[:6]:
        print(f"     {o['method']:5} {o['path']:44} {o['permission']}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", action="store_true", help="print coverage, do not write")
    args = parser.parse_args()

    manifest = build()
    report(manifest)
    if not args.report:
        os.makedirs(os.path.dirname(OUT), exist_ok=True)
        with open(OUT, "w", encoding="utf-8") as handle:
            json.dump(manifest, handle, indent=2)
            handle.write("\n")
        print(f"\nwrote {os.path.relpath(OUT, ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
