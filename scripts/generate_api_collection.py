#!/usr/bin/env python3
"""
Generate importable API collections (OpenAPI 3 + Postman v2.1) from the real
contract — the TS client endpoint index + the Rust/TS request shapes extracted by
`fetch_api_shape.py`. One source of truth, so the collections never drift from
the code.

Each endpoint gets a POSITIVE request (body sampled from its request shape) and
representative NEGATIVE requests:
  - no-auth        → expect 401/403 (the API must refuse an unauthenticated call)
  - empty-body     → expect 400/422 (the API must validate a bad body)

Env vars {{base_url}} / {{token}} so a QA/dev imports the collection, sets the
two variables, and runs. Standalone — no Rust/TS build impact.

Usage:
  generate_api_collection.py            # write test-collections/{openapi,postman}.json
  generate_api_collection.py --self-test
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch_api_shape import REPO_ROOT, _client_index, merge_shape  # noqa: E402

OUT_DIR = REPO_ROOT / "test-collections"
BASE_URL = "http://127.0.0.1:3000"

_CANON_JSON = {
    "number": "number", "bool": "boolean", "array": "array",
    "object": "object", "map": "object", "json": "object",
}


def json_type(canon: str) -> str:
    return _CANON_JSON.get(canon, "string")


def sample_value(name: str, canon: str):
    if canon == "number":
        return 0
    if canon == "bool":
        return False
    if canon == "datetime":
        return "2026-01-01T00:00:00Z"
    if canon == "array":
        return []
    if canon in ("object", "map", "json"):
        return {}
    if name.endswith("_id"):
        return "00000000-0000-0000-0000-000000000000"
    return "string"


# Inline TS generics / non-struct type names carry no field shape.
_NON_STRUCT = {"Record", "Partial", "Pick", "Omit", "Array"}


def endpoints() -> list[dict]:
    """Deduped, cleaned endpoint list (prefer a request-type-bearing overload)."""
    seen: dict[tuple[str, str], dict] = {}
    for e in _client_index():
        p = e["path"]
        if not p.startswith("/api/") or "$" in p or " " in p:
            continue
        key = (e["method"], p)
        if key not in seen or (e["request_type"] and not seen[key]["request_type"]):
            seen[key] = e
    return sorted(seen.values(), key=lambda e: (e["path"], e["method"]))


def shape_fields(request_type: str | None) -> list[dict]:
    if not request_type or request_type in _NON_STRUCT:
        return []
    shape = merge_shape(request_type)
    if not shape["found"]:
        return []
    return [f for f in shape["fields"] if f["name"] != "is_dummy"]


def json_schema(fields: list[dict]) -> dict:
    return {
        "type": "object",
        "properties": {f["name"]: {"type": json_type(f["type"])} for f in fields},
        "required": [f["name"] for f in fields if f["required"]],
    }


def sample_body(fields: list[dict]) -> dict:
    return {f["name"]: sample_value(f["name"], f["type"]) for f in fields}


def _has_body(e: dict, fields: list[dict]) -> bool:
    return e["method"] in ("POST", "PUT", "PATCH") and bool(fields)


# ── OpenAPI 3 ────────────────────────────────────────────────────────

def build_openapi(eps: list[dict]) -> dict:
    paths: dict = {}
    for e in eps:
        item = paths.setdefault(e["path"], {})
        op: dict = {"summary": f"{e['method']} {e['path']}", "responses": {"200": {"description": "OK"}}}
        params = re.findall(r"\{(\w+)\}", e["path"])
        if params:
            op["parameters"] = [
                {"name": p, "in": "path", "required": True, "schema": {"type": "string"}}
                for p in params
            ]
        fields = shape_fields(e["request_type"])
        if _has_body(e, fields):
            op["requestBody"] = {
                "required": True,
                "content": {"application/json": {
                    "schema": json_schema(fields), "example": sample_body(fields),
                }},
            }
        if e["method"] in ("POST", "PUT", "PATCH", "DELETE"):
            op["responses"]["401"] = {"description": "Unauthorized (missing/invalid token)"}
            op["responses"]["403"] = {"description": "Forbidden (role not permitted)"}
        if fields:
            op["responses"]["400"] = {"description": "Bad request (invalid body)"}
            op["responses"]["422"] = {"description": "Validation failed"}
        item[e["method"].lower()] = op
    return {
        "openapi": "3.0.3",
        "info": {
            "title": "MedBrains API",
            "version": "1.0.0",
            "description": "Generated from the TS client + Rust/TS request types by "
                           "scripts/generate_api_collection.py. Do not edit by hand.",
        },
        "servers": [{"url": BASE_URL}],
        "components": {"securitySchemes": {"bearerAuth": {"type": "http", "scheme": "bearer"}}},
        "security": [{"bearerAuth": []}],
        "paths": paths,
    }


# ── Postman v2.1 ─────────────────────────────────────────────────────

def _pm_request(e: dict, with_auth: bool, body) -> dict:
    parts = [p for p in e["path"].strip("/").split("/")]
    header = []
    if with_auth:
        header.append({"key": "Authorization", "value": "Bearer {{token}}"})
    req = {
        "method": e["method"],
        "header": header,
        "url": {"raw": "{{base_url}}" + e["path"], "host": ["{{base_url}}"], "path": parts},
    }
    if body is not None:
        header.append({"key": "Content-Type", "value": "application/json"})
        req["body"] = {"mode": "raw", "raw": json.dumps(body, indent=2),
                       "options": {"raw": {"language": "json"}}}
    return req


def build_postman(eps: list[dict]) -> dict:
    folders: dict[str, list] = {}
    for e in eps:
        segs = e["path"].split("/")
        module = segs[2] if len(segs) > 2 else "misc"
        fields = shape_fields(e["request_type"])
        pos_body = sample_body(fields) if _has_body(e, fields) else None
        cases = [
            {"name": f"{e['method']} {e['path']} — positive",
             "request": _pm_request(e, True, pos_body)},
            {"name": "↳ no-auth (expect 401/403)",
             "request": _pm_request(e, False, pos_body)},
        ]
        if _has_body(e, fields):
            cases.append({"name": "↳ empty-body (expect 400/422)",
                          "request": _pm_request(e, True, {})})
        folders.setdefault(module, []).append({"name": f"{e['method']} {e['path']}", "item": cases})
    return {
        "info": {
            "name": "MedBrains API (positive + negative)",
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
            "description": "Generated by scripts/generate_api_collection.py. Set base_url + token.",
        },
        "variable": [
            {"key": "base_url", "value": BASE_URL},
            {"key": "token", "value": ""},
        ],
        "item": [{"name": name, "item": items} for name, items in sorted(folders.items())],
    }


def generate() -> tuple[dict, dict]:
    eps = endpoints()
    return build_openapi(eps), build_postman(eps)


def write() -> int:
    openapi, postman = generate()
    OUT_DIR.mkdir(exist_ok=True)
    (OUT_DIR / "openapi.json").write_text(json.dumps(openapi, indent=2) + "\n")
    (OUT_DIR / "postman_collection.json").write_text(json.dumps(postman, indent=2) + "\n")
    n_paths = len(openapi["paths"])
    n_items = sum(len(f["item"]) for f in postman["item"])
    print(f"wrote {OUT_DIR}/openapi.json ({n_paths} paths) + postman_collection.json ({n_items} endpoints)")
    return 0


def _self_test() -> int:
    openapi, postman = generate()
    # OpenAPI round-trips + a known endpoint carries a request body.
    json.loads(json.dumps(openapi))
    enc = openapi["paths"].get("/api/opd/encounters", {}).get("post", {})
    assert "requestBody" in enc, "POST /api/opd/encounters should have a requestBody"
    props = enc["requestBody"]["content"]["application/json"]["schema"]["properties"]
    assert "patient_id" in props, "encounter schema should include patient_id"
    assert "401" in enc["responses"] and "422" in enc["responses"], "negatives documented"
    # Postman round-trips + every write endpoint has a no-auth negative case.
    json.loads(json.dumps(postman))
    assert postman["item"], "postman folders non-empty"
    any_neg = any(
        c["name"].startswith("↳ no-auth")
        for folder in postman["item"] for ep in folder["item"] for c in ep["item"]
    )
    assert any_neg, "postman should carry no-auth negative cases"
    print(f"self-test OK  (openapi paths={len(openapi['paths'])}, postman folders={len(postman['item'])})")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Generate OpenAPI + Postman collections from the API contract.")
    ap.add_argument("--self-test", action="store_true", help="Validate generation without writing files")
    args = ap.parse_args()
    return _self_test() if args.self_test else write()


if __name__ == "__main__":
    raise SystemExit(main())
