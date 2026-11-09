//! The codes a setup edit hands out, for the grant checks.
//!
//! Every setup path that gives someone permission codes — a role, an access
//! matrix, an access group or a place in one — answers to one rule, enforced by
//! `medbrains_server_core::permissions::refuse_escalation_now`: a caller outside
//! the bypass roles grants only codes they hold themselves. Without it
//! `admin.users.update` reached every permission in the system, the caller's
//! own account included. These read what an edit adds.

use std::collections::HashMap;

use medbrains_core::form::FieldAccessLevel;
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

/// A role row as a grant check needs it, locked until the edit commits.
pub(crate) struct LockedRole {
    pub code: String,
    pub is_system: bool,
    pub codes: Vec<String>,
}

/// The live role row `id`, locked `FOR UPDATE`: the codes an edit is checked
/// against cannot change under it before it writes. A deleted role is not
/// found, so it cannot be edited back into use.
pub(crate) async fn lock_role(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    id: Uuid,
) -> Result<Option<LockedRole>, AppError> {
    let row = sqlx::query!(
        "SELECT code, is_system, permissions FROM roles \
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL FOR UPDATE",
        id,
        tenant_id
    )
    .fetch_optional(conn)
    .await?;
    Ok(row.map(|r| LockedRole {
        code: r.code,
        is_system: r.is_system,
        codes: codes_in(Some(&r.permissions)),
    }))
}

/// Whether anything gives out `code` as a role: an account holding it, a
/// directory group mapping to it, a provider defaulting new sign-ins to it, or
/// a pending invitation for it. Renaming a role any of these name, or to a
/// code they name, moves codes onto those people unchecked.
pub(crate) async fn role_is_held(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    code: &str,
) -> Result<bool, AppError> {
    Ok(sqlx::query_scalar!(
        r#"SELECT (
            EXISTS (SELECT 1 FROM users
                WHERE tenant_id = $1 AND role::text = $2 AND deleted_at IS NULL)
            OR EXISTS (SELECT 1 FROM idp_group_mappings
                WHERE tenant_id = $1 AND role_code = $2)
            OR EXISTS (SELECT 1 FROM identity_providers
                WHERE tenant_id = $1 AND default_role = $2)
            OR EXISTS (SELECT 1 FROM user_invitations
                WHERE tenant_id = $1 AND role = $2
                  AND accepted_at IS NULL AND expires_at > now())
        ) AS "held!""#,
        tenant_id,
        code
    )
    .fetch_one(conn)
    .await?)
}

/// Whether `a` and `b` hold the same ids, ignoring order and repeats: a
/// department list sent back reordered is not a change of access.
pub(crate) fn same_set(a: &[Uuid], b: &[Uuid]) -> bool {
    let a: std::collections::HashSet<&Uuid> = a.iter().collect();
    let b: std::collections::HashSet<&Uuid> = b.iter().collect();
    a == b
}

/// What a user account holds now that an edit to it is checked against.
pub(crate) struct UserAccess {
    pub role: String,
    pub department_ids: Vec<Uuid>,
}

/// The account `id`'s role and departments, locked `FOR UPDATE` so the checks
/// and the write see the same account.
pub(crate) async fn user_access(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    id: Uuid,
) -> Result<Option<UserAccess>, AppError> {
    let row = sqlx::query!(
        r#"SELECT role::text AS "role!", department_ids FROM users
           WHERE id = $1 AND tenant_id = $2 FOR UPDATE"#,
        id,
        tenant_id
    )
    .fetch_optional(conn)
    .await?;
    Ok(row.map(|r| UserAccess {
        role: r.role,
        department_ids: r.department_ids,
    }))
}

/// The codes the access groups in `ids` carry between them, the rows locked
/// `FOR UPDATE` so a group cannot widen between the check and the write.
pub(crate) async fn group_codes(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    ids: &[Uuid],
) -> Result<Vec<String>, AppError> {
    if ids.is_empty() {
        return Ok(Vec::new());
    }
    let rows = sqlx::query_scalar!(
        "SELECT permissions FROM access_groups WHERE tenant_id = $1 AND id = ANY($2) FOR UPDATE",
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

/// How much a field-access level lets through, most open highest. An unknown
/// level counts as `hidden`, the safe reading.
fn openness(level: &str) -> u8 {
    match level {
        "edit" => 3,
        "view" => 2,
        "mask" => 1,
        _ => 0,
    }
}

/// [`openness`] of a level the caller holds.
const fn held_openness(level: FieldAccessLevel) -> u8 {
    match level {
        FieldAccessLevel::Edit => 3,
        FieldAccessLevel::View => 2,
        FieldAccessLevel::Mask => 1,
        FieldAccessLevel::Hidden => 0,
    }
}

/// The fields an edit to a field-access map opens wider than the caller's
/// own access to them, sorted: the field-level form of "grant only what you
/// hold". `caller` is the caller's restrictions (a field absent from it is
/// `edit`), `old` the map before, `new` the map asked for. Only changed
/// entries count; dropping an entry counts as `edit`, since it can only
/// widen.
pub(crate) fn fields_beyond_own(
    caller: &HashMap<String, FieldAccessLevel>,
    old: Option<&Value>,
    new: &HashMap<String, String>,
) -> Vec<String> {
    let before = |field: &str| old.and_then(|o| o.get(field)).and_then(Value::as_str);
    let own = |field: &str| caller.get(field).map_or(3, |l| held_openness(*l));
    let changed = new
        .iter()
        .filter(|(field, level)| before(field) != Some(level.as_str()))
        .map(|(field, level)| (field.as_str(), openness(level)));
    let dropped = old
        .and_then(Value::as_object)
        .into_iter()
        .flat_map(|o| o.keys())
        .filter(|field| !new.contains_key(*field))
        .map(|field| (field.as_str(), openness("edit")));
    let mut wider: Vec<String> = changed
        .chain(dropped)
        .filter(|(field, level)| *level > own(field))
        .map(|(field, _)| field.to_owned())
        .collect();
    wider.sort_unstable();
    wider
}

#[cfg(test)]
mod tests {
    use super::{FieldAccessLevel, HashMap, added, codes_in, fields_beyond_own, same_set};
    use serde_json::json;
    use uuid::Uuid;

    #[test]
    fn a_field_opens_no_wider_than_the_caller_sees_it() {
        let caller = HashMap::from([
            ("patients.phone".to_owned(), FieldAccessLevel::Mask),
            ("patients.hiv".to_owned(), FieldAccessLevel::Hidden),
        ]);
        let old = json!({ "patients.phone": "hidden", "patients.hiv": "view" });
        let ask = |pairs: &[(&str, &str)]| -> HashMap<String, String> {
            pairs
                .iter()
                .map(|(f, l)| ((*f).to_owned(), (*l).to_owned()))
                .collect()
        };
        // Masked to the caller: may mask for others, not show it.
        let mask = ask(&[("patients.phone", "mask"), ("patients.hiv", "view")]);
        assert!(fields_beyond_own(&caller, Some(&old), &mask).is_empty());
        let view = ask(&[("patients.phone", "view"), ("patients.hiv", "view")]);
        assert_eq!(
            fields_beyond_own(&caller, Some(&old), &view),
            ["patients.phone"]
        );
        // An unchanged entry the caller could not set is not theirs to answer for.
        // Dropping one widens it, so it counts.
        let dropped = ask(&[("patients.phone", "hidden")]);
        assert_eq!(
            fields_beyond_own(&caller, Some(&old), &dropped),
            ["patients.hiv"]
        );
        // A field the caller is not restricted on, they may set as they like.
        let free = ask(&[
            ("patients.phone", "hidden"),
            ("patients.hiv", "view"),
            ("x.y", "edit"),
        ]);
        assert!(fields_beyond_own(&caller, Some(&old), &free).is_empty());
    }

    #[test]
    fn only_new_codes_count_as_granted() {
        let old = codes_in(Some(&json!(["a", "b"])));
        let new = codes_in(Some(&json!(["b", "c", 7])));
        assert_eq!(added(&old, &new), vec!["c".to_owned()]);
        assert!(codes_in(Some(&json!({"extra": ["a"]}))).is_empty());
        assert!(codes_in(None).is_empty());
    }

    #[test]
    fn departments_compare_as_sets() {
        let (a, b) = (Uuid::new_v4(), Uuid::new_v4());
        assert!(same_set(&[a, b], &[b, a]));
        assert!(same_set(&[a, a], &[a]));
        assert!(!same_set(&[a], &[a, b]));
    }
}
