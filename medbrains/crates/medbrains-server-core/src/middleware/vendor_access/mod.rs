//! Vendor staff on a hospital's data: only under the hospital's grant.
//!
//! Under DPDP the hospital is the Data Fiduciary and the vendor its Data
//! Processor (`docs/compliance/vendor-access.md`). A vendor account —
//! `users.is_vendor_staff`, or an address on a vendor domain — is refused on
//! every request unless the hospital holds a live `vendor_access_grants` row
//! for it. That includes an account whose role is `super_admin` or
//! `hospital_admin`: its role is replaced for the request by [`VENDOR_ROLE`],
//! which bypasses nothing, and its permissions are exactly the grant's scope.
//!
//! Each request under a grant is recorded in `vendor_access_events` *before*
//! the handler runs, so the hospital sees every action; a grant is read again
//! on every request, so a revocation holds from the next one. A masked grant
//! masks the answer here, on the server, with the AI door's identity fields
//! (`ai_redact`) and the declared field classes (`field_class`) — a download
//! that cannot be masked is refused, not sent.
//!
//! A lookup that fails is a 503, never an open door (three outcomes).

mod mask;
mod scope;

use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};
use std::time::{Duration, Instant};

use axum::{
    extract::Request,
    middleware::Next,
    response::{IntoResponse, Response},
};
use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{error::AppError, middleware::auth::Claims, state::AppState};

pub use mask::mask_value;
pub use scope::{CONFIG_SCOPE, is_config_edit, is_valid_scope, permissions_for_scope};

/// The role a vendor account acts as. In no bypass list and no `roles` row,
/// so every role-based shortcut and every role lookup comes back empty.
pub const VENDOR_ROLE: &str = "vendor_support";

/// What a vendor account may call with no live grant: who it is, and leaving.
const WITHOUT_A_GRANT: [&str; 3] = ["/api/auth/me", "/api/auth/logout", "/api/auth/logout-all"];

/// The longest path recorded on an event row (the column's limit).
const PATH_LIMIT: usize = 300;

/// One refusal audit row per account per window; the rest are counted into
/// the next row, so probing is on record without flooding the chain.
const REFUSAL_WINDOW: Duration = Duration::from_secs(60);

/// Accounts tracked by the refusal limiter before old windows are dropped.
const REFUSAL_TRACKED_MAX: usize = 10_000;

/// The vendor email domains in force (and their subdomains), bound into
/// `app_email_is_vendor`. Defined in `medbrains_core::vendor`, where the
/// outbox worker and the kernel's event gate read it too.
pub use medbrains_core::vendor::vendor_domains;

/// SQL true for a vendor account in `users u`, with the domains bound at `$n`.
/// One definition for every query that must leave vendor accounts out.
#[must_use]
pub fn vendor_account_sql(n: u8) -> String {
    format!("(u.is_vendor_staff OR public.app_email_is_vendor(u.email, ${n}))")
}

/// A grant in force for one request.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct LiveGrant {
    pub id: Uuid,
    pub scope: Vec<String>,
    pub is_masked: bool,
    pub expires_at: DateTime<Utc>,
}

/// Set on a request made under a grant, for handlers that want to say so.
#[derive(Debug, Clone, Copy)]
pub struct VendorSession {
    pub grant_id: Uuid,
    pub is_masked: bool,
}

/// The newest live grant for this account at this hospital.
///
/// # Errors
/// Any database failure, as 503: the decision could not be made, and an
/// undecided vendor request is refused, never let through.
pub async fn live_grant(db: &PgPool, claims: &Claims) -> Result<Option<LiveGrant>, AppError> {
    let unavailable = |e: &dyn std::fmt::Display| {
        tracing::error!(error = %e, "vendor access lookup failed; refusing as 503");
        AppError::ServiceUnavailable("MedBrains access could not be checked".to_owned())
    };
    let mut conn = medbrains_db::pool::tenant_conn(db, &claims.tenant_id)
        .await
        .map_err(|e| unavailable(&e))?;
    sqlx::query_as::<_, LiveGrant>(
        "SELECT id, scope, is_masked, expires_at FROM vendor_access_grants \
          WHERE tenant_id = $1 AND grantee_user_id = $2 AND revoked_at IS NULL \
            AND deleted_at IS NULL AND expires_at > now() \
            AND (is_masked OR approved_at IS NOT NULL) \
          ORDER BY created_at DESC LIMIT 1",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_optional(&mut *conn)
    .await
    .map_err(|e| unavailable(&e))
}

/// Serve one request from a vendor account: refuse it without a live
/// grant, run it with the grant's permissions and an event row otherwise, and
/// mask the answer when the grant is masked.
pub async fn serve(
    state: &AppState,
    mut claims: Claims,
    mut request: Request,
    next: Next,
) -> Response {
    VENDOR_ROLE.clone_into(&mut claims.role);
    claims.permissions = Vec::new();
    let grant = match live_grant(&state.db, &claims).await {
        Ok(grant) => grant,
        Err(e) => return e.into_response(),
    };
    let path = request.uri().path().to_owned();
    let Some(grant) = grant else {
        if WITHOUT_A_GRANT.contains(&path.as_str()) {
            request.extensions_mut().insert(claims.clone());
            return super::auth::run_as(state, &claims, request, next).await;
        }
        audit_refusal(state, &claims, request.method().as_str(), &path).await;
        return AppError::ForbiddenReason(
            "MedBrains access to this hospital is off. The hospital has not granted it, \
             or the grant has ended."
                .to_owned(),
        )
        .into_response();
    };
    claims.permissions = permissions_for_scope(&grant.scope);
    let method = request.method().as_str().to_owned();
    let event_id = match record_event(&state.db, &claims, &grant, &method, &path).await {
        Ok(id) => id,
        Err(e) => return e.into_response(),
    };
    request.extensions_mut().insert(claims.clone());
    request.extensions_mut().insert(VendorSession {
        grant_id: grant.id,
        is_masked: grant.is_masked,
    });
    let response = super::auth::run_as(state, &claims, request, next).await;
    let response = mask::guard_response(response, grant.is_masked).await;
    record_status(&state.db, &claims, event_id, response.status().as_u16()).await;
    response
}

/// Write the event row for a request about to run under `grant`.
///
/// # Errors
/// The row could not be written: 503, and the request does not run — an
/// action the hospital could not see afterwards must not happen.
async fn record_event(
    db: &PgPool,
    claims: &Claims,
    grant: &LiveGrant,
    method: &str,
    path: &str,
) -> Result<Uuid, AppError> {
    let path: String = path.chars().take(PATH_LIMIT).collect();
    let mut conn = medbrains_db::pool::tenant_conn(db, &claims.tenant_id)
        .await
        .map_err(|e| unrecorded(&e))?;
    sqlx::query_scalar(
        "INSERT INTO vendor_access_events (tenant_id, grant_id, user_id, method, path, was_masked) \
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(grant.id)
    .bind(claims.sub)
    .bind(method)
    .bind(&path)
    .bind(grant.is_masked)
    .fetch_one(&mut *conn)
    .await
    .map_err(|e| unrecorded(&e))
}

/// The 503 for an event row that could not be written.
fn unrecorded(e: &dyn std::fmt::Display) -> AppError {
    tracing::error!(error = %e, "vendor access event not recorded; refusing the request");
    AppError::ServiceUnavailable("MedBrains access could not be recorded".to_owned())
}

/// Fill in the answer's status on the event row. Logged, not raised: the
/// answer has already been produced and the row already says it was asked.
async fn record_status(db: &PgPool, claims: &Claims, event_id: Uuid, status: u16) {
    let Ok(code) = i16::try_from(status) else {
        return;
    };
    let result = async {
        let mut conn = medbrains_db::pool::tenant_conn(db, &claims.tenant_id).await?;
        sqlx::query("UPDATE vendor_access_events SET status_code = $1 WHERE id = $2")
            .bind(code)
            .bind(event_id)
            .execute(&mut *conn)
            .await?;
        Ok::<_, medbrains_db::pool::DbError>(())
    }
    .await;
    if let Err(e) = result {
        tracing::error!(error = %e, %event_id, "vendor access event status not recorded");
    }
}

/// Per (tenant, account): when its window opened, and refusals not yet written.
type RefusalWindows = HashMap<(Uuid, Uuid), (Instant, u32)>;

/// Whether to write a refusal row for `key` now, and how many refusals since
/// the last row went unwritten. `None` while the account's window is open.
fn refusal_due(seen: &mut RefusalWindows, key: (Uuid, Uuid), now: Instant) -> Option<u32> {
    if seen.len() >= REFUSAL_TRACKED_MAX {
        seen.retain(|_, (start, _)| now.duration_since(*start) < REFUSAL_WINDOW);
    }
    match seen.get_mut(&key) {
        Some((start, suppressed)) if now.duration_since(*start) < REFUSAL_WINDOW => {
            *suppressed = suppressed.saturating_add(1);
            None
        }
        Some((start, suppressed)) => {
            let earlier = *suppressed;
            *start = now;
            *suppressed = 0;
            Some(earlier)
        }
        None => {
            seen.insert(key, (now, 0));
            Some(0)
        }
    }
}

/// Refusals seen per (tenant, account) in the current window.
static REFUSALS: LazyLock<Mutex<RefusalWindows>> = LazyLock::new(|| Mutex::new(HashMap::new()));

/// Put a refused vendor request on the audit chain, at most once a minute per
/// account, counting the refusals in between: probing a hospital that has not
/// granted access is what the hospital needs to see, and a loop must not
/// flood its chain.
async fn audit_refusal(state: &AppState, claims: &Claims, method: &str, path: &str) {
    // A poisoned lock still audits: the row is written, the count is lost.
    let due = REFUSALS.lock().map_or(Some(0), |mut seen| {
        refusal_due(&mut seen, (claims.tenant_id, claims.sub), Instant::now())
    });
    let Some(earlier) = due else {
        return;
    };
    let path: String = path.chars().take(PATH_LIMIT).collect();
    let details = serde_json::json!({
        "method": method,
        "path": path,
        "refused_since_last_row": earlier,
    });
    let actor = medbrains_kernel::Actor::from_claims(claims);
    let result = medbrains_kernel::work(&state.db, actor, async |tx| {
        medbrains_kernel::audit(
            tx,
            &medbrains_kernel::audit::AuditEntry {
                tenant_id: claims.tenant_id,
                user_id: Some(claims.sub),
                action: "vendor_access_refused",
                entity_type: "vendor_access",
                entity_id: None,
                old_values: None,
                new_values: Some(&details),
                ip_address: None,
            },
        )
        .await
    })
    .await;
    if let Err(e) = result {
        tracing::error!(error = %e, "failed to audit a refused MedBrains request");
    }
}

#[cfg(test)]
mod tests;
