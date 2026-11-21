//! The hospital's own OPD number, kept beside the UHID.
//!
//! Many hospitals have always written an OPD number on the card and want to keep
//! the series. Off unless a hospital turns it on (`tenant_settings` category
//! `opd_number`, key `policy`): `manual` lets the desk type it with the next
//! free number filled in, `auto` assigns it here. Per `patient` it is typed
//! once at first registration and kept on `patients.opd_number`; per `visit`
//! it is each OPD visit's `encounters.encounter_number`.
//!
//! One running series per hospital, plain integers after an optional prefix.
//! The database refuses a number in use (migration 1475, keyed on the number
//! after the prefix); a per-hospital advisory lock makes the check and the
//! write one step, so two desks typing the same number get one success and one
//! refusal that names the UHID and date of the other use, never the name.
//!
//! Per patient the number carries an OPD date, the day it was issued in the
//! paper register, so old records can be entered with their real date. It is
//! today unless the hospital allows backdating (`allow_backdate`) and the
//! caller holds `patients.opd_number.backdate`; never in the future. It is its
//! own column: `created_at` stays the real entry time, and nothing else (no
//! visit, bill, token or queue row) is created for a backdated record.

mod assign;

pub use assign::{Assigned, Entry, Target, assign, check_date, patient_number};

use medbrains_server_core::error::AppError;
use serde::{Deserialize, Serialize};
use sqlx::PgConnection;
use uuid::Uuid;

/// Longest number the desk may type, so it always fits a `bigint`.
const MAX_DIGITS: usize = 12;
/// Longest prefix, so a card still has room for the number.
const MAX_PREFIX: usize = 12;

/// Whether the hospital uses an OPD number, and who picks it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Mode {
    #[default]
    Off,
    Manual,
    Auto,
}

/// What one OPD number belongs to.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Scope {
    #[default]
    Visit,
    Patient,
}

/// A hospital's OPD number policy; the default is every hospital's behaviour
/// before this existed: no number.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct Policy {
    pub mode: Mode,
    pub scope: Scope,
    pub prefix: String,
    pub start: i64,
    /// Whether the desk may give a per-patient OPD date before today.
    pub allow_backdate: bool,
}

impl Default for Policy {
    /// Off, per visit, no prefix, starting at 1, no backdating.
    fn default() -> Self {
        Self {
            mode: Mode::Off,
            scope: Scope::Visit,
            prefix: String::new(),
            start: 1,
            allow_backdate: false,
        }
    }
}

impl Policy {
    /// Refuse a policy the desk could not use: a prefix ending in a digit would
    /// run into the number, and the start must be a number the desk can type.
    ///
    /// # Errors
    /// [`AppError::BadRequest`] saying what to change.
    pub fn validate(&self) -> Result<(), AppError> {
        let prefix_ok = self.prefix.len() <= MAX_PREFIX
            && self
                .prefix
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '/')
            && !self.prefix.ends_with(|c: char| c.is_ascii_digit());
        if !prefix_ok {
            return Err(AppError::BadRequest(
                "Prefix: up to 12 letters, digits, - or /, not ending in a digit".into(),
            ));
        }
        if !(1..=max_number()).contains(&self.start) {
            return Err(AppError::BadRequest("Start at 1 or more".into()));
        }
        Ok(())
    }

    /// The number as the desk and the card show it: prefix, then the integer.
    #[must_use]
    pub fn format(&self, number: i64) -> String {
        format!("{}{number}", self.prefix)
    }

    /// The integer in what the desk typed, with or without the prefix. Leading
    /// zeros are dropped so "007" and "7" are the same number.
    ///
    /// # Errors
    /// [`AppError::BadRequest`] when it is not a positive whole number.
    pub fn parse(&self, typed: &str) -> Result<i64, AppError> {
        let typed = typed.trim();
        let cut = self.prefix.len();
        let has_prefix = cut > 0
            && typed
                .get(..cut)
                .is_some_and(|head| head.eq_ignore_ascii_case(&self.prefix));
        let digits = if has_prefix {
            typed.get(cut..).unwrap_or_default()
        } else {
            typed
        };
        let refused =
            || AppError::BadRequest(format!("OPD number: digits only, like {}", self.format(1)));
        if digits.is_empty()
            || digits.len() > MAX_DIGITS
            || !digits.bytes().all(|b| b.is_ascii_digit())
        {
            return Err(refused());
        }
        digits
            .parse::<i64>()
            .ok()
            .filter(|n| *n >= 1)
            .ok_or_else(refused)
    }
}

/// The highest number the desk may type.
const fn max_number() -> i64 {
    999_999_999_999
}

/// The last number used and the one to suggest next.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Suggestion {
    pub previous: Option<i64>,
    pub next: i64,
}

/// The hospital's policy; a missing or unreadable row is the default (off).
///
/// # Errors
/// A database failure.
pub async fn read_policy(conn: &mut PgConnection, tenant_id: Uuid) -> Result<Policy, AppError> {
    let value = sqlx::query_scalar!(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'opd_number' AND key = 'policy' \
           AND deleted_at IS NULL",
        tenant_id
    )
    .fetch_optional(&mut *conn)
    .await?;
    Ok(value
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default())
}

/// Save a validated policy.
///
/// # Errors
/// [`AppError::BadRequest`] for an unusable policy, or a database failure.
pub async fn write_policy(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    policy: &Policy,
) -> Result<(), AppError> {
    policy.validate()?;
    let value = serde_json::to_value(policy).map_err(|e| AppError::Internal(e.to_string()))?;
    sqlx::query!(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         VALUES ($1, 'opd_number', 'policy', $2) \
         ON CONFLICT (tenant_id, category, key) \
         DO UPDATE SET deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, \
                       value = EXCLUDED.value, updated_at = now()",
        tenant_id,
        value
    )
    .execute(&mut *conn)
    .await?;
    Ok(())
}

/// The last number used, on a patient or a visit, and the next to suggest:
/// one more, or the hospital's start if that is higher. One query, answered
/// from the two unique indexes.
///
/// # Errors
/// A database failure.
pub async fn suggest(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    policy: &Policy,
) -> Result<Suggestion, AppError> {
    let previous = sqlx::query_scalar!(
        r#"SELECT GREATEST(
             (SELECT max((substring(opd_number FROM '([0-9]+)$'))::bigint) FROM patients
               WHERE tenant_id = $1 AND opd_number IS NOT NULL AND deleted_at IS NULL),
             (SELECT max((substring(encounter_number FROM '([0-9]+)$'))::bigint) FROM encounters
               WHERE tenant_id = $1 AND encounter_number IS NOT NULL AND deleted_at IS NULL)
           ) AS "previous""#,
        tenant_id
    )
    .fetch_one(&mut *conn)
    .await?;
    let next = previous.map_or(policy.start, |p| (p + 1).max(policy.start));
    Ok(Suggestion { previous, next })
}

#[cfg(test)]
mod tests {
    use super::{Policy, Scope};

    fn with_prefix(prefix: &str) -> Policy {
        Policy {
            prefix: prefix.into(),
            scope: Scope::Patient,
            ..Policy::default()
        }
    }

    #[test]
    fn plain_numbers_parse_and_format_without_a_prefix() {
        let p = Policy::default();
        assert_eq!(p.parse(" 007 ").ok(), Some(7));
        assert_eq!(p.format(7), "7");
        for bad in ["", "0", "-3", "1.5", "12a", "OP12", "1234567890123"] {
            assert!(p.parse(bad).is_err(), "{bad:?} should be refused");
        }
    }

    #[test]
    fn a_prefix_is_optional_when_typed_and_always_shown() {
        let p = with_prefix("OP-");
        assert_eq!(p.parse("op-42").ok(), Some(42));
        assert_eq!(p.parse("42").ok(), Some(42));
        assert_eq!(p.format(42), "OP-42");
        assert!(p.parse("OP-").is_err());
    }

    #[test]
    fn a_policy_the_desk_cannot_use_is_refused() {
        assert!(Policy::default().validate().is_ok());
        assert!(with_prefix("OPD/2026-").validate().is_ok());
        assert!(with_prefix("OP1").validate().is_err());
        assert!(with_prefix("O P").validate().is_err());
        assert!(
            Policy {
                start: 0,
                ..Policy::default()
            }
            .validate()
            .is_err()
        );
    }
}
