//! Sharing a study by link — with a referring doctor, for a second opinion,
//! or with the patient.
//!
//! A link opens exactly one study in the viewer, through `MedBrains`, without
//! signing in: the token is the whole credential. So it is scoped to that
//! study (any other study through the same token is a 404), it expires
//! (at most a week), it can be revoked, and making it, revoking it and every
//! open of it are audited. Before, a link handed out the PACS's LAN address,
//! which no recipient outside the hospital could open.

use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use axum::{
    Extension, Json,
    extract::{Path, RawQuery, State},
    http::HeaderMap,
    response::Response,
};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use crate::viewer::{relay, requested_study, serve_ohif, tenant_target};

const DEFAULT_HOURS: i64 = 72;
const MAX_HOURS: i64 = 7 * 24;
/// Token lookups memoised this long; also how late a revocation can take
/// effect on a viewer already open.
const TOKEN_TTL: Duration = Duration::from_secs(60);
const TOKEN_CACHE_CAP: usize = 5_000;

fn public_base(token: &str) -> String {
    format!("/api/public/radiology/share/{token}")
}

/// Where a recipient opens the link.
fn viewer_path(token: &str, uid: &str) -> String {
    format!("{}/ohif/viewer?StudyInstanceUIDs={uid}", public_base(token))
}

async fn audit(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    user: Option<Uuid>,
    action: &str,
    link_id: Uuid,
    values: &Value,
) -> Result<(), AppError> {
    medbrains_db::audit::AuditLogger::log(
        tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id,
            user_id: user,
            action,
            entity_type: "radiology_share_link",
            entity_id: Some(link_id),
            old_values: None,
            new_values: Some(values),
            ip_address: None,
        },
    )
    .await?;
    Ok(())
}

async fn open_tx<'a>(
    state: &'a AppState,
    claims: &Claims,
) -> Result<Transaction<'a, Postgres>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    Ok(tx)
}

#[derive(Debug, Deserialize)]
pub struct CreateShareLink {
    pub study_id: Uuid,
    pub recipient_name: Option<String>,
    pub recipient_email: Option<String>,
    /// 1 to 168; 72 when absent.
    pub expires_hours: Option<i64>,
}

/// `POST /api/radiology/share-links` — make a link to one study.
pub async fn create_share_link(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateShareLink>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::radiology::studies::SHARE)?;
    // A public link to a patient's images: only for a patient the caller may see.
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::RADIOLOGY_DICOM_STUDY,
        body.study_id,
    )
    .await?;
    let hours = body.expires_hours.unwrap_or(DEFAULT_HOURS);
    if !(1..=MAX_HOURS).contains(&hours) {
        return Err(AppError::BadRequest(format!(
            "A link lasts between 1 hour and {MAX_HOURS} hours (a week)"
        )));
    }
    let recipient = body
        .recipient_name
        .as_deref()
        .map(str::trim)
        .filter(|r| !r.is_empty());
    let Some(recipient) = recipient else {
        return Err(AppError::BadRequest("Say who the link is for".to_owned()));
    };
    let mut tx = open_tx(&state, &claims).await?;
    let uid: String = sqlx::query_scalar(
        "SELECT study_instance_uid FROM radiology_dicom_studies \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(body.study_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let token = format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple());
    let expires = Utc::now() + chrono::Duration::hours(hours);
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO radiology_share_links \
           (tenant_id, study_id, token, recipient_name, recipient_email, expires_at, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(body.study_id)
    .bind(&token)
    .bind(recipient)
    .bind(
        body.recipient_email
            .as_deref()
            .map(str::trim)
            .filter(|e| !e.is_empty()),
    )
    .bind(expires)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    let values =
        json!({ "study_id": body.study_id, "recipient": recipient, "expires_at": expires });
    audit(
        &mut tx,
        claims.tenant_id,
        Some(claims.sub),
        "radiology.share_link.create",
        id,
        &values,
    )
    .await?;
    tx.commit().await?;
    Ok(Json(json!({
        "id": id,
        "viewer_url": viewer_path(&token, &uid),
        "expires_at": expires,
    })))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ShareLinkRow {
    pub id: Uuid,
    pub recipient_name: Option<String>,
    pub recipient_email: Option<String>,
    pub expires_at: DateTime<Utc>,
    pub accessed_count: i32,
    pub last_accessed: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub revoked_at: Option<DateTime<Utc>>,
}

/// `GET /api/radiology/dicom-studies/{id}/share-links` — who a study was
/// shared with, and whether they opened it. Tokens are never listed.
pub async fn list_share_links(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(study_id): Path<Uuid>,
) -> Result<Json<Vec<ShareLinkRow>>, AppError> {
    require_permission(&claims, permissions::radiology::studies::SHARE)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::RADIOLOGY_DICOM_STUDY,
        study_id,
    )
    .await?;
    let mut tx = open_tx(&state, &claims).await?;
    // allow-soft-deleted: a revoked link is shown as revoked, not hidden.
    let rows = sqlx::query_as::<_, ShareLinkRow>(
        "SELECT id, recipient_name, recipient_email, expires_at, accessed_count, last_accessed, \
                created_at, deleted_at AS revoked_at \
           FROM radiology_share_links WHERE study_id = $1 AND tenant_id = $2 \
          ORDER BY created_at DESC LIMIT 100",
    )
    .bind(study_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// `POST /api/radiology/share-links/{id}/revoke` — stop a link working.
pub async fn revoke_share_link(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::radiology::studies::SHARE)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::RADIOLOGY_SHARE_LINK,
        id,
    )
    .await?;
    let mut tx = open_tx(&state, &claims).await?;
    let token: String = sqlx::query_scalar(
        "UPDATE radiology_share_links SET deleted_at = now(), deleted_by = $3, \
                delete_reason = 'revoked' \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING token",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    // ponytail: evicts on this server only; another instance stops the link
    // within TOKEN_TTL.
    if let Ok(mut map) = TOKENS.get_or_init(Mutex::default).lock() {
        map.remove(&token);
    }
    audit(
        &mut tx,
        claims.tenant_id,
        Some(claims.sub),
        "radiology.share_link.revoke",
        id,
        &json!({}),
    )
    .await?;
    tx.commit().await?;
    Ok(Json(json!({ "revoked": true })))
}

/// What a live token opens.
#[derive(Debug, Clone)]
struct Shared {
    link_id: Uuid,
    tenant_id: Uuid,
    uid: String,
    expires_at: DateTime<Utc>,
}

static TOKENS: OnceLock<Mutex<HashMap<String, (Instant, Shared)>>> = OnceLock::new();

async fn resolve(state: &AppState, token: &str) -> Result<Shared, AppError> {
    let cache = TOKENS.get_or_init(Mutex::default);
    if let Ok(map) = cache.lock()
        && let Some((at, shared)) = map.get(token)
        && at.elapsed() < TOKEN_TTL
        && shared.expires_at > Utc::now()
    {
        return Ok(shared.clone());
    }
    // The token is how the tenant is found: a SECURITY DEFINER lookup that
    // returns nothing for an expired or revoked link.
    let (link_id, tenant_id, study_id, expires_at) =
        sqlx::query_as::<_, (Uuid, Uuid, Uuid, DateTime<Utc>)>(
            "SELECT id, tenant_id, study_id, expires_at FROM public.app_share_link_by_token($1)",
        )
        .bind(token)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)?;
    let mut conn = medbrains_db::pool::tenant_conn(&state.db, &tenant_id).await?;
    let uid: String = sqlx::query_scalar(
        "SELECT study_instance_uid FROM radiology_dicom_studies \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(study_id)
    .bind(tenant_id)
    .fetch_optional(&mut *conn)
    .await?
    .ok_or(AppError::NotFound)?;
    let shared = Shared {
        link_id,
        tenant_id,
        uid,
        expires_at,
    };
    if let Ok(mut map) = cache.lock() {
        if map.len() >= TOKEN_CACHE_CAP {
            map.clear();
        }
        map.insert(token.to_owned(), (Instant::now(), shared.clone()));
    }
    Ok(shared)
}

/// Count and audit one open of a shared study (the viewer page, not each
/// frame it then loads).
async fn record_open(state: &AppState, shared: &Shared) -> Result<(), AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &shared.tenant_id).await?;
    sqlx::query("SELECT public.app_share_link_touch($1, $2)")
        .bind(shared.link_id)
        .bind(shared.tenant_id)
        .execute(&mut *tx)
        .await?;
    let values = json!({ "study_instance_uid": shared.uid });
    audit(
        &mut tx,
        shared.tenant_id,
        None,
        "radiology.share_link.open",
        shared.link_id,
        &values,
    )
    .await?;
    tx.commit().await?;
    Ok(())
}

/// `GET /api/public/radiology/share/{token}/ohif/` — the viewer's entry
/// page, for the recipient of a link.
pub async fn public_ohif_index(
    State(state): State<AppState>,
    Path(token): Path<String>,
    RawQuery(query): RawQuery,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    shared_ohif(&state, &token, "", query.as_deref(), &headers).await
}

/// `GET /api/public/radiology/share/{token}/ohif/{*rest}` — the viewer's
/// pages and files, for the recipient of a link.
pub async fn public_ohif(
    State(state): State<AppState>,
    Path((token, rest)): Path<(String, String)>,
    RawQuery(query): RawQuery,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    shared_ohif(&state, &token, &rest, query.as_deref(), &headers).await
}

async fn shared_ohif(
    state: &AppState,
    token: &str,
    rest: &str,
    query: Option<&str>,
    headers: &HeaderMap,
) -> Result<Response, AppError> {
    let shared = resolve(state, token).await?;
    let is_page = !rest.rsplit('/').next().is_some_and(|f| f.contains('.'));
    if is_page {
        record_open(state, &shared).await?;
    }
    let target = tenant_target(state, shared.tenant_id).await?;
    let basename = format!("{}/ohif/", public_base(token));
    serve_ohif(&target, rest, query, headers, &basename).await
}

/// `GET /api/public/radiology/share/{token}/dicom-web/{*rest}` — the shared
/// study's `DICOMweb`, and nothing else.
pub async fn public_dicomweb(
    State(state): State<AppState>,
    Path((token, rest)): Path<(String, String)>,
    RawQuery(query): RawQuery,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    let shared = resolve(&state, &token).await?;
    let uid = requested_study(&rest, query.as_deref()).ok_or(AppError::NotFound)?;
    if uid != shared.uid {
        return Err(AppError::NotFound);
    }
    let target = tenant_target(&state, shared.tenant_id).await?;
    relay(
        &target,
        &format!("/dicom-web/{}", rest.trim_start_matches('/')),
        query.as_deref(),
        &headers,
    )
    .await
}

/// `GET /api/public/radiology/viewer/{token}` — what a link opens, for a
/// page that wants to show it before opening the viewer.
pub async fn validate_share_link(
    State(state): State<AppState>,
    Path(token): Path<String>,
) -> Result<Json<Value>, AppError> {
    let shared = resolve(&state, &token).await?;
    Ok(Json(json!({
        "study_uid": shared.uid,
        "viewer_url": viewer_path(&token, &shared.uid),
        "expires_at": shared.expires_at,
        "valid": true,
    })))
}

#[cfg(test)]
mod tests {
    use super::viewer_path;

    #[test]
    fn a_link_opens_its_study_through_medbrains() {
        assert_eq!(
            viewer_path("abc", "1.2.3"),
            "/api/public/radiology/share/abc/ohif/viewer?StudyInstanceUIDs=1.2.3"
        );
    }
}
