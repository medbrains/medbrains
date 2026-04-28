//! Digital signature endpoints.
//!
//! Per `RFCs/sprints/SPRINT-doctor-activities.md` §2.4. Two
//! representations: cryptographic Ed25519 over canonical JSON +
//! visual signature image stamped on PDFs.

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
    error::AppError,
    middleware::auth::Claims,
    middleware::authorization::require_permission,
    signing,
    state::AppState,
};

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

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

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
    .bind(priv_key.as_slice())
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
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

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
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

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

// ══════════════════════════════════════════════════════════
//  Sign action
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct SignRequest {
    pub record_type: String,
    pub record_id: Uuid,
    /// The canonical payload to sign. Server canonicalizes again
    /// (defense-in-depth — never trust client to canonicalize).
    pub payload: Value,
    pub signer_role: Option<String>,
    pub legal_class: Option<String>,
    pub credential_id: Option<Uuid>,
    pub notes: Option<String>,
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

pub async fn sign_record(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<SignRequest>,
) -> Result<Json<SignResponse>, AppError> {
    require_permission(&claims, permissions::doctor::signature::SIGN)?;

    let signer_role = body.signer_role.as_deref().unwrap_or("primary");
    if !matches!(signer_role, "primary" | "co_signer" | "attestor" | "witness") {
        return Err(AppError::BadRequest(format!(
            "invalid signer_role '{signer_role}'"
        )));
    }
    let legal_class = body.legal_class.as_deref().unwrap_or("clinical");
    if !matches!(
        legal_class,
        "administrative" | "clinical" | "medico_legal" | "statutory_export"
    ) {
        return Err(AppError::BadRequest(format!(
            "invalid legal_class '{legal_class}'"
        )));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Resolve credential — explicit id or doctor's default
    let cred_row: Option<(Uuid, Vec<u8>, Option<String>, String)> = if let Some(cid) = body.credential_id
    {
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

    let (cred_id, priv_key, display_image, display_font) = cred_row.ok_or_else(|| {
        AppError::BadRequest(
            "no active default signature credential for this user — admin must issue one".to_owned(),
        )
    })?;

    let priv_key = priv_key
        .as_slice()
        .try_into()
        .map_err(|_| AppError::Internal("invalid stored private key".to_owned()))
        .map(|arr: &[u8; 32]| arr.to_vec())?;

    let signed = signing::sign_payload(&priv_key, &body.payload)
        .map_err(|e| AppError::Internal(format!("sign: {e}")))?;

    // Build display block — what the PDF stamps on top of the signature image
    let display_block = format!(
        "Digitally signed by user {} on {} • Verify ref: {}",
        claims.sub,
        signed.hash.iter().take(4).fold(String::new(), |mut acc, b| {
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
            signer_credential_id, payload_hash, signature_bytes, \
            display_image_snapshot, display_block, legal_class, notes \
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) \
         RETURNING id, tenant_id, record_type, record_id, signer_user_id, \
                   signer_role, signer_credential_id, signed_at, \
                   payload_hash, signature_bytes, display_image_snapshot, \
                   display_block, legal_class, created_at",
    )
    .bind(claims.tenant_id)
    .bind(&body.record_type)
    .bind(body.record_id)
    .bind(claims.sub)
    .bind(signer_role)
    .bind(cred_id)
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
    let _ = mark_source_signed(&mut tx, &claims.tenant_id, &body.record_type, body.record_id, row.id).await;

    tx.commit().await?;

    let _ = display_font; // reserved for future text-rendered-block path

    let payload_hash_hex = signed.hash.iter().fold(String::new(), |mut acc, b| {
        use std::fmt::Write;
        let _ = write!(acc, "{b:02x}");
        acc
    });
    let signature_hex = signed.signature.iter().fold(String::new(), |mut acc, b| {
        use std::fmt::Write;
        let _ = write!(acc, "{b:02x}");
        acc
    });

    Ok(Json(SignResponse {
        signed_record: row,
        payload_hash_hex,
        signature_hex,
    }))
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
        "discharge_summary" => "discharge_summaries",
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
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, SignedRecord>(
        "SELECT id, tenant_id, record_type, record_id, signer_user_id, \
                signer_role, signer_credential_id, signed_at, \
                payload_hash, signature_bytes, display_image_snapshot, \
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
    /// Provide the original payload to recompute hash + verify
    pub payload: Value,
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

pub async fn verify_signature(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<VerifyRequest>,
) -> Result<Json<VerifyResponse>, AppError> {
    require_permission(&claims, permissions::doctor::signature::VERIFY)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row: (Vec<u8>, Vec<u8>, Option<Uuid>, Uuid, DateTime<Utc>) = sqlx::query_as(
        "SELECT payload_hash, signature_bytes, signer_credential_id, \
                signer_user_id, signed_at \
         FROM signed_records WHERE id = $1 AND tenant_id = $2",
    )
    .bind(body.signed_record_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let (stored_hash, signature_bytes, cred_id, signer_user_id, signed_at) = row;

    // Recompute hash from provided payload
    let canonical = signing::canonicalize(&body.payload)
        .map_err(|e| AppError::BadRequest(format!("canonicalize: {e}")))?;
    let recomputed = signing::payload_hash(&canonical);

    let recomputed_hex = recomputed.iter().fold(String::new(), |mut acc, b| {
        use std::fmt::Write;
        let _ = write!(acc, "{b:02x}");
        acc
    });
    let stored_hex = stored_hash.iter().fold(String::new(), |mut acc, b| {
        use std::fmt::Write;
        let _ = write!(acc, "{b:02x}");
        acc
    });

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

