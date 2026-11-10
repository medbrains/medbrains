//! Instance variables: the settings that differ between one deployment and the
//! next.
//!
//! Deliberately not a place for secrets. Everything here is readable by
//! anybody who can edit a workflow, because that is what `{{ vars.X }}` means.
//! Credentials are sealed and belong in `credential_entity`.

use super::Database;
use chrono::Utc;
use rusqlite::params;
use serde_json::{Map, Value};

/// How many variables one instance may hold.
///
/// This is configuration somebody typed, not a data store. A cap keeps a
/// runaway script from turning it into one, and keeps the whole set cheap
/// enough to load before every run.
pub const MAX_VARIABLES: usize = 200;

/// How long one value may be.
pub const MAX_VALUE_CHARS: usize = 4096;

/// A name that is not a valid identifier cannot be read back.
///
/// `{{ vars.my-var }}` parses as a subtraction, so a variable named that way
/// would be settable and never readable — a trap worth refusing at the point
/// somebody creates it rather than discovering at run time.
pub fn valid_key(key: &str) -> bool {
    !key.is_empty()
        && key.len() <= 128
        && key.starts_with(|c: char| c.is_ascii_alphabetic() || c == '_')
        && key.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredVariable {
    pub key: String,
    pub value: Value,
    pub updated_at: String,
}

#[derive(Debug)]
pub struct VariableRepository<'a> {
    pub(super) db: &'a Database,
}

impl VariableRepository<'_> {
    pub fn list(&self) -> rusqlite::Result<Vec<StoredVariable>> {
        let conn = self.db.conn();
        let mut stmt =
            conn.prepare("SELECT key, value, updated_at FROM variable_entity ORDER BY key")?;
        let rows = stmt.query_map([], |row| {
            let raw: String = row.get("value")?;
            Ok(StoredVariable {
                key: row.get("key")?,
                value: decode(&raw),
                updated_at: row.get("updated_at")?,
            })
        })?;
        rows.collect()
    }

    /// Every variable, shaped for an expression's `vars`.
    pub fn as_map(&self) -> rusqlite::Result<Map<String, Value>> {
        Ok(self
            .list()?
            .into_iter()
            .map(|variable| (variable.key, variable.value))
            .collect())
    }

    /// Create or replace one variable.
    pub fn set(&self, key: &str, value: &Value) -> rusqlite::Result<()> {
        self.db.conn().execute(
            "INSERT INTO variable_entity (key, value, updated_at) VALUES (?1, ?2, ?3)
             ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = ?3",
            params![key, encode(value), Utc::now().to_rfc3339()],
        )?;
        Ok(())
    }

    pub fn delete(&self, key: &str) -> rusqlite::Result<usize> {
        self.db
            .conn()
            .execute("DELETE FROM variable_entity WHERE key = ?1", params![key])
    }

    pub fn count(&self) -> rusqlite::Result<usize> {
        let total: i64 =
            self.db
                .conn()
                .query_row("SELECT COUNT(*) FROM variable_entity", [], |row| row.get(0))?;
        Ok(usize::try_from(total).unwrap_or(0))
    }

    pub fn exists(&self, key: &str) -> rusqlite::Result<bool> {
        let found: i64 = self.db.conn().query_row(
            "SELECT COUNT(*) FROM variable_entity WHERE key = ?1",
            params![key],
            |row| row.get(0),
        )?;
        Ok(found > 0)
    }
}

/// Values keep their type: a batch size stored as a number comes back a
/// number, and one stored as `"500"` comes back a string. Those two fail
/// differently, and at different times, so flattening them would be a
/// disservice.
fn encode(value: &Value) -> String {
    serde_json::to_string(value).unwrap_or_else(|_| String::from("null"))
}

fn decode(raw: &str) -> Value {
    serde_json::from_str(raw).unwrap_or_else(|_| Value::String(raw.to_owned()))
}
