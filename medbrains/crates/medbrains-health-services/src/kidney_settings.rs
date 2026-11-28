//! A hospital's kidney-function rules: how old an eGFR may be for renal
//! dosing and contrast screening, and the eGFR below which contrast is held.
//!
//! Stored in `tenant_settings` (`clinical` / `kidney_function_checks`),
//! seeded for every hospital by migration 1499 and edited on Settings →
//! Clinical configuration. A clinician still confirms each rule.

use serde_json::Value;
use sqlx::PgConnection;
use uuid::Uuid;

/// The `tenant_settings` category and key that hold the rules.
pub const SETTING_CATEGORY: &str = "clinical";
pub const SETTING_KEY: &str = "kidney_function_checks";

/// Days an eGFR counts for an inpatient.
///
/// Renal function can change within days in hospital (AKI). ACR Manual on
/// Contrast Media, "Post-Contrast Acute Kidney Injury": the interval is
/// institutional practice; a current (within one week) eGFR for inpatients is
/// the common policy built on it.
pub const DEFAULT_INPATIENT_DAYS: i64 = 7;
/// Days an eGFR counts for an outpatient.
///
/// For stable kidney function, on the same ACR institutional-practice basis.
/// Clinician to confirm.
pub const DEFAULT_OUTPATIENT_DAYS: i64 = 30;
/// Hold contrast for review below this eGFR (mL/min/1.73 m²).
///
/// ACR–NKF consensus statement on intravenous iodinated contrast in kidney
/// disease (Davenport et al., *Radiology* 2020;294:660–668).
pub const DEFAULT_CONTRAST_THRESHOLD: i32 = 30;
/// The thresholds a hospital may choose: 30 (ACR–NKF 2020) or 45 (ESUR
/// Guidelines on Contrast Agents v10; KDIGO 2012 AKI guideline).
pub const CONTRAST_THRESHOLDS: [i32; 2] = [30, 45];
/// The longest window a hospital may set; a year-old eGFR is not "recent".
pub const MAX_DAYS: i64 = 365;

/// The rules in force for one hospital.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct KidneySettings {
    pub inpatient_days: i64,
    pub outpatient_days: i64,
    pub contrast_threshold: i32,
}

impl Default for KidneySettings {
    /// The published defaults above.
    fn default() -> Self {
        Self {
            inpatient_days: DEFAULT_INPATIENT_DAYS,
            outpatient_days: DEFAULT_OUTPATIENT_DAYS,
            contrast_threshold: DEFAULT_CONTRAST_THRESHOLD,
        }
    }
}

impl KidneySettings {
    /// The rules in a stored value. A field that is missing or out of range
    /// takes its default, never a looser value: the generic settings writer
    /// does not validate, so the reader must.
    #[must_use]
    pub fn from_value(value: &Value) -> Self {
        let d = Self::default();
        let days = |key: &str, fallback: i64| {
            (value.get(key).and_then(Value::as_i64))
                .filter(|n| (1..=MAX_DAYS).contains(n))
                .unwrap_or(fallback)
        };
        let threshold = (value.get("contrast_egfr_threshold").and_then(Value::as_i64))
            .and_then(|n| i32::try_from(n).ok())
            .filter(|n| CONTRAST_THRESHOLDS.contains(n))
            .unwrap_or(d.contrast_threshold);
        Self {
            inpatient_days: days("egfr_inpatient_days", d.inpatient_days),
            outpatient_days: days("egfr_outpatient_days", d.outpatient_days),
            contrast_threshold: threshold,
        }
    }

    /// Days an eGFR counts for a patient who is, or is not, admitted.
    #[must_use]
    pub const fn window_days(&self, inpatient: bool) -> i64 {
        if inpatient {
            self.inpatient_days
        } else {
            self.outpatient_days
        }
    }

    /// The hospital's rules; the defaults when none is stored.
    ///
    /// # Errors
    /// The database read failed: the caller reports it, never the defaults.
    pub async fn read(conn: &mut PgConnection, tenant_id: Uuid) -> Result<Self, sqlx::Error> {
        let value = sqlx::query_scalar!(
            "SELECT value FROM tenant_settings \
             WHERE tenant_id = $1 AND category = $2 AND key = $3 AND deleted_at IS NULL",
            tenant_id,
            SETTING_CATEGORY,
            SETTING_KEY
        )
        .fetch_optional(conn)
        .await?;
        Ok(value.as_ref().map(Self::from_value).unwrap_or_default())
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::KidneySettings;

    #[test]
    fn reads_a_stored_value_and_refuses_loose_ones() {
        let cases = [
            (json!({}), (7, 30, 30)),
            (
                json!({"egfr_inpatient_days": 3, "egfr_outpatient_days": 90, "contrast_egfr_threshold": 45}),
                (3, 90, 45),
            ),
            (
                json!({"egfr_inpatient_days": 0, "egfr_outpatient_days": 366, "contrast_egfr_threshold": 60}),
                (7, 30, 30),
            ),
            (json!({"egfr_inpatient_days": "7"}), (7, 30, 30)),
            (json!("garbage"), (7, 30, 30)),
        ];
        for (value, (inp, out, thr)) in cases {
            let s = KidneySettings::from_value(&value);
            let got = (s.inpatient_days, s.outpatient_days, s.contrast_threshold);
            assert_eq!(got, (inp, out, thr), "{value}");
        }
    }

    #[test]
    fn an_inpatient_gets_the_inpatient_window() {
        let s = KidneySettings::default();
        assert_eq!((s.window_days(true), s.window_days(false)), (7, 30));
    }
}
