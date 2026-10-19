//! Print-data endpoints — surgical & OT forms.

use axum::routing::get;
use axum::{
    Extension, Json,
    extract::{Path, State},
};
use uuid::Uuid;

use medbrains_core::permissions;
use medbrains_core::print_data::{
    AnesthesiaDrug, AnesthesiaRecordPrintData, CaseSheetCoverPrintData, OperationNotesPrintData,
    PostopMedicationOrder, PostopOrdersPrintData, PreopAssessmentPrintData, PreopLabResult,
    PreopVitals, SurgicalChecklistItem, SurgicalChecklistPhase, SurgicalSafetyChecklistPrintData,
    TransfusionMonitoringEntry, TransfusionMonitoringPrintData, TransfusionVitals,
};

use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

// ── Case Sheet Cover ─────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct CaseSheetCoverRow {
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    admission_number: String,
    admission_date: chrono::DateTime<chrono::Utc>,
    ward_name: String,
    bed_number: String,
    attending_doctor: Option<String>,
    department: Option<String>,
    provisional_diagnosis: Option<String>,
    final_diagnosis: Option<String>,
    blood_group: Option<String>,
    emergency_contact_name: Option<String>,
    emergency_contact_phone: Option<String>,
    insurance_provider: Option<String>,
    policy_number: Option<String>,
    hospital_name: String,
    hospital_logo_url: Option<String>,
}

pub async fn get_case_sheet_cover_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<CaseSheetCoverPrintData>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;
    medbrains_authz_gate::require_admission_access(&state, &claims, admission_id).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CaseSheetCoverRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           a.admission_number, \
           a.admitted_at AS admission_date, \
           COALESCE(w.name, 'N/A') AS ward_name, \
           COALESCE(l.name, 'N/A') AS bed_number, \
           doc.full_name AS attending_doctor, \
           dept.name AS department, \
           a.provisional_diagnosis, \
           a.final_diagnosis, \
           p.blood_group::text AS blood_group, \
           p.emergency_contact_name, \
           p.emergency_contact_phone, \
           ins.payer_name AS insurance_provider, \
           ins.policy_number, \
           t.name AS hospital_name, \
           t.logo_url AS hospital_logo_url \
         FROM admissions a \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
         JOIN tenants t ON t.id = a.tenant_id \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
         LEFT JOIN users doc ON doc.id = a.admitting_doctor \
         LEFT JOIN departments dept ON dept.id = a.department_id AND dept.tenant_id = a.tenant_id \
         LEFT JOIN LATERAL (SELECT x.payer_name, x.policy_number FROM patient_insurances x \
           WHERE x.patient_id = p.id AND x.tenant_id = a.tenant_id AND x.is_primary = true \
             AND x.deleted_at IS NULL \
           ORDER BY x.created_at DESC LIMIT 1) ins ON true \
         WHERE a.id = $1 AND a.tenant_id = $2 AND a.deleted_at IS NULL",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let allergies: Vec<String> = sqlx::query_scalar(
        "SELECT allergen_name FROM patient_allergies \
         WHERE patient_id = (SELECT patient_id FROM admissions WHERE id = $1) \
           AND tenant_id = $2 AND is_active = true AND deleted_at IS NULL \
         ORDER BY created_at LIMIT 50",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    let age = row.age.map(|a| format!("{} yrs", a as i64));
    let primary_diagnosis = row
        .final_diagnosis
        .clone()
        .or(row.provisional_diagnosis.clone());

    Ok(Json(CaseSheetCoverPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: age.clone(),
        age_display: age.unwrap_or_else(|| "N/A".to_owned()),
        gender: row.gender,
        admission_number: row.admission_number,
        admission_date: row
            .admission_date
            .with_timezone(&tz)
            .format("%d-%b-%Y")
            .to_string(),
        ward_name: row.ward_name,
        bed_number: row.bed_number,
        attending_doctor: row.attending_doctor.unwrap_or_default(),
        department: row.department.unwrap_or_default(),
        provisional_diagnosis: row.provisional_diagnosis,
        final_diagnosis: row.final_diagnosis,
        primary_diagnosis,
        secondary_diagnoses: Vec::new(),
        allergies,
        blood_group: row.blood_group,
        emergency_contact_name: row.emergency_contact_name,
        emergency_contact_phone: row.emergency_contact_phone,
        insurance_provider: row.insurance_provider,
        policy_number: row.policy_number,
        hospital_name: row.hospital_name,
        hospital_logo_url: row.hospital_logo_url,
    }))
}

// ── Pre-Operative Assessment ─────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct PreopAssessmentRow {
    patient_id: Uuid,
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    admission_number: String,
    planned_surgery: String,
    surgery_date: chrono::NaiveDate,
    surgeon_name: Option<String>,
    anesthesiologist_name: Option<String>,
    asa_grade: Option<String>,
    clearance_status: Option<String>,
    airway_assessment: Option<serde_json::Value>,
    cardiac_assessment: Option<serde_json::Value>,
    pulmonary_assessment: Option<serde_json::Value>,
    consent_obtained: bool,
    fasting_status: Option<bool>,
    npo_since: Option<chrono::DateTime<chrono::Utc>>,
    allergies_noted: Option<String>,
    preop_medications: Option<String>,
    conditions: Option<String>,
    assessed_by: Option<String>,
    assessed_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// The pre-anaesthetic assessment for one OT booking (`ot_bookings.id`),
/// read from `ot_preop_assessments`. A booking with no assessment yet prints
/// its header and blanks.
pub async fn get_preop_assessment_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(booking_id): Path<Uuid>,
) -> Result<Json<PreopAssessmentPrintData>, AppError> {
    require_permission(&claims, permissions::ot::preop::LIST)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::OT_BOOKING,
        booking_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, PreopAssessmentRow>(
        "SELECT \
           p.id AS patient_id, \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           COALESCE((SELECT ad.admission_number FROM admissions ad \
                      WHERE ad.id = b.admission_id AND ad.tenant_id = b.tenant_id), '') \
             AS admission_number, \
           b.procedure_name AS planned_surgery, \
           b.scheduled_date AS surgery_date, \
           surgeon.full_name AS surgeon_name, \
           anesth.full_name AS anesthesiologist_name, \
           replace(upper(pa.asa_class::text), 'ASA_', 'ASA ') AS asa_grade, \
           pa.clearance_status::text AS clearance_status, \
           pa.airway_assessment, \
           pa.cardiac_assessment, \
           pa.pulmonary_assessment, \
           b.consent_obtained, \
           pa.fasting_status, \
           pa.npo_since, \
           pa.allergies_noted, \
           pa.current_medications AS preop_medications, \
           pa.conditions, \
           assessor.full_name AS assessed_by, \
           pa.assessed_at \
         FROM ot_bookings b \
         JOIN patients p ON p.id = b.patient_id AND p.tenant_id = b.tenant_id \
         LEFT JOIN LATERAL (SELECT * FROM ot_preop_assessments x \
           WHERE x.booking_id = b.id AND x.tenant_id = b.tenant_id AND x.deleted_at IS NULL \
           ORDER BY x.created_at DESC LIMIT 1) pa ON true \
         LEFT JOIN users surgeon ON surgeon.id = b.primary_surgeon_id \
         LEFT JOIN users anesth ON anesth.id = b.anesthetist_id \
         LEFT JOIN users assessor ON assessor.id = pa.assessed_by \
         WHERE b.id = $1 AND b.tenant_id = $2 AND b.deleted_at IS NULL",
    )
    .bind(booking_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let mut allergies: Vec<String> = sqlx::query_scalar(
        "SELECT allergen_name FROM patient_allergies \
         WHERE patient_id = $1 AND tenant_id = $2 AND is_active = true AND deleted_at IS NULL \
         ORDER BY created_at LIMIT 50",
    )
    .bind(row.patient_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    allergies.extend(row.allergies_noted.clone());

    let mut current_medications: Vec<String> = row.preop_medications.clone().into_iter().collect();
    let prescribed: Vec<String> = sqlx::query_scalar(
        "SELECT concat_ws(' ', pi.drug_name, pi.dosage, pi.frequency) \
         FROM prescription_items pi \
         JOIN prescriptions rx ON rx.id = pi.prescription_id AND rx.tenant_id = pi.tenant_id \
         WHERE rx.patient_id = $1 AND pi.tenant_id = $2 \
           AND rx.deleted_at IS NULL AND pi.deleted_at IS NULL \
           AND pi.item_status = 'active' AND pi.discontinued_at IS NULL \
           AND (pi.end_date IS NULL OR pi.end_date >= CURRENT_DATE) \
         ORDER BY pi.created_at DESC LIMIT 20",
    )
    .bind(row.patient_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    current_medications.extend(prescribed);

    // Structured history lives on the latest consultation that recorded any.
    let mut medical_history: Vec<String> = row.conditions.clone().into_iter().collect();
    let past_medical: Vec<String> = sqlx::query_scalar(&latest_history_sql(
        "past_medical_history",
        "condition",
        "diagnosed_year",
    ))
    .bind(row.patient_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    medical_history.extend(past_medical);

    let surgical_history: Vec<String> = sqlx::query_scalar(&latest_history_sql(
        "past_surgical_history",
        "procedure",
        "year",
    ))
    .bind(row.patient_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let lab_results = sqlx::query_as::<_, PreopLabResult>(
        "SELECT lr.parameter_name AS test_name, lr.value, lr.unit, lr.flag::text AS flag \
         FROM lab_results lr \
         JOIN lab_orders lo ON lo.id = lr.order_id AND lo.tenant_id = lr.tenant_id \
         WHERE lo.patient_id = $1 AND lr.tenant_id = $2 \
           AND lr.deleted_at IS NULL AND lo.deleted_at IS NULL \
         ORDER BY lr.created_at DESC LIMIT 20",
    )
    .bind(row.patient_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    let npo_status = row
        .fasting_status
        .map(|fasting| match (fasting, row.npo_since) {
            (true, Some(since)) => format!(
                "Fasting since {}",
                since.with_timezone(&tz).format("%d-%b-%Y %H:%M")
            ),
            (true, None) => "Fasting".to_owned(),
            (false, _) => "Not fasting".to_owned(),
        });

    Ok(Json(PreopAssessmentPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: row.age.map(|a| format!("{} yrs", a as i64)),
        gender: row.gender,
        admission_number: row.admission_number,
        planned_surgery: row.planned_surgery,
        surgery_date: row.surgery_date.format("%d-%b-%Y").to_string(),
        surgeon_name: row.surgeon_name.unwrap_or_default(),
        anesthesiologist_name: row.anesthesiologist_name,
        asa_grade: row.asa_grade,
        clearance_status: row.clearance_status,
        airway_assessment: json_text(row.airway_assessment.as_ref()),
        cardiac_assessment: json_text(row.cardiac_assessment.as_ref()),
        pulmonary_assessment: json_text(row.pulmonary_assessment.as_ref()),
        allergies,
        current_medications,
        medical_history,
        surgical_history,
        // ponytail: pre-op vitals, ECG, chest X-ray, anaesthesia plan and
        // instructions are not recorded on the pre-op assessment yet.
        vitals: PreopVitals {
            bp_systolic: None,
            bp_diastolic: None,
            pulse: None,
            temperature: None,
            spo2: None,
            weight_kg: None,
            height_cm: None,
        },
        lab_results,
        ecg_findings: None,
        chest_xray_findings: None,
        anesthesia_plan: None,
        special_instructions: None,
        consent_obtained: row.consent_obtained,
        npo_status,
        assessed_by: row.assessed_by.unwrap_or_default(),
        assessed_at: row
            .assessed_at
            .map(|t| t.with_timezone(&tz).format("%d-%b-%Y %H:%M").to_string())
            .unwrap_or_default(),
    }))
}

/// One line per entry of a structured history array on the patient's latest
/// consultation that recorded one: `"<label> (<year>)"`. Binds `$1` patient,
/// `$2` tenant. `column` and keys are compile-time literals, never input.
fn latest_history_sql(column: &str, label_key: &str, year_key: &str) -> String {
    format!(
        "SELECT h->>'{label_key}' || COALESCE(' (' || (h->>'{year_key}') || ')', '') \
         FROM (SELECT c.{column} AS hist FROM consultations c \
               JOIN encounters e ON e.id = c.encounter_id AND e.tenant_id = c.tenant_id \
               WHERE e.patient_id = $1 AND c.tenant_id = $2 AND c.deleted_at IS NULL \
                 AND jsonb_typeof(c.{column}) = 'array' AND jsonb_array_length(c.{column}) > 0 \
               ORDER BY c.created_at DESC LIMIT 1) latest, \
              jsonb_array_elements(latest.hist) h \
         WHERE h->>'{label_key}' IS NOT NULL LIMIT 50"
    )
}

// ── Surgical Safety Checklist (WHO) ──────────────────────

/// The WHO checklist's three phases, in the order a theatre performs them,
/// with the items each one requires. Kept beside the print handler because a
/// phase that was never recorded must still print its blanks, and that means
/// knowing what the blanks are without a row to read them from. Mirrors
/// `who_checklist_items` in `medbrains-ot`.
type WhoItem = (&'static str, &'static str);
/// phase key, printed heading, the items that phase requires.
type WhoPhase = (&'static str, &'static str, &'static [WhoItem]);

const WHO_PHASES: &[WhoPhase] = &[
    (
        "sign_in",
        "Sign in — before induction of anaesthesia",
        &[
            (
                "patient_identity",
                "Patient confirmed: identity, site, procedure, consent",
            ),
            ("site_marked", "Surgical site marked (or not applicable)"),
            (
                "anaesthesia_check",
                "Anaesthesia machine and medication check complete",
            ),
            (
                "pulse_oximeter",
                "Pulse oximeter on patient and functioning",
            ),
            ("allergy", "Known allergy reviewed"),
            ("airway_risk", "Difficult airway / aspiration risk assessed"),
            (
                "blood_loss_risk",
                "Risk of >500ml blood loss assessed (IV access / fluids)",
            ),
        ],
    ),
    (
        "time_out",
        "Time out — before skin incision",
        &[
            (
                "team_introductions",
                "Team members introduced by name and role",
            ),
            (
                "confirm_patient",
                "Surgeon, anaesthetist and nurse confirm patient, site, procedure",
            ),
            (
                "antibiotic_prophylaxis",
                "Antibiotic prophylaxis given within the last 60 minutes",
            ),
            ("imaging", "Essential imaging displayed (or not required)"),
            (
                "critical_steps",
                "Surgeon reviews critical or unexpected steps",
            ),
            (
                "anaesthesia_concerns",
                "Anaesthesia reviews patient-specific concerns",
            ),
            (
                "sterility",
                "Nursing confirms sterility and equipment readiness",
            ),
        ],
    ),
    (
        "sign_out",
        "Sign out — before the patient leaves theatre",
        &[
            ("procedure_recorded", "Name of the procedure recorded"),
            (
                "counts_correct",
                "Instrument, sponge and needle counts correct",
            ),
            (
                "specimen_labelled",
                "Specimen labelled (including patient name)",
            ),
            (
                "equipment_problems",
                "Any equipment problems identified and addressed",
            ),
            (
                "recovery_concerns",
                "Key concerns for recovery and management reviewed",
            ),
        ],
    ),
];

#[derive(Debug, sqlx::FromRow)]
struct SurgicalSafetyRow {
    patient_name: String,
    uhid: String,
    booking_id: Uuid,
    procedure_name: String,
    surgery_date: chrono::NaiveDate,
    ot_number: String,
    surgeon_name: Option<String>,
    anesthetist_name: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
struct ChecklistPhaseRow {
    phase: String,
    items: serde_json::Value,
    completed: bool,
    completed_by: Option<String>,
    completed_at: Option<chrono::DateTime<chrono::Utc>>,
    verified_by: Option<String>,
}

#[derive(serde::Deserialize)]
struct StoredItem {
    key: String,
    #[serde(default)]
    label: Option<String>,
    #[serde(default)]
    checked: bool,
}

/// Turn the rows that exist into the three phases a sheet always prints.
///
/// Driven by `WHO_PHASES`, never by the stored payload: an item missing from a
/// row prints unticked rather than disappearing from the sheet, and a phase
/// with no row at all prints its blanks with `recorded: false`. A checklist
/// that quietly omits the step nobody did would read as a complete checklist.
///
/// A stored payload that does not parse is an error, not an empty phase: read
/// as empty it would print every box unticked under a phase marked recorded.
fn build_phases(
    recorded: &[ChecklistPhaseRow],
    tz: chrono::FixedOffset,
) -> Result<Vec<SurgicalChecklistPhase>, serde_json::Error> {
    WHO_PHASES
        .iter()
        .map(|(phase, label, required)| {
            let found = recorded.iter().find(|r| r.phase == *phase);
            let stored: Vec<StoredItem> = match found {
                Some(r) => serde_json::from_value(r.items.clone())?,
                None => Vec::new(),
            };
            let items = required
                .iter()
                .map(|(key, label)| {
                    let state = stored.iter().find(|s| s.key == *key);
                    SurgicalChecklistItem {
                        key: (*key).to_owned(),
                        label: state
                            .and_then(|s| s.label.clone())
                            .unwrap_or_else(|| (*label).to_owned()),
                        checked: state.is_some_and(|s| s.checked),
                    }
                })
                .collect();
            Ok(SurgicalChecklistPhase {
                phase: (*phase).to_owned(),
                label: (*label).to_owned(),
                recorded: found.is_some(),
                completed: found.is_some_and(|r| r.completed),
                completed_by: found.and_then(|r| r.completed_by.clone()),
                completed_at: found
                    .and_then(|r| r.completed_at)
                    .map(|t| t.with_timezone(&tz).format("%d-%b-%Y %H:%M").to_string()),
                verified_by: found.and_then(|r| r.verified_by.clone()),
                items,
            })
        })
        .collect()
}

#[cfg(test)]
mod who_checklist_tests {
    use super::{ChecklistPhaseRow, build_phases};

    fn row(phase: &str, items: serde_json::Value, completed: bool) -> ChecklistPhaseRow {
        ChecklistPhaseRow {
            phase: phase.to_owned(),
            items,
            completed,
            completed_by: Some("Sr. Mary".to_owned()),
            completed_at: None,
            verified_by: None,
        }
    }

    #[test]
    fn a_theatre_that_recorded_nothing_prints_three_blank_phases() {
        let phases = build_phases(&[], chrono::FixedOffset::east_opt(0).unwrap()).unwrap();
        assert_eq!(phases.len(), 3);
        assert!(phases.iter().all(|p| !p.recorded && !p.completed));
        assert!(
            phases.iter().all(|p| p.items.iter().all(|i| !i.checked)),
            "nothing recorded must print as nothing ticked — the old handler answered true"
        );
        assert!(
            phases.iter().all(|p| p.completed_by.is_none()),
            "and nobody's name on it"
        );
    }

    #[test]
    fn an_item_missing_from_the_stored_row_prints_unticked_not_absent() {
        // Only one of sign-in's seven items is present in the payload.
        let phases = build_phases(&[row(
            "sign_in",
            serde_json::json!([{ "key": "site_marked", "label": "Surgical site marked", "checked": true }]),
            false,
        )], chrono::FixedOffset::east_opt(0).unwrap())
        .unwrap();
        let sign_in = &phases[0];
        assert_eq!(
            sign_in.items.len(),
            7,
            "every required item is on the sheet"
        );
        assert!(
            sign_in
                .items
                .iter()
                .find(|i| i.key == "site_marked")
                .unwrap()
                .checked
        );
        assert!(
            sign_in
                .items
                .iter()
                .filter(|i| i.key != "site_marked")
                .all(|i| !i.checked),
            "the six nobody recorded print as empty boxes"
        );
    }

    #[test]
    fn the_counts_item_is_never_silently_ticked() {
        // Sign-out recorded, counts explicitly false: a retained-swab check
        // that failed must survive to paper exactly as it was recorded.
        let phases = build_phases(
            &[row(
                "sign_out",
                serde_json::json!([{ "key": "counts_correct", "checked": false }]),
                false,
            )],
            chrono::FixedOffset::east_opt(0).unwrap(),
        )
        .unwrap();
        let counts = phases[2]
            .items
            .iter()
            .find(|i| i.key == "counts_correct")
            .unwrap();
        assert!(!counts.checked);
        assert_eq!(counts.label, "Instrument, sponge and needle counts correct");
    }

    #[test]
    fn a_malformed_payload_is_an_error_not_a_blank_phase() {
        assert!(
            build_phases(
                &[row("sign_in", serde_json::json!({ "bad": 1 }), true)],
                chrono::FixedOffset::east_opt(0).unwrap()
            )
            .is_err()
        );
    }

    #[test]
    fn a_completed_phase_carries_who_completed_it() {
        let phases = build_phases(
            &[row("time_out", serde_json::json!([]), true)],
            chrono::FixedOffset::east_opt(0).unwrap(),
        )
        .unwrap();
        assert!(phases[1].recorded && phases[1].completed);
        assert_eq!(phases[1].completed_by.as_deref(), Some("Sr. Mary"));
        assert!(
            !phases[0].recorded,
            "and says nothing about the phases it is not"
        );
    }
}

/// The printed WHO Surgical Safety Checklist for one OT booking.
///
/// It used to answer with every box ticked — `patient_confirmed_identity:
/// true`, `instrument_count_correct: true`, `sponge_count_correct: true` —
/// hardcoded, for any surgery, with the scrub nurse named as the person who
/// completed it. The checklist table was empty, so the document attested to a
/// pause that had never happened, in a named clinician's name. For NABH and
/// JCI that sheet is the evidence of IPSG-4 compliance; fabricating it is worse
/// than not printing it.
///
/// It now reads `ot_surgical_safety_checklists` for the booking and prints what
/// is there. A phase with no row prints its required items unticked and says
/// `recorded: false` — a blank checklist, which is an honest thing for a
/// document to be.
pub async fn get_surgical_safety_checklist_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(booking_id): Path<Uuid>,
) -> Result<Json<SurgicalSafetyChecklistPrintData>, AppError> {
    // Gated on the checklist's own permission, not `ipd.admissions.view`: this
    // is the OT safety record, and the code for reading it already exists.
    require_permission(&claims, permissions::ot::safety_checklist::LIST)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::OT_BOOKING,
        booking_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, SurgicalSafetyRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           b.id AS booking_id, \
           b.procedure_name, \
           b.scheduled_date AS surgery_date, \
           COALESCE(room.name, 'OT') AS ot_number, \
           surgeon.full_name AS surgeon_name, \
           anesth.full_name AS anesthetist_name \
         FROM ot_bookings b \
         JOIN patients p ON p.id = b.patient_id AND p.tenant_id = b.tenant_id \
         LEFT JOIN ot_rooms room ON room.id = b.ot_room_id AND room.tenant_id = b.tenant_id \
         LEFT JOIN users surgeon ON surgeon.id = b.primary_surgeon_id \
         LEFT JOIN users anesth ON anesth.id = b.anesthetist_id \
         WHERE b.id = $1 AND b.tenant_id = $2 AND b.deleted_at IS NULL",
    )
    .bind(booking_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    // One query for all three phases; the phases are then matched in memory.
    let recorded = sqlx::query_as!(
        ChecklistPhaseRow,
        "SELECT c.phase::text AS \"phase!\", c.items AS \"items!\", \
                c.completed AS \"completed!\", done.full_name AS \"completed_by?\", \
                c.completed_at AS \"completed_at?\", checker.full_name AS \"verified_by?\" \
         FROM ot_surgical_safety_checklists c \
         LEFT JOIN users done ON done.id = c.completed_by \
         LEFT JOIN users checker ON checker.id = c.verified_by \
         WHERE c.booking_id = $1 AND c.tenant_id = $2 AND c.deleted_at IS NULL",
        booking_id,
        claims.tenant_id,
    )
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;

    let phases = build_phases(&recorded, tz).map_err(|e| {
        AppError::Internal(format!(
            "surgical safety checklist payload is malformed: {e}"
        ))
    })?;

    Ok(Json(SurgicalSafetyChecklistPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        booking_id: row.booking_id.to_string(),
        procedure_name: row.procedure_name,
        surgery_date: row.surgery_date.format("%d-%b-%Y").to_string(),
        ot_number: row.ot_number,
        surgeon_name: row.surgeon_name.unwrap_or_else(|| "—".to_owned()),
        anesthetist_name: row.anesthetist_name.unwrap_or_else(|| "—".to_owned()),
        phases,
    }))
}

// ── OT jsonb lists ───────────────────────────────────────

/// One jsonb list entry as a printable line: a string as written, anything
/// else as its JSON text so nothing recorded is dropped.
fn json_line(item: &serde_json::Value) -> String {
    item.as_str()
        .map_or_else(|| item.to_string(), str::to_owned)
}

/// A free-form jsonb assessment as one printable line; an empty object, list
/// or string is "not recorded".
fn json_text(value: Option<&serde_json::Value>) -> Option<String> {
    let value = value?;
    let empty = match value {
        serde_json::Value::Null => true,
        serde_json::Value::Object(map) => map.is_empty(),
        serde_json::Value::Array(items) => items.is_empty(),
        serde_json::Value::String(text) => text.trim().is_empty(),
        _ => false,
    };
    (!empty).then(|| json_line(value))
}

/// A jsonb list as printable lines. The web forms store `["..."]`.
fn json_lines(value: Option<&serde_json::Value>) -> Vec<String> {
    value
        .and_then(serde_json::Value::as_array)
        .map(|items| items.iter().map(json_line).collect())
        .unwrap_or_default()
}

/// Entries of a jsonb list that match a print row's shape.
// ponytail: entries in any other shape are skipped; nothing writes a
// structured shape yet, so add a mapping when a form starts to.
fn typed_items<T: serde::de::DeserializeOwned>(value: Option<&serde_json::Value>) -> Vec<T> {
    value
        .and_then(serde_json::Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|item| serde_json::from_value(item.clone()).ok())
                .collect()
        })
        .unwrap_or_default()
}

/// `drugs_administered` as written: a free-text line, or an object.
#[derive(serde::Deserialize)]
struct StoredDrug {
    #[serde(alias = "name")]
    drug_name: String,
    #[serde(default)]
    dose: String,
    #[serde(default)]
    route: String,
    #[serde(default)]
    time: String,
}

fn anesthesia_drugs(value: Option<&serde_json::Value>) -> Vec<AnesthesiaDrug> {
    value
        .and_then(serde_json::Value::as_array)
        .map(|items| {
            items
                .iter()
                .map(
                    |item| match serde_json::from_value::<StoredDrug>(item.clone()) {
                        Ok(d) => AnesthesiaDrug {
                            drug_name: d.drug_name,
                            dose: d.dose,
                            route: d.route,
                            time: d.time,
                        },
                        Err(_) => AnesthesiaDrug {
                            drug_name: json_line(item),
                            dose: String::new(),
                            route: String::new(),
                            time: String::new(),
                        },
                    },
                )
                .collect()
        })
        .unwrap_or_default()
}

fn hhmm(t: Option<chrono::DateTime<chrono::Utc>>, tz: chrono::FixedOffset) -> Option<String> {
    t.map(|t| t.with_timezone(&tz).format("%H:%M").to_string())
}

#[cfg(test)]
mod ot_json_tests {
    use super::{anesthesia_drugs, json_lines};

    #[test]
    fn free_text_lists_print_as_written_and_objects_are_not_dropped() {
        let v = serde_json::json!(["Propofol 100 mg IV", { "x": 1 }]);
        assert_eq!(
            json_lines(Some(&v)),
            vec!["Propofol 100 mg IV", "{\"x\":1}"]
        );
        assert!(json_lines(None).is_empty());
        assert!(json_lines(Some(&serde_json::json!({}))).is_empty());
    }

    #[test]
    fn drugs_take_structure_when_recorded_and_text_otherwise() {
        let v = serde_json::json!(["Fentanyl 100 mcg", { "name": "Atracurium", "dose": "25 mg" }]);
        let drugs = anesthesia_drugs(Some(&v));
        assert_eq!(drugs[0].drug_name, "Fentanyl 100 mcg");
        assert!(
            drugs[0].dose.is_empty(),
            "no dose is invented for a free-text line"
        );
        assert_eq!(drugs[1].drug_name, "Atracurium");
        assert_eq!(drugs[1].dose, "25 mg");
    }
}

// ── Anesthesia Record ────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct AnesthesiaRecordRow {
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    booking_id: Uuid,
    procedure_name: String,
    surgery_date: chrono::NaiveDate,
    anesthesia_type: Option<String>,
    asa_grade: Option<String>,
    anesthesiologist_name: Option<String>,
    airway_notes: Option<String>,
    drugs_administered: Option<serde_json::Value>,
    monitoring_events: Option<serde_json::Value>,
    fluids_given: Option<serde_json::Value>,
    blood_products: Option<serde_json::Value>,
    induction_time: Option<chrono::DateTime<chrono::Utc>>,
    extubation_time: Option<chrono::DateTime<chrono::Utc>>,
    complications: Option<String>,
    blood_loss_ml: Option<i32>,
    surgery_start: Option<chrono::DateTime<chrono::Utc>>,
    surgery_end: Option<chrono::DateTime<chrono::Utc>>,
    pacu_arrival_time: Option<chrono::DateTime<chrono::Utc>>,
    aldrete_score: Option<i32>,
}

/// The anaesthesia record for one OT booking (`ot_bookings.id`), from
/// `ot_anesthesia_records`, with blood loss from the case record and recovery
/// from the post-op record.
pub async fn get_anesthesia_record_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(booking_id): Path<Uuid>,
) -> Result<Json<AnesthesiaRecordPrintData>, AppError> {
    require_permission(&claims, permissions::ot::anesthesia::LIST)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::OT_BOOKING,
        booking_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, AnesthesiaRecordRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           b.id AS booking_id, \
           b.procedure_name, \
           b.scheduled_date AS surgery_date, \
           ar.anesthesia_type::text AS anesthesia_type, \
           replace(upper(ar.asa_class::text), 'ASA_', 'ASA ') AS asa_grade, \
           COALESCE(rec_anesth.full_name, booked_anesth.full_name) AS anesthesiologist_name, \
           ar.airway_details->>'notes' AS airway_notes, \
           ar.drugs_administered, \
           ar.monitoring_events, \
           ar.fluids_given, \
           ar.blood_products, \
           ar.induction_time, \
           ar.extubation_time, \
           ar.complications, \
           cr.blood_loss_ml, \
           COALESCE(cr.incision_time, b.actual_start) AS surgery_start, \
           COALESCE(cr.closure_time, b.actual_end) AS surgery_end, \
           pr.arrival_time AS pacu_arrival_time, \
           pr.aldrete_score_arrival AS aldrete_score \
         FROM ot_bookings b \
         JOIN patients p ON p.id = b.patient_id AND p.tenant_id = b.tenant_id \
         LEFT JOIN LATERAL (SELECT * FROM ot_anesthesia_records x \
           WHERE x.booking_id = b.id AND x.tenant_id = b.tenant_id AND x.deleted_at IS NULL \
           ORDER BY x.created_at DESC LIMIT 1) ar ON true \
         LEFT JOIN LATERAL (SELECT * FROM ot_case_records x \
           WHERE x.booking_id = b.id AND x.tenant_id = b.tenant_id AND x.deleted_at IS NULL \
           ORDER BY x.created_at DESC LIMIT 1) cr ON true \
         LEFT JOIN LATERAL (SELECT * FROM ot_postop_records x \
           WHERE x.booking_id = b.id AND x.tenant_id = b.tenant_id AND x.deleted_at IS NULL \
           ORDER BY x.created_at DESC LIMIT 1) pr ON true \
         LEFT JOIN users rec_anesth ON rec_anesth.id = ar.anesthetist_id \
         LEFT JOIN users booked_anesth ON booked_anesth.id = b.anesthetist_id \
         WHERE b.id = $1 AND b.tenant_id = $2 AND b.deleted_at IS NULL",
    )
    .bind(booking_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;

    Ok(Json(AnesthesiaRecordPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: row.age.map(|a| format!("{} yrs", a as i64)),
        gender: row.gender,
        // ponytail: weight, ETT size, intubation grade, urine output,
        // anaesthesia end and drug categories are not recorded yet; every
        // drug prints under "other".
        weight_kg: None,
        surgery_id: row.booking_id.to_string(),
        procedure_name: row.procedure_name,
        surgery_date: row.surgery_date.format("%d-%b-%Y").to_string(),
        anesthesia_type: row.anesthesia_type,
        asa_grade: row.asa_grade,
        anesthesiologist_name: row.anesthesiologist_name.unwrap_or_default(),
        airway_type: row.airway_notes,
        ett_size: None,
        intubation_grade: None,
        induction_agents: Vec::new(),
        maintenance_agents: Vec::new(),
        muscle_relaxants: Vec::new(),
        analgesics: Vec::new(),
        other_drugs: anesthesia_drugs(row.drugs_administered.as_ref()),
        vitals_timeline: typed_items(row.monitoring_events.as_ref()),
        iv_fluids: typed_items(row.fluids_given.as_ref()),
        blood_products: typed_items(row.blood_products.as_ref()),
        urine_output_ml: None,
        blood_loss_ml: row.blood_loss_ml,
        anesthesia_start: hhmm(row.induction_time, tz),
        surgery_start: hhmm(row.surgery_start, tz).unwrap_or_default(),
        surgery_end: hhmm(row.surgery_end, tz).unwrap_or_default(),
        anesthesia_end: None,
        extubation_time: hhmm(row.extubation_time, tz),
        pacu_arrival_time: hhmm(row.pacu_arrival_time, tz),
        aldrete_score: row.aldrete_score,
        complications: row.complications,
        postop_orders: None,
    }))
}

// ── Operation Notes ──────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct OperationNotesRow {
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    booking_id: Uuid,
    surgery_date: chrono::NaiveDate,
    procedure_name: String,
    procedure_code: Option<String>,
    surgeon_name: Option<String>,

    anesthesiologist_name: Option<String>,
    anesthesia_type: Option<String>,
    ot_number: Option<String>,
    findings: Option<String>,
    technique: Option<String>,
    specimens: Option<serde_json::Value>,
    implants: Option<serde_json::Value>,
    drains: Option<serde_json::Value>,
    blood_loss_ml: Option<i32>,
    blood_products: Option<serde_json::Value>,
    complications: Option<String>,
    surgery_start: Option<chrono::DateTime<chrono::Utc>>,
    surgery_end: Option<chrono::DateTime<chrono::Utc>>,
    dictated_by: Option<String>,
    dictated_at: Option<chrono::DateTime<chrono::Utc>>,
    written_consent: Option<String>,
    emergency_consent: Option<String>,
}

/// What the operation went ahead on: the written consent linked to the
/// booking, and/or the two-doctor emergency certification.
fn consent_basis(written: Option<String>, emergency: Option<String>) -> String {
    let parts: Vec<String> = written
        .map(|w| format!("Written consent: {w}"))
        .into_iter()
        .chain(emergency)
        .collect();
    if parts.is_empty() {
        "No consent linked to this booking".to_owned()
    } else {
        parts.join("; ")
    }
}

/// The operation note for one OT booking (`ot_bookings.id`), from the case
/// record the surgeon wrote in `ot_case_records`.
pub async fn get_operation_notes_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(booking_id): Path<Uuid>,
) -> Result<Json<OperationNotesPrintData>, AppError> {
    require_permission(&claims, permissions::ot::case_records::LIST)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::OT_BOOKING,
        booking_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, OperationNotesRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           b.id AS booking_id, \
           b.scheduled_date AS surgery_date, \
           COALESCE(cr.procedure_performed, b.procedure_name) AS procedure_name, \
           b.procedure_code::text AS procedure_code, \
           COALESCE(cr_surgeon.full_name, booked_surgeon.full_name) AS surgeon_name, \
           COALESCE(rec_anesth.full_name, booked_anesth.full_name) AS anesthesiologist_name, \
           ar.anesthesia_type::text AS anesthesia_type, \
           room.name AS ot_number, \
           cr.findings, \
           cr.technique, \
           cr.specimens, \
           cr.implants, \
           cr.drains, \
           cr.blood_loss_ml, \
           ar.blood_products, \
           cr.complications, \
           COALESCE(cr.incision_time, b.actual_start) AS surgery_start, \
           COALESCE(cr.closure_time, b.actual_end) AS surgery_end, \
           cr_surgeon.full_name AS dictated_by, \
           cr.created_at AS dictated_at, \
           (SELECT pc.procedure_name || ', signed ' || to_char(pc.signed_at, 'DD-Mon-YYYY') \
              FROM procedure_consents pc \
             WHERE pc.ot_booking_id = b.id AND pc.tenant_id = b.tenant_id \
               AND pc.consent_type IN ('surgery', 'procedure') AND pc.status = 'signed' \
               AND pc.deleted_at IS NULL \
             ORDER BY pc.signed_at DESC NULLS LAST LIMIT 1) AS written_consent, \
           (SELECT 'Emergency implied consent certified by ' || u1.full_name || ' and ' \
                   || u2.full_name || ': ' || e.reason \
              FROM ot_emergency_consent_certifications e \
              JOIN users u1 ON u1.id = e.first_doctor_id \
              JOIN users u2 ON u2.id = e.second_doctor_id \
             WHERE e.booking_id = b.id AND e.tenant_id = b.tenant_id \
               AND e.deleted_at IS NULL) AS emergency_consent \
         FROM ot_bookings b \
         JOIN patients p ON p.id = b.patient_id AND p.tenant_id = b.tenant_id \
         LEFT JOIN LATERAL (SELECT * FROM ot_case_records x \
           WHERE x.booking_id = b.id AND x.tenant_id = b.tenant_id AND x.deleted_at IS NULL \
           ORDER BY x.created_at DESC LIMIT 1) cr ON true \
         LEFT JOIN LATERAL (SELECT * FROM ot_anesthesia_records x \
           WHERE x.booking_id = b.id AND x.tenant_id = b.tenant_id AND x.deleted_at IS NULL \
           ORDER BY x.created_at DESC LIMIT 1) ar ON true \
         LEFT JOIN ot_rooms room ON room.id = b.ot_room_id AND room.tenant_id = b.tenant_id \
         LEFT JOIN users cr_surgeon ON cr_surgeon.id = cr.surgeon_id \
         LEFT JOIN users booked_surgeon ON booked_surgeon.id = b.primary_surgeon_id \
         LEFT JOIN users rec_anesth ON rec_anesth.id = ar.anesthetist_id \
         LEFT JOIN users booked_anesth ON booked_anesth.id = b.anesthetist_id \
         WHERE b.id = $1 AND b.tenant_id = $2 AND b.deleted_at IS NULL",
    )
    .bind(booking_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    // Assistants are stored as user ids or names; resolve the ids in one query.
    let assistant_surgeons: Vec<String> = sqlx::query_scalar(
        "SELECT COALESCE(u.full_name, a.entry->>'name', a.entry #>> '{}') \
         FROM ot_bookings b \
         CROSS JOIN LATERAL jsonb_array_elements( \
           CASE WHEN jsonb_typeof(b.assistant_surgeons) = 'array' \
                THEN b.assistant_surgeons ELSE '[]'::jsonb END) WITH ORDINALITY AS a(entry, n) \
         LEFT JOIN users u ON u.id::text = a.entry #>> '{}' \
         WHERE b.id = $1 AND b.tenant_id = $2 AND b.deleted_at IS NULL \
         ORDER BY a.n LIMIT 20",
    )
    .bind(booking_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;

    let drains = json_lines(row.drains.as_ref());
    let transfused = json_lines(row.blood_products.as_ref());
    let duration_minutes = match (row.surgery_start, row.surgery_end) {
        (Some(start), Some(end)) => i32::try_from((end - start).num_minutes()).ok(),
        _ => None,
    };

    Ok(Json(OperationNotesPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: row.age.map(|a| format!("{} yrs", a as i64)),
        gender: row.gender,
        surgery_id: row.booking_id.to_string(),
        surgery_date: row.surgery_date.format("%d-%b-%Y").to_string(),
        procedure_name: row.procedure_name,
        procedure_code: row.procedure_code,
        consent_basis: consent_basis(row.written_consent, row.emergency_consent),
        // ponytail: indication, position, incision, closure and the immediate
        // post-op condition/instructions are not recorded on the case record yet.
        indication: String::new(),
        surgeon_name: row.surgeon_name.unwrap_or_default(),
        assistant_surgeons,
        anesthesiologist_name: row.anesthesiologist_name.unwrap_or_default(),
        anesthesia_type: row.anesthesia_type.unwrap_or_default(),
        ot_number: row.ot_number.unwrap_or_default(),
        position: None,
        incision: None,
        findings: row.findings.unwrap_or_default(),
        procedure_details: row.technique.unwrap_or_default(),
        specimens_sent: json_lines(row.specimens.as_ref()),
        drain_details: (!drains.is_empty()).then(|| drains.join("; ")),
        closure_details: None,
        implants: json_lines(row.implants.as_ref()),
        estimated_blood_loss_ml: row.blood_loss_ml,
        transfusion_given: (!transfused.is_empty()).then(|| transfused.join("; ")),
        complications: row.complications,
        surgery_start: hhmm(row.surgery_start, tz).unwrap_or_default(),
        surgery_end: hhmm(row.surgery_end, tz).unwrap_or_default(),
        duration_minutes,
        immediate_postop_condition: None,
        postop_instructions: None,
        dictated_by: row.dictated_by.unwrap_or_default(),
        dictated_at: row
            .dictated_at
            .map(|t| t.with_timezone(&tz).format("%d-%b-%Y %H:%M").to_string())
            .unwrap_or_default(),
    }))
}

// ── Post-Operative Orders ────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct PostopOrdersRow {
    patient_name: String,
    uhid: String,
    admission_id: Option<Uuid>,
    admission_number: Option<String>,
    surgery_date: chrono::NaiveDate,
    procedure_name: String,
    surgeon_name: Option<String>,
    ward_name: Option<String>,
    bed_number: Option<String>,
    surgery_end: Option<chrono::DateTime<chrono::Utc>>,
    diet_orders: Option<String>,
    activity_orders: Option<String>,
    fluid_orders: Option<String>,
    pain_assessment: Option<String>,
    postop_orders: Option<serde_json::Value>,
    notes: Option<String>,
    ordered_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// Post-op orders for one OT booking (`ot_bookings.id`): the recovery record
/// in `ot_postop_records`, plus medicines prescribed on the admission since
/// the operation ended.
pub async fn get_postop_orders_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(booking_id): Path<Uuid>,
) -> Result<Json<PostopOrdersPrintData>, AppError> {
    require_permission(&claims, permissions::ot::postop::LIST)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::OT_BOOKING,
        booking_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, PostopOrdersRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           b.admission_id, \
           a.admission_number, \
           b.scheduled_date AS surgery_date, \
           b.procedure_name, \
           surgeon.full_name AS surgeon_name, \
           w.name AS ward_name, \
           COALESCE(dest.name, l.name) AS bed_number, \
           COALESCE(b.actual_end, b.scheduled_start) AS surgery_end, \
           pr.diet_orders, \
           pr.activity_orders, \
           pr.fluid_orders, \
           pr.pain_assessment, \
           pr.postop_orders, \
           pr.notes, \
           pr.created_at AS ordered_at \
         FROM ot_bookings b \
         JOIN patients p ON p.id = b.patient_id AND p.tenant_id = b.tenant_id \
         LEFT JOIN LATERAL (SELECT * FROM ot_postop_records x \
           WHERE x.booking_id = b.id AND x.tenant_id = b.tenant_id AND x.deleted_at IS NULL \
           ORDER BY x.created_at DESC LIMIT 1) pr ON true \
         LEFT JOIN admissions a ON a.id = b.admission_id AND a.tenant_id = b.tenant_id \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
         LEFT JOIN locations dest ON dest.id = pr.destination_bed_id AND dest.tenant_id = b.tenant_id \
         LEFT JOIN users surgeon ON surgeon.id = b.primary_surgeon_id \
         WHERE b.id = $1 AND b.tenant_id = $2 AND b.deleted_at IS NULL",
    )
    .bind(booking_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let medications = sqlx::query_as::<_, PostopMedicationOrder>(
        "SELECT pi.drug_name, pi.dosage AS dose, COALESCE(pi.route, '') AS route, \
                pi.frequency, pi.duration, pi.instructions AS special_instructions \
         FROM prescription_items pi \
         JOIN prescriptions rx ON rx.id = pi.prescription_id AND rx.tenant_id = pi.tenant_id \
         WHERE rx.admission_id = $1 AND rx.tenant_id = $2 AND rx.created_at >= $3 \
           AND rx.deleted_at IS NULL AND pi.deleted_at IS NULL \
           AND pi.item_status = 'active' AND pi.discontinued_at IS NULL \
         ORDER BY pi.created_at LIMIT 100",
    )
    .bind(row.admission_id)
    .bind(claims.tenant_id)
    .bind(row.surgery_end)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;

    Ok(Json(PostopOrdersPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        admission_number: row.admission_number.unwrap_or_default(),
        surgery_date: row.surgery_date.format("%d-%b-%Y").to_string(),
        procedure_name: row.procedure_name,
        surgeon_name: row.surgeon_name.unwrap_or_default(),
        ward_name: row.ward_name.unwrap_or_default(),
        bed_number: row.bed_number.unwrap_or_default(),
        diet_orders: row.diet_orders,
        // ponytail: position, drain, wound, VTE, pain-management, monitoring,
        // lab, imaging and warning-sign orders and the ordering clinician are
        // not recorded on the post-op record yet.
        position_orders: None,
        activity_orders: row.activity_orders,
        iv_fluids: Vec::new(),
        fluid_orders: row.fluid_orders,
        medications,
        monitoring_orders: Vec::new(),
        drain_care: None,
        wound_care: None,
        vte_prophylaxis: None,
        pain_management: None,
        pain_assessment: row.pain_assessment,
        lab_orders: Vec::new(),
        imaging_orders: Vec::new(),
        special_instructions: row.notes,
        orders: json_lines(row.postop_orders.as_ref()),
        warning_signs: Vec::new(),
        ordered_by: String::new(),
        ordered_at: row
            .ordered_at
            .map(|t| t.with_timezone(&tz).format("%d-%b-%Y %H:%M").to_string())
            .unwrap_or_default(),
    }))
}

// ── Transfusion Monitoring ───────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct TransfusionMonitoringRow {
    patient_name: String,
    uhid: String,
    admission_number: String,
    ward_name: Option<String>,
    bed_number: Option<String>,
    transfusion_id: Uuid,
    transfusion_date: Option<chrono::NaiveDate>,
    product_type: Option<String>,
    bag_number: Option<String>,
    blood_group: Option<String>,
    rh_factor: Option<String>,
    volume_ml: Option<i32>,
    expiry_date: Option<chrono::NaiveDate>,
    crossmatch_compatible: Option<bool>,
    patient_id_verified_by: Option<String>,
    product_verified_by: Option<String>,
    consent_on_file: Option<bool>,
    transfusion_start_time: Option<chrono::DateTime<chrono::Utc>>,
    started_by: Option<String>,
    transfusion_end_time: Option<chrono::DateTime<chrono::Utc>>,
    total_volume_infused_ml: Option<i32>,
    adverse_reaction: bool,
    reaction_type: Option<String>,
    reaction_time: Option<chrono::DateTime<chrono::Utc>>,
    action_taken: Option<String>,
    completed_by: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
struct ObservationRow {
    phase: String,
    observed_at: chrono::DateTime<chrono::Utc>,
    temperature_c: Option<f64>,
    pulse: Option<i32>,
    systolic_bp: Option<i32>,
    diastolic_bp: Option<i32>,
    respiratory_rate: Option<i32>,
    symptoms: Option<String>,
    observed_by: Option<String>,
}

impl ObservationRow {
    fn vitals(&self) -> TransfusionVitals {
        TransfusionVitals {
            bp_systolic: self.systolic_bp,
            bp_diastolic: self.diastolic_bp,
            pulse: self.pulse,
            temperature: self.temperature_c,
            // ponytail: SpO2 is not recorded on transfusion observations yet.
            spo2: None,
            respiratory_rate: self.respiratory_rate,
        }
    }
}

/// The bedside monitoring chart for one transfusion (`transfusions.id`): the
/// unit and its checks, and every observation in `transfusion_observations` —
/// baseline as pre-vitals, completion as post-vitals, the rest as the timeline.
pub async fn get_transfusion_monitoring_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(transfusion_id): Path<Uuid>,
) -> Result<Json<TransfusionMonitoringPrintData>, AppError> {
    require_permission(&claims, permissions::nurse::transfusion::VIEW)?;
    // A transfusion with no admission answers 404 here, as the bedside
    // endpoints do: there is no patient to authorize it against.
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::BEDSIDE_TRANSFUSION,
        transfusion_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, TransfusionMonitoringRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           a.admission_number, \
           w.name AS ward_name, \
           l.name AS bed_number, \
           t.id AS transfusion_id, \
           t.transfusion_date, \
           t.product_type, \
           t.bag_number, \
           t.blood_group, \
           t.rh_factor, \
           t.volume_ml, \
           t.expiry_date, \
           t.crossmatch_compatible, \
           verifier1.full_name AS patient_id_verified_by, \
           verifier2.full_name AS product_verified_by, \
           t.consent_on_file, \
           t.transfusion_start_time, \
           starter.full_name AS started_by, \
           t.transfusion_end_time, \
           t.total_volume_infused_ml, \
           t.adverse_reaction, \
           t.reaction_type, \
           t.reaction_time, \
           t.action_taken, \
           completer.full_name AS completed_by \
         FROM transfusions t \
         JOIN admissions a ON a.id = t.admission_id AND a.tenant_id = t.tenant_id \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
         LEFT JOIN users verifier1 ON verifier1.id = t.patient_verified_by_id \
         LEFT JOIN users verifier2 ON verifier2.id = t.product_verified_by_id \
         LEFT JOIN users starter ON starter.id = t.started_by_id \
         LEFT JOIN users completer ON completer.id = t.completed_by_id \
         WHERE t.id = $1 AND t.tenant_id = $2 AND t.deleted_at IS NULL",
    )
    .bind(transfusion_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let observations = sqlx::query_as::<_, ObservationRow>(
        "SELECT o.phase, o.observed_at, o.temperature_c, o.pulse, o.systolic_bp, \
                o.diastolic_bp, o.respiratory_rate, \
                NULLIF(concat_ws('; ', \
                  CASE WHEN o.reaction_suspected THEN 'Reaction suspected' END, \
                  CASE WHEN o.adverse_signs THEN 'Adverse signs' END, \
                  o.notes), '') AS symptoms, \
                u.full_name AS observed_by \
         FROM transfusion_observations o \
         LEFT JOIN users u ON u.id = o.observed_by \
         WHERE o.transfusion_id = $1 AND o.tenant_id = $2 \
         ORDER BY o.observed_at LIMIT 500",
    )
    .bind(transfusion_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;

    let pre = observations.iter().find(|o| o.phase == "baseline");
    let post = observations.iter().rev().find(|o| o.phase == "completion");
    let monitoring_entries = observations
        .iter()
        .filter(|o| o.phase != "baseline" && o.phase != "completion")
        .map(|o| TransfusionMonitoringEntry {
            time: o.observed_at.with_timezone(&tz).format("%H:%M").to_string(),
            bp_systolic: o.systolic_bp,
            bp_diastolic: o.diastolic_bp,
            pulse: o.pulse,
            temperature: o.temperature_c,
            spo2: None,
            symptoms: o.symptoms.clone(),
            recorded_by: o.observed_by.clone().unwrap_or_default(),
        })
        .collect();

    Ok(Json(TransfusionMonitoringPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        admission_number: row.admission_number,
        ward_name: row.ward_name.unwrap_or_default(),
        bed_number: row.bed_number.unwrap_or_default(),
        transfusion_id: row.transfusion_id.to_string(),
        transfusion_date: row
            .transfusion_date
            .map(|d| d.format("%d-%b-%Y").to_string())
            .unwrap_or_default(),
        product_type: row.product_type.unwrap_or_default(),
        bag_number: row.bag_number.unwrap_or_default(),
        blood_group: row.blood_group.unwrap_or_default(),
        rh_factor: row.rh_factor.unwrap_or_default(),
        // The bedside start endpoint always records volume and both checks;
        // a null here is a row from before it, printed as not recorded.
        volume_ml: row.volume_ml,
        expiry_date: row
            .expiry_date
            .map(|d| d.format("%d-%b-%Y").to_string())
            .unwrap_or_default(),
        pre_vitals: pre.map_or(
            TransfusionVitals {
                bp_systolic: None,
                bp_diastolic: None,
                pulse: None,
                temperature: None,
                spo2: None,
                respiratory_rate: None,
            },
            ObservationRow::vitals,
        ),
        crossmatch_compatible: row.crossmatch_compatible,
        patient_id_verified_by: row.patient_id_verified_by.unwrap_or_default(),
        product_verified_by: row.product_verified_by.unwrap_or_default(),
        consent_on_file: row.consent_on_file,
        transfusion_start_time: hhmm(row.transfusion_start_time, tz).unwrap_or_default(),
        started_by: row.started_by.unwrap_or_default(),
        monitoring_entries,
        transfusion_end_time: hhmm(row.transfusion_end_time, tz),
        post_vitals: post.map(ObservationRow::vitals),
        total_volume_infused_ml: row.total_volume_infused_ml,
        adverse_reaction: row.adverse_reaction,
        reaction_type: row.reaction_type,
        reaction_time: hhmm(row.reaction_time, tz),
        action_taken: row.action_taken,
        completed_by: row.completed_by,
    }))
}

/// surgical print-data routes.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route(
            "/api/print-data/case-sheet-cover/{admission_id}",
            get(get_case_sheet_cover_print_data),
        )
        .route(
            "/api/print-data/preop-assessment/{booking_id}",
            get(get_preop_assessment_print_data),
        )
        .route(
            "/api/print-data/surgical-safety-checklist/{booking_id}",
            get(get_surgical_safety_checklist_print_data),
        )
        .route(
            "/api/print-data/anesthesia-record/{booking_id}",
            get(get_anesthesia_record_print_data),
        )
        .route(
            "/api/print-data/operation-notes/{booking_id}",
            get(get_operation_notes_print_data),
        )
        .route(
            "/api/print-data/postop-orders/{booking_id}",
            get(get_postop_orders_print_data),
        )
        .route(
            "/api/print-data/transfusion-monitoring/{transfusion_id}",
            get(get_transfusion_monitoring_print_data),
        )
}
