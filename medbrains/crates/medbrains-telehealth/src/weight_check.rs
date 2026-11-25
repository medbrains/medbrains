//! Paediatric weight-based dose check for prescription lines.
//!
//! For a child (under 18) every catalogued line with a dose per kg ends in
//! one of three outcomes (`medbrains_core::weight_dose`): within, over/under,
//! or not checked. A missing or stale weight is "not checked" for every such
//! line — a child's dose is never checked against last year's weight, and
//! never passed because there was no weight to check it against.

use std::collections::HashMap;

use chrono::{DateTime, Utc};
use medbrains_core::weight_dose::{DoseDirection, WeightDoseOutcome, evaluate_weight_dose};
use medbrains_server_core::error::AppError;
use serde::Serialize;
use uuid::Uuid;

use crate::cds::DoseCheckItem;
use crate::dose_check::trim_float;

/// A line more than 25% over or under its weight-based dose.
#[derive(Debug, Serialize)]
pub struct WeightDoseAlert {
    pub drug_name: String,
    /// "over" or "under" the weight-based recommendation.
    pub direction: String,
    /// Prescribed amount per `basis`, e.g. "500 mg".
    pub prescribed_per_day_label: String,
    /// Weight × dose per kg per `basis`, e.g. "300 mg".
    pub recommended_per_day_label: String,
    /// "day" or "dose": what the two labels are per.
    pub basis: &'static str,
    pub weight_kg: f64,
}

/// A line with a dose per kg that could not be checked.
#[derive(Debug, Serialize)]
pub struct WeightNotCheckedAlert {
    pub drug_name: String,
    /// What stopped the check, written for the prescriber.
    pub reason: String,
}

/// The weight-based verdicts for one order.
#[derive(Debug, Default)]
pub struct WeightCheck {
    pub alerts: Vec<WeightDoseAlert>,
    pub not_checked: Vec<WeightNotCheckedAlert>,
}

/// Days a weight stays usable: 7 under one year, 30 for an older child.
/// Proposed, not clinician-confirmed: an infant's weight changes week to
/// week. Owner/clinician to confirm or shorten.
const fn max_weight_age_days(age_months: i32) -> i64 {
    if age_months < 12 { 7 } else { 30 }
}

/// A child's age in months on the hospital's date and latest charted weight.
#[derive(Debug, sqlx::FromRow)]
struct ChildWeight {
    age_months: i32,
    weight_kg: Option<f64>,
    recorded_at: Option<DateTime<Utc>>,
}

/// The patient's age in completed months (hospital date) and latest weight;
/// `None` when the date of birth is not on record.
async fn child_weight(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<Option<ChildWeight>, AppError> {
    let row = sqlx::query_as::<_, ChildWeight>(
        "WITH today AS (SELECT timezone(COALESCE((SELECT timezone FROM tenants WHERE id = $1), \
                                 'UTC'), now())::date AS d), \
              a AS (SELECT age((SELECT d FROM today), p.date_of_birth) AS age FROM patients p \
                    WHERE p.tenant_id = $1 AND p.id = $2 AND p.date_of_birth IS NOT NULL) \
         SELECT (extract(year FROM a.age) * 12 + extract(month FROM a.age))::int AS age_months, \
                w.weight_kg, w.recorded_at \
         FROM a LEFT JOIN LATERAL ( \
             SELECT v.weight_kg::float8 AS weight_kg, v.recorded_at FROM vitals v \
             JOIN encounters e ON e.id = v.encounter_id \
             WHERE v.tenant_id = $1 AND e.patient_id = $2 AND v.weight_kg > 0 AND v.deleted_at IS NULL \
             ORDER BY v.recorded_at DESC LIMIT 1) w ON true",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(row)
}

/// Check each catalogued line that has a dose per kg against the child's
/// weight. Adults and patients with no date of birth are not checked here.
pub async fn weight_check_for_items(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
    items: &[DoseCheckItem],
) -> Result<WeightCheck, AppError> {
    let Some(child) = child_weight(tx, tenant_id, patient_id).await? else {
        return Ok(WeightCheck::default());
    };
    if child.age_months >= 18 * 12 {
        return Ok(WeightCheck::default());
    }
    let rules = per_kg_rules(tx, tenant_id, items).await?;
    let weight = usable_weight(&child, Utc::now());
    let mut check = WeightCheck::default();
    for item in items {
        if let Some(rule) = item.catalog_item_id.and_then(|id| rules.get(&id)) {
            add_line(&mut check, item, rule, &weight);
        }
    }
    Ok(check)
}

/// The weight to dose from, or why there is none: no weight charted, or the
/// last one older than [`max_weight_age_days`] for the child's age.
fn usable_weight(child: &ChildWeight, now: DateTime<Utc>) -> Result<f64, String> {
    let (Some(kg), Some(at)) = (child.weight_kg, child.recorded_at) else {
        return Err("No weight recorded for this child".to_owned());
    };
    let limit = max_weight_age_days(child.age_months);
    let days = (now - at).num_days();
    if days > limit {
        return Err(format!(
            "Last weight is {days} days old; reweigh (older than {limit} days)"
        ));
    }
    Ok(kg)
}

/// One line's verdict against its per-kg rule, added to `check`.
fn add_line(
    check: &mut WeightCheck,
    item: &DoseCheckItem,
    rule: &str,
    weight: &Result<f64, String>,
) {
    let not_checked = |reason: String| WeightNotCheckedAlert {
        drug_name: item.drug_name.clone(),
        reason,
    };
    let kg = match weight {
        Ok(kg) => *kg,
        Err(reason) => return check.not_checked.push(not_checked(reason.clone())),
    };
    match evaluate_weight_dose(&item.dosage, &item.frequency, kg, rule) {
        WeightDoseOutcome::Within => {}
        WeightDoseOutcome::NotChecked(why) => check.not_checked.push(not_checked(why.reason())),
        WeightDoseOutcome::Advice(a) => check.alerts.push(WeightDoseAlert {
            drug_name: item.drug_name.clone(),
            direction: if a.direction == DoseDirection::Over {
                "over"
            } else {
                "under"
            }
            .to_owned(),
            prescribed_per_day_label: format!("{} {}", trim_float(a.prescribed), a.unit),
            recommended_per_day_label: format!("{} {}", trim_float(a.recommended), a.unit),
            basis: a.basis.as_str(),
            weight_kg: kg,
        }),
    }
}

/// The dose-per-kg text per catalogue id (catalogue, else CDS reference),
/// one query for the order; lines without one are left out.
async fn per_kg_rules(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    items: &[DoseCheckItem],
) -> Result<HashMap<Uuid, String>, AppError> {
    let catalog_ids: Vec<Uuid> = items.iter().filter_map(|i| i.catalog_item_id).collect();
    if catalog_ids.is_empty() {
        return Ok(HashMap::new());
    }
    let rows = sqlx::query_as::<_, (Uuid, Option<String>)>(
        "SELECT pc.id, COALESCE(pc.dose_per_kg, ref.dose_per_kg) AS dose_per_kg \
         FROM pharmacy_catalog pc \
         LEFT JOIN cds_drug_reference ref ON lower(ref.generic_name) = \
             lower(COALESCE(NULLIF(pc.inn_name, ''), pc.generic_name, pc.name)) \
         WHERE pc.tenant_id = $1 AND pc.id = ANY($2)",
    )
    .bind(tenant_id)
    .bind(&catalog_ids)
    .fetch_all(&mut **tx)
    .await?;
    Ok(rows
        .into_iter()
        .filter_map(|(id, r)| r.filter(|r| !r.trim().is_empty()).map(|r| (id, r)))
        .collect())
}

#[cfg(test)]
mod tests {
    use chrono::{Duration, Utc};

    use super::{ChildWeight, usable_weight};

    /// A child `age_months` old weighed `days_ago`.
    fn child(age_months: i32, days_ago: Option<i64>) -> ChildWeight {
        ChildWeight {
            age_months,
            weight_kg: days_ago.map(|_| 3.2),
            recorded_at: days_ago.map(|d| Utc::now() - Duration::days(d)),
        }
    }

    #[test]
    fn a_missing_or_stale_weight_is_not_used() {
        let now = Utc::now();
        assert!(usable_weight(&child(2, None), now).is_err());
        assert!(usable_weight(&child(2, Some(10)), now).is_err());
        assert!(usable_weight(&child(2, Some(5)), now).is_ok());
        assert!(usable_weight(&child(60, Some(20)), now).is_ok());
        assert!(usable_weight(&child(60, Some(45)), now).is_err());
    }
}
