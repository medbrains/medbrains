//! The hospital's own critical-value rules (`critical_value_rules`): which
//! rule applies to a result, and what it says about the value.
//!
//! One implementation, two callers: result entry (`tenant_critical`) and the
//! knowledge change-set impact preview, which must judge recent results
//! exactly the way result entry would, before and after a proposed change.

use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::units::{Converted, to_reference_unit};

/// One active rule, as the judgement needs it.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, sqlx::FromRow)]
pub struct CriticalRule {
    pub id: Uuid,
    pub test_code: String,
    pub test_name: String,
    pub low_critical: Option<f64>,
    pub high_critical: Option<f64>,
    pub unit: Option<String>,
    pub age_min: Option<i32>,
    pub age_max: Option<i32>,
    pub gender: Option<String>,
}

/// What the tenant's own critical rules say about a value.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TenantCritical {
    /// Outside a limit this hospital wrote down.
    Flagged(&'static str),
    /// A rule applies and the value is inside it. The shared thresholds must
    /// then stay out of the way.
    WithinLimits,
    /// This hospital has no rule for this analyte and this patient.
    NoRule,
}

/// Active rules whose test code or name is one of `names` (lower-cased).
///
/// # Errors
/// The query failed.
pub async fn load_rules(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    names: &[String],
) -> Result<Vec<CriticalRule>, sqlx::Error> {
    sqlx::query_as::<_, CriticalRule>(
        "SELECT id, test_code, test_name, low_critical::float8 AS low_critical, \
                high_critical::float8 AS high_critical, unit, age_min, age_max, gender \
           FROM critical_value_rules \
          WHERE tenant_id = $1 AND is_active = true AND deleted_at IS NULL \
            AND (lower(test_code) = ANY($2) OR lower(test_name) = ANY($2)) \
          ORDER BY created_at, id",
    )
    .bind(tenant_id)
    .bind(names)
    .fetch_all(&mut **tx)
    .await
}

/// The rule that governs `parameter_name` for this patient.
///
/// Most specific first: a rule naming a sex beats one that does not, then one
/// naming an age range beats a blanket one. A rule with an age bound never
/// applies to a patient whose age is unknown.
#[must_use]
pub fn pick_rule<'a>(
    rules: &'a [CriticalRule],
    parameter_name: &str,
    age_years: Option<i32>,
    sex: Option<&str>,
) -> Option<&'a CriticalRule> {
    let name = parameter_name.trim().to_lowercase();
    rules
        .iter()
        .filter(|r| r.test_code.to_lowercase() == name || r.test_name.to_lowercase() == name)
        .filter(|r| {
            r.age_min
                .is_none_or(|min| age_years.is_some_and(|a| a >= min))
        })
        .filter(|r| {
            r.age_max
                .is_none_or(|max| age_years.is_some_and(|a| a <= max))
        })
        .filter(|r| r.gender.is_none() || r.gender.as_deref() == sex)
        .min_by_key(|r| {
            (
                r.gender.is_none(),
                r.age_min.is_none() && r.age_max.is_none(),
            )
        })
}

/// Judge `value` (in `unit`) against `rule`.
#[must_use]
pub fn judge_rule(
    rule: &CriticalRule,
    value: f64,
    unit: Option<&str>,
    parameter_name: &str,
) -> TenantCritical {
    // The rule's limits are in the rule's unit; a value that cannot be put in
    // it has not been ruled on.
    let Converted::Value(value) =
        to_reference_unit(value, unit, rule.unit.as_deref(), parameter_name)
    else {
        return TenantCritical::NoRule;
    };
    if rule.low_critical.is_some_and(|limit| value < limit) {
        return TenantCritical::Flagged("critical_low");
    }
    if rule.high_critical.is_some_and(|limit| value > limit) {
        return TenantCritical::Flagged("critical_high");
    }
    // A rule with neither limit set decides nothing, so it must not silence
    // the shared thresholds either.
    if rule.low_critical.is_none() && rule.high_critical.is_none() {
        return TenantCritical::NoRule;
    }
    TenantCritical::WithinLimits
}

/// Pick and judge in one step; `NoRule` when no rule applies.
#[must_use]
pub fn evaluate(
    rules: &[CriticalRule],
    parameter_name: &str,
    value: f64,
    unit: Option<&str>,
    patient: (Option<i32>, Option<&str>),
) -> TenantCritical {
    pick_rule(rules, parameter_name, patient.0, patient.1).map_or(TenantCritical::NoRule, |r| {
        judge_rule(r, value, unit, parameter_name)
    })
}

/// Whole years between `dob` and `today`, as the lab judges age.
#[must_use]
pub fn age_years(dob: NaiveDate, today: NaiveDate) -> Option<i32> {
    i32::try_from(today.signed_duration_since(dob).num_days() / 365).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rule(gender: Option<&str>, age: Option<(i32, i32)>, low: f64) -> CriticalRule {
        CriticalRule {
            id: Uuid::new_v4(),
            test_code: "K".to_owned(),
            test_name: "Potassium".to_owned(),
            low_critical: Some(low),
            high_critical: Some(6.5),
            unit: None,
            age_min: age.map(|a| a.0),
            age_max: age.map(|a| a.1),
            gender: gender.map(str::to_owned),
        }
    }

    #[test]
    fn the_most_specific_rule_wins() {
        let rules = [
            rule(None, None, 2.5),
            rule(None, Some((0, 12)), 3.0),
            rule(Some("female"), None, 2.8),
        ];
        let child = pick_rule(&rules, "potassium", Some(5), Some("male"));
        assert_eq!(child.and_then(|r| r.low_critical), Some(3.0));
        let woman = pick_rule(&rules, "k", Some(40), Some("female"));
        assert_eq!(woman.and_then(|r| r.low_critical), Some(2.8));
        let unknown_age = pick_rule(&rules, "K", None, Some("male"));
        assert_eq!(unknown_age.and_then(|r| r.low_critical), Some(2.5));
    }

    #[test]
    fn limits_flag_and_an_empty_rule_decides_nothing() {
        let r = rule(None, None, 2.5);
        assert_eq!(
            judge_rule(&r, 2.0, None, "K"),
            TenantCritical::Flagged("critical_low")
        );
        assert_eq!(
            judge_rule(&r, 7.0, None, "K"),
            TenantCritical::Flagged("critical_high")
        );
        assert_eq!(judge_rule(&r, 4.0, None, "K"), TenantCritical::WithinLimits);
        let empty = CriticalRule {
            low_critical: None,
            high_critical: None,
            ..r
        };
        assert_eq!(judge_rule(&empty, 1.0, None, "K"), TenantCritical::NoRule);
    }
}
