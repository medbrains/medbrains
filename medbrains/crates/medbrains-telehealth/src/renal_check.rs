//! Renal (eGFR) and hepatic dosing advisories for the CDS rail.
//!
//! The eGFR a renal rule doses from must be an eGFR — per 1.73 m² of body
//! surface — and recent. A creatinine clearance in mL/min, or a value from
//! last year, is not one. When no result qualifies, a line with a renal rule
//! is reported as **not checked**, never as needing no adjustment.

use chrono::{DateTime, Duration, NaiveDate, Utc};
use medbrains_server_core::error::AppError;
use serde::Serialize;
use uuid::Uuid;

use crate::cds::DoseCheckItem;

/// LOINC codes for an estimated GFR per 1.73 m², any equation. Source: the
/// LOINC long common names, as served by the NLM Clinical Tables LOINC API
/// (clinicaltables.nlm.nih.gov/api/loinc_items/v3), read 2026-11-25. All are
/// "Glomerular filtration rate [Volume Rate/Area] ... /1.73 sq M".
/// Creatinine clearance (e.g. 33558-8) is deliberately absent.
const EGFR_LOINC: &[&str] = &[
    "98979-8", // CKD-EPI 2021, creatinine
    "62238-1", // CKD-EPI, creatinine
    "88293-6", // CKD-EPI, creatinine, black population
    "88294-4", // CKD-EPI, creatinine, non-black population
    "94677-2", // CKD-EPI, creatinine and cystatin C
    "50210-4", // cystatin C
    "33914-3", // MDRD, serum or plasma
    "77147-7", // MDRD
    "48642-3", // MDRD, non-black population
    "48643-1", // MDRD, black population
    "50044-7", // MDRD, female population
    "69405-9", // based on 1.73 sq M, equation unstated
];

/// Days an eGFR may be dosed from. Proposed, not clinician-confirmed: renal
/// function can fall within days (AKI), so this is an outer bound, not a
/// statement that a 90-day value is safe. Owner/clinician to confirm.
pub(crate) const EGFR_RECENCY_DAYS: i64 = 90;

/// An eGFR the renal check may dose from, with when it was measured.
#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) struct EgfrReading {
    pub value: f64,
    pub measured_at: DateTime<Utc>,
}

/// One verified numeric result that may be an eGFR.
#[derive(Debug, sqlx::FromRow)]
pub(crate) struct EgfrCandidate {
    pub value: f64,
    pub unit: Option<String>,
    pub parameter_name: String,
    pub test_loinc: Option<String>,
    pub measured_at: DateTime<Utc>,
}

/// True for a unit per 1.73 m² ("mL/min/1.73m2", "mL/min/1.73 m²").
fn per_body_surface(unit: &str) -> bool {
    let compact: String = unit
        .chars()
        .filter(|c| !c.is_whitespace())
        .map(|c| if c == '²' { '2' } else { c })
        .collect::<String>()
        .to_lowercase();
    compact.starts_with("ml/min/1.73")
}

/// True when the result is an eGFR: its test carries an eGFR LOINC code, or
/// the analyte is named as one; a clearance never is.
fn names_egfr(c: &EgfrCandidate) -> bool {
    let name = c.parameter_name.to_lowercase();
    let coded = c
        .test_loinc
        .as_deref()
        .is_some_and(|l| EGFR_LOINC.contains(&l));
    let named = name.contains("gfr") || name.contains("glomerular");
    (coded || named) && !name.contains("clearance")
}

/// The newest candidate that is an eGFR, per 1.73 m², positive, measured in
/// the last [`EGFR_RECENCY_DAYS`] before `now`.
pub(crate) fn latest_egfr(candidates: &[EgfrCandidate], now: DateTime<Utc>) -> Option<EgfrReading> {
    let oldest = now - Duration::days(EGFR_RECENCY_DAYS);
    candidates
        .iter()
        .filter(|c| names_egfr(c) && c.unit.as_deref().is_some_and(per_body_surface))
        .filter(|c| c.value > 0.0 && c.measured_at >= oldest && c.measured_at <= now)
        .max_by_key(|c| c.measured_at)
        .map(|c| EgfrReading {
            value: c.value,
            measured_at: c.measured_at,
        })
}

/// The patient's latest qualifying eGFR (verified, recent, per 1.73 m²).
pub(crate) async fn patient_latest_egfr(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<Option<EgfrReading>, AppError> {
    let now = Utc::now();
    let candidates = sqlx::query_as::<_, EgfrCandidate>(
        // Verified only: an unverified value may be mid-correction. The time
        // window is applied here to bound the read and again in Rust.
        "SELECT lr.numeric_value::float8 AS value, lr.unit, lr.parameter_name, \
                ltc.loinc_code AS test_loinc, \
                COALESCE(lo.collected_at, lo.verified_at, lr.created_at) AS measured_at \
         FROM lab_results lr \
         JOIN lab_orders lo ON lo.id = lr.order_id AND lo.tenant_id = lr.tenant_id \
         LEFT JOIN lab_test_catalog ltc ON ltc.id = lo.test_id AND ltc.tenant_id = lo.tenant_id \
         WHERE lr.tenant_id = $1 AND lo.patient_id = $2 AND lr.numeric_value IS NOT NULL \
           AND lr.deleted_at IS NULL AND lo.status = 'verified'::lab_order_status \
           AND COALESCE(lo.collected_at, lo.verified_at, lr.created_at) >= $3 \
           AND (ltc.loinc_code = ANY($4) OR lower(lr.parameter_name) LIKE '%gfr%' \
                OR lower(lr.parameter_name) LIKE '%glomerular%') \
         ORDER BY measured_at DESC LIMIT 20",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .bind(now - Duration::days(EGFR_RECENCY_DAYS))
    .bind(EGFR_LOINC)
    .fetch_all(&mut **tx)
    .await?;
    Ok(latest_egfr(&candidates, now))
}

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

#[cfg(test)]
mod tests {
    use chrono::{Duration, Utc};

    use super::{EgfrCandidate, latest_egfr};

    /// A candidate `days_ago` old.
    fn cand(name: &str, unit: Option<&str>, loinc: Option<&str>, days_ago: i64) -> EgfrCandidate {
        EgfrCandidate {
            value: 42.0,
            unit: unit.map(str::to_owned),
            parameter_name: name.to_owned(),
            test_loinc: loinc.map(str::to_owned),
            measured_at: Utc::now() - Duration::days(days_ago),
        }
    }

    #[test]
    fn selection_table() {
        let cases = [
            (cand("eGFR", Some("mL/min/1.73m2"), None, 5), true),
            (cand("eGFR", Some("mL/min/1.73 m²"), None, 5), true),
            (
                cand("Result", Some("mL/min/1.73m2"), Some("98979-8"), 5),
                true,
            ),
            (cand("eGFR", Some("mL/min/1.73m2"), None, 91), false),
            (cand("eGFR", Some("mL/min"), None, 5), false),
            (cand("eGFR", None, None, 5), false),
            (
                cand("Creatinine clearance (GFR)", Some("mL/min/1.73m2"), None, 5),
                false,
            ),
            (
                cand("Result", Some("mL/min/1.73m2"), Some("33558-8"), 5),
                false,
            ),
        ];
        for (c, want) in &cases {
            assert_eq!(
                latest_egfr(std::slice::from_ref(c), Utc::now()).is_some(),
                *want,
                "{c:?}"
            );
        }
    }

    #[test]
    fn the_newest_qualifying_result_wins() {
        let mut older = cand("eGFR", Some("mL/min/1.73m2"), None, 30);
        older.value = 70.0;
        let newer = cand("eGFR", Some("mL/min/1.73m2"), None, 2);
        let got = latest_egfr(&[older, newer], Utc::now());
        assert!(got.is_some_and(|r| (r.value - 42.0).abs() < f64::EPSILON));
    }
}
