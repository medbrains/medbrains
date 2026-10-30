//! "Order my prescription": a prescription written at this hospital fills
//! the cart in one tap, each line at the quantity the prescription works out
//! to. No upload; the pharmacist still verifies every prescription line.
//! Counter-only, unmapped and unpriced lines are left out, with why.

use medbrains_server_core::error::AppError;
use serde::Serialize;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use super::cart::{Cart, check_line, ensure_cart, put_line, view};
use super::catalog::rows_by_ids;

/// Lines read from one prescription, at most.
const RX_LINE_LIMIT: i64 = 30;

#[derive(Debug, Serialize)]
pub struct LeftOut {
    pub drug_name: String,
    pub reason: String,
}

#[derive(Debug, Serialize)]
pub struct OrderedPrescription {
    pub prescription_id: Uuid,
    pub cart: Cart,
    pub left_out: Vec<LeftOut>,
}

#[derive(sqlx::FromRow)]
struct RxLine {
    drug_name: String,
    catalog_item_id: Option<Uuid>,
    dosage: String,
    frequency: String,
    duration: String,
}

/// Fill the patient's cart from one of their own unexpired outpatient
/// prescriptions; another patient's, or an expired one, is not found.
pub async fn order_prescription(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
    prescription_id: Uuid,
) -> Result<OrderedPrescription, AppError> {
    let settings = super::settings::require_open(tx, tenant_id).await?;
    let lines = sqlx::query_as::<_, RxLine>(
        "SELECT i.drug_name, COALESCE(i.catalog_item_id, m.id) AS catalog_item_id, \
                COALESCE(i.dosage, '') AS dosage, COALESCE(i.frequency, '') AS frequency, \
                COALESCE(i.duration, '') AS duration \
           FROM prescriptions p \
           LEFT JOIN encounters e ON e.id = p.encounter_id AND e.tenant_id = p.tenant_id \
           JOIN prescription_items i ON i.prescription_id = p.id AND i.tenant_id = p.tenant_id \
                AND i.item_status = 'active' \
           LEFT JOIN LATERAL (SELECT c.id FROM pharmacy_catalog c \
                WHERE c.tenant_id = p.tenant_id AND c.is_active AND c.deleted_at IS NULL \
                  AND lower(i.drug_name) IN (lower(c.name), lower(COALESCE(c.generic_name, '')), \
                                             lower(COALESCE(c.inn_name, ''))) \
                ORDER BY lower(c.name) = lower(i.drug_name) DESC, c.name LIMIT 1) m ON true \
          WHERE p.tenant_id = $1 AND p.id = $2 AND COALESCE(p.patient_id, e.patient_id) = $3 \
            AND p.deleted_at IS NULL AND p.admission_id IS NULL \
            AND (p.valid_until IS NULL OR p.valid_until >= CURRENT_DATE) \
          ORDER BY i.created_at LIMIT $4",
    )
    .bind(tenant_id)
    .bind(prescription_id)
    .bind(patient_id)
    .bind(RX_LINE_LIMIT)
    .fetch_all(&mut **tx)
    .await?;
    if lines.is_empty() {
        return Err(AppError::NotFound);
    }
    let supply_cap = format!(
        "{} days",
        super::rules::load(tx, tenant_id).await?.max_days_supply
    );
    let cart = ensure_cart(tx, tenant_id, patient_id).await?;
    // The prescription replaces what was in the cart.
    sqlx::query(
        "UPDATE pharmacy_store_order_lines SET deleted_at = now() \
          WHERE tenant_id = $1 AND store_order_id = $2 AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(cart)
    .execute(&mut **tx)
    .await?;
    let ids: Vec<Uuid> = lines.iter().filter_map(|l| l.catalog_item_id).collect();
    let rows = rows_by_ids(tx, tenant_id, &ids, &settings, Some(cart)).await?;
    let mut left_out = Vec::new();
    for line in &lines {
        let Some(row) = line.catalog_item_id.and_then(|id| rows.get(&id)) else {
            left_out.push(LeftOut {
                drug_name: line.drug_name.clone(),
                reason: "Not stocked by the pharmacy: ask at the counter".to_owned(),
            });
            continue;
        };
        // At most the hospital's days of supply for one online order
        // (`max_days_supply_online`, 30 by default): a longer course comes in
        // refills.
        let quantity =
            crate::estimate_rx_dispense_quantity(&line.dosage, &line.frequency, &line.duration)
                .min(crate::estimate_rx_dispense_quantity(
                    &line.dosage,
                    &line.frequency,
                    &supply_cap,
                ))
                .max(1);
        let quantity = super::cart::line_max(row, &settings, Some(quantity));
        match check_line(row, quantity, &settings, Some(quantity)) {
            Ok(()) => put_line(tx, tenant_id, cart, row, quantity, Some(quantity)).await?,
            Err(AppError::BadRequest(reason) | AppError::Conflict(reason)) => {
                left_out.push(LeftOut {
                    drug_name: line.drug_name.clone(),
                    reason,
                });
            }
            Err(other) => return Err(other),
        }
    }
    Ok(OrderedPrescription {
        prescription_id,
        cart: view(tx, tenant_id, patient_id).await?,
        left_out,
    })
}
