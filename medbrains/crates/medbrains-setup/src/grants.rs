//! The codes a setup edit hands out, for the grant checks.
//!
//! Every setup path that gives someone permission codes — a role, an access
//! matrix, an access group or a place in one — answers to one rule, enforced by
//! `medbrains_server_core::permissions::refuse_escalation_now`: a caller outside
//! the bypass roles grants only codes they hold themselves. Without it
//! `admin.users.update` reached every permission in the system, the caller's
//! own account included. These read what an edit adds.

use medbrains_server_core::error::AppError;
use serde_json::Value;
use sqlx::PgConnection;
use uuid::Uuid;

/// The string codes in a JSON array; anything else holds no codes.
pub(crate) fn codes_in(value: Option<&Value>) -> Vec<String> {
    value
        .and_then(Value::as_array)
        .map(|codes| {
            codes
                .iter()
                .filter_map(Value::as_str)
                .map(str::to_owned)
                .collect()
        })
        .unwrap_or_default()
}

/// The codes in `new` that `old` lacked: what an edit actually grants. A
/// manager re-saving a user who already holds a code they lack is not
/// granting it.
pub(crate) fn added(old: &[String], new: &[String]) -> Vec<String> {
    new.iter()
        .filter(|code| !old.contains(code))
        .cloned()
        .collect()
}

/// The codes a role row carries, by id.
pub(crate) async fn role_codes_by_id(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    id: Uuid,
) -> Result<Vec<String>, AppError> {
    let permissions = sqlx::query_scalar!(
        "SELECT permissions FROM roles WHERE id = $1 AND tenant_id = $2",
        id,
        tenant_id
    )
    .fetch_optional(conn)
    .await?;
    Ok(codes_in(permissions.as_ref()))
}

/// The role a user account holds now, if the account exists.
pub(crate) async fn user_role(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    id: Uuid,
) -> Result<Option<String>, AppError> {
    Ok(sqlx::query_scalar!(
        r#"SELECT role::text AS "role!" FROM users WHERE id = $1 AND tenant_id = $2"#,
        id,
        tenant_id
    )
    .fetch_optional(conn)
    .await?)
}

/// The codes the access groups in `ids` carry between them.
pub(crate) async fn group_codes(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    ids: &[Uuid],
) -> Result<Vec<String>, AppError> {
    if ids.is_empty() {
        return Ok(Vec::new());
    }
    let rows = sqlx::query_scalar!(
        "SELECT permissions FROM access_groups WHERE tenant_id = $1 AND id = ANY($2)",
        tenant_id,
        ids
    )
    .fetch_all(conn)
    .await?;
    Ok(rows
        .iter()
        .flat_map(|codes| codes_in(Some(codes)))
        .collect())
}

#[cfg(test)]
mod tests {
    use super::{added, codes_in};
    use serde_json::json;

    #[test]
    fn only_new_codes_count_as_granted() {
        let old = codes_in(Some(&json!(["a", "b"])));
        let new = codes_in(Some(&json!(["b", "c", 7])));
        assert_eq!(added(&old, &new), vec!["c".to_owned()]);
        assert!(codes_in(Some(&json!({"extra": ["a"]}))).is_empty());
        assert!(codes_in(None).is_empty());
    }
}
