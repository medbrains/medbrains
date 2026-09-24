#!/usr/bin/env python3
"""Find printed documents that invent their contents.

A print handler builds a document somebody signs, files, or hands to a
regulator. Two were found fabricating clinical facts on 2026-09-21: the WHO
surgical safety checklist returned every item `true`, and the restraint record
invented its nursing monitoring rounds. Both were legal evidence about a
patient, written by nobody.

This flags the shape that produces them: a literal assigned to a field in the
struct the handler returns, rather than a value read from a row. It is a
heuristic — a hardcoded hospital label or a unit string is fine — so it ranks
rather than judges, and a human reads the list.
"""

import os
import re
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..", "crates", "medbrains-print-data", "src")

# Words that make a literal clinical rather than cosmetic.
CLINICAL = re.compile(
    r"check|verif|consent|allerg|monitor|circulation|hydrat|toilet|position|"
    r"assess|reviewed|complete|correct|count|identity|site|marked|given|"
    r"administered|witness|signed|compliance|screen|performed|observed",
    re.I,
)

# Fields that name which form is printing rather than asserting a fact about a
# patient. `consent_type: "general_admission"` says which consent this is; it
# is not a claim that anybody consented.
FORM_IDENTIFIER_FIELDS = {"consent_type", "form_type", "document_type", "report_type"}

# In a hospital "sample" is also a tube of blood, so the word alone is not a
# confession. `// Generate barcode data for sample collection` is a barcode,
# not a fabrication.
SAMPLE_VOCABULARY = re.compile(r"sample[_ ](collection|collected|type|id|barcode|number|rejection)", re.I)

# `field: true,` / `field: "Some sentence".to_string(),` / vec![" … "]
# Only `true` is dangerous. A hardcoded `false` prints a blank checkbox, which
# is a document admitting nobody has done the thing — the honest direction, and
# the discharge checklist is deliberately built that way.
LITERAL_BOOL = re.compile(r"^\s*(\w+):\s*true,\s*$")
LITERAL_STR = re.compile(r'^\s*(\w+):\s*"([^"]{3,})"\.to_(string|owned)\(\),\s*$')
LITERAL_VEC = re.compile(r'^\s*(\w+):\s*vec!\[\s*$')
SUSPECT_COMMENT = re.compile(r"sample|in practice|would be fetched|placeholder|dummy|for now", re.I)
# A note explaining that a fabrication was removed is not a fabrication. Once
# a handler is fixed, its comment says so, and the check must stop shouting
# about it or nobody reads the list.
REMEDIATION = re.compile(
    r"invented|deleted rather than|used to|no longer|stopped|rather than assuming|"
    r"prints as empty|nothing is claimed",
    re.I,
)


def handler_at(lines, index):
    """The nearest `pub async fn` above this line."""
    for i in range(index, -1, -1):
        m = re.match(r"pub async fn (\w+)", lines[i])
        if m:
            return m.group(1)
    return "?"


def main() -> int:
    findings: dict[tuple[str, str], list[str]] = {}
    for name in sorted(os.listdir(ROOT)):
        if not name.endswith(".rs"):
            continue
        path = os.path.join(ROOT, name)
        lines = open(path, encoding="utf-8", errors="ignore").read().split("\n")
        for i, line in enumerate(lines):
            note = None
            if (
                SUSPECT_COMMENT.search(line)
                and line.strip().startswith("//")
                and not REMEDIATION.search(line)
                and not SAMPLE_VOCABULARY.search(line)
            ):
                note = f"comment: {line.strip()[:70]}"
            else:
                for pattern in (LITERAL_BOOL, LITERAL_STR, LITERAL_VEC):
                    m = pattern.match(line)
                    if (
                        m
                        and CLINICAL.search(m.group(1))
                        and m.group(1) not in FORM_IDENTIFIER_FIELDS
                    ):
                        note = f"{m.group(1)} = {line.strip()[:60]}"
                        break
            if note:
                key = (name, handler_at(lines, i))
                findings.setdefault(key, []).append(f"  {name}:{i + 1}  {note}")

    if not findings:
        print("no printed document appears to invent its contents")
        return 0

    print(f"{len(findings)} handler(s) assign clinical values from literals:\n")
    for (name, handler), hits in sorted(findings.items(), key=lambda kv: -len(kv[1])):
        print(f"{handler}  ({name}, {len(hits)} literal(s))")
        for hit in hits[:6]:
            print(hit)
        if len(hits) > 6:
            print(f"  … {len(hits) - 6} more")
        print()
    print("A document that states a clinical fact nobody recorded is fabricated")
    print("evidence. Read each: print what the record holds, or print nothing.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
