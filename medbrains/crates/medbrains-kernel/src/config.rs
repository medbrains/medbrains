//! Configuration: one resolver for settings by path.
//!
//! The RFC's tree (RFC-HOSPITAL-OS §3.1) resolves most specific scope first.
//! K1 reads the **tenant-wide** scope only, from `tenant_settings` through
//! [`setting_in`]; the narrower scopes arrive with K3. The path syntax is already the tree's: `category/key`, and
//! deeper paths parse today (they simply find nothing until K3 stores them).

use std::fmt;

use serde_json::Value;
use sqlx::PgConnection;
use uuid::Uuid;

use crate::{KernelError, Tx};

/// Scopes the resolver consults today, most specific first.
pub const RESOLVED_SCOPES: [&str; 1] = ["hospital"];

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
