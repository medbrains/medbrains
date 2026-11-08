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

use axum::extract::rejection::JsonRejection;
use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};
use medbrains_signing::signing;

use crate::signable;

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
    body: Result<Json<IssueCredentialRequest>, JsonRejection>,
) -> Result<Json<IssueCredentialResponse>, AppError> {
    require_permission(&claims, permissions::admin::signature_credentials::ISSUE)?;
    let Json(body) = body?;

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
    body: Result<Json<RevokeCredentialRequest>, JsonRejection>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::admin::signature_credentials::REVOKE)?;
    let Json(body) = body?;

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
         WHERE deleted_at IS NULL AND tenant_id = $1 \
           AND ($2::uuid IS NULL OR doctor_user_id = $2) \
           AND ($3::boolean OR revoked_at IS NULL) \
         ORDER BY created_at DESC LIMIT 5000",
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
    // A nurse signs nursing entries with her own key, so she lists it too.
    medbrains_kernel::require_any_permission(
        &claims,
        &[
            permissions::doctor::signature::SIGN,
            permissions::nurse::signature::SIGN,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let rows = sqlx::query_as::<_, SignatureCredentialPublic>(
        "SELECT id, tenant_id, doctor_user_id, credential_type, algorithm, \
                public_key, display_image_url, display_font, \
                valid_from, valid_until, revoked_at, revoked_reason, \
                is_default, created_at \
         FROM doctor_signature_credentials \
         WHERE deleted_at IS NULL AND tenant_id = $1 AND doctor_user_id = $2 \
           AND revoked_at IS NULL \
           AND (valid_until IS NULL OR valid_until > now()) \
         ORDER BY is_default DESC, created_at DESC LIMIT 5000",
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
    /// When the signer last opened this exact content to review it; `None`
    /// when they signed without the review screen (an older client).
    pub reviewed_at: Option<DateTime<Utc>>,
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

/// `POST /api/signatures/review` — the signer opens the record to sign it.
///
/// One call when the review screen opens: it returns the canonical snapshot
/// the signer reads and records that they opened it (`signature_reviews`),
/// so the signature can say when its signer last reviewed the record.
pub async fn review_record(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<SignPreviewRequest>,
) -> Result<Json<SignPreviewResponse>, AppError> {
    let spec = signable::find(&body.record_type)?;
    let signer_role = validate_signer_role(body.signer_role.as_deref())?;
    signable::require_sign_permission(&claims, spec, signer_role)?;
    let legal_class = validate_legal_class(body.legal_class.as_deref().or(Some(spec.legal_class)))?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    signable::require_signer_profile(&mut tx, &claims, spec, signer_role).await?;
    let payload_snapshot = signable::resolve_signable_payload(
        &mut tx,
        &claims.tenant_id,
        &claims.sub,
        signer_role,
        spec.record_type,
        body.record_id,
    )
    .await?;
    let canonical = signing::canonicalize(&payload_snapshot)
        .map_err(|e| AppError::BadRequest(format!("canonicalize: {e}")))?;
    let payload_hash = signing::payload_hash(&canonical);
    sqlx::query(
        "INSERT INTO signature_reviews (tenant_id, record_type, record_id, reviewer_id, payload_hash) \
         VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(claims.tenant_id)
    .bind(spec.record_type)
    .bind(body.record_id)
    .bind(claims.sub)
    .bind(payload_hash.as_slice())
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    Ok(Json(SignPreviewResponse {
        record_type: body.record_type,
        record_id: body.record_id,
        signer_role: signer_role.to_owned(),
        legal_class: legal_class.to_owned(),
        payload_snapshot,
        payload_hash_hex: to_hex(&payload_hash),
        generated_at: Utc::now(),
    }))
}

/// `POST /api/signatures/sign` — sign a record with the caller's key.
///
/// A signature is the doctor's word that they reviewed this record, so it
/// needs a fresh step-up (the password again, within five minutes), not only
/// a session: a session left open on a ward computer must not be able to
/// sign as its owner. The answer to a missing step-up is 403
/// `step_up_required`, which the web client turns into the password prompt
/// and a retry. The record's public verify link is minted in the same
/// transaction, so every signed print can carry its QR.
pub async fn sign_record(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    proof: medbrains_server_core::step_up::StepUpProof,
    Json(body): Json<SignRequest>,
) -> Result<Json<SignResponse>, AppError> {
    let spec = signable::find(&body.record_type)?;
    let signer_role = validate_signer_role(body.signer_role.as_deref())?;
    signable::require_sign_permission(&claims, spec, signer_role)?;
    medbrains_server_core::step_up::require_step_up(&state, &proof, &claims)?;

    let legal_class = validate_legal_class(body.legal_class.as_deref().or(Some(spec.legal_class)))?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    signable::require_signer_profile(&mut tx, &claims, spec, signer_role).await?;
    if signer_role == "primary" {
        signable::require_unsigned(&mut tx, &claims.tenant_id, spec, body.record_id).await?;
    }

    let payload_snapshot = signable::resolve_signable_payload(
        &mut tx,
        &claims.tenant_id,
        &claims.sub,
        signer_role,
        spec.record_type,
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
            display_image_snapshot, display_block, legal_class, notes, reviewed_at \
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, \
            (SELECT max(r.reviewed_at) FROM signature_reviews r \
              WHERE r.tenant_id = $1 AND r.record_type = $2 AND r.record_id = $3 \
                AND r.reviewer_id = $4 AND r.payload_hash = $8)) \
         RETURNING id, tenant_id, record_type, record_id, signer_user_id, \
                   signer_role, signer_credential_id, signed_at, payload_snapshot, \
                   payload_hash, signature_bytes, display_image_snapshot, \
                   display_block, legal_class, reviewed_at, created_at",
    )
    .bind(claims.tenant_id)
    .bind(spec.record_type)
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

    crate::signature_verify::issue_link_in_tx(&mut tx, &claims, row.id).await?;

    // Every signable table carries `is_signed` and `signed_record_id`. A
    // failure here aborts the transaction, so it is returned, never swallowed:
    // swallowed, the commit below would roll the signature back in silence.
    signable::mark_source_signed(&mut tx, &claims.tenant_id, spec, body.record_id, row.id).await?;

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
                display_block, legal_class, reviewed_at, created_at \
         FROM signed_records \
         WHERE deleted_at IS NULL AND tenant_id = $1 AND record_type = $2 AND record_id = $3 \
         ORDER BY signed_at LIMIT 5000",
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

/// Lower-case hex of `bytes`.
pub(crate) fn to_hex(bytes: &[u8]) -> String {
    bytes.iter().fold(String::new(), |mut acc, b| {
        use std::fmt::Write;
        let _ = write!(acc, "{b:02x}");
        acc
    })
}

async fn signature_key_encryption_key(state: &AppState) -> Result<Vec<u8>, AppError> {
    medbrains_core::secrets::sealing::sealing_key(
        state.secret_resolver.as_ref(),
        SIGNATURE_KEY_SECRET,
        DEV_SIGNATURE_KEY,
    )
    .await
    .map_err(AppError::from)
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
