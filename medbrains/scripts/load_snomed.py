#!/usr/bin/env python3
"""Load a SNOMED CT release into `snomed_codes`.

    python3 scripts/load_snomed.py --release ~/Downloads/SnomedCT_IndiaRF2 --dry-run
    python3 scripts/load_snomed.py --release ~/Downloads/SnomedCT_IndiaRF2

Everything around this table already exists — a GIN trigram index on
`display_name`, the `pg_trgm` extension, `/api/opd/snomed/search`, and the
terminology service's `official_release_cache` provider mode. The table is
simply empty, so every search returns nothing. This fills it.

## Before you run this: the licence

SNOMED CT is licensed content, not open data.

**In India it is free**, under the national licence held by NRCeS (C-DAC) —
register the organisation at nrces.in and download the India Edition. That
national licence is a genuine saving: an affiliate licence elsewhere is
charged per country and per use.

Outside India, an affiliate licence from SNOMED International is required, and
member countries (UK, US, Australia, and others) have their own free national
provisions.

This script does not check your licence and cannot. Loading the content
without one is a licensing breach, not a technical error.

## What it reads

The RF2 *snapshot* files, which give the current state of each concept rather
than its full history:

    Terminology/sct2_Concept_Snapshot_*.txt
    Terminology/sct2_Description_Snapshot_*.txt

Full and delta releases also exist. Snapshot is the right one here: `full`
carries every historical version of every concept and would load millions of
superseded rows, and `delta` only carries what changed since the last release,
so it cannot populate an empty table.
"""

from __future__ import annotations

import argparse
import csv
import glob
import io
import os
import re
import subprocess
import sys

# RF2 description type identifiers.
#
# A concept has one Fully Specified Name and any number of synonyms. The FSN is
# what belongs in `display_name`: it is unambiguous and carries the semantic
# tag, whereas synonyms are shorter but can collide across concepts —
# "cold" is a symptom, a temperature and an infection.
FSN_TYPE = "900000000000003001"

# The FSN ends with its semantic tag in brackets:
#   "Diabetes mellitus (disorder)"  ->  disorder
# The tag is what lets a diagnosis picker offer disorders and findings while a
# procedure picker offers procedures, instead of showing a clinician all
# 350,000 concepts at once.
SEMANTIC_TAG = re.compile(r"\(([^()]+)\)\s*$")

BATCH = 5_000


def find_file(release_dir: str, pattern: str) -> str:
    """The one snapshot file matching a pattern.

    RF2 releases nest the terminology a few directories down and stamp the
    filenames with the release date, so the path cannot be hard-coded.
    """
    matches = glob.glob(
        os.path.join(release_dir, "**", pattern), recursive=True
    )
    # Snapshot files sit beside Full and Delta ones with similar names; the
    # pattern already pins Snapshot, so more than one match means an unpacked
    # release containing several editions.
    if not matches:
        raise SystemExit(
            f"no file matching {pattern} under {release_dir}\n"
            "expected an unpacked RF2 release — the directory containing "
            "Snapshot/Terminology/"
        )
    if len(matches) > 1:
        raise SystemExit(
            f"{len(matches)} files match {pattern}:\n  "
            + "\n  ".join(matches)
            + "\npoint --release at a single edition"
        )
    return matches[0]


def active_concepts(path: str) -> set[str]:
    """Concept ids that are current in this release.

    Inactive concepts are retired — misspellings, duplicates, and concepts
    withdrawn as clinically wrong. Offering one in a diagnosis picker means a
    record coded to something SNOMED has since said should not be used.
    """
    active: set[str] = set()
    with open(path, encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle, delimiter="\t"):
            if row.get("active") == "1":
                active.add(row["id"])
    return active


def fully_specified_names(path: str, active: set[str]) -> dict[str, tuple[str, str | None]]:
    """`concept id -> (display name, semantic tag)` for active concepts.

    Both the description *and* its concept must be active: a live description
    can hang off a retired concept, and loading those would resurrect exactly
    the concepts the release retired.
    """
    names: dict[str, tuple[str, str | None]] = {}
    with open(path, encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle, delimiter="\t"):
            if row.get("active") != "1" or row.get("typeId") != FSN_TYPE:
                continue
            concept_id = row["conceptId"]
            if concept_id not in active:
                continue
            term = row["term"].strip()
            match = SEMANTIC_TAG.search(term)
            tag = match.group(1).strip() if match else None
            names[concept_id] = (term, tag)
    return names


def load(rows: list[tuple[str, str, str | None]], database_url: str, batch: int) -> int:
    """Insert via COPY into a staging table, then merge.

    A release is ~350,000 concepts. Inserting them one statement at a time is
    hundreds of thousands of round trips; COPY into an unlogged staging table
    followed by one INSERT ... ON CONFLICT is two.

    The merge is an upsert rather than a truncate-and-reload so that a code
    already referenced by a diagnosis keeps its row: `diagnoses.snomed_code`
    points at these, and deleting one out from under a patient record would
    leave a coded diagnosis that no longer resolves to anything.
    """
    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter="\t", quoting=csv.QUOTE_MINIMAL)
    for code, display, tag in rows:
        writer.writerow([code, display, tag or "\\N"])
    buffer.seek(0)

    sql = f"""
BEGIN;
CREATE TEMP TABLE snomed_stage (
    code text, display_name text, semantic_tag text
) ON COMMIT DROP;
COPY snomed_stage (code, display_name, semantic_tag) FROM STDIN WITH (FORMAT text, NULL '\\N');
{buffer.getvalue()}\\.
INSERT INTO snomed_codes (code, display_name, semantic_tag, is_active)
SELECT code, display_name, semantic_tag, true FROM snomed_stage
ON CONFLICT (code) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    semantic_tag = EXCLUDED.semantic_tag,
    is_active    = true,
    deleted_at   = NULL;
COMMIT;
"""
    result = subprocess.run(
        ["psql", database_url, "-v", "ON_ERROR_STOP=1", "-q"],
        input=sql,
        text=True,
        capture_output=True,
    )
    if result.returncode != 0:
        raise SystemExit(f"load failed:\n{result.stderr[:1000]}")
    return len(rows)


def retire_absent(codes: set[str], database_url: str) -> None:
    """Mark codes absent from this release inactive.

    Not deleted. A concept retired by SNOMED may still be referenced by a
    diagnosis recorded years ago, and that record must keep resolving — the
    code was correct when it was used. Marking it inactive keeps it out of the
    picker (`WHERE is_active = true`) while leaving history readable.
    """
    if not codes:
        return
    listed = ",".join(f"'{c}'" for c in sorted(codes))
    sql = (
        "UPDATE snomed_codes SET is_active = false "
        f"WHERE is_active = true AND code NOT IN ({listed});"
    )
    subprocess.run(
        ["psql", database_url, "-v", "ON_ERROR_STOP=1", "-q", "-c", sql],
        text=True,
        check=True,
        capture_output=True,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--release",
        required=True,
        help="unpacked RF2 release directory (the one containing Snapshot/)",
    )
    parser.add_argument(
        "--database-url",
        default=os.environ.get(
            # 5435, not 5432: the compose file maps the container that way, and a
            # host Postgres on the default port will happily accept the
            # connection and then report that the database does not exist.
            "DATABASE_URL",
            "postgres://medbrains:medbrains@localhost:5435/medbrains",
        ),
    )
    parser.add_argument("--batch", type=int, default=BATCH)
    parser.add_argument("--dry-run", action="store_true", help="report, load nothing")
    parser.add_argument(
        "--keep-retired-active",
        action="store_true",
        help="skip deactivating codes absent from this release",
    )
    args = parser.parse_args()

    concept_file = find_file(args.release, "sct2_Concept_Snapshot_*.txt")
    description_file = find_file(args.release, "sct2_Description_Snapshot_*.txt")
    print(f"concepts:     {concept_file}")
    print(f"descriptions: {description_file}")

    active = active_concepts(concept_file)
    print(f"  {len(active):,} active concepts")

    names = fully_specified_names(description_file, active)
    print(f"  {len(names):,} with a fully specified name")

    missing = len(active) - len(names)
    if missing:
        # Every active concept should have exactly one active FSN. A gap means
        # the two files come from different releases, which would load a
        # partial terminology and look like a successful run.
        print(
            f"  WARNING: {missing:,} active concepts have no active FSN — "
            "check that both files are from the same release"
        )

    rows = [(code, display, tag) for code, (display, tag) in names.items()]

    tags: dict[str, int] = {}
    for _, _, tag in rows:
        key = tag or "(untagged)"
        tags[key] = tags.get(key, 0) + 1
    print("\n  by semantic tag:")
    for tag, count in sorted(tags.items(), key=lambda kv: -kv[1])[:12]:
        print(f"    {count:>8,}  {tag}")

    if args.dry_run:
        print("\n  sample:")
        for code, display, tag in rows[:5]:
            print(f"    {code}  {display[:70]}  [{tag}]")
        print(f"\ndry run — would load {len(rows):,} concepts")
        return 0

    loaded = 0
    for start in range(0, len(rows), args.batch):
        loaded += load(rows[start : start + args.batch], args.database_url, args.batch)
        print(f"  {loaded:>8,}/{len(rows):,}")

    if not args.keep_retired_active:
        retire_absent({code for code, _, _ in rows}, args.database_url)
        print("  codes absent from this release marked inactive (not deleted)")

    print(f"\nloaded {loaded:,} concepts")
    return 0


if __name__ == "__main__":
    sys.exit(main())
