//! Print-data endpoints — wristband, appointment, death certificate, discharge.

use axum::routing::get;
use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use medbrains_core::clinical_events::{ClinicalEventEnvelope, ClinicalEventName};
use medbrains_core::permissions;
use medbrains_core::print_data::{
    AppointmentSlipPrintData, CumulativeLabReportPrintData, DeathCertificatePrintData,
    DischargeSummaryPrintData, ErDischargeSummaryPrintData, InfantWristbandPrintData, LabParameter,
    LabReportFullPrintData, OpdCertificatePrintData, OpdPrescriptionPrintData,
    OpdProcedureConsentPrintData, OpdVitals, ParameterTrend, PrescriptionMedication,
    RadiologyReportFullPrintData, RegistrationCardPrintData, TokenSlipPrintData,
    TransferSummaryPrintData, TreatmentChartIvFluid, TreatmentChartMedication,
    TreatmentChartPrintData, TrendValue, VisitorPassPrintData, WristbandPrintData,
};

use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

// ── OPD certificate / consent print ledger ───────────────

#[derive(Debug, Deserialize)]
pub struct OpdPrintQuery {
    pub reprint_reason: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
struct OpdCertificatePrintRow {
    certificate_id: Uuid,
    certificate_number: Option<String>,
    certificate_type: String,
    patient_id: Uuid,
    encounter_id: Option<Uuid>,
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    date_of_birth: Option<chrono::NaiveDate>,
    phone: String,
    doctor_name: Option<String>,
    department: Option<String>,
    encounter_date: Option<chrono::NaiveDate>,
    issued_date: chrono::NaiveDate,
    valid_from: Option<chrono::NaiveDate>,
    valid_to: Option<chrono::NaiveDate>,
    diagnosis: Option<String>,
    remarks: Option<String>,
    body: serde_json::Value,
}

#[derive(Debug, sqlx::FromRow)]
struct OpdConsentPrintRow {
    consent_id: Uuid,
    consent_type: String,
    status: String,
    patient_id: Uuid,
    encounter_id: Option<Uuid>,
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    date_of_birth: Option<chrono::NaiveDate>,
    phone: String,
    doctor_name: Option<String>,
    department: Option<String>,
    encounter_date: Option<chrono::NaiveDate>,
    procedure_name: String,
    risks_explained: Option<String>,
    alternatives_explained: Option<String>,
    benefits_explained: Option<String>,
    patient_questions: Option<String>,
    consented_by_name: Option<String>,
    consented_by_relation: Option<String>,
    witness_name: Option<String>,
    witness_designation: Option<String>,
    signed_at: Option<chrono::DateTime<Utc>>,
    withdrawn_at: Option<chrono::DateTime<Utc>>,
    withdrawal_reason: Option<String>,
    created_at: chrono::DateTime<Utc>,
}

fn formatted_age(age: Option<f64>) -> Option<String> {
    age.map(|value| format!("{} yrs", value as i64))
}

fn formatted_date(date: Option<chrono::NaiveDate>) -> Option<String> {
    date.map(|value| value.format("%d-%b-%Y").to_string())
}

fn formatted_datetime(
    datetime: Option<chrono::DateTime<Utc>>,
    tz: chrono::FixedOffset,
) -> Option<String> {
    datetime.map(|value| {
        value
            .with_timezone(&tz)
            .format("%d-%b-%Y %H:%M")
            .to_string()
    })
}

async fn hospital_name(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
) -> Result<Option<String>, AppError> {
    Ok(
        sqlx::query_scalar::<_, String>("SELECT name FROM tenants WHERE id = $1")
            .bind(tenant_id)
            .fetch_optional(&mut **tx)
            .await?,
    )
}

pub async fn get_opd_certificate_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(certificate_id): Path<Uuid>,
    Query(query): Query<OpdPrintQuery>,
) -> Result<Json<OpdCertificatePrintData>, AppError> {
    require_permission(&claims, permissions::opd::certificates::LIST)?;
    require_permission(&claims, permissions::opd::certificates::PRINT)?;
    require_permission(&claims, permissions::patients::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let prior_print_count: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(print_count), 0)::bigint \
         FROM document_outputs \
         WHERE tenant_id = $1 \
           AND module_code = 'opd' \
           AND source_table = 'medical_certificates' \
           AND source_id = $2 \
           AND title = 'OPD Medical Certificate' \
           AND status <> 'voided'::document_output_status",
    )
    .bind(claims.tenant_id)
    .bind(certificate_id)
    .fetch_one(&mut *tx)
    .await?;

    let reprint_reason = query
        .reprint_reason
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let is_reprint = prior_print_count > 0;
    if is_reprint {
        require_permission(&claims, permissions::opd::certificates::REPRINT)?;
        medbrains_authz_gate::require_access_via(
            &state,
            &claims,
            medbrains_authz_gate::links::MEDICAL_CERTIFICATE,
            certificate_id,
        )
        .await?;
        if reprint_reason.is_none_or(|value| value.len() < 5) {
            return Err(AppError::BadRequest(
                "reprint reason is required after the first certificate print".to_owned(),
            ));
        }
    } else if reprint_reason.is_some() {
        return Err(AppError::BadRequest(
            "certificate has not been printed yet".to_owned(),
        ));
    }

    let row = sqlx::query_as::<_, OpdCertificatePrintRow>(
        "SELECT \
           mc.id AS certificate_id, \
           mc.certificate_number, \
           mc.certificate_type, \
           mc.patient_id, \
           mc.encounter_id, \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           p.date_of_birth, \
           p.phone, \
           doc.full_name AS doctor_name, \
           dept.name AS department, \
           e.encounter_date, \
           mc.issued_date, \
           mc.valid_from, \
           mc.valid_to, \
           mc.diagnosis, \
           mc.remarks, \
           mc.body \
         FROM medical_certificates mc \
         JOIN patients p ON p.id = mc.patient_id AND p.tenant_id = mc.tenant_id \
         LEFT JOIN users doc ON doc.id = mc.doctor_id AND doc.tenant_id = mc.tenant_id \
         LEFT JOIN encounters e ON e.id = mc.encounter_id AND e.tenant_id = mc.tenant_id \
         LEFT JOIN departments dept ON dept.id = e.department_id AND dept.tenant_id = e.tenant_id \
         WHERE mc.id = $1 AND mc.tenant_id = $2 AND mc.is_void = false",
    )
    .bind(certificate_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let today = Utc::now().with_timezone(&tz).format("%Y%m%d").to_string();
    let document_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::bigint \
         FROM document_outputs \
         WHERE tenant_id = $1 \
           AND document_number LIKE 'OPD-CERT-' || $2 || '-%'",
    )
    .bind(claims.tenant_id)
    .bind(&today)
    .fetch_one(&mut *tx)
    .await?;
    let document_number = format!("OPD-CERT-{today}-{:04}", document_count + 1);
    let print_action = if is_reprint { "reprint" } else { "print" };
    let context_snapshot = json!({
        "document_type": "opd_medical_certificate",
        "action": print_action,
        "certificate_id": row.certificate_id,
        "certificate_number": row.certificate_number,
        "patient_id": row.patient_id,
        "encounter_id": row.encounter_id,
        "prior_print_count": prior_print_count,
        "reprint_reason": reprint_reason,
    });

    let document_output_id: Uuid = sqlx::query_scalar(
        "INSERT INTO document_outputs \
         (tenant_id, module_code, source_table, source_id, patient_id, visit_id, admission_id, \
          document_number, title, category, status, page_count, print_count, \
          first_printed_at, last_printed_at, watermark, context_snapshot, generated_by) \
         VALUES ($1, 'opd', 'medical_certificates', $2, $3, $4, NULL, \
          $5, 'OPD Medical Certificate', 'custom'::document_template_category, \
          'printed'::document_output_status, 1, 1, now(), now(), \
          CASE WHEN $6::bool THEN 'duplicate'::watermark_type ELSE 'none'::watermark_type END, \
          $7, $8) \
         RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(certificate_id)
    .bind(row.patient_id)
    .bind(row.encounter_id)
    .bind(&document_number)
    .bind(is_reprint)
    .bind(&context_snapshot)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    let audit_values = json!({
        "document_output_id": document_output_id,
        "document_number": &document_number,
        "document_type": "opd_medical_certificate",
        "action": print_action,
        "certificate_id": row.certificate_id,
        "certificate_number": row.certificate_number,
        "prior_print_count": prior_print_count,
        "reprint_reason": reprint_reason,
    });
    medbrains_db::audit::AuditLogger::log(
        &mut tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action: if is_reprint {
                "opd.certificate.reprint"
            } else {
                "opd.certificate.print"
            },
            entity_type: "medical_certificate",
            entity_id: Some(certificate_id),
            old_values: None,
            new_values: Some(&audit_values),
            ip_address: None,
        },
    )
    .await?;

    let h_name = hospital_name(&mut tx, claims.tenant_id).await?;
    tx.commit().await?;

    Ok(Json(OpdCertificatePrintData {
        document_number,
        is_reprint,
        certificate_number: row.certificate_number,
        certificate_type: row.certificate_type,
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: formatted_age(row.age),
        gender: row.gender,
        date_of_birth: formatted_date(row.date_of_birth),
        phone: row.phone,
        doctor_name: row.doctor_name,
        department: row.department,
        encounter_date: formatted_date(row.encounter_date),
        issued_date: row.issued_date.format("%d-%b-%Y").to_string(),
        valid_from: formatted_date(row.valid_from),
        valid_to: formatted_date(row.valid_to),
        diagnosis: row.diagnosis,
        remarks: row.remarks,
        body: row.body,
        hospital_name: h_name,
    }))
}

pub async fn get_opd_consent_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(consent_id): Path<Uuid>,
    Query(query): Query<OpdPrintQuery>,
) -> Result<Json<OpdProcedureConsentPrintData>, AppError> {
    require_permission(&claims, permissions::opd::consents::LIST)?;
    require_permission(&claims, permissions::opd::consents::PRINT)?;
    require_permission(&claims, permissions::patients::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let prior_print_count: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(print_count), 0)::bigint \
         FROM document_outputs \
         WHERE tenant_id = $1 \
           AND module_code = 'opd' \
           AND source_table = 'procedure_consents' \
           AND source_id = $2 \
           AND title = 'OPD Procedure Consent' \
           AND status <> 'voided'::document_output_status",
    )
    .bind(claims.tenant_id)
    .bind(consent_id)
    .fetch_one(&mut *tx)
    .await?;

    let reprint_reason = query
        .reprint_reason
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    // Outside the reprint branch, where an earlier pass of this sweep left it.
    // Nested under `if is_reprint` it checked the SECOND print of a consent and
    // never the first — and the first is the one that hands out the patient's
    // name, UHID, date of birth and gender.
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::PROCEDURE_CONSENT,
        consent_id,
    )
    .await?;

    let is_reprint = prior_print_count > 0;
    if is_reprint {
        require_permission(&claims, permissions::opd::consents::REPRINT)?;
        if reprint_reason.is_none_or(|value| value.len() < 5) {
            return Err(AppError::BadRequest(
                "reprint reason is required after the first consent print".to_owned(),
            ));
        }
    } else if reprint_reason.is_some() {
        return Err(AppError::BadRequest(
            "consent has not been printed yet".to_owned(),
        ));
    }

    let row = sqlx::query_as::<_, OpdConsentPrintRow>(
        "SELECT \
           pc.id AS consent_id, \
           pc.consent_type::text AS consent_type, \
           pc.status::text AS status, \
           pc.patient_id, \
           pc.encounter_id, \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           p.date_of_birth, \
           p.phone, \
           doc.full_name AS doctor_name, \
           dept.name AS department, \
           e.encounter_date, \
           pc.procedure_name, \
           pc.risks_explained, \
           pc.alternatives_explained, \
           pc.benefits_explained, \
           pc.patient_questions, \
           pc.consented_by_name, \
           pc.consented_by_relation, \
           pc.witness_name, \
           pc.witness_designation, \
           pc.signed_at, \
           pc.withdrawn_at, \
           pc.withdrawal_reason, \
           pc.created_at \
         FROM procedure_consents pc \
         JOIN patients p ON p.id = pc.patient_id AND p.tenant_id = pc.tenant_id \
         LEFT JOIN users doc ON doc.id = pc.doctor_id AND doc.tenant_id = pc.tenant_id \
         LEFT JOIN encounters e ON e.id = pc.encounter_id AND e.tenant_id = pc.tenant_id \
         LEFT JOIN departments dept ON dept.id = e.department_id AND dept.tenant_id = e.tenant_id \
         WHERE pc.id = $1 AND pc.tenant_id = $2",
    )
    .bind(consent_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let today = Utc::now().with_timezone(&tz).format("%Y%m%d").to_string();
    let document_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::bigint \
         FROM document_outputs \
         WHERE tenant_id = $1 \
           AND document_number LIKE 'OPD-CONS-' || $2 || '-%'",
    )
    .bind(claims.tenant_id)
    .bind(&today)
    .fetch_one(&mut *tx)
    .await?;
    let document_number = format!("OPD-CONS-{today}-{:04}", document_count + 1);
    let print_action = if is_reprint { "reprint" } else { "print" };
    let context_snapshot = json!({
        "document_type": "opd_procedure_consent",
        "action": print_action,
        "consent_id": row.consent_id,
        "patient_id": row.patient_id,
        "encounter_id": row.encounter_id,
        "status": row.status,
        "prior_print_count": prior_print_count,
        "reprint_reason": reprint_reason,
    });

    let document_output_id: Uuid = sqlx::query_scalar(
        "INSERT INTO document_outputs \
         (tenant_id, module_code, source_table, source_id, patient_id, visit_id, admission_id, \
          document_number, title, category, status, page_count, print_count, \
          first_printed_at, last_printed_at, watermark, context_snapshot, generated_by) \
         VALUES ($1, 'opd', 'procedure_consents', $2, $3, $4, NULL, \
          $5, 'OPD Procedure Consent', 'custom'::document_template_category, \
          'printed'::document_output_status, 1, 1, now(), now(), \
          CASE WHEN $6::bool THEN 'duplicate'::watermark_type ELSE 'none'::watermark_type END, \
          $7, $8) \
         RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(consent_id)
    .bind(row.patient_id)
    .bind(row.encounter_id)
    .bind(&document_number)
    .bind(is_reprint)
    .bind(&context_snapshot)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    let audit_values = json!({
        "document_output_id": document_output_id,
        "document_number": &document_number,
        "document_type": "opd_procedure_consent",
        "action": print_action,
        "consent_id": row.consent_id,
        "status": row.status,
        "prior_print_count": prior_print_count,
        "reprint_reason": reprint_reason,
    });
    medbrains_db::audit::AuditLogger::log(
        &mut tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action: if is_reprint {
                "opd.consent.reprint"
            } else {
                "opd.consent.print"
            },
            entity_type: "procedure_consent",
            entity_id: Some(consent_id),
            old_values: None,
            new_values: Some(&audit_values),
            ip_address: None,
        },
    )
    .await?;

    let h_name = hospital_name(&mut tx, claims.tenant_id).await?;
    tx.commit().await?;

    Ok(Json(OpdProcedureConsentPrintData {
        document_number,
        is_reprint,
        consent_id: row.consent_id.to_string(),
        consent_type: row.consent_type,
        status: row.status,
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: formatted_age(row.age),
        gender: row.gender,
        date_of_birth: formatted_date(row.date_of_birth),
        phone: row.phone,
        doctor_name: row.doctor_name,
        department: row.department,
        encounter_date: formatted_date(row.encounter_date),
        procedure_name: row.procedure_name,
        risks_explained: row.risks_explained,
        alternatives_explained: row.alternatives_explained,
        benefits_explained: row.benefits_explained,
        patient_questions: row.patient_questions,
        consented_by_name: row.consented_by_name,
        consented_by_relation: row.consented_by_relation,
        witness_name: row.witness_name,
        witness_designation: row.witness_designation,
        signed_at: formatted_datetime(row.signed_at, tz),
        withdrawn_at: formatted_datetime(row.withdrawn_at, tz),
        withdrawal_reason: row.withdrawal_reason,
        created_at: row
            .created_at
            .with_timezone(&tz)
            .format("%d-%b-%Y %H:%M")
            .to_string(),
        hospital_name: h_name,
    }))
}

// ── Wristband ────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct WristbandPrintQuery {
    pub reprint_reason: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
struct WristbandRow {
    patient_id: Uuid,
    encounter_id: Uuid,
    patient_name: String,
    uhid: String,
    admission_number: Option<String>,
    age: Option<f64>,
    gender: String,
    date_of_birth: Option<chrono::NaiveDate>,
    blood_group: Option<String>,
    admitted_at: chrono::DateTime<Utc>,
    bed_number: Option<String>,
    ward_name: Option<String>,
    doctor_name: Option<String>,
    is_critical: bool,
    is_mlc: bool,
}

pub async fn get_wristband_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
    Query(query): Query<WristbandPrintQuery>,
) -> Result<Json<WristbandPrintData>, AppError> {
    require_permission(&claims, permissions::ipd::wristband::PRINT)?;
    medbrains_authz_gate::require_admission_access(&state, &claims, admission_id).await?;
    require_permission(&claims, permissions::patients::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let prior_print_count: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(print_count), 0)::bigint \
         FROM document_outputs \
         WHERE tenant_id = $1 \
           AND module_code = 'ipd' \
           AND source_table = 'admissions' \
           AND source_id = $2 \
           AND title = 'IPD Wristband' \
           AND status <> 'voided'::document_output_status",
    )
    .bind(claims.tenant_id)
    .bind(admission_id)
    .fetch_one(&mut *tx)
    .await?;

    let reprint_reason = query
        .reprint_reason
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let is_reprint = prior_print_count > 0;
    if is_reprint {
        require_permission(&claims, permissions::ipd::wristband::REPRINT)?;
        if reprint_reason.is_none_or(|value| value.len() < 5) {
            return Err(AppError::BadRequest(
                "reprint reason is required after the first wristband print".to_owned(),
            ));
        }
    } else if reprint_reason.is_some() {
        return Err(AppError::BadRequest(
            "wristband has not been printed yet".to_owned(),
        ));
    }

    let row = sqlx::query_as::<_, WristbandRow>(
        "SELECT \
           a.patient_id, \
           a.encounter_id, \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           a.admission_number, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           p.date_of_birth, \
           p.blood_group::text AS blood_group, \
           a.admitted_at, \
           l.name AS bed_number, \
           w.name AS ward_name, \
           doc.full_name AS doctor_name, \
           a.is_critical, \
           (a.mlc_case_id IS NOT NULL) AS is_mlc \
         FROM admissions a \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
         LEFT JOIN users doc ON doc.id = a.admitting_doctor AND doc.tenant_id = a.tenant_id \
         WHERE a.id = $1 AND a.tenant_id = $2",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let allergies: Vec<String> = sqlx::query_scalar(
        "SELECT allergen_name FROM patient_allergies \
         WHERE patient_id = $1 \
           AND tenant_id = $2 \
           AND is_active = true \
           AND deleted_at IS NULL \
         ORDER BY created_at LIMIT 5000",
    )
    .bind(row.patient_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let today = Utc::now().with_timezone(&tz).format("%Y%m%d").to_string();
    let document_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::bigint \
         FROM document_outputs \
         WHERE tenant_id = $1 \
           AND document_number LIKE 'IPD-WB-' || $2 || '-%'",
    )
    .bind(claims.tenant_id)
    .bind(&today)
    .fetch_one(&mut *tx)
    .await?;
    let document_number = format!("IPD-WB-{today}-{:04}", document_count + 1);
    let print_action = if is_reprint { "reprint" } else { "print" };
    let context_snapshot = json!({
        "document_type": "ipd_wristband",
        "action": print_action,
        "admission_id": admission_id,
        "patient_id": row.patient_id,
        "encounter_id": row.encounter_id,
        "prior_print_count": prior_print_count,
        "reprint_reason": reprint_reason,
    });

    let document_output_id: Uuid = sqlx::query_scalar(
        "INSERT INTO document_outputs \
         (tenant_id, module_code, source_table, source_id, patient_id, visit_id, admission_id, \
          document_number, title, category, status, page_count, print_count, \
          first_printed_at, last_printed_at, watermark, context_snapshot, generated_by) \
         VALUES ($1, 'ipd', 'admissions', $2, $3, $4, $2, \
          $5, 'IPD Wristband', 'custom'::document_template_category, \
          'printed'::document_output_status, 1, 1, now(), now(), \
          CASE WHEN $6::bool THEN 'duplicate'::watermark_type ELSE 'none'::watermark_type END, \
          $7, $8) \
         RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(admission_id)
    .bind(row.patient_id)
    .bind(row.encounter_id)
    .bind(&document_number)
    .bind(is_reprint)
    .bind(&context_snapshot)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    let audit_values = json!({
        "document_output_id": document_output_id,
        "document_number": document_number,
        "document_type": "ipd_wristband",
        "action": print_action,
        "prior_print_count": prior_print_count,
        "reprint_reason": reprint_reason,
    });
    medbrains_db::audit::AuditLogger::log(
        &mut tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action: if is_reprint {
                "ipd.wristband.reprint"
            } else {
                "ipd.wristband.print"
            },
            entity_type: "admission",
            entity_id: Some(admission_id),
            old_values: None,
            new_values: Some(&audit_values),
            ip_address: None,
        },
    )
    .await?;

    tx.commit().await?;

    // The band carries the UHID itself: the bedside medication check compares
    // the scanned code to it (BCMA), so any other payload would be refused.
    let barcode_svg = medbrains_print::codes::code128_svg(&row.uhid, 40)
        .map_err(|e| AppError::Internal(format!("wristband barcode: {e}")))?;
    let qr_svg = medbrains_print::codes::qr_svg(&row.uhid)
        .map_err(|e| AppError::Internal(format!("wristband qr: {e}")))?;
    Ok(Json(WristbandPrintData {
        barcode_svg,
        qr_svg,
        document_number,
        is_reprint,
        patient_name: row.patient_name,
        uhid: row.uhid,
        admission_number: row.admission_number,
        age: row.age.map(|a| format!("{} yrs", a as i64)),
        gender: row.gender,
        date_of_birth: row.date_of_birth.map(|d| d.format("%d-%b-%Y").to_string()),
        blood_group: row.blood_group,
        admission_date: row
            .admitted_at
            .with_timezone(&tz)
            .format("%d-%b-%Y")
            .to_string(),
        bed_number: row.bed_number,
        ward_name: row.ward_name,
        doctor_name: row.doctor_name,
        is_critical: row.is_critical,
        is_mlc: row.is_mlc,
        allergies,
    }))
}

// ── Discharge Summary ────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct DischargeSummaryRow {
    patient_name: String,
    uhid: String,
    admission_number: Option<String>,
    age: Option<f64>,
    gender: String,
    admitted_at: chrono::DateTime<Utc>,
    discharged_at: Option<chrono::DateTime<Utc>>,
    department: Option<String>,
    doctor_name: Option<String>,
    bed_number: Option<String>,
    ward_name: Option<String>,
    discharge_type: Option<String>,
    discharge_summary: Option<String>,
    diagnosis: Option<String>,
}

pub async fn get_discharge_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<DischargeSummaryPrintData>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;
    medbrains_authz_gate::require_admission_access(&state, &claims, admission_id).await?;
    require_permission(&claims, permissions::patients::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, DischargeSummaryRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           a.admission_number, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           a.admitted_at, \
           a.discharged_at, \
           dept.name AS department, \
           doc.full_name AS doctor_name, \
           l.name AS bed_number, \
           w.name AS ward_name, \
           a.discharge_type::text AS discharge_type, \
           a.discharge_summary, \
           a.provisional_diagnosis AS diagnosis \
         FROM admissions a \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
         LEFT JOIN encounters e ON e.id = a.encounter_id \
                                AND e.tenant_id = a.tenant_id \
         LEFT JOIN departments dept ON dept.id = e.department_id \
                                    AND dept.tenant_id = a.tenant_id \
         LEFT JOIN users doc ON doc.id = a.admitting_doctor \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
         WHERE a.id = $1 AND a.tenant_id = $2",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Fetch signatures (primary + co-signers) for the discharge summary.
    let sigs = medbrains_signing::signed_documents::fetch_all_signatures_for_print(
        &mut tx,
        &claims.tenant_id,
        "discharge_summary",
        admission_id,
    )
    .await?;

    tx.commit().await?;

    let fmt_ts = |dt: Option<chrono::DateTime<Utc>>| {
        dt.map(|d| d.with_timezone(&tz).format("%d-%b-%Y %H:%M").to_string())
    };

    Ok(Json(DischargeSummaryPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        admission_number: row.admission_number,
        age: row.age.map(|a| format!("{} yrs", a as i64)),
        gender: row.gender,
        admission_date: row
            .admitted_at
            .with_timezone(&tz)
            .format("%d-%b-%Y")
            .to_string(),
        discharge_date: fmt_ts(row.discharged_at),
        department: row.department,
        doctor_name: row.doctor_name,
        bed_number: row.bed_number,
        ward_name: row.ward_name,
        discharge_type: row.discharge_type,
        discharge_summary: row.discharge_summary,
        diagnosis: row.diagnosis,
        signatures: sigs
            .into_iter()
            .map(|s| medbrains_core::print_data::PrintSignatureData {
                signed_at: s.signed_at.to_rfc3339(),
                signer_name: s.signer_name,
                display_image_url: s.display_image_url,
                display_block: s.display_block,
                verify_ref: s.verify_ref,
                legal_class: s.legal_class,
            })
            .collect(),
    }))
}

// ── ER Discharge Summary ────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct ErDischargeRow {
    visit_number: String,
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    arrival_time: chrono::DateTime<Utc>,
    chief_complaint: Option<String>,
    triage_level: Option<String>,
    disposition: Option<String>,
    doctor_name: Option<String>,
    status: String,
    final_diagnosis: Option<String>,
    condition_at_discharge: Option<String>,
    clinical_course: Option<String>,
    treatment_given: Option<String>,
    medications_on_discharge: Option<String>,
    follow_up_instructions: Option<String>,
    follow_up_date: Option<chrono::NaiveDate>,
    warning_signs: Option<String>,
    finalized_at: Option<chrono::DateTime<Utc>>,
}

pub async fn get_er_discharge_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(er_visit_id): Path<Uuid>,
) -> Result<Json<ErDischargeSummaryPrintData>, AppError> {
    require_permission(&claims, permissions::emergency::visits::LIST)?;
    require_permission(&claims, permissions::patients::VIEW)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::ER_DISCHARGE_SUMMARY,
        er_visit_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, ErDischargeRow>(
        "SELECT \
           v.visit_number, \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           v.arrival_time, \
           v.chief_complaint, \
           v.triage_level::text AS triage_level, \
           v.disposition, \
           doc.full_name AS doctor_name, \
           ds.status::text AS status, \
           ds.final_diagnosis, \
           ds.condition_at_discharge, \
           ds.clinical_course, \
           ds.treatment_given, \
           ds.medications_on_discharge, \
           ds.follow_up_instructions, \
           ds.follow_up_date, \
           ds.warning_signs, \
           ds.finalized_at \
         FROM er_discharge_summaries ds \
         JOIN er_visits v ON v.id = ds.er_visit_id AND v.tenant_id = ds.tenant_id \
         JOIN patients p ON p.id = v.patient_id AND p.tenant_id = v.tenant_id \
         LEFT JOIN users doc ON doc.id = v.attending_doctor_id \
         WHERE ds.er_visit_id = $1 AND ds.tenant_id = $2",
    )
    .bind(er_visit_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let h_name = hospital_name(&mut tx, claims.tenant_id).await?;
    tx.commit().await?;

    Ok(Json(ErDischargeSummaryPrintData {
        visit_number: row.visit_number,
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: row.age.map(|a| format!("{} yrs", a as i64)),
        gender: row.gender,
        arrival_time: row
            .arrival_time
            .with_timezone(&tz)
            .format("%d-%b-%Y %H:%M")
            .to_string(),
        discharge_date: row
            .finalized_at
            .map(|d| d.with_timezone(&tz).format("%d-%b-%Y %H:%M").to_string()),
        chief_complaint: row.chief_complaint,
        triage_level: row.triage_level,
        disposition: row.disposition,
        doctor_name: row.doctor_name,
        status: row.status,
        final_diagnosis: row.final_diagnosis,
        condition_at_discharge: row.condition_at_discharge,
        clinical_course: row.clinical_course,
        treatment_given: row.treatment_given,
        medications_on_discharge: row.medications_on_discharge,
        follow_up_instructions: row.follow_up_instructions,
        follow_up_date: row.follow_up_date.map(|d| d.format("%d-%b-%Y").to_string()),
        warning_signs: row.warning_signs,
        hospital_name: h_name,
    }))
}

// ── Token Slip ──────────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct TokenSlipRow {
    source: String,
    token_number: String,
    token_day: String,
    token_time: String,
    department_id: Option<Uuid>,
    token_date: chrono::NaiveDate,
    token_seq: i32,
    patient_name: Option<String>,
    uhid: Option<String>,
    department_name: Option<String>,
    doctor_name: Option<String>,
    room_number: Option<String>,
    priority: String,
}

/// A token slip for either queue the product runs: the unified `tokens` queue
/// (OPD, lab, pharmacy, billing desks) or the TV-display `queue_tokens` list.
/// Both are live, so the id is looked up in `tokens` first.
pub async fn get_token_slip_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(token_id): Path<Uuid>,
) -> Result<Json<TokenSlipPrintData>, AppError> {
    require_permission(&claims, permissions::front_office::queue::LIST)?;
    // The token's patient is nullable — a token can be issued before the
    // person is identified — so the optional form: a missing token is
    // NotFound, a token with no patient passes on the permission alone. Only a
    // NotFound falls through to the other table; any other answer, a denial or
    // a fault, stands.
    match medbrains_authz_gate::require_access_via_optional(
        &state,
        &claims,
        medbrains_authz_gate::links::TOKEN,
        token_id,
    )
    .await
    {
        Err(AppError::NotFound) => {
            medbrains_authz_gate::require_access_via_optional(
                &state,
                &claims,
                medbrains_authz_gate::links::QUEUE_TOKEN,
                token_id,
            )
            .await?;
        }
        other => other?,
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, TokenSlipRow>(
        "SELECT * FROM ( \
           SELECT 'tokens' AS source, \
             t.number AS token_number, \
             to_char(t.created_at, 'DD-Mon-YYYY') AS token_day, \
             to_char(t.created_at, 'HH24:MI') AS token_time, \
             NULL::uuid AS department_id, \
             t.token_date, \
             t.seq AS token_seq, \
             COALESCE(t.patient_name, concat_ws(' ', p.first_name, p.last_name)) \
               AS patient_name, \
             p.uhid, \
             COALESCE(t.scope_label, initcap(t.module)) AS department_name, \
             NULL::text AS doctor_name, \
             t.counter_label AS room_number, \
             t.priority \
           FROM tokens t \
           LEFT JOIN patients p ON p.id = t.patient_id AND p.tenant_id = t.tenant_id \
           WHERE t.id = $1 AND t.tenant_id = $2 \
           UNION ALL \
           SELECT 'queue_tokens', \
             qt.token_number, \
             to_char(qt.created_at, 'DD-Mon-YYYY'), \
             to_char(qt.created_at, 'HH24:MI'), \
             qt.department_id, \
             qt.token_date, \
             qt.token_seq, \
             concat_ws(' ', p.first_name, p.last_name), \
             p.uhid, \
             dept.name, \
             doc.full_name, \
             td.room_number, \
             qt.priority::text \
           FROM queue_tokens qt \
           LEFT JOIN patients p ON p.id = qt.patient_id AND p.tenant_id = qt.tenant_id \
           LEFT JOIN departments dept ON dept.id = qt.department_id \
                                      AND dept.tenant_id = qt.tenant_id \
           LEFT JOIN users doc ON doc.id = qt.doctor_id \
           LEFT JOIN tv_displays td ON td.department_id = qt.department_id \
                                    AND td.tenant_id = qt.tenant_id \
                                    AND td.is_active = true \
           WHERE qt.id = $1 AND qt.tenant_id = $2 \
         ) slip \
         ORDER BY source = 'tokens' DESC \
         LIMIT 1",
    )
    .bind(token_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;

    // Ask the queue module rather than counting here: the slip must promise the
    // same wait the board shows, and two implementations would drift apart.
    // ponytail: only the TV-display queue has an estimator; a unified-queue
    // token prints no wait rather than an invented one.
    let estimated_wait_minutes = match (row.source.as_str(), row.department_id) {
        ("queue_tokens", Some(department_id)) => {
            medbrains_tv::position_and_wait(
                &state.db,
                claims.tenant_id,
                department_id,
                row.token_date,
                row.token_seq,
                &row.priority,
            )
            .await?
            .1
        }
        _ => None,
    };

    // Generate QR code data (token ID for verification)
    let qr_data = format!("MBTOKEN:{token_id}");

    Ok(Json(TokenSlipPrintData {
        token_number: row.token_number,
        token_date: row.token_day,
        token_time: row.token_time,
        patient_name: row.patient_name,
        uhid: row.uhid,
        department_name: row.department_name.unwrap_or_default(),
        doctor_name: row.doctor_name,
        room_number: row.room_number,
        estimated_wait_minutes,
        priority: row.priority,
        qr_code_data: qr_data,
        instructions: "Please wait for your token to be called. Listen for announcements or watch the display screen.".to_string(),
    }))
}

// ── Visitor Pass ────────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct VisitorPassRow {
    pass_number: String,
    visitor_name: String,
    visitor_phone: String,
    visitor_id_type: Option<String>,
    visitor_id_number: Option<String>,
    photo_url: Option<String>,
    patient_name: String,
    patient_uhid: String,
    ward_name: Option<String>,
    bed_number: Option<String>,
    relation: Option<String>,
    valid_from: chrono::DateTime<Utc>,
    valid_until: chrono::DateTime<Utc>,
    created_at: chrono::DateTime<Utc>,
    issued_by_name: Option<String>,
}

/// A visitor pass as printed: who it is for, whom they visit, until when —
/// and a QR of the pass number, which the gate scans to check it now
/// (`/api/front-office/passes/scan`).
pub async fn get_visitor_pass_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(pass_id): Path<Uuid>,
) -> Result<Json<VisitorPassPrintData>, AppError> {
    require_permission(&claims, permissions::front_office::passes::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, VisitorPassRow>(
        "SELECT vp.pass_number, r.visitor_name, COALESCE(r.phone, '') AS visitor_phone, \
                r.id_type::text AS visitor_id_type, r.id_number AS visitor_id_number, r.photo_url, \
                COALESCE(p.first_name || ' ' || p.last_name, '') AS patient_name, \
                COALESCE(p.uhid, '') AS patient_uhid, \
                COALESCE(w.name, aw.name) AS ward_name, vp.bed_number, r.relationship AS relation, \
                vp.valid_from, vp.valid_until, vp.created_at, u.full_name AS issued_by_name \
           FROM visitor_passes vp \
           JOIN visitor_registrations r ON r.id = vp.registration_id \
           LEFT JOIN patients p ON p.id = r.patient_id \
           LEFT JOIN wards w ON w.id = vp.ward_id \
           LEFT JOIN wards aw ON aw.id = r.ward_id \
           LEFT JOIN users u ON u.id = vp.issued_by \
          WHERE vp.id = $1 AND vp.tenant_id = $2 AND vp.deleted_at IS NULL",
    )
    .bind(pass_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    let qr_svg = medbrains_print::codes::qr_svg(&row.pass_number)
        .map_err(|e| AppError::Internal(format!("pass qr: {e}")))?;

    Ok(Json(VisitorPassPrintData {
        qr_code_data: row.pass_number.clone(),
        qr_svg,
        pass_number: row.pass_number,
        visitor_name: row.visitor_name,
        visitor_phone: row.visitor_phone,
        visitor_id_type: row.visitor_id_type,
        visitor_id_number: row.visitor_id_number,
        patient_name: row.patient_name,
        patient_uhid: row.patient_uhid,
        patient_ward: row.ward_name,
        patient_bed: row.bed_number,
        relation: row.relation,
        valid_from: row
            .valid_from
            .with_timezone(&tz)
            .format("%d-%b-%Y %H:%M")
            .to_string(),
        valid_until: row
            .valid_until
            .with_timezone(&tz)
            .format("%d-%b-%Y %H:%M")
            .to_string(),
        issued_at: row
            .created_at
            .with_timezone(&tz)
            .format("%d-%b-%Y %H:%M")
            .to_string(),
        issued_by: row.issued_by_name,
        photo_url: row.photo_url,
    }))
}

// ── Treatment Chart ────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct TreatmentChartRow {
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    admission_date: chrono::DateTime<Utc>,
    bed_number: Option<String>,
    ward_name: Option<String>,
    diagnosis: Option<String>,
    treating_doctor: Option<String>,
}

pub async fn get_treatment_chart_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<TreatmentChartPrintData>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;
    medbrains_authz_gate::require_admission_access(&state, &claims, admission_id).await?;
    require_permission(&claims, permissions::patients::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    // `admissions.bed_id` points at `locations`, not `beds`.
    let row = sqlx::query_as::<_, TreatmentChartRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(current_date, p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           a.admitted_at AS admission_date, \
           l.name AS bed_number, \
           w.name AS ward_name, \
           COALESCE(a.primary_diagnosis, a.provisional_diagnosis) AS diagnosis, \
           doc.full_name AS treating_doctor \
         FROM admissions a \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
         LEFT JOIN users doc ON doc.id = COALESCE(a.attending_doctor_id, a.admitting_doctor) \
         WHERE a.id = $1 AND a.tenant_id = $2 AND a.deleted_at IS NULL",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let allergies: Vec<String> = sqlx::query_scalar(
        "SELECT pa.allergen_name FROM patient_allergies pa \
         JOIN admissions a ON a.patient_id = pa.patient_id AND a.tenant_id = pa.tenant_id \
         WHERE a.id = $1 AND pa.tenant_id = $2 \
           AND pa.is_active = true AND pa.deleted_at IS NULL \
         ORDER BY pa.created_at LIMIT 500",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // IPD prescriptions hang off the admitting encounter; `admission_id` is
    // rarely set, so either link counts. Time slots print only when the
    // prescriber set them — a default timetable would be an order nobody gave.
    let medications: Vec<TreatmentChartMedication> = sqlx::query_as(
        "SELECT \
           pi.drug_name, \
           pi.dosage AS dose, \
           COALESCE(pi.route, '') AS route, \
           pi.frequency, \
           COALESCE(pi.time_slots, '{}'::text[]) AS time_slots, \
           pr.created_at::date::text AS start_date, \
           pi.end_date::text AS end_date, \
           pi.instructions AS special_instructions \
         FROM prescription_items pi \
         JOIN prescriptions pr ON pr.id = pi.prescription_id AND pr.tenant_id = pi.tenant_id \
         JOIN admissions a ON a.tenant_id = pr.tenant_id \
          AND (pr.admission_id = a.id OR pr.encounter_id = a.encounter_id) \
         WHERE a.id = $1 AND pr.tenant_id = $2 \
           AND pr.deleted_at IS NULL AND pi.deleted_at IS NULL \
           AND pi.item_status = 'active' \
         ORDER BY pi.created_at LIMIT 500",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // Running or paused drips: the IPD module writes 'running' and closes
    // them with `actual_end_time` / `discontinued_at`.
    let iv_fluids: Vec<TreatmentChartIvFluid> = sqlx::query_as(
        "SELECT \
           fluid_name, \
           volume_ml, \
           COALESCE(rate, rate_ml_per_hr::text || ' ml/hr', '') AS rate, \
           COALESCE(additives, '{}'::text[]) AS additives, \
           COALESCE(started_at, start_time)::text AS start_time, \
           round(duration_hours)::int4 AS duration_hours \
         FROM iv_fluid_orders \
         WHERE admission_id = $1 AND tenant_id = $2 \
           AND deleted_at IS NULL \
           AND status IN ('running', 'paused') \
         ORDER BY created_at LIMIT 500",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let chart_sigs = medbrains_signing::signed_documents::fetch_all_signatures_for_print(
        &mut tx,
        &claims.tenant_id,
        "other",
        admission_id,
    )
    .await?;

    tx.commit().await?;

    let age_str = row.age.map(|a| format!("{} Y", a as i32));

    Ok(Json(TreatmentChartPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age: age_str,
        gender: row.gender,
        admission_date: row
            .admission_date
            .with_timezone(&tz)
            .format("%d-%b-%Y")
            .to_string(),
        bed_number: row.bed_number,
        ward_name: row.ward_name,
        diagnosis: row.diagnosis,
        allergies,
        chart_date: Utc::now().with_timezone(&tz).format("%d-%b-%Y").to_string(),
        medications,
        iv_fluids,
        // ponytail: `stat_orders` is never written; STAT orders print once something records them
        stat_orders: Vec::new(),
        treating_doctor: row.treating_doctor,
        signatures: medbrains_signing::signed_documents::to_print_signatures(chart_sigs),
    }))
}

// ── Transfer Summary ───────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct TransferSummaryRow {
    patient_name: String,
    uhid: String,
    admission_number: Option<String>,
    age: Option<f64>,
    gender: String,
    transfer_date: chrono::DateTime<Utc>,
    from_ward: String,
    from_bed: Option<String>,
    to_ward: String,
    to_bed: Option<String>,
    transfer_reason: String,
    diagnosis: Option<String>,
    current_condition: String,
    vital_signs: Option<String>,
    handover_notes: Option<String>,
    transferring_doctor: Option<String>,
    transferring_nurse: Option<String>,
    isolation_required: bool,
    isolation_reason: Option<String>,
}

/// An intra-hospital ward/bed move, printed from `ipd_transfer_logs` — the
/// row the IPD transfer action writes. The path id is that log row's id.
pub async fn get_transfer_summary_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(transfer_log_id): Path<Uuid>,
) -> Result<Json<TransferSummaryPrintData>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;
    require_permission(&claims, permissions::patients::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    // The log carries the admission; access is decided on the admission.
    let admission_id: Uuid = sqlx::query_scalar(
        "SELECT admission_id FROM ipd_transfer_logs \
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(transfer_log_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    medbrains_authz_gate::require_admission_access(&state, &claims, admission_id).await?;

    let row = sqlx::query_as::<_, TransferSummaryRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           a.admission_number, \
           EXTRACT(YEAR FROM age(current_date, p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           t.transferred_at AS transfer_date, \
           COALESCE(fw.name, '') AS from_ward, \
           fl.name AS from_bed, \
           COALESCE(tw.name, '') AS to_ward, \
           tl.name AS to_bed, \
           COALESCE(t.reason, '') AS transfer_reason, \
           COALESCE(a.primary_diagnosis, a.provisional_diagnosis) AS diagnosis, \
           COALESCE(t.clinical_summary, '') AS current_condition, \
           NULLIF(concat_ws(', ', \
             'BP ' || COALESCE(v.systolic_bp, v.bp_systolic) || '/' \
                   || COALESCE(v.diastolic_bp, v.bp_diastolic), \
             'Pulse ' || COALESCE(v.pulse, v.pulse_rate), \
             'Temp ' || v.temperature, \
             'RR ' || v.respiratory_rate, \
             'SpO2 ' || v.spo2 || '%'), '') AS vital_signs, \
           t.notes AS handover_notes, \
           CASE WHEN u.role = 'doctor' THEN u.full_name END AS transferring_doctor, \
           CASE WHEN u.role = 'nurse' THEN u.full_name END AS transferring_nurse, \
           a.isolation_required, \
           a.isolation_reason \
         FROM ipd_transfer_logs t \
         JOIN admissions a ON a.id = t.admission_id AND a.tenant_id = t.tenant_id \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
         LEFT JOIN wards fw ON fw.id = t.from_ward_id AND fw.tenant_id = t.tenant_id \
         LEFT JOIN wards tw ON tw.id = t.to_ward_id AND tw.tenant_id = t.tenant_id \
         LEFT JOIN locations fl ON fl.id = t.from_bed_id AND fl.tenant_id = t.tenant_id \
         LEFT JOIN locations tl ON tl.id = t.to_bed_id AND tl.tenant_id = t.tenant_id \
         LEFT JOIN users u ON u.id = t.transferred_by \
         LEFT JOIN LATERAL ( \
           SELECT vv.* FROM vitals vv \
           WHERE vv.encounter_id = a.encounter_id AND vv.tenant_id = a.tenant_id \
             AND vv.deleted_at IS NULL AND vv.recorded_at <= t.transferred_at \
           ORDER BY vv.recorded_at DESC LIMIT 1 \
         ) v ON true \
         WHERE t.id = $1 AND t.tenant_id = $2 AND t.deleted_at IS NULL",
    )
    .bind(transfer_log_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    // IPD prescriptions hang off the admitting encounter; `admission_id` is
    // rarely set, so either link counts.
    let medications: Vec<String> = sqlx::query_scalar(
        "SELECT pi.drug_name || ' ' || pi.dosage || ' ' || pi.frequency \
         FROM prescription_items pi \
         JOIN prescriptions pr ON pr.id = pi.prescription_id AND pr.tenant_id = pi.tenant_id \
         JOIN admissions a ON a.tenant_id = pr.tenant_id \
          AND (pr.admission_id = a.id OR pr.encounter_id = a.encounter_id) \
         WHERE a.id = $1 AND pr.tenant_id = $2 \
           AND pr.deleted_at IS NULL AND pi.deleted_at IS NULL \
           AND pi.item_status = 'active' \
         ORDER BY pi.created_at LIMIT 500",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // `lab_orders` hangs off the encounter, which the admission carries.
    let pending_investigations: Vec<String> = sqlx::query_scalar(
        "SELECT tc.name FROM lab_orders lo \
         JOIN lab_test_catalog tc ON tc.id = lo.test_id AND tc.tenant_id = lo.tenant_id \
         JOIN admissions adm ON adm.encounter_id = lo.encounter_id \
           AND adm.tenant_id = lo.tenant_id \
         WHERE adm.id = $1 \
           AND lo.tenant_id = $2 \
           AND lo.deleted_at IS NULL \
           AND lo.status IN ('ordered'::lab_order_status, \
                             'sample_collected'::lab_order_status, \
                             'processing'::lab_order_status) \
         ORDER BY lo.created_at LIMIT 500",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // Cross-department referrals raised during this stay and not yet closed.
    let pending_consultations: Vec<String> = sqlx::query_scalar(
        "SELECT d.name || COALESCE(' - ' || u.full_name, '') || ' (' || r.status || ')' \
         FROM referrals r \
         JOIN admissions a ON a.id = $1 AND a.tenant_id = r.tenant_id \
         JOIN departments d ON d.id = r.to_department_id AND d.tenant_id = r.tenant_id \
         LEFT JOIN users u ON u.id = r.to_doctor_id \
         WHERE r.tenant_id = $2 AND r.deleted_at IS NULL \
           AND r.status IN ('pending', 'accepted') \
           AND (r.encounter_id = a.encounter_id \
                OR (r.patient_id = a.patient_id AND r.created_at >= a.admitted_at)) \
         ORDER BY r.created_at LIMIT 500",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let allergies: Vec<String> = sqlx::query_scalar(
        "SELECT 'Allergy: ' || pa.allergen_name || COALESCE(' (' || pa.severity::text || ')', '') \
         FROM patient_allergies pa \
         JOIN admissions a ON a.patient_id = pa.patient_id AND a.tenant_id = pa.tenant_id \
         WHERE a.id = $1 AND pa.tenant_id = $2 \
           AND pa.is_active = true AND pa.deleted_at IS NULL \
         ORDER BY pa.created_at LIMIT 500",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    let mut special_precautions = Vec::with_capacity(allergies.len() + 1);
    if row.isolation_required {
        special_precautions.push(match &row.isolation_reason {
            Some(reason) => format!("Isolation: {reason}"),
            None => "Isolation".to_owned(),
        });
    }
    special_precautions.extend(allergies);

    let age_str = row.age.map(|a| format!("{} Y", a as i32));

    Ok(Json(TransferSummaryPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        admission_number: row.admission_number,
        age: age_str,
        gender: row.gender,
        transfer_date: row
            .transfer_date
            .with_timezone(&tz)
            .format("%d-%b-%Y")
            .to_string(),
        transfer_time: row
            .transfer_date
            .with_timezone(&tz)
            .format("%H:%M")
            .to_string(),
        from_ward: row.from_ward,
        from_bed: row.from_bed,
        to_ward: row.to_ward,
        to_bed: row.to_bed,
        transfer_reason: row.transfer_reason,
        diagnosis: row.diagnosis,
        current_condition: row.current_condition,
        vital_signs: row.vital_signs,
        current_medications: medications,
        pending_investigations,
        pending_consultations,
        special_precautions,
        handover_notes: row.handover_notes,
        transferring_doctor: row.transferring_doctor,
        // ponytail: the transfer log records who moved the patient, not who received them
        receiving_doctor: None,
        transferring_nurse: row.transferring_nurse,
        receiving_nurse: None,
        // ponytail: `signed_records.record_type` has no transfer type, so nothing can sign one yet
        signatures: Vec::new(),
    }))
}

// ── Patient Education Material ─────────────────────────

// ── Registration Card (Enhanced) ───────────────────────

#[derive(Debug, sqlx::FromRow)]
struct RegistrationCardRow {
    patient_name: String,
    uhid: String,
    date_of_birth: Option<chrono::NaiveDate>,
    age: Option<f64>,
    gender: String,
    blood_group: Option<String>,
    phone: String,
    email: Option<String>,
    address: Option<String>,
    emergency_contact_name: Option<String>,
    emergency_contact_phone: Option<String>,
    photo_url: Option<String>,
    created_at: chrono::DateTime<Utc>,
}

pub async fn get_registration_card_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<RegistrationCardPrintData>, AppError> {
    require_permission(&claims, permissions::patients::VIEW)?;
    medbrains_authz_gate::require_patient_access(&state, &claims, patient_id).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, RegistrationCardRow>(
        "SELECT \
           (first_name || ' ' || last_name) AS patient_name, \
           uhid, \
           date_of_birth, \
           EXTRACT(YEAR FROM age(date_of_birth))::float8 AS age, \
           gender::text AS gender, \
           blood_group::text AS blood_group, \
           phone, \
           email, \
           COALESCE((address->>'line1') || ', ' || (address->>'city'), NULL) AS address, \
           emergency_contact_name, \
           emergency_contact_phone, \
           photo_url, \
           created_at \
         FROM patients \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(patient_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Get allergies
    let allergies: Vec<String> = sqlx::query_scalar(
        "SELECT allergen_name FROM patient_allergies \
         WHERE patient_id = $1 AND tenant_id = $2 AND is_active = true \
           AND deleted_at IS NULL \
         ORDER BY severity DESC LIMIT 5000",
    )
    .bind(patient_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // Get hospital name
    let h_name: Option<String> = sqlx::query_scalar("SELECT name FROM tenants WHERE id = $1")
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .flatten();

    let print_request_id = Uuid::new_v4();
    let event = ClinicalEventEnvelope::new(
        claims.tenant_id,
        ClinicalEventName::PatientCardPrinted,
        print_request_id,
        claims.sub,
        json!({
            "patient_id": patient_id,
            "print_request_id": print_request_id,
            "artifact": "patient_card",
        }),
    )
    .with_patient(patient_id);
    medbrains_workflow::events::queue_clinical_event_in_tx(&mut tx, &event).await?;

    tx.commit().await?;

    // Generate QR code data
    let qr_data = format!("MBPATIENT:{patient_id}");

    Ok(Json(RegistrationCardPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        date_of_birth: row.date_of_birth.map(|d| d.format("%d-%b-%Y").to_string()),
        age: row.age.map(|a| format!("{} Y", a as i32)),
        gender: row.gender,
        blood_group: row.blood_group,
        phone: row.phone,
        email: row.email,
        address: row.address,
        emergency_contact_name: row.emergency_contact_name,
        emergency_contact_phone: row.emergency_contact_phone,
        allergies,
        photo_url: row.photo_url,
        qr_code_data: qr_data,
        registration_date: row
            .created_at
            .with_timezone(&tz)
            .format("%d-%b-%Y")
            .to_string(),
        hospital_name: h_name,
    }))
}

// ── Infant Wristband (NICU) ────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct InfantWristbandRow {
    mother_name: String,
    mother_uhid: String,
    baby_id: String,
    baby_gender: String,
    birth_date: chrono::DateTime<Utc>,
    birth_weight_grams: i32,
    delivery_type: String,
    ward_name: Option<String>,
    bed_number: Option<String>,
    attending_doctor: Option<String>,
}

pub async fn get_infant_wristband_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(newborn_id): Path<Uuid>,
) -> Result<Json<InfantWristbandPrintData>, AppError> {
    require_permission(&claims, permissions::ipd::admissions::VIEW)?;
    require_permission(&claims, permissions::patients::VIEW)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::NEWBORN,
        newborn_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    // The maternity module writes `birth_date`, `weight_gm`, `id_band_number`
    // and a nullable `mother_id`; the mother is otherwise reached through the
    // labour record's registration, and ward/bed through its admission.
    let row = sqlx::query_as::<_, InfantWristbandRow>(
        "SELECT \
           (m.first_name || ' ' || m.last_name) AS mother_name, \
           m.uhid AS mother_uhid, \
           COALESCE(nb.id_band_number, nb.baby_id, nb.id::text) AS baby_id, \
           nb.gender AS baby_gender, \
           nb.birth_date, \
           COALESCE(nb.birth_weight_grams, nb.weight_gm) AS birth_weight_grams, \
           COALESCE(nb.delivery_type, lr.delivery_type::text, '') AS delivery_type, \
           w.name AS ward_name, \
           l.name AS bed_number, \
           doc.full_name AS attending_doctor \
         FROM newborn_records nb \
         JOIN labor_records lr ON lr.id = nb.labor_id AND lr.tenant_id = nb.tenant_id \
         JOIN maternity_registrations mr ON mr.id = lr.registration_id \
                                         AND mr.tenant_id = lr.tenant_id \
         JOIN patients m ON m.id = COALESCE(nb.mother_id, mr.patient_id) \
                        AND m.tenant_id = nb.tenant_id \
         LEFT JOIN admissions a ON a.id = COALESCE(nb.mother_admission_id, lr.admission_id) \
                               AND a.tenant_id = nb.tenant_id \
         LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
         LEFT JOIN users doc ON doc.id = COALESCE(nb.attending_doctor_id, lr.attending_doctor_id) \
         WHERE nb.id = $1 AND nb.tenant_id = $2 AND nb.deleted_at IS NULL",
    )
    .bind(newborn_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;

    // Generate barcode data for infant tracking
    let barcode_data = format!("MBNB:{}", row.baby_id);

    Ok(Json(InfantWristbandPrintData {
        mother_name: row.mother_name,
        mother_uhid: row.mother_uhid,
        baby_id: row.baby_id,
        baby_gender: row.baby_gender,
        date_of_birth: row
            .birth_date
            .with_timezone(&tz)
            .format("%d-%b-%Y")
            .to_string(),
        time_of_birth: row
            .birth_date
            .with_timezone(&tz)
            .format("%H:%M")
            .to_string(),
        birth_weight_grams: row.birth_weight_grams,
        delivery_type: row.delivery_type,
        ward_name: row.ward_name,
        bed_number: row.bed_number,
        attending_doctor: row.attending_doctor,
        barcode_data,
        rfid_tag: None,
    }))
}

// ══════════════════════════════════════════════════════════
// Phase 4: Clinical Delivery Prints
// ══════════════════════════════════════════════════════════

// ── OPD Prescription ────────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct OpdPrescriptionRow {
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    phone: Option<String>,
    address: Option<String>,
    encounter_date: chrono::DateTime<Utc>,
    encounter_number: Option<String>,
    department_name: Option<String>,
    doctor_name: Option<String>,
    doctor_reg_number: Option<String>,
    doctor_qualification: Option<String>,
    chief_complaints: Option<String>,
    examination_findings: Option<String>,
    diagnosis: Option<String>,
    advice: Option<String>,
    follow_up_date: Option<chrono::NaiveDate>,
    follow_up_instructions: Option<String>,
    referral_notes: Option<String>,
    bp_systolic: Option<i32>,
    bp_diastolic: Option<i32>,
    pulse: Option<i32>,
    temperature: Option<f64>,
    spo2: Option<i32>,
    respiratory_rate: Option<i32>,
    height_cm: Option<f64>,
    weight_kg: Option<f64>,
}

#[derive(Debug, sqlx::FromRow)]
struct PrescriptionMedicationRow {
    drug_name: String,
    generic_name: Option<String>,
    dose: String,
    route: String,
    frequency: String,
    duration: String,
    quantity: Option<i32>,
    instructions: Option<String>,
    is_controlled: bool,
    schedule: Option<String>,
}

pub async fn get_opd_prescription_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(encounter_id): Path<Uuid>,
) -> Result<Json<OpdPrescriptionPrintData>, AppError> {
    require_permission(&claims, permissions::opd::visit::UPDATE)?;
    medbrains_authz_gate::require_encounter_access(&state, &claims, encounter_id).await?;
    require_permission(&claims, permissions::patients::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    // The consultation screen writes `consultations` and `diagnoses`; the
    // encounter's own note columns are read first where a visit filled them.
    // Vitals are the latest set on the encounter, numerics cast for f64.
    let row = sqlx::query_as::<_, OpdPrescriptionRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           p.phone, \
           p.address_line1 AS address, \
           e.encounter_date::timestamptz AS encounter_date, \
           e.encounter_number, \
           d.name AS department_name, \
           doc.full_name AS doctor_name, \
           COALESCE(doc.medical_registration_number, doc.registration_number) \
             AS doctor_reg_number, \
           doc.qualification AS doctor_qualification, \
           COALESCE(e.chief_complaints, c.chief_complaint) AS chief_complaints, \
           COALESCE(e.examination_findings, c.examination) AS examination_findings, \
           COALESCE(e.diagnosis, dx.diagnosis) AS diagnosis, \
           COALESCE(e.advice, c.plan) AS advice, \
           e.follow_up_date, \
           e.follow_up_instructions, \
           e.referral_notes, \
           COALESCE(v.systolic_bp, v.bp_systolic) AS bp_systolic, \
           COALESCE(v.diastolic_bp, v.bp_diastolic) AS bp_diastolic, \
           COALESCE(v.pulse, v.pulse_rate) AS pulse, \
           v.temperature::float8 AS temperature, \
           v.spo2, \
           v.respiratory_rate, \
           v.height_cm::float8 AS height_cm, \
           v.weight_kg::float8 AS weight_kg \
         FROM encounters e \
         JOIN patients p ON p.id = e.patient_id AND p.tenant_id = e.tenant_id \
         LEFT JOIN departments d ON d.id = e.department_id AND d.tenant_id = e.tenant_id \
         LEFT JOIN users doc ON doc.id = e.doctor_id \
         LEFT JOIN LATERAL ( \
           SELECT cc.chief_complaint, cc.examination, cc.plan FROM consultations cc \
           WHERE cc.encounter_id = e.id AND cc.tenant_id = e.tenant_id \
             AND cc.deleted_at IS NULL \
           ORDER BY cc.created_at DESC LIMIT 1 \
         ) c ON true \
         LEFT JOIN LATERAL ( \
           SELECT string_agg(dg.description, '; ' ORDER BY dg.is_primary DESC, dg.created_at) \
             AS diagnosis \
           FROM diagnoses dg \
           WHERE dg.encounter_id = e.id AND dg.tenant_id = e.tenant_id \
             AND dg.deleted_at IS NULL \
         ) dx ON true \
         LEFT JOIN LATERAL ( \
           SELECT vv.* FROM vitals vv \
           WHERE vv.encounter_id = e.id AND vv.tenant_id = e.tenant_id \
             AND vv.deleted_at IS NULL \
           ORDER BY vv.recorded_at DESC LIMIT 1 \
         ) v ON true \
         WHERE e.id = $1 AND e.tenant_id = $2 AND e.deleted_at IS NULL",
    )
    .bind(encounter_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let medications = sqlx::query_as::<_, PrescriptionMedicationRow>(
        "SELECT \
           pi.drug_name, \
           pc.generic_name, \
           pi.dosage AS dose, \
           COALESCE(pi.route, '') AS route, \
           pi.frequency, \
           pi.duration, \
           pi.quantity, \
           pi.instructions, \
           COALESCE(pc.is_controlled, false) AS is_controlled, \
           pc.drug_schedule AS schedule \
         FROM prescription_items pi \
         JOIN prescriptions pr ON pr.id = pi.prescription_id AND pr.tenant_id = pi.tenant_id \
         LEFT JOIN pharmacy_catalog pc ON pc.id = pi.catalog_item_id \
                                      AND pc.tenant_id = pi.tenant_id \
         WHERE pr.encounter_id = $1 AND pr.tenant_id = $2 \
           AND pr.deleted_at IS NULL AND pi.deleted_at IS NULL \
           AND pi.item_status = 'active' \
         ORDER BY pi.created_at LIMIT 500",
    )
    .bind(encounter_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let icd_codes: Vec<String> = sqlx::query_scalar(
        "SELECT icd_code FROM diagnoses \
         WHERE encounter_id = $1 AND tenant_id = $2 AND icd_code IS NOT NULL \
           AND deleted_at IS NULL \
         ORDER BY is_primary DESC, created_at LIMIT 500",
    )
    .bind(encounter_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let tenant = sqlx::query_as::<_, (String, Option<String>, Option<String>, Option<String>)>(
        "SELECT name, logo_url, address_line1, phone FROM tenants WHERE id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Signing keys a prescription on `prescriptions.id`, and a visit can
    // carry several. ponytail: one signature lookup per prescription (capped
    // at 20) — batch once the signing crate takes a list of record ids.
    let prescription_ids: Vec<Uuid> = sqlx::query_scalar(
        "SELECT id FROM prescriptions \
         WHERE encounter_id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
         ORDER BY created_at LIMIT 20",
    )
    .bind(encounter_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    let mut sigs = Vec::new();
    for prescription_id in prescription_ids {
        sigs.extend(
            medbrains_signing::signed_documents::fetch_all_signatures_for_print(
                &mut tx,
                &claims.tenant_id,
                "prescription",
                prescription_id,
            )
            .await?,
        );
    }
    let preview_signature_url: Option<String> =
        sigs.iter().find_map(|s| s.display_image_url.clone());

    tx.commit().await?;

    let age_display = row
        .age
        .map_or("Unknown".to_string(), |a| format!("{a:.0} Y"));
    let bmi = match (row.height_cm, row.weight_kg) {
        (Some(h), Some(w)) if h > 0.0 => Some((w / (h / 100.0).powi(2) * 10.0).round() / 10.0),
        _ => None,
    };

    Ok(Json(OpdPrescriptionPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age_display,
        gender: row.gender,
        phone: row.phone,
        address: row.address,
        encounter_date: row
            .encounter_date
            .with_timezone(&tz)
            .format("%d-%b-%Y %H:%M")
            .to_string(),
        encounter_number: row.encounter_number,
        department: row.department_name,
        doctor_name: row.doctor_name.unwrap_or_default(),
        doctor_registration_number: row.doctor_reg_number,
        doctor_qualification: row.doctor_qualification,
        chief_complaints: row.chief_complaints,
        examination_findings: row.examination_findings,
        diagnosis: row.diagnosis,
        icd_codes,
        medications: medications
            .into_iter()
            .map(|m| PrescriptionMedication {
                drug_name: m.drug_name,
                generic_name: m.generic_name,
                dose: m.dose,
                route: m.route,
                frequency: m.frequency,
                duration: m.duration,
                quantity: m.quantity,
                instructions: m.instructions,
                is_controlled: m.is_controlled,
                schedule: m.schedule,
            })
            .collect(),
        advice: row.advice,
        follow_up_date: row.follow_up_date.map(|d| d.format("%d-%b-%Y").to_string()),
        follow_up_instructions: row.follow_up_instructions,
        referral_notes: row.referral_notes,
        vitals: Some(OpdVitals {
            bp_systolic: row.bp_systolic,
            bp_diastolic: row.bp_diastolic,
            pulse: row.pulse,
            temperature: row.temperature,
            spo2: row.spo2,
            respiratory_rate: row.respiratory_rate,
            height_cm: row.height_cm,
            weight_kg: row.weight_kg,
            bmi,
        }),
        doctor_signature_url: preview_signature_url,
        hospital_name: tenant.0,
        hospital_logo_url: tenant.1,
        hospital_address: tenant.2,
        hospital_phone: tenant.3,
        signatures: medbrains_signing::signed_documents::to_print_signatures(sigs),
    }))
}

// ── Full Lab Report (NABL Compliant) ────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct LabReportFullRow {
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    // Every one of these is nullable in `lab_orders`, and three of them were
    // declared non-null here. An order that has not been reported yet has no
    // `report_date`, so the row failed to decode and the endpoint answered
    // 500 — which read as a broken server rather than as "this has not been
    // released", and hid the missing release gate underneath it.
    sample_id: Option<String>,
    accession_number: Option<String>,
    order_date: Option<chrono::DateTime<Utc>>,
    collection_date: Option<chrono::DateTime<Utc>>,
    report_date: Option<chrono::DateTime<Utc>>,
    referring_doctor: Option<String>,
    department_name: Option<String>,
    ward_name: Option<String>,
    bed_number: Option<String>,
    test_name: String,
    test_code: Option<String>,
    loinc_code: Option<String>,
    specimen_type: Option<String>,
    report_status: Option<String>,
    interpretation: Option<String>,
    comments: Option<String>,
    pathologist_name: Option<String>,
    pathologist_reg_number: Option<String>,
    technician_name: Option<String>,
    verified_at: Option<chrono::DateTime<Utc>>,
}

#[derive(Debug, sqlx::FromRow)]
struct LabParameterRow {
    parameter_name: String,
    result_value: String,
    unit: Option<String>,
    reference_range: Option<String>,
    is_abnormal: bool,
    is_critical: bool,
    critical_flag: Option<String>,
    method: Option<String>,
    previous_value: Option<String>,
    delta_percent: Option<rust_decimal::Decimal>,
    is_delta_flagged: bool,
    sample_type: Option<String>,
    section: Option<String>,
}

pub async fn get_lab_report_full_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(order_id): Path<Uuid>,
) -> Result<Json<LabReportFullPrintData>, AppError> {
    require_permission(&claims, permissions::lab::reports::VIEW)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::LAB_ORDER,
        order_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, LabReportFullRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           COALESCE(lo.sample_id, lo.sample_barcode) AS sample_id, \
           lo.accession_number, \
           COALESCE(lo.order_date, lo.created_at) AS order_date, \
           COALESCE(lo.collection_date, lo.collected_at) AS collection_date, \
           COALESCE(lo.report_date, lo.verified_at, lo.completed_at) AS report_date, \
           COALESCE(od.full_name, rd.name, CASE WHEN lo.is_self_referred THEN 'Self' END, doc.full_name) AS referring_doctor, \
           d.name AS department_name, \
           adm.ward_name, \
           adm.bed_number, \
           tc.name AS test_name, \
           tc.code AS test_code, \
           tc.loinc_code, \
           tc.sample_type AS specimen_type, \
           lo.report_status::text AS report_status, \
           lo.interpretation, \
           lo.comments, \
           path.full_name AS pathologist_name, \
           COALESCE(path.medical_registration_number, path.registration_number) \
             AS pathologist_reg_number, \
           tech.full_name AS technician_name, \
           lo.verified_at \
         FROM lab_orders lo \
         JOIN patients p ON p.id = lo.patient_id AND p.tenant_id = lo.tenant_id \
         JOIN lab_test_catalog tc ON tc.id = lo.test_id AND tc.tenant_id = lo.tenant_id \
         LEFT JOIN users doc ON doc.id = COALESCE(lo.ordering_doctor_id, lo.ordered_by) \
         LEFT JOIN users od ON od.id = lo.ordering_doctor_id \
         LEFT JOIN lab_referral_doctors rd ON rd.id = lo.referral_doctor_id AND rd.tenant_id = lo.tenant_id \
         LEFT JOIN departments d ON d.id = COALESCE(lo.department_id, tc.department_id) \
                                AND d.tenant_id = lo.tenant_id \
         LEFT JOIN LATERAL ( \
           SELECT w.name AS ward_name, l.name AS bed_number FROM admissions a \
           LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
           LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
           WHERE a.patient_id = lo.patient_id AND a.tenant_id = lo.tenant_id \
             AND a.status = 'admitted'::admission_status AND a.deleted_at IS NULL \
           ORDER BY a.admitted_at DESC LIMIT 1 \
         ) adm ON true \
         LEFT JOIN users path ON path.id = COALESCE(lo.verified_by_id, lo.verified_by) \
         LEFT JOIN users tech ON tech.id = lo.performed_by_id \
         WHERE lo.id = $1 AND lo.tenant_id = $2 AND lo.deleted_at IS NULL",
    )
    .bind(order_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    // Same rule as the short report: authorisation comes before reporting.
    // This is the fuller sheet — it carries the pathologist's and the
    // technologist's names — so printing it unreleased reads as released by
    // two named people.
    if row.verified_at.is_none() {
        return Err(AppError::BadRequest(
            "These results have not been released yet. A pathologist or lab supervisor must \
             verify the order before its report can be printed."
                .to_owned(),
        ));
    }

    let parameters = sqlx::query_as::<_, LabParameterRow>(
        // `lab_results` carries two vocabularies for the same facts. Result
        // entry writes `value`, `normal_range` and `flag`; this query read
        // `result_value`, `reference_range`, `is_abnormal` and `is_critical`,
        // which no code anywhere writes. Every line of every printed report
        // was therefore blank and unflagged -- and `result_value` is not even
        // nullable in the row struct, so it failed to decode outright.
        //
        // Both are read, the written one first, so a deployment that has
        // filled either still prints. Abnormality falls back to the `flag`
        // the entry path does set.
        // The report covers this order and the tests added on to it, which is
        // how a real one reads: a single slip carrying urea and creatinine, or
        // sugar and triglycerides, under one sample number. Grouping is by
        // `parent_order_id` because `sample_id` and `accession_number` have no
        // writer anywhere yet -- the same gap `sample_barcode` had.
        //
        // Each row carries its own specimen and discipline, because a report
        // spanning several investigations draws from more than one tube and
        // prints under more than one heading.
        "SELECT \
           lr.parameter_name, \
           COALESCE(lr.result_value, lr.value) AS result_value, \
           lr.unit, \
           COALESCE(lr.reference_range, lr.normal_range) AS reference_range, \
           (lr.is_abnormal \
             OR (lr.flag IS NOT NULL AND lr.flag::text <> 'normal')) AS is_abnormal, \
           (lr.is_critical \
             OR lr.flag::text IN ('critical_low', 'critical_high')) AS is_critical, \
           COALESCE(lr.critical_flag, NULLIF(lr.flag::text, 'normal')) AS critical_flag, \
           lr.method, \
           lr.previous_value, \
           lr.delta_percent, \
           lr.is_delta_flagged, \
           tc.sample_type, \
           d.name AS section \
         FROM lab_results lr \
         JOIN lab_orders sib ON sib.id = lr.order_id AND sib.tenant_id = lr.tenant_id \
         LEFT JOIN lab_test_catalog tc \
           ON tc.id = sib.test_id AND tc.tenant_id = sib.tenant_id \
         LEFT JOIN departments d \
           ON d.id = tc.department_id AND d.tenant_id = tc.tenant_id \
         WHERE sib.tenant_id = $2 AND (sib.id = $1 OR sib.parent_order_id = $1) \
           AND lr.deleted_at IS NULL AND sib.deleted_at IS NULL \
         ORDER BY d.name NULLS LAST, lr.display_order, lr.parameter_name LIMIT 5000",
    )
    .bind(order_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let tenant = sqlx::query_as::<_, (String, Option<String>, Option<bool>, Option<String>)>(
        "SELECT name, logo_url, nabl_accredited, nabl_certificate_number FROM tenants WHERE id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // What this report corrected. Covers the order and its add-ons, the same
    // span the parameters do, so an amendment on an added-on test is not
    // silently left off the sheet it appears on.
    let amendments = sqlx::query_as::<_, medbrains_core::print_data::PrintAmendment>(
        "SELECT lr.parameter_name, \
                a.original_value, a.amended_value, \
                a.original_flag::text AS original_flag, \
                a.amended_flag::text AS amended_flag, \
                a.reason, \
                to_char(a.amended_at, 'DD-MM-YYYY HH24:MI') AS amended_at, \
                u.full_name AS amended_by_name \
           FROM lab_result_amendments a \
           JOIN lab_results lr ON lr.id = a.result_id AND lr.tenant_id = a.tenant_id \
           JOIN lab_orders sib ON sib.id = a.order_id AND sib.tenant_id = a.tenant_id \
           LEFT JOIN users u ON u.id = a.amended_by \
          WHERE sib.tenant_id = $2 AND (sib.id = $1 OR sib.parent_order_id = $1) \
            AND a.deleted_at IS NULL \
          ORDER BY a.amended_at DESC LIMIT 200",
    )
    .bind(order_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // Signing keys a lab report on each `lab_results.id`, not the order.
    // ponytail: one signature lookup per result (capped at 200) — batch once
    // the signing crate takes a list of record ids.
    let result_ids: Vec<Uuid> = sqlx::query_scalar(
        "SELECT lr.id FROM lab_results lr \
         JOIN lab_orders sib ON sib.id = lr.order_id AND sib.tenant_id = lr.tenant_id \
         WHERE sib.tenant_id = $2 AND (sib.id = $1 OR sib.parent_order_id = $1) \
           AND lr.deleted_at IS NULL AND sib.deleted_at IS NULL \
         ORDER BY lr.created_at LIMIT 200",
    )
    .bind(order_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    let mut lab_sigs = Vec::new();
    for result_id in result_ids {
        lab_sigs.extend(
            medbrains_signing::signed_documents::fetch_all_signatures_for_print(
                &mut tx,
                &claims.tenant_id,
                "lab_report",
                result_id,
            )
            .await?,
        );
    }

    tx.commit().await?;

    let age_display = row
        .age
        .map_or("Unknown".to_string(), |a| format!("{a:.0} Y"));
    let barcode_data = row
        .accession_number
        .as_ref()
        .map_or_else(String::new, |a| format!("LAB:{a}"));

    Ok(Json(LabReportFullPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age_display,
        gender: row.gender,
        sample_id: row.sample_id.unwrap_or_default(),
        accession_number: row.accession_number.unwrap_or_default(),
        order_date: row
            .order_date
            .map(|d| d.with_timezone(&tz).format("%d-%b-%Y").to_string())
            .unwrap_or_default(),
        collection_date: row
            .collection_date
            .map(|d| d.with_timezone(&tz).format("%d-%b-%Y %H:%M").to_string()),
        report_date: row
            .report_date
            .map(|d| d.with_timezone(&tz).format("%d-%b-%Y %H:%M").to_string())
            .unwrap_or_default(),
        referring_doctor: row.referring_doctor,
        department: row.department_name,
        ward_name: row.ward_name,
        bed_number: row.bed_number,
        test_name: row.test_name,
        test_code: row.test_code,
        loinc_code: row.loinc_code,
        specimen_type: row.specimen_type,
        report_status: row.report_status,
        parameters: parameters
            .into_iter()
            .map(|p| LabParameter {
                parameter_name: p.parameter_name,
                result_value: p.result_value,
                unit: p.unit,
                reference_range: p.reference_range,
                is_abnormal: p.is_abnormal,
                is_critical: p.is_critical,
                critical_flag: p.critical_flag,
                method: p.method,
                previous_value: p.previous_value,
                // Rendered as text: the template prints it, it does not do
                // arithmetic on it, and a Decimal serialises to a number whose
                // trailing zeros a report should not invent.
                delta_percent: p.delta_percent.map(|d| d.normalize().to_string()),
                is_delta_flagged: p.is_delta_flagged,
                sample_type: p.sample_type,
                section: p.section,
            })
            .collect(),
        interpretation: row.interpretation,
        comments: row.comments,
        pathologist_name: row.pathologist_name.unwrap_or_default(),
        pathologist_registration_number: row.pathologist_reg_number,
        pathologist_signature_url: None,
        technician_name: row.technician_name,
        verified_at: row
            .verified_at
            .map(|d| d.with_timezone(&tz).format("%d-%b-%Y %H:%M").to_string()),
        nabl_accredited: tenant.2.unwrap_or(false),
        nabl_certificate_number: tenant.3,
        nabl_logo_url: None,
        barcode_data,
        hospital_name: tenant.0,
        hospital_logo_url: tenant.1,
        signatures: lab_sigs
            .into_iter()
            .map(|s| medbrains_core::print_data::PrintSignatureData {
                signed_at: s.signed_at.to_rfc3339(),
                signer_name: s.signer_name,
                display_image_url: s.display_image_url,
                display_block: s.display_block,
                verify_ref: s.verify_ref,
                legal_class: s.legal_class,
            })
            .collect(),
        amendments,
    }))
}

// ── Cumulative Lab Report ────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct CumulativeLabRow {
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
}

#[derive(Debug, sqlx::FromRow)]
struct CumulativeTrendRow {
    parameter_name: String,
    unit: Option<String>,
    reference_range: Option<String>,
    result_date: chrono::DateTime<Utc>,
    result_value: String,
    is_abnormal: bool,
}

pub async fn get_cumulative_lab_report_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<CumulativeLabReportPrintData>, AppError> {
    require_permission(&claims, permissions::lab::reports::VIEW)?;
    medbrains_authz_gate::require_patient_access(&state, &claims, patient_id).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let patient = sqlx::query_as::<_, CumulativeLabRow>(
        "SELECT \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender \
         FROM patients p \
         WHERE p.id = $1 AND p.tenant_id = $2",
    )
    .bind(patient_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Get all lab results for the patient in the last 6 months
    let trends = sqlx::query_as::<_, CumulativeTrendRow>(
        // Same two-vocabulary problem as the single report above: entry
        // writes `value`/`normal_range`/`flag`, this read the parallel set
        // that nothing writes, so every point on the trend was blank.
        "SELECT \
           lr.parameter_name, \
           lr.unit, \
           COALESCE(lr.reference_range, lr.normal_range) AS reference_range, \
           COALESCE(lo.report_date, lo.verified_at) AS result_date, \
           COALESCE(lr.result_value, lr.value) AS result_value, \
           (lr.is_abnormal \
             OR (lr.flag IS NOT NULL AND lr.flag::text <> 'normal')) AS is_abnormal \
         FROM lab_results lr \
         JOIN lab_orders lo ON lo.id = lr.order_id AND lo.tenant_id = lr.tenant_id \
         WHERE lo.patient_id = $1 AND lo.tenant_id = $2 \
           AND lr.deleted_at IS NULL AND lo.deleted_at IS NULL \
           AND COALESCE(lo.report_date, lo.verified_at) >= NOW() - INTERVAL '6 months' \
           AND lo.status = 'verified' \
         ORDER BY lr.parameter_name, COALESCE(lo.report_date, lo.verified_at) LIMIT 5000",
    )
    .bind(patient_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let tenant = sqlx::query_as::<_, (String, Option<String>, Option<String>)>(
        "SELECT name, logo_url, NULL AS pathologist FROM tenants WHERE id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    // Group trends by parameter
    let mut parameter_map: std::collections::HashMap<String, Vec<CumulativeTrendRow>> =
        std::collections::HashMap::new();
    for trend in trends {
        parameter_map
            .entry(trend.parameter_name.clone())
            .or_default()
            .push(trend);
    }

    let parameter_trends: Vec<ParameterTrend> = parameter_map
        .into_iter()
        .map(|(name, rows)| {
            let unit = rows.first().and_then(|r| r.unit.clone());
            let reference_range = rows.first().and_then(|r| r.reference_range.clone());
            let values: Vec<TrendValue> = rows
                .into_iter()
                .map(|r| TrendValue {
                    date: r
                        .result_date
                        .with_timezone(&tz)
                        .format("%d-%b-%Y")
                        .to_string(),
                    value: r.result_value,
                    is_abnormal: r.is_abnormal,
                })
                .collect();
            ParameterTrend {
                parameter_name: name,
                unit,
                reference_range,
                values,
            }
        })
        .collect();

    let age_display = patient
        .age
        .map_or("Unknown".to_string(), |a| format!("{a:.0} Y"));
    let now = Utc::now();
    let six_months_ago = now - chrono::Duration::days(180);

    Ok(Json(CumulativeLabReportPrintData {
        patient_name: patient.patient_name,
        uhid: patient.uhid,
        age_display,
        gender: patient.gender,
        report_date: now.with_timezone(&tz).format("%d-%b-%Y").to_string(),
        date_range_start: six_months_ago
            .with_timezone(&tz)
            .format("%d-%b-%Y")
            .to_string(),
        date_range_end: now.with_timezone(&tz).format("%d-%b-%Y").to_string(),
        test_name: "Cumulative Report".to_string(),
        parameter_trends,
        pathologist_name: String::new(),
        pathologist_registration_number: None,
        hospital_name: tenant.0,
        hospital_logo_url: tenant.1,
        signatures: Vec::new(), // cumulative trend report — not signed per-record
    }))
}

// ── Full Radiology Report ────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct RadiologyReportFullRow {
    report_id: Uuid,
    patient_name: String,
    uhid: String,
    age: Option<f64>,
    gender: String,
    order_date: chrono::DateTime<Utc>,
    exam_date: Option<chrono::DateTime<Utc>>,
    report_date: chrono::DateTime<Utc>,
    referring_doctor: Option<String>,
    department_name: Option<String>,
    ward_name: Option<String>,
    bed_number: Option<String>,
    modality: String,
    exam_name: String,
    body_part: Option<String>,
    laterality: Option<String>,
    clinical_history: Option<String>,
    contrast_used: Option<bool>,
    findings: String,
    impression: String,
    recommendations: Option<String>,
    radiologist_name: Option<String>,
    radiologist_reg_number: Option<String>,
    verified_at: Option<chrono::DateTime<Utc>>,
    pacs_study_uid: Option<String>,
}

/// The latest non-draft report on a radiology order. The path id is the
/// order (`radiology_orders.id`); the report is the newest one written on it.
pub async fn get_radiology_report_full_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(order_id): Path<Uuid>,
) -> Result<Json<RadiologyReportFullPrintData>, AppError> {
    require_permission(&claims, permissions::radiology::reports::VERIFY)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::RADIOLOGY_ORDER,
        order_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    // A draft is not a report: an order with only a draft prints nothing.
    let row = sqlx::query_as::<_, RadiologyReportFullRow>(
        "SELECT \
           rr.id AS report_id, \
           (p.first_name || ' ' || p.last_name) AS patient_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(p.date_of_birth))::float8 AS age, \
           p.gender::text AS gender, \
           ro.created_at AS order_date, \
           COALESCE(ro.completed_at, ro.scheduled_at) AS exam_date, \
           rr.created_at AS report_date, \
           doc.full_name AS referring_doctor, \
           d.name AS department_name, \
           adm.ward_name, \
           adm.bed_number, \
           rm.name AS modality, \
           concat_ws(' ', rm.name, ro.body_part) AS exam_name, \
           ro.body_part, \
           ro.body_part_laterality AS laterality, \
           ro.clinical_indication AS clinical_history, \
           ro.contrast_required AS contrast_used, \
           rr.findings, \
           COALESCE(rr.impression, '') AS impression, \
           rr.recommendations, \
           rad.full_name AS radiologist_name, \
           COALESCE(rad.medical_registration_number, rad.registration_number) \
             AS radiologist_reg_number, \
           rr.verified_at, \
           ro.pacs_study_uid \
         FROM radiology_orders ro \
         JOIN patients p ON p.id = ro.patient_id AND p.tenant_id = ro.tenant_id \
         JOIN radiology_modalities rm ON rm.id = ro.modality_id AND rm.tenant_id = ro.tenant_id \
         JOIN LATERAL ( \
           SELECT r.* FROM radiology_reports r \
           WHERE r.order_id = ro.id AND r.tenant_id = ro.tenant_id \
             AND r.deleted_at IS NULL AND r.status <> 'draft'::radiology_report_status \
           ORDER BY r.created_at DESC LIMIT 1 \
         ) rr ON true \
         LEFT JOIN users doc ON doc.id = ro.ordered_by \
         LEFT JOIN encounters e ON e.id = ro.encounter_id AND e.tenant_id = ro.tenant_id \
         LEFT JOIN departments d ON d.id = e.department_id AND d.tenant_id = ro.tenant_id \
         LEFT JOIN LATERAL ( \
           SELECT w.name AS ward_name, l.name AS bed_number FROM admissions a \
           LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
           LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id \
           WHERE a.patient_id = ro.patient_id AND a.tenant_id = ro.tenant_id \
             AND a.status = 'admitted'::admission_status AND a.deleted_at IS NULL \
           ORDER BY a.admitted_at DESC LIMIT 1 \
         ) adm ON true \
         LEFT JOIN users rad ON rad.id = rr.reported_by \
         WHERE ro.id = $1 AND ro.tenant_id = $2 AND ro.deleted_at IS NULL",
    )
    .bind(order_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let tenant = sqlx::query_as::<_, (String, Option<String>)>(
        "SELECT name, logo_url FROM tenants WHERE id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    // Signing keys radiology signatures on the report row, not the order.
    let rad_sigs = medbrains_signing::signed_documents::fetch_all_signatures_for_print(
        &mut tx,
        &claims.tenant_id,
        "radiology_report",
        row.report_id,
    )
    .await?;

    tx.commit().await?;

    let age_display = row
        .age
        .map_or("Unknown".to_string(), |a| format!("{a:.0} Y"));

    Ok(Json(RadiologyReportFullPrintData {
        patient_name: row.patient_name,
        uhid: row.uhid,
        age_display,
        gender: row.gender,
        // ponytail: radiology orders carry no accession number yet
        accession_number: String::new(),
        order_date: row
            .order_date
            .with_timezone(&tz)
            .format("%d-%b-%Y")
            .to_string(),
        exam_date: row
            .exam_date
            .map(|d| d.with_timezone(&tz).format("%d-%b-%Y %H:%M").to_string())
            .unwrap_or_default(),
        report_date: row
            .report_date
            .with_timezone(&tz)
            .format("%d-%b-%Y %H:%M")
            .to_string(),
        referring_doctor: row.referring_doctor,
        department: row.department_name,
        ward_name: row.ward_name,
        bed_number: row.bed_number,
        modality: row.modality,
        exam_name: row.exam_name,
        // ponytail: no exam catalogue, contrast detail, technique, technologist or key images recorded anywhere yet
        exam_code: None,
        body_part: row.body_part,
        laterality: row.laterality,
        clinical_history: row.clinical_history,
        contrast_used: row.contrast_used,
        contrast_details: None,
        technique: None,
        findings: row.findings,
        impression: row.impression,
        recommendations: row.recommendations,
        key_images: Vec::new(),
        radiologist_name: row.radiologist_name.unwrap_or_default(),
        radiologist_registration_number: row.radiologist_reg_number,
        radiologist_signature_url: None,
        technologist_name: None,
        verified_at: row
            .verified_at
            .map(|d| d.with_timezone(&tz).format("%d-%b-%Y %H:%M").to_string()),
        pacs_study_uid: row.pacs_study_uid,
        hospital_name: tenant.0,
        hospital_logo_url: tenant.1,
        signatures: rad_sigs
            .into_iter()
            .map(|s| medbrains_core::print_data::PrintSignatureData {
                signed_at: s.signed_at.to_rfc3339(),
                signer_name: s.signer_name,
                display_image_url: s.display_image_url,
                display_block: s.display_block,
                verify_ref: s.verify_ref,
                legal_class: s.legal_class,
            })
            .collect(),
    }))
}

// ── Death Certificate (Form 4/4A) ────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct DeathCertRow {
    summary_id: Uuid,
    deceased_name: String,
    uhid: Option<String>,
    age_at_death: Option<f64>,
    gender: String,
    date_of_birth: Option<chrono::NaiveDate>,
    father_name: Option<String>,
    mother_name: Option<String>,
    spouse_name: Option<String>,
    permanent_address: Option<String>,
    ward_name: Option<String>,
    date_of_death: chrono::NaiveDate,
    time_of_death: chrono::NaiveTime,
    manner_of_death: Option<String>,
    cause_immediate: String,
    cause_antecedent: Option<String>,
    cause_other: Option<String>,
    cause_underlying: Option<String>,
    duration_of_illness: Option<String>,
    attending_doctor_name: Option<String>,
    doctor_registration_number: Option<String>,
    hospital_admission_date: chrono::NaiveDate,
    is_medico_legal: bool,
    certifying_doctor_name: Option<String>,
    certifying_doctor_registration: Option<String>,
    certification_date: chrono::NaiveDate,
}

/// Form 4 for a death in the hospital, printed from the IPD death summary
/// (`ipd_death_summaries`) — the record the IPD death screen writes. The
/// path id is the admission the patient died in.
pub async fn get_death_certificate_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(admission_id): Path<Uuid>,
) -> Result<Json<DeathCertificatePrintData>, AppError> {
    require_permission(&claims, permissions::ipd::death_records::MANAGE)?;
    medbrains_authz_gate::require_admission_access(&state, &claims, admission_id).await?;
    require_permission(&claims, permissions::patients::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, DeathCertRow>(
        "SELECT \
           ds.id AS summary_id, \
           (p.first_name || ' ' || p.last_name) AS deceased_name, \
           p.uhid, \
           EXTRACT(YEAR FROM age(ds.date_of_death, p.date_of_birth))::float8 AS age_at_death, \
           p.gender::text AS gender, \
           p.date_of_birth, \
           p.father_name, \
           p.mother_name, \
           p.spouse_name, \
           p.address_line1 AS permanent_address, \
           w.name AS ward_name, \
           ds.date_of_death, \
           ds.time_of_death, \
           ds.manner_of_death::text AS manner_of_death, \
           ds.cause_of_death_primary AS cause_immediate, \
           ds.cause_of_death_secondary AS cause_antecedent, \
           ds.cause_of_death_tertiary AS cause_other, \
           ds.cause_of_death_underlying AS cause_underlying, \
           ds.duration_of_illness, \
           doc.full_name AS attending_doctor_name, \
           COALESCE(doc.medical_registration_number, doc.registration_number) \
             AS doctor_registration_number, \
           a.admitted_at::date AS hospital_admission_date, \
           ds.is_medico_legal, \
           cert.full_name AS certifying_doctor_name, \
           COALESCE(cert.medical_registration_number, cert.registration_number) \
             AS certifying_doctor_registration, \
           ds.created_at::date AS certification_date \
         FROM ipd_death_summaries ds \
         JOIN admissions a ON a.id = ds.admission_id AND a.tenant_id = ds.tenant_id \
         JOIN patients p ON p.id = ds.patient_id AND p.tenant_id = ds.tenant_id \
         LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
         LEFT JOIN users doc ON doc.id = COALESCE(a.attending_doctor_id, a.admitting_doctor) \
         LEFT JOIN users cert ON cert.id = ds.certifying_doctor_id \
         WHERE ds.admission_id = $1 AND ds.tenant_id = $2 AND ds.deleted_at IS NULL \
         ORDER BY ds.created_at DESC \
         LIMIT 1",
    )
    .bind(admission_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let tenant = sqlx::query_as::<_, (String, Option<String>, Option<String>)>(
        "SELECT name, logo_url, address_line1 FROM tenants WHERE id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let death_sigs = medbrains_signing::signed_documents::fetch_all_signatures_for_print(
        &mut tx,
        &claims.tenant_id,
        "death_certificate",
        row.summary_id,
    )
    .await?;

    tx.commit().await?;

    let age_display = row
        .age_at_death
        .map_or("Unknown".to_string(), |a| format!("{a:.0} years"));
    // A death summary exists only for a death during this admission, so the
    // place is this hospital — and the ward, where one was recorded.
    let place_of_death = match &row.ward_name {
        Some(ward) => format!("{}, {ward}", tenant.0),
        None => tenant.0.clone(),
    };

    Ok(Json(DeathCertificatePrintData {
        // ponytail: no certificate/registration number, ICD coding, pregnancy,
        // autopsy outcome or informant is recorded on the death summary yet
        certificate_number: String::new(),
        registration_number: None,
        registration_date: None,
        deceased_name: row.deceased_name,
        uhid: row.uhid,
        age_at_death: age_display,
        gender: row.gender,
        date_of_birth: row.date_of_birth.map(|d| d.format("%d-%b-%Y").to_string()),
        father_name: row.father_name,
        mother_name: row.mother_name,
        spouse_name: row.spouse_name,
        permanent_address: row.permanent_address,
        place_of_death,
        date_of_death: row.date_of_death.format("%d-%b-%Y").to_string(),
        time_of_death: row.time_of_death.format("%H:%M").to_string(),
        manner_of_death: row.manner_of_death.unwrap_or_default(),
        cause_of_death_immediate: row.cause_immediate,
        cause_of_death_antecedent: row.cause_antecedent,
        cause_of_death_underlying: row.cause_underlying,
        other_significant_conditions: row.cause_other.into_iter().collect(),
        duration_of_illness: row.duration_of_illness,
        icd_code_immediate: None,
        icd_code_underlying: None,
        // An in-patient death is attended: the admission names its doctor.
        attended_by_doctor: row.attending_doctor_name.is_some(),
        attending_doctor_name: row.attending_doctor_name,
        doctor_registration_number: row.doctor_registration_number,
        hospital_admission_date: Some(row.hospital_admission_date.format("%d-%b-%Y").to_string()),
        pregnancy_status: None,
        pregnancy_contributed: None,
        mlc_case: row.is_medico_legal,
        mlc_number: None,
        autopsy_performed: None,
        autopsy_findings: None,
        informant_name: None,
        informant_relationship: None,
        informant_address: None,
        certifying_doctor_name: row.certifying_doctor_name.unwrap_or_default(),
        certifying_doctor_registration: row.certifying_doctor_registration,
        certification_date: row.certification_date.format("%d-%b-%Y").to_string(),
        hospital_name: tenant.0,
        hospital_address: tenant.2,
        hospital_logo_url: tenant.1,
        signatures: medbrains_signing::signed_documents::to_print_signatures(death_sigs),
    }))
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 5: OT Register, Blood Bank, Identity/Clinical Forms
// ══════════════════════════════════════════════════════════════════════════════

use chrono::Utc;

use medbrains_core::print_data::{
    BloodDonorFormPrintData, CrossMatchRequisitionPrintData, DonorMedicalHistory,
    DonorPhysicalExam, DpdpConsentPrintData, OtRegisterPrintData, OtSurgeryEntry,
    RestraintDocumentationPrintData, RestraintMonitoring, VideoConsentPrintData,
};

// ── Helper Functions (Phase 5) ────────────────────────────────────────────────

/// The caller's own hospital letterhead: name, logo, address line, phone.
async fn tenant_letterhead(
    conn: &mut sqlx::PgConnection,
    tenant_id: Uuid,
) -> Result<(String, Option<String>, Option<String>, Option<String>), AppError> {
    Ok(
        sqlx::query_as::<_, (String, Option<String>, Option<String>, Option<String>)>(
            "SELECT name, logo_url, address_line1, phone FROM tenants WHERE id = $1",
        )
        .bind(tenant_id)
        .fetch_one(conn)
        .await?,
    )
}

// ── OT Register ───────────────────────────────────────────────────────────────

/// GET /print-data/ot-register/{ot_room_id}/{date}
///
/// One theatre's cases for one day, from `ot_bookings` and the case,
/// anaesthesia and post-op records the theatre team writes against them.
pub async fn get_ot_register_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((ot_room_id, date)): Path<(Uuid, String)>,
) -> Result<Json<OtRegisterPrintData>, AppError> {
    // The OT register is the log of cases performed; `ot::case_records` is the
    // permission that governs those records elsewhere.
    require_permission(&claims, permissions::ot::case_records::LIST)?;
    // No per-record check: a register lists every patient through one theatre
    // that day, which is exactly what `ot::case_records::LIST` grants.

    // A tenant-scoped connection rather than the bare pool: every table below
    // is row-level secured, and a pool query carries no tenant, so under
    // enforcement this prints an empty form. A blank statutory register is
    // worse than a failed one — it looks filed.
    let mut pooled = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;
    let mut conn = sqlx::Connection::begin(&mut *pooled).await?;
    let tz = crate::set_print_timezone(&mut conn, &claims.tenant_id).await?;

    // A bad date is refused, not silently swapped for today's register.
    let register_date = chrono::NaiveDate::parse_from_str(&date, "%Y-%m-%d")
        .map_err(|_| AppError::BadRequest("date must be YYYY-MM-DD".to_owned()))?;

    #[derive(sqlx::FromRow)]
    struct OtRow {
        ot_name: String,
        ot_number: String,
    }

    let ot = sqlx::query_as::<_, OtRow>(
        "SELECT name AS ot_name, code::text AS ot_number FROM ot_rooms \
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(ot_room_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *conn)
    .await?
    .ok_or(AppError::NotFound)?;

    #[derive(sqlx::FromRow)]
    struct SurgeryRow {
        patient_name: String,
        uhid: String,
        age: Option<f64>,
        gender: String,
        ip_number: Option<String>,
        diagnosis: Option<String>,
        procedure_name: String,
        surgery_type: String,
        surgeon_name: Option<String>,
        assistant_surgeon: Option<String>,
        anesthesiologist: Option<String>,
        anesthesia_type: Option<String>,
        scrub_nurse: Option<String>,
        circulating_nurse: Option<String>,
        scheduled_time: chrono::DateTime<Utc>,
        actual_start: Option<chrono::DateTime<Utc>>,
        actual_end: Option<chrono::DateTime<Utc>>,
        outcome: Option<String>,
        complications: Option<String>,
    }

    // Team members are jsonb arrays of user ids; an entry that is not a user
    // id is printed as written.
    let surgeries_raw = sqlx::query_as::<_, SurgeryRow>(
        r"
        SELECT
            (p.first_name || ' ' || p.last_name) AS patient_name,
            p.uhid,
            EXTRACT(YEAR FROM AGE(p.date_of_birth))::float8 AS age,
            p.gender::text AS gender,
            a.admission_number AS ip_number,
            COALESCE(a.primary_diagnosis, a.provisional_diagnosis) AS diagnosis,
            COALESCE(cr.procedure_performed, b.procedure_name) AS procedure_name,
            b.priority::text AS surgery_type,
            COALESCE(cs.full_name, ps.full_name) AS surgeon_name,
            (SELECT string_agg(COALESCE(u.full_name, e.v), ', ')
               FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(b.assistant_surgeons) = 'array'
                    THEN b.assistant_surgeons ELSE '[]'::jsonb END) e(v)
               LEFT JOIN users u ON u.id::text = e.v) AS assistant_surgeon,
            an.full_name AS anesthesiologist,
            ar.anesthesia_type::text AS anesthesia_type,
            (SELECT string_agg(COALESCE(u.full_name, e.v), ', ')
               FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(b.scrub_nurses) = 'array'
                    THEN b.scrub_nurses ELSE '[]'::jsonb END) e(v)
               LEFT JOIN users u ON u.id::text = e.v) AS scrub_nurse,
            (SELECT string_agg(COALESCE(u.full_name, e.v), ', ')
               FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(b.circulating_nurses) = 'array'
                    THEN b.circulating_nurses ELSE '[]'::jsonb END) e(v)
               LEFT JOIN users u ON u.id::text = e.v) AS circulating_nurse,
            b.scheduled_start AS scheduled_time,
            COALESCE(b.actual_start, b.actual_start_time) AS actual_start,
            COALESCE(b.actual_end, b.actual_end_time) AS actual_end,
            po.disposition AS outcome,
            NULLIF(concat_ws('; ', cr.complications, ar.complications), '') AS complications
        FROM ot_bookings b
        JOIN patients p ON p.id = b.patient_id AND p.tenant_id = b.tenant_id
        LEFT JOIN admissions a ON a.id = b.admission_id AND a.tenant_id = b.tenant_id
        LEFT JOIN LATERAL (
            SELECT c.* FROM ot_case_records c
            WHERE c.booking_id = b.id AND c.tenant_id = b.tenant_id AND c.deleted_at IS NULL
            ORDER BY c.created_at DESC LIMIT 1
        ) cr ON true
        LEFT JOIN LATERAL (
            SELECT x.* FROM ot_anesthesia_records x
            WHERE x.booking_id = b.id AND x.tenant_id = b.tenant_id AND x.deleted_at IS NULL
            ORDER BY x.created_at DESC LIMIT 1
        ) ar ON true
        LEFT JOIN LATERAL (
            SELECT y.disposition FROM ot_postop_records y
            WHERE y.booking_id = b.id AND y.tenant_id = b.tenant_id AND y.deleted_at IS NULL
            ORDER BY y.created_at DESC LIMIT 1
        ) po ON true
        LEFT JOIN users cs ON cs.id = cr.surgeon_id
        LEFT JOIN users ps ON ps.id = COALESCE(b.surgeon_id, b.primary_surgeon_id)
        LEFT JOIN users an ON an.id = COALESCE(ar.anesthetist_id, b.anesthesiologist_id, b.anesthetist_id)
        WHERE b.ot_room_id = $1 AND b.tenant_id = $2 AND b.scheduled_date = $3
          AND b.deleted_at IS NULL
          AND b.status NOT IN ('cancelled'::ot_booking_status, 'postponed'::ot_booking_status)
        ORDER BY b.scheduled_start
        LIMIT 500
        ",
    )
    .bind(ot_room_id)
    .bind(claims.tenant_id)
    .bind(register_date)
    .fetch_all(&mut *conn)
    .await?;

    let printed_by: String =
        sqlx::query_scalar("SELECT full_name FROM users WHERE id = $1 AND tenant_id = $2")
            .bind(claims.sub)
            .bind(claims.tenant_id)
            .fetch_optional(&mut *conn)
            .await?
            .unwrap_or_default();
    let tenant = tenant_letterhead(&mut conn, claims.tenant_id).await?;

    // `ot_case_priority` is elective / urgent / emergency; the register has
    // two columns, so anything unplanned counts as emergency.
    let total_elective = surgeries_raw
        .iter()
        .filter(|s| s.surgery_type == "elective")
        .count() as i32;

    let surgeries: Vec<OtSurgeryEntry> = surgeries_raw
        .into_iter()
        .enumerate()
        .map(|(idx, s)| {
            let duration = match (s.actual_start, s.actual_end) {
                (Some(start), Some(end)) => Some((end - start).num_minutes() as i32),
                _ => None,
            };

            let age_gender = format!(
                "{}/{}",
                s.age.map(|a| format!("{a:.0}Y")).unwrap_or_default(),
                s.gender.chars().next().unwrap_or('?')
            );

            OtSurgeryEntry {
                serial_no: (idx + 1) as i32,
                patient_name: s.patient_name,
                uhid: s.uhid,
                age_gender,
                ip_number: s.ip_number,
                diagnosis: s.diagnosis.unwrap_or_default(),
                procedure: s.procedure_name,
                surgery_type: s.surgery_type,
                surgeon: s.surgeon_name.unwrap_or_default(),
                assistant_surgeon: s.assistant_surgeon,
                anesthesiologist: s.anesthesiologist.unwrap_or_default(),
                anesthesia_type: s.anesthesia_type.unwrap_or_default(),
                scrub_nurse: s.scrub_nurse,
                circulating_nurse: s.circulating_nurse,
                scheduled_time: s
                    .scheduled_time
                    .with_timezone(&tz)
                    .format("%H:%M")
                    .to_string(),
                actual_start: s
                    .actual_start
                    .map(|t| t.with_timezone(&tz).format("%H:%M").to_string()),
                actual_end: s
                    .actual_end
                    .map(|t| t.with_timezone(&tz).format("%H:%M").to_string()),
                duration_minutes: duration,
                outcome: s.outcome,
                complications: s.complications,
            }
        })
        .collect();

    let total = surgeries.len() as i32;

    Ok(Json(OtRegisterPrintData {
        register_date: register_date.format("%d-%m-%Y").to_string(),
        ot_name: ot.ot_name,
        ot_number: ot.ot_number,
        surgeries,
        total_surgeries: total,
        total_elective,
        total_emergency: total - total_elective,
        printed_by,
        hospital_name: tenant.0,
    }))
}

// ── Blood Bank Donor Registration ─────────────────────────────────────────────

/// GET /print-data/blood-donor-form/{donor_id}
pub async fn get_blood_donor_form_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(donor_id): Path<Uuid>,
) -> Result<Json<BloodDonorFormPrintData>, AppError> {
    require_permission(&claims, permissions::blood_bank::donors::LIST)?;
    // A donor is not a patient here; `blood_donors` has no patient column.

    // A tenant-scoped connection rather than the bare pool: every table below
    // is row-level secured, and a pool query carries no tenant, so under
    // enforcement this prints an empty form. A blank statutory register is
    // worse than a failed one — it looks filed.
    let mut pooled = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;
    let mut conn = sqlx::Connection::begin(&mut *pooled).await?;
    let tz = crate::set_print_timezone(&mut conn, &claims.tenant_id).await?;

    #[derive(sqlx::FromRow)]
    struct DonorRow {
        registration_number: String,
        registration_date: chrono::DateTime<Utc>,
        donor_name: String,
        age: Option<i32>,
        gender: String,
        blood_group: String,
        rh_factor: String,
        address: String,
        phone: String,
        email: Option<String>,
        id_proof_type: String,
        id_proof_number: String,
        donation_type: String,
        previous_donations: i32,
        last_donation_date: Option<chrono::DateTime<Utc>>,
        is_deferred: bool,
        deferral_reason: Option<String>,
        medical_history: Option<String>,
        medical_officer: Option<String>,
    }

    // The blood-bank screen writes `donor_number`, the name parts, `blood_group`,
    // contact and ID fields; the duplicate print-era columns beside them
    // (`registration_number`, `donor_name`, `age`, `weight_kg` …) are never
    // written. Donation type and medical officer come from the latest donation.
    let donor = sqlx::query_as::<_, DonorRow>(
        r"
        SELECT
            d.donor_number AS registration_number,
            d.created_at AS registration_date,
            (d.first_name || ' ' || d.last_name) AS donor_name,
            EXTRACT(YEAR FROM AGE(d.date_of_birth))::int4 AS age,
            COALESCE(d.gender, '') AS gender,
            upper(split_part(d.blood_group::text, '_', 1)) AS blood_group,
            CASE split_part(d.blood_group::text, '_', 2)
                WHEN 'positive' THEN '+' WHEN 'negative' THEN '-' ELSE '' END AS rh_factor,
            COALESCE(d.address, '') AS address,
            COALESCE(d.phone, '') AS phone,
            d.email,
            COALESCE(d.id_type, '') AS id_proof_type,
            COALESCE(d.id_number, '') AS id_proof_number,
            COALESCE(ld.donation_type::text, '') AS donation_type,
            d.total_donations AS previous_donations,
            d.last_donation AS last_donation_date,
            d.is_deferred,
            d.deferral_reason,
            NULLIF(d.medical_history, '{}'::jsonb)::text AS medical_history,
            mo.full_name AS medical_officer
        FROM blood_donors d
        LEFT JOIN LATERAL (
            SELECT bd.donation_type, bd.medical_officer_id FROM blood_donations bd
            WHERE bd.donor_id = d.id AND bd.tenant_id = d.tenant_id AND bd.deleted_at IS NULL
            ORDER BY bd.donated_at DESC LIMIT 1
        ) ld ON true
        LEFT JOIN users mo ON mo.id = ld.medical_officer_id
        WHERE d.id = $1 AND d.tenant_id = $2 AND d.deleted_at IS NULL
        ",
    )
    .bind(donor_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *conn)
    .await?
    .ok_or(AppError::NotFound)?;

    let tenant = tenant_letterhead(&mut conn, claims.tenant_id).await?;

    Ok(Json(BloodDonorFormPrintData {
        registration_number: donor.registration_number,
        registration_date: donor
            .registration_date
            .with_timezone(&tz)
            .format("%d-%m-%Y")
            .to_string(),
        donor_name: donor.donor_name,
        age: donor.age,
        gender: donor.gender,
        blood_group: donor.blood_group,
        rh_factor: donor.rh_factor,
        father_husband_name: None,
        address: donor.address,
        phone: donor.phone,
        email: donor.email,
        id_proof_type: donor.id_proof_type,
        id_proof_number: donor.id_proof_number,
        occupation: None,
        donation_type: donor.donation_type,
        previous_donations: donor.previous_donations,
        last_donation_date: donor
            .last_donation_date
            .map(|d| d.with_timezone(&tz).format("%d-%m-%Y").to_string()),
        // ponytail: no donor questionnaire or pre-donation exam is captured
        // anywhere; the boxes print as not recorded and the free-text history
        // is whatever `medical_history` holds.
        medical_history: DonorMedicalHistory {
            recent_illness: None,
            recent_surgery: None,
            recent_transfusion: None,
            chronic_disease: None,
            on_medication: None,
            pregnant_or_lactating: None,
            high_risk_behavior: None,
            tattoo_recent: None,
            details: donor.medical_history,
        },
        physical_exam: DonorPhysicalExam {
            weight_kg: None,
            blood_pressure: None,
            pulse: None,
            temperature: None,
            hemoglobin: None,
            // Never "fit" without an examination; a recorded deferral is
            // "not fit", anything else is not recorded.
            fit_to_donate: donor.is_deferred.then_some(false),
            deferral_reason: if donor.is_deferred {
                donor.deferral_reason
            } else {
                None
            },
        },
        consent_given: None,
        consent_date: None,
        medical_officer: donor.medical_officer,
        hospital_name: tenant.0,
    }))
}

// ── Blood Bank Cross-Match Requisition ────────────────────────────────────────

/// GET /print-data/cross-match-requisition/{crossmatch_request_id}
pub async fn get_cross_match_requisition_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(crossmatch_request_id): Path<Uuid>,
) -> Result<Json<CrossMatchRequisitionPrintData>, AppError> {
    require_permission(&claims, permissions::blood_bank::crossmatch::LIST)?;
    require_permission(&claims, permissions::patients::VIEW)?;

    // A tenant-scoped connection rather than the bare pool: every table below
    // is row-level secured, and a pool query carries no tenant, so under
    // enforcement this prints an empty form. A blank statutory register is
    // worse than a failed one — it looks filed.
    let mut pooled = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;
    let mut conn = sqlx::Connection::begin(&mut *pooled).await?;
    let tz = crate::set_print_timezone(&mut conn, &claims.tenant_id).await?;

    #[derive(sqlx::FromRow)]
    struct ReqRow {
        patient_id: Uuid,
        requisition_date: chrono::DateTime<Utc>,
        patient_name: String,
        uhid: String,
        age: Option<f64>,
        gender: String,
        ip_number: Option<String>,
        ward_bed: String,
        blood_group: String,
        rh_factor: String,
        diagnosis: String,
        indication: String,
        units_required: i32,
        component_type: String,
        previous_transfusions: i32,
        reaction_history: bool,
        reaction_details: Option<String>,
        requesting_doctor: Option<String>,
    }

    // Transfusion history is what `transfusion_records` holds for this patient
    // before the request was raised; the ward is the stay open at that moment.
    let req = sqlx::query_as::<_, ReqRow>(
        r"
        SELECT
            cr.patient_id,
            cr.created_at AS requisition_date,
            (p.first_name || ' ' || p.last_name) AS patient_name,
            p.uhid,
            EXTRACT(YEAR FROM AGE(p.date_of_birth))::float8 AS age,
            p.gender::text AS gender,
            adm.admission_number AS ip_number,
            concat_ws(' / ', adm.ward_name, adm.bed_name) AS ward_bed,
            upper(split_part(cr.blood_group::text, '_', 1)) AS blood_group,
            CASE split_part(cr.blood_group::text, '_', 2)
                WHEN 'positive' THEN '+' WHEN 'negative' THEN '-' ELSE '' END AS rh_factor,
            COALESCE(adm.diagnosis, '') AS diagnosis,
            COALESCE(cr.clinical_indication, '') AS indication,
            cr.units_requested AS units_required,
            cr.component_type::text AS component_type,
            hx.previous_transfusions,
            hx.reaction_history,
            hx.reaction_details,
            doctor.full_name AS requesting_doctor
        FROM crossmatch_requests cr
        JOIN patients p ON p.id = cr.patient_id AND p.tenant_id = cr.tenant_id
        LEFT JOIN users doctor ON doctor.id = cr.requested_by
        LEFT JOIN LATERAL (
            SELECT a.id, a.admission_number, w.name AS ward_name, l.name AS bed_name,
                   COALESCE(a.primary_diagnosis, a.provisional_diagnosis) AS diagnosis
            FROM admissions a
            LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id
            LEFT JOIN locations l ON l.id = a.bed_id AND l.tenant_id = a.tenant_id
            WHERE a.patient_id = cr.patient_id AND a.tenant_id = cr.tenant_id
              AND a.deleted_at IS NULL AND a.admitted_at <= cr.created_at
              AND (a.discharged_at IS NULL OR a.discharged_at >= cr.created_at)
            ORDER BY a.admitted_at DESC LIMIT 1
        ) adm ON true
        CROSS JOIN LATERAL (
            SELECT COUNT(*)::int4 AS previous_transfusions,
                   COALESCE(bool_or(t.has_reaction), false) AS reaction_history,
                   string_agg(concat_ws(': ', t.reaction_type, t.reaction_details), '; ')
                       FILTER (WHERE t.has_reaction) AS reaction_details
            FROM transfusion_records t
            WHERE t.patient_id = cr.patient_id AND t.tenant_id = cr.tenant_id
              AND t.deleted_at IS NULL AND t.started_at < cr.created_at
        ) hx
        WHERE cr.id = $1 AND cr.tenant_id = $2 AND cr.deleted_at IS NULL
        ",
    )
    .bind(crossmatch_request_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *conn)
    .await?
    .ok_or(AppError::NotFound)?;

    medbrains_authz_gate::require_patient_access(&state, &claims, req.patient_id).await?;

    let tenant = tenant_letterhead(&mut conn, claims.tenant_id).await?;

    let age_gender = format!(
        "{}/{}",
        req.age.map(|a| format!("{a:.0}Y")).unwrap_or_default(),
        req.gender.chars().next().unwrap_or('?')
    );

    Ok(Json(CrossMatchRequisitionPrintData {
        // ponytail: crossmatch requests carry no requisition number, urgency or sample collection yet
        requisition_number: None,
        requisition_date: req
            .requisition_date
            .with_timezone(&tz)
            .format("%d-%m-%Y %H:%M")
            .to_string(),
        urgency: None,
        patient_name: req.patient_name,
        uhid: req.uhid,
        age_gender,
        ip_number: req.ip_number,
        ward_bed: req.ward_bed,
        blood_group: req.blood_group,
        rh_factor: req.rh_factor,
        diagnosis: req.diagnosis,
        indication_for_transfusion: req.indication,
        units_required: req.units_required,
        component_type: req.component_type,
        previous_transfusions: req.previous_transfusions,
        transfusion_reactions_history: req.reaction_history,
        reaction_details: req.reaction_details,
        sample_collected_by: None,
        sample_collected_at: None,
        requesting_doctor: req.requesting_doctor.unwrap_or_default(),
        doctor_signature_date: req
            .requisition_date
            .with_timezone(&tz)
            .format("%d-%m-%Y")
            .to_string(),
        hospital_name: tenant.0,
    }))
}

// ── Appointment Slip ──────────────────────────────────────────────────────────

/// GET /print-data/appointment-slip/{appointment_id}
pub async fn get_appointment_slip_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(appointment_id): Path<Uuid>,
) -> Result<Json<AppointmentSlipPrintData>, AppError> {
    require_permission(&claims, permissions::opd::appointment::LIST)?;
    require_permission(&claims, permissions::patients::VIEW)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::APPOINTMENT,
        appointment_id,
    )
    .await?;

    // A tenant-scoped connection rather than the bare pool: every table below
    // is row-level secured, and a pool query carries no tenant, so under
    // enforcement this prints an empty form. A blank statutory register is
    // worse than a failed one — it looks filed.
    let mut pooled = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;
    let mut conn = sqlx::Connection::begin(&mut *pooled).await?;
    crate::set_print_timezone(&mut conn, &claims.tenant_id).await?;

    #[derive(sqlx::FromRow)]
    struct ApptRow {
        appointment_number: String,
        appointment_date: chrono::NaiveDate,
        appointment_time: chrono::NaiveTime,
        patient_name: String,
        uhid: String,
        phone: Option<String>,
        doctor_name: String,
        doctor_designation: Option<String>,
        department_name: Option<String>,
        visit_type: String,
    }

    let appt = sqlx::query_as::<_, ApptRow>(
        r"
        SELECT
            COALESCE(a.token_number::text, '') AS appointment_number,
            a.appointment_date,
            a.slot_start AS appointment_time,
            (p.first_name || ' ' || p.last_name) AS patient_name,
            p.uhid,
            p.phone,
            d.full_name AS doctor_name,
            COALESCE(des.name, d.designation) AS doctor_designation,
            dept.name AS department_name,
            a.appointment_type::text AS visit_type
        FROM appointments a
        JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id
        JOIN users d ON d.id = a.doctor_id
        LEFT JOIN designations des ON des.id = d.designation_id
        LEFT JOIN departments dept ON dept.id = a.department_id AND dept.tenant_id = a.tenant_id
        WHERE a.id = $1 AND a.tenant_id = $2 AND a.deleted_at IS NULL
        ",
    )
    .bind(appointment_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *conn)
    .await?
    .ok_or(AppError::NotFound)?;

    let tenant = tenant_letterhead(&mut conn, claims.tenant_id).await?;

    Ok(Json(AppointmentSlipPrintData {
        appointment_number: appt.appointment_number,
        appointment_date: appt.appointment_date.format("%d-%m-%Y").to_string(),
        appointment_time: appt.appointment_time.format("%H:%M").to_string(),
        patient_name: appt.patient_name,
        uhid: appt.uhid,
        phone: appt.phone,
        doctor_name: appt.doctor_name,
        doctor_designation: appt.doctor_designation,
        department: appt.department_name.unwrap_or_default(),
        // ponytail: appointments carry no room, preparation notes, wait estimate,
        // document checklist or cancellation policy yet
        clinic_location: None,
        visit_type: appt.visit_type,
        preparation_instructions: None,
        documents_to_bring: Vec::new(),
        estimated_wait_time: None,
        contact_for_queries: tenant.3,
        cancellation_policy: None,
        qr_code_data: Some(format!("APPT:{appointment_id}")),
        hospital_name: tenant.0,
        hospital_address: tenant.2,
        hospital_logo_url: tenant.1,
    }))
}

// ── DPDP Act Consent ──────────────────────────────────────────────────────────

/// GET /print-data/dpdp-consent/{consent_id}
///
/// A patient's data-sharing consent as the registration desk recorded it: a
/// `patient_consents` row of type `data_sharing`. Prints what was recorded —
/// who consented, how, on which form version, and whether it still stands —
/// and nothing the record does not say about where the data goes.
pub async fn get_dpdp_consent_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(consent_id): Path<Uuid>,
) -> Result<Json<DpdpConsentPrintData>, AppError> {
    // A DPDP consent is a signed consent record, which is what
    // `consent::signatures` governs.
    require_permission(&claims, permissions::consent::signatures::LIST)?;
    require_permission(&claims, permissions::patients::VIEW)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::PATIENT_CONSENT,
        consent_id,
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    #[derive(sqlx::FromRow)]
    struct ConsentRow {
        consent_date: String,
        patient_name: String,
        uhid: String,
        consented_by: String,
        consented_by_relation: Option<String>,
        consent_form: Option<String>,
        consent_version: Option<String>,
        consent_status: String,
        consent_method: String,
        witness_name: Option<String>,
        valid_until: Option<String>,
        withdrawn_at: Option<String>,
        withdrawal_reason: Option<String>,
    }

    let consent = sqlx::query_as::<_, ConsentRow>(
        "SELECT \
           to_char(c.consent_date, 'DD-MM-YYYY HH24:MI') AS consent_date, \
           concat_ws(' ', p.first_name, p.last_name) AS patient_name, \
           p.uhid, \
           c.consented_by, \
           c.consented_by_relation, \
           ct.name AS consent_form, \
           COALESCE(c.consent_version, ct.version::text) AS consent_version, \
           c.consent_status::text AS consent_status, \
           c.capture_mode::text AS consent_method, \
           c.witness_name, \
           to_char(c.valid_until, 'DD-MM-YYYY') AS valid_until, \
           to_char(c.revoked_at, 'DD-MM-YYYY HH24:MI') AS withdrawn_at, \
           c.revoked_reason AS withdrawal_reason \
         FROM patient_consents c \
         JOIN patients p ON p.id = c.patient_id AND p.tenant_id = c.tenant_id \
         LEFT JOIN consent_templates ct ON ct.id = c.template_id \
         WHERE c.id = $1 AND c.tenant_id = $2 AND c.deleted_at IS NULL \
           AND c.consent_type = 'data_sharing'",
    )
    .bind(consent_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let tenant = tenant_letterhead(&mut tx, claims.tenant_id).await?;
    tx.commit().await?;

    // Fixed form wording: the Data Principal's rights as the DPDP Act 2023
    // states them. Nothing here asserts what this hospital does with the data.
    let patient_rights = vec![
        "Right to access information about your personal data (s.11)".to_string(),
        "Right to correction, completion, updating and erasure of your personal data (s.12)"
            .to_string(),
        "Right to grievance redressal with the hospital, and thereafter with the Data \
         Protection Board of India (s.13)"
            .to_string(),
        "Right to nominate a person to exercise these rights on your death or incapacity (s.14)"
            .to_string(),
        "Right to withdraw consent at any time, as easily as it was given (s.6(4))".to_string(),
    ];

    Ok(Json(DpdpConsentPrintData {
        consent_date: consent.consent_date,
        patient_name: consent.patient_name,
        uhid: consent.uhid,
        consented_by: consent.consented_by,
        consented_by_relation: consent.consented_by_relation,
        consent_form: consent.consent_form,
        consent_version: consent.consent_version,
        consent_status: consent.consent_status,
        consent_method: consent.consent_method,
        witness_name: consent.witness_name,
        valid_until: consent.valid_until,
        withdrawn_at: consent.withdrawn_at,
        withdrawal_reason: consent.withdrawal_reason,
        patient_rights,
        hospital_name: tenant.0,
    }))
}

// ── Video Consent Recording ───────────────────────────────────────────────────

/// GET /print-data/video-consent/{signature_id}
///
/// A video-recorded consent is a `consent_signature_metadata` row with a
/// `video_consent_url`; it signs either a `patient_consents` or a
/// `procedure_consents` row (`consent_source`), which names the patient.
pub async fn get_video_consent_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(signature_id): Path<Uuid>,
) -> Result<Json<VideoConsentPrintData>, AppError> {
    // Same reasoning as the DPDP consent above — a signed consent record.
    require_permission(&claims, permissions::consent::signatures::LIST)?;
    require_permission(&claims, permissions::patients::VIEW)?;

    // A tenant-scoped connection rather than the bare pool: every table below
    // is row-level secured, and a pool query carries no tenant, so under
    // enforcement this prints an empty form. A blank statutory register is
    // worse than a failed one — it looks filed.
    let mut pooled = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;
    let mut conn = sqlx::Connection::begin(&mut *pooled).await?;
    let tz = crate::set_print_timezone(&mut conn, &claims.tenant_id).await?;

    #[derive(sqlx::FromRow)]
    struct VideoRow {
        patient_id: Uuid,
        consent_number: String,
        consent_date: chrono::DateTime<Utc>,
        patient_name: String,
        uhid: String,
        consent_type: String,
        procedure_name: Option<String>,
        video_reference_id: String,
        video_recorded_at: chrono::DateTime<Utc>,
        video_url: String,
        witness_name: Option<String>,
        recording_staff: Option<String>,
    }

    let video = sqlx::query_as::<_, VideoRow>(
        r"
        SELECT
            p.id AS patient_id,
            csm.consent_id::text AS consent_number,
            COALESCE(pc.consent_date, prc.signed_at, csm.captured_at) AS consent_date,
            (p.first_name || ' ' || p.last_name) AS patient_name,
            p.uhid,
            COALESCE(pc.consent_type::text, prc.consent_type) AS consent_type,
            prc.procedure_name,
            csm.id::text AS video_reference_id,
            csm.captured_at AS video_recorded_at,
            csm.video_consent_url AS video_url,
            COALESCE(csm.witness_name, pc.witness_name, prc.witness_name) AS witness_name,
            recorder.full_name AS recording_staff
        FROM consent_signature_metadata csm
        LEFT JOIN patient_consents pc ON csm.consent_source = 'patient_consent'
            AND pc.id = csm.consent_id AND pc.tenant_id = csm.tenant_id
            AND pc.deleted_at IS NULL
        LEFT JOIN procedure_consents prc ON csm.consent_source = 'procedure_consent'
            AND prc.id = csm.consent_id AND prc.tenant_id = csm.tenant_id
            AND prc.deleted_at IS NULL
        JOIN patients p ON p.id = COALESCE(pc.patient_id, prc.patient_id)
            AND p.tenant_id = csm.tenant_id
        LEFT JOIN users recorder ON recorder.id = csm.captured_by
        WHERE csm.id = $1 AND csm.tenant_id = $2 AND csm.deleted_at IS NULL
          AND csm.video_consent_url IS NOT NULL
        ",
    )
    .bind(signature_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *conn)
    .await?
    .ok_or(AppError::NotFound)?;

    medbrains_authz_gate::require_patient_access(&state, &claims, video.patient_id).await?;

    let tenant = tenant_letterhead(&mut conn, claims.tenant_id).await?;

    Ok(Json(VideoConsentPrintData {
        consent_number: Some(video.consent_number),
        consent_date: video
            .consent_date
            .with_timezone(&tz)
            .format("%d-%m-%Y")
            .to_string(),
        patient_name: video.patient_name,
        uhid: video.uhid,
        consent_type: video.consent_type,
        procedure_name: video.procedure_name,
        video_reference_id: video.video_reference_id,
        // ponytail: duration, verification and the visible/verbal flags are not recorded anywhere yet
        video_duration_seconds: None,
        video_recorded_at: video
            .video_recorded_at
            .with_timezone(&tz)
            .format("%d-%m-%Y %H:%M")
            .to_string(),
        // The QR opens the recording itself, not a made-up portal address.
        qr_code_to_video: video.video_url.clone(),
        video_url: video.video_url,
        video_verified: None,
        patient_visible_in_video: None,
        verbal_consent_given: None,
        witness_name: video.witness_name,
        witness_relationship: None,
        recording_staff: video.recording_staff.unwrap_or_default(),
        hospital_name: tenant.0,
    }))
}

// ── Restraint Documentation Form ──────────────────────────────────────────────

/// GET /print-data/restraint-documentation/{restraint_doc_id}
#[derive(Debug, sqlx::FromRow)]
struct RestraintMonitoringRow {
    check_time: chrono::DateTime<Utc>,
    checked_by: Option<String>,
    status: Option<String>,
    circulation_status: Option<String>,
    skin_status: Option<String>,
    patient_response: Option<String>,
    notes: Option<String>,
}

pub async fn get_restraint_documentation_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(restraint_doc_id): Path<Uuid>,
) -> Result<Json<RestraintDocumentationPrintData>, AppError> {
    // `nurse_clinical.rs` guards the restraint record itself with this.
    require_permission(&claims, permissions::nurse::restraint::VIEW)?;
    require_permission(&claims, permissions::patients::VIEW)?;

    // A tenant-scoped connection rather than the bare pool: every table below
    // is row-level secured, and a pool query carries no tenant, so under
    // enforcement this prints an empty form. A blank statutory register is
    // worse than a failed one — it looks filed.
    let mut pooled = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;
    let mut conn = sqlx::Connection::begin(&mut *pooled).await?;
    let tz = crate::set_print_timezone(&mut conn, &claims.tenant_id).await?;

    // A restraint episode is an `ipd_clinical_documentations` row of type
    // `restraint` (the IPD clinical-docs screen); its rounds are
    // `restraint_monitoring_logs.clinical_doc_id`. `restraint_documentation`
    // is never written. Access is decided on the admission it belongs to.
    let admission_id: Uuid = sqlx::query_scalar(
        "SELECT admission_id FROM ipd_clinical_documentations \
         WHERE id = $1 AND tenant_id = $2 AND doc_type = 'restraint' \
           AND deleted_at IS NULL",
    )
    .bind(restraint_doc_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *conn)
    .await?
    .ok_or(AppError::NotFound)?;
    medbrains_authz_gate::require_admission_access(&state, &claims, admission_id).await?;

    #[derive(sqlx::FromRow)]
    struct RestraintRow {
        form_date: chrono::DateTime<Utc>,
        patient_name: String,
        uhid: String,
        ip_number: String,
        ward: String,
        diagnosis: String,
        restraint_type: String,
        indication: String,
        start_datetime: chrono::DateTime<Utc>,
        actual_end: Option<chrono::DateTime<Utc>>,
        ordering_physician: Option<String>,
    }

    let restraint = sqlx::query_as::<_, RestraintRow>(
        r"
        SELECT
            d.created_at AS form_date,
            (p.first_name || ' ' || p.last_name) AS patient_name,
            p.uhid,
            a.admission_number AS ip_number,
            COALESCE(w.name, '') AS ward,
            COALESCE(a.primary_diagnosis, a.provisional_diagnosis, '') AS diagnosis,
            d.title AS restraint_type,
            COALESCE(d.notes, '') AS indication,
            d.recorded_at AS start_datetime,
            d.resolved_at AS actual_end,
            CASE WHEN u.role = 'doctor' THEN u.full_name END AS ordering_physician
        FROM ipd_clinical_documentations d
        JOIN admissions a ON a.id = d.admission_id AND a.tenant_id = d.tenant_id
        JOIN patients p ON p.id = d.patient_id AND p.tenant_id = d.tenant_id
        LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id
        LEFT JOIN users u ON u.id = d.recorded_by
        WHERE d.id = $1 AND d.tenant_id = $2 AND d.deleted_at IS NULL
        ",
    )
    .bind(restraint_doc_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *conn)
    .await?
    .ok_or(AppError::NotFound)?;

    let tenant = tenant_letterhead(&mut conn, claims.tenant_id).await?;

    // The monitoring rounds that were actually recorded.
    //
    // This used to be a hardcoded pair — "Nurse on duty", "Calm, vitals
    // stable", every box ticked — at timestamps derived from the restraint's
    // start time. A restraint record is a legal document: under the Mental
    // Healthcare Act 2017 and NABH it is what proves a restrained patient had
    // their circulation checked and was offered fluids and toileting. Printing
    // rounds nobody performed, in a nurse's name, is fabricated evidence about
    // somebody who was tied to a bed.
    //
    // `restraint_monitoring_logs` is where the real rounds live. An empty list
    // prints as an empty list, which is the document saying nobody checked.
    let monitoring = sqlx::query_as!(
        RestraintMonitoringRow,
        "SELECT m.check_time AS \"check_time!\", u.full_name AS \"checked_by?\", \
                m.status::text AS \"status?\", m.circulation_status AS \"circulation_status?\", \
                m.skin_status AS \"skin_status?\", \
                m.patient_response AS \"patient_response?\", m.notes AS \"notes?\" \
           FROM restraint_monitoring_logs m \
           LEFT JOIN users u ON u.id = m.checked_by \
          WHERE m.clinical_doc_id = $1 AND m.tenant_id = $2 AND m.deleted_at IS NULL \
          ORDER BY m.check_time \
          LIMIT 200",
        restraint_doc_id,
        claims.tenant_id,
    )
    .fetch_all(&mut *conn)
    .await?
    .into_iter()
    .map(|row| RestraintMonitoring {
        datetime: row
            .check_time
            .with_timezone(&tz)
            .format("%d-%m-%Y %H:%M")
            .to_string(),
        nurse_name: row.checked_by.unwrap_or_else(|| "Not recorded".to_owned()),
        patient_condition: row
            .patient_response
            .or(row.status)
            .unwrap_or_else(|| "Not recorded".to_owned()),
        // Recorded as observations, not tick-boxes: "checked" is only true
        // when somebody wrote down what they saw.
        circulation_checked: row
            .circulation_status
            .as_deref()
            .is_some_and(|value| !value.trim().is_empty()),
        skin_checked: row
            .skin_status
            .as_deref()
            .is_some_and(|value| !value.trim().is_empty()),
        circulation_finding: row.circulation_status,
        skin_finding: row.skin_status,
        remarks: row.notes,
    })
    .collect::<Vec<_>>();

    Ok(Json(RestraintDocumentationPrintData {
        // ponytail: form number, device, planned duration, assessment, release
        // condition, family/rights/consent/psychiatrist/MHCA fields are not
        // recorded on the restraint episode yet; the struct's bools should be Options.
        form_number: String::new(),
        form_date: restraint
            .form_date
            .with_timezone(&tz)
            .format("%d-%m-%Y")
            .to_string(),
        patient_name: restraint.patient_name,
        uhid: restraint.uhid,
        ip_number: Some(restraint.ip_number),
        ward: restraint.ward,
        diagnosis: restraint.diagnosis,
        restraint_type: restraint.restraint_type,
        restraint_device: None,
        indication: restraint.indication,
        // Nothing records what was tried before the restraint, so nothing is
        // claimed. This was three hardcoded sentences asserting de-escalation,
        // environmental modification and PRN medication had all been offered —
        // which under the Mental Healthcare Act is the justification for the
        // restraint itself, printed without anyone having said it.
        alternatives_tried: Vec::new(),
        start_datetime: restraint
            .start_datetime
            .with_timezone(&tz)
            .format("%d-%m-%Y %H:%M")
            .to_string(),
        planned_duration: String::new(),
        actual_end_datetime: restraint
            .actual_end
            .map(|t| t.with_timezone(&tz).format("%d-%m-%Y %H:%M").to_string()),
        ordering_physician: restraint.ordering_physician.unwrap_or_default(),
        physician_assessment: String::new(),
        nursing_monitoring: monitoring,
        patient_condition_on_release: None,
        family_notified: None,
        family_notification_datetime: None,
        patient_rights_explained: None,
        consent_obtained: None,
        consent_from: None,
        review_by_psychiatrist: None,
        psychiatrist_name: None,
        mhca_compliance_verified: None,
        hospital_name: tenant.0,
    }))
}

/// Clinical print-data (discharge, wristband, ER, restraint, charts) routes.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route(
            "/api/print-data/wristband/{admission_id}",
            get(get_wristband_print_data),
        )
        .route(
            "/api/print-data/opd-certificate/{certificate_id}",
            get(get_opd_certificate_print_data),
        )
        .route(
            "/api/print-data/opd-consent/{consent_id}",
            get(get_opd_consent_print_data),
        )
        .route(
            "/api/print-data/appointment-slip/{appointment_id}",
            get(get_appointment_slip_print_data),
        )
        .route(
            "/api/print-data/death-certificate/{admission_id}",
            get(get_death_certificate_print_data),
        )
        .route(
            "/api/print-data/discharge/{admission_id}",
            get(get_discharge_print_data),
        )
        .route(
            "/api/print-data/token-slip/{token_id}",
            get(get_token_slip_print_data),
        )
        .route(
            "/api/print-data/visitor-pass/{pass_id}",
            get(get_visitor_pass_print_data),
        )
        .route(
            "/api/print-data/treatment-chart/{admission_id}",
            get(get_treatment_chart_print_data),
        )
        .route(
            "/api/print-data/transfer-summary/{transfer_log_id}",
            get(get_transfer_summary_print_data),
        )
        .route(
            "/api/print-data/registration-card/{patient_id}",
            get(get_registration_card_print_data),
        )
        .route(
            "/api/print-data/infant-wristband/{newborn_id}",
            get(get_infant_wristband_print_data),
        )
        .route(
            "/api/print-data/opd-prescription/{encounter_id}",
            get(get_opd_prescription_print_data),
        )
        .route(
            "/api/print-data/lab-report-full/{order_id}",
            get(get_lab_report_full_print_data),
        )
        .route(
            "/api/print-data/cumulative-lab-report/{patient_id}",
            get(get_cumulative_lab_report_print_data),
        )
        .route(
            "/api/print-data/radiology-report-full/{order_id}",
            get(get_radiology_report_full_print_data),
        )
        .route(
            "/api/print-data/ot-register/{ot_room_id}/{date}",
            get(get_ot_register_print_data),
        )
        .route(
            "/api/print-data/blood-donor-form/{donor_id}",
            get(get_blood_donor_form_print_data),
        )
        .route(
            "/api/print-data/cross-match-requisition/{crossmatch_request_id}",
            get(get_cross_match_requisition_print_data),
        )
        .route(
            "/api/print-data/dpdp-consent/{consent_id}",
            get(get_dpdp_consent_print_data),
        )
        .route(
            "/api/print-data/video-consent/{signature_id}",
            get(get_video_consent_print_data),
        )
        .route(
            "/api/print-data/restraint-documentation/{restraint_doc_id}",
            get(get_restraint_documentation_print_data),
        )
}
