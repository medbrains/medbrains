//! Print-data endpoints — medico-legal forms.

use axum::routing::get;
use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use medbrains_core::permissions;
use medbrains_core::print_data::{
    AgeEstimationPrintData, AmaFormPrintData, DeathDeclarationPrintData, InjuryEntry, MlcDateEntry,
    MlcDocumentationPrintData, MlcPoliceIntimationPrintData, MlcRegisterPrintData,
    PoliceVisitEntry, SecondaryCharacters, WoundCertificatePrintData, WoundEntry,
};

use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::{
    require_any_permission, require_permission,
};
use medbrains_server_core::state::AppState;

#[derive(Debug, Deserialize)]
pub struct MedicolegalPrintQuery {
    pub reprint_reason: Option<String>,
}

const MLC_PRINT_CONTEXT_PERMISSIONS: &[&str] = &[
    permissions::emergency::mlc::LIST,
    permissions::emergency::mlc::PRINT,
    permissions::emergency::mlc::REPRINT,
];
const MLC_POLICE_INTIMATION_PRINT_CONTEXT_PERMISSIONS: &[&str] = &[
    permissions::emergency::mlc_police_intimations::PRINT,
    permissions::emergency::mlc_police_intimations::REPRINT,
];

struct MlcPrintOutput<'a> {
    source_id: Uuid,
    patient_id: Uuid,
    admission_id: Option<Uuid>,
    document_type: &'static str,
    title: &'static str,
    reprint_reason: Option<&'a str>,
}

async fn record_mlc_print_output(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    output: MlcPrintOutput<'_>,
) -> Result<(), AppError> {
    let MlcPrintOutput {
        source_id,
        patient_id,
        admission_id,
        document_type,
        title,
        reprint_reason,
    } = output;
    let prior_print_count: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(print_count), 0)::bigint \
         FROM document_outputs \
         WHERE tenant_id = $1 \
           AND module_code = 'emergency' \
           AND source_table = 'mlc_cases' \
           AND source_id = $2 \
           AND title = $3 \
           AND status <> 'voided'::document_output_status",
    )
    .bind(claims.tenant_id)
    .bind(source_id)
    .bind(title)
    .fetch_one(&mut **tx)
    .await?;

    let is_reprint = prior_print_count > 0;
    if is_reprint {
        require_permission(claims, permissions::emergency::mlc::REPRINT)?;
        if reprint_reason.is_none_or(|value| value.len() < 5) {
            return Err(AppError::BadRequest(
                "reprint reason is required after the first MLC print".to_owned(),
            ));
        }
    } else {
        require_permission(claims, permissions::emergency::mlc::PRINT)?;
        if reprint_reason.is_some() {
            return Err(AppError::BadRequest(
                "MLC packet has not been printed yet".to_owned(),
            ));
        }
    }

    // The hospital's date, from the transaction's TimeZone — not the server's.
    let (today, day_count): (String, i64) = sqlx::query_as(
        "SELECT d.today, \
           (SELECT COUNT(*)::bigint FROM document_outputs \
             WHERE tenant_id = $1 \
               AND module_code = 'emergency' \
               AND document_number LIKE 'ER-MLC-' || d.today || '-%') \
         FROM (SELECT to_char(now(), 'YYYYMMDD') AS today) d",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut **tx)
    .await?;
    let document_number = format!("ER-MLC-{today}-{:04}", day_count + 1);
    let print_action = if is_reprint { "reprint" } else { "print" };
    let context_snapshot = json!({
        "document_type": document_type,
        "action": print_action,
        "mlc_case_id": source_id,
        "prior_print_count": prior_print_count,
        "reprint_reason": reprint_reason,
    });

    let document_output_id: Uuid = sqlx::query_scalar(
        "INSERT INTO document_outputs \
         (tenant_id, module_code, source_table, source_id, patient_id, visit_id, admission_id, \
          document_number, title, category, status, page_count, print_count, \
          first_printed_at, last_printed_at, watermark, context_snapshot, generated_by) \
         VALUES ($1, 'emergency', 'mlc_cases', $2, $3, NULL, $4, \
          $5, $6, 'custom'::document_template_category, \
          'printed'::document_output_status, 1, 1, now(), now(), \
          CASE WHEN $7::bool THEN 'duplicate'::watermark_type ELSE 'none'::watermark_type END, \
          $8, $9) \
         RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(source_id)
    .bind(patient_id)
    .bind(admission_id)
    .bind(&document_number)
    .bind(title)
    .bind(is_reprint)
    .bind(&context_snapshot)
    .bind(claims.sub)
    .fetch_one(&mut **tx)
    .await?;

    let audit_values = json!({
        "document_output_id": document_output_id,
        "document_number": document_number,
        "document_type": document_type,
        "action": print_action,
        "mlc_case_id": source_id,
        "prior_print_count": prior_print_count,
        "reprint_reason": reprint_reason,
    });
    medbrains_db::audit::AuditLogger::log(
        tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action: if is_reprint {
                "emergency.mlc.reprint"
            } else {
                "emergency.mlc.print"
            },
            entity_type: "mlc_case",
            entity_id: Some(source_id),
            old_values: None,
            new_values: Some(&audit_values),
            ip_address: None,
        },
    )
    .await?;

    Ok(())
}

async fn record_mlc_police_intimation_print_output(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    intimation_id: Uuid,
    mlc_case_id: Uuid,
    patient_id: Uuid,
    admission_id: Option<Uuid>,
    reprint_reason: Option<&str>,
) -> Result<(), AppError> {
    let prior_print_count: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(print_count), 0)::bigint \
         FROM document_outputs \
         WHERE tenant_id = $1 \
           AND module_code = 'emergency' \
           AND source_table = 'mlc_police_intimations' \
           AND source_id = $2 \
           AND title = 'MLC Police Intimation' \
           AND status <> 'voided'::document_output_status",
    )
    .bind(claims.tenant_id)
    .bind(intimation_id)
    .fetch_one(&mut **tx)
    .await?;

    let is_reprint = prior_print_count > 0;
    if is_reprint {
        require_permission(
            claims,
            permissions::emergency::mlc_police_intimations::REPRINT,
        )?;
        if reprint_reason.is_none_or(|value| value.len() < 5) {
            return Err(AppError::BadRequest(
                "reprint reason is required after the first police intimation print".to_owned(),
            ));
        }
    } else {
        require_permission(
            claims,
            permissions::emergency::mlc_police_intimations::PRINT,
        )?;
        if reprint_reason.is_some() {
            return Err(AppError::BadRequest(
                "police intimation has not been printed yet".to_owned(),
            ));
        }
    }

    // The hospital's date, from the transaction's TimeZone — not the server's.
    let (today, day_count): (String, i64) = sqlx::query_as(
        "SELECT d.today, \
           (SELECT COUNT(*)::bigint FROM document_outputs \
             WHERE tenant_id = $1 \
               AND module_code = 'emergency' \
               AND document_number LIKE 'ER-MLC-PI-' || d.today || '-%') \
         FROM (SELECT to_char(now(), 'YYYYMMDD') AS today) d",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut **tx)
    .await?;
    let document_number = format!("ER-MLC-PI-{today}-{:04}", day_count + 1);
    let print_action = if is_reprint { "reprint" } else { "print" };
    let context_snapshot = json!({
        "document_type": "mlc_police_intimation",
        "action": print_action,
        "mlc_case_id": mlc_case_id,
        "police_intimation_id": intimation_id,
        "prior_print_count": prior_print_count,
        "reprint_reason": reprint_reason,
    });

    let document_output_id: Uuid = sqlx::query_scalar(
        "INSERT INTO document_outputs \
         (tenant_id, module_code, source_table, source_id, patient_id, visit_id, admission_id, \
          document_number, title, category, status, page_count, print_count, \
          first_printed_at, last_printed_at, watermark, context_snapshot, generated_by) \
         VALUES ($1, 'emergency', 'mlc_police_intimations', $2, $3, NULL, $4, \
          $5, 'MLC Police Intimation', 'custom'::document_template_category, \
          'printed'::document_output_status, 1, 1, now(), now(), \
          CASE WHEN $6::bool THEN 'duplicate'::watermark_type ELSE 'none'::watermark_type END, \
          $7, $8) \
         RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(intimation_id)
    .bind(patient_id)
    .bind(admission_id)
    .bind(&document_number)
    .bind(is_reprint)
    .bind(&context_snapshot)
    .bind(claims.sub)
    .fetch_one(&mut **tx)
    .await?;

    let audit_values = json!({
        "document_output_id": document_output_id,
        "document_number": document_number,
        "document_type": "mlc_police_intimation",
        "action": print_action,
        "mlc_case_id": mlc_case_id,
        "police_intimation_id": intimation_id,
        "prior_print_count": prior_print_count,
        "reprint_reason": reprint_reason,
    });
    medbrains_db::audit::AuditLogger::log(
        tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action: if is_reprint {
                "emergency.mlc_police_intimations.reprint"
            } else {
                "emergency.mlc_police_intimations.print"
            },
            entity_type: "mlc_police_intimation",
            entity_id: Some(intimation_id),
            old_values: None,
            new_values: Some(&audit_values),
            ip_address: None,
        },
    )
    .await?;

    Ok(())
}

// ── Against Medical Advice (AMA) Form ────────────────────

#[derive(Debug, sqlx::FromRow)]
struct AmaFormRow {
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    admission_number: String,
    admission_date: chrono::NaiveDate,
    ward_name: String,
    bed_number: String,
    diagnosis: String,
    treating_doctor: Option<String>,
    ama_date: chrono::NaiveDate,
    ama_time: chrono::NaiveTime,
    risks_explained: Option<String>,
    reason_for_ama: Option<String>,
    patient_signature_obtained: bool,
    relative_name: Option<String>,
    relative_relationship: Option<String>,
    relative_signature_obtained: bool,
    witness1_name: Option<String>,
    doctor_name: Option<String>,
}

/// The DAMA/LAMA declaration recorded on the admission (`ipd_dama_records`,
/// written by the IPD DAMA modal). No declaration → 404: there is nothing to
/// print, and a blank form dated today would be a document nobody signed.
pub async fn get_ama_form_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<AmaFormPrintData>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;
    require_permission(&claims, permissions::patients::VIEW)?;
    medbrains_authz_gate::require_admission_access(&state, &claims, admission_id).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, AmaFormRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           a.admission_number, \
           a.admitted_at::date AS admission_date, \
           COALESCE(w.name, '') AS ward_name, \
           COALESCE(l.name, '') AS bed_number, \
           COALESCE(a.provisional_diagnosis, '') AS diagnosis, \
           doc.full_name AS treating_doctor, \
           d.declared_at::date AS ama_date, \
           d.declared_at::time AS ama_time, \
           d.risks_explained, \
           d.reason_for_leaving AS reason_for_ama, \
           COALESCE(d.patient_signed, false) AS patient_signature_obtained, \
           d.relative_name, \
           d.relative_relation AS relative_relationship, \
           COALESCE(d.relative_signed, false) AS relative_signature_obtained, \
           d.witness_name AS witness1_name, \
           decl.full_name AS doctor_name \
         FROM admissions a \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
           AND p.deleted_at IS NULL \
         JOIN LATERAL ( \
           SELECT * FROM ipd_dama_records r \
           WHERE r.admission_id = a.id AND r.tenant_id = a.tenant_id \
             AND r.deleted_at IS NULL \
           ORDER BY r.declared_at DESC LIMIT 1 \
         ) d ON true \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
           AND w.deleted_at IS NULL \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
           AND l.deleted_at IS NULL \
         LEFT JOIN users doc ON doc.id = a.admitting_doctor \
         LEFT JOIN users decl ON decl.id = d.declared_by \
         WHERE a.id = $1 AND a.tenant_id = $2 AND a.deleted_at IS NULL",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let ama_sigs = medbrains_signing::signed_documents::fetch_all_signatures_for_print(
        &mut tx,
        &claims.tenant_id,
        "other",
        admission_id,
    )
    .await?;

    tx.commit().await?;

    // ponytail: the DAMA record captures one free-text risk statement, one
    // witness, and no per-clause acknowledgements, doctor signature flag,
    // thumb impression or interpreter. Those print as not recorded (`None`)
    // until the DAMA modal captures them.
    Ok(Json(AmaFormPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: row.age.map(|a| format!("{} yrs", a as i64)),
        gender: row.gender,
        admission_number: row.admission_number,
        admission_date: row.admission_date.format("%d-%b-%Y").to_string(),
        ward_name: row.ward_name,
        bed_number: row.bed_number,
        diagnosis: row.diagnosis,
        treating_doctor: row.treating_doctor.unwrap_or_default(),
        ama_date: row.ama_date.format("%d-%b-%Y").to_string(),
        ama_time: row.ama_time.format("%H:%M").to_string(),
        risks_explained: row.risks_explained.into_iter().collect(),
        patient_understands_risks: None,
        patient_refuses_treatment: None,
        patient_assumes_responsibility: None,
        reason_for_ama: row.reason_for_ama,
        patient_signature_obtained: row.patient_signature_obtained,
        relative_name: row.relative_name,
        relative_relationship: row.relative_relationship,
        relative_signature_obtained: row.relative_signature_obtained,
        witness1_name: row.witness1_name,
        witness1_designation: None,
        witness2_name: None,
        witness2_designation: None,
        doctor_name: row.doctor_name.unwrap_or_default(),
        doctor_signature_obtained: None,
        thumb_impression_taken: None,
        interpreter_used: None,
        interpreter_name: None,
        interpreter_language: None,
        signatures: medbrains_signing::signed_documents::to_print_signatures(ama_sigs),
    }))
}

// ── MLC Register ─────────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct MlcRegisterRow {
    patient_id: Uuid,
    admission_id: Option<Uuid>,
    mlc_number: String,
    registration_date: chrono::NaiveDate,
    registration_time: chrono::NaiveTime,
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    address: Option<String>,
    brought_by: Option<String>,
    police_station: Option<String>,
    police_officer_name: Option<String>,
    police_officer_rank: Option<String>,
    police_dd_number: Option<String>,
    nature_of_case: String,
    alleged_history: String,
    date_time_of_incident: Option<chrono::DateTime<chrono::Utc>>,
    place_of_incident: Option<String>,
    weapon_used: Option<String>,
    condition_on_arrival: String,
    treatment_given: String,
    samples_handed_to: Option<String>,
    opinion: Option<String>,
    patient_condition_at_discharge: Option<String>,
    examining_doctor: Option<String>,
    examined_at: Option<chrono::DateTime<chrono::Utc>>,
}

pub async fn get_mlc_register_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(case_id): Path<Uuid>,
    Query(query): Query<MedicolegalPrintQuery>,
) -> Result<Json<MlcRegisterPrintData>, AppError> {
    require_any_permission(&claims, MLC_PRINT_CONTEXT_PERMISSIONS)?;
    require_permission(&claims, permissions::patients::VIEW)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::MLC_CASE,
        case_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, MlcRegisterRow>(
        "SELECT \
           mlc.patient_id, \
           mlc.admission_id, \
           mlc.mlc_number, \
           COALESCE(mlc.registration_date, mlc.registered_at::date) AS registration_date, \
           COALESCE(mlc.registration_time, mlc.registered_at::time) AS registration_time, \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           p.address::text AS address, \
           mlc.brought_by, \
           mlc.police_station, \
           mlc.police_officer_name, \
           mlc.police_officer_rank, \
           mlc.police_dd_number, \
           COALESCE(mlc.nature_of_case, mlc.case_type, '') AS nature_of_case, \
           COALESCE(mlc.alleged_history, mlc.history_of_incident, '') AS alleged_history, \
           mlc.date_time_of_incident, \
           mlc.place_of_incident, \
           mlc.weapon_used, \
           COALESCE(mlc.condition_on_arrival, '') AS condition_on_arrival, \
           COALESCE(mlc.treatment_given, '') AS treatment_given, \
           mlc.samples_handed_to, \
           COALESCE(mlc.opinion, mlc.medical_opinion) AS opinion, \
           mlc.patient_condition_at_discharge, \
           doc.full_name AS examining_doctor, \
           mlc.examined_at \
         FROM mlc_cases mlc \
         JOIN patients p ON p.id = mlc.patient_id AND p.tenant_id = mlc.tenant_id \
           AND p.deleted_at IS NULL \
         LEFT JOIN users doc ON doc.id = mlc.examining_doctor_id \
         WHERE mlc.id = $1 AND mlc.tenant_id = $2 AND mlc.deleted_at IS NULL",
    )
    .bind(case_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let injuries_noted = sqlx::query_as::<_, InjuryEntry>(
        "SELECT \
           injury_number, \
           injury_type, \
           COALESCE(location, '') AS location, \
           size_cm, \
           COALESCE(description, '') AS description, \
           probable_age, \
           probable_weapon \
         FROM mlc_injuries \
         WHERE mlc_case_id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
         ORDER BY injury_number LIMIT 5000",
    )
    .bind(case_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // ponytail: this list prints as empty; the table behind it has no
    // writer yet (no screen or handler), so nothing is claimed.
    let samples_collected: Vec<String> = Vec::new();

    let reprint_reason = query
        .reprint_reason
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    record_mlc_print_output(
        &mut tx,
        &claims,
        MlcPrintOutput {
            source_id: case_id,
            patient_id: row.patient_id,
            admission_id: row.admission_id,
            document_type: "mlc_register",
            title: "MLC Register Extract",
            reprint_reason,
        },
    )
    .await?;

    tx.commit().await?;

    Ok(Json(MlcRegisterPrintData {
        mlc_number: row.mlc_number,
        registration_date: row.registration_date.format("%d-%b-%Y").to_string(),
        registration_time: row.registration_time.format("%H:%M").to_string(),
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: row.age.map(|a| format!("{} yrs", a as i64)),
        gender: row.gender,
        address: row.address,
        brought_by: row.brought_by,
        police_station: row.police_station,
        police_officer_name: row.police_officer_name,
        police_officer_rank: row.police_officer_rank,
        police_dd_number: row.police_dd_number,
        nature_of_case: row.nature_of_case,
        alleged_history: row.alleged_history,
        date_time_of_incident: row
            .date_time_of_incident
            .map(|dt| dt.with_timezone(&tz).format("%d-%b-%Y %H:%M").to_string()),
        place_of_incident: row.place_of_incident,
        weapon_used: row.weapon_used,
        condition_on_arrival: row.condition_on_arrival,
        injuries_noted,
        treatment_given: row.treatment_given,
        samples_collected,
        samples_handed_to: row.samples_handed_to,
        opinion: row.opinion,
        patient_condition_at_discharge: row.patient_condition_at_discharge,
        examining_doctor: row.examining_doctor.unwrap_or_default(),
        examined_at: row
            .examined_at
            .map(|t| t.with_timezone(&tz).format("%d-%b-%Y %H:%M").to_string())
            .unwrap_or_default(),
    }))
}

#[derive(Debug, sqlx::FromRow)]
struct MlcPoliceIntimationPrintRow {
    mlc_case_id: Uuid,
    patient_id: Uuid,
    admission_id: Option<Uuid>,
    intimation_number: String,
    mlc_number: String,
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    police_station: String,
    officer_name: Option<String>,
    officer_designation: Option<String>,
    officer_contact: Option<String>,
    sent_at: chrono::DateTime<chrono::Utc>,
    sent_via: Option<String>,
    receipt_confirmed: bool,
    receipt_confirmed_at: Option<chrono::DateTime<chrono::Utc>>,
    receipt_number: Option<String>,
    notes: Option<String>,
    sent_by: Option<String>,
}

pub async fn get_mlc_police_intimation_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(intimation_id): Path<Uuid>,
    Query(query): Query<MedicolegalPrintQuery>,
) -> Result<Json<MlcPoliceIntimationPrintData>, AppError> {
    require_any_permission(&claims, MLC_POLICE_INTIMATION_PRINT_CONTEXT_PERMISSIONS)?;
    require_permission(&claims, permissions::patients::VIEW)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::MLC_POLICE_INTIMATION,
        intimation_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, MlcPoliceIntimationPrintRow>(
        "SELECT \
           pi.mlc_case_id, \
           mlc.patient_id, \
           mlc.admission_id, \
           pi.intimation_number, \
           mlc.mlc_number, \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           pi.police_station, \
           pi.officer_name, \
           pi.officer_designation, \
           pi.officer_contact, \
           pi.sent_at, \
           pi.sent_via, \
           pi.receipt_confirmed, \
           pi.receipt_confirmed_at, \
           pi.receipt_number, \
           pi.notes, \
           sender.full_name AS sent_by \
         FROM mlc_police_intimations pi \
         JOIN mlc_cases mlc ON mlc.id = pi.mlc_case_id AND mlc.tenant_id = pi.tenant_id \
           AND mlc.deleted_at IS NULL \
         JOIN patients p ON p.id = mlc.patient_id AND p.tenant_id = mlc.tenant_id \
           AND p.deleted_at IS NULL \
         LEFT JOIN users sender ON sender.id = pi.sent_by AND sender.tenant_id = pi.tenant_id \
         WHERE pi.id = $1 AND pi.tenant_id = $2 AND pi.deleted_at IS NULL",
    )
    .bind(intimation_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let reprint_reason = query
        .reprint_reason
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    record_mlc_police_intimation_print_output(
        &mut tx,
        &claims,
        intimation_id,
        row.mlc_case_id,
        row.patient_id,
        row.admission_id,
        reprint_reason,
    )
    .await?;

    tx.commit().await?;

    Ok(Json(MlcPoliceIntimationPrintData {
        intimation_number: row.intimation_number,
        mlc_number: row.mlc_number,
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: row.age.map(|a| format!("{} yrs", a as i64)),
        gender: row.gender,
        police_station: row.police_station,
        officer_name: row.officer_name,
        officer_designation: row.officer_designation,
        officer_contact: row.officer_contact,
        sent_at: row
            .sent_at
            .with_timezone(&tz)
            .format("%d-%b-%Y %H:%M")
            .to_string(),
        sent_via: row.sent_via,
        receipt_confirmed: row.receipt_confirmed,
        receipt_confirmed_at: row.receipt_confirmed_at.map(|value| {
            value
                .with_timezone(&tz)
                .format("%d-%b-%Y %H:%M")
                .to_string()
        }),
        receipt_number: row.receipt_number,
        notes: row.notes,
        sent_by: row.sent_by,
        generated_at: chrono::Utc::now()
            .with_timezone(&tz)
            .format("%d-%b-%Y %H:%M")
            .to_string(),
    }))
}

// ── Wound Certificate ────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct WoundCertRow {
    patient_name: String,
    patient_age: Option<f64>,
    patient_gender: String,
    patient_address: Option<String>,
    patient_occupation: Option<String>,
    examined_at: Option<chrono::DateTime<chrono::Utc>>,
    mlc_number: String,
    police_station: Option<String>,
    date_time_of_incident: Option<chrono::DateTime<chrono::Utc>>,
    place_of_incident: Option<String>,
    alleged_manner: Option<String>,
    general_condition: Option<String>,
    opinion_nature: Option<String>,
    weapon_used: Option<String>,
    examining_doctor: Option<String>,
    doctor_designation: Option<String>,
    doctor_registration_number: Option<String>,
}

/// The wound certificate of an MLC case: the case's examination and opinion
/// (`mlc_cases`) plus its injury list (`mlc_injuries`, the body-map screen).
pub async fn get_wound_certificate_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(case_id): Path<Uuid>,
) -> Result<Json<WoundCertificatePrintData>, AppError> {
    require_permission(&claims, permissions::emergency::mlc::LIST)?;
    require_permission(&claims, permissions::patients::VIEW)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::MLC_CASE,
        case_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, WoundCertRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS patient_age, \
           p.gender::text AS patient_gender, \
           p.address::text AS patient_address, \
           p.occupation AS patient_occupation, \
           mlc.examined_at, \
           mlc.mlc_number, \
           mlc.police_station, \
           mlc.date_time_of_incident, \
           mlc.place_of_incident, \
           COALESCE(mlc.alleged_history, mlc.history_of_incident) AS alleged_manner, \
           mlc.condition_on_arrival AS general_condition, \
           COALESCE(mlc.opinion, mlc.medical_opinion) AS opinion_nature, \
           mlc.weapon_used, \
           doc.full_name AS examining_doctor, \
           doc.designation AS doctor_designation, \
           doc.registration_number AS doctor_registration_number \
         FROM mlc_cases mlc \
         JOIN patients p ON p.id = mlc.patient_id AND p.tenant_id = mlc.tenant_id \
           AND p.deleted_at IS NULL \
         LEFT JOIN users doc ON doc.id = mlc.examining_doctor_id \
         WHERE mlc.id = $1 AND mlc.tenant_id = $2 AND mlc.deleted_at IS NULL",
    )
    .bind(case_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // ponytail: margins, floor, surrounding area and healing stage are not
    // recorded per injury yet; they print empty.
    let injuries = sqlx::query_as::<_, WoundEntry>(
        "SELECT \
           injury_number AS wound_number, \
           injury_type AS wound_type, \
           COALESCE(location, '') AS location, \
           size_cm AS dimensions, \
           NULL::text AS margins, \
           NULL::text AS floor, \
           NULL::text AS surrounding_area, \
           NULL::text AS healing_stage, \
           probable_age AS probable_age_of_wound, \
           description, \
           probable_weapon, \
           nature \
         FROM mlc_injuries \
         WHERE mlc_case_id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
         ORDER BY injury_number LIMIT 5000",
    )
    .bind(case_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let wound_sigs = medbrains_signing::signed_documents::fetch_all_signatures_for_print(
        &mut tx,
        &claims.tenant_id,
        "mlc_certificate",
        case_id,
    )
    .await?;

    tx.commit().await?;

    // ponytail: certificate number/date, identification, police requisition,
    // vitals, x-ray/other investigations and the duration/disability/danger
    // opinions are not recorded on an MLC case yet; they print empty.
    Ok(Json(WoundCertificatePrintData {
        certificate_number: String::new(),
        certificate_date: String::new(),
        patient_name: row.patient_name,
        patient_age: row.patient_age.map(|a| format!("{} yrs", a as i64)),
        patient_gender: row.patient_gender,
        patient_address: row.patient_address,
        patient_occupation: row.patient_occupation,
        identified_by: None,
        identification_document: None,
        examination_date: row
            .examined_at
            .map(|t| t.with_timezone(&tz).format("%d-%b-%Y").to_string())
            .unwrap_or_default(),
        examination_time: row
            .examined_at
            .map(|t| t.with_timezone(&tz).format("%H:%M").to_string())
            .unwrap_or_default(),
        mlc_number: Some(row.mlc_number),
        police_requisition_number: None,
        police_station: row.police_station,
        alleged_incident_date: row
            .date_time_of_incident
            .map(|t| t.with_timezone(&tz).format("%d-%b-%Y").to_string()),
        alleged_incident_time: row
            .date_time_of_incident
            .map(|t| t.with_timezone(&tz).format("%H:%M").to_string()),
        alleged_incident_place: row.place_of_incident,
        alleged_manner: row.alleged_manner,
        general_condition: row.general_condition.unwrap_or_default(),
        vital_signs: None,
        injuries,
        x_ray_findings: None,
        other_investigations: None,
        opinion_nature: row.opinion_nature.unwrap_or_default(),
        opinion_weapon: row.weapon_used,
        opinion_duration: None,
        opinion_disability: None,
        opinion_danger_to_life: None,
        examining_doctor: row.examining_doctor.unwrap_or_default(),
        doctor_designation: row.doctor_designation.unwrap_or_default(),
        doctor_registration_number: row.doctor_registration_number.unwrap_or_default(),
        signatures: medbrains_signing::signed_documents::to_print_signatures(wound_sigs),
    }))
}

// ── Age Estimation ───────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct AgeEstimationRow {
    certificate_date: chrono::NaiveDate,
    person_name: String,
    person_gender: String,
    secondary_sexual_characteristics: Option<String>,
    dental_examination: Option<String>,
    estimated_age_range: Option<String>,
    examiner_opinion: Option<String>,
    ossification_findings: Option<String>,
    examining_doctor: Option<String>,
    doctor_designation: Option<String>,
    doctor_registration_number: Option<String>,
}

/// One age-estimation document of an MLC case (`mlc_documents` with
/// `document_type = 'age_estimation'`, saved from the MLC case screen). Its
/// `content` is the five free-text fields that form captures.
pub async fn get_age_estimation_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(document_id): Path<Uuid>,
) -> Result<Json<AgeEstimationPrintData>, AppError> {
    require_permission(&claims, permissions::emergency::mlc::LIST)?;
    require_permission(&claims, permissions::patients::VIEW)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::MLC_DOCUMENT,
        document_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, AgeEstimationRow>(
        "SELECT \
           d.created_at::date AS certificate_date, \
           (p.first_name || ' ' || p.last_name) AS person_name, \
           p.gender::text AS person_gender, \
           NULLIF(d.content->>'secondary_sexual_characteristics', '') \
             AS secondary_sexual_characteristics, \
           NULLIF(d.content->>'dental_examination', '') AS dental_examination, \
           NULLIF(d.content->>'estimated_age_range', '') AS estimated_age_range, \
           NULLIF(d.content->>'examiner_opinion', '') AS examiner_opinion, \
           NULLIF(d.content->>'ossification_center_findings', '') \
             AS ossification_findings, \
           doc.full_name AS examining_doctor, \
           doc.designation AS doctor_designation, \
           doc.registration_number AS doctor_registration_number \
         FROM mlc_documents d \
         JOIN mlc_cases mlc ON mlc.id = d.mlc_case_id AND mlc.tenant_id = d.tenant_id \
           AND mlc.deleted_at IS NULL \
         JOIN patients p ON p.id = mlc.patient_id AND p.tenant_id = mlc.tenant_id \
           AND p.deleted_at IS NULL \
         LEFT JOIN users doc ON doc.id = d.generated_by \
         WHERE d.id = $1 AND d.tenant_id = $2 \
           AND d.document_type = 'age_estimation' AND d.deleted_at IS NULL",
    )
    .bind(document_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let age_sigs = medbrains_signing::signed_documents::fetch_all_signatures_for_print(
        &mut tx,
        &claims.tenant_id,
        "mlc_certificate",
        document_id,
    )
    .await?;

    tx.commit().await?;

    // ponytail: the age-estimation form records only five free-text fields.
    // Certificate number, purpose, requisition, identification marks,
    // physique, height/weight, third molars and per-joint x-rays are not
    // printed; the ossification findings print as recorded, in free text.
    Ok(Json(AgeEstimationPrintData {
        certificate_number: String::new(),
        certificate_date: row.certificate_date.format("%d-%b-%Y").to_string(),
        person_name: row.person_name,
        person_gender: row.person_gender,
        stated_age: None,
        purpose_of_examination: String::new(),
        requisition_from: None,
        requisition_number: None,
        requisition_date: None,
        identification_marks: Vec::new(),
        general_physical_development: String::new(),
        height_cm: None,
        weight_kg: None,
        secondary_sexual_characters: SecondaryCharacters {
            breast_development: None,
            pubic_hair: None,
            axillary_hair: None,
            facial_hair: None,
            voice_change: None,
            other_findings: row.secondary_sexual_characteristics,
        },
        dental_formula: row.dental_examination.unwrap_or_default(),
        third_molars_status: String::new(),
        teeth_wear: None,
        xray_wrist_findings: None,
        xray_elbow_findings: None,
        xray_shoulder_findings: None,
        epiphyseal_fusion_status: Vec::new(),
        ossification_findings: row.ossification_findings,
        estimated_age_years: row.estimated_age_range.unwrap_or_default(),
        age_range_min: None,
        age_range_max: None,
        opinion_basis: row.examiner_opinion.unwrap_or_default(),
        examining_doctor: row.examining_doctor.unwrap_or_default(),
        doctor_designation: row.doctor_designation.unwrap_or_default(),
        doctor_registration_number: row.doctor_registration_number.unwrap_or_default(),
        signatures: medbrains_signing::signed_documents::to_print_signatures(age_sigs),
    }))
}

// ── Death Declaration ────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct DeathDeclRow {
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    address: Option<String>,
    admission_number: Option<String>,
    admission_date: Option<chrono::NaiveDate>,
    ward_name: Option<String>,
    bed_number: Option<String>,
    death_date: chrono::NaiveDate,
    death_time: Option<chrono::NaiveTime>,
    is_brought_dead: bool,
    immediate_cause: Option<String>,
    antecedent_cause: Option<String>,
    underlying_cause: Option<String>,
    manner_of_death: String,
    is_medico_legal: bool,
    mlc_number: Option<String>,
    autopsy_requested: Option<bool>,
    declared_by: Option<String>,
    doctor_designation: Option<String>,
    doctor_registration_number: Option<String>,
    certificate_number: Option<String>,
}

/// The patient's entry in the MRD death register (`mrd_death_register`, the
/// MRD → Deaths screen). A patient dies once, so the patient id names it.
pub async fn get_death_declaration_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<DeathDeclarationPrintData>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;
    require_permission(&claims, permissions::patients::VIEW)?;
    medbrains_authz_gate::require_patient_access(&state, &claims, patient_id).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    // Register "cause of death" is the general field; it stands in for the
    // immediate cause only when the immediate cause was not split out.
    // Autopsy request lives on the IPD death summary of the same admission.
    let row = sqlx::query_as::<_, DeathDeclRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(dr.death_date, p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           p.address::text AS address, \
           a.admission_number, \
           a.admitted_at::date AS admission_date, \
           w.name AS ward_name, \
           l.name AS bed_number, \
           dr.death_date, \
           dr.death_time, \
           dr.is_brought_dead, \
           COALESCE(dr.immediate_cause, dr.cause_of_death) AS immediate_cause, \
           dr.antecedent_cause, \
           dr.underlying_cause, \
           dr.manner_of_death, \
           dr.is_medico_legal, \
           mlc.mlc_number, \
           ds.autopsy_requested, \
           doc.full_name AS declared_by, \
           doc.designation AS doctor_designation, \
           doc.registration_number AS doctor_registration_number, \
           dr.certificate_number \
         FROM mrd_death_register dr \
         JOIN patients p ON p.id = dr.patient_id AND p.tenant_id = dr.tenant_id \
           AND p.deleted_at IS NULL \
         LEFT JOIN admissions a ON a.id = dr.admission_id AND a.tenant_id = dr.tenant_id \
           AND a.deleted_at IS NULL \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
           AND w.deleted_at IS NULL \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
           AND l.deleted_at IS NULL \
         LEFT JOIN mlc_cases mlc ON mlc.id = dr.mlc_case_id AND mlc.tenant_id = dr.tenant_id \
           AND mlc.deleted_at IS NULL \
         LEFT JOIN ipd_death_summaries ds ON ds.admission_id = dr.admission_id \
           AND ds.tenant_id = dr.tenant_id AND ds.deleted_at IS NULL \
         LEFT JOIN users doc ON doc.id = dr.certifying_doctor_id \
         WHERE dr.patient_id = $1 AND dr.tenant_id = $2 AND dr.deleted_at IS NULL \
         ORDER BY dr.created_at DESC LIMIT 1",
    )
    .bind(patient_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let dd_sigs = medbrains_signing::signed_documents::fetch_all_signatures_for_print(
        &mut tx,
        &claims.tenant_id,
        "death_certificate",
        patient_id,
    )
    .await?;

    tx.commit().await?;

    // ponytail: place of death, other significant conditions, autopsy
    // performed and relatives informed are not recorded anywhere yet; they
    // print empty / `None` (= not recorded).
    Ok(Json(DeathDeclarationPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: row.age.map(|a| format!("{} yrs", a as i64)),
        gender: row.gender,
        address: row.address,
        admission_number: row.admission_number,
        admission_date: row.admission_date.map(|d| d.format("%d-%b-%Y").to_string()),
        ward_name: row.ward_name,
        bed_number: row.bed_number,
        date_of_death: row.death_date.format("%d-%b-%Y").to_string(),
        time_of_death: row
            .death_time
            .map(|t| t.format("%H:%M").to_string())
            .unwrap_or_default(),
        place_of_death: String::new(),
        brought_dead: row.is_brought_dead,
        cause_of_death_immediate: row.immediate_cause.unwrap_or_default(),
        cause_of_death_antecedent: row.antecedent_cause,
        cause_of_death_underlying: row.underlying_cause,
        other_significant_conditions: None,
        manner_of_death: row.manner_of_death,
        is_mlc: row.is_medico_legal,
        mlc_number: row.mlc_number,
        autopsy_required: row.autopsy_requested,
        autopsy_performed: None,
        relatives_informed: None,
        relative_name: None,
        relative_relationship: None,
        declared_by: row.declared_by.unwrap_or_default(),
        doctor_designation: row.doctor_designation.unwrap_or_default(),
        doctor_registration_number: row.doctor_registration_number.unwrap_or_default(),
        death_certificate_number: row.certificate_number,
        signatures: medbrains_signing::signed_documents::to_print_signatures(dd_sigs),
    }))
}

// ── MLC Documentation (Full Case Summary) ────────────────

#[derive(Debug, sqlx::FromRow)]
struct MlcDocRow {
    patient_id: Uuid,
    admission_id: Option<Uuid>,
    mlc_number: String,
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    address: Option<String>,
    admission_date: Option<chrono::NaiveDate>,
    discharge_date: Option<chrono::NaiveDate>,
    final_diagnosis: String,
    treatment_summary: String,
    investigation_summary: String,
    clinical_findings_at_discharge: String,
    complications: Option<String>,
    prognosis: String,
    permanent_disability: Option<String>,
    disability_percentage: Option<String>,
    examination_findings: Option<String>,
    police_station: Option<String>,
    fir_number: Option<String>,
    court_case_number: Option<String>,
    prepared_by: Option<String>,
    verified_by: Option<String>,
    prepared_at: chrono::DateTime<chrono::Utc>,
}

pub async fn get_mlc_documentation_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(case_id): Path<Uuid>,
    Query(query): Query<MedicolegalPrintQuery>,
) -> Result<Json<MlcDocumentationPrintData>, AppError> {
    require_any_permission(&claims, MLC_PRINT_CONTEXT_PERMISSIONS)?;
    require_permission(&claims, permissions::patients::VIEW)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::MLC_CASE,
        case_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, MlcDocRow>(
        "SELECT \
           mlc.patient_id, \
           mlc.admission_id, \
           mlc.mlc_number, \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           p.address::text AS address, \
           a.admitted_at::date AS admission_date, \
           a.discharged_at::date AS discharge_date, \
           COALESCE(mlc.medical_opinion, '') AS final_diagnosis, \
           ''::text AS treatment_summary, \
           ''::text AS investigation_summary, \
           ''::text AS clinical_findings_at_discharge, \
           NULL::text AS complications, \
           ''::text AS prognosis, \
           NULL::text AS permanent_disability, \
           NULL::text AS disability_percentage, \
           mlc.examination_findings, \
           mlc.police_station, \
           mlc.fir_number, \
           NULL::text AS court_case_number, \
           preparer.full_name AS prepared_by, \
           NULL::text AS verified_by, \
           mlc.updated_at AS prepared_at \
         FROM mlc_cases mlc \
         JOIN patients p ON p.id = mlc.patient_id AND p.tenant_id = mlc.tenant_id \
           AND p.deleted_at IS NULL \
         LEFT JOIN admissions a ON a.id = mlc.admission_id AND a.tenant_id = mlc.tenant_id \
           AND a.deleted_at IS NULL \
         LEFT JOIN users preparer ON preparer.id = mlc.registered_by \
         WHERE mlc.id = $1 AND mlc.tenant_id = $2 AND mlc.deleted_at IS NULL",
    )
    .bind(case_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // ponytail: the MLC module records no operative procedures; the section
    // prints empty until it does (the OT record is the place to link).
    let operative_procedures: Vec<String> = Vec::new();

    // An intimation receipt is not a recorded statement; nothing records
    // police statements yet, so `statement_recorded` is `None` (= not recorded).
    let police_visits = sqlx::query_as::<_, PoliceVisitEntry>(
        "SELECT sent_at::date::text AS visit_date, COALESCE(officer_name, '') AS officer_name, \
                COALESCE(officer_designation, '') AS officer_rank, \
                'Intimation ' || COALESCE(intimation_number, '') || ' to ' || police_station AS purpose, \
                NULL::boolean AS statement_recorded \
         FROM mlc_police_intimations \
         WHERE mlc_case_id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
         ORDER BY sent_at LIMIT 5000",
    )
    .bind(case_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // ponytail: this list prints as empty; the table behind it has no
    // writer yet (no screen or handler), so nothing is claimed.
    let samples_preserved = Vec::new();

    let certificates_issued: Vec<String> = sqlx::query_scalar(
        "SELECT COALESCE(NULLIF(title, ''), document_type::text) FROM mlc_documents \
         WHERE mlc_case_id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
         ORDER BY created_at LIMIT 5000",
    )
    .bind(case_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let important_dates = sqlx::query_as::<_, MlcDateEntry>(
        "SELECT event_date, event_description FROM ( \
           SELECT sent_at AS at, sent_at::date::text AS event_date, \
                  'Police intimated: ' || police_station AS event_description \
             FROM mlc_police_intimations \
            WHERE mlc_case_id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
           UNION ALL \
           SELECT created_at, created_at::date::text, \
                  COALESCE(NULLIF(title, ''), document_type::text) || ' issued' \
             FROM mlc_documents \
            WHERE mlc_case_id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
         ) dates ORDER BY at LIMIT 5000",
    )
    .bind(case_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let mlc_sigs = medbrains_signing::signed_documents::fetch_all_signatures_for_print(
        &mut tx,
        &claims.tenant_id,
        "mlc_certificate",
        case_id,
    )
    .await?;

    let reprint_reason = query
        .reprint_reason
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    record_mlc_print_output(
        &mut tx,
        &claims,
        MlcPrintOutput {
            source_id: case_id,
            patient_id: row.patient_id,
            admission_id: row.admission_id,
            document_type: "mlc_documentation",
            title: "MLC Documentation Packet",
            reprint_reason,
        },
    )
    .await?;

    tx.commit().await?;

    Ok(Json(MlcDocumentationPrintData {
        mlc_number: row.mlc_number,
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: row.age.map(|a| format!("{} yrs", a as i64)),
        gender: row.gender,
        address: row.address,
        admission_date: row.admission_date.map(|d| d.format("%d-%b-%Y").to_string()),
        discharge_date: row.discharge_date.map(|d| d.format("%d-%b-%Y").to_string()),
        final_diagnosis: row.final_diagnosis,
        treatment_summary: row.treatment_summary,
        operative_procedures,
        investigation_summary: row.investigation_summary,
        clinical_findings_at_discharge: row.clinical_findings_at_discharge,
        complications: row.complications,
        prognosis: row.prognosis,
        permanent_disability: row.permanent_disability,
        disability_percentage: row.disability_percentage,
        examination_findings: row.examination_findings,
        police_station: row.police_station,
        fir_number: row.fir_number,
        court_case_number: row.court_case_number,
        police_visits,
        samples_preserved,
        certificates_issued,
        important_dates,
        prepared_by: row.prepared_by.unwrap_or_default(),
        verified_by: row.verified_by.unwrap_or_default(),
        prepared_at: row
            .prepared_at
            .with_timezone(&tz)
            .format("%d-%b-%Y %H:%M")
            .to_string(),
        signatures: medbrains_signing::signed_documents::to_print_signatures(mlc_sigs),
    }))
}

/// medicolegal print-data routes.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route(
            "/api/print-data/ama-form/{admission_id}",
            get(get_ama_form_print_data),
        )
        .route(
            "/api/print-data/mlc-register/{case_id}",
            get(get_mlc_register_print_data),
        )
        .route(
            "/api/print-data/mlc-police-intimation/{intimation_id}",
            get(get_mlc_police_intimation_print_data),
        )
        .route(
            "/api/print-data/wound-certificate/{case_id}",
            get(get_wound_certificate_print_data),
        )
        .route(
            "/api/print-data/age-estimation/{document_id}",
            get(get_age_estimation_print_data),
        )
        .route(
            "/api/print-data/death-declaration/{patient_id}",
            get(get_death_declaration_print_data),
        )
        .route(
            "/api/print-data/mlc-documentation/{case_id}",
            get(get_mlc_documentation_print_data),
        )
}
