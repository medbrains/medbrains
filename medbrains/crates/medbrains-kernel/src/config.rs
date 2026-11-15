//! Configuration: one resolver for settings by path.
//!
//! The RFC's tree (RFC-HOSPITAL-OS §3.1) resolves most specific scope first.
//! [`get`] reads the **tenant-wide** scope, from `tenant_settings` through
//! [`setting_in`]. [`categories_in`] also reads the facility and user scopes
//! (`scoped_settings`), built first for the locale profile (RFC-WORLD-READY
//! §2.2); the rest of the tree moves behind it with K3. The path syntax is
//! already the tree's: `category/key`, and deeper paths parse today.

use std::fmt;

use serde_json::Value;
use sqlx::PgConnection;
use uuid::Uuid;

use crate::{KernelError, Tx};

/// Scopes the resolver consults, most specific first.
pub const RESOLVED_SCOPES: [&str; 3] = ["user", "facility", "hospital"];

/// The narrower scopes one caller sits in: their own user and the facility
/// they work at. `None` skips that scope.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct Scopes {
    pub user: Option<Uuid>,
    pub facility: Option<Uuid>,
}

/// One stored value and the scope that set it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ScopedValue {
    pub category: String,
    pub key: String,
    /// One of [`RESOLVED_SCOPES`].
    pub scope: &'static str,
    pub value: Value,
}

/// A parsed setting path: the first segment is the category, the rest the key.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConfigPath<'a> {
    pub category: &'a str,
    pub key: &'a str,
}

/// Why a path was refused.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InvalidPath(pub String);

impl fmt::Display for InvalidPath {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "invalid setting path '{}'", self.0)
    }
}

impl std::error::Error for InvalidPath {}

fn valid_segment(segment: &str) -> bool {
    !segment.is_empty()
        && segment.bytes().all(|b| {
            b.is_ascii_lowercase() || b.is_ascii_digit() || matches!(b, b'_' | b'-' | b'.')
        })
}

/// Parse `backup/retention_days` into category `backup`, key
/// `retention_days`. At least two segments, each lowercase ASCII letters,
/// digits, `_`, `-` or `.`; no empty segments.
pub fn parse(path: &str) -> Result<ConfigPath<'_>, InvalidPath> {
    let invalid = || InvalidPath(path.to_owned());
    let (category, key) = path.split_once('/').ok_or_else(invalid)?;
    if !valid_segment(category) || !key.split('/').all(valid_segment) {
        return Err(invalid());
    }
    Ok(ConfigPath { category, key })
}

/// The value at `path` for the unit of work's tenant, most specific scope
/// first; `None` when no scope sets it.
#[inline]
pub async fn get(tx: &mut Tx, path: &str) -> Result<Option<Value>, KernelError> {
    let parsed = parse(path).map_err(|e| KernelError::BadRequest(e.to_string()))?;
    let tenant_id = tx.actor().tenant_id;
    Ok(setting_in(tx, &tenant_id, parsed.category, parsed.key).await?)
}

/// The tenant's value for `category`/`key` in `tenant_settings`, if set.
pub async fn setting_in(
    conn: &mut PgConnection,
    tenant_id: &Uuid,
    category: &str,
    key: &str,
) -> Result<Option<Value>, sqlx::Error> {
    sqlx::query_scalar::<_, Value>(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = $2 AND key = $3 AND deleted_at IS NULL",
    )
    .bind(*tenant_id)
    .bind(category)
    .bind(key)
    .fetch_optional(conn)
    .await
}

/// The scope name for a rank `categories_in` sorts by (0 = most specific).
const fn scope_name(rank: i32) -> &'static str {
    match rank {
        0 => RESOLVED_SCOPES[0],
        1 => RESOLVED_SCOPES[1],
        _ => RESOLVED_SCOPES[2],
    }
}

/// Every live value of `categories` in the named scopes and the tenant-wide one.
///
/// Ordered by category and key, then most specific scope first, in one round
/// trip however many categories a screen needs. Callers
/// that apply per-field scope rules (the locale profile) pick the first value
/// a rule allows; others take the first per key.
///
/// # Errors
/// The database error, never an empty answer in its place.
pub async fn categories_in(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    categories: &[&str],
    scopes: Scopes,
) -> Result<Vec<ScopedValue>, sqlx::Error> {
    let categories: Vec<String> = categories.iter().map(|c| (*c).to_owned()).collect();
    let rows = sqlx::query!(
        r#"SELECT category AS "category!", key AS "key!", value AS "value!", rank AS "rank!"
             FROM (
             SELECT category, key, value, CASE scope WHEN 'user' THEN 0 ELSE 1 END AS rank
               FROM scoped_settings
              WHERE tenant_id = $1 AND category = ANY($2) AND deleted_at IS NULL
                AND ((scope = 'user' AND scope_id = $3) OR (scope = 'facility' AND scope_id = $4))
             UNION ALL
             SELECT category, key, value, 2 FROM tenant_settings
              WHERE tenant_id = $1 AND category = ANY($2) AND deleted_at IS NULL
           ) s ORDER BY category, key, rank"#,
        tenant_id,
        &categories,
        scopes.user,
        scopes.facility,
    )
    .fetch_all(conn)
    .await?;
    Ok(rows
        .into_iter()
        .map(|r| ScopedValue {
            category: r.category,
            key: r.key,
            scope: scope_name(r.rank),
            value: r.value,
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::{ConfigPath, parse};

    #[test]
    fn category_then_key() {
        assert_eq!(
            parse("discharge/tpa_required"),
            Ok(ConfigPath {
                category: "discharge",
                key: "tpa_required"
            })
        );
    }

    #[test]
    fn deeper_paths_keep_the_rest_as_the_key() {
        assert_eq!(
            parse("ward/icu-1/visiting.hours"),
            Ok(ConfigPath {
                category: "ward",
                key: "icu-1/visiting.hours"
            })
        );
    }

    #[test]
    fn refuses_paths_that_name_nothing() {
        for bad in [
            "",
            "discharge",
            "/key",
            "discharge/",
            "a//b",
            "Discharge/x",
            "a/b c",
            "a/b/",
        ] {
            assert!(parse(bad).is_err(), "{bad:?} should be refused");
        }
    }
}
