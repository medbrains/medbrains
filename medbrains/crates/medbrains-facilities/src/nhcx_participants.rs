//! NHCX payer directory — the payer/TPA participants (HCX codes) used as the
//! `recipient_code` when submitting a claim.
//!
//! Filled from the NHCX registry (`/fetch/participants/list`, refreshed on
//! demand under `insurance.nhcx.refresh_directory`); a payer typed in by an
//! administrator is the fallback. The outbox fetches each recipient's
//! certificate from `/fetch/certs` and keeps it here; a certificate typed in
//! by hand is a trust decision, so manual entry needs
//! `insurance.nhcx.configure`.

use axum::Json;
use axum::extract::{Extension, Query, State};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

use crate::nhcx_common;

#[derive(Debug, Serialize, FromRow)]
pub struct NhcxParticipant {
    pub id: Uuid,
    pub participant_code: String,
    pub participant_name: String,
    pub role: String,
    pub is_active: bool,
    /// Whether the payer's encryption certificate is on file. A registry
    /// payer without one gets it from `/fetch/certs` on the first send.
    pub has_encryption_cert: bool,
    /// `registry` (listed by NHCX) or `manual` (typed in here).
    pub source: String,
    /// `Gov` or `Pvt`: the registry list it came from.
    pub entity_type: Option<String>,
    /// When the registry last listed it.
    pub synced_at: Option<DateTime<Utc>>,
}

/// What a directory row reads back.
const PARTICIPANT_COLUMNS: &str = "id, participant_code, participant_name, role, is_active, \
     COALESCE(btrim(encryption_cert), '') <> '' AS has_encryption_cert, source, entity_type, \
     synced_at";

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
    let sql = format!(
        "SELECT {PARTICIPANT_COLUMNS} FROM nhcx_participants \
         WHERE tenant_id = $1 AND ($2::text IS NULL OR role = $2) AND is_active = true \
         ORDER BY participant_name"
    );
    let rows = sqlx::query_as::<_, NhcxParticipant>(&sql)
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
    let sql = format!(
        "INSERT INTO nhcx_participants \
           (tenant_id, participant_code, participant_name, role, encryption_cert) \
         VALUES ($1, $2, $3, $4, $5) \
         ON CONFLICT (tenant_id, participant_code) DO UPDATE SET \
           participant_name = EXCLUDED.participant_name, role = EXCLUDED.role, \
           encryption_cert = COALESCE(EXCLUDED.encryption_cert, nhcx_participants.encryption_cert), \
           is_active = true, updated_at = now() \
         RETURNING {PARTICIPANT_COLUMNS}"
    );
    let row = sqlx::query_as::<_, NhcxParticipant>(&sql)
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

/// The registry lists a provider asks for: payers and TPAs, each on the
/// government and the private list (a request without `entitytype` answers
/// the private list only).
const LISTS: [(&str, &str); 4] = [
    ("PAYER", "Gov"),
    ("PAYER", "Pvt"),
    ("TPA", "Gov"),
    ("TPA", "Pvt"),
];

/// What a refresh did.
#[derive(Debug, Serialize)]
pub struct DirectoryRefresh {
    /// Participants the registry listed, across the lists that answered.
    pub listed: usize,
    /// The lists that did not answer, each with the reason.
    pub failed: Vec<String>,
    pub directory: Vec<NhcxParticipant>,
}

/// `POST /api/nhcx/participants/refresh` — fill the directory from the
/// registry's `/fetch/participants/list`. Certificates and hand-entered
/// rows' certificates are kept; a listed row is marked `registry`.
///
/// # Errors
/// 403 without `insurance.nhcx.refresh_directory`; 503 until NHCX is set up,
/// or when no list answered.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn refresh_nhcx_participants(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<DirectoryRefresh>, AppError> {
    require_permission(&claims, permissions::insurance::nhcx::REFRESH_DIRECTORY)?;
    let http = nhcx_common::registry_http()?;
    let registry = nhcx_common::registry(&state, &http, claims.tenant_id).await?;
    let (mut codes, mut names): (Vec<String>, Vec<String>) = (vec![], vec![]);
    let (mut roles, mut entities): (Vec<&str>, Vec<&str>) = (vec![], vec![]);
    let mut failed = Vec::new();
    for (role, entity) in LISTS {
        match registry.participants(role, entity, Utc::now()).await {
            Ok(found) => {
                for p in found {
                    codes.push(p.code);
                    names.push(p.name);
                    roles.push(role);
                    entities.push(entity);
                }
            }
            Err(e) => failed.push(format!("{role} {entity}: {e}")),
        }
    }
    if failed.len() == LISTS.len() {
        return Err(AppError::ServiceUnavailable(format!(
            "the NHCX registry did not answer — the directory is unchanged ({})",
            failed.join("; ")
        )));
    }
    let listed = codes.len();
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    sqlx::query!(
        "INSERT INTO nhcx_participants \
             (tenant_id, participant_code, participant_name, role, entity_type, source, synced_at) \
         SELECT DISTINCT ON (code) $1, code, name, role, entity, 'registry', now() \
           FROM unnest($2::text[], $3::text[], $4::text[], $5::text[]) AS r(code, name, role, entity) \
         ON CONFLICT (tenant_id, participant_code) DO UPDATE SET \
             participant_name = EXCLUDED.participant_name, role = EXCLUDED.role, \
             entity_type = EXCLUDED.entity_type, source = 'registry', synced_at = now(), \
             is_active = true, updated_at = now()",
        claims.tenant_id,
        &codes,
        &names,
        &roles as &[&str],
        &entities as &[&str],
    )
    .execute(&mut *tx)
    .await?;
    let directory = sqlx::query_as!(
        NhcxParticipant,
        r#"SELECT id, participant_code, participant_name, role, is_active,
                  COALESCE(btrim(encryption_cert), '') <> '' AS "has_encryption_cert!",
                  source, entity_type, synced_at
             FROM nhcx_participants
            WHERE tenant_id = $1 AND is_active ORDER BY participant_name"#,
        claims.tenant_id,
    )
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(DirectoryRefresh {
        listed,
        failed,
        directory,
    }))
}
