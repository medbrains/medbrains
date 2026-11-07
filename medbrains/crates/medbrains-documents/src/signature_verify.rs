//! The public check of a signed document: what the QR on a signed print opens.
//!
//! # Who it is for
//!
//! A TPA officer settling a claim, a court clerk, a doctor at another
//! hospital. None of them is a user of this system, and each holds a paper
//! that says a doctor signed it. They need to know that the doctor really
//! did, that the doctor's key is still good, and that the record has not
//! been changed since.
//!
//! # What it answers, and what it never does
//!
//! It answers the document type, the signer's name and registration, the
//! facility, the signed time, the key's status, and whether the record still
//! matches what was signed. It recomputes that from the live source record,
//! so a changed field in the database shows as "changed", not as the
//! snapshot taken at signing.
//!
//! It never answers the patient's name, the diagnosis, or any clinical
//! content: the reader already holds the paper, and the link must not become
//! a way to look a stranger up. The full document always needs the hospital.
//!
//! # Why a token
//!
//! The QR carries a token from `signature_verify_links`, not the signed
//! record's id: 256 random bits cannot be guessed or walked, and a token can
//! be withdrawn. A withdrawn token says so, with its date. An unknown token
//! answers exactly as a missing one does, so the route is not an oracle for
//! which tokens exist.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, NaiveDate, Utc};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};
use medbrains_signing::signing;

use crate::signatures::resolve_signable_payload;

/// A token is 32 random bytes as hex. Anything else is not one of ours, and
/// is refused before it reaches the database, the same way an unknown one is.
const TOKEN_HEX_LEN: usize = 64;

/// What the check found for a live link.
#[derive(Debug, Serialize)]
pub struct SignedDocumentCheck {
    /// `unchanged` or `changed`.
    pub status: &'static str,
    /// The kind of document: `discharge_summary`, `lab_report`, ...
    pub document_type: String,
    pub signer_name: String,
    /// The signer's medical council registration number, when recorded.
    pub signer_registration: Option<String>,
    /// The council that registration is with.
    pub signer_council: Option<String>,
    /// The hospital the document was signed at.
    pub facility: String,
    pub signed_at: DateTime<Utc>,
    /// `active`, `revoked`, or `unknown` when the key is no longer on record.
    pub key_status: &'static str,
    pub key_revoked_on: Option<NaiveDate>,
    /// The record still matches its signature, and the signature verifies.
    pub unchanged: bool,
}

/// What the check says when the hospital withdrew the link.
#[derive(Debug, Serialize)]
pub struct WithdrawnLink {
    /// Always `withdrawn`.
    pub status: &'static str,
    pub withdrawn_on: NaiveDate,
}

/// The public answer: a checked document, or a withdrawn link.
#[derive(Debug, Serialize)]
#[serde(untagged)]
pub enum PublicSignatureCheck {
    Checked(SignedDocumentCheck),
    Withdrawn(WithdrawnLink),
}

/// `GET /api/public/signatures/verify/{token}`
///
/// Unauthenticated by necessity: the reader is an insurer, a court or
/// another hospital, not a user of this system. It needs no permission
/// because the token is the whole credential and the answer carries no
/// health data; it is bounded per address by the public-verify limiter.
#[tracing::instrument(skip_all)]
pub async fn verify_signature_public(
    State(state): State<AppState>,
    Path(token): Path<String>,
) -> Result<Json<PublicSignatureCheck>, AppError> {
    if token.len() != TOKEN_HEX_LEN || !token.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err(AppError::NotFound);
    }
    // The token is how the hospital is found; `app_signature_verify_link`
    // (migration 1406) reads it before any tenant is known.
    let link = sqlx::query!(
        r#"SELECT tenant_id AS "tenant_id!", signed_record_id AS "signed_record_id!", revoked_at
           FROM app_signature_verify_link($1)"#,
        token,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    if let Some(revoked_at) = link.revoked_at {
        return Ok(Json(PublicSignatureCheck::Withdrawn(WithdrawnLink {
            status: "withdrawn",
            withdrawn_on: revoked_at.date_naive(),
        })));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &link.tenant_id).await?;
    let check = check_signed_record(&mut tx, link.tenant_id, link.signed_record_id).await?;
    sqlx::query!(
        "UPDATE signature_verify_links \
         SET accessed_count = accessed_count + 1, last_accessed = now() \
         WHERE token = $1 AND tenant_id = $2",
        token,
        link.tenant_id,
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(PublicSignatureCheck::Checked(check)))
}

/// Recompute the record's hash from its source and verify the signature.
async fn check_signed_record(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    signed_record_id: Uuid,
) -> Result<SignedDocumentCheck, AppError> {
    let row = sqlx::query!(
        r#"SELECT sr.record_type, sr.record_id, sr.signer_user_id, sr.signer_role,
                  sr.signed_at, sr.payload_hash, sr.signature_bytes,
                  COALESCE(dp.display_name, u.full_name) AS "signer_name?",
                  COALESCE(dp.state_council_number, dp.mci_number) AS "signer_registration?",
                  dp.state_council_name AS "signer_council?",
                  t.name AS facility,
                  c.public_key AS "public_key?",
                  c.revoked_at AS "key_revoked_at?"
             FROM signed_records sr
             JOIN tenants t ON t.id = sr.tenant_id
             LEFT JOIN doctor_profiles dp
               ON dp.user_id = sr.signer_user_id AND dp.tenant_id = sr.tenant_id
             LEFT JOIN users u ON u.id = sr.signer_user_id
             LEFT JOIN doctor_signature_credentials c
               ON c.id = sr.signer_credential_id AND c.tenant_id = sr.tenant_id
            WHERE sr.id = $1 AND sr.tenant_id = $2 AND sr.deleted_at IS NULL"#,
        signed_record_id,
        tenant_id,
    )
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let source = SignedSource {
        record_type: &row.record_type,
        record_id: row.record_id,
        signer_user_id: row.signer_user_id,
        signer_role: &row.signer_role,
    };
    let hash_matches = current_hash(tx, tenant_id, source)
        .await?
        .is_some_and(|hash| hash.as_slice() == row.payload_hash.as_slice());
    let signature_holds = row.public_key.as_deref().is_some_and(|key| {
        <[u8; 32]>::try_from(row.payload_hash.as_slice())
            .is_ok_and(|hash| signing::verify(key, &hash, &row.signature_bytes).is_ok())
    });
    let unchanged = hash_matches && signature_holds;
    Ok(SignedDocumentCheck {
        status: if unchanged { "unchanged" } else { "changed" },
        document_type: row.record_type,
        signer_name: row.signer_name.unwrap_or_else(|| "Not recorded".to_owned()),
        signer_registration: row.signer_registration,
        signer_council: row.signer_council,
        facility: row.facility,
        signed_at: row.signed_at,
        key_status: key_status(row.public_key.is_some(), row.key_revoked_at),
        key_revoked_on: row.key_revoked_at.map(|at| at.date_naive()),
        unchanged,
    })
}

/// The signing key's status, as the public page words it.
const fn key_status(on_record: bool, revoked_at: Option<DateTime<Utc>>) -> &'static str {
    match (on_record, revoked_at) {
        (false, _) => "unknown",
        (true, Some(_)) => "revoked",
        (true, None) => "active",
    }
}

/// Which source record a signature covers, and whose primary signature it is.
struct SignedSource<'a> {
    record_type: &'a str,
    record_id: Uuid,
    signer_user_id: Uuid,
    signer_role: &'a str,
}

/// The hash of the source record as it is now; `None` when it is gone.
///
/// A record that no longer resolves (deleted, or no longer the signer's) is
/// not the record that was signed, so the caller reports it as changed.
async fn current_hash(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    source: SignedSource<'_>,
) -> Result<Option<[u8; 32]>, AppError> {
    let payload = match resolve_signable_payload(
        tx,
        &tenant_id,
        &source.signer_user_id,
        source.signer_role,
        source.record_type,
        source.record_id,
    )
    .await
    {
        Ok(payload) => payload,
        Err(AppError::NotFound | AppError::BadRequest(_)) => return Ok(None),
        Err(other) => return Err(other),
    };
    let canonical = signing::canonicalize(&payload)
        .map_err(|e| AppError::Internal(format!("canonicalize: {e}")))?;
    Ok(Some(signing::payload_hash(&canonical)))
}

/// Mint the signed record's public link, or return the live one.
///
/// Runs inside the caller's transaction, so signing and its link land
/// together; one live link per record (the partial unique index in 1406).
pub(crate) async fn issue_link_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    signed_record_id: Uuid,
) -> Result<String, AppError> {
    let token = sqlx::query_scalar!(
        "INSERT INTO signature_verify_links (tenant_id, signed_record_id, created_by) \
         VALUES ($1, $2, $3) \
         ON CONFLICT (tenant_id, signed_record_id) \
             WHERE revoked_at IS NULL AND deleted_at IS NULL \
         DO UPDATE SET token = signature_verify_links.token \
         RETURNING token",
        claims.tenant_id,
        signed_record_id,
        claims.sub,
    )
    .fetch_one(&mut **tx)
    .await?;
    Ok(token)
}

/// A signed record's public link.
#[derive(Debug, Serialize)]
pub struct VerifyLink {
    pub token: String,
}

/// `POST /api/signatures/{id}/verify-link` — the live public link for a
/// signed record, minted when the last one was withdrawn.
///
/// Tenant and permission scoped, without a per-patient check: the page the
/// link opens names no patient and shows no clinical content.
pub async fn issue_verify_link(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(signed_record_id): Path<Uuid>,
) -> Result<Json<VerifyLink>, AppError> {
    require_permission(&claims, permissions::mrd::verify_links::ISSUE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    require_signed_record(&mut tx, claims.tenant_id, signed_record_id).await?;
    let token = issue_link_in_tx(&mut tx, &claims, signed_record_id).await?;
    tx.commit().await?;
    Ok(Json(VerifyLink { token }))
}

#[derive(Debug, Deserialize)]
pub struct RevokeVerifyLinkRequest {
    pub reason: String,
}

#[derive(Debug, Serialize)]
pub struct RevokedVerifyLink {
    pub revoked: bool,
}

/// `POST /api/signatures/{id}/verify-link/revoke` — withdraw the record's
/// live public link. Every copy already printed then says "withdrawn".
pub async fn revoke_verify_link(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(signed_record_id): Path<Uuid>,
    Json(body): Json<RevokeVerifyLinkRequest>,
) -> Result<Json<RevokedVerifyLink>, AppError> {
    require_permission(&claims, permissions::mrd::verify_links::REVOKE)?;
    let reason = body.reason.trim();
    if reason.is_empty() {
        return Err(AppError::BadRequest(
            "Say why the link is withdrawn".to_owned(),
        ));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    require_signed_record(&mut tx, claims.tenant_id, signed_record_id).await?;
    let done = sqlx::query!(
        "UPDATE signature_verify_links \
         SET revoked_at = now(), revoked_by = $3, revoked_reason = $4 \
         WHERE tenant_id = $1 AND signed_record_id = $2 \
           AND revoked_at IS NULL AND deleted_at IS NULL",
        claims.tenant_id,
        signed_record_id,
        claims.sub,
        reason,
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(RevokedVerifyLink {
        revoked: done.rows_affected() > 0,
    }))
}

/// 404 unless the signed record exists in this hospital.
async fn require_signed_record(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    signed_record_id: Uuid,
) -> Result<(), AppError> {
    let exists = sqlx::query_scalar!(
        r#"SELECT EXISTS(SELECT 1 FROM signed_records
                          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL) AS "exists!""#,
        signed_record_id,
        tenant_id,
    )
    .fetch_one(&mut **tx)
    .await?;
    if exists {
        Ok(())
    } else {
        Err(AppError::NotFound)
    }
}

#[cfg(test)]
mod tests {
    use super::key_status;

    #[test]
    fn a_revoked_key_says_revoked_and_a_missing_one_unknown() {
        assert_eq!(key_status(true, None), "active");
        assert_eq!(key_status(true, Some(chrono::Utc::now())), "revoked");
        assert_eq!(key_status(false, None), "unknown");
    }
}
