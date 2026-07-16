//! Effective-permission resolution — shared so the auth middleware can resolve a
//! user's permission set without depending on the routes layer.
//!
//! `effective = (role_permissions ∪ group_permissions ∪ access_matrix.extra
//!   ∪ active temporary_grants) − access_matrix.denied`.

use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;

/// Resolve the effective permission codes for a user. Bypass roles
/// (`super_admin`, `hospital_admin`) return an empty set — callers treat them as
/// having every permission.
pub async fn resolve_permissions(
    db: &PgPool,
    tenant_id: Uuid,
    user_id: Uuid,
    role: &str,
) -> Result<Vec<String>, AppError> {
    // Bypass roles don't need permissions in the token
    if role == "super_admin" || role == "hospital_admin" {
        return Ok(Vec::new());
    }

    // Get role permissions from roles table
    let role_perms_json = sqlx::query_scalar!(
        "SELECT permissions FROM roles WHERE tenant_id = $1 AND code = $2 AND is_active = true",
        tenant_id,
        role
    )
    .fetch_optional(db)
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
           AND (agm.expires_at IS NULL OR agm.expires_at > now())",
    )
    .bind(tenant_id)
    .bind(user_id)
    .fetch_all(db)
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
    .fetch_optional(db)
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
                if let Some(serde_json::Value::Array(permission_values)) = grant.get("permissions") {
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
