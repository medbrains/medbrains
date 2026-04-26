#![allow(clippy::too_many_lines)]

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::Utc;
use medbrains_core::consent::{ConsentAuditEntry, ConsentSignatureMetadata, ConsentTemplate};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

// ══════════════════════════════════════════════════════════
//  Request / Query types
// ══════════════════════════════════════════════════════════

// ── Templates ─────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListTemplatesQuery {
    pub category: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTemplateRequest {
    pub code: String,
    pub name: String,
    pub category: Option<String>,
    pub version: Option<i32>,
    pub body_text: Option<serde_json::Value>,
    pub risks_section: Option<serde_json::Value>,
    pub alternatives_section: Option<serde_json::Value>,
    pub benefits_section: Option<serde_json::Value>,
    pub required_fields: Option<Vec<String>>,
    pub requires_witness: Option<bool>,
    pub requires_doctor: Option<bool>,
    pub validity_days: Option<i32>,
    pub applicable_departments: Option<Vec<Uuid>>,
    pub is_read_aloud_required: Option<bool>,
    pub is_active: Option<bool>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTemplateRequest {
    pub name: Option<String>,
    pub category: Option<String>,
    pub version: Option<i32>,
    pub body_text: Option<serde_json::Value>,
    pub risks_section: Option<serde_json::Value>,
    pub alternatives_section: Option<serde_json::Value>,
    pub benefits_section: Option<serde_json::Value>,
    pub required_fields: Option<Vec<String>>,
    pub requires_witness: Option<bool>,
    pub requires_doctor: Option<bool>,
    pub validity_days: Option<i32>,
    pub applicable_departments: Option<Vec<Uuid>>,
    pub is_read_aloud_required: Option<bool>,
    pub is_active: Option<bool>,
    pub sort_order: Option<i32>,
}

// ── Audit ─────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListAuditQuery {
    pub patient_id: Option<Uuid>,
    pub consent_source: Option<String>,
    pub action: Option<String>,
    pub from_date: Option<String>,
    pub to_date: Option<String>,
}

// ── Verification ──────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct VerifyConsentRequest {
    pub patient_id: Uuid,
    pub consent_type: Option<String>,
    pub procedure_type: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct VerifyConsentResponse {
    pub is_valid: bool,
    pub consent_id: Option<Uuid>,
    pub consent_source: Option<String>,
    pub expires_at: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ConsentSummaryItem {
    pub consent_type: String,
    pub source: String,
    pub status: String,
    pub consent_id: Uuid,
    pub valid_until: Option<String>,
}

// ── Revocation ────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct RevokeConsentRequest {
    pub consent_source: String,
    pub consent_id: Uuid,
    pub patient_id: Uuid,
    pub reason: Option<String>,
}

// ── Signatures ────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListSignaturesQuery {
    pub consent_source: Option<String>,
    pub consent_id: Option<Uuid>,
    pub patient_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateSignatureRequest {
    pub consent_source: String,
    pub consent_id: Uuid,
    pub signature_type: String,
    pub signature_image_url: Option<String>,
    pub video_consent_url: Option<String>,
    pub aadhaar_esign_ref: Option<String>,
    pub aadhaar_esign_timestamp: Option<String>,
    pub biometric_hash: Option<String>,
    pub biometric_device_id: Option<String>,
    pub witness_name: Option<String>,
    pub witness_designation: Option<String>,
    pub witness_signature_url: Option<String>,
    pub doctor_signature_url: Option<String>,
}

// ── Helper structs ────────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct PatientConsentRow {
    id: Uuid,
    consent_type: String,
    consent_status: String,
    valid_until: Option<chrono::NaiveDate>,
    revoked_at: Option<chrono::DateTime<Utc>>,
}

#[derive(Debug, sqlx::FromRow)]
struct ProcedureConsentRow {
    id: Uuid,
    consent_type: String,
    status: String,
    expires_at: Option<chrono::DateTime<Utc>>,
    withdrawn_at: Option<chrono::DateTime<Utc>>,
}

// ══════════════════════════════════════════════════════════
//  Handlers — Templates
// ══════════════════════════════════════════════════════════

pub async fn list_templates(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListTemplatesQuery>,
) -> Result<Json<Vec<ConsentTemplate>>, AppError> {
    require_permission(&claims, permissions::consent::templates::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, ConsentTemplate>(
        "SELECT * FROM consent_templates \
         WHERE ($1::text IS NULL OR category::text = $1) \
         AND ($2::bool IS NULL OR is_active = $2) \
         ORDER BY sort_order, name LIMIT 500",
    )
    .bind(&params.category)
    .bind(params.is_active)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn get_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<ConsentTemplate>, AppError> {
    require_permission(&claims, permissions::consent::templates::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, ConsentTemplate>("SELECT * FROM consent_templates WHERE id = $1")
        .bind(id)
        .fetch_one(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn create_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateTemplateRequest>,
) -> Result<Json<ConsentTemplate>, AppError> {
    require_permission(&claims, permissions::consent::templates::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, ConsentTemplate>(
        "INSERT INTO consent_templates \
         (tenant_id, code, name, category, version, body_text, \
          risks_section, alternatives_section, benefits_section, \
          required_fields, requires_witness, requires_doctor, \
          validity_days, applicable_departments, is_read_aloud_required, \
          is_active, sort_order, created_by) \
         VALUES ($1, $2, $3, COALESCE($4, 'general')::consent_template_category, \
                 COALESCE($5, 1), COALESCE($6, '{}'::jsonb), \
                 $7, $8, $9, COALESCE($10, '{}'), \
                 COALESCE($11, false), COALESCE($12, true), \
                 $13, $14, COALESCE($15, false), \
                 COALESCE($16, true), COALESCE($17, 0), $18) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.code)
    .bind(&body.name)
    .bind(&body.category)
    .bind(body.version)
    .bind(&body.body_text)
    .bind(&body.risks_section)
    .bind(&body.alternatives_section)
    .bind(&body.benefits_section)
    .bind(body.required_fields.as_deref().unwrap_or(&[]))
    .bind(body.requires_witness)
    .bind(body.requires_doctor)
    .bind(body.validity_days)
    .bind(&body.applicable_departments)
    .bind(body.is_read_aloud_required)
    .bind(body.is_active)
    .bind(body.sort_order)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateTemplateRequest>,
) -> Result<Json<ConsentTemplate>, AppError> {
    require_permission(&claims, permissions::consent::templates::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, ConsentTemplate>(
        "UPDATE consent_templates SET \
         name = COALESCE($2, name), \
         category = COALESCE($3::consent_template_category, category), \
         version = COALESCE($4, version), \
         body_text = COALESCE($5, body_text), \
         risks_section = COALESCE($6, risks_section), \
         alternatives_section = COALESCE($7, alternatives_section), \
         benefits_section = COALESCE($8, benefits_section), \
         required_fields = COALESCE($9, required_fields), \
         requires_witness = COALESCE($10, requires_witness), \
         requires_doctor = COALESCE($11, requires_doctor), \
         validity_days = COALESCE($12, validity_days), \
         applicable_departments = COALESCE($13, applicable_departments), \
         is_read_aloud_required = COALESCE($14, is_read_aloud_required), \
         is_active = COALESCE($15, is_active), \
         sort_order = COALESCE($16, sort_order) \
         WHERE id = $1 \
         RETURNING *",
    )
    .bind(id)
    .bind(&body.name)
    .bind(&body.category)
    .bind(body.version)
    .bind(&body.body_text)
    .bind(&body.risks_section)
    .bind(&body.alternatives_section)
    .bind(&body.benefits_section)
    .bind(&body.required_fields)
    .bind(body.requires_witness)
    .bind(body.requires_doctor)
    .bind(body.validity_days)
    .bind(&body.applicable_departments)
    .bind(body.is_read_aloud_required)
    .bind(body.is_active)
    .bind(body.sort_order)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn delete_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::consent::templates::DELETE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    sqlx::query("DELETE FROM consent_templates WHERE id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "deleted": true })))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Audit
// ══════════════════════════════════════════════════════════

pub async fn list_audit(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListAuditQuery>,
) -> Result<Json<Vec<ConsentAuditEntry>>, AppError> {
    require_permission(&claims, permissions::consent::audit::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, ConsentAuditEntry>(
        "SELECT * FROM consent_audit_log \
         WHERE ($1::uuid IS NULL OR patient_id = $1) \
         AND ($2::text IS NULL OR consent_source = $2) \
         AND ($3::text IS NULL OR action::text = $3) \
         AND ($4::text IS NULL OR created_at >= $4::timestamptz) \
         AND ($5::text IS NULL OR created_at <= $5::timestamptz) \
         ORDER BY created_at DESC LIMIT 500",
    )
    .bind(params.patient_id)
    .bind(&params.consent_source)
    .bind(&params.action)
    .bind(&params.from_date)
    .bind(&params.to_date)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn patient_audit(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Vec<ConsentAuditEntry>>, AppError> {
    require_permission(&claims, permissions::consent::audit::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, ConsentAuditEntry>(
        "SELECT * FROM consent_audit_log \
         WHERE patient_id = $1 \
         ORDER BY created_at DESC LIMIT 200",
    )
    .bind(patient_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Verification
// ══════════════════════════════════════════════════════════

pub async fn verify_consent(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<VerifyConsentRequest>,
) -> Result<Json<VerifyConsentResponse>, AppError> {
    require_permission(&claims, permissions::consent::VERIFY)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Check patient_consents first
    if let Some(consent_type) = &body.consent_type {
        let row = sqlx::query_as::<_, PatientConsentRow>(
            "SELECT id, consent_type::text as consent_type, \
                    consent_status::text as consent_status, \
                    valid_until, revoked_at \
             FROM patient_consents \
             WHERE patient_id = $1 \
             AND consent_type::text = $2 \
             AND consent_status::text = 'granted' \
             AND revoked_at IS NULL \
             AND (valid_until IS NULL OR valid_until >= CURRENT_DATE) \
             ORDER BY created_at DESC LIMIT 1",
        )
        .bind(body.patient_id)
        .bind(consent_type)
        .fetch_optional(&mut *tx)
        .await?;

        if let Some(r) = row {
            tx.commit().await?;
            return Ok(Json(VerifyConsentResponse {
                is_valid: true,
                consent_id: Some(r.id),
                consent_source: Some("patient_consent".to_owned()),
                expires_at: r.valid_until.map(|d| d.to_string()),
            }));
        }
    }

    // Check procedure_consents
    if let Some(procedure_type) = &body.procedure_type {
        let row = sqlx::query_as::<_, ProcedureConsentRow>(
            "SELECT id, consent_type, status, expires_at, withdrawn_at \
             FROM procedure_consents \
             WHERE patient_id = $1 \
             AND consent_type = $2 \
             AND status = 'signed' \
             AND withdrawn_at IS NULL \
             AND (expires_at IS NULL OR expires_at > now()) \
             ORDER BY created_at DESC LIMIT 1",
        )
        .bind(body.patient_id)
        .bind(procedure_type)
        .fetch_optional(&mut *tx)
        .await?;

        if let Some(r) = row {
            tx.commit().await?;
            return Ok(Json(VerifyConsentResponse {
                is_valid: true,
                consent_id: Some(r.id),
                consent_source: Some("procedure_consent".to_owned()),
                expires_at: r.expires_at.map(|d| d.to_rfc3339()),
            }));
        }
    }

    tx.commit().await?;
    Ok(Json(VerifyConsentResponse {
        is_valid: false,
        consent_id: None,
        consent_source: None,
        expires_at: None,
    }))
}

pub async fn patient_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Vec<ConsentSummaryItem>>, AppError> {
    require_permission(&claims, permissions::consent::VERIFY)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let mut items = Vec::new();

    // Patient consents
    let pc_rows = sqlx::query_as::<_, PatientConsentRow>(
        "SELECT id, consent_type::text as consent_type, \
                consent_status::text as consent_status, \
                valid_until, revoked_at \
         FROM patient_consents \
         WHERE patient_id = $1 \
         ORDER BY created_at DESC",
    )
    .bind(patient_id)
    .fetch_all(&mut *tx)
    .await?;

    for r in pc_rows {
        let status = if r.revoked_at.is_some() {
            "withdrawn".to_owned()
        } else if r.valid_until.is_some_and(|d| d < Utc::now().date_naive()) {
            "expired".to_owned()
        } else {
            r.consent_status.clone()
        };

        items.push(ConsentSummaryItem {
            consent_type: r.consent_type,
            source: "patient_consent".to_owned(),
            status,
            consent_id: r.id,
            valid_until: r.valid_until.map(|d| d.to_string()),
        });
    }

    // Procedure consents
    let proc_rows = sqlx::query_as::<_, ProcedureConsentRow>(
        "SELECT id, consent_type, status, expires_at, withdrawn_at \
         FROM procedure_consents \
         WHERE patient_id = $1 \
         ORDER BY created_at DESC",
    )
    .bind(patient_id)
    .fetch_all(&mut *tx)
    .await?;

    for r in proc_rows {
        let status = if r.withdrawn_at.is_some() {
            "withdrawn".to_owned()
        } else if r.expires_at.is_some_and(|d| d < Utc::now()) {
            "expired".to_owned()
        } else {
            r.status.clone()
        };

        items.push(ConsentSummaryItem {
            consent_type: r.consent_type,
            source: "procedure_consent".to_owned(),
            status,
            consent_id: r.id,
            valid_until: r.expires_at.map(|d| d.to_rfc3339()),
        });
    }

    tx.commit().await?;
    Ok(Json(items))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Revocation
// ══════════════════════════════════════════════════════════

pub async fn revoke_consent(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<RevokeConsentRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::consent::REVOKE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let now = Utc::now();
    let (old_status, new_status) = match body.consent_source.as_str() {
        "patient_consent" => {
            let old: String = sqlx::query_scalar(
                "SELECT consent_status::text FROM patient_consents WHERE id = $1",
            )
            .bind(body.consent_id)
            .fetch_one(&mut *tx)
            .await?;

            sqlx::query(
                "UPDATE patient_consents SET \
                 consent_status = 'withdrawn'::consent_status, \
                 revoked_at = $2, \
                 revoked_reason = $3 \
                 WHERE id = $1",
            )
            .bind(body.consent_id)
            .bind(now)
            .bind(&body.reason)
            .execute(&mut *tx)
            .await?;

            (old, "withdrawn".to_owned())
        }
        "procedure_consent" => {
            let old: String =
                sqlx::query_scalar("SELECT status FROM procedure_consents WHERE id = $1")
                    .bind(body.consent_id)
                    .fetch_one(&mut *tx)
                    .await?;

            sqlx::query(
                "UPDATE procedure_consents SET \
                 status = 'withdrawn', \
                 withdrawn_at = $2, \
                 withdrawal_reason = $3 \
                 WHERE id = $1",
            )
            .bind(body.consent_id)
            .bind(now)
            .bind(&body.reason)
            .execute(&mut *tx)
            .await?;

            (old, "withdrawn".to_owned())
        }
        _ => {
            return Err(AppError::BadRequest(
                "consent_source must be 'patient_consent' or 'procedure_consent'".into(),
            ));
        }
    };

    // Insert audit log
    sqlx::query(
        "INSERT INTO consent_audit_log \
         (tenant_id, patient_id, consent_source, consent_id, action, \
          old_status, new_status, changed_by, change_reason) \
         VALUES ($1, $2, $3, $4, 'revoked'::consent_audit_action, $5, $6, $7, $8)",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(&body.consent_source)
    .bind(body.consent_id)
    .bind(&old_status)
    .bind(&new_status)
    .bind(claims.sub)
    .bind(&body.reason)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "revoked": true })))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Signatures
// ══════════════════════════════════════════════════════════

pub async fn list_signatures(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListSignaturesQuery>,
) -> Result<Json<Vec<ConsentSignatureMetadata>>, AppError> {
    require_permission(&claims, permissions::consent::signatures::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, ConsentSignatureMetadata>(
        "SELECT * FROM consent_signature_metadata \
         WHERE ($1::text IS NULL OR consent_source = $1) \
         AND ($2::uuid IS NULL OR consent_id = $2) \
         ORDER BY created_at DESC LIMIT 200",
    )
    .bind(&params.consent_source)
    .bind(params.consent_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn get_signature(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<ConsentSignatureMetadata>, AppError> {
    require_permission(&claims, permissions::consent::signatures::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, ConsentSignatureMetadata>(
        "SELECT * FROM consent_signature_metadata WHERE id = $1",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn create_signature(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateSignatureRequest>,
) -> Result<Json<ConsentSignatureMetadata>, AppError> {
    require_permission(&claims, permissions::consent::signatures::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let aadhaar_ts = body
        .aadhaar_esign_timestamp
        .as_deref()
        .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
        .map(|dt| dt.with_timezone(&Utc));

    let row = sqlx::query_as::<_, ConsentSignatureMetadata>(
        "INSERT INTO consent_signature_metadata \
         (tenant_id, consent_source, consent_id, signature_type, \
          signature_image_url, video_consent_url, \
          aadhaar_esign_ref, aadhaar_esign_timestamp, \
          biometric_hash, biometric_device_id, \
          witness_name, witness_designation, \
          witness_signature_url, doctor_signature_url, \
          captured_by) \
         VALUES ($1, $2, $3, $4::signature_type, $5, $6, $7, $8, $9, $10, \
                 $11, $12, $13, $14, $15) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.consent_source)
    .bind(body.consent_id)
    .bind(&body.signature_type)
    .bind(&body.signature_image_url)
    .bind(&body.video_consent_url)
    .bind(&body.aadhaar_esign_ref)
    .bind(aadhaar_ts)
    .bind(&body.biometric_hash)
    .bind(&body.biometric_device_id)
    .bind(&body.witness_name)
    .bind(&body.witness_designation)
    .bind(&body.witness_signature_url)
    .bind(&body.doctor_signature_url)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn delete_signature(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::consent::signatures::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    sqlx::query("DELETE FROM consent_signature_metadata WHERE id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "deleted": true })))
}
