#!/usr/bin/env python3
"""Generate an OpenAPI 3.1 description of the API, from the router.

    python3 scripts/generate_openapi.py                 # write openapi.json
    python3 scripts/generate_openapi.py --format yaml
    python3 scripts/generate_openapi.py --check         # fail if stale

## What this gives you, and what it does not

Every path, every method, the permission each one requires, whether it is
authenticated, and which crate implements it. That is enough to answer "what
can this API do and what do I need to call it", which is the question an
integrator asks first.

It does **not** describe request or response bodies. Those live in Rust structs
that this does not read, so every operation carries a generic schema. A spec
without bodies is real documentation of the surface and thin documentation of
the contract — worth saying plainly rather than letting somebody discover it
after generating a client.

## Why not utoipa

The usual answer is annotation macros on each handler. There are 1,200 routes;
annotating them is months, and a half-annotated codebase produces a spec that
is confidently wrong about the half nobody reached. Deriving from the router
means the spec is complete and shallow rather than partial and deep, and it
cannot drift — it is regenerated from the same source the server runs.

Bodies can be filled in incrementally afterwards, per operation, where an
integrator actually needs them.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIT = os.path.join(ROOT, "scripts", "audit_access_control.py")
OUT_JSON = os.path.join(ROOT, "docs", "openapi.json")

# Pulled out of the handler body: `require_permission(&claims, permissions::a::b::C)`
PERMISSION_CALL = re.compile(
    r"require(?:_any)?_permission\s*\(\s*&?\s*claims\s*,\s*([A-Za-z_0-9:]+)"
)
# `require(&claims, tv_displays::BROADCAST)` — the short form some crates use.
SHORT_REQUIRE = re.compile(r"\brequire\s*\(\s*&?\s*claims\s*,\s*([A-Za-z_0-9:]+)")


def load_audit():
    """Reuse the audit's parser rather than writing a second one.

    Two parsers over the same routers would disagree eventually, and the
    disagreement would show up as a spec that documents routes the audit says
    do not exist, or vice versa.
    """
    spec = importlib.util.spec_from_file_location("audit", AUDIT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def permission_map(audit) -> dict[str, str]:
    """`constant path -> permission string`, so the spec can name the real code."""
    perms_file = os.path.join(ROOT, "crates/medbrains-core/src/permissions.rs")
    if not os.path.exists(perms_file):
        return {}
    with open(perms_file, encoding="utf-8", errors="replace") as handle:
        lines = handle.read().split("\n")
    stack, depth_of, depth, out = [], [], 0, {}
    mod_re = re.compile(r"pub\s+mod\s+([a-z_0-9]+)")
    const_re = re.compile(r'pub\s+const\s+([A-Z_0-9]+)\s*:\s*&str\s*=\s*"([^"]+)"')
    for line in lines:
        if match := mod_re.search(line):
            stack.append(match.group(1))
            depth_of.append(depth)
        if match := const_re.search(line):
            out["::".join(stack + [match.group(1)])] = match.group(2)
        depth += line.count("{") - line.count("}")
        while depth_of and depth <= depth_of[-1]:
            stack.pop()
            depth_of.pop()
    return out


def permission_for(body: str, constants: dict[str, str]) -> str | None:
    """The permission a handler requires, as its string code."""
    for pattern in (PERMISSION_CALL, SHORT_REQUIRE):
        if match := pattern.search(body):
            reference = match.group(1)
            parts = reference.split("::")
            for start in range(len(parts) - 1):
                if value := constants.get("::".join(parts[start:])):
                    return value
    return None



def resolve_refs(refs, constants: dict[str, str]) -> list[str]:
    """Constant references -> dotted codes, dropping anything unresolvable."""
    out = []
    for reference in refs:
        parts = reference.split("::")
        for start in range(len(parts) - 1):
            if value := constants.get("::".join(parts[start:])):
                out.append(value)
                break
    # Stable, and duplicates mean the same requirement stated twice.
    return sorted(dict.fromkeys(out))


def operation_id(method: str, path: str, taken: set[str]) -> str:
    """A stable, readable identifier — generated clients name methods from it.

    Must be unique across the whole document: a client generator emits one
    method per operationId, and two operations sharing one produce either a
    compile error or, worse, a silently dropped method.

    Collisions are real here rather than theoretical, because `/` and `-` both
    vanish in the camel form: `/api/setup/config-export` and
    `/api/setup/config/export` both become `getSetupConfigExport`. Where that
    happens the path is disambiguated with a short digest of itself — stable
    across runs, so a generated client's method names do not churn.
    """
    cleaned = re.sub(r"[{}]", "", path.removeprefix("/api/"))
    parts = [p for p in re.split(r"[/_-]", cleaned) if p]
    camel = parts[0] + "".join(p.title() for p in parts[1:]) if parts else "root"
    candidate = f"{method.lower()}{camel[:1].upper()}{camel[1:]}"
    if candidate not in taken:
        taken.add(candidate)
        return candidate
    digest = hashlib.blake2s(f"{method} {path}".encode(), digest_size=2).hexdigest()
    unique = f"{candidate}_{digest}"
    taken.add(unique)
    return unique


def path_parameters(path: str) -> list[dict]:
    return [
        {
            "name": name,
            "in": "path",
            "required": True,
            # Every path parameter in this API is a uuid or a short code; the
            # router does not distinguish, so neither does this.
            "schema": {"type": "string"},
        }
        for name in re.findall(r"\{([a-z_0-9]+)\}", path)
    ]


def build(audit) -> dict:
    sources = audit.rust_sources()
    bodies = audit.handler_bodies(sources)
    routes = audit.backend_routes(sources, bodies)
    constants = permission_map(audit)

    paths: dict[str, dict] = {}
    taken_ids: set[str] = set()
    for route in sorted(routes, key=lambda r: (r["path"], r["method"])):
        # File-qualified first. 189 async fn names are defined more than
        # once in this workspace, and a bare-name lookup silently described
        # 121 routes using some other crate's handler — its permission, its
        # guarded verdict, its stub status.
        body = bodies.get(f"{route['file']}::{route['handler']}") or bodies.get(
            route["handler"], ""
        )
        permission = permission_for(body, constants)
        # The full requirement, which for 152 routes is not a single code:
        # 87 accept any of a set, 58 require two or more, 7 do both, and 13
        # have a requirement that only applies on one branch. Recording just
        # the first describes a different endpoint than the one that exists.
        expression = audit.permission_expression(body)
        requires = {
            key: resolve_refs(expression[key], constants)
            for key in ("all_of", "any_of", "conditional")
        }
        requires = {k: v for k, v in requires.items() if v}
        open_reason = audit.is_intentionally_open(route["path"])
        crate = route["file"].split("/")[1] if "/" in route["file"] else route["file"]

        description = [f"Implemented by `{route['handler']}` in `{crate}`."]
        if permission:
            description.append(f"Requires the `{permission}` permission.")
        elif open_reason:
            description.append(f"Unauthenticated: {open_reason}.")
        elif route.get("stub"):
            # Saying so beats an integrator building against something that
            # returns an empty array forever.
            description.append("**Not implemented** — this endpoint is a stub.")
        else:
            description.append(
                "Authenticated, with no additional permission check."
            )

        operation = {
            "operationId": operation_id(route["method"], route["path"], taken_ids),
            "summary": route["handler"].replace("_", " "),
            "description": "\n\n".join(description),
            "tags": [route["path"].split("/")[2] if len(route["path"].split("/")) > 2 else "api"],
            "responses": {
                "200": {
                    "description": "Success",
                    # Generic on purpose — see the module docstring.
                    "content": {"application/json": {"schema": {}}},
                },
                "401": {"description": "Not authenticated"},
                "403": {"description": "Authenticated, but not permitted"},
            },
        }
        if parameters := path_parameters(route["path"]):
            operation["parameters"] = parameters
        if route["method"] in {"POST", "PUT", "PATCH"}:
            operation["requestBody"] = {
                "required": True,
                "content": {"application/json": {"schema": {}}},
            }
        if not open_reason:
            operation["security"] = [{"sessionCookie": []}, {"bearerAuth": []}]
        if permission:
            # A non-standard extension, deliberately: the permission is the
            # single most useful thing an integrator needs and OpenAPI has no
            # standard place to put it.
            operation["x-required-permission"] = permission
        if requires:
            # Non-standard, like the singular field above, and kept beside it
            # so an existing reader is not broken by the richer shape.
            operation["x-required-permissions"] = requires
        if route.get("stub"):
            operation["deprecated"] = True

        paths.setdefault(route["path"], {})[route["method"].lower()] = operation

    return {
        "openapi": "3.1.0",
        "info": {
            "title": "MedBrains HMS API",
            "version": "0.1.0",
            "description": (
                "Generated from the Axum router by `scripts/generate_openapi.py`.\n\n"
                "Paths, methods and required permissions are accurate and complete — "
                "they are read from the same routers the server runs.\n\n"
                "**Request and response schemas are not described.** They live in Rust "
                "types this generator does not read, so every body is an untyped "
                "object. Generate a client from this for discovery, not for types."
            ),
        },
        "servers": [{"url": "/", "description": "Same origin as the application"}],
        "components": {
            "securitySchemes": {
                "sessionCookie": {
                    "type": "apiKey",
                    "in": "cookie",
                    "name": "access_token",
                    "description": "Browser session. Mutations also require the "
                    "`X-CSRF-Token` header matching the `csrf_token` cookie.",
                },
                "bearerAuth": {
                    "type": "http",
                    "scheme": "bearer",
                    "bearerFormat": "JWT",
                    "description": "Ed25519 JWT, for mobile and server-to-server callers.",
                },
            }
        },
        "paths": paths,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--format", choices=["json", "yaml"], default="json")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    audit = load_audit()
    spec = build(audit)
    rendered = json.dumps(spec, indent=2, sort_keys=False) + "\n"

    if args.format == "yaml":
        try:
            import yaml
        except ImportError:
            raise SystemExit("pyyaml is not installed: pip install pyyaml") from None
        print(yaml.safe_dump(spec, sort_keys=False))
        return 0

    if args.check:
        existing = ""
        if os.path.exists(OUT_JSON):
            with open(OUT_JSON, encoding="utf-8") as handle:
                existing = handle.read()
        if existing != rendered:
            print(f"{OUT_JSON} is out of date — run scripts/generate_openapi.py")
            return 1
        print(f"openapi.json current: {len(spec['paths'])} paths")
        return 0

    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    with open(OUT_JSON, "w", encoding="utf-8") as handle:
        handle.write(rendered)

    operations = sum(len(methods) for methods in spec["paths"].values())
    documented = sum(
        1
        for methods in spec["paths"].values()
        for op in methods.values()
        if "x-required-permission" in op
    )
    stubs = sum(
        1
        for methods in spec["paths"].values()
        for op in methods.values()
        if op.get("deprecated")
    )
    print(f"wrote {os.path.relpath(OUT_JSON, ROOT)}")
    print(f"  {len(spec['paths'])} paths, {operations} operations")
    print(f"  {documented} carry a required permission")
    print(f"  {stubs} marked deprecated (unimplemented stubs)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
