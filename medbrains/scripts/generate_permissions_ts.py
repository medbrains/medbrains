#!/usr/bin/env python3
"""Generate the UI permission catalogue from the Rust constants.

    python3 scripts/generate_permissions_ts.py            # write
    python3 scripts/generate_permissions_ts.py --check     # fail if stale

## Why this exists

`permissions.rs` and `permissions.ts` were both hand-maintained, and they
drifted 111 codes apart: **105 permissions existed in Rust that the admin UI
could not grant** — including `admin.approvals.oversee` and
`admin.outbox.retry` — and **6 existed in the UI that nothing enforced**, so
granting `vpn.enroll` did nothing at all.

Neither number is visible to anyone. A role editor simply has no checkbox for a
permission that the server requires, and an administrator ticking a phantom one
believes they granted something.

## Rust is the source, and labels live in doc comments

The constants are already authoritative — the compiler validates that
`BUILT_IN_ROLES` references real ones (943 references today), and the audit and
OpenAPI generators both read them.

What Rust lacked was the human label the UI shows. That goes where a Rust
developer would put it anyway:

    pub mod approvals {
        /// See every request in the tenant, not just your own.
        pub const OVERSEE: &str = "admin.approvals.oversee";
    }

First sentence becomes the label, the rest the description. A YAML sidecar
would have moved that prose out of the code for no gain — and would not have
avoided a second file, since Rust would still have needed labels from
somewhere.

## Nothing regresses

794 labels already exist in the TypeScript file and are better than anything
derived from a code string. They are read and preserved; a doc comment
overrides them; only codes with neither get a mechanical label, and those are
listed on every run so they can be written properly.
"""

from __future__ import annotations

import argparse
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RUST = os.path.join(ROOT, "crates/medbrains-core/src/permissions.rs")
ROLES = os.path.join(ROOT, "crates/medbrains-core/src/access/roles.rs")
TS = os.path.join(ROOT, "packages/types/src/permissions.ts")

# Words that read badly through `.title()`.
ACRONYMS = {
    "api": "API", "ui": "UI", "id": "ID", "ip": "IP", "sms": "SMS", "pdf": "PDF",
    "opd": "OPD", "ipd": "IPD", "ot": "OT", "icu": "ICU", "er": "ER", "hr": "HR",
    "mlc": "MLC", "mrd": "MRD", "ndps": "NDPS", "abdm": "ABDM", "abha": "ABHA",
    "hl7": "HL7", "fhir": "FHIR", "dlt": "DLT", "sso": "SSO", "vpn": "VPN",
    "tv": "TV", "qc": "QC", "tat": "TAT", "capa": "CAPA", "rca": "RCA",
    "adr": "ADR", "bmw": "BMW", "cssd": "CSSD", "grn": "GRN", "po": "PO",
    "gst": "GST", "tds": "TDS", "pos": "POS", "dnr": "DNR", "vte": "VTE",
}


def humanise(word: str) -> str:
    return ACRONYMS.get(word.lower(), word.replace("_", " ").title())


def derive_label(code: str) -> str:
    """`admin.api_keys.list` -> `List API Keys`. A fallback, never a preference."""
    parts = code.split(".")
    action = parts[-1]
    subject = parts[-2] if len(parts) > 1 else parts[0]
    verb = {
        "list": "List", "view": "View", "create": "Create", "update": "Update",
        "delete": "Delete", "manage": "Manage", "approve": "Approve",
        "print": "Print", "export": "Export", "revoke": "Revoke",
    }.get(action, humanise(action))
    return f"{verb} {humanise(subject)}".strip()


def rust_permissions() -> list[tuple[str, str, str, str]]:
    """`(module_path, const_name, code, doc)` in file order."""
    with open(RUST, encoding="utf-8") as handle:
        lines = handle.read().split("\n")

    stack: list[str] = []
    depth_of: list[int] = []
    depth = 0
    pending_doc: list[str] = []
    out: list[tuple[str, str, str, str]] = []

    module = re.compile(r"pub\s+mod\s+([a-z_0-9]+)")
    constant = re.compile(r'pub\s+const\s+([A-Z_0-9]+)\s*:\s*&str\s*=\s*"([^"]+)"')
    doc = re.compile(r"^\s*///\s?(.*)$")

    for line in lines:
        if match := doc.match(line):
            pending_doc.append(match.group(1).strip())
            continue
        if match := module.search(line):
            stack.append(match.group(1))
            depth_of.append(depth)
            pending_doc = []
        elif match := constant.search(line):
            out.append((
                "::".join(stack),
                match.group(1),
                match.group(2),
                " ".join(p for p in pending_doc if p).strip(),
            ))
            pending_doc = []
        elif line.strip() and not line.strip().startswith("//"):
            pending_doc = []
        depth += line.count("{") - line.count("}")
        while depth_of and depth <= depth_of[-1]:
            stack.pop()
            depth_of.pop()
    return out


def built_in_roles(constants: dict[str, str]) -> list[tuple[str, str, list[str]]]:
    """`(code, name, [permission codes])` from the Rust role definitions.

    `ROLE_TEMPLATES` was hand-maintained here and `BUILT_IN_ROLES` in Rust,
    and CLAUDE.md says the two "must stay in sync" — which is the same promise
    that let the permission catalogue drift 111 codes. Generating it removes
    the third copy.

    Bypass roles hold no constants by design (they short-circuit every check),
    so they render with an empty list rather than being dropped.
    """
    if not os.path.exists(ROLES):
        return []
    text = open(ROLES, encoding="utf-8").read()
    out = []
    # Split on the struct literal rather than matching to a closing brace: a
    # terminator of `\n    },` stops at the first nested close, which silently
    # truncated most roles — `nurse` lost 127 permissions and the parity check
    # caught it.
    for block in re.split(r"BuiltInRole\s*\{", text)[1:]:
        code_match = re.search(r'code:\s*"([a-z_]+)"', block)
        name_match = re.search(r'name:\s*"([^"]*)"', block)
        if not code_match:
            continue
        codes = []
        for reference in re.findall(r"permissions::([a-z_0-9:]+::[A-Z_0-9]+)", block):
            parts = reference.split("::")
            for start in range(len(parts) - 1):
                if value := constants.get("::".join(parts[start:])):
                    codes.append(value)
                    break
        out.append((
            code_match.group(1),
            name_match.group(1) if name_match else code_match.group(1),
            sorted(dict.fromkeys(codes)),
        ))
    return out


def existing_tree_paths() -> dict[str, list[list[str]]]:
    """`code -> [key paths]` the current tree already exposes.

    The shape is not derivable. Four conventions are in use — nested
    (`ADMIN.API_KEYS.LIST`), flat-compound (`AMBULANCE.FLEET_LIST`),
    three-level (`SPECIALTY.PSYCHIATRY.PATIENTS_LIST`) — and some groups were
    simply hoisted by hand: `clinical.order_basket.sign` lives at
    `P.ORDER_BASKET.SIGN`, which no rule predicts.

    Guessing produced 486, then 43, then 6 broken references. Reading the
    existing paths and re-emitting them produces none, and lets the canonical
    shape be added alongside rather than instead.
    """
    if not os.path.exists(TS):
        return {}
    text = open(TS, encoding="utf-8").read()
    if "export const P" not in text:
        return {}
    body = text[text.index("export const P") :]

    paths: dict[str, list[list[str]]] = {}
    stack: list[str] = []
    for line in body.split("\n"):
        stripped = line.strip()
        if opened := re.match(r"([A-Z_0-9]+):\s*\{\s*$", stripped):
            stack.append(opened.group(1))
            continue
        if leaf := re.match(r'([A-Z_0-9]+):\s*"([a-z_.]+)"', stripped):
            paths.setdefault(leaf.group(2), []).append(stack + [leaf.group(1)])
            continue
        if stripped.startswith("}") and stack:
            stack.pop()
    return paths


def existing_labels() -> dict[str, tuple[str, str]]:
    """`code -> (label, description)` already written by hand in TypeScript."""
    if not os.path.exists(TS):
        return {}
    text = open(TS, encoding="utf-8").read()
    return {
        m.group(1): (m.group(2), m.group(3))
        for m in re.finditer(
            r'\{\s*code:\s*"([a-z_.]+)",\s*label:\s*"([^"]*)",\s*description:\s*"([^"]*)"',
            text,
        )
    }


def escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def render(entries: list[dict], legacy_paths: dict[str, list[list[str]]], roles: list) -> str:
    lines = [
        "/**",
        " * Permission codes, labels and the typed `P` tree.",
        " *",
        " * GENERATED by scripts/generate_permissions_ts.py — do not edit.",
        " *",
        " * The source is `crates/medbrains-core/src/permissions.rs`; labels come from",
        " * the doc comment above each constant, falling back to a label derived from",
        " * the code. This file drifted 111 codes from the Rust definitions while both",
        " * were hand-maintained — 105 the UI could not grant, 6 it offered that",
        " * nothing enforced — which is invisible to anyone using the role editor.",
        " */",
        "",
        "export interface PermissionDef {",
        "  code: string;",
        "  label: string;",
        "  description: string;",
        "  module: string;",
        "}",
        "",
        f"/** {len(entries)} permissions, one per constant in the Rust source. */",
        "export const PERMISSIONS: PermissionDef[] = [",
    ]

    current_module = None
    for entry in entries:
        if entry["module"] != current_module:
            current_module = entry["module"]
            lines.append(f"  // {current_module}")
        lines.append("  {")
        lines.append(f'    code: "{escape(entry["code"])}",')
        lines.append(f'    label: "{escape(entry["label"])}",')
        lines.append(f'    description: "{escape(entry["description"])}",')
        lines.append(f'    module: "{escape(entry["module"])}",')
        lines.append("  },")
    lines.append("];")
    lines.append("")

    # Two key shapes, because the codebase uses both.
    #
    # 486 of 619 references are flat-compound — `P.AMBULANCE.FLEET_LIST` for
    # `ambulance::fleet::LIST` — and the rest are nested. Emitting only the
    # nested form (which mirrors Rust) broke 486 call sites; emitting only the
    # flat form would break the others. So both are emitted, pointing at the
    # same string, and neither convention has to be migrated to land this.
    tree: dict = {}
    collisions: list[str] = []

    canonical: dict[str, list[str]] = {}

    def place(path: list[str], code: str) -> None:
        node = tree
        for part in path[:-1]:
            nxt = node.get(part)
            if isinstance(nxt, str):
                return  # a leaf already owns this name; do not clobber it
            node = node.setdefault(part, {})
        leaf = path[-1]
        if isinstance(node.get(leaf), dict):
            return
        if leaf in node and node[leaf] != code:
            collisions.append(".".join(path))
        node[leaf] = code
        # First path wins — legacy paths are placed first, so a hand-organised
        # key stays the one templates refer to.
        canonical.setdefault(code, path)

    for entry in entries:
        # Every path the current tree exposed for this code, so no call site
        # breaks. Placed first so a hand-organised path wins any collision.
        for legacy in legacy_paths.get(entry["code"], []):
            place(legacy, entry["code"])

    for entry in entries:
        path = entry["path"]
        # The flat key mirrors the dotted code, NOT the Rust module path. They
        # differ: `procurement.po.list` lives at `procurement::purchase_orders`,
        # and the codebase says `P.PROCUREMENT.PO_LIST`. Deriving from the
        # module path left 43 references broken.
        segments = [s.upper() for s in entry["code"].split(".")]
        top = segments[0] if segments else "GENERAL"
        rest = [p.upper() for p in path[1:]]

        flat_key = "_".join(segments[1:]) if len(segments) > 1 else segments[0]
        shapes = [[top, flat_key]]

        # A third shape, used by the specialty modules:
        # `specialty.psychiatry.patients.list` -> P.SPECIALTY.PSYCHIATRY.PATIENTS_LIST
        # i.e. top, second segment, then everything after it joined.
        if len(segments) >= 4:
            shapes.append([top, segments[1], "_".join(segments[2:])])

        # nested: TOP.REST.CONST — only when there is a middle segment
        if rest:
            shapes.append([top, *rest, entry["const"]])

        # A code with no legacy path is new, and `canonical` takes whichever
        # shape is placed first — so this order decides what ROLE_TEMPLATES
        # emits. Put the nested shape first for new codes, because that is what
        # the *next* run would choose: the tree is written sorted, `LTC` sorts
        # before `LTC_FAMILY_CREATE`, so on a second run the nested path is the
        # first legacy path read back and wins.
        #
        # Without this the generator is not a fixed point. Adding a permission
        # emitted flat references, and only a second run switched them to
        # nested — so one generate left `--check` failing, which cost two
        # rounds of chasing a gate that was reporting the truth.
        if rest and entry["code"] not in legacy_paths:
            shapes.insert(0, shapes.pop())

        for shape in shapes:
            place(shape, entry["code"])

    if collisions:
        raise SystemExit("key collisions — two permissions want the same P path:\n  "
                         + "\n  ".join(collisions[:10]))

    lines.append("/**")
    lines.append(" * Typed accessor — `P.ADMIN.API_KEYS.LIST` rather than a string literal,")
    lines.append(" * so a renamed permission is a type error instead of a silent no-op.")
    lines.append(" */")
    lines.append("export const P = {")

    def emit(node: dict, indent: int) -> None:
        pad = "  " * indent
        for key in sorted(node):
            value = node[key]
            if isinstance(value, dict):
                lines.append(f"{pad}{key}: {{")
                emit(value, indent + 1)
                lines.append(f"{pad}}},")
            else:
                lines.append(f'{pad}{key}: "{escape(value)}",')

    emit(tree, 1)
    lines.append("} as const;")
    lines.append("")
    if roles:
        lines.append("/**")
        lines.append(" * Built-in role templates, generated from `BUILT_IN_ROLES` in")
        lines.append(" * `crates/medbrains-core/src/access/roles.rs`.")
        lines.append(" *")
        lines.append(" * `super_admin` and `hospital_admin` carry no permissions on purpose:")
        lines.append(" * they bypass every check, so an enumerated list would be misleading.")
        lines.append(" */")
        lines.append(
            "export const ROLE_TEMPLATES: Record<string, { label: string; permissions: string[] }> = {"
        )
        for code, name, codes in roles:
            lines.append(f'  {code}: {{')
            lines.append(f'    label: "{escape(name)}",')
            if codes:
                # `P.` references, not raw strings. The parity checker resolves
                # templates by finding `P.X` and reports an empty template as
                # "missing everything" — which is exactly what raw strings
                # produced: all 31 roles missing their whole permission set.
                lines.append("    permissions: [")
                for c in codes:
                    path = canonical.get(c)
                    lines.append(f'      P.{".".join(path)},' if path else f'      "{escape(c)}",')
                lines.append("    ],")
            else:
                # Multi-line even when empty. The parity checker matches
                # `permissions: [ ... \n ],` and a single-line `[]` makes it
                # scan on into the next role's array — which credited
                # `super_admin` with 198 permissions it does not have.
                lines.append("    permissions: [")
                lines.append("    ],")
            lines.append("  },")
        lines.append("};")
        lines.append("")

    lines.append("/** Every code, flat — for validating what the server returns. */")
    lines.append(
        "export const PERMISSION_CODES: readonly string[] = PERMISSIONS.map((p) => p.code);"
    )
    lines.append("")
    return "\n".join(lines)


def build() -> tuple[str, list[str]]:
    hand_written = existing_labels()
    legacy_paths = existing_tree_paths()
    constants = {f"{m}::{c}" if m else c: code
                 for m, c, code, _ in rust_permissions()}
    roles = built_in_roles(constants)
    entries = []
    needs_a_label = []

    for module_path, const_name, code, doc in rust_permissions():
        path = module_path.split("::") if module_path else []
        if doc:
            # First sentence is the label, the rest the description — but a
            # label is a phrase on a checkbox, so an over-long first sentence
            # is prose that belongs in the description. Three doc comments
            # produced 90-character labels before this cap.
            head, _, tail = doc.partition(". ")
            head = head.rstrip(".")
            description = tail.strip() or head
            if len(head) <= 48:
                label = head
            else:
                label, description = hand_written.get(code, (derive_label(code), doc))[0], doc
        elif code in hand_written:
            label, description = hand_written[code]
        else:
            label = derive_label(code)
            description = label
            needs_a_label.append(code)
        entries.append({
            "code": code,
            "label": label,
            "description": description,
            "module": path[0] if path else "general",
            "path": path,
            "const": const_name,
        })
    return render(entries, legacy_paths, roles), needs_a_label


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail if out of date")
    args = parser.parse_args()

    rendered, needs_a_label = build()

    if args.check:
        existing = open(TS, encoding="utf-8").read() if os.path.exists(TS) else ""
        if existing != rendered:
            print(f"{TS} is out of date — run scripts/generate_permissions_ts.py")
            return 1
        print("permission catalogue current")
        return 0

    with open(TS, "w", encoding="utf-8") as handle:
        handle.write(rendered)

    total = rendered.count("    code: ")
    print(f"wrote {total} permissions to {os.path.relpath(TS, ROOT)}")
    if needs_a_label:
        print(f"\n{len(needs_a_label)} have a mechanical label — add a /// above the constant:")
        for code in needs_a_label[:12]:
            print(f"   {code}")
        if len(needs_a_label) > 12:
            print(f"   ... {len(needs_a_label) - 12} more")
    return 0


if __name__ == "__main__":
    sys.exit(main())
