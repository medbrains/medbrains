//! The hospital's payment-link terms: `tenant_settings` category `payments`,
//! key `balance_link`, edited on Billing → Settings. Anything not set takes
//! the default here.

use rust_decimal::Decimal;
use serde::Deserialize;
use uuid::Uuid;

/// Owner decision (2026-10-20): a patient may pay all or part by link.
const DEFAULT_ACCEPT_PARTIAL: bool = true;
/// Inferred, not from a spec: small enough for any household, large enough
/// that a link is not paid off in ₹1 pieces.
const DEFAULT_MIN_PART_RUPEES: i64 = 100;
/// The issue's default.
const DEFAULT_EXPIRY_DAYS: i64 = 7;
/// Inferred bound: Razorpay allows up to six months; a bill link left open
/// longer than a quarter is a link nobody is watching.
pub const MAX_EXPIRY_DAYS: i64 = 90;

/// How links are made at this hospital.
#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(default)]
pub struct LinkSettings {
    pub accept_partial: bool,
    /// The least a part may be; also the least a link for part of the due may ask.
    pub min_part_amount: Decimal,
    pub expiry_days: i64,
    /// Let the provider remind the payer until the link is paid or expires.
    pub reminders: bool,
}

impl Default for LinkSettings {
    fn default() -> Self {
        Self {
            accept_partial: DEFAULT_ACCEPT_PARTIAL,
            min_part_amount: Decimal::from(DEFAULT_MIN_PART_RUPEES),
            expiry_days: DEFAULT_EXPIRY_DAYS,
            reminders: false,
        }
    }
}

impl LinkSettings {
    /// Days a link stays open, within 1 and [`MAX_EXPIRY_DAYS`].
    #[must_use]
    pub fn expiry_days(&self) -> i64 {
        self.expiry_days.clamp(1, MAX_EXPIRY_DAYS)
    }

    /// The least part, never below zero.
    #[must_use]
    pub fn min_part(&self) -> Decimal {
        self.min_part_amount.max(Decimal::ZERO).round_dp(2)
    }
}

/// The hospital's settings; the defaults for anything unset or unreadable.
///
/// # Errors
/// A database fault.
pub async fn load(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
) -> Result<LinkSettings, sqlx::Error> {
    let stored: Option<serde_json::Value> = sqlx::query_scalar(
        "SELECT value FROM tenant_settings WHERE tenant_id = $1 AND category = 'payments' \
            AND key = 'balance_link' AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(stored
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unset_fields_take_the_defaults_and_expiry_is_bounded() {
        let s: LinkSettings =
            serde_json::from_value(serde_json::json!({ "expiry_days": 400 })).unwrap_or_default();
        assert!(s.accept_partial);
        assert_eq!(s.min_part(), Decimal::from(100));
        assert_eq!(s.expiry_days(), MAX_EXPIRY_DAYS);
        assert_eq!(LinkSettings::default().expiry_days(), 7);
    }
}
