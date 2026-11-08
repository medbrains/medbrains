//! Dismissing a store usage as a duplicate gives the unit back.
//!
//! When the OT enters an implant in the registry first, its usage is
//! recorded and billed. If the store then records the same implant with no
//! patient, that second record took the batch and the catalogue count down
//! again, and the vendor's consignment usage counts it. Dismissing its queue
//! row as a duplicate (#5265 review) writes a reversing movement linked to it
//! (`return`, `consignment_usage`, `+quantity`, `reference_id` = the record),
//! so the vendor's usage of the batch, summed over `consignment_usage`
//! movements, nets out; puts the units back on the batch and the catalogue;
//! and audits it, all in the dismissal's transaction. No other dismissal
//! touches stock.

use medbrains_server_core::{error::AppError, middleware::auth::Claims};
use medbrains_server_services::billing::REASON_IMPLANT_NO_PATIENT;
use uuid::Uuid;

use super::ChargeAttentionItem;

/// The duplicate usage record: what it took, and from where.
#[derive(Debug, sqlx::FromRow)]
struct Usage {
    catalog_item_id: Uuid,
    batch_stock_id: Option<Uuid>,
    patient_id: Option<Uuid>,
    department_id: Option<Uuid>,
    /// Units it took (positive).
    units: i32,
    /// Whether a reversal of it already exists.
    reversed: bool,
}

/// Reverse the row's usage record: a `+units` movement linked to it, the
/// units back on the batch and the catalogue, and an audit entry. Refused
/// (400) on any row but an implant used without a patient, and (409) when the
/// record is gone or already reversed.
pub(super) async fn reverse_usage(
    tx: &mut medbrains_kernel::Tx,
    claims: &Claims,
    item: &ChargeAttentionItem,
) -> Result<(), AppError> {
    if item.reason != REASON_IMPLANT_NO_PATIENT {
        return Err(AppError::BadRequest(
            "Only an implant used without a patient can be dismissed as a duplicate.".to_owned(),
        ));
    }
    let usage = lock_usage(tx, claims.tenant_id, item.source_entity_id).await?;
    if usage.reversed || usage.units < 1 {
        return Err(AppError::Conflict(
            "This usage record is already reversed.".to_owned(),
        ));
    }
    let reversal = write_reversal(tx, claims, item.source_entity_id, &usage).await?;
    give_back(tx, claims.tenant_id, &usage).await?;
    audit(tx, claims, item, &usage, reversal).await
}

/// The usage record, locked, with whether it is already reversed. 409 when
/// it is gone.
async fn lock_usage(
    conn: &mut sqlx::PgConnection,
    tenant_id: Uuid,
    movement_id: Uuid,
) -> Result<Usage, AppError> {
    sqlx::query_as(
        "SELECT m.catalog_item_id, m.batch_stock_id, m.patient_id, m.department_id, \
                -m.quantity AS units, \
                EXISTS (SELECT 1 FROM store_stock_movements r WHERE r.tenant_id = m.tenant_id \
                          AND r.reference_type = 'consignment_usage' AND r.reference_id = m.id \
                          AND r.quantity > 0 AND r.deleted_at IS NULL) AS reversed \
           FROM store_stock_movements m \
          WHERE m.id = $1 AND m.tenant_id = $2 AND m.reference_type = 'consignment_usage' \
            AND m.deleted_at IS NULL FOR UPDATE",
    )
    .bind(movement_id)
    .bind(tenant_id)
    .fetch_optional(&mut *conn)
    .await?
    .ok_or_else(|| AppError::Conflict("The store's usage record is missing.".to_owned()))
}

/// The reversing movement: the same item, batch and patient, `+units`.
async fn write_reversal(
    conn: &mut sqlx::PgConnection,
    claims: &Claims,
    original: Uuid,
    usage: &Usage,
) -> Result<Uuid, AppError> {
    Ok(sqlx::query_scalar(
        "INSERT INTO store_stock_movements (tenant_id, catalog_item_id, movement_type, \
           quantity, batch_stock_id, patient_id, department_id, reference_type, \
           reference_id, notes, created_by) \
         VALUES ($1, $2, 'return', $3, $4, $5, $6, 'consignment_usage', $7, \
           'Reversed: duplicate of a usage already recorded', $8) RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(usage.catalog_item_id)
    .bind(usage.units)
    .bind(usage.batch_stock_id)
    .bind(usage.patient_id)
    .bind(usage.department_id)
    .bind(original)
    .bind(claims.sub)
    .fetch_one(&mut *conn)
    .await?)
}

/// Put the units back on the batch and the catalogue count.
async fn give_back(
    conn: &mut sqlx::PgConnection,
    tenant_id: Uuid,
    usage: &Usage,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE batch_stock SET quantity = quantity + $1, updated_at = now() \
          WHERE id = $2 AND tenant_id = $3",
    )
    .bind(usage.units)
    .bind(usage.batch_stock_id)
    .bind(tenant_id)
    .execute(&mut *conn)
    .await?;
    sqlx::query(
        "UPDATE store_catalog SET current_stock = current_stock + $1, updated_at = now() \
          WHERE id = $2 AND tenant_id = $3",
    )
    .bind(usage.units)
    .bind(usage.catalog_item_id)
    .bind(tenant_id)
    .execute(&mut *conn)
    .await?;
    Ok(())
}

/// Audit the reversal: the row, both movements, and the units given back.
async fn audit(
    tx: &mut medbrains_kernel::Tx,
    claims: &Claims,
    item: &ChargeAttentionItem,
    usage: &Usage,
    reversal: Uuid,
) -> Result<(), AppError> {
    let detail = serde_json::json!({
        "store_stock_movement_id": item.source_entity_id,
        "reversal_movement_id": reversal,
        "batch_stock_id": usage.batch_stock_id,
        "units": usage.units,
    });
    medbrains_kernel::audit(
        tx,
        &medbrains_kernel::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action: "billing.charge_attention.duplicate_usage_reversed",
            entity_type: "charge_attention_items",
            entity_id: Some(item.id),
            old_values: None,
            new_values: Some(&detail),
            ip_address: None,
        },
    )
    .await?;
    Ok(())
}
