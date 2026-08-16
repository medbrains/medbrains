//! Authenticating a request that arrived on an API key.
//!
//! A key is not a session and must not be treated as one. Three things follow
//! from that, and each is enforced here rather than trusted to handlers:
//!
//! 1. **Permissions come from the key, never from a role.** The key's identity
//!    is a `users` row and that row has a role, because the column is NOT
//!    NULL. If the usual hydration ran, the key would quietly hold whatever
//!    that role holds — and would widen the day somebody widened the role.
//!    So the key's stored allowlist is copied in and hydration is skipped.
//!
//! 2. **The session surface is closed.** Changing a password, enrolling MFA,
//!    listing or revoking sessions — these assume a person, and most carry no
//!    permission check because being logged in was the check. A key reaching
//!    them is a machine credential editing a human's ability to log in.
//!
//! 3. **Every request is recorded.** `last_used_at` answers "is this key still
//!    alive". After a leak the question is "what did it touch", and only a log
//!    answers that.

use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;
use crate::middleware::auth::Claims;

/// Paths an API key may never reach, matched as prefixes.
///
/// A deny list rather than an allow list, because the allow list already
/// exists: a key can only reach a guarded route whose permission it was
/// granted. What this covers is the gap — routes that carry no permission
/// check because authentication was considered sufficient, which is true for a
/// person managing their own account and false for a machine.
const SESSION_ONLY_PREFIXES: [&str; 7] = [
    "/api/auth/",        // login, logout, refresh, password change, /me
    "/api/mfa/",         // enrolment and recovery codes
    "/api/sessions",     // listing and revoking a person's sessions
    "/api/sso/",         // identity-provider linking
    "/api/devices/pair", // device pairing, which mints tokens
    "/api/users/me",     // self-service profile
    "/api/vpn/",         // device credentials
];

/// Whether this path belongs to the human session surface.
pub fn is_session_only(path: &str) -> bool {
    SESSION_ONLY_PREFIXES
        .iter()
        .any(|prefix| path.starts_with(prefix))
}

/// The row behind a presented key, before it has been verified.
struct KeyRecord {
    id: Uuid,
    tenant_id: Uuid,
    key_hash: String,
    permissions: serde_json::Value,
    service_user_id: Option<Uuid>,
}

/// Resolve a presented secret into claims, or refuse.
///
/// This does **not** apply the session-surface rule. That check lives in the
/// middleware, because a key probing `/api/auth/me` is exactly the event worth
/// keeping — and refusing here would return before the request was recorded,
/// making the most interesting thing a stolen key does the one thing invisible
/// in its usage log.
///
/// Every refusal is `Unauthorized` with no detail. Distinguishing "no such
/// key" from "revoked" from "expired" would tell someone holding a stolen key
/// which of those it is, and there is nothing a legitimate caller does with
/// that answer that the key's own console cannot tell them.
pub async fn authenticate(db: &PgPool, presented: &str) -> Result<(Claims, Uuid), AppError> {
    let fingerprint = medbrains_api_keys::fingerprint(presented);

    // Looked up by fingerprint, then verified in constant time. The lookup
    // alone is not the check: it proves a row exists with this hash, and the
    // comparison in `verify` is what proves the caller holds the secret.
    let record = sqlx::query_as::<_, (Uuid, Uuid, String, serde_json::Value, Option<Uuid>)>(
        "SELECT id, tenant_id, key_hash, permissions, service_user_id \
         FROM api_keys \
         WHERE key_hash = $1 AND revoked_at IS NULL AND expires_at > now()",
    )
    .bind(&fingerprint)
    .fetch_optional(db)
    .await?
    .map(
        |(id, tenant_id, key_hash, permissions, service_user_id)| KeyRecord {
            id,
            tenant_id,
            key_hash,
            permissions,
            service_user_id,
        },
    );

    let Some(record) = record else {
        return Err(AppError::Unauthorized);
    };
    if !medbrains_api_keys::verify(presented, &record.key_hash) {
        return Err(AppError::Unauthorized);
    }

    // A key without an identity cannot write anything: every `created_by`
    // would be null against a NOT NULL column, and the failure would surface
    // deep inside an unrelated handler. Refusing here names the real problem.
    let Some(service_user_id) = record.service_user_id else {
        tracing::error!(key = %record.id, "API key has no service identity");
        return Err(AppError::Internal(
            "This API key has no identity and cannot be used. Recreate it.".to_owned(),
        ));
    };

    // The role is read but not trusted for permissions — see the module note.
    // It is carried because handlers and audit records display it.
    let role = sqlx::query_scalar::<_, String>(
        "SELECT role::text FROM users \
         WHERE id = $1 AND is_active = true AND is_service_account = true",
    )
    .bind(service_user_id)
    .fetch_optional(db)
    .await?;

    let Some(role) = role else {
        // The identity was deactivated, or is not a service account — which
        // would mean something reused the row. Either way the key stops.
        return Err(AppError::Unauthorized);
    };

    let permissions: Vec<String> = serde_json::from_value(record.permissions).unwrap_or_default();

    Ok((
        Claims {
            sub: service_user_id,
            tenant_id: record.tenant_id,
            role,
            // The key's own allowlist, and nothing else. No role hydration.
            permissions,
            department_ids: Vec::new(),
            perm_version: 0,
            paired_device_id: None,
            exp: 0,
        },
        record.id,
    ))
}

/// Record what the key did.
///
/// Best-effort on purpose: a full audit table or a slow write must not turn a
/// working integration into an outage. The tradeoff is stated rather than
/// hidden — losing a usage row is recoverable, refusing traffic is not.
pub async fn record_usage(
    db: &PgPool,
    tenant_id: Uuid,
    key_id: Uuid,
    method: &str,
    path: &str,
    status: u16,
) {
    let usage = sqlx::query(
        "INSERT INTO api_key_usage (tenant_id, api_key_id, method, path, status_code) \
         VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(tenant_id)
    .bind(key_id)
    .bind(method)
    .bind(path)
    .bind(i32::from(status))
    .execute(db)
    .await;

    if let Err(error) = usage {
        tracing::warn!(%error, key = %key_id, "could not record API key usage");
    }

    // Coarse on purpose: this answers "is this key still in use", which is the
    // question asked when deciding what to revoke. The per-request detail is
    // the row above.
    let touch = sqlx::query("UPDATE api_keys SET last_used_at = now() WHERE id = $1")
        .bind(key_id)
        .execute(db)
        .await;
    if let Err(error) = touch {
        tracing::warn!(%error, key = %key_id, "could not update API key last_used_at");
    }
}

#[cfg(test)]
mod tests {
    use super::is_session_only;

    #[test]
    fn the_session_surface_is_closed_to_keys() {
        for path in [
            "/api/auth/me",
            "/api/auth/change-password",
            "/api/mfa/enroll",
            "/api/sessions",
            "/api/sso/link",
            "/api/users/me",
            "/api/vpn/devices",
        ] {
            assert!(is_session_only(path), "{path} must be closed to API keys");
        }
    }

    #[test]
    fn ordinary_endpoints_stay_open() {
        for path in [
            "/api/patients",
            "/api/lab/orders",
            "/api/billing/invoices/123",
            // Near-misses: the prefixes must not swallow unrelated routes.
            "/api/authorizations",
            "/api/users",
            "/api/devices/inventory",
        ] {
            assert!(!is_session_only(path), "{path} must remain callable");
        }
    }
}
