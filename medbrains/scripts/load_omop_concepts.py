#!/usr/bin/env python3
"""Load OMOP concept ids for research exports from an OHDSI Athena download.

    python3 scripts/load_omop_concepts.py /path/to/athena-download

The OMOP research bundle (medbrains-research `omop`) fills standard concept ids
from `omop_concept_map` where it can. This fills that table from the
CONCEPT.csv and CONCEPT_RELATIONSHIP.csv of an Athena vocabulary download
(tab-separated, as Athena ships them), keeping **licence-free vocabularies
only**: ICD10, LOINC, ATC, RxNorm, RxNorm Extension, UCUM. Rows of any other
vocabulary (SNOMED, CPT4, MedDRA, ...) are skipped and counted, never loaded.

For each source code it keeps its own concept id and, when Athena has a
"Maps to" relationship, the standard concept it maps to. The table is
replaced whole, in one transaction, so a failed load leaves the previous map.

Connects with MIGRATION_DATABASE_URL (or DATABASE_URL): the table is a global
catalogue, written by the owner. Setup tool with no screen of its own; it
unblocks standard concept ids in Admin → Research data exports (OMOP).
"""

from __future__ import annotations

import csv
import os
import subprocess
import sys
import tempfile
from pathlib import Path

ALLOWED = {"ICD10", "LOINC", "ATC", "RxNorm", "RxNorm Extension", "UCUM"}
csv.field_size_limit(1 << 24)


def rows(path: Path):
    with path.open(newline="", encoding="utf-8") as f:
        yield from csv.DictReader(f, delimiter="\t", quoting=csv.QUOTE_NONE)


def build(folder: Path) -> tuple[list[tuple[str, str, str, str]], int]:
    """(vocabulary, code, source concept, standard concept) rows, and skipped."""
    concepts: dict[str, tuple[str, str]] = {}
    skipped = 0
    for r in rows(folder / "CONCEPT.csv"):
        if r["vocabulary_id"] in ALLOWED:
            concepts[r["concept_id"]] = (r["vocabulary_id"], r["concept_code"])
        else:
            skipped += 1
    maps_to: dict[str, str] = {}
    for r in rows(folder / "CONCEPT_RELATIONSHIP.csv"):
        if r["relationship_id"] == "Maps to" and r["concept_id_1"] in concepts and not r.get("invalid_reason"):
            maps_to.setdefault(r["concept_id_1"], r["concept_id_2"])
    out = [(v, code, cid, maps_to.get(cid, "")) for cid, (v, code) in concepts.items()]
    return out, skipped


def load(out: list[tuple[str, str, str, str]], version: str) -> None:
    url = os.environ.get("MIGRATION_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if not url:
        sys.exit("set MIGRATION_DATABASE_URL or DATABASE_URL")
    with tempfile.NamedTemporaryFile("w", suffix=".tsv", delete=False, encoding="utf-8") as tsv:
        for v, code, cid, std in out:
            tsv.write(f"{v}\t{code}\t{cid}\t{std or chr(92) + 'N'}\t{version}\n")
    script = (
        "BEGIN;\n"
        "DELETE FROM omop_concept_map;\n"
        "\\copy omop_concept_map (vocabulary_id, concept_code, source_concept_id, "
        f"standard_concept_id, vocabulary_version) FROM '{tsv.name}'\n"
        "COMMIT;\n"
    )
    try:
        subprocess.run(["psql", url, "-v", "ON_ERROR_STOP=1", "-q"], input=script, text=True, check=True)
    finally:
        os.unlink(tsv.name)


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    folder = Path(sys.argv[1])
    out, skipped = build(folder)
    version = (folder / "VOCABULARY.csv").exists() and "athena" or "unknown"
    load(out, version)
    mapped = sum(1 for r in out if r[3])
    print(f"loaded {len(out)} codes ({mapped} with a standard concept); skipped {skipped} rows of licensed or other vocabularies")


if __name__ == "__main__":
    main()
