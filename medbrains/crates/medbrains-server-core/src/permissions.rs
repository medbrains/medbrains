//! Effective-permission resolution — shared so the auth middleware can resolve a
//! user's permission set without depending on the routes layer.
//!
//! `effective = (role_permissions ∪ group_permissions ∪ access_matrix.extra
//!   ∪ active temporary_grants) − access_matrix.denied`.

use chrono::{DateTime, Utc};
use sqlx::{PgConnection, PgPool};
use uuid::Uuid;

use crate::error::AppError;
use crate::middleware::auth::Claims;
use crate::middleware::authorization::is_bypass_role;

/// Resolve the effective permission codes for a user. Bypass roles
/// (`super_admin`, `hospital_admin`) return an empty set — callers treat them as
/// having every permission.
///
/// A deleted role carries no codes: deleting a role is a soft delete, so the
/// row stays and must be filtered out.
pub async fn resolve_permissions(
    db: &PgPool,
    tenant_id: Uuid,
    user_id: Uuid,
    role: &str,
) -> Result<Vec<String>, AppError> {
    let mut conn = medbrains_db::pool::tenant_conn(db, &tenant_id).await?;
    resolve_permissions_on(&mut conn, tenant_id, user_id, role).await
}

/// [`resolve_permissions`] on a connection the caller already holds.
///
/// It sees that connection's uncommitted writes, so a sign-in reads the access groups it synced in
/// its own transaction. The connection must already carry the tenant context.
pub async fn resolve_permissions_on(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    user_id: Uuid,
    role: &str,
) -> Result<Vec<String>, AppError> {
    // Bypass roles don't need permissions in the token. A vendor session's
    // permissions are its grant's and nothing else: re-applying the account's
    // own `access_matrix.extra` here would hand back what the grant withheld.
    if role == "super_admin"
        || role == "hospital_admin"
        || role == crate::middleware::vendor_access::VENDOR_ROLE
    {
        return Ok(Vec::new());
    }

    // Get role permissions from roles table
    let role_perms_json = sqlx::query_scalar!(
        "SELECT permissions FROM roles WHERE tenant_id = $1 AND code = $2 AND is_active = true \
         AND deleted_at IS NULL",
        tenant_id,
        role
    )
    .fetch_optional(&mut *conn)
    .await?;

    let mut perms: std::collections::HashSet<String> = std::collections::HashSet::new();

    if let Some(role_permissions) = role_perms_json {
        insert_permissions_from_value(&mut perms, &role_permissions);
    }

    let group_permission_rows = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT ag.permissions \
         FROM access_group_members agm \
         JOIN access_groups ag ON ag.id = agm.group_id AND ag.tenant_id = agm.tenant_id \
         WHERE agm.tenant_id = $1 \
           AND agm.user_id = $2 \
           AND ag.is_active = true \
           AND agm.deleted_at IS NULL \
           AND (agm.expires_at IS NULL OR agm.expires_at > now())",
    )
    .bind(tenant_id)
    .bind(user_id)
    .fetch_all(&mut *conn)
    .await?;

    for group_permissions in group_permission_rows {
        insert_permissions_from_value(&mut perms, &group_permissions);
    }

    // Get user access_matrix overrides
    let access_matrix = sqlx::query_scalar!(
        "SELECT access_matrix FROM users WHERE id = $1 AND tenant_id = $2",
        user_id,
        tenant_id
    )
    .fetch_optional(&mut *conn)
    .await?;

    if let Some(serde_json::Value::Object(matrix)) = access_matrix {
        // Add extra permissions
        if let Some(serde_json::Value::Array(extra)) = matrix.get("extra") {
            for val in extra {
                if let serde_json::Value::String(s) = val {
                    perms.insert(s.clone());
                }
            }
        }
        // Add active IAM temporary grants. These are created by
        // /api/iam/access-requests/{id}/approve and are ignored once
        // revoked or past expires_at.
        if let Some(serde_json::Value::Array(grants)) = matrix.get("temporary_grants") {
            for grant in grants {
                if !temporary_grant_is_active(grant) {
                    continue;
                }
                if let Some(serde_json::Value::Array(permission_values)) = grant.get("permissions")
                {
                    for val in permission_values {
                        if let serde_json::Value::String(s) = val {
                            perms.insert(s.clone());
                        }
                    }
                }
            }
        }
        // Remove denied permissions
        if let Some(serde_json::Value::Array(denied)) = matrix.get("denied") {
            for val in denied {
                if let serde_json::Value::String(s) = val {
                    perms.remove(s);
                }
            }
        }
    }

    let mut result: Vec<String> = perms.into_iter().collect();
    result.sort();
    Ok(result)
}

fn insert_permissions_from_value(
    permissions: &mut std::collections::HashSet<String>,
    value: &serde_json::Value,
) {
    if let serde_json::Value::Array(arr) = value {
        for val in arr {
            if let serde_json::Value::String(s) = val {
                permissions.insert(s.clone());
            }
        }
    }
}

fn temporary_grant_is_active(grant: &serde_json::Value) -> bool {
    if grant
        .get("revoked_at")
        .and_then(serde_json::Value::as_str)
        .is_some()
    {
        return false;
    }

    if let Some(expires_at) = grant.get("expires_at").and_then(serde_json::Value::as_str) {
        match DateTime::parse_from_rfc3339(expires_at) {
            Ok(parsed) => parsed.with_timezone(&Utc) > Utc::now(),
            Err(_) => false,
        }
    } else {
        true
    }
}

/// Refuse to hand out permission codes the caller does not hold in `held`.
///
/// The one rule behind every grant path (API keys, connected apps, a user's
/// extras, access groups, roles, temporary grants): a non-bypass caller can
/// only pass on what they already have, so holding a "manage users" code is
/// never a route to every permission. Bypass roles hold everything already.
/// `what` names the thing receiving the codes, for the refusal message.
pub fn refuse_escalation(
    claims: &Claims,
    held: &[String],
    requested: &[String],
    what: &str,
) -> Result<(), AppError> {
    if is_bypass_role(claims) {
        return Ok(());
    }
    let mut missing: Vec<&str> = requested
        .iter()
        .map(String::as_str)
        .filter(|code| !held.iter().any(|h| h == code))
        .collect();
    if missing.is_empty() {
        return Ok(());
    }
    missing.sort_unstable();
    missing.dedup();
    Err(AppError::ForbiddenReason(format!(
        "You cannot grant {what} permissions you do not hold yourself: {}.",
        missing.join(", ")
    )))
}

/// [`refuse_escalation`] against the caller's permissions as they stand now,
/// not as the session token captured them — a code taken away since sign-in
/// must not still be grantable.
pub async fn refuse_escalation_now(
    db: &PgPool,
    claims: &Claims,
    requested: &[String],
    what: &str,
) -> Result<(), AppError> {
    if is_bypass_role(claims) || requested.is_empty() {
        return Ok(());
    }
    let held = resolve_permissions(db, claims.tenant_id, claims.sub, &claims.role).await?;
    refuse_escalation(claims, &held, requested, what)
}

/// Refuse a non-bypass caller handing out a bypass role: it holds every code,
/// so no subset of the caller's could cover it.
pub fn refuse_bypass_role(claims: &Claims, role: &str) -> Result<(), AppError> {
    if is_bypass_role(claims) || !crate::middleware::authorization::BYPASS_ROLES.contains(&role) {
        return Ok(());
    }
    Err(AppError::ForbiddenReason(format!(
        "Only a hospital administrator can give someone the {role} role."
    )))
}

/// Refuse a non-bypass caller changing an account that holds a bypass role.
///
/// Demoting, deactivating or re-addressing an administrator, or resetting
/// their password, is taking over or locking out the account that could undo
/// it; only another bypass administrator may.
pub fn refuse_bypass_target(claims: &Claims, target_role: &str) -> Result<(), AppError> {
    if is_bypass_role(claims)
        || !crate::middleware::authorization::BYPASS_ROLES.contains(&target_role)
    {
        return Ok(());
    }
    Err(AppError::ForbiddenReason(
        "Only a hospital administrator can change an administrator's account.".to_owned(),
    ))
}

/// Refuse giving `roles` beyond the caller's own codes.
///
/// Assigning a role is granting its codes. Checked for the whole set at once,
/// so an import of many rows resolves the caller once.
pub async fn refuse_roles_beyond_own(
    db: &PgPool,
    claims: &Claims,
    roles: &[&str],
) -> Result<(), AppError> {
    if is_bypass_role(claims) {
        return Ok(());
    }
    let mut conn = medbrains_db::pool::tenant_conn(db, &claims.tenant_id).await?;
    let mut codes = std::collections::HashSet::new();
    for role in roles {
        refuse_bypass_role(claims, role)?;
        let permissions = sqlx::query_scalar!(
            "SELECT permissions FROM roles WHERE tenant_id = $1 AND code = $2 AND is_active = true \
         AND deleted_at IS NULL",
            claims.tenant_id,
            role
        )
        .fetch_optional(&mut *conn)
        .await?;
        if let Some(permissions) = permissions {
            insert_permissions_from_value(&mut codes, &permissions);
        }
    }
    let codes: Vec<String> = codes.into_iter().collect();
    refuse_escalation_now(db, claims, &codes, "a user's role").await
}

/// Refuse a non-bypass caller changing their own role, access matrix or
/// group memberships: otherwise anyone who manages users manages themselves.
pub fn refuse_self_change(claims: &Claims, target_user: Uuid) -> Result<(), AppError> {
    if is_bypass_role(claims) || claims.sub != target_user {
        return Ok(());
    }
    Err(AppError::ForbiddenReason(
        "You cannot change your own access. Ask another administrator.".to_owned(),
    ))
}

#[cfg(test)]
mod escalation_tests {
    use super::{refuse_bypass_target, refuse_escalation, refuse_self_change};
    use crate::middleware::auth::Claims;
    use uuid::Uuid;

    /// Claims for a caller of `role` holding no permissions of their own.
    fn claims(role: &str) -> Claims {
        Claims {
            sub: Uuid::nil(),
            tenant_id: Uuid::nil(),
            role: role.to_owned(),
            permissions: Vec::new(),
            department_ids: Vec::new(),
            perm_version: 0,
            paired_device_id: None,
            act: None,
            exp: 0,
        }
    }

    #[test]
    fn only_held_codes_can_be_granted() {
        let held = vec!["patients.view".to_owned()];
        let manager = claims("receptionist");
        assert!(refuse_escalation(&manager, &held, &held, "a role").is_ok());
        let wider = vec!["patients.view".to_owned(), "billing.refund".to_owned()];
        let err = refuse_escalation(&manager, &held, &wider, "a role");
        assert!(format!("{err:?}").contains("billing.refund"));
        assert!(refuse_escalation(&claims("hospital_admin"), &[], &wider, "a role").is_ok());
    }

    #[test]
    fn nobody_but_a_bypass_role_edits_themselves() {
        assert!(refuse_self_change(&claims("receptionist"), Uuid::nil()).is_err());
        assert!(refuse_self_change(&claims("receptionist"), Uuid::new_v4()).is_ok());
        assert!(refuse_self_change(&claims("super_admin"), Uuid::nil()).is_ok());
    }

    #[test]
    fn only_a_bypass_role_changes_a_bypass_account() {
        assert!(refuse_bypass_target(&claims("receptionist"), "hospital_admin").is_err());
        assert!(refuse_bypass_target(&claims("receptionist"), "super_admin").is_err());
        assert!(refuse_bypass_target(&claims("receptionist"), "nurse").is_ok());
        assert!(refuse_bypass_target(&claims("hospital_admin"), "super_admin").is_ok());
    }
}
