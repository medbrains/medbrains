//! Renal (eGFR) and hepatic dosing advisories for the CDS rail.
//!
//! The eGFR a renal rule doses from must be an eGFR — per 1.73 m² of body
//! surface — and recent. A creatinine clearance in mL/min, or a value from
//! last year, is not one. When no result qualifies, a line with a renal rule
//! is reported as **not checked**, never as needing no adjustment.

use chrono::NaiveDate;
use medbrains_health_services::egfr::EgfrLookup;
pub(crate) use medbrains_health_services::egfr::patient_latest_egfr;
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
    egfr: Option<&EgfrLookup>,
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
/// `egfr` is `None` when no patient was named.
fn add_findings(
    found: &mut RenalHepatic,
    item: &DoseCheckItem,
    row: &RuleRow,
    egfr: Option<&EgfrLookup>,
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
    match egfr.and_then(|l| l.reading) {
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
            reason: not_checked_reason(egfr),
        }),
    }
}

/// Why a renal rule was not checked, and what to do: the hospital's window
/// for this patient (Settings → Clinical configuration).
fn not_checked_reason(egfr: Option<&EgfrLookup>) -> String {
    let Some(egfr) = egfr else {
        return "No patient chosen, so the eGFR could not be read".to_owned();
    };
    let who = if egfr.inpatient {
        "an inpatient"
    } else {
        "an outpatient"
    };
    format!(
        "No verified eGFR (mL/min/1.73 m²) in the last {} days for {who}. Order a \
         creatinine/eGFR to check this dose.",
        egfr.window_days
    )
}

#[cfg(test)]
mod tests {
    use chrono::Utc;
    use medbrains_health_services::egfr::{EgfrLookup, EgfrReading};
    use medbrains_health_services::kidney_settings::KidneySettings;
    use uuid::Uuid;

    use super::{RenalHepatic, RuleRow, add_findings};
    use crate::cds::DoseCheckItem;

    /// Metformin's findings with this eGFR lookup, under an "eGFR < 30: Avoid" rule.
    fn findings(egfr: Option<&EgfrLookup>) -> RenalHepatic {
        let item = DoseCheckItem {
            drug_name: "Metformin".to_owned(),
            dosage: "500 mg".to_owned(),
            frequency: "BD".to_owned(),
            catalog_item_id: None,
        };
        let row = RuleRow {
            id: Uuid::nil(),
            renal_adjust_egfr_threshold: Some(30.0),
            renal_adjust_rule: Some("Avoid".to_owned()),
            hepatic_caution: None,
        };
        let mut found = RenalHepatic::default();
        add_findings(&mut found, &item, &row, egfr);
        found
    }

    /// An inpatient lookup with an eGFR of `value` today, or none.
    fn inpatient(value: Option<f64>) -> EgfrLookup {
        EgfrLookup {
            reading: value.map(|value| EgfrReading {
                value,
                measured_at: Utc::now(),
            }),
            window_days: 7,
            inpatient: true,
            settings: KidneySettings::default(),
        }
    }

    #[test]
    fn no_recent_egfr_is_not_checked_never_fine() {
        let f = findings(Some(&inpatient(None)));
        assert!(f.renal.is_empty());
        let reason = &f.not_checked[0].reason;
        assert!(reason.contains("last 7 days for an inpatient"), "{reason}");
        assert!(reason.contains("Order a creatinine/eGFR"), "{reason}");
    }

    #[test]
    fn an_egfr_under_the_threshold_flags_and_over_it_passes() {
        assert_eq!(findings(Some(&inpatient(Some(28.0)))).renal.len(), 1);
        let ok = findings(Some(&inpatient(Some(45.0))));
        assert!(ok.renal.is_empty() && ok.not_checked.is_empty());
    }

    #[test]
    fn no_patient_is_not_checked() {
        assert_eq!(findings(None).not_checked.len(), 1);
    }
}
