//! Digital signature endpoints.
//!
//! Per `RFCs/sprints/SPRINT-doctor-activities.md` §2.4. Two
//! representations: cryptographic Ed25519 over canonical JSON +
//! visual signature image stamped on PDFs.
//!
//! Stored Ed25519 private keys are AES-GCM wrapped before writing to
//! `doctor_signature_credentials.encrypted_private_key`. The secret is resolved
//! from `MEDBRAINS_SIGNATURE_KEY_ENCRYPTION_KEY`; local dev falls back with a
//! warning so the app remains runnable.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    signing, state::AppState,
};

const SIGNATURE_KEY_SECRET: &str = "MEDBRAINS_SIGNATURE_KEY_ENCRYPTION_KEY";
const DEV_SIGNATURE_KEY: &[u8] = b"medbrains-dev-signature-key-encryption-rotate-before-production";

// ══════════════════════════════════════════════════════════
//  Credential management
// ══════════════════════════════════════════════════════════

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SignatureCredentialPublic {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub doctor_user_id: Uuid,
    pub credential_type: String,
    pub algorithm: String,
    pub public_key: Vec<u8>,
    pub display_image_url: Option<String>,
    pub display_font: Option<String>,
    pub valid_from: DateTime<Utc>,
    pub valid_until: Option<DateTime<Utc>>,
    pub revoked_at: Option<DateTime<Utc>>,
    pub revoked_reason: Option<String>,
    pub is_default: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct IssueCredentialRequest {
    pub doctor_user_id: Uuid,
    pub display_image_url: Option<String>,
    pub display_font: Option<String>,
    pub valid_until: Option<DateTime<Utc>>,
    /// If true, set this as the doctor's default credential
    /// (existing default is unset).
    #[serde(default)]
    pub make_default: bool,
}

#[derive(Debug, Serialize)]
pub struct IssueCredentialResponse {
    pub credential: SignatureCredentialPublic,
}

pub async fn issue_credential(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<IssueCredentialRequest>,
) -> Result<Json<IssueCredentialResponse>, AppError> {
    require_permission(&claims, permissions::admin::signature_credentials::ISSUE)?;

    let (priv_key, pub_key) =
        signing::generate_keypair().map_err(|e| AppError::Internal(format!("keygen: {e}")))?;
    let key_encryption_key = signature_key_encryption_key(&state).await?;
    let key_context = signature_key_context(&claims.tenant_id, &body.doctor_user_id);
    let encrypted_private_key = medbrains_crypto::aead::encrypt_bytes(
        &key_encryption_key,
        key_context.as_bytes(),
        priv_key.as_slice(),
    )
    .map_err(|_| AppError::Internal("signature key encryption failed".to_owned()))?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    if body.make_default {
        // Unset any existing default for this doctor
        let _ = sqlx::query(
            "UPDATE doctor_signature_credentials \
             SET is_default = FALSE \
             WHERE tenant_id = $1 AND doctor_user_id = $2 \
               AND is_default AND revoked_at IS NULL",
        )
        .bind(claims.tenant_id)
        .bind(body.doctor_user_id)
        .execute(&mut *tx)
        .await?;
    }

    let row = sqlx::query_as::<_, SignatureCredentialPublic>(
        "INSERT INTO doctor_signature_credentials ( \
            tenant_id, doctor_user_id, credential_type, algorithm, \
            public_key, encrypted_private_key, display_image_url, \
            display_font, valid_until, is_default, created_by \
         ) VALUES ($1,$2,'stored_key','Ed25519',$3,$4,$5,$6,$7,$8,$9) \
         RETURNING id, tenant_id, doctor_user_id, credential_type, algorithm, \
                   public_key, display_image_url, display_font, \
                   valid_from, valid_until, revoked_at, revoked_reason, \
                   is_default, created_at",
    )
    .bind(claims.tenant_id)
    .bind(body.doctor_user_id)
    .bind(pub_key.as_slice())
    .bind(encrypted_private_key.as_slice())
    .bind(&body.display_image_url)
    .bind(&body.display_font)
    .bind(body.valid_until)
    .bind(body.make_default)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(IssueCredentialResponse { credential: row }))
}

#[derive(Debug, Deserialize)]
pub struct RevokeCredentialRequest {
    pub reason: String,
}

pub async fn revoke_credential(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<RevokeCredentialRequest>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::admin::signature_credentials::REVOKE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let updated = sqlx::query(
        "UPDATE doctor_signature_credentials \
         SET revoked_at = now(), revoked_reason = $3, is_default = FALSE \
         WHERE id = $1 AND tenant_id = $2 AND revoked_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.reason)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    if updated.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(Json(json!({ "revoked": true })))
}

#[derive(Debug, Deserialize)]
pub struct ListCredentialsQuery {
    pub doctor_user_id: Option<Uuid>,
    pub include_revoked: Option<bool>,
}

pub async fn list_credentials(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListCredentialsQuery>,
) -> Result<Json<Vec<SignatureCredentialPublic>>, AppError> {
    require_permission(&claims, permissions::admin::signature_credentials::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let include_revoked = q.include_revoked.unwrap_or(false);

    let rows = sqlx::query_as::<_, SignatureCredentialPublic>(
        "SELECT id, tenant_id, doctor_user_id, credential_type, algorithm, \
                public_key, display_image_url, display_font, \
                valid_from, valid_until, revoked_at, revoked_reason, \
                is_default, created_at \
         FROM doctor_signature_credentials \
         WHERE tenant_id = $1 \
           AND ($2::uuid IS NULL OR doctor_user_id = $2) \
           AND ($3::boolean OR revoked_at IS NULL) \
         ORDER BY created_at DESC",
    )
    .bind(claims.tenant_id)
    .bind(q.doctor_user_id)
    .bind(include_revoked)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn list_my_credentials(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<SignatureCredentialPublic>>, AppError> {
    require_permission(&claims, permissions::doctor::signature::SIGN)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, SignatureCredentialPublic>(
        "SELECT id, tenant_id, doctor_user_id, credential_type, algorithm, \
                public_key, display_image_url, display_font, \
                valid_from, valid_until, revoked_at, revoked_reason, \
                is_default, created_at \
         FROM doctor_signature_credentials \
         WHERE tenant_id = $1 AND doctor_user_id = $2 \
           AND revoked_at IS NULL \
           AND (valid_until IS NULL OR valid_until > now()) \
         ORDER BY is_default DESC, created_at DESC",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Sign action
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct SignRequest {
    pub record_type: String,
    pub record_id: Uuid,
    /// Deprecated. The server resolves the canonical payload from the source
    /// record so the client cannot accidentally or deliberately sign a
    /// placeholder. Accepted only for backward-compatible clients.
    pub payload: Option<Value>,
    pub signer_role: Option<String>,
    pub legal_class: Option<String>,
    pub credential_id: Option<Uuid>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SignPreviewRequest {
    pub record_type: String,
    pub record_id: Uuid,
    pub signer_role: Option<String>,
    pub legal_class: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SignPreviewResponse {
    pub record_type: String,
    pub record_id: Uuid,
    pub signer_role: String,
    pub legal_class: String,
    pub payload_snapshot: Value,
    pub payload_hash_hex: String,
    pub generated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SignedRecord {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub record_type: String,
    pub record_id: Uuid,
    pub signer_user_id: Uuid,
    pub signer_role: String,
    pub signer_credential_id: Option<Uuid>,
    pub signed_at: DateTime<Utc>,
    pub payload_snapshot: Option<Value>,
    pub payload_hash: Vec<u8>,
    pub signature_bytes: Vec<u8>,
    pub display_image_snapshot: Option<String>,
    pub display_block: Option<String>,
    pub legal_class: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct SignResponse {
    pub signed_record: SignedRecord,
    /// Hex-encoded payload_hash for client display + audit.
    pub payload_hash_hex: String,
    /// Hex-encoded signature for client display.
    pub signature_hex: String,
}

pub async fn preview_sign_record_get(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(body): Query<SignPreviewRequest>,
) -> Result<Json<SignPreviewResponse>, AppError> {
    Ok(Json(build_sign_preview(&state, &claims, body).await?))
}

async fn build_sign_preview(
    state: &AppState,
    claims: &Claims,
    body: SignPreviewRequest,
) -> Result<SignPreviewResponse, AppError> {
    let signer_role = validate_signer_role(body.signer_role.as_deref())?;
    require_sign_permission(claims, signer_role)?;

    let legal_class = validate_legal_class(body.legal_class.as_deref())?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let payload_snapshot = resolve_signable_payload(
        &mut tx,
        &claims.tenant_id,
        &claims.sub,
        signer_role,
        &body.record_type,
        body.record_id,
    )
    .await?;

    let canonical = signing::canonicalize(&payload_snapshot)
        .map_err(|e| AppError::BadRequest(format!("canonicalize: {e}")))?;
    let payload_hash = signing::payload_hash(&canonical);
    tx.commit().await?;

    Ok(SignPreviewResponse {
        record_type: body.record_type,
        record_id: body.record_id,
        signer_role: signer_role.to_owned(),
        legal_class: legal_class.to_owned(),
        payload_snapshot,
        payload_hash_hex: to_hex(&payload_hash),
        generated_at: Utc::now(),
    })
}

pub async fn sign_record(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<SignRequest>,
) -> Result<Json<SignResponse>, AppError> {
    let signer_role = validate_signer_role(body.signer_role.as_deref())?;
    require_sign_permission(&claims, signer_role)?;

    let legal_class = validate_legal_class(body.legal_class.as_deref())?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let payload_snapshot = resolve_signable_payload(
        &mut tx,
        &claims.tenant_id,
        &claims.sub,
        signer_role,
        &body.record_type,
        body.record_id,
    )
    .await?;

    // Resolve credential — explicit id or doctor's default
    type CredentialRow = (Uuid, Option<Vec<u8>>, Option<String>, Option<String>);
    let cred_row: Option<CredentialRow> = if let Some(cid) = body.credential_id {
        sqlx::query_as(
            "SELECT id, encrypted_private_key, display_image_url, display_font \
             FROM doctor_signature_credentials \
             WHERE id = $1 AND tenant_id = $2 \
               AND doctor_user_id = $3 AND revoked_at IS NULL \
               AND (valid_until IS NULL OR valid_until > now())",
        )
        .bind(cid)
        .bind(claims.tenant_id)
        .bind(claims.sub)
        .fetch_optional(&mut *tx)
        .await?
    } else {
        sqlx::query_as(
            "SELECT id, encrypted_private_key, display_image_url, display_font \
             FROM doctor_signature_credentials \
             WHERE tenant_id = $1 AND doctor_user_id = $2 \
               AND is_default AND revoked_at IS NULL \
               AND (valid_until IS NULL OR valid_until > now())",
        )
        .bind(claims.tenant_id)
        .bind(claims.sub)
        .fetch_optional(&mut *tx)
        .await?
    };

    let (cred_id, priv_key_opt, display_image, display_font) = cred_row.ok_or_else(|| {
        AppError::BadRequest(
            "no active default signature credential for this user — admin must issue one"
                .to_owned(),
        )
    })?;

    let encrypted_priv_key = priv_key_opt.ok_or_else(|| {
        AppError::BadRequest(
            "credential has no stored private key — issue a new credential".to_owned(),
        )
    })?;

    let key_encryption_key = signature_key_encryption_key(&state).await?;
    let key_context = signature_key_context(&claims.tenant_id, &claims.sub);
    let priv_key_bytes = decrypt_signature_private_key(
        &key_encryption_key,
        key_context.as_bytes(),
        &encrypted_priv_key,
        cred_id,
    )?;

    let priv_key = priv_key_bytes
        .as_slice()
        .try_into()
        .map_err(|_| AppError::Internal("invalid stored private key".to_owned()))
        .map(|arr: &[u8; 32]| arr.to_vec())?;

    let signed = signing::sign_payload(&priv_key, &payload_snapshot)
        .map_err(|e| AppError::Internal(format!("sign: {e}")))?;

    // Build display block — what the PDF stamps on top of the signature image
    let display_block = format!(
        "Digitally signed by user {} on {} • Verify ref: {}",
        claims.sub,
        signed
            .hash
            .iter()
            .take(4)
            .fold(String::new(), |mut acc, b| {
                use std::fmt::Write;
                let _ = write!(acc, "{b:02x}");
                acc
            }),
        cred_id,
    );

    // Insert signed_records row
    let row = sqlx::query_as::<_, SignedRecord>(
        "INSERT INTO signed_records ( \
            tenant_id, record_type, record_id, signer_user_id, signer_role, \
            signer_credential_id, payload_snapshot, payload_hash, signature_bytes, \
            display_image_snapshot, display_block, legal_class, notes \
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) \
         RETURNING id, tenant_id, record_type, record_id, signer_user_id, \
                   signer_role, signer_credential_id, signed_at, payload_snapshot, \
                   payload_hash, signature_bytes, display_image_snapshot, \
                   display_block, legal_class, created_at",
    )
    .bind(claims.tenant_id)
    .bind(&body.record_type)
    .bind(body.record_id)
    .bind(claims.sub)
    .bind(signer_role)
    .bind(cred_id)
    .bind(&payload_snapshot)
    .bind(signed.hash.as_slice())
    .bind(signed.signature.as_slice())
    .bind(display_image.as_deref())
    .bind(&display_block)
    .bind(legal_class)
    .bind(body.notes.as_deref())
    .fetch_one(&mut *tx)
    .await?;

    // Best-effort flag update on source record. Different tables have
    // different shapes — only update is_signed where the column exists.
    let _ = mark_source_signed(
        &mut tx,
        &claims.tenant_id,
        &body.record_type,
        body.record_id,
        row.id,
    )
    .await;

    tx.commit().await?;

    let _ = display_font; // reserved for future text-rendered-block path

    let payload_hash_hex = to_hex(&signed.hash);
    let signature_hex = to_hex(&signed.signature);

    Ok(Json(SignResponse {
        signed_record: row,
        payload_hash_hex,
        signature_hex,
    }))
}

async fn resolve_signable_payload(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    signer_user_id: &Uuid,
    signer_role: &str,
    record_type: &str,
    record_id: Uuid,
) -> Result<Value, AppError> {
    let payload = match record_type {
        "prescription" => {
            sqlx::query_scalar::<_, Value>(
                "SELECT jsonb_build_object( \
                'schema', 'medbrains.signable.prescription.v1', \
                'record_type', 'prescription', \
                'record_id', p.id, \
                'tenant_id', p.tenant_id, \
                'encounter_id', p.encounter_id, \
                'encounter', jsonb_build_object( \
                    'id', e.id, \
                    'patient_id', e.patient_id, \
                    'encounter_type', e.encounter_type, \
                    'status', e.status, \
                    'department_id', e.department_id, \
                    'doctor_id', e.doctor_id, \
                    'encounter_date', e.encounter_date, \
                    'visit_type', e.visit_type \
                ), \
                'patient_id', COALESCE(p.patient_id, e.patient_id), \
                'patient', CASE WHEN pat.id IS NULL THEN NULL ELSE jsonb_build_object( \
                    'id', pat.id, \
                    'uhid', pat.uhid, \
                    'abha_id', pat.abha_id, \
                    'name', CONCAT_WS(' ', NULLIF(pat.prefix, ''), pat.first_name, NULLIF(pat.middle_name, ''), pat.last_name), \
                    'gender', pat.gender, \
                    'date_of_birth', pat.date_of_birth, \
                    'phone', pat.phone, \
                    'category', pat.category, \
                    'is_medico_legal', pat.is_medico_legal \
                ) END, \
                'doctor_id', p.doctor_id, \
                'notes', p.notes, \
                'created_at', p.created_at, \
                'updated_at', p.updated_at, \
                'items', COALESCE(( \
                    SELECT jsonb_agg(jsonb_build_object( \
                        'id', pi.id, \
                        'drug_name', pi.drug_name, \
                        'dosage', pi.dosage, \
                        'frequency', pi.frequency, \
                        'duration', pi.duration, \
                        'route', pi.route, \
                        'instructions', pi.instructions, \
                        'item_status', pi.item_status, \
                        'catalog_item_id', pi.catalog_item_id, \
                        'created_at', pi.created_at \
                    ) ORDER BY pi.created_at, pi.id) \
                    FROM prescription_items pi \
                    WHERE pi.tenant_id = p.tenant_id AND pi.prescription_id = p.id \
                ), '[]'::jsonb) \
            ) \
            FROM prescriptions p \
            LEFT JOIN encounters e ON e.tenant_id = p.tenant_id AND e.id = p.encounter_id \
            LEFT JOIN patients pat ON pat.tenant_id = p.tenant_id \
                AND pat.id = COALESCE(p.patient_id, e.patient_id) \
            WHERE p.tenant_id = $1 AND p.id = $2 \
              AND ($3 <> 'primary' OR p.doctor_id = $4)",
            )
            .bind(tenant_id)
            .bind(record_id)
            .bind(signer_role)
            .bind(signer_user_id)
            .fetch_optional(&mut **tx)
            .await?
        }
        "lab_report" => {
            sqlx::query_scalar::<_, Value>(
                "SELECT jsonb_build_object( \
                'schema', 'medbrains.signable.lab_result.v1', \
                'record_type', 'lab_report', \
                'record_id', lr.id, \
                'tenant_id', lr.tenant_id, \
                'order_id', lr.order_id, \
                'order', jsonb_build_object( \
                    'id', lo.id, \
                    'encounter_id', lo.encounter_id, \
                    'patient_id', lo.patient_id, \
                    'test_id', lo.test_id, \
                    'priority', lo.priority, \
                    'status', lo.status, \
                    'sample_barcode', lo.sample_barcode, \
                    'is_stat', lo.is_stat, \
                    'camp_id', lo.camp_id, \
                    'department_id', lo.department_id \
                ), \
                'patient', jsonb_build_object( \
                    'id', pat.id, \
                    'uhid', pat.uhid, \
                    'abha_id', pat.abha_id, \
                    'name', CONCAT_WS(' ', NULLIF(pat.prefix, ''), pat.first_name, NULLIF(pat.middle_name, ''), pat.last_name), \
                    'gender', pat.gender, \
                    'date_of_birth', pat.date_of_birth, \
                    'phone', pat.phone, \
                    'category', pat.category, \
                    'is_medico_legal', pat.is_medico_legal \
                ), \
                'parameter_name', lr.parameter_name, \
                'value', lr.value, \
                'numeric_value', lr.numeric_value, \
                'unit', lr.unit, \
                'normal_range', lr.normal_range, \
                'flag', lr.flag, \
                'notes', lr.notes, \
                'is_auto_validated', lr.is_auto_validated, \
                'entered_by', lr.entered_by, \
                'created_at', lr.created_at, \
                'updated_at', lr.updated_at \
            ) \
            FROM lab_results lr \
            JOIN lab_orders lo ON lo.tenant_id = lr.tenant_id AND lo.id = lr.order_id \
            JOIN patients pat ON pat.tenant_id = lo.tenant_id AND pat.id = lo.patient_id \
            WHERE lr.tenant_id = $1 AND lr.id = $2",
            )
            .bind(tenant_id)
            .bind(record_id)
            .fetch_optional(&mut **tx)
            .await?
        }
        "radiology_report" => {
            sqlx::query_scalar::<_, Value>(
                "SELECT jsonb_build_object( \
                'schema', 'medbrains.signable.radiology_report.v1', \
                'record_type', 'radiology_report', \
                'record_id', rr.id, \
                'tenant_id', rr.tenant_id, \
                'order_id', rr.order_id, \
                'order', jsonb_build_object( \
                    'id', ro.id, \
                    'patient_id', ro.patient_id, \
                    'encounter_id', ro.encounter_id, \
                    'modality_id', ro.modality_id, \
                    'body_part', ro.body_part, \
                    'clinical_indication', ro.clinical_indication, \
                    'priority', ro.priority, \
                    'status', ro.status, \
                    'contrast_required', ro.contrast_required, \
                    'pregnancy_checked', ro.pregnancy_checked, \
                    'allergy_flagged', ro.allergy_flagged, \
                    'pacs_study_uid', ro.pacs_study_uid \
                ), \
                'patient', jsonb_build_object( \
                    'id', pat.id, \
                    'uhid', pat.uhid, \
                    'abha_id', pat.abha_id, \
                    'name', CONCAT_WS(' ', NULLIF(pat.prefix, ''), pat.first_name, NULLIF(pat.middle_name, ''), pat.last_name), \
                    'gender', pat.gender, \
                    'date_of_birth', pat.date_of_birth, \
                    'phone', pat.phone, \
                    'category', pat.category, \
                    'is_medico_legal', pat.is_medico_legal \
                ), \
                'reported_by', rr.reported_by, \
                'verified_by', rr.verified_by, \
                'status', rr.status, \
                'findings', rr.findings, \
                'impression', rr.impression, \
                'recommendations', rr.recommendations, \
                'is_critical', rr.is_critical, \
                'template_name', rr.template_name, \
                'verified_at', rr.verified_at, \
                'created_at', rr.created_at, \
                'updated_at', rr.updated_at \
            ) \
            FROM radiology_reports rr \
            JOIN radiology_orders ro ON ro.tenant_id = rr.tenant_id AND ro.id = rr.order_id \
            JOIN patients pat ON pat.tenant_id = ro.tenant_id AND pat.id = ro.patient_id \
            WHERE rr.tenant_id = $1 AND rr.id = $2",
            )
            .bind(tenant_id)
            .bind(record_id)
            .fetch_optional(&mut **tx)
            .await?
        }
        "discharge_summary" => {
            sqlx::query_scalar::<_, Value>(
                "SELECT jsonb_build_object( \
                'schema', 'medbrains.signable.ipd_discharge_summary.v1', \
                'record_type', 'discharge_summary', \
                'record_id', ds.id, \
                'tenant_id', ds.tenant_id, \
                'admission_id', ds.admission_id, \
                'admission', jsonb_build_object( \
                    'id', a.id, \
                    'encounter_id', a.encounter_id, \
                    'patient_id', a.patient_id, \
                    'admitting_doctor', a.admitting_doctor, \
                    'status', a.status, \
                    'admitted_at', a.admitted_at, \
                    'discharged_at', a.discharged_at, \
                    'ward_id', a.ward_id, \
                    'bed_id', a.bed_id, \
                    'ip_type', a.ip_type, \
                    'is_critical', a.is_critical, \
                    'isolation_required', a.isolation_required \
                ), \
                'patient', jsonb_build_object( \
                    'id', pat.id, \
                    'uhid', pat.uhid, \
                    'abha_id', pat.abha_id, \
                    'name', CONCAT_WS(' ', NULLIF(pat.prefix, ''), pat.first_name, NULLIF(pat.middle_name, ''), pat.last_name), \
                    'gender', pat.gender, \
                    'date_of_birth', pat.date_of_birth, \
                    'phone', pat.phone, \
                    'category', pat.category, \
                    'is_medico_legal', pat.is_medico_legal \
                ), \
                'template_id', ds.template_id, \
                'status', ds.status, \
                'final_diagnosis', ds.final_diagnosis, \
                'condition_at_discharge', ds.condition_at_discharge, \
                'course_in_hospital', ds.course_in_hospital, \
                'treatment_given', ds.treatment_given, \
                'procedures_performed', ds.procedures_performed, \
                'investigation_summary', ds.investigation_summary, \
                'medications_on_discharge', ds.medications_on_discharge, \
                'follow_up_instructions', ds.follow_up_instructions, \
                'follow_up_date', ds.follow_up_date, \
                'dietary_advice', ds.dietary_advice, \
                'activity_restrictions', ds.activity_restrictions, \
                'warning_signs', ds.warning_signs, \
                'emergency_contact_info', ds.emergency_contact_info, \
                'prepared_by', ds.prepared_by, \
                'verified_by', ds.verified_by, \
                'finalized_at', ds.finalized_at, \
                'created_at', ds.created_at, \
                'updated_at', ds.updated_at \
            ) \
            FROM ipd_discharge_summaries ds \
            JOIN admissions a ON a.tenant_id = ds.tenant_id AND a.id = ds.admission_id \
            JOIN patients pat ON pat.tenant_id = a.tenant_id AND pat.id = a.patient_id \
            WHERE ds.tenant_id = $1 AND ds.id = $2 \
              AND ($3 <> 'primary' OR ds.prepared_by = $4 OR ds.verified_by = $4)",
            )
            .bind(tenant_id)
            .bind(record_id)
            .bind(signer_role)
            .bind(signer_user_id)
            .fetch_optional(&mut **tx)
            .await?
        }
        _ => {
            return Err(AppError::BadRequest(format!(
                "record_type '{record_type}' is not signable"
            )));
        }
    };

    payload.ok_or(AppError::NotFound)
}

async fn mark_source_signed(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    record_type: &str,
    record_id: Uuid,
    signed_record_id: Uuid,
) -> Result<(), AppError> {
    // Map record_type → table name. Missing table or column = no-op.
    let table = match record_type {
        "prescription" => "prescriptions",
        "lab_report" => "lab_results",
        "radiology_report" => "radiology_reports",
        "discharge_summary" => "ipd_discharge_summaries",
        _ => return Ok(()),
    };
    // Use dynamic SQL — schema is fixed so this is safe.
    let sql = format!(
        "UPDATE {table} SET is_signed = TRUE, signed_record_id = $1 \
         WHERE id = $2 AND tenant_id = $3"
    );
    let _ = sqlx::query(&sql)
        .bind(signed_record_id)
        .bind(record_id)
        .bind(tenant_id)
        .execute(&mut **tx)
        .await;
    Ok(())
}

// ══════════════════════════════════════════════════════════
//  List signatures for a record
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ListSignaturesQuery {
    pub record_type: String,
    pub record_id: Uuid,
}

pub async fn list_signatures(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListSignaturesQuery>,
) -> Result<Json<Vec<SignedRecord>>, AppError> {
    require_permission(&claims, permissions::doctor::signature::VERIFY)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, SignedRecord>(
        "SELECT id, tenant_id, record_type, record_id, signer_user_id, \
                signer_role, signer_credential_id, signed_at, \
                payload_snapshot, payload_hash, signature_bytes, display_image_snapshot, \
                display_block, legal_class, created_at \
         FROM signed_records \
         WHERE tenant_id = $1 AND record_type = $2 AND record_id = $3 \
         ORDER BY signed_at",
    )
    .bind(claims.tenant_id)
    .bind(&q.record_type)
    .bind(q.record_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Verify signature (cryptographic)
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct VerifyRequest {
    pub signed_record_id: Uuid,
    /// Optional legacy override. When omitted, verification uses the stored
    /// payload snapshot captured at signing time.
    pub payload: Option<Value>,
}

#[derive(Debug, Serialize)]
pub struct VerifyResponse {
    pub verified: bool,
    pub recomputed_hash_hex: String,
    pub stored_hash_hex: String,
    pub signer_user_id: Uuid,
    pub signed_at: DateTime<Utc>,
    pub credential_revoked: bool,
}

type SignatureVerificationRow = (
    Vec<u8>,
    Vec<u8>,
    Option<Value>,
    Option<Uuid>,
    Uuid,
    DateTime<Utc>,
);

pub async fn verify_signature(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<VerifyRequest>,
) -> Result<Json<VerifyResponse>, AppError> {
    require_permission(&claims, permissions::doctor::signature::VERIFY)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row: SignatureVerificationRow = sqlx::query_as(
        "SELECT payload_hash, signature_bytes, payload_snapshot, signer_credential_id, \
                signer_user_id, signed_at \
         FROM signed_records WHERE id = $1 AND tenant_id = $2",
    )
    .bind(body.signed_record_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let (stored_hash, signature_bytes, payload_snapshot, cred_id, signer_user_id, signed_at) = row;
    let payload = body.payload.or(payload_snapshot).ok_or_else(|| {
        AppError::BadRequest(
            "signature has no stored payload snapshot; provide payload for legacy verification"
                .to_owned(),
        )
    })?;

    // Recompute hash from the stored signing payload by default.
    let canonical = signing::canonicalize(&payload)
        .map_err(|e| AppError::BadRequest(format!("canonicalize: {e}")))?;
    let recomputed = signing::payload_hash(&canonical);

    let recomputed_hex = to_hex(&recomputed);
    let stored_hex = to_hex(&stored_hash);

    let mut verified = recomputed.as_slice() == stored_hash.as_slice();
    let mut credential_revoked = false;

    if verified {
        if let Some(cid) = cred_id {
            let pk_row: Option<(Vec<u8>, Option<DateTime<Utc>>)> = sqlx::query_as(
                "SELECT public_key, revoked_at FROM doctor_signature_credentials \
                 WHERE id = $1 AND tenant_id = $2",
            )
            .bind(cid)
            .bind(claims.tenant_id)
            .fetch_optional(&mut *tx)
            .await?;
            if let Some((pk, revoked)) = pk_row {
                if revoked.is_some() {
                    credential_revoked = true;
                }
                if signing::verify(&pk, &recomputed, &signature_bytes).is_err() {
                    verified = false;
                }
            } else {
                verified = false;
            }
        } else {
            verified = false;
        }
    }

    tx.commit().await?;

    Ok(Json(VerifyResponse {
        verified,
        recomputed_hash_hex: recomputed_hex,
        stored_hash_hex: stored_hex,
        signer_user_id,
        signed_at,
        credential_revoked,
    }))
}

fn validate_signer_role(role: Option<&str>) -> Result<&str, AppError> {
    let signer_role = role.unwrap_or("primary");
    if matches!(
        signer_role,
        "primary" | "co_signer" | "attestor" | "witness"
    ) {
        Ok(signer_role)
    } else {
        Err(AppError::BadRequest(format!(
            "invalid signer_role '{signer_role}'"
        )))
    }
}

fn validate_legal_class(class: Option<&str>) -> Result<&str, AppError> {
    let legal_class = class.unwrap_or("clinical");
    if matches!(
        legal_class,
        "administrative" | "clinical" | "medico_legal" | "statutory_export"
    ) {
        Ok(legal_class)
    } else {
        Err(AppError::BadRequest(format!(
            "invalid legal_class '{legal_class}'"
        )))
    }
}

fn require_sign_permission(claims: &Claims, signer_role: &str) -> Result<(), AppError> {
    if signer_role == "primary" {
        require_permission(claims, permissions::doctor::signature::SIGN)
    } else {
        require_permission(claims, permissions::doctor::signature::CO_SIGN)
    }
}

fn to_hex(bytes: &[u8]) -> String {
    bytes.iter().fold(String::new(), |mut acc, b| {
        use std::fmt::Write;
        let _ = write!(acc, "{b:02x}");
        acc
    })
}

async fn signature_key_encryption_key(state: &AppState) -> Result<Vec<u8>, AppError> {
    match state.secret_resolver.get(SIGNATURE_KEY_SECRET).await {
        Ok(value) if value.len() >= 32 => Ok(value.into_bytes()),
        Ok(_) => Err(AppError::Internal(format!(
            "{SIGNATURE_KEY_SECRET} must be at least 32 bytes"
        ))),
        Err(_) => {
            tracing::warn!(
                "{SIGNATURE_KEY_SECRET} missing; using dev-only signature key wrapper. \
                 Set this before production so doctor signing keys are encrypted with hospital-held material."
            );
            Ok(DEV_SIGNATURE_KEY.to_vec())
        }
    }
}

fn signature_key_context(tenant_id: &Uuid, doctor_user_id: &Uuid) -> String {
    format!("medbrains:doctor-signature-key:v1:{tenant_id}:{doctor_user_id}")
}

fn decrypt_signature_private_key(
    key_encryption_key: &[u8],
    context: &[u8],
    encrypted_private_key: &[u8],
    credential_id: Uuid,
) -> Result<Vec<u8>, AppError> {
    match medbrains_crypto::aead::decrypt_bytes(key_encryption_key, context, encrypted_private_key)
    {
        Ok(private_key) => Ok(private_key),
        Err(_) if encrypted_private_key.len() == 32 => {
            tracing::warn!(
                credential_id = %credential_id,
                "using legacy plaintext doctor signature credential; rotate this credential"
            );
            Ok(encrypted_private_key.to_vec())
        }
        Err(_) => Err(AppError::Internal(
            "signature credential private key decrypt failed; rotate credential".to_owned(),
        )),
    }
}
