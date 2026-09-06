//! Issuing, listing and revoking machine credentials.
//!
//! ## The two rules that make this safe
//!
//! **A key is created with an identity, in one transaction.** Every write in
//! this system names a `created_by` user, and ninety-nine foreign keys enforce
//! it. A key without its service account would authenticate and then fail on
//! the first write it attempted, somewhere far from here. So the identity and
//! the key are one commit or neither.
//!
//! **Nobody can mint a key stronger than themselves.** Without that,
//! `admin.api_keys.create` is a route to every permission in the system: grant
//! a clerk the ability to issue keys and they can issue one that prescribes.
//! The check is in [`refuse_escalation`].
//!
//! The secret is returned exactly once, by the create call. It is stored only
//! as a hash, so there is no second chance and no support path that recovers
//! it — losing it means issuing a new key, which is the correct outcome.

use axum::{
    Json, Router,
    extract::{Path, State},
    routing::{get, post},
};
use chrono::{DateTime, Duration, Utc};
use medbrains_core::permissions;
use medbrains_server_core::{
    error::AppError,
    middleware::{auth::Claims, authorization::is_bypass_role, authorization::require_permission},
    state::AppState,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/admin/api-keys", get(list).post(create))
        .route("/api/admin/api-keys/{id}/revoke", post(revoke))
        .route("/api/admin/api-keys/{id}/usage", get(usage))
}

/// The longest a key may live.
///
/// Long enough not to be a nuisance, short enough that a forgotten key stops
/// working while the person who created it is still reachable. The database
/// requires an expiry; this bounds it.
const MAX_LIFETIME_DAYS: i64 = 365;

#[derive(Debug, Deserialize)]
pub struct CreateKeyRequest {
    pub name: String,
    pub description: Option<String>,
    pub permissions: Vec<String>,
    /// Defaults to 90 days. Capped at [`MAX_LIFETIME_DAYS`].
    pub expires_in_days: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct CreatedKey {
    pub id: Uuid,
    /// Shown once and never again.
    pub secret: String,
    pub prefix: String,
    pub name: String,
    pub permissions: Vec<String>,
    pub expires_at: DateTime<Utc>,
    /// The username of the identity this key acts as, so the person creating
    /// it can recognise it in an audit trail later.
    pub acts_as: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct KeySummary {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub key_prefix: String,
    pub permissions: serde_json::Value,
    pub expires_at: DateTime<Utc>,
    pub last_used_at: Option<DateTime<Utc>>,
    pub revoked_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    /// The human who issued it. A machine action traces to a key, and the key
    /// traces to a person.
    pub created_by_name: Option<String>,
}

/// Refuse to mint a key carrying permissions the caller does not hold.
///
/// Bypass roles may grant anything the key layer itself permits — they already
/// hold every permission, so requiring them to enumerate would be theatre.
/// What they still cannot do is put a wildcard or a bypass role on a key;
/// `mint` refuses those regardless of who is asking.
fn refuse_escalation(claims: &Claims, requested: &[String]) -> Result<(), AppError> {
    if is_bypass_role(claims) {
        return Ok(());
    }
    let mut missing: Vec<&str> = requested
        .iter()
        .map(String::as_str)
        .filter(|code| !claims.permissions.iter().any(|held| held == code))
        .collect();

    if missing.is_empty() {
        return Ok(());
    }
    missing.sort_unstable();
    Err(AppError::ForbiddenReason(format!(
        "You cannot grant a key permissions you do not hold yourself: {}.",
        missing.join(", ")
    )))
}

/// A username for the key's identity, derived from the key's name.
///
/// `users.username` is constrained to `^[a-z][a-z0-9_]*$`, so the name is
/// reduced to that alphabet. The `svc_` prefix makes a service account
/// recognisable at a glance in any list that has not been taught about
/// `is_service_account`, and the id suffix keeps two keys called "Lab" apart.
fn service_username(name: &str, id: Uuid) -> String {
    let slug: String = name
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() {
                c.to_ascii_lowercase()
            } else {
                '_'
            }
        })
        .collect();
    let slug = slug.trim_matches('_').replace("__", "_");
    let short = &id.simple().to_string()[..8];
    let trimmed: String = slug.chars().take(24).collect();
    if trimmed.is_empty() {
        format!("svc_{short}")
    } else {
        format!("svc_{trimmed}_{short}")
    }
}

async fn create(
    State(state): State<AppState>,
    axum::Extension(claims): axum::Extension<Claims>,
    Json(body): Json<CreateKeyRequest>,
) -> Result<Json<CreatedKey>, AppError> {
    require_permission(&claims, permissions::admin::api_keys::CREATE)?;
    refuse_escalation(&claims, &body.permissions)?;

    let name = body.name.trim().to_owned();
    if name.is_empty() {
        return Err(AppError::BadRequest(
            "A key needs a name — an unnamed key is one nobody dares revoke.".to_owned(),
        ));
    }

    let days = body
        .expires_in_days
        .unwrap_or(90)
        .clamp(1, MAX_LIFETIME_DAYS);
    let expires_at = Utc::now() + Duration::days(days);

    // Refuses wildcards, bypass roles and an empty list. Done before any
    // write, so a rejected key leaves nothing behind.
    let minted = medbrains_api_keys::mint(medbrains_api_keys::Environment::Live, &body.permissions)
        .map_err(|error| AppError::BadRequest(error.to_string()))?;

    let key_id = Uuid::new_v4();
    let username = service_username(&name, key_id);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // The identity first, because the key references it. Both or neither —
    // see the module note.
    let service_user_id: Uuid = sqlx::query_scalar!(
        "INSERT INTO users (tenant_id, username, email, full_name, role, is_service_account, \
         is_active, email_verified) \
         VALUES ($1, $2, $3, $4, 'service_account', true, true, false) \
         RETURNING id",
        claims.tenant_id,
        &username,
        // Routable nowhere on purpose: `.invalid` is reserved by RFC 2606, so a
        // notification addressed here fails loudly instead of reaching a stranger.
        format!("{username}@service.invalid"),
        &name,
    )
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query!(
        "INSERT INTO api_keys (id, tenant_id, name, description, key_prefix, key_hash, \
         permissions, expires_at, created_by, service_user_id) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
        key_id,
        claims.tenant_id,
        &name,
        body.description.as_deref(),
        &minted.prefix,
        &minted.hash,
        serde_json::json!(body.permissions),
        expires_at,
        claims.sub,
        service_user_id,
    )
    .execute(&mut *tx)
    .await?;

    let created_audit = serde_json::json!({
        "name": name,
        "permissions": body.permissions,
        "expires_at": expires_at,
        "acts_as": username,
    });
    medbrains_db::audit::AuditLogger::log(
        &mut tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action: "api_key_created",
            entity_type: "api_key",
            entity_id: Some(key_id),
            old_values: None,
            // The permissions granted, deliberately: this is the record of how
            // wide the credential was, and the key row can be deleted.
            new_values: Some(&created_audit),
            ip_address: None,
        },
    )
    .await
    .map_err(AppError::from)?;

    tx.commit().await?;
    tracing::info!(key = %key_id, by = %claims.sub, "API key issued");

    Ok(Json(CreatedKey {
        id: key_id,
        secret: minted.secret,
        prefix: minted.prefix,
        name,
        permissions: body.permissions,
        expires_at,
        acts_as: username,
    }))
}

async fn list(
    State(state): State<AppState>,
    axum::Extension(claims): axum::Extension<Claims>,
) -> Result<Json<Vec<KeySummary>>, AppError> {
    require_permission(&claims, permissions::admin::api_keys::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    // `key_hash` is never selected. There is nothing useful a console does
    // with it and every place it travels is another place it can leak.
    let rows = sqlx::query_as!(
        KeySummary,
        "SELECT k.id, k.name, k.description, k.key_prefix, k.permissions, k.expires_at, \
         k.last_used_at, k.revoked_at, k.created_at, u.full_name AS created_by_name \
         FROM api_keys k LEFT JOIN users u ON u.id = k.created_by \
         WHERE k.tenant_id = $1 ORDER BY k.created_at DESC",
        claims.tenant_id,
    )
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;

    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct RevokeRequest {
    pub reason: Option<String>,
}

async fn revoke(
    State(state): State<AppState>,
    axum::Extension(claims): axum::Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<RevokeRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::admin::api_keys::REVOKE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // `revoked_at IS NULL` in the predicate rather than a read-then-write:
    // two administrators revoking at once would otherwise overwrite each
    // other's reason, and the second would report success having done nothing.
    let service_user_id: Option<Uuid> = sqlx::query_scalar!(
        "UPDATE api_keys SET revoked_at = now(), revoked_by = $3, revoke_reason = $4 \
         WHERE id = $1 AND tenant_id = $2 AND revoked_at IS NULL \
         RETURNING service_user_id",
        id,
        claims.tenant_id,
        claims.sub,
        body.reason.as_deref(),
    )
    .fetch_optional(&mut *tx)
    .await?
    .flatten();

    let Some(service_user_id) = service_user_id else {
        return Err(AppError::NotFound);
    };

    // The identity goes too. Leaving it active would keep a login-incapable
    // row in every user list forever, and the audit history still resolves
    // because deactivating does not delete.
    sqlx::query("UPDATE users SET is_active = false WHERE id = $1 AND is_service_account = true")
        .bind(service_user_id)
        .execute(&mut *tx)
        .await?;

    let revoke_audit = serde_json::json!({ "reason": body.reason });
    medbrains_db::audit::AuditLogger::log(
        &mut tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action: "api_key_revoked",
            entity_type: "api_key",
            entity_id: Some(id),
            old_values: None,
            new_values: Some(&revoke_audit),
            ip_address: None,
        },
    )
    .await
    .map_err(AppError::from)?;

    tx.commit().await?;
    tracing::info!(key = %id, by = %claims.sub, "API key revoked");

    Ok(Json(serde_json::json!({ "revoked": true })))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct UsageRow {
    pub method: String,
    pub path: String,
    pub status_code: i32,
    pub occurred_at: DateTime<Utc>,
}

async fn usage(
    State(state): State<AppState>,
    axum::Extension(claims): axum::Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<UsageRow>>, AppError> {
    require_permission(&claims, permissions::admin::api_keys::VIEW_USAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    // Bounded: this table grows by one row per request the key makes, so an
    // unbounded select is a busy integration's way of exhausting memory.
    let rows = sqlx::query_as!(
        UsageRow,
        "SELECT method, path, status_code, occurred_at FROM api_key_usage \
         WHERE api_key_id = $1 AND tenant_id = $2 \
         ORDER BY occurred_at DESC LIMIT 500",
        id,
        claims.tenant_id,
    )
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;

    Ok(Json(rows))
}

#[cfg(test)]
mod tests {
    use super::{refuse_escalation, service_username};
    use medbrains_server_core::middleware::auth::Claims;
    use uuid::Uuid;

    fn claims(role: &str, permissions: &[&str]) -> Claims {
        Claims {
            sub: Uuid::nil(),
            tenant_id: Uuid::nil(),
            role: role.to_owned(),
            permissions: permissions.iter().map(|p| (*p).to_owned()).collect(),
            department_ids: Vec::new(),
            perm_version: 0,
            paired_device_id: None,
            exp: 0,
        }
    }

    #[test]
    fn a_key_cannot_be_granted_what_its_creator_lacks() {
        let clerk = claims("billing_clerk", &["admin.api_keys.create", "billing.view"]);
        let error = refuse_escalation(&clerk, &["billing.view".into(), "opd.prescribe".into()])
            .expect_err("a clerk minted a key that can prescribe");
        assert!(
            error.to_string().contains("opd.prescribe"),
            "the refusal must name what was missing, or nobody can fix it: {error}",
        );
    }

    #[test]
    fn a_key_may_carry_what_its_creator_holds() {
        let clerk = claims("billing_clerk", &["billing.view", "billing.create"]);
        assert!(refuse_escalation(&clerk, &["billing.view".into()]).is_ok());
    }

    #[test]
    fn bypass_roles_may_grant_without_enumerating() {
        // Their `permissions` is empty by design — the role short-circuits
        // every check — so a naive subset test would refuse them everything.
        let admin = claims("hospital_admin", &[]);
        assert!(refuse_escalation(&admin, &["opd.prescribe".into()]).is_ok());
    }

    #[test]
    fn service_usernames_satisfy_the_username_constraint() {
        let id = Uuid::from_u128(0x1234_5678_9abc_def0_1234_5678_9abc_def0);
        for name in [
            "Lab Integration",
            "  Billing  Sync  ",
            "X-Ray/PACS bridge",
            "日本語",
            "!!!",
        ] {
            let username = service_username(name, id);
            assert!(
                username
                    .chars()
                    .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_'),
                "`{username}` (from `{name}`) breaks chk_users_username_pattern",
            );
            assert!(
                username.starts_with("svc_"),
                "{username} is not marked as a service account"
            );
        }
    }
}
