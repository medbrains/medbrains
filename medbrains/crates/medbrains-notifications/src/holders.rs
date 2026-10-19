//! Telling everyone who holds a permission — the approvers of an access
//! request, the administrators who assign a new sign-in's role. A request
//! nobody is told about waits until someone happens to open the right page.

use medbrains_server_core::error::AppError;
use uuid::Uuid;

use crate::{NewNotification, create_notification};

/// Bounded: a hospital with more holders than this has a role problem, not a
/// notification problem.
const MAX_HOLDERS: i64 = 50;

/// Holders of the permission by role, group or extra grant, minus denials —
/// the same sources `resolve_permissions` reads — plus the bypass roles.
/// Those who hold it by name come first, then hospital administrators, then
/// platform administrators; within each, whoever signed in most recently.
const HOLDERS_SQL: &str = "\
    SELECT u.id FROM users u \
      LEFT JOIN roles r ON r.tenant_id = u.tenant_id AND r.code = u.role::text \
                       AND r.is_active = true \
     WHERE u.tenant_id = $1 AND u.is_active = true AND u.deleted_at IS NULL \
       AND u.id <> $2 \
       AND NOT COALESCE(u.access_matrix -> 'denied' ? $3, false) \
       AND (u.role::text IN ('super_admin', 'hospital_admin') \
            OR COALESCE(r.permissions ? $3, false) \
            OR COALESCE(u.access_matrix -> 'extra' ? $3, false) \
            OR EXISTS (SELECT 1 FROM access_group_members m \
                         JOIN access_groups g ON g.id = m.group_id AND g.tenant_id = m.tenant_id \
                        WHERE m.tenant_id = u.tenant_id AND m.user_id = u.id \
                          AND g.is_active = true \
                          AND (m.expires_at IS NULL OR m.expires_at > now()) \
                          AND g.permissions ? $3)) \
     ORDER BY u.role::text = 'super_admin', u.role::text = 'hospital_admin', \
              (SELECT MAX(rt.created_at) FROM refresh_tokens rt WHERE rt.user_id = u.id) \
                DESC NULLS LAST, u.id \
     LIMIT $4";

/// Notify every active holder of `permission` in the tenant except `exclude`
/// (the person who caused it). Returns how many were told.
pub async fn notify_permission_holders<'a, F>(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    permission: &str,
    exclude: Uuid,
    make: F,
) -> Result<usize, AppError>
where
    F: Fn(Uuid) -> NewNotification<'a>,
{
    let holders: Vec<Uuid> = sqlx::query_scalar(HOLDERS_SQL)
        .bind(tenant_id)
        .bind(exclude)
        .bind(permission)
        .bind(MAX_HOLDERS)
        .fetch_all(&mut **tx)
        .await?;
    for user_id in &holders {
        create_notification(tx, tenant_id, make(*user_id)).await?;
    }
    Ok(holders.len())
}
