//! Tenant-configurable operational values (audit #209). One read
//! path for settings that used to be hardcoded: appointment slot
//! defaults, front-office visitor rules, hospital holidays. Every
//! getter falls back to the previous hardcoded default, so absent
//! settings keep today's behaviour.

use chrono::{Datelike, NaiveDate};
use uuid::Uuid;

use crate::error::AppError;

pub mod keys {
    pub const CATEGORY: &str = "operations";
    pub const SLOT_DURATION_MINS: &str = "appointment_slot_duration_mins";
    pub const SLOT_CAPACITY: &str = "appointment_slot_capacity";
    pub const SCHEDULE_MAX_PATIENTS: &str = "appointment_max_patients";
    pub const VISITOR_PASS_VALID_HOURS: &str = "visitor_pass_valid_hours";
    pub const MAX_VISITORS_PER_PATIENT: &str = "max_visitors_per_patient";
    pub const HOLIDAYS: &str = "holidays";
}

pub async fn setting_value(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    key: &str,
) -> Result<Option<serde_json::Value>, AppError> {
    let value = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = $2 AND key = $3 AND deleted_at IS NULL",
    )
    .bind(*tenant_id)
    .bind(keys::CATEGORY)
    .bind(key)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(value)
}

pub async fn setting_i32(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    key: &str,
    default: i32,
) -> Result<i32, AppError> {
    let value = setting_value(tx, tenant_id, key).await?;
    let parsed = value.and_then(|v| {
        v.as_i64()
            .or_else(|| v.as_str().and_then(|s| s.parse::<i64>().ok()))
    });
    Ok(parsed
        .and_then(|n| i32::try_from(n).ok())
        .filter(|n| *n > 0)
        .unwrap_or(default))
}

/// True when `date` is in the tenant's `operations.holidays` list
/// (array of `{ "date": "YYYY-MM-DD", "name": ... }`, or of plain
/// date strings). Recurring annual holidays use `"recurring": true`
/// and match on month-day.
pub async fn is_holiday(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    date: NaiveDate,
) -> Result<bool, AppError> {
    let Some(value) = setting_value(tx, tenant_id, keys::HOLIDAYS).await? else {
        return Ok(false);
    };
    let Some(entries) = value.as_array() else {
        return Ok(false);
    };
    Ok(entries.iter().any(|entry| holiday_matches(entry, date)))
}

fn holiday_matches(entry: &serde_json::Value, date: NaiveDate) -> bool {
    let raw = entry
        .as_str()
        .or_else(|| entry.get("date").and_then(serde_json::Value::as_str));
    let Some(parsed) = raw.and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok()) else {
        return false;
    };
    if parsed == date {
        return true;
    }
    let recurring = entry
        .get("recurring")
        .and_then(serde_json::Value::as_bool)
        .unwrap_or(false);
    recurring && parsed.month() == date.month() && parsed.day() == date.day()
}
