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

use std::collections::HashSet;
use std::sync::LazyLock;

use axum::{
    body::Body,
    extract::Request,
    http::{HeaderValue, header},
    middleware::Next,
    response::{IntoResponse, Response},
};
use chrono::{DateTime, Utc};
use medbrains_authz::classification::DataClass;
use medbrains_core::access::catalogue::{all_codes, module_of};
use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

use crate::{error::AppError, middleware::auth::Claims, state::AppState};

/// The role a vendor account acts as. In no bypass list and no `roles` row,
/// so every role-based shortcut and every role lookup comes back empty.
pub const VENDOR_ROLE: &str = "vendor_support";

/// The scope entry meaning configuration only: the `admin` module, less
/// [`NEVER_UNDER_A_GRANT`] and [`NOT_CONFIGURATION`].
pub const CONFIG_SCOPE: &str = "config";

/// What a vendor account may call with no live grant: who it is, and leaving.
const WITHOUT_A_GRANT: [&str; 3] = ["/api/auth/me", "/api/auth/logout", "/api/auth/logout-all"];

/// Codes no grant carries, whatever its scope. Each one would let a grant
/// outlive itself or widen itself: make accounts, roles, keys or devices, grant
/// access, read or start break-glass, or take a whole copy of the data.
const NEVER_UNDER_A_GRANT: &[&str] = &[
    "security.vendor_access",
    "security.access",
    "admin.users",
    "admin.roles",
    "admin.api_keys",
    "admin.access_requests",
    "admin.connected_apps",
    "admin.signature_credentials",
    "admin.sharing",
    "admin.security",
    "admin.backup",
    "audit.break_glass",
    "audit.log",
    "audit.access",
    "devices.machines",
    "devices.pairing",
    "vpn",
];

/// `admin` codes that touch patient records or their payloads, so are not
/// "configuration" even though they sit in the admin module.
const NOT_CONFIGURATION: &[&str] = &[
    "admin.history_import",
    "admin.migration",
    "admin.outbox",
    "admin.error_tracking",
];

/// The answer a masked session cannot see. One fixed marker: nothing of the
/// value, not even its length, leaves the server.
const MASK: &str = "[MASKED]";

/// The largest JSON answer masked in memory (32 MiB); a larger one is refused.
const MASK_LIMIT: usize = 32 * 1024 * 1024;

/// The longest path recorded on an event row (the column's limit).
const PATH_LIMIT: usize = 300;

/// Email domains whose accounts are vendor accounts:
/// `MEDBRAINS_VENDOR_EMAIL_DOMAINS`, comma-separated, default `medbrains.in`.
/// Set it to an empty string on a vendor-run tenant of the vendor's own.
static VENDOR_DOMAINS: LazyLock<Vec<String>> = LazyLock::new(|| {
    std::env::var("MEDBRAINS_VENDOR_EMAIL_DOMAINS")
        .unwrap_or_else(|_| "medbrains.in".to_owned())
        .split(',')
        .map(|d| d.trim().trim_start_matches('@').to_lowercase())
        .filter(|d| !d.is_empty())
        .collect()
});

/// The configured vendor email domains, for the auth lookup's `= ANY($n)`.
#[must_use]
pub fn vendor_domains() -> &'static [String] {
    &VENDOR_DOMAINS
}

/// Keys a masked session never sees the value of: every identity and
/// attachment field the AI door pseudonymises, every declared field class that
/// is not routine, and the free-text clinical fields where a name is typed.
/// `name` alone is left out: it names departments, drugs and roles far more
/// often than a person, and a patient's name is caught by its own keys.
static MASKED_KEYS: LazyLock<HashSet<&'static str>> = LazyLock::new(|| {
    let classed = medbrains_authz::field_class::FIELD_CLASSES
        .iter()
        .filter(|f| f.class != DataClass::Routine)
        .filter_map(|f| f.key.rsplit('.').next())
        .filter(|k| *k != "name");
    // ponytail: hand list of free-text keys; grows with FIELD_CLASSES.
    let free_text = [
        "notes",
        "clinical_notes",
        "chief_complaint",
        "history_of_present_illness",
        "findings",
        "impression",
        "advice",
        "remarks",
        "assessment",
        "plan",
    ];
    medbrains_core::ai_redact::identity_field_names()
        .chain(classed)
        .chain(free_text)
        .collect()
});

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

/// Whether a code may ever be carried by a grant.
fn is_grantable(code: &str) -> bool {
    !NEVER_UNDER_A_GRANT
        .iter()
        .any(|p| code == *p || code.starts_with(&format!("{p}.")))
}

/// Whether `code` falls inside one scope entry.
fn in_entry(code: &str, entry: &str) -> bool {
    if entry == CONFIG_SCOPE {
        return module_of(code) == "admin"
            && !NOT_CONFIGURATION
                .iter()
                .any(|p| code == *p || code.starts_with(&format!("{p}.")));
    }
    module_of(code) == entry
}

/// The permission codes a grant of `scope` carries — the whole of what a
/// vendor account may do under it.
#[must_use]
pub fn permissions_for_scope(scope: &[String]) -> Vec<String> {
    all_codes()
        .iter()
        .filter(|code| is_grantable(code) && scope.iter().any(|e| in_entry(code, e)))
        .map(|code| (*code).to_owned())
        .collect()
}

/// Whether each scope entry names something a grant can open.
///
/// That is `config`, or a module with at least one grantable code. Unknown entries are refused rather
/// than ignored, so a typo never reads as a grant that works.
#[must_use]
pub fn is_valid_scope(scope: &[String]) -> bool {
    !scope.is_empty()
        && scope
            .iter()
            .all(|e| !permissions_for_scope(std::slice::from_ref(e)).is_empty())
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

/// Whether `claims` names a vendor account. For paths that authenticate
/// themselves outside the auth middleware (the notification socket).
///
/// # Errors
/// A failed lookup, as 503 — never read as "not a vendor account".
pub async fn is_vendor_account(db: &PgPool, claims: &Claims) -> Result<bool, AppError> {
    let unavailable = |e: &dyn std::fmt::Display| {
        tracing::error!(error = %e, "vendor account lookup failed; refusing as 503");
        AppError::ServiceUnavailable("MedBrains access could not be checked".to_owned())
    };
    let mut conn = medbrains_db::pool::tenant_conn(db, &claims.tenant_id)
        .await
        .map_err(|e| unavailable(&e))?;
    let found: Option<bool> = sqlx::query_scalar(
        "SELECT COALESCE(is_vendor_staff OR lower(split_part(email, '@', 2)) = ANY($3), false) \
           FROM users WHERE id = $1 AND tenant_id = $2",
    )
    .bind(claims.sub)
    .bind(claims.tenant_id)
    .bind(vendor_domains())
    .fetch_optional(&mut *conn)
    .await
    .map_err(|e| unavailable(&e))?;
    // No row: not this tenant's account at all, so treat it as the stricter kind.
    Ok(found.unwrap_or(true))
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
    let mut response = super::auth::run_as(state, &claims, request, next).await;
    if grant.is_masked {
        response = mask_response(response).await;
    }
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

/// Put a refused vendor request on the audit chain: probing a hospital
/// that has not granted access is exactly what the hospital needs to see.
async fn audit_refusal(state: &AppState, claims: &Claims, method: &str, path: &str) {
    let entry = medbrains_db::audit::HttpAuditEntry {
        tenant_id: claims.tenant_id,
        user_id: Some(claims.sub),
        correlation_id: Uuid::new_v4(),
        action: "vendor_access_refused".to_owned(),
        entity_type: path
            .trim_start_matches("/api/")
            .split('/')
            .next()
            .unwrap_or("unknown")
            .to_owned(),
        entity_id: None,
        ip_address: None,
        user_agent: None,
        session_id: None,
        module: Some("security".to_owned()),
        status_code: 403,
        method: method.to_owned(),
        acting_agent: None,
    };
    if let Err(e) = medbrains_db::audit::AuditLogger::log_http(&state.db, &entry).await {
        tracing::error!(error = %e, "failed to audit a refused MedBrains request");
    }
}

/// Mask a successful answer for a masked session. JSON is masked in place; an
/// empty body passes; anything else (a PDF, an image, a stream) is refused,
/// because it cannot be masked and must not be sent.
async fn mask_response(response: Response) -> Response {
    if !response.status().is_success() {
        return response;
    }
    let (mut parts, body) = response.into_parts();
    let is_json = parts
        .headers
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .is_some_and(|v| v.starts_with("application/json"));
    let Ok(bytes) = axum::body::to_bytes(body, MASK_LIMIT).await else {
        return refuse_unmaskable("This answer is too large to mask.");
    };
    if bytes.is_empty() {
        return Response::from_parts(parts, Body::empty());
    }
    if !is_json {
        return refuse_unmaskable(
            "Files and downloads are not available while patient data is masked.",
        );
    }
    let Ok(mut value) = serde_json::from_slice::<Value>(&bytes) else {
        return refuse_unmaskable("This answer could not be masked.");
    };
    if let Err(e) = mask_value(&mut value) {
        tracing::error!(error = %e, "masking failed; refusing as 503");
        return AppError::ServiceUnavailable("The answer could not be masked".to_owned())
            .into_response();
    }
    let Ok(masked) = serde_json::to_vec(&value) else {
        return refuse_unmaskable("This answer could not be masked.");
    };
    parts.headers.remove(header::CONTENT_LENGTH);
    if let Ok(len) = HeaderValue::from_str(&masked.len().to_string()) {
        parts.headers.insert(header::CONTENT_LENGTH, len);
    }
    Response::from_parts(parts, Body::from(masked))
}

/// The 403 for an answer a masked session may not have.
fn refuse_unmaskable(reason: &str) -> Response {
    AppError::ForbiddenReason(reason.to_owned()).into_response()
}

/// Mask `value` for a masked session: restricted clinical records are withheld
/// whole first (`ai_redact::sensitive`), then every [`MASKED_KEYS`] value.
/// Returns how many values were touched.
///
/// # Errors
/// The sensitive-class markers could not be compiled — the caller must refuse.
pub fn mask_value(value: &mut Value) -> Result<usize, String> {
    let withheld = medbrains_core::ai_redact::sensitive::withhold_in_json(value)?;
    Ok(withheld + mask_keys(value))
}

/// Replace the value of every masked key, at any depth.
fn mask_keys(value: &mut Value) -> usize {
    match value {
        Value::Object(map) => map
            .iter_mut()
            .map(|(key, v)| {
                if MASKED_KEYS.contains(key.to_lowercase().as_str()) {
                    if v.is_null() {
                        0
                    } else {
                        *v = Value::String(MASK.to_owned());
                        1
                    }
                } else {
                    mask_keys(v)
                }
            })
            .sum(),
        Value::Array(items) => items.iter_mut().map(mask_keys).sum(),
        _ => 0,
    }
}

#[cfg(test)]
#[path = "vendor_access_tests.rs"]
mod tests;
