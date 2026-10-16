#!/usr/bin/env python3
"""Generate the print-document payload types for TypeScript, from the Rust.

    python3 scripts/generate_print_types.py           # write
    python3 scripts/generate_print_types.py --check    # fail if stale

The server builds every print payload from a struct in
`crates/medbrains-core/src/print_data.rs` and serialises it with serde. The
web hand-copied those structs into TypeScript and the copies drifted: fields
the server never sent, fields it did send that nobody could read, nullability
that lied. The TypeScript is now generated, and `--check` runs in CI, so a
Rust change that is not regenerated fails the gate.

Mapping (serde default naming — field names are emitted verbatim):
    Option<T>                -> T | null
    Vec<T>                   -> T[]
    String/&str/NaiveDate/DateTime<_>/Uuid/Decimal -> string
    integers/floats          -> number
    bool                     -> boolean
    serde_json::Value        -> unknown
    HashMap/BTreeMap<K, V>   -> Record<string, V>
    anything else            -> referenced by name (must be a struct/enum here)

`#[serde(rename = "x")]` renames the field, `#[serde(skip)]` /
`skip_serializing` drops it, `skip_serializing_if` makes it optional (`?:`),
`rename_all` on a container is honoured for snake_case/camelCase/
SCREAMING_SNAKE_CASE/lowercase/UPPERCASE/kebab-case. `#[serde(default)]` only
affects deserialisation, so it does not change the type. Unit-only enums
become string unions; enums with data are rejected rather than guessed.
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "crates/medbrains-core/src/print_data.rs")
OUT = os.path.join(ROOT, "packages/types/src/print-data.generated.ts")
BIOME = os.path.join(ROOT, "node_modules", ".bin", "biome")

STRINGY = {"String", "str", "NaiveDate", "NaiveDateTime", "NaiveTime", "DateTime",
           "Uuid", "Decimal", "Date"}
NUMERIC = {"i8", "i16", "i32", "i64", "i128", "isize", "u8", "u16", "u32", "u64",
           "u128", "usize", "f32", "f64"}
MAPS = {"HashMap", "BTreeMap", "IndexMap"}

ITEM = re.compile(r"\bpub\s+(struct|enum)\s+(\w+)\s*(?:<[^>{]*>)?\s*\{")
FIELD = re.compile(r"^pub(?:\([^)]*\))?\s+(r#)?(\w+)\s*:\s*(.+?),?$")


class Unsupported(Exception):
    pass


def split_generics(text: str) -> tuple[str, list[str]]:
    """`Option<Vec<A>>` -> ("Option", ["Vec<A>"]); `HashMap<K, V>` -> two args."""
    text = text.strip().lstrip("&").strip()
    lt = text.find("<")
    if lt < 0:
        return text, []
    head, inner = text[:lt], text[lt + 1 : text.rfind(">")]
    args, depth, cur = [], 0, ""
    for ch in inner:
        if ch == "<":
            depth += 1
        elif ch == ">":
            depth -= 1
        if ch == "," and depth == 0:
            args.append(cur.strip())
            cur = ""
        else:
            cur += ch
    if cur.strip():
        args.append(cur.strip())
    return head, args


def ts_type(rust: str, known: set[str]) -> str:
    head, args = split_generics(rust)
    name = head.split("::")[-1]
    if name == "Option":
        return f"{ts_type(args[0], known)} | null"
    if name in {"Vec", "VecDeque", "HashSet", "BTreeSet"} or rust.strip().startswith("["):
        inner = ts_type(args[0], known)
        return f"({inner})[]" if "|" in inner else f"{inner}[]"
    if name in {"Box", "Arc", "Rc"}:
        return ts_type(args[0], known)
    if name in MAPS:
        return f"Record<string, {ts_type(args[1], known)}>"
    if name == "Value":
        return "unknown"
    if name in STRINGY:
        return "string"
    if name in NUMERIC:
        return "number"
    if name == "bool":
        return "boolean"
    if name in known:
        return name
    raise Unsupported(f"no TypeScript mapping for Rust type `{rust}`")


def rename(name: str, rule: str | None) -> str:
    if not rule or rule == "snake_case":
        return name
    words = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", name).lower().split("_")
    return {
        "camelCase": words[0] + "".join(w.title() for w in words[1:]),
        "PascalCase": "".join(w.title() for w in words),
        "SCREAMING_SNAKE_CASE": "_".join(words).upper(),
        "lowercase": "".join(words),
        "UPPERCASE": "".join(words).upper(),
        "kebab-case": "-".join(words),
    }.get(rule, name)


def serde_attrs(attrs: list[str]) -> dict[str, str | bool]:
    out: dict[str, str | bool] = {}
    for attr in attrs:
        m = re.match(r"#\[serde\((.*)\)\]$", attr)
        if not m:
            continue
        for key, val in re.findall(r'(\w+)\s*(?:=\s*"([^"]*)")?', m.group(1)):
            out[key] = val or True
    return out


def body_of(src: str, start: int) -> tuple[str, int]:
    depth, i = 1, start
    while depth:
        depth += {"{": 1, "}": -1}.get(src[i], 0)
        i += 1
    return src[start : i - 1], i


def take_meta(lines: list[str]) -> tuple[list[str], list[str]]:
    """Doc comments and attributes immediately above an item."""
    docs, attrs = [], []
    for line in reversed(lines):
        s = line.strip()
        if s.startswith("///"):
            docs.insert(0, s[3:].removeprefix(" "))
        elif s.startswith("#["):
            attrs.insert(0, s)
        else:
            break
    return docs, attrs


def jsdoc(docs: list[str], indent: str) -> list[str]:
    if not docs:
        return []
    safe = [d.replace("*/", "*\\/") for d in docs]
    if len(safe) == 1:
        return [f"{indent}/** {safe[0]} */"]
    return [f"{indent}/**", *(f"{indent} * {d}".rstrip() for d in safe), f"{indent} */"]


def parse(src: str) -> list[dict]:
    items = []
    for m in ITEM.finditer(src):
        docs, attrs = take_meta(src[: m.start()].splitlines())
        body, _ = body_of(src, m.end())
        items.append({"kind": m.group(1), "name": m.group(2), "docs": docs,
                      "serde": serde_attrs(attrs), "body": body})
    return items


def struct_fields(body: str) -> list[dict]:
    """Fields in order; a type that spans lines (`Option<\n Vec<..>>`) is joined."""
    fields, pending, meta = [], "", []

    def emit() -> None:
        m = FIELD.match(pending)
        if not m:
            raise Unsupported(f"cannot parse field `{pending}` (non-pub field?)")
        docs, attrs = take_meta(meta)
        fields.append({"name": m.group(2), "rust": m.group(3).rstrip(","),
                       "docs": docs, "serde": serde_attrs(attrs)})

    for raw in body.splitlines():
        line = raw.strip()
        if line.startswith("///") or line.startswith("#["):
            meta.append(line)
            continue
        line = line.split("//", 1)[0].strip()
        if not line:
            continue
        pending = f"{pending} {line}".strip()
        if pending.endswith(",") and pending.count("<") == pending.count(">"):
            emit()
            pending, meta = "", []
    if pending:
        emit()
    return fields


def render_item(item: dict, known: set[str]) -> list[str]:
    out = jsdoc(item["docs"], "")
    rule = item["serde"].get("rename_all")
    if item["kind"] == "enum":
        variants = []
        for raw in item["body"].split(","):
            lines = [l.strip() for l in raw.strip().splitlines() if l.strip()]
            if not lines:
                continue
            name = lines[-1]
            if not re.fullmatch(r"\w+", name):
                raise Unsupported(f"enum {item['name']}: data-carrying variant `{name}`")
            _, attrs = take_meta(lines[:-1])
            variants.append(serde_attrs(attrs).get("rename") or rename(name, rule))
        out.append(f"export type {item['name']} = " +
                   " | ".join(f'"{v}"' for v in variants) + ";")
        return out
    out.append(f"export interface {item['name']} {{")
    for f in struct_fields(item["body"]):
        s = f["serde"]
        if s.get("skip") or s.get("skip_serializing") or s.get("flatten"):
            if s.get("flatten"):
                raise Unsupported(f"{item['name']}.{f['name']}: #[serde(flatten)]")
            continue
        key = s.get("rename") or rename(f["name"], rule)
        opt = "?" if s.get("skip_serializing_if") else ""
        out += jsdoc(f["docs"], "  ")
        out.append(f"  {key}{opt}: {ts_type(f['rust'], known)};")
    out.append("}")
    return out


def render(items: list[dict]) -> str:
    known = {i["name"] for i in items}
    lines = [
        "/**",
        " * Print-document payloads, as the server serialises them.",
        " *",
        " * GENERATED by scripts/generate_print_types.py — do not edit.",
        " *",
        " * Source: crates/medbrains-core/src/print_data.rs (and the modules it",
        " * re-exports with `pub use crate::…`). Change the Rust, then",
        " * re-run the generator; `--check` fails CI when this file is stale.",
        " */",
    ]
    for item in items:
        lines.append("")
        lines += render_item(item, known)
    lines.append("")
    return "\n".join(lines)


def biome_formatted(source: str) -> str:
    try:
        result = subprocess.run(
            [BIOME, "format", f"--stdin-file-path={OUT}"],
            input=source, capture_output=True, text=True, cwd=ROOT, check=True,
        )
    except (OSError, subprocess.CalledProcessError) as error:
        raise SystemExit(f"biome format failed ({error}); run `pnpm install` first") from error
    return result.stdout


REEXPORT = re.compile(r"pub\s+use\s+crate::(\w+)::(?:\{([^}]*)\}|(\w+))\s*;")


def load_items() -> list[dict]:
    """print_data.rs's own structs, plus the ones it re-exports from sibling
    modules (`pub use crate::gst_invoice_print::{..}`) — those are print
    payloads too, they just live in their own file."""
    with open(SRC, encoding="utf-8") as handle:
        src = handle.read()
    items = parse(src)
    for module, group, single in REEXPORT.findall(src):
        names = {n.strip() for n in (group or single).split(",") if n.strip()}
        path = os.path.join(os.path.dirname(SRC), f"{module}.rs")
        if not os.path.exists(path):
            path = os.path.join(os.path.dirname(SRC), module, "mod.rs")
        with open(path, encoding="utf-8") as handle:
            found = [i for i in parse(handle.read()) if i["name"] in names]
        missing = names - {i["name"] for i in found}
        if missing:
            raise SystemExit(f"re-exported from crate::{module} but not found: {sorted(missing)}")
        items += found
    return items


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail if out of date")
    args = parser.parse_args()

    items = load_items()
    if not items:
        raise SystemExit(f"found no pub struct/enum in {SRC}")
    try:
        rendered = biome_formatted(render(items))
    except Unsupported as error:
        raise SystemExit(f"generate_print_types: {error}") from error

    if args.check:
        existing = ""
        if os.path.exists(OUT):
            with open(OUT, encoding="utf-8") as handle:
                existing = handle.read()
        if existing != rendered:
            print(f"{OUT} is out of date — run scripts/generate_print_types.py")
            return 1
        print(f"print types current: {len(items)} types")
        return 0

    with open(OUT, "w", encoding="utf-8") as handle:
        handle.write(rendered)
    print(f"wrote {len(items)} print types to {os.path.relpath(OUT, ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
