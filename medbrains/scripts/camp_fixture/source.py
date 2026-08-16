"""Reading the camp extract.

The source is `forms.db`, the SQLite database behind the camp review site at
camp1.amh.org.in, where clinicians are still correcting the OCR by hand. It is
the only artefact that is actually live:

    live/forms.db        1,542 forms   4,374 human corrections   645 reviewed
    forms_new_v5.xlsx    1,542 rows    a snapshot, already 4,302 corrections behind
    camp.duckdb          1,542 rows    built from forms_new_v3.xlsx, staler again

Using the spreadsheet costs real clinical accuracy, and not at the margins.
Among the corrections it is missing:

    blood_pressure   180/80 -> 120/80    the scan invented a hypertensive
    pulse            226    -> 92 b/m    a tachycardia that never happened
    chief_complaints "Dorveness" -> "nervousness"
    advice           "5. pan 40mg -10-0" -> "T pan 40mg -1-0-0"

So `corrected` wins over `value` everywhere, and a re-pull picks up whatever
has been reviewed since. Refresh with:

    scp -i <pem> ubuntu@<camp-host>:/opt/camp/forms.db live/forms.db
"""

from __future__ import annotations

import os
import sqlite3

DEFAULT_DB = os.path.expanduser("~/Projects/form-extract/live/forms.db")

# forms.db names its fields without units; the rest of the loader expects the
# keys on the left. Anything not listed passes through under its own name.
FIELD_ALIASES = {
    "weight": "weight_kg",
    "height": "height_cm",
    "temperature": "temperature_c",
    "test_cbg": "test_cbg (mg/dl)",
    "test_hba1c": "test_hba1c (%)",
    "test_haemoglobin": "test_haemoglobin (g/dl)",
}


def read_rows(path: str = DEFAULT_DB, limit: int = 0) -> list[dict]:
    """Every camp form as a flat dict of its corrected field values.

    One query for the forms and one for the fields, joined in memory. The
    alternative — a query per form — is 1,542 round trips to answer a question
    two scans already answer.
    """
    if not os.path.exists(path):
        raise SystemExit(
            f"camp database not found at {path}\n"
            "pull the live one:  scp -i <pem> ubuntu@<camp-host>:/opt/camp/forms.db live/forms.db"
        )
    connection = sqlite3.connect(f"file:{path}?mode=ro", uri=True)

    forms: dict[int, dict] = {}
    order: list[int] = []
    for form_id, src, uhid, reviewed in connection.execute(
        "SELECT id, source, uhid, reviewed_at FROM form ORDER BY id"
    ):
        forms[form_id] = {
            "source": src,
            "register_no_uhid": uhid,
            # Whether a human has been over this form. 645 of 1,542 have, and
            # a load can be restricted to those with --reviewed-only.
            "reviewed_at": reviewed,
        }
        order.append(form_id)

    for form_id, name, value, corrected in connection.execute(
        "SELECT form_id, name, value, corrected FROM field"
    ):
        form = forms.get(form_id)
        if form is None:
            continue
        # The human correction is the answer whenever there is one.
        best = (corrected or "").strip() or (value or "").strip()
        form[FIELD_ALIASES.get(name, name)] = best
    connection.close()

    rows = [forms[i] for i in order]
    return rows[:limit] if limit else rows


def only_reviewed(rows: list[dict]) -> list[dict]:
    """The forms a clinician has actually signed off.

    645 of 1,542. Worth having as an option: the reviewed subset is the
    closest thing to ground truth in the whole extract, so a load restricted
    to it is testing the system rather than testing the scanner.
    """
    return [row for row in rows if row.get("reviewed_at")]


def describe(rows: list[dict]) -> list[str]:
    """Fill rates for the columns the load depends on.

    Printed before anything is sent, so a load against a stale or wrong
    database is obvious immediately rather than after the fact.
    """
    interesting = [
        "full_name",
        "age",
        "gender",
        "chief_complaints",
        "diagnosis",
        "icd_codes",
        "prescription_advice",
        "medical_history_notes",
        "departments",
        "referral_department",
        "blood_pressure",
    ]
    total = max(len(rows), 1)
    lines = []
    for column in interesting:
        present = sum(1 for row in rows if row.get(column) not in (None, "", "-"))
        lines.append(f"  {column:<24} {present:>5,}/{len(rows):,}  {100 * present / total:>3.0f}%")
    reviewed = sum(1 for row in rows if row.get("reviewed_at"))
    lines.append(f"  {'(reviewed by a human)':<24} {reviewed:>5,}/{len(rows):,}"
                 f"  {100 * reviewed / total:>3.0f}%")
    return lines
