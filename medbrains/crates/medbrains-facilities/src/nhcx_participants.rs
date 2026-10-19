//! NHCX payer directory — the payer/TPA participants (HCX codes) used as the
//! `recipient_code` when submitting a claim.
//!
//! Maintained here by an NHCX administrator. The submit flow takes the
//! `recipient_code` from this directory, and the outbox handler encrypts each
//! message to the payer's `encryption_cert` — a certificate is a trust
//! decision, so changing the directory needs `insurance.nhcx.configure`.

use axum::Json;
use axum::extract::{Extension, Query, State};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

#[derive(Debug, Serialize, FromRow)]
pub struct NhcxParticipant {
    pub id: Uuid,
    pub participant_code: String,
    pub participant_name: String,
    pub role: String,
    pub is_active: bool,
    /// Whether the payer's encryption certificate is on file; without it
    /// nothing can be sent to this payer.
    pub has_encryption_cert: bool,
}

#[derive(Debug, Deserialize)]
pub struct NhcxParticipantQuery {
    /// Filter by role (`PAYER` | `PROVIDER` | `TPA`).
    pub role: Option<String>,
    /// The payer's encryption certificate (PEM). Blank keeps the saved one.
    pub encryption_cert: Option<String>,
}

/// `GET /api/nhcx/participants` — the tenant's NHCX payer directory.
///
/// # Errors
/// 403 without `insurance.nhcx.view`.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn list_nhcx_participants(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<NhcxParticipantQuery>,
) -> Result<Json<Vec<NhcxParticipant>>, AppError> {
    require_permission(&claims, permissions::insurance::nhcx::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, NhcxParticipant>(
        "SELECT id, participant_code, participant_name, role, is_active, \
                COALESCE(btrim(encryption_cert), '') <> '' AS has_encryption_cert \
         FROM nhcx_participants \
         WHERE tenant_id = $1 AND ($2::text IS NULL OR role = $2) AND is_active = true \
         ORDER BY participant_name",
    )
    .bind(claims.tenant_id)
    .bind(q.role.as_deref())
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct UpsertNhcxParticipantRequest {
    pub participant_code: String,
    pub participant_name: String,
    /// `PAYER` (default) | `PROVIDER` | `TPA`.
    pub role: Option<String>,
    /// The payer's encryption certificate (PEM). Blank keeps the saved one.
    pub encryption_cert: Option<String>,
}

/// `POST /api/nhcx/participants` — add or update a payer in the directory.
///
/// # Errors
/// 403 without `insurance.nhcx.configure`; 400 without a code and name, or
/// for a certificate that is not a usable X.509 certificate or public key.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn upsert_nhcx_participant(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpsertNhcxParticipantRequest>,
) -> Result<Json<NhcxParticipant>, AppError> {
    require_permission(&claims, permissions::insurance::nhcx::CONFIGURE)?;
    let code = body.participant_code.trim();
    let name = body.participant_name.trim();
    if code.is_empty() || name.is_empty() {
        return Err(AppError::BadRequest(
            "participant_code and participant_name are required".to_owned(),
        ));
    }
    let role = body
        .role
        .as_deref()
        .map(str::trim)
        .filter(|r| !r.is_empty())
        .unwrap_or("PAYER");
    let cert = body
        .encryption_cert
        .as_deref()
        .map(str::trim)
        .filter(|c| !c.is_empty());
    if let Some(pem) = cert {
        check_encryption_cert(pem)?;
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, NhcxParticipant>(
        "INSERT INTO nhcx_participants \
           (tenant_id, participant_code, participant_name, role, encryption_cert) \
         VALUES ($1, $2, $3, $4, $5) \
         ON CONFLICT (tenant_id, participant_code) DO UPDATE SET \
           participant_name = EXCLUDED.participant_name, role = EXCLUDED.role, \
           encryption_cert = COALESCE(EXCLUDED.encryption_cert, nhcx_participants.encryption_cert), \
           is_active = true, updated_at = now() \
         RETURNING id, participant_code, participant_name, role, is_active, \
                   COALESCE(btrim(encryption_cert), '') <> '' AS has_encryption_cert",
    )
    .bind(claims.tenant_id)
    .bind(code)
    .bind(name)
    .bind(role)
    .bind(cert)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// A certificate the handler cannot encrypt to would fail every submission
/// to this payer — refuse it here, where the administrator can fix it.
fn check_encryption_cert(pem: &str) -> Result<(), AppError> {
    let probe = serde_json::json!({});
    medbrains_crypto::jwe::encrypt_hcx(&probe, &serde_json::Map::new(), pem.as_bytes())
        .map(|_| ())
        .map_err(|_| {
            AppError::BadRequest(
                "the encryption certificate is not a usable RSA certificate or public key (PEM)"
                    .to_owned(),
            )
        })
}
