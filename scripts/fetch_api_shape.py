#!/usr/bin/env python3
"""
API shape fetcher — on-demand, source-parsed from BOTH Rust and TypeScript.

Given a request/response TYPE name (or an ENDPOINT), extract that one type's
field shape from the two sources of truth and cross-check them:

  - Rust:       `pub struct <Name> { pub field: Option<T>, ... }`  (crates/**)
  - TypeScript: `export interface <Name> { field?: T; ... }`       (packages/types/**)

The same type name appears in the Rust handler (`Json<CreateEncounterRequest>`),
the TS client method (`request<...>("/opd/encounters", {method:"POST"})` with a
`data: CreateEncounterRequest` arg), and `packages/types`, so one name resolves
both sources. Lazy by design: parse only the requested type — no giant
precomputed per-endpoint file. The AI simulator fetches the shapes for the tools
it uses; the collection generator loops this over every endpoint when it needs
the full set.

Usage:
  fetch_api_shape.py --type CreateEncounterRequest [--json]
  fetch_api_shape.py --endpoint "POST /opd/encounters" [--json]
  fetch_api_shape.py --list-endpoints          # (method, path, request_type) index

Exit 0 on a resolved shape, 2 when the type/endpoint can't be found.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
CRATES = REPO_ROOT / "medbrains" / "crates"
TS_TYPES = REPO_ROOT / "medbrains" / "packages" / "types" / "src"
CLIENT_TS = REPO_ROOT / "medbrains" / "packages" / "api" / "src" / "client.ts"

# Canonical type buckets so a Rust type and a TS type can be compared even
# though they spell things differently (Uuid↔string, i64↔number, …).
_CANON = [
    (re.compile(r"^(Uuid|String|str|&str)$"), "string"),
    (re.compile(r"^(i8|i16|i32|i64|u8|u16|u32|u64|usize|isize|f32|f64|Decimal)$"), "number"),
    (re.compile(r"^bool$"), "bool"),
    (re.compile(r"^(NaiveDate|NaiveDateTime|DateTime<.*>|NaiveTime)$"), "datetime"),
    (re.compile(r"^(serde_json::Value|Value|JsonValue)$"), "json"),
    (re.compile(r"^Vec<"), "array"),
    (re.compile(r"^(HashMap|BTreeMap)<"), "map"),
    # TS side
    (re.compile(r"^string$"), "string"),
    (re.compile(r"^number$"), "number"),
    (re.compile(r"^boolean$"), "bool"),
    (re.compile(r".*\[\]$"), "array"),
    (re.compile(r"^Record<"), "map"),
]


def canon(t: str) -> str:
    t = t.strip()
    for rx, bucket in _CANON:
        if rx.match(t):
            return bucket
    return "object"  # a named struct/interface (nested)


def _rg_files(pattern: str, root: Path) -> list[Path]:
    """List files containing `pattern` (fixed-ish regex) under `root`."""
    try:
        out = subprocess.run(
            ["rg", "-l", pattern, str(root)],
            capture_output=True, text=True, timeout=30,
        )
    except (OSError, subprocess.SubprocessError):
        return []
    return [Path(p) for p in out.stdout.splitlines() if p.strip()]


# ── Rust struct parsing ──────────────────────────────────────────────

_RUST_FIELD = re.compile(r"^\s+pub\s+(\w+)\s*:\s*(.+?)\s*,?\s*$")


def find_rust_struct(name: str) -> dict | None:
    """Return {field: {"type", "required"}} from `pub struct <name> {}`, or None."""
    for f in _rg_files(rf"pub struct {re.escape(name)}\b", CRATES):
        fields = _parse_rust_struct_in_file(f, name)
        if fields is not None:
            return {"source": str(f.relative_to(REPO_ROOT)), "fields": fields}
    return None


def _parse_rust_struct_in_file(path: Path, name: str) -> dict | None:
    try:
        lines = path.read_text().split("\n")
    except (OSError, UnicodeDecodeError):
        return None
    open_rx = re.compile(rf"^pub struct {re.escape(name)}\b.*\{{\s*$")
    i = 0
    while i < len(lines):
        if open_rx.match(lines[i].strip()) or open_rx.match(lines[i]):
            fields: dict = {}
            depth, i = 1, i + 1
            while i < len(lines) and depth > 0:
                line = lines[i]
                depth += line.count("{") - line.count("}")
                if depth <= 0:
                    break
                m = _RUST_FIELD.match(line)
                if m and not line.lstrip().startswith(("//", "#")):
                    fname, ftype = m.group(1), m.group(2).rstrip(",").strip()
                    optional = False
                    opt = re.match(r"Option<(.+)>$", ftype)
                    if opt:
                        optional, ftype = True, opt.group(1)
                    fields[fname] = {"type": ftype, "canon": canon(ftype),
                                     "required": not optional}
                i += 1
            return fields
        i += 1
    return None


# ── TypeScript interface parsing ─────────────────────────────────────

_TS_FIELD = re.compile(r"^\s*(\w+)(\??)\s*:\s*(.+?);?\s*$")


def find_ts_interface(name: str) -> dict | None:
    for f in _rg_files(rf"(interface|type) {re.escape(name)}\b", TS_TYPES):
        fields = _parse_ts_interface_in_file(f, name)
        if fields is not None:
            return {"source": str(f.relative_to(REPO_ROOT)), "fields": fields}
    return None


def _parse_ts_interface_in_file(path: Path, name: str) -> dict | None:
    try:
        lines = path.read_text().split("\n")
    except (OSError, UnicodeDecodeError):
        return None
    open_rx = re.compile(rf"^export interface {re.escape(name)}\b.*\{{\s*$")
    i = 0
    while i < len(lines):
        if open_rx.match(lines[i]):
            fields: dict = {}
            depth, i = 1, i + 1
            while i < len(lines) and depth > 0:
                line = lines[i]
                depth += line.count("{") - line.count("}")
                if depth <= 0:
                    break
                m = _TS_FIELD.match(line)
                if m and not line.lstrip().startswith(("//", "/*", "*")):
                    fname, opt, ftype = m.group(1), m.group(2), m.group(3).strip()
                    # `?` OR a `| null` union both mean not-required.
                    optional = bool(opt) or "null" in ftype
                    base = ftype.replace("| null", "").replace("|null", "").strip()
                    fields[fname] = {"type": ftype, "canon": canon(base),
                                     "required": not optional}
                i += 1
            return fields
        i += 1
    return None


# ── Endpoint → request-type resolver (from client.ts) ────────────────

def _client_index() -> list[dict]:
    """Parse client.ts → [{method, path, request_type, response_type}]."""
    try:
        src = CLIENT_TS.read_text()
    except OSError:
        return []
    out: list[dict] = []
    # methodName: (…data: ReqType…) => request<RespType>("path"|`path`, { method: "X" ... })
    method_rx = re.compile(
        r"(\w+):\s*\(([^)]*)\)\s*=>\s*\n?\s*request<([^>]*)>\(\s*[`\"']([^`\"']+)[`\"']",
        re.MULTILINE,
    )
    http_rx = re.compile(r'method:\s*"(GET|POST|PUT|DELETE|PATCH)"')
    for m in method_rx.finditer(src):
        args, resp, raw_path = m.group(2), m.group(3).strip(), m.group(4)
        # request type = the type of a `data:`/`body:` arg, if any
        dm = re.search(r"\b(?:data|body|payload)\s*:\s*([A-Za-z_]\w*)", args)
        req_type = dm.group(1) if dm else None
        # HTTP method lives in this call's options object. Bound the scan to the
        # current method — the next `=>` belongs to the following method — so a
        # GET with no options doesn't borrow the next method's `method: "POST"`.
        rest = src[m.end():]
        nxt = rest.find("=>")
        tail = rest[: nxt if nxt != -1 else 200]
        hm = http_rx.search(tail)
        http = hm.group(1) if hm else "GET"
        path = re.sub(r"\$\{[^}]*\}", "{param}", raw_path).split("?")[0].rstrip("/")
        if not path.startswith("/api"):
            path = "/api" + path if path.startswith("/") else path
        out.append({"method": http, "path": path,
                    "request_type": req_type, "response_type": resp})
    return out


def resolve_endpoint(method: str, path: str) -> dict | None:
    method = method.upper()
    norm = re.sub(r"\$\{[^}]*\}|\{[^}]*\}", "{param}", path).split("?")[0].rstrip("/")
    if not norm.startswith("/api"):
        norm = ("/api" + norm) if norm.startswith("/") else norm
    matches = [e for e in _client_index() if e["method"] == method and e["path"] == norm]
    if not matches:
        return None
    # Prefer a match that actually carries a request type (a bodyless overload
    # of the same path may also match).
    return next((e for e in matches if e["request_type"]), matches[0])


# ── Merge + cross-check ──────────────────────────────────────────────

def merge_shape(type_name: str) -> dict:
    rust = find_rust_struct(type_name)
    ts = find_ts_interface(type_name)
    r_fields = rust["fields"] if rust else {}
    t_fields = ts["fields"] if ts else {}
    names = sorted(set(r_fields) | set(t_fields))
    merged = []
    for n in names:
        rf, tf = r_fields.get(n), t_fields.get(n)
        canon_type = (rf or tf)["canon"]
        # Rust is the server-authoritative required flag; fall back to TS.
        required = rf["required"] if rf else tf["required"]
        agree = None
        if rf and tf:
            agree = (rf["canon"] == tf["canon"]) and (rf["required"] == tf["required"])
        merged.append({
            "name": n, "type": canon_type, "required": required,
            "rust_type": rf["type"] if rf else None,
            "ts_type": tf["type"] if tf else None,
            "in_rust": rf is not None, "in_ts": tf is not None,
            "agree": agree,
        })
    return {
        "type": type_name,
        "rust_source": rust["source"] if rust else None,
        "ts_source": ts["source"] if ts else None,
        "found": bool(rust or ts),
        "fields": merged,
    }


AGENT_TOOLS = (REPO_ROOT / "medbrains" / "crates" / "medbrains-server"
               / "src" / "services" / "simulator" / "agent_tools.rs")


def _parse_sim_tools() -> list[dict]:
    """Parse the sim's ToolSpec catalog → [{name, method, path}]."""
    try:
        src = AGENT_TOOLS.read_text()
    except OSError:
        return []
    rx = re.compile(
        r'ToolSpec\s*\{\s*name:\s*"([^"]+)",\s*method:\s*"([^"]+)",\s*path:\s*"([^"]+)"',
        re.MULTILINE,
    )
    return [{"name": n, "method": mth, "path": p} for n, mth, p in rx.findall(src)]


def emit_sim_shapes() -> dict:
    """Build the compact per-tool shape map the Rust sim embeds via include_str!.

    Keyed by tool name → {method, path, request_type, fields:[{name,type,required}]}.
    GET pickers (no body) and unresolved endpoints carry empty fields.
    """
    tools = {}
    for t in _parse_sim_tools():
        entry = {"method": t["method"], "path": t["path"],
                 "request_type": None, "fields": []}
        if t["method"] in ("POST", "PUT", "PATCH"):
            ep = resolve_endpoint(t["method"], t["path"])
            rtype = ep["request_type"] if ep else None
            # Ignore inline TS generics (Record/Partial/…) and any name that
            # isn't a real struct/interface — leave fields empty so the sim
            # falls back to the tool's hand-written hint.
            if rtype and rtype not in ("Record", "Partial", "Pick", "Omit", "Array"):
                shape = merge_shape(rtype)
                if shape["found"]:
                    entry["request_type"] = rtype
                    entry["fields"] = [
                        {"name": f["name"], "type": f["type"], "required": f["required"]}
                        for f in shape["fields"]
                        if f["name"] != "is_dummy"  # host-injected, not the LLM's job
                    ]
        tools[t["name"]] = entry
    return {"_generated_by": "scripts/fetch_api_shape.py --emit-sim", "tools": tools}


def _self_test() -> int:
    """Smoke-check the parsers against stable, known types. Fails loudly."""
    shape = merge_shape("CreateEncounterRequest")
    assert shape["found"], "CreateEncounterRequest not found"
    fields = {f["name"]: f for f in shape["fields"]}
    assert fields["patient_id"]["required"], "patient_id should be required"
    assert fields["patient_id"]["type"] == "string", "Uuid should canon to string"
    assert not fields["doctor_id"]["required"], "doctor_id (Option) should be optional"
    assert fields["is_dummy"]["in_rust"] and not fields["is_dummy"]["in_ts"], \
        "is_dummy is a Rust-only server field"
    ep = resolve_endpoint("POST", "/opd/encounters")
    assert ep and ep["request_type"] == "CreateEncounterRequest", "endpoint resolve failed"
    idx = _client_index()
    assert len(idx) > 500, f"client index suspiciously small: {len(idx)}"
    print(f"self-test OK  (fields={len(shape['fields'])}, endpoints={len(idx)})")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="On-demand API shape fetcher (Rust + TS).")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--type", help="Request/response type name, e.g. CreateEncounterRequest")
    g.add_argument("--endpoint", help='Endpoint, e.g. "POST /opd/encounters"')
    g.add_argument("--list-endpoints", action="store_true", help="Dump the client endpoint index")
    g.add_argument("--emit-sim", metavar="OUT",
                   help="Write the sim tool-shape map (compact JSON) for include_str! embedding")
    g.add_argument("--self-test", action="store_true", help="Run parser smoke-checks")
    ap.add_argument("--json", action="store_true", help="Machine-readable JSON output")
    args = ap.parse_args()

    if args.self_test:
        return _self_test()

    if args.list_endpoints:
        print(json.dumps(_client_index(), indent=2))
        return 0

    if args.emit_sim:
        payload = emit_sim_shapes()
        Path(args.emit_sim).write_text(json.dumps(payload, indent=2) + "\n")
        resolved = sum(1 for t in payload["tools"].values() if t["fields"])
        print(f"wrote {args.emit_sim}: {len(payload['tools'])} tools, {resolved} with field shapes")
        return 0

    type_name = args.type
    if args.endpoint:
        parts = args.endpoint.split(None, 1)
        if len(parts) != 2:
            print('endpoint must be "METHOD /path"', file=sys.stderr)
            return 2
        ep = resolve_endpoint(parts[0], parts[1])
        if not ep or not ep.get("request_type"):
            print(f"no request type resolved for {args.endpoint}", file=sys.stderr)
            return 2
        type_name = ep["request_type"]

    shape = merge_shape(type_name)
    if not shape["found"]:
        print(f"type '{type_name}' not found in Rust or TS", file=sys.stderr)
        return 2

    if args.json:
        print(json.dumps(shape, indent=2))
        return 0

    # Human view
    print(f"{shape['type']}   rust={shape['rust_source'] or '—'}  ts={shape['ts_source'] or '—'}")
    for f in shape["fields"]:
        req = "required" if f["required"] else "optional"
        flag = "" if f["agree"] in (True, None) else "  ⚠ MISMATCH"
        src = "".join(["R" if f["in_rust"] else "-", "T" if f["in_ts"] else "-"])
        print(f"  [{src}] {f['name']}: {f['type']} ({req}){flag}"
              f"   rust={f['rust_type'] or '—'} ts={f['ts_type'] or '—'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
