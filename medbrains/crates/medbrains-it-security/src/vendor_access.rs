//! Security → vendor access: the hospital gives, approves, watches and ends
//! the access vendor support and engineering staff have to its data.
//!
//! The enforcement is not here: it is the auth middleware's
//! (`medbrains_server_core::middleware::vendor_access`), which refuses a
//! vendor account on every request without a live grant. These handlers
//! are the hospital's side of it — the only way a grant comes to exist — and
//! none of them can be called under a grant (`security.vendor_access.*` is
//! never in a grant's scope). Docs: `docs/compliance/vendor-access.md`.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
    routing::{get, post},
};
use chrono::{DateTime, Duration, Utc};
use medbrains_core::permissions;
use medbrains_kernel::{Actor, require_permission};
use medbrains_server_core::{
    error::AppError,
    middleware::{
        auth::Claims,
        vendor_access::{is_valid_scope, vendor_domains},
    },
    pagination::{Paginated, Pagination},
    state::AppState,
    step_up::{StepUpProof, require_step_up},
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Longest grant, in hours: DPDP purpose limitation in practice — support is a
/// visit, not a tenancy.
const MAX_HOURS: i64 = 72;
/// Grant length when the hospital does not choose one.
const DEFAULT_HOURS: i64 = 4;
/// Shortest reason accepted; matches the table's check.
const MIN_REASON: usize = 10;

/// One grant as the hospital sees it, with the people named.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct VendorAccessGrant {
    pub id: Uuid,
    pub grantee_user_id: Uuid,
    pub grantee_email: String,
    pub grantee_name: Option<String>,
    pub reason: String,
    pub scope: Vec<String>,
    pub is_masked: bool,
    pub expires_at: DateTime<Utc>,
    pub created_by_name: Option<String>,
    pub created_at: DateTime<Utc>,
    pub approved_by_name: Option<String>,
    pub approved_at: Option<DateTime<Utc>>,
    pub revoked_by_name: Option<String>,
    pub revoked_at: Option<DateTime<Utc>>,
    pub revoke_reason: Option<String>,
    /// `pending_approval`, `active`, `expired` or `revoked`.
    pub status: String,
    pub event_count: i64,
}

/// The grant columns, people joined and status derived, for `WHERE` to follow.
const GRANT_SELECT: &str = "SELECT g.id, g.grantee_user_id, g.grantee_email, \
       gu.full_name AS grantee_name, g.reason, g.scope, g.is_masked, g.expires_at, \
       cu.full_name AS created_by_name, g.created_at, au.full_name AS approved_by_name, \
       g.approved_at, ru.full_name AS revoked_by_name, g.revoked_at, g.revoke_reason, \
       CASE WHEN g.revoked_at IS NOT NULL THEN 'revoked' \
            WHEN g.expires_at <= now() THEN 'expired' \
            WHEN NOT g.is_masked AND g.approved_at IS NULL THEN 'pending_approval' \
            ELSE 'active' END AS status, \
       (SELECT COUNT(*) FROM vendor_access_events e \
         WHERE e.grant_id = g.id AND e.tenant_id = g.tenant_id) AS event_count \
  FROM vendor_access_grants g \
  LEFT JOIN users gu ON gu.id = g.grantee_user_id \
  LEFT JOIN users cu ON cu.id = g.created_by \
  LEFT JOIN users au ON au.id = g.approved_by \
  LEFT JOIN users ru ON ru.id = g.revoked_by";

/// One request made under a grant.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct VendorAccessEvent {
    pub id: Uuid,
    pub method: String,
    pub path: String,
    pub status_code: Option<i16>,
    pub was_masked: bool,
    pub created_at: DateTime<Utc>,
}

/// What the hospital fills in to give access.
#[derive(Debug, Deserialize)]
pub struct CreateVendorAccessGrant {
    pub grantee_email: String,
    pub reason: String,
    pub scope: Vec<String>,
    #[serde(default = "masked_by_default")]
    pub is_masked: bool,
    pub hours: Option<i64>,
}

/// Masked unless the hospital says otherwise.
const fn masked_by_default() -> bool {
    true
}

/// Why access is being ended, if the hospital says.
#[derive(Debug, Default, Deserialize)]
pub struct RevokeVendorAccessGrant {
    pub reason: Option<String>,
}

/// The routes this module serves.
pub fn routes() -> axum::Router<AppState> {
    axum::Router::new()
        .route(
            "/api/security/vendor-access/grants",
            get(list_grants).post(create_grant),
        )
        .route(
            "/api/security/vendor-access/grants/{id}/approve",
            post(approve_grant),
        )
        .route(
            "/api/security/vendor-access/grants/{id}/revoke",
            post(revoke_grant),
        )
        .route(
            "/api/security/vendor-access/grants/{id}/events",
            get(list_events),
        )
}

/// `GET /api/security/vendor-access/grants` — every grant, newest first.
pub async fn list_grants(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(page): Query<Pagination>,
) -> Result<Json<Paginated<VendorAccessGrant>>, AppError> {
    require_permission(&claims, permissions::security::vendor_access::VIEW)?;
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM vendor_access_grants WHERE tenant_id = $1 AND deleted_at IS NULL",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;
    let rows = sqlx::query_as::<_, VendorAccessGrant>(&format!(
        "{GRANT_SELECT} WHERE g.tenant_id = $1 AND g.deleted_at IS NULL \
         ORDER BY g.created_at DESC LIMIT $2 OFFSET $3"
    ))
    .bind(claims.tenant_id)
    .bind(page.limit())
    .bind(page.offset())
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(Paginated::new(rows, total, &page)))
}

/// Check what the hospital typed, returning the trimmed reason and the hours.
fn validate(body: &CreateVendorAccessGrant) -> Result<(String, i64), AppError> {
    let reason = body.reason.trim().to_owned();
    if reason.chars().count() < MIN_REASON {
        return Err(AppError::BadRequest(
            "Say why MedBrains needs access, in at least 10 characters.".to_owned(),
        ));
    }
    if !is_valid_scope(&body.scope) {
        return Err(AppError::BadRequest(
            "Choose the modules MedBrains may reach, or configuration only.".to_owned(),
        ));
    }
    let hours = body.hours.unwrap_or(DEFAULT_HOURS);
    if !(1..=MAX_HOURS).contains(&hours) {
        return Err(AppError::BadRequest(
            "Access lasts between 1 and 72 hours.".to_owned(),
        ));
    }
    Ok((reason, hours))
}

/// `POST /api/security/vendor-access/grants` — give a vendor account
/// access. Masked access opens at once; unmasked waits for a second person.
pub async fn create_grant(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    proof: StepUpProof,
    Json(body): Json<CreateVendorAccessGrant>,
) -> Result<Json<VendorAccessGrant>, AppError> {
    require_permission(&claims, permissions::security::vendor_access::GRANT)?;
    require_step_up(&state, &proof, &claims)?;
    let (reason, hours) = validate(&body)?;
    let email = body.grantee_email.trim().to_lowercase();
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let grantee: Option<(Uuid, bool)> = sqlx::query_as(
        "SELECT id, COALESCE(is_vendor_staff OR public.app_email_is_vendor(email, $3), false) \
           FROM users WHERE tenant_id = $1 AND lower(btrim(email)) = $2 \
            AND is_active AND deleted_at IS NULL",
    )
    .bind(claims.tenant_id)
    .bind(&email)
    .bind(vendor_domains())
    .fetch_optional(&mut *tx)
    .await?;
    let Some((grantee, is_vendor)) = grantee else {
        return Err(AppError::BadRequest(
            "No account with this email at this hospital. Add the person under Admin → Users \
             first."
                .to_owned(),
        ));
    };
    if grantee == claims.sub {
        return Err(AppError::BadRequest(
            "You cannot give MedBrains access to your own account.".to_owned(),
        ));
    }
    // Never turn a hospital colleague into a MedBrains account: flagging is
    // permanent and revokes everything the account made.
    if !is_vendor {
        return Err(AppError::BadRequest(
            "This is not a MedBrains account. Access can be given only to a MedBrains address."
                .to_owned(),
        ));
    }
    let live: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM vendor_access_grants WHERE tenant_id = $1 \
           AND grantee_user_id = $2 AND revoked_at IS NULL AND deleted_at IS NULL \
           AND expires_at > now())",
    )
    .bind(claims.tenant_id)
    .bind(grantee)
    .fetch_one(&mut *tx)
    .await?;
    if live {
        return Err(AppError::Conflict(
            "This person already has access. End it before giving new access.".to_owned(),
        ));
    }
    // Flagged for good, so it stays gated if the domain list ever changes (the
    // column's trigger refuses clearing it, and revokes what it made).
    sqlx::query("UPDATE users SET is_vendor_staff = true WHERE id = $1 AND tenant_id = $2")
        .bind(grantee)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;
    let expires_at = Utc::now() + Duration::hours(hours);
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO vendor_access_grants \
           (tenant_id, grantee_user_id, grantee_email, reason, scope, is_masked, expires_at, \
            created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, LEAST($7, now() + interval '72 hours'), $8) \
         RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(grantee)
    .bind(&email)
    .bind(&reason)
    .bind(&body.scope)
    .bind(body.is_masked)
    .bind(expires_at)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    let grant = fetch_grant(&mut tx, &claims, id).await?;
    tx.commit().await?;
    Ok(Json(grant))
}

/// One grant of this hospital, or 404.
async fn fetch_grant(
    tx: &mut medbrains_kernel::Tx,
    claims: &Claims,
    id: Uuid,
) -> Result<VendorAccessGrant, AppError> {
    sqlx::query_as::<_, VendorAccessGrant>(&format!(
        "{GRANT_SELECT} WHERE g.id = $1 AND g.tenant_id = $2 AND g.deleted_at IS NULL"
    ))
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)
}

/// `POST /api/security/vendor-access/grants/{id}/approve` — the second
/// person's approval that opens an unmasked grant.
pub async fn approve_grant(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    proof: StepUpProof,
    Path(id): Path<Uuid>,
) -> Result<Json<VendorAccessGrant>, AppError> {
    require_permission(
        &claims,
        permissions::security::vendor_access::APPROVE_UNMASKED,
    )?;
    require_step_up(&state, &proof, &claims)?;
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let grant = fetch_grant(&mut tx, &claims, id).await?;
    if grant.is_masked {
        return Err(AppError::BadRequest(
            "Masked access needs no approval.".to_owned(),
        ));
    }
    if grant.status != "pending_approval" {
        return Err(AppError::Conflict(format!(
            "This access is {} and cannot be approved.",
            grant.status.replace('_', " ")
        )));
    }
    let asked_by_caller: bool = sqlx::query_scalar(
        "SELECT created_by = $3 FROM vendor_access_grants WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    if asked_by_caller {
        return Err(AppError::ForbiddenReason(
            "A different person must approve unmasked access.".to_owned(),
        ));
    }
    sqlx::query(
        "UPDATE vendor_access_grants SET approved_by = $3, approved_at = now() \
          WHERE id = $1 AND tenant_id = $2 AND approved_at IS NULL AND revoked_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;
    let grant = fetch_grant(&mut tx, &claims, id).await?;
    tx.commit().await?;
    Ok(Json(grant))
}

/// `POST /api/security/vendor-access/grants/{id}/revoke` — end access now.
/// The vendor person's next request is refused. Ending an ended grant
/// changes nothing and answers the grant as it is.
pub async fn revoke_grant(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    body: Option<Json<RevokeVendorAccessGrant>>,
) -> Result<Json<VendorAccessGrant>, AppError> {
    require_permission(&claims, permissions::security::vendor_access::REVOKE)?;
    let reason = body
        .and_then(|Json(b)| b.reason)
        .map(|r| r.trim().to_owned())
        .filter(|r| !r.is_empty());
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    fetch_grant(&mut tx, &claims, id).await?;
    sqlx::query(
        "UPDATE vendor_access_grants SET revoked_at = now(), revoked_by = $3, revoke_reason = $4 \
          WHERE id = $1 AND tenant_id = $2 AND revoked_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(reason)
    .execute(&mut *tx)
    .await?;
    let grant = fetch_grant(&mut tx, &claims, id).await?;
    tx.commit().await?;
    Ok(Json(grant))
}

/// `GET /api/security/vendor-access/grants/{id}/events` — every request made
/// under one grant, newest first.
pub async fn list_events(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Query(page): Query<Pagination>,
) -> Result<Json<Paginated<VendorAccessEvent>>, AppError> {
    require_permission(&claims, permissions::security::vendor_access::VIEW)?;
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let grant = fetch_grant(&mut tx, &claims, id).await?;
    let rows = sqlx::query_as::<_, VendorAccessEvent>(
        "SELECT id, method, path, status_code, was_masked, created_at \
           FROM vendor_access_events WHERE tenant_id = $1 AND grant_id = $2 \
          ORDER BY created_at DESC LIMIT $3 OFFSET $4",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .bind(page.limit())
    .bind(page.offset())
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(Paginated::new(rows, grant.event_count, &page)))
}
