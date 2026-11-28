//! Renal (eGFR) and hepatic dosing advisories for the CDS rail, moved out of
//! `cds.rs` unchanged so the change that follows can be read on its own.

use medbrains_server_core::error::AppError;
use serde::Serialize;
use uuid::Uuid;

use crate::cds::DoseCheckItem;

#[derive(Debug, Serialize)]
pub struct RenalDoseAlert {
    pub drug_name: String,
    pub egfr: f64,
    pub threshold: f64,
    /// Pharmacist-authored adjustment rule, e.g. "Reduce dose 50%" / "Avoid".
    pub rule: String,
}

#[derive(Debug, Serialize)]
pub struct HepaticAlert {
    pub drug_name: String,
    pub caution: String,
}

/// One catalogue line's renal threshold, renal rule and hepatic caution.
#[derive(sqlx::FromRow)]
struct RuleRow {
    id: Uuid,
    renal_adjust_egfr_threshold: Option<f64>,
    renal_adjust_rule: Option<String>,
    hepatic_caution: Option<String>,
}

/// Latest recorded eGFR (mL/min/1.73m²) for a patient from lab results, if any.
pub(crate) async fn patient_latest_egfr(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<Option<f64>, AppError> {
    let egfr = sqlx::query_scalar::<_, Option<f64>>(
        // Verified only. Until now `numeric_value` was NULL on every row, so
        // this returned None for everybody and no renal alert could fire.
        // Filling the column arms this query, and without a status predicate
        // it would begin dosing off whatever a technologist last typed --
        // unverified, possibly mid-correction. A gap that alerted on nothing
        // would have become a gate that answered from unreleased values.
        "SELECT lr.numeric_value::float8 FROM lab_results lr \
         JOIN lab_orders lo ON lo.id = lr.order_id AND lo.tenant_id = lr.tenant_id \
         WHERE lr.tenant_id = $1 AND lo.patient_id = $2 AND lr.numeric_value IS NOT NULL \
           AND lo.status = 'verified'::lab_order_status \
           AND (lower(lr.parameter_name) LIKE '%egfr%' OR lower(lr.parameter_name) LIKE '%gfr%') \
         ORDER BY lr.created_at DESC LIMIT 1",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .fetch_optional(&mut **tx)
    .await?
    .flatten();
    Ok(egfr)
}

/// Renal + hepatic advisories for the given lines from the catalogue rules.
pub(crate) async fn renal_hepatic_alerts_for_items(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    items: &[DoseCheckItem],
    egfr: Option<f64>,
) -> Result<(Vec<RenalDoseAlert>, Vec<HepaticAlert>), AppError> {
    let catalog_ids: Vec<Uuid> = items.iter().filter_map(|i| i.catalog_item_id).collect();
    if catalog_ids.is_empty() {
        return Ok((Vec::new(), Vec::new()));
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

    let mut renal = Vec::new();
    let mut hepatic = Vec::new();
    for item in items {
        let Some(catalog_id) = item.catalog_item_id else {
            continue;
        };
        let Some(row) = rows.iter().find(|r| r.id == catalog_id) else {
            continue;
        };
        if let Some(caution) = row
            .hepatic_caution
            .as_deref()
            .filter(|c| !c.trim().is_empty())
        {
            hepatic.push(HepaticAlert {
                drug_name: item.drug_name.clone(),
                caution: caution.to_owned(),
            });
        }
        if let (Some(egfr), Some(threshold), Some(rule)) = (
            egfr,
            row.renal_adjust_egfr_threshold,
            row.renal_adjust_rule
                .as_deref()
                .filter(|r| !r.trim().is_empty()),
        ) && egfr < threshold
        {
            renal.push(RenalDoseAlert {
                drug_name: item.drug_name.clone(),
                egfr,
                threshold,
                rule: rule.to_owned(),
            });
        }
    }
    Ok((renal, hepatic))
}
