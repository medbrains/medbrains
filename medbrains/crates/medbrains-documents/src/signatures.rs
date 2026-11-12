//! Digital signature endpoints.
//!
//! Per `RFCs/sprints/SPRINT-doctor-activities.md` §2.4. Two
//! representations: cryptographic Ed25519 over canonical JSON +
//! visual signature image stamped on PDFs.
//!
//! Stored Ed25519 private keys are AES-GCM wrapped before writing to
//! `doctor_signature_credentials.encrypted_private_key`. The secret is resolved
//! from `MEDBRAINS_SIGNATURE_KEY_ENCRYPTION_KEY`; only an unset key in
//! development falls back to the in-repo one (`secrets::sealing`).
//!
//! Before a key signs, it must unseal and derive the credential's stored
//! `public_key`; each signature is verified (`verify_strict`) before it is
//! written. A credential that fails either is refused and nothing is signed.
//! A plaintext key from before sealing (until May 2026) that passes the same
//! check is sealed in place the first time it signs.

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
/// the signer reads and records that they opened it (`signature_reviews`).
/// Signing needs this review, of the same content, within 30 minutes.
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
    let opened =
        signable::open_for_signing(&state, &mut tx, &claims, spec, signer_role, body.record_id)
            .await?;
    let (payload_snapshot, payload_hash) = (opened.payload, opened.hash);
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
    let opened =
        signable::open_for_signing(&state, &mut tx, &claims, spec, signer_role, body.record_id)
            .await?;
    if signer_role == "primary" && opened.already_signed {
        return Err(signable::already_signed(spec));
    }
    // The signer must have opened this exact content on the review screen.
    signable::require_reviewed(&mut tx, &claims, spec, body.record_id, &opened.hash).await?;
    let with = SignWith {
        signer_role,
        legal_class,
        credential_id: body.credential_id,
        notes: body.notes.as_deref(),
    };
    let (row, signed) = write_signature(
        &state,
        &mut tx,
        &claims,
        spec,
        body.record_id,
        &opened.payload,
        &with,
    )
    .await?;
    tx.commit().await?;

    let payload_hash_hex = to_hex(&signed.hash);
    let signature_hex = to_hex(&signed.signature);

    Ok(Json(SignResponse {
        signed_record: row,
        payload_hash_hex,
        signature_hex,
    }))
}

/// What the PDF stamps on top of the signature image.
fn display_block(claims: &Claims, hash: &[u8], cred_id: Uuid) -> String {
    let short = hash.iter().take(4).fold(String::new(), |mut acc, b| {
        use std::fmt::Write;
        let _ = write!(acc, "{b:02x}");
        acc
    });
    format!(
        "Digitally signed by user {} on {short} • Verify ref: {cred_id}",
        claims.sub
    )
}

/// How a signature is made, beyond the record it is over.
struct SignWith<'a> {
    signer_role: &'a str,
    legal_class: &'a str,
    /// The signer's credential; `None` for their default one.
    credential_id: Option<Uuid>,
    notes: Option<&'a str>,
}

/// Sign `payload_snapshot` (the opened record) with the signer's key, write
/// the `signed_records` row and its public verify link, and flag the source
/// row signed. The one writer of a signature, behind the sign endpoint's
/// review and step-up checks.
///
/// # Errors
/// `BadRequest` without an active credential and key; a database error.
async fn write_signature(
    state: &AppState,
    tx: &mut sqlx::PgConnection,
    claims: &Claims,
    spec: &signable::SignableType,
    record_id: Uuid,
    payload_snapshot: &Value,
    with: &SignWith<'_>,
) -> Result<(SignedRecord, signing::SignedPayload), AppError> {
    type CredentialRow = (Uuid, Option<Vec<u8>>, Option<String>, Vec<u8>);
    let cred_row: Option<CredentialRow> = if let Some(cid) = with.credential_id {
        sqlx::query_as(
            "SELECT id, encrypted_private_key, display_image_url, public_key \
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
            "SELECT id, encrypted_private_key, display_image_url, public_key \
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

    let (cred_id, priv_key_opt, display_image, stored_public) = cred_row.ok_or_else(|| {
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

    let key_encryption_key = signature_key_encryption_key(state).await?;
    let key_context = signature_key_context(&claims.tenant_id, &claims.sub);
    let unsealed = unseal_signing_key(
        &key_encryption_key,
        key_context.as_bytes(),
        &encrypted_priv_key,
        &stored_public,
        cred_id,
    )?;
    if unsealed.was_plaintext {
        let context = key_context.as_bytes();
        reseal_legacy_key(tx, &key_encryption_key, context, &unsealed.seed, cred_id).await?;
    }
    let signed = signing::sign_payload(&unsealed.seed, payload_snapshot)
        .map_err(|e| AppError::Internal(format!("sign: {e}")))?;
    check_signature(&stored_public, &signed, cred_id)?;

    let display_block = display_block(claims, &signed.hash, cred_id);

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
    .bind(record_id)
    .bind(claims.sub)
    .bind(with.signer_role)
    .bind(cred_id)
    .bind(payload_snapshot)
    .bind(signed.hash.as_slice())
    .bind(signed.signature.as_slice())
    .bind(display_image.as_deref())
    .bind(&display_block)
    .bind(with.legal_class)
    .bind(with.notes)
    .fetch_one(&mut *tx)
    .await?;

    crate::signature_verify::issue_link_in_tx(&mut *tx, claims, row.id).await?;

    // Every signable table carries `is_signed` and `signed_record_id`. A
    // failure here aborts the transaction, so it is returned, never swallowed:
    // swallowed, the commit below would roll the signature back in silence.
    signable::mark_source_signed(&mut *tx, &claims.tenant_id, spec, record_id, row.id).await?;

    Ok((row, signed))
}

// ══════════════════════════════════════════════════════════
//  List signatures for a record
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ListSignaturesQuery {
    pub record_type: String,
    pub record_id: Uuid,
}

/// `GET /api/signatures/list` — every signature on one record, oldest first, for
/// the verify panel.
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

/// The server key that seals doctors' signing keys, by the shared sealing rule.
async fn signature_key_encryption_key(state: &AppState) -> Result<Vec<u8>, AppError> {
    medbrains_core::secrets::sealing::sealing_key(
        state.secret_resolver.as_ref(),
        SIGNATURE_KEY_SECRET,
        DEV_SIGNATURE_KEY,
    )
    .await
    .map_err(AppError::from)
}

/// The AEAD context a doctor's key is sealed under: bound to tenant and doctor,
/// so a sealed key copied to another row will not open.
fn signature_key_context(tenant_id: &Uuid, doctor_user_id: &Uuid) -> String {
    format!("medbrains:doctor-signature-key:v1:{tenant_id}:{doctor_user_id}")
}

/// A credential's private key, unsealed and proven to be that credential's.
pub(crate) struct Unsealed {
    pub seed: Vec<u8>,
    /// Stored as plaintext before keys were sealed (until May 2026); the
    /// caller re-seals it.
    pub was_plaintext: bool,
}

/// Unseal a credential's private key and prove it is that credential's key:
/// the seed must be 32 bytes, not one repeated byte, and derive the stored
/// `public_key`. A 32-byte plaintext key from before keys were sealed is
/// accepted only under that same proof (it is then provably this
/// credential's key) and is flagged for re-sealing.
///
/// # Errors
/// 503 naming `MEDBRAINS_SIGNATURE_KEY_ENCRYPTION_KEY` when a sealed key will
/// not open (the server key changed: every credential is affected); 400 when
/// the key is not the credential's. Nothing is signed.
pub(crate) fn unseal_signing_key(
    key_encryption_key: &[u8],
    context: &[u8],
    encrypted_private_key: &[u8],
    stored_public: &[u8],
    credential_id: Uuid,
) -> Result<Unsealed, AppError> {
    let (seed, was_plaintext) = match medbrains_crypto::aead::decrypt_bytes(
        key_encryption_key,
        context,
        encrypted_private_key,
    ) {
        Ok(seed) => (seed, false),
        // A sealed key is always longer than 32 bytes (nonce and tag).
        Err(_) if encrypted_private_key.len() == 32 => (encrypted_private_key.to_vec(), true),
        Err(_) => {
            tracing::error!(credential_id = %credential_id, "doctor signature key will not unseal");
            return Err(AppError::ServiceUnavailable(format!(
                "signing is unavailable: the server's {SIGNATURE_KEY_SECRET} cannot open \
                     signature keys (it was changed or replaced). Ask your administrator to \
                     restore it from the backup of the server's settings; nothing was signed"
            )));
        }
    };
    medbrains_crypto::keys::ed25519_signing_key(&seed, stored_public, "signature key").map_err(
        |e| {
            tracing::error!(
                credential_id = %credential_id,
                public_key = %medbrains_crypto::keys::fingerprint(stored_public),
                error = %e,
                "doctor signature key refused"
            );
            AppError::BadRequest(
                "this signature credential has a damaged key; nothing was signed — ask an \
                 administrator to issue a new credential"
                    .to_owned(),
            )
        },
    )?;
    Ok(Unsealed {
        seed,
        was_plaintext,
    })
}

/// Seal a legacy plaintext key in place, once, now that it is proven to be
/// the credential's.
///
/// # Errors
/// 500 when it cannot be sealed; a database error.
async fn reseal_legacy_key(
    tx: &mut sqlx::PgConnection,
    key_encryption_key: &[u8],
    context: &[u8],
    seed: &[u8],
    credential_id: Uuid,
) -> Result<(), AppError> {
    let sealed = medbrains_crypto::aead::encrypt_bytes(key_encryption_key, context, seed)
        .map_err(|_| AppError::Internal("signature key encryption failed".to_owned()))?;
    sqlx::query("UPDATE doctor_signature_credentials SET encrypted_private_key = $1 WHERE id = $2")
        .bind(sealed.as_slice())
        .bind(credential_id)
        .execute(&mut *tx)
        .await?;
    tracing::warn!(credential_id = %credential_id, "legacy plaintext signature key sealed");
    Ok(())
}

/// Verify a signature just made against the credential's public key, before
/// it is written: a signature nobody can verify must never be stored.
///
/// # Errors
/// `Internal` when it does not verify.
fn check_signature(
    stored_public: &[u8],
    signed: &signing::SignedPayload,
    credential_id: Uuid,
) -> Result<(), AppError> {
    use medbrains_crypto::keys::{ed25519_public_key, verify_strict};
    ed25519_public_key(stored_public, "signature public key")
        .and_then(|key| verify_strict(&key, &signed.hash, &signed.signature, "signature"))
        .map_err(|e| {
            tracing::error!(credential_id = %credential_id, error = %e, "signature did not verify");
            AppError::Internal("the signature did not verify; nothing was signed".to_owned())
        })
}

#[cfg(test)]
#[path = "signatures_key_tests.rs"]
mod key_tests;
