//! Max-dose-per-day check for prescription lines against the catalogue.
//!
//! Shared by the CDS rail (`cds::check_drug_safety`) and the prescribe-time
//! backstop (`medbrains-opd::create_prescription`). Each line ends in one of
//! three outcomes (`medbrains_core::dose_safety::MaxDoseOutcome`): within, over,
//! or not checked. A line that could not be checked is returned, so the screen
//! says so instead of reading as within the limit.

use std::collections::HashMap;

use medbrains_core::dose_safety::{MaxDoseOutcome, evaluate_max_dose};
use medbrains_server_core::error::AppError;
use serde::Serialize;
use uuid::Uuid;

use crate::cds::DoseCheckItem;

/// A line whose daily total is over the catalogue maximum.
#[derive(Debug, Serialize)]
pub struct DoseAlert {
    pub drug_name: String,
    pub per_dose: String,
    pub doses_per_day: u32,
    pub total_per_day_label: String,
    pub max_per_day_label: String,
}

/// A line with a catalogue maximum whose dose could not be compared with it.
#[derive(Debug, Serialize)]
pub struct DoseNotCheckedAlert {
    pub drug_name: String,
    pub per_dose: String,
    pub frequency: String,
    /// What stopped the check, written for the prescriber.
    pub reason: String,
}

/// The max-dose verdicts for one order.
#[derive(Debug, Default)]
pub struct DoseCheck {
    pub alerts: Vec<DoseAlert>,
    pub not_checked: Vec<DoseNotCheckedAlert>,
}

/// Check each catalogued line against its maximum daily dose (catalogue
/// value, else the CDS drug reference). Lines with no maximum on record are
/// left out; every other line is either within, an alert, or not checked.
pub async fn dose_alerts_for_items(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    items: &[DoseCheckItem],
) -> Result<DoseCheck, AppError> {
    let catalog_ids: Vec<Uuid> = items.iter().filter_map(|i| i.catalog_item_id).collect();
    if catalog_ids.is_empty() {
        return Ok(DoseCheck::default());
    }
    let max_by_id = max_doses(tx, tenant_id, &catalog_ids).await?;
    let mut check = DoseCheck::default();
    for item in items {
        let Some(max_raw) = item.catalog_item_id.and_then(|id| max_by_id.get(&id)) else {
            continue;
        };
        match evaluate_max_dose(&item.dosage, &item.frequency, max_raw) {
            MaxDoseOutcome::Within => {}
            MaxDoseOutcome::Exceeded(hit) => check.alerts.push(DoseAlert {
                drug_name: item.drug_name.clone(),
                per_dose: item.dosage.clone(),
                doses_per_day: hit.doses_per_day,
                total_per_day_label: format!("{} {}", trim_float(hit.total_per_day), hit.unit),
                max_per_day_label: format!("{} {}", trim_float(hit.max_per_day), hit.unit),
            }),
            MaxDoseOutcome::NotChecked(why) => check.not_checked.push(DoseNotCheckedAlert {
                drug_name: item.drug_name.clone(),
                per_dose: item.dosage.clone(),
                frequency: item.frequency.clone(),
                reason: why.reason(),
            }),
        }
    }
    Ok(check)
}

/// The maximum daily dose text per catalogue id, one query for the order.
async fn max_doses(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    catalog_ids: &[Uuid],
) -> Result<HashMap<Uuid, String>, AppError> {
    let rows = sqlx::query_as::<_, (Uuid, Option<String>)>(
        "SELECT pc.id, COALESCE(pc.max_dose_per_day, ref.max_dose_per_day) AS max_dose_per_day \
         FROM pharmacy_catalog pc \
         LEFT JOIN cds_drug_reference ref ON lower(ref.generic_name) = \
             lower(COALESCE(NULLIF(pc.inn_name, ''), pc.generic_name, pc.name)) \
         WHERE pc.tenant_id = $1 AND pc.id = ANY($2)",
    )
    .bind(tenant_id)
    .bind(catalog_ids)
    .fetch_all(&mut **tx)
    .await?;
    Ok(rows
        .into_iter()
        .filter_map(|(id, max)| max.filter(|m| !m.trim().is_empty()).map(|m| (id, m)))
        .collect())
}

/// Render a dose value without a trailing `.0` for whole numbers.
pub(crate) fn trim_float(value: f64) -> String {
    if (value.fract()).abs() < f64::EPSILON {
        format!("{value:.0}")
    } else {
        format!("{value}")
    }
}
