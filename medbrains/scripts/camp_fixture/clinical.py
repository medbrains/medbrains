"""Turning a scanned camp form into clinical content that is safe to load.

The source is an OCR extract of handwritten paper forms, and it is wrong in
ways that matter. Measured across the 1,542-row August 2026 extract:

    spo2 (%)            median 98      max 21,010
    weight (kg)         median 57.4    max 89,169
    test_cbg (mg/dl)    median 115     max 2,166,000,000
    height (cm)         median 1       max 5,100
    temperature (C)     133 rows hold the literal "1"

The temperature column is the clearest case: it is not a temperature at all,
it is a checkbox mark that the extractor put in a column labelled Celsius. A
patient at 1 degrees Celsius is a corpse, and 133 of them would be loaded
without a word if the number were simply parsed and sent.

So nothing numeric is trusted for being numeric. Every reading is checked
against the range a living person can occupy, and anything outside it is
dropped and counted rather than loaded. A dropped reading leaves the field
absent, which is honest — the camp did not measure it, or measured it
illegibly. Coercing it to 0 would be worse than losing it: 0 mmHg systolic
reads as cardiac arrest, and 0 kg reads as nothing at all.

Text is treated differently. `medical_history_notes` reads "He underwrnt angro
plasay" and the drug column reads "Tab. MONTEH-IC OD- 3days"; that noise is
kept verbatim. It is what a clinician typing up a camp form actually faces,
and a system that only works against clean strings has not been tested.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

# ── physiological ranges ────────────────────────────────────────────────────
#
# Deliberately wide: the job here is to exclude the impossible, not to
# second-guess the clinician. A pulse of 210 is a real tachycardia and is
# kept; a pulse of 2,100 is an extraction artefact and is not. Bounds are
# inclusive and cover paediatric through geriatric, because a camp sees both —
# the youngest in this extract is 0 and the oldest 95.

RANGES: dict[str, tuple[float, float]] = {
    "age": (0, 120),
    "height_cm": (40, 250),
    "weight_kg": (1.5, 300),
    "systolic_bp": (50, 300),
    "diastolic_bp": (20, 200),
    "spo2": (50, 100),
    "pulse": (25, 250),
    "temperature_c": (30, 45),
    "cbg_mg_dl": (20, 900),
    "hba1c_pct": (3, 20),
    "haemoglobin_g_dl": (2, 25),
}


@dataclass
class Rejects:
    """What was dropped, so a load can report it instead of hiding it."""

    by_field: dict[str, int] = field(default_factory=dict)
    samples: dict[str, list[str]] = field(default_factory=dict)

    def note(self, name: str, raw: object) -> None:
        self.by_field[name] = self.by_field.get(name, 0) + 1
        held = self.samples.setdefault(name, [])
        if len(held) < 4:
            held.append(str(raw)[:40])

    def report(self) -> list[str]:
        return [
            f"{count:>5,}x  {name:<18} e.g. {', '.join(self.samples.get(name, []))}"
            for name, count in sorted(self.by_field.items(), key=lambda kv: -kv[1])
        ]


def reading(name: str, raw: object, rejects: Rejects) -> float | None:
    """A measurement, or None when it could not have come from a person.

    `name` must be a key in RANGES — an unknown field is a programming error
    rather than a data error, so it raises instead of silently passing the
    value through unchecked.
    """
    low, high = RANGES[name]
    if raw in (None, "", "-"):
        return None
    # A trailing unit is allowed because the humans correcting the forms write
    # one: `pulse` comes back as "92 b/m", `weight` as "64.5 kg". Rejecting
    # those would discard 248 corrected pulses in favour of the OCR's guess,
    # which is the opposite of the point.
    match = re.fullmatch(r"\s*(\d+(?:\.\d+)?)\s*[a-zA-Z/%°.]*\s*", str(raw))
    if not match:
        rejects.note(f"{name} (unparseable)", raw)
        return None
    value = float(match.group(1))
    if not low <= value <= high:
        rejects.note(f"{name} (out of range)", raw)
        return None
    return value


def integer(name: str, raw: object, rejects: Rejects) -> int | None:
    value = reading(name, raw, rejects)
    return None if value is None else int(round(value))


def blood_pressure(raw: object, rejects: Rejects) -> tuple[int | None, int | None]:
    """Systolic and diastolic from one written reading.

    86% of the extract's 1,443 readings are a clean `140/90`. The rest are
    OCR damage — `160lcoommHg`, `13olfommiHg`, `!bo!ammmtg` — and are dropped
    whole rather than half-read, because a systolic with an invented diastolic
    is more dangerous than no reading.

    A pair where systolic does not exceed diastolic is also dropped: it is
    physically impossible and appears once in the real extract.
    """
    if raw in (None, "", "-"):
        return None, None
    # `mmHg` is allowed: 145 readings corrected by hand write the unit out,
    # and rejecting them threw away real measurements — including a "150/90
    # mmHg" that is stage 2 hypertension.
    match = re.fullmatch(r"\s*(\d{2,3})\s*/\s*(\d{2,3})\s*(?:mm\s*hg)?\s*", str(raw), re.IGNORECASE)
    if not match:
        rejects.note("blood_pressure (unreadable)", raw)
        return None, None
    systolic = integer("systolic_bp", match.group(1), rejects)
    diastolic = integer("diastolic_bp", match.group(2), rejects)
    if systolic is None or diastolic is None:
        return None, None
    if systolic <= diastolic:
        rejects.note("blood_pressure (systolic<=diastolic)", raw)
        return None, None
    return systolic, diastolic


# ── history ─────────────────────────────────────────────────────────────────

# The tick-box comorbidities, in the order a clinician reads them off the form.
HISTORY_FLAGS: dict[str, str] = {
    "mh_diabetes": "Diabetes",
    "mh_hypertension": "Hypertension",
    "mh_heart_disease": "Heart disease",
    "mh_asthma": "Asthma",
    "mh_thyroid_disorders": "Thyroid disorder",
    "mh_allergies": "Allergies",
    "mh_previous_surgeries": "Previous surgeries",
    "mh_smoking_history": "Smoking history",
    "mh_alcohol_use": "Alcohol use",
    "mh_family_history": "Family history",
    "mh_others": "Other",
}


def is_ticked(raw: object) -> bool:
    return str(raw or "").strip().lower() in {"yes", "y", "true", "1"}


def history(row: dict) -> str | None:
    """Past history as one readable block — the S of SOAP.

    Ticked boxes first, then whatever the clinician wrote. The free text is
    reproduced exactly, OCR damage and all: "He cundelwemtoplasa" is what is
    on the form, and a nurse reconciling the record needs to see the same
    string the scanner saw, not a guess at what it meant.
    """
    ticked = [label for column, label in HISTORY_FLAGS.items() if is_ticked(row.get(column))]
    parts: list[str] = []
    if ticked:
        parts.append("Known: " + ", ".join(ticked) + ".")
    notes = clean(row.get("medical_history_notes"))
    if notes:
        parts.append(f"As recorded: {notes}")
    return " ".join(parts) or None


# ── objective ───────────────────────────────────────────────────────────────

TESTS: dict[str, str] = {
    "test_cbg (mg/dl)": "Capillary blood glucose",
    "test_hba1c (%)": "HbA1c",
    "test_haemoglobin (g/dl)": "Haemoglobin",
    "test_thyroid": "Thyroid",
    "test_ecg": "ECG",
    "test_xray": "X-ray",
    "test_bmd": "Bone mineral density",
    "test_biothesiometry": "Biothesiometry",
}

# The three tests that are numeric; the rest are read as findings.
NUMERIC_TESTS = {
    "test_cbg (mg/dl)": ("cbg_mg_dl", "mg/dL"),
    "test_hba1c (%)": ("hba1c_pct", "%"),
    "test_haemoglobin (g/dl)": ("haemoglobin_g_dl", "g/dL"),
}


def examination(row: dict, rejects: Rejects) -> str | None:
    """Point-of-care results as the O of SOAP.

    Numeric tests are range-checked like any other reading — `test_cbg` tops
    out at 2.166 billion mg/dL in the raw extract, which is not a glucose.
    The qualitative ones ("Nooma", "orma" — both a scanner's attempt at
    "Normal") are passed through as written and marked as read from the form,
    so nobody mistakes them for a verified result.
    """
    lines: list[str] = []
    for column, label in TESTS.items():
        raw = clean(row.get(column))
        if raw is None:
            continue
        if column in NUMERIC_TESTS:
            key, unit = NUMERIC_TESTS[column]
            value = reading(key, raw, rejects)
            if value is not None:
                lines.append(f"{label}: {value:g} {unit}")
            continue
        lines.append(f"{label}: {raw} (as read from form)")
    return "\n".join(lines) or None


# ── plan ────────────────────────────────────────────────────────────────────

# `1-0-1`, `0-0-1`, `1/2-0-1/2` — the morning-noon-night notation every Indian
# prescription uses.
DOSE_PATTERN = re.compile(r"\b(\d(?:/\d)?-\d(?:/\d)?-\d(?:/\d)?)\b")
# `OD`, `BD`, `TDS`, `QID`, `HS`, `SOS`, `STAT`.
LATIN_FREQUENCY = re.compile(r"\b(OD|BD|TDS|TID|QID|QDS|HS|SOS|STAT|PRN)\b", re.IGNORECASE)
# `3days`, `5 days`, `2 weeks` — and `gdays`, because the scanner reads the
# leading digit as a letter often enough that dropping those would leave the
# fragment stuck to the drug name ("BARULAV -gdays").
DURATION = re.compile(r"\b(\w{1,3})\s*(days?|weeks?|months?)\b", re.IGNORECASE)
# Leading form markers and enumeration the OCR carried over: "5. Tab. pan 40mg".
LEADING_NOISE = re.compile(r"^\s*(?:\d+[.)]\s*)?(?:tab\.?|cap\.?|syp\.?|inj\.?|syr\.?)\s*", re.IGNORECASE)


def prescription_items(raw: object) -> list[dict]:
    """The advice column parsed into prescription lines.

    Real values look like `Tab. MONTEH-IC OD- 3days. Tab. BARULAV BD-gdays`
    and `nulti vitramn 10-1. pan -4g -10-1 Zincovit 10-1`. Drug names are
    frequently misread, and that is kept — a pharmacist reconciling a camp
    prescription against stock is exactly the workflow being tested, and it
    only exists because the name is uncertain.

    What is *not* invented is dosing. Where the form states a schedule it is
    carried across; where it does not, the field says so rather than
    defaulting to a plausible-looking `1-0-1`. A fabricated frequency on a
    real prescription is a dosing error with a straight face.
    """
    text = clean(raw)
    if not text:
        return []

    items: list[dict] = []
    for chunk in split_drugs(text):
        name = chunk
        dose = DOSE_PATTERN.search(chunk)
        latin = LATIN_FREQUENCY.search(chunk)
        span = DURATION.search(chunk)

        for match in (dose, latin, span):
            if match:
                name = name.replace(match.group(0), " ")
        name = LEADING_NOISE.sub("", name)
        # Collapse the gaps the removals left, then shed the punctuation they
        # stranded — "BARULAV  -" is the drug plus the hyphen that joined it
        # to a duration that is no longer there.
        name = re.sub(r"\s{2,}", " ", name).strip(" .,-–—:").strip()
        if not name or len(name) < 2:
            continue

        frequency = dose.group(1) if dose else (latin.group(1).upper() if latin else None)
        items.append(
            {
                "drug_name": name[:120],
                # The form is the authority. "As written" is a truthful
                # placeholder; a made-up dose is not.
                "dosage": "as written",
                "frequency": frequency or "as written",
                "duration": span.group(0) if span else "as written",
                "instructions": f"Transcribed from camp form: {chunk.strip()[:160]}",
            }
        )
    return items


def split_drugs(text: str) -> list[str]:
    """One advice string into separate drugs.

    Split on the form markers (`Tab.`, `Syp.`, `Cap.`) and on newlines, since
    those are the only reliable separators — a full stop is as likely to be
    inside `pan 40mg -1-0-0.` as between two drugs.
    """
    marked = re.sub(r"(?i)\b(tab\.?|cap\.?|syp\.?|syr\.?|inj\.?)\s*", r"\n\1 ", text)
    chunks = [c.strip() for c in re.split(r"[\n;]+", marked) if c.strip()]
    # No form markers at all — "Glycomet Neevrenen Rantac Montak" is four
    # drugs on one line, and there is no honest way to split it, so it stays
    # whole and the transcription note carries the original.
    return chunks or [text]


def plan(row: dict) -> str | None:
    """The P of SOAP: advice as written, plus where the patient was sent."""
    parts: list[str] = []
    advice = clean(row.get("prescription_advice"))
    if advice:
        parts.append(f"Advice as written on the camp form: {advice}")
    departments = clean(row.get("departments"))
    if departments:
        parts.append(f"Seen by: {departments}.")
    referral = clean(row.get("referral_department"))
    if referral:
        doctor = clean(row.get("referral_doctor"))
        suffix = f" (Dr {doctor})" if doctor else ""
        parts.append(f"Referred to {referral}{suffix}.")
    return " ".join(parts) or None


def diagnoses(row: dict) -> list[dict]:
    """Coded diagnoses, first one primary.

    `icd_codes` holds `Z00.0` or `J00, R50.9`. The code is kept as the code
    and the free-text `diagnosis` as the description — never swapped, because
    a description in an ICD field silently corrupts every downstream report
    that groups by code.
    """
    codes = [c.strip() for c in (clean(row.get("icd_codes")) or "").split(",") if c.strip()]
    described = clean(row.get("diagnosis"))
    if not codes:
        return [{"description": described, "is_primary": True}] if described else []
    return [
        {
            "icd_code": code,
            # The API accepts "icd10" | "icd11" | "snomed"; the camp forms
            # are coded in ICD-10 ("Z00.0", "J00", "R50.9").
            "icd_system": "icd10",
            # The written diagnosis describes the visit as a whole, so it
            # belongs to the primary code only.
            "description": (described if index == 0 and described else code),
            "is_primary": index == 0,
        }
        for index, code in enumerate(codes)
    ]


def clean(raw: object) -> str | None:
    """A trimmed string, or None for the several ways this extract says empty."""
    if raw is None:
        return None
    text = str(raw).strip()
    return None if text in {"", "-", "--", "n/a", "N/A", "nil", "Nil"} else text
