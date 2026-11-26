//! Renal (eGFR) and hepatic dosing advisories for the CDS rail.
//!
//! The eGFR a renal rule doses from must be an eGFR — per 1.73 m² of body
//! surface — and recent. A creatinine clearance in mL/min, or a value from
//! last year, is not one. When no result qualifies, a line with a renal rule
//! is reported as **not checked**, never as needing no adjustment.

use chrono::NaiveDate;
pub(crate) use medbrains_health_services::egfr::patient_latest_egfr;
use medbrains_health_services::egfr::{EGFR_RECENCY_DAYS, EgfrReading};
use medbrains_server_core::error::AppError;
use serde::Serialize;
use uuid::Uuid;

use crate::cds::DoseCheckItem;

/// A line whose eGFR is below its renal-adjustment threshold.
#[derive(Debug, Serialize)]
pub struct RenalDoseAlert {
    pub drug_name: String,
    pub egfr: f64,
    /// The day the eGFR sample was taken, so the alert reads "eGFR 42, 12 Nov".
    pub egfr_measured_on: NaiveDate,
    pub threshold: f64,
    /// Pharmacist-authored adjustment rule, e.g. "Reduce dose 50%" / "Avoid".
    pub rule: String,
}

/// A line with a renal rule that could not be checked.
#[derive(Debug, Serialize)]
pub struct RenalNotChecked {
    pub drug_name: String,
    /// What was missing, written for the prescriber.
    pub reason: String,
}

#[derive(Debug, Serialize)]
pub struct HepaticAlert {
    pub drug_name: String,
    pub caution: String,
}

/// The renal and hepatic findings for one order.
#[derive(Debug, Default)]
pub(crate) struct RenalHepatic {
    pub renal: Vec<RenalDoseAlert>,
    pub not_checked: Vec<RenalNotChecked>,
    pub hepatic: Vec<HepaticAlert>,
}

/// One catalogue line's renal threshold, renal rule and hepatic caution.
#[derive(Debug, sqlx::FromRow)]
struct RuleRow {
    id: Uuid,
    renal_adjust_egfr_threshold: Option<f64>,
    renal_adjust_rule: Option<String>,
    hepatic_caution: Option<String>,
}

/// Renal + hepatic advisories for the given lines from the catalogue rules.
pub(crate) async fn renal_hepatic_alerts_for_items(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    items: &[DoseCheckItem],
    egfr: Option<EgfrReading>,
) -> Result<RenalHepatic, AppError> {
    let catalog_ids: Vec<Uuid> = items.iter().filter_map(|i| i.catalog_item_id).collect();
    if catalog_ids.is_empty() {
        return Ok(RenalHepatic::default());
    }
    let rows = sqlx::query_as::<_, RuleRow>(
        "SELECT pc.id, \
                COALESCE(pc.renal_adjust_egfr_threshold, ref.renal_adjust_egfr_threshold)::float8 \
                    AS renal_adjust_egfr_threshold, \
                COALESCE(pc.renal_adjust_rule, ref.renal_adjust_rule) AS renal_adjust_rule, \
                COALESCE(pc.hepatic_caution, ref.hepatic_caution) AS hepatic_caution \
         FROM pharmacy_catalog pc \
         LEFT JOIN cds_drug_reference ref ON lower(ref.generic_name) = \
             lower(COALESCE(NULLIF(pc.inn_name, ''), pc.generic_name, pc.name)) \
         WHERE pc.tenant_id = $1 AND pc.id = ANY($2)",
    )
    .bind(tenant_id)
    .bind(&catalog_ids)
    .fetch_all(&mut **tx)
    .await?;
    let mut found = RenalHepatic::default();
    for item in items {
        let Some(row) = item
            .catalog_item_id
            .and_then(|id| rows.iter().find(|r| r.id == id))
        else {
            continue;
        };
        add_findings(&mut found, item, row, egfr);
    }
    Ok(found)
}

/// The trimmed text of a catalogue rule, or `None` when it is blank.
fn text(value: Option<&str>) -> Option<&str> {
    value.map(str::trim).filter(|t| !t.is_empty())
}

/// One line's findings: hepatic caution, then the renal rule against `egfr`.
fn add_findings(
    found: &mut RenalHepatic,
    item: &DoseCheckItem,
    row: &RuleRow,
    egfr: Option<EgfrReading>,
) {
    if let Some(caution) = text(row.hepatic_caution.as_deref()) {
        found.hepatic.push(HepaticAlert {
            drug_name: item.drug_name.clone(),
            caution: caution.to_owned(),
        });
    }
    let (Some(threshold), Some(rule)) = (
        row.renal_adjust_egfr_threshold,
        text(row.renal_adjust_rule.as_deref()),
    ) else {
        return;
    };
    match egfr {
        Some(e) if e.value < threshold => found.renal.push(RenalDoseAlert {
            drug_name: item.drug_name.clone(),
            egfr: e.value,
            egfr_measured_on: e.measured_at.date_naive(),
            threshold,
            rule: rule.to_owned(),
        }),
        Some(_) => {}
        None => found.not_checked.push(RenalNotChecked {
            drug_name: item.drug_name.clone(),
            reason: format!(
                "No verified eGFR (mL/min/1.73 m²) in the last {EGFR_RECENCY_DAYS} days"
            ),
        }),
    }
}
