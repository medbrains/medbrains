"""One camp form as the series of events a real visit produces.

A patient at a camp is not a row. They are registered, seen, measured,
examined, diagnosed, prescribed for and sometimes referred, in that order,
and each step depends on the one before it. Loading a table of patients would
exercise one insert; replaying the sequence exercises the OPD queue, the
sequence allocator that issues the UHID and the token, the consultation
record, the diagnosis coding and the prescription — which is where the bugs
are.

The order matters beyond tidiness. The encounter cannot exist without the
patient id the server assigns, the consultation cannot exist without the
encounter, and the prescription hangs off the encounter. Each stage therefore
reads the `server_entity_id` the previous one returned rather than looking
anything up by name, which is the only reliable option when 35 of the forms
have no legible name and 72 source UHIDs collide.
"""

from __future__ import annotations

import hashlib

from . import clinical

# Genders the API recognises. Anything else — the extract contains "ae",
# a scanner's attempt at "Male" — is left unset rather than guessed. 123 of
# the 1,542 forms have no readable gender, and that is a case worth keeping:
# a patient can be registered without one, and the UI has to cope.
GENDERS = {
    "male": "male",
    "m": "male",
    "female": "female",
    "f": "female",
    "other": "other",
    "transgender": "other",
}


def gender(raw: object) -> str | None:
    return GENDERS.get(str(raw or "").strip().lower())


def key_for(row: dict, suffix: str = "") -> str:
    """A stable idempotency key derived from the form itself.

    Derived rather than generated so that a second run is recognised by the
    server as a duplicate instead of creating a second patient. `source` is
    the pdf-and-page the row was scanned from, which is unique per form and
    survives re-extraction.
    """
    digest = hashlib.blake2s(str(row.get("source", "")).encode(), digest_size=16).hexdigest()
    return f"{digest}{suffix}"


# ── stage 1: the camp's own registration desk ───────────────────────────────


def registration_event(row: dict, camp_id: str) -> dict:
    """The camp registration — who turned up.

    Distinct from the patient record: a camp registers a person before it
    knows whether they already exist in the hospital's records, which is the
    whole reason the camp tables are separate.
    """
    return {
        "idempotency_key": key_for(row, "-reg"),
        "event_type": "camp.registration.create",
        "payload": {
            "camp_id": camp_id,
            # The form this came from. The server matches on it so a corrected
            # re-sync updates the same patient instead of creating a second.
            "external_ref": clinical.clean(row.get("source")),
            "person_name": person_name(row),
            "age": clinical.integer("age", row.get("age"), clinical.Rejects()),
            "gender": gender(row.get("gender")),
            "phone": clinical.clean(row.get("mobile_number")),
            "address": clinical.clean(row.get("address")),
            "father_spouse_name": clinical.clean(row.get("father_spouse_name")),
            "marital_status": clinical.clean(row.get("marital_status")),
            "blood_group": clinical.clean(row.get("blood_group")),
            "insurance_details": clinical.clean(row.get("insurance_name_no")),
            "chief_complaint": clinical.clean(row.get("chief_complaints")),
            "is_walk_in": True,
        },
    }


def person_name(row: dict) -> str:
    """The name as written, or an honest placeholder.

    35 forms lost their name to a bad scan. The API requires one, so those
    become an explicit "Unnamed" marked with the page they came from —
    findable, and obviously not a real name, which beats both dropping the
    record and inventing a plausible one.
    """
    name = clinical.clean(row.get("full_name"))
    if name:
        return name[:120]
    page = str(row.get("source", "unknown")).split("#")[-1]
    return f"Unnamed camp record (form {page})"


# ── stage 2: the patient record ─────────────────────────────────────────────


def patient_event(row: dict, camp_id: str) -> dict:
    """The hospital patient.

    No UHID is sent. The extract's own numbers collide 72 times on the same
    camp day between people with different names, so carrying them across
    would import the collision; the server allocates from its own sequence
    instead.
    """
    return {
        "idempotency_key": key_for(row, "-pat"),
        "event_type": "camp.patient.upsert",
        "payload": {
            "camp_id": camp_id,
            "external_ref": clinical.clean(row.get("source")),
            "person_name": person_name(row),
            "age": clinical.integer("age", row.get("age"), clinical.Rejects()),
            "gender": gender(row.get("gender")),
            "phone": clinical.clean(row.get("mobile_number")),
            "address": clinical.clean(row.get("address")),
            "marital_status": clinical.clean(row.get("marital_status")),
            "blood_group": clinical.clean(row.get("blood_group")),
            "chief_complaint": clinical.clean(row.get("chief_complaints")),
            "is_walk_in": True,
        },
    }


# ── stage 3: the OPD visit ──────────────────────────────────────────────────


def encounter_event(row: dict, patient_id: str, department_id: str | None) -> dict:
    """The OPD encounter, which also puts the patient in the queue.

    `department_id` may be None only when the camp itself carries an
    organizing department; the server falls back to it. With neither, the
    event fails and the visit never exists.
    """
    payload = {
        "patient_id": patient_id,
        "notes": clinical.clean(row.get("chief_complaints")),
    }
    if department_id:
        payload["department_id"] = department_id
    return {
        "idempotency_key": key_for(row, "-enc"),
        "event_type": "camp.opd.encounter.create",
        "payload": payload,
    }


# ── stage 4: what was measured ──────────────────────────────────────────────


def vitals_event(row: dict, patient_id: str, rejects: clinical.Rejects) -> dict | None:
    """The vitals, with every reading range-checked first.

    Nothing is sent for a field the camp did not measure, and nothing is sent
    for a field whose value could not have come from a person. The temperature
    column is the reason: it holds the literal "1" on 133 forms, and a ward
    list of patients at 1 degrees Celsius is worse than one with no
    temperature at all.
    """
    systolic, diastolic = clinical.blood_pressure(row.get("blood_pressure"), rejects)
    measured = {
        "systolic_bp": systolic,
        "diastolic_bp": diastolic,
        "pulse": clinical.integer("pulse", row.get("pulse"), rejects),
        "spo2": clinical.integer("spo2", row.get("spo2"), rejects),
        "temperature_c": clinical.reading("temperature_c", row.get("temperature_c"), rejects),
        "weight_kg": clinical.reading("weight_kg", row.get("weight_kg"), rejects),
        "height_cm": clinical.reading("height_cm", row.get("height_cm"), rejects),
    }
    present = {key: value for key, value in measured.items() if value is not None}
    if not present:
        return None
    # Decimals go as strings: a float round-trip turns 62.5 kg into
    # 62.49999999999999 in the request body.
    for key in ("weight_kg", "height_cm", "temperature_c"):
        if key in present:
            present[key] = f"{present[key]:.2f}"
    return {
        "idempotency_key": key_for(row, "-vit"),
        "event_type": "camp.vitals.record",
        "payload": {"patient_id": patient_id, **present},
    }


# ── stage 5: the consultation, as SOAP ──────────────────────────────────────


def consultation_body(row: dict, rejects: clinical.Rejects) -> dict | None:
    """The doctor's note.

    Subjective is the complaint and the past history; objective is the
    point-of-care tests; the plan is the advice as written plus where the
    patient was sent. Assessment is posted separately as coded diagnoses,
    because a diagnosis belongs in a coded field where a report can find it,
    not buried in prose.
    """
    body = {
        "chief_complaint": clinical.clean(row.get("chief_complaints")),
        "history": clinical.history(row),
        "examination": clinical.examination(row, rejects),
        "plan": clinical.plan(row),
        "notes": f"Transcribed from camp form {row.get('source', '')}.",
    }
    # A note with nothing but the provenance line is not a consultation.
    if not any(body[field] for field in ("chief_complaint", "history", "examination", "plan")):
        return None
    return {key: value for key, value in body.items() if value is not None}


# ── stage 6: prescription and referral ──────────────────────────────────────


def prescription_event(row: dict, patient_id: str, encounter_id: str | None) -> dict | None:
    items = clinical.prescription_items(row.get("prescription_advice"))
    if not items:
        return None
    payload: dict = {"patient_id": patient_id, "items": items}
    if encounter_id:
        payload["encounter_id"] = encounter_id
    return {
        "idempotency_key": key_for(row, "-rx"),
        "event_type": "camp.prescription.create",
        "payload": payload,
    }


def referral_event(row: dict, registration_id: str | None) -> dict | None:
    """A referral onward, where the form recorded one.

    221 of the 1,542 forms did. Urgency is left at the server's default —
    the paper form has no urgency field, and inferring one from a department
    name would be inventing clinical judgement.
    """
    department = clinical.clean(row.get("referral_department"))
    if not department:
        return None
    doctor = clinical.clean(row.get("referral_doctor"))
    payload: dict = {
        "referral_department": department,
        "reason": clinical.clean(row.get("diagnosis"))
        or clinical.clean(row.get("chief_complaints")),
        # Required by the API. A camp form names the department and often the
        # doctor, but never the facility, because the referral is into the
        # hospital that ran the camp — so that is what is recorded, rather
        # than leaving the event to fail or inventing a hospital name.
        "referred_to_facility": f"Dr {doctor}" if doctor else "Alagappa Medical College & Hospital",
    }
    if registration_id:
        payload["registration_id"] = registration_id
    return {
        "idempotency_key": key_for(row, "-ref"),
        "event_type": "camp.referral.create",
        "payload": payload,
    }
