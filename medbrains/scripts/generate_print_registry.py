#!/usr/bin/env python3
"""Generate the printable-document registry from the Rust print-data handlers.

Every entry's permission is read from the handler that enforces it, not
guessed from the route. Deriving it was tried and was wrong:
`permissions::indent::STOCK_MANAGE` is "indent.stock.manage", not
"indent.stock_manage", and a registry that offers a button the server refuses
is the defect this whole seam exists to remove.

Excluded on purpose:
  * handlers returning NotImplemented — 20 of them, gutted in an earlier pass
    because they rendered fabricated data onto hospital letterhead
  * handlers whose data comes from a table nothing writes. The fluid balance
    chart passed every other filter and would have printed an empty chart on
    hospital letterhead for every patient; it read `fluid_intake`, which has no
    INSERT anywhere. A document that cannot contain anything is the same
    hazard as one containing invented data.
  * handlers with no require_permission
  * endpoints whose client method takes more than one id, which the single
    printDocument(key, recordId) command cannot express
  * the eleven consent documents, hand-written in print-registry.ts

Run: python3 scripts/generate_print_registry.py
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "apps/web/src/lib/print/print-registry.generated.ts"

ALREADY_HAND_WRITTEN = {
    "consent.general", "consent.surgical", "consent.anesthesia", "consent.blood",
    "consent.dnr", "consent.ama", "consent.hiv", "consent.photo",
    "consent.organ_donation", "consent.abdm", "consent.teaching",
}

ID_KIND = {
    "admission_id": "admission", "booking_id": "booking", "surgery_id": "booking",
    "patient_id": "patient", "consent_id": "consent", "enrollment_id": "enrollment",
    "order_id": "order", "invoice_id": "invoice", "payment_id": "payment",
}

# `order_id` alone is ambiguous: a lab order and a radiology order are both
# "an order" and neither endpoint accepts the other's id. Offering both on one
# screen hands a technician a button that fetches the wrong record — the exact
# mistake idKind exists to prevent. The route prefix disambiguates.
ORDER_KIND_BY_PREFIX = {
    "lab-report": "lab_order", "cumulative-lab-report": "lab_order",
    "culture-sensitivity": "lab_order", "histopath-report": "lab_order",
    "investigation-requisition": "lab_order", "lab-report-full": "lab_order",
    "radiology-report": "radiology_order", "radiology-report-full": "radiology_order",
    "dicom": "radiology_order", "imaging": "radiology_order",
}


def permission_constants() -> dict[str, str]:
    """`indent::STOCK_MANAGE` -> "indent.stock.manage", read from the source."""
    text = (ROOT / "crates/medbrains-core/src/permissions.rs").read_text()
    consts: dict[str, str] = {}
    stack: list[str] = []
    depth: list[int] = []
    brace = 0
    for line in text.split("\n"):
        opened = re.match(r"\s*pub mod (\w+)\s*\{", line)
        if opened:
            stack.append(opened.group(1))
            depth.append(brace)
            brace += 1
            continue
        brace += line.count("{") - line.count("}")
        while depth and brace <= depth[-1]:
            stack.pop()
            depth.pop()
        const = re.match(r'\s*pub const (\w+): &str = "([^"]+)";', line)
        if const and stack:
            consts["::".join(stack) + "::" + const.group(1)] = const.group(2)
    return consts


def handlers() -> tuple[dict, dict]:
    guards, routes = {}, {}
    for path in (ROOT / "crates/medbrains-print-data/src").glob("*.rs"):
        text = path.read_text(errors="ignore")
        for m in re.finditer(r"pub async fn (\w+)\((.{0,700}?)\)\s*->\s*Result<", text, re.S):
            # Wide window: a handler's queries run well past the guard.
            body = text[m.end():m.end() + 6000]
            perm = re.search(r"require_permission\(&claims,\s*permissions::([\w:]+)\)", body[:900])
            guards[m.group(1)] = {
                "perm": perm.group(1) if perm else None,
                "stub": "NotImplemented" in body[:900],
                "tables": source_tables(body),
            }
        for m in re.finditer(r'"(/api/print-data/[^"]+)"\s*,\s*\n?\s*get\((\w+)\)', text):
            routes[m.group(2)] = m.group(1)
    return guards, routes


def written_tables() -> set[str]:
    """Every table something in the workspace inserts into."""
    written: set[str] = set()
    for path in (ROOT / "crates").rglob("*.rs"):
        for m in re.finditer(r"INSERT\s+INTO\s+(\w+)", path.read_text(errors="ignore"), re.I):
            written.add(m.group(1).lower())
    return written


def source_tables(handler_body: str) -> set[str]:
    """Tables the handler reads.

    A name followed by `(` is a function call, not a table: `EXTRACT(YEAR FROM
    age(dob))` otherwise reports a table called `age` in a third of the
    handlers here.
    """
    return {
        m.group(1).lower()
        for m in re.finditer(r"\b(?:FROM|JOIN)\s+(\w+)(\s*\()?", handler_body, re.I)
        if not m.group(2) and m.group(1).lower() not in {"select", "lateral", "unnest"}
    }


def client_methods() -> dict[str, list[tuple[str, str]]]:
    text = (ROOT / "packages/api/src/client.ts").read_text()
    by_path: dict[str, list[tuple[str, str]]] = {}
    for m in re.finditer(
        r"(\w+PrintData): \(([^)]*)\)\s*=>[^;]{0,400}?request<[^>]*>\(\s*[`\"']([^`\"']+)",
        text, re.S,
    ):
        norm = re.sub(r"\$\{[^}]+\}|\{[^}]+\}", "{}", m.group(3).replace("/api", "").split("?")[0]).rstrip("/")
        by_path.setdefault(norm, []).append((m.group(1), m.group(2)))
    return by_path


def main() -> int:
    consts = permission_constants()
    guards, routes = handlers()
    by_path = client_methods()
    written = written_tables()

    entries, skipped = [], []
    for handler, route in sorted(routes.items()):
        guard = guards.get(handler)
        if not guard or guard["stub"] or not guard["perm"]:
            continue
        permission = consts.get(guard["perm"])
        if not permission:
            skipped.append((handler, "permission constant not found"))
            continue
        # A document whose every source table is writerless can only ever
        # print blank. Tables the handler reads but nothing populates are
        # listed so the exclusion is arguable rather than silent.
        read = guard["tables"]
        dead = {t for t in read if t not in written}
        if read and dead == read:
            skipped.append((handler, f"reads only writerless tables: {', '.join(sorted(dead))}"))
            continue

        norm = re.sub(r"\{[^}]+\}", "{}", route.replace("/api", "")).rstrip("/")
        single = [c for c in by_path.get(norm, []) if c[1].count(",") == 0]
        if not single:
            skipped.append((handler, "no single-argument client method"))
            continue
        segment = route.replace("/api/print-data/", "").split("/{")[0]
        key = segment.replace("/", ".")
        if key in ALREADY_HAND_WRITTEN:
            continue
        param = re.search(r"\{(\w+)\}", route)
        label = re.sub(
            r"(^|[._])(\w)",
            lambda m: (" " if m.group(1) else "") + m.group(2).upper(),
            segment.split("/")[-1].replace("-", "_"),
        ).strip()
        kind = ID_KIND.get(param.group(1) if param else "", "record")
        if kind == "order":
            kind = ORDER_KIND_BY_PREFIX.get(segment.split("/")[0], "order")
        entries.append({
            "key": key, "label": label, "method": single[0][0], "permission": permission,
            "idKind": kind,
        })

    body = "\n".join(
        f'  {{\n    key: "{e["key"]}",\n    label: "{e["label"]}",\n'
        f'    idKind: "{e["idKind"]}",\n    permission: "{e["permission"]}",\n'
        f'    fetch: (id) => api.{e["method"]}(id),\n  }},'
        for e in entries
    )
    OUT.write_text(
        "// GENERATED by scripts/generate_print_registry.py — do not edit by hand.\n"
        "//\n"
        "// Each permission is the one its own handler enforces, read from\n"
        "// crates/medbrains-core/src/permissions.rs. Handlers that return\n"
        "// NotImplemented, carry no permission, or need more than one id are\n"
        "// excluded: a button that 501s or 403s is worse than no button.\n"
        'import { api } from "@medbrains/api";\n\n'
        'import type { PrintDocumentDef } from "./print-registry";\n\n'
        "export const GENERATED_PRINT_DOCUMENTS: readonly PrintDocumentDef[] = [\n"
        f"{body}\n];\n"
    )
    print(f"wrote {len(entries)} documents to {OUT.relative_to(ROOT)}")
    print(f"skipped {len(skipped)}:")
    for handler, why in skipped:
        print(f"  {handler}: {why}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
