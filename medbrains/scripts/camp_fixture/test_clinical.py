"""Tests for the camp extract loader.

    python3 scripts/camp_fixture/test_clinical.py

Every case below is a value that appears in the real August 2026 extract, or
a boundary the extract sits on. The point is not coverage — it is that the
specific ways this data is wrong stay handled, because each one of them, left
alone, puts a false clinical fact in a patient record:

    a 1 degrees temperature      133 forms, a checkbox read as Celsius
    a 21,010% oxygen saturation  a scanner reading a smudge
    an 89,169 kg weight          the same
    "160lcoommHg"                a blood pressure that must not half-parse
    a fabricated "1-0-1"         a dosing instruction nobody wrote
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from camp_fixture import clinical, journey  # noqa: E402


def fresh() -> clinical.Rejects:
    return clinical.Rejects()


# ── readings ────────────────────────────────────────────────────────────────


def test_a_plausible_reading_survives():
    assert clinical.integer("pulse", "81", fresh()) == 81
    assert clinical.reading("weight_kg", "57.4", fresh()) == 57.4
    assert clinical.integer("spo2", "98", fresh()) == 98


def test_the_temperature_column_is_not_a_temperature():
    """133 forms hold the literal "1" in a column labelled Celsius.

    A ward list showing 133 patients at 1 degrees is not a cosmetic problem:
    it is a vital sign that reads as death, on a third of the camp.
    """
    rejects = fresh()
    assert clinical.reading("temperature_c", "1", rejects) is None
    assert clinical.reading("temperature_c", "0", rejects) is None
    assert clinical.reading("temperature_c", "851", rejects) is None
    # The handful of genuine ones still come through.
    assert clinical.reading("temperature_c", "37", fresh()) == 37
    assert clinical.reading("temperature_c", "36.8", fresh()) == 36.8
    assert rejects.by_field["temperature_c (out of range)"] == 3


def test_impossible_readings_are_dropped_not_clamped():
    """Dropped, not clamped to the nearest legal value.

    Clamping 21,010% to 100% invents a normal oxygen saturation for a patient
    nobody measured. Absent is the truth.
    """
    rejects = fresh()
    assert clinical.integer("spo2", "21010", rejects) is None
    assert clinical.reading("weight_kg", "89169", rejects) is None
    assert clinical.reading("cbg_mg_dl", "2166000000", rejects) is None
    assert clinical.reading("height_cm", "1", rejects) is None
    assert len(rejects.by_field) == 4


def test_a_zero_is_not_a_measurement():
    """0 is the extractor's way of saying it saw nothing.

    Loaded as-is it reads as cardiac arrest, apnoea and a weightless patient.
    """
    for name in ("systolic_bp", "spo2", "pulse", "weight_kg"):
        assert clinical.reading(name, "0", fresh()) is None, name


def test_extreme_but_real_readings_are_kept():
    """The guard excludes the impossible, not the alarming.

    A range check cannot tell a genuine tachycardia from a misread one, and
    it should not try. This extract contained a pulse of 226 that a reviewer
    later corrected to 92 — but 226 is a survivable heart rate, so the honest
    behaviour is to load it and let a human correct it, which is exactly what
    happened. Narrowing the range until that reading was excluded would also
    exclude the real ones.
    """
    assert clinical.integer("pulse", "226", fresh()) == 226
    assert clinical.integer("systolic_bp", "240", fresh()) == 240
    assert clinical.integer("spo2", "57", fresh()) == 57


def test_a_corrected_value_may_carry_its_unit():
    """Reviewers write the unit in: "92 b/m", "64.5 kg".

    248 pulses and 237 weights have been corrected by hand this way, and
    rejecting them as unparseable would silently keep the scanner's guess in
    preference to a human's correction.
    """
    assert clinical.integer("pulse", "92 b/m", fresh()) == 92
    assert clinical.reading("weight_kg", "64.5 kg", fresh()) == 64.5
    assert clinical.integer("spo2", "98%", fresh()) == 98


# ── blood pressure ──────────────────────────────────────────────────────────


def test_a_written_blood_pressure_parses():
    assert clinical.blood_pressure("130/80", fresh()) == (130, 80)
    assert clinical.blood_pressure("180/70", fresh()) == (180, 70)


def test_an_unreadable_blood_pressure_yields_neither_number():
    """A systolic with an invented diastolic is worse than no reading.

    These four are verbatim from the extract.
    """
    rejects = fresh()
    for raw in ("160lcoommHg", "13olfommiHg", "!bo!ammmtg", "110/fommrg"):
        assert clinical.blood_pressure(raw, rejects) == (None, None), raw
    assert rejects.by_field["blood_pressure (unreadable)"] == 4


def test_a_corrected_blood_pressure_may_carry_its_unit():
    """145 hand-corrected readings write "mmHg" out.

    Dropping them for it lost real measurements — "150/90 mmHg" is stage 2
    hypertension, and it was being discarded in favour of nothing.
    """
    assert clinical.blood_pressure("120/70 mmHg", fresh()) == (120, 70)
    assert clinical.blood_pressure("150/90 mmHg", fresh()) == (150, 90)
    assert clinical.blood_pressure("130/80 mmhg", fresh()) == (130, 80)


def test_systolic_must_exceed_diastolic():
    """Occurs once in the real extract, and is physically impossible."""
    rejects = fresh()
    assert clinical.blood_pressure("80/120", rejects) == (None, None)
    assert clinical.blood_pressure("90/90", rejects) == (None, None)
    assert rejects.by_field["blood_pressure (systolic<=diastolic)"] == 2


# ── prescriptions ───────────────────────────────────────────────────────────


def test_dosing_is_never_invented():
    """The single most dangerous thing this loader could do.

    "Glycomet Neevrenen Rantac Montak" states no schedule. Filling in a
    plausible `1-0-1` would put a dosing instruction in a patient record that
    no clinician ever wrote.
    """
    items = clinical.prescription_items("Glycomet Neevrenen Rantac Montak")
    assert items, "the drugs themselves must still be recorded"
    for item in items:
        assert item["frequency"] == "as written"
        assert item["dosage"] == "as written"


def test_a_stated_schedule_is_carried_across():
    items = clinical.prescription_items("Tab. MONTEH-IC OD- 3days. Tab. BARULAV BD-5days")
    assert [item["drug_name"] for item in items] == ["MONTEH-IC", "BARULAV"]
    assert [item["frequency"] for item in items] == ["OD", "BD"]
    assert items[0]["duration"] == "3days"


def test_the_indian_dose_notation_is_understood():
    items = clinical.prescription_items("Tab. vizcalceum 1-0-0 Tab. pala 1-0-1")
    assert [item["frequency"] for item in items] == ["1-0-0", "1-0-1"]
    assert [item["drug_name"] for item in items] == ["vizcalceum", "pala"]


def test_an_ocr_mangled_duration_does_not_stick_to_the_drug_name():
    """"BARULAV -gdays" was leaving the duration fragment in the drug name,
    which then fails to match anything in the formulary."""
    items = clinical.prescription_items("Tab. BARULAV BD-gdays")
    assert items[0]["drug_name"] == "BARULAV"


def test_the_original_text_is_always_preserved():
    """The drug names are frequently misread, so the pharmacist needs the
    original string to reconcile against — that is the workflow."""
    items = clinical.prescription_items("Tab. MONTEH-IC OD- 3days")
    assert "MONTEH-IC OD- 3days" in items[0]["instructions"]


def test_empty_advice_produces_no_prescription():
    for raw in (None, "", "-", "   "):
        assert clinical.prescription_items(raw) == []


# ── diagnoses ───────────────────────────────────────────────────────────────


def test_codes_and_descriptions_never_swap():
    """A description in an ICD field corrupts every report that groups by code."""
    result = clinical.diagnoses({"icd_codes": "J00, R50.9", "diagnosis": "Common cold"})
    assert result[0]["icd_code"] == "J00"
    assert result[0]["description"] == "Common cold"
    assert result[0]["is_primary"] is True
    assert result[1]["icd_code"] == "R50.9"
    assert result[1]["is_primary"] is False


def test_an_uncoded_diagnosis_is_still_recorded():
    """26% of forms have a written diagnosis; only 62% have a code."""
    result = clinical.diagnoses({"diagnosis": "Anaemia"})
    assert result == [{"description": "Anaemia", "is_primary": True}]


def test_no_diagnosis_is_not_an_empty_one():
    assert clinical.diagnoses({}) == []
    assert clinical.diagnoses({"icd_codes": "", "diagnosis": "-"}) == []


# ── the note ────────────────────────────────────────────────────────────────


def test_history_combines_ticked_boxes_and_free_text():
    row = {
        "mh_diabetes": "Yes",
        "mh_hypertension": "Yes",
        "mh_asthma": "No",
        "medical_history_notes": "He cundelwemtoplasa",
    }
    text = clinical.history(row)
    assert "Diabetes" in text and "Hypertension" in text
    assert "Asthma" not in text
    # OCR damage is reproduced exactly — a nurse reconciling the record needs
    # the string the scanner saw, not a guess at what it meant.
    assert "He cundelwemtoplasa" in text


def test_a_form_with_no_history_produces_none():
    assert clinical.history({"mh_diabetes": "No"}) is None


def test_qualitative_test_results_are_marked_as_unverified():
    """"Nooma" and "orma" are the scanner's attempts at "Normal"."""
    text = clinical.examination({"test_ecg": "Nooma"}, fresh())
    assert "ECG: Nooma (as read from form)" == text


def test_numeric_test_results_are_range_checked_like_any_other_reading():
    rejects = fresh()
    text = clinical.examination({"test_cbg (mg/dl)": "2166000000"}, rejects)
    assert text is None
    assert "cbg_mg_dl (out of range)" in rejects.by_field


# ── the journey ─────────────────────────────────────────────────────────────


def test_a_nameless_form_gets_an_obvious_placeholder():
    """35 forms lost their name to a bad scan. The API requires one, so it
    must be plainly not a real name rather than a plausible invention."""
    name = journey.person_name({"source": "forms/L-Series.pdf#89"})
    assert "Unnamed" in name and "89" in name


def test_an_unreadable_gender_is_left_unset_not_guessed():
    """"ae" is a scanner's "Male". Guessing puts a fact in a record that the
    form does not support; 123 forms have no readable gender and the system
    has to cope with that."""
    assert journey.gender("Female") == "female"
    assert journey.gender("Male") == "male"
    assert journey.gender("ae") is None
    assert journey.gender(None) is None


def test_idempotency_keys_are_derived_from_the_form():
    """So a re-run updates rather than duplicating. Two runs of the same form
    must produce the same key; two different forms must not."""
    a = {"source": "forms/A.pdf#1"}
    b = {"source": "forms/A.pdf#2"}
    assert journey.key_for(a, "-pat") == journey.key_for(a, "-pat")
    assert journey.key_for(a, "-pat") != journey.key_for(b, "-pat")
    # Stages of one visit stay distinct from each other.
    assert journey.key_for(a, "-pat") != journey.key_for(a, "-enc")


def test_vitals_are_omitted_entirely_when_nothing_was_measured():
    assert journey.vitals_event({"source": "x"}, "pid", fresh()) is None


def test_vitals_carry_only_what_was_actually_measured():
    event = journey.vitals_event(
        {"source": "x", "blood_pressure": "140/90", "pulse": "88", "spo2": "21010"},
        "pid",
        fresh(),
    )
    payload = event["payload"]
    assert payload["systolic_bp"] == 140 and payload["diastolic_bp"] == 90
    assert payload["pulse"] == 88
    # The impossible saturation is absent, not zeroed and not clamped.
    assert "spo2" not in payload


def test_decimals_are_sent_as_strings():
    """A float round-trip turns 62.5 kg into 62.49999999999999."""
    event = journey.vitals_event({"source": "x", "weight_kg": "62.5"}, "pid", fresh())
    assert event["payload"]["weight_kg"] == "62.50"


def test_a_consultation_needs_more_than_a_provenance_line():
    assert journey.consultation_body({"source": "x"}, fresh()) is None
    body = journey.consultation_body({"source": "x", "chief_complaints": "Fever"}, fresh())
    assert body["chief_complaint"] == "Fever"


def test_the_plan_carries_the_advice_and_the_referral():
    body = journey.consultation_body(
        {
            "source": "x",
            "chief_complaints": "Cough",
            "prescription_advice": "Tab. Paracetamol BD",
            "departments": "General Medicine",
            "referral_department": "Cardiology",
            "referral_doctor": "Kumar",
        },
        fresh(),
    )
    assert "Tab. Paracetamol BD" in body["plan"]
    assert "General Medicine" in body["plan"]
    assert "Referred to Cardiology (Dr Kumar)" in body["plan"]


if __name__ == "__main__":
    tests = sorted((n, f) for n, f in globals().items() if n.startswith("test_") and callable(f))
    failures = []
    for name, fn in tests:
        try:
            fn()
            print(f"  ok    {name}")
        except AssertionError as error:
            failures.append((name, error))
            print(f"  FAIL  {name}: {error}")
    print(f"\n{len(tests) - len(failures)} passed, {len(failures)} failed")
    sys.exit(1 if failures else 0)
