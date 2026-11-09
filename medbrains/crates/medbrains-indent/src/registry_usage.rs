//! A registry entry on a consignment batch, and the one usage record that
//! bills its implant.
//!
//! The usage record (`store_stock_movements`, `consignment_usage`) takes the
//! stock and bills the patient; the registry entry never does (#5265 review).
//! An entry claims one unit of the store's unnamed usage of the batch, made
//! within [`CLAIM_WINDOW_DAYS`] of the implant date. A one-unit usage is named
//! whole. A larger one is split: one unit becomes a usage naming the patient,
//! and the rest stays unnamed on the queue for the next entry or the desk.
//! The stock is never taken twice, and each unit bills one patient once.

use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_services::billing::{
    AutoChargeInput, ChargeOutcome, ChargeRequest, charge_or_queue,
};
use rust_decimal::Decimal;
use sqlx::{PgConnection, Postgres, Transaction};
use uuid::Uuid;

use crate::consignment::{
    ConsignmentUsageRequest, SETTING_CONSIGNMENT, consignment_batch, stamp_admission,
    use_consignment,
};
use medbrains_core::inventory::ImplantRegistryEntry;

/// An unnamed usage made this many days either side of the implant date may
/// be the implant the entry records; older or later ones are not claimed.
pub(crate) const CLAIM_WINDOW_DAYS: i32 = 3;

/// What a registry entry on a consignment batch did about the usage record.
#[derive(Debug, Clone, Copy)]
pub(crate) enum RegistryUsage {
    /// A one-unit unnamed usage (`movement`) now names the patient, and its
    /// queued charge (`queue_row`) was posted or left for the desk.
    Named { movement: Uuid, queue_row: Uuid },
    /// One unit of a larger unnamed usage (`from`) became `movement`, naming
    /// the patient and billing them for that one unit.
    Split { movement: Uuid, from: Uuid },
    /// A usage already names the patient and is not yet matched to an entry.
    AlreadyRecorded,
    /// No usage existed; one was recorded now, and it bills.
    Recorded { movement: Uuid },
}

/// For a registry entry on a consignment batch, make sure exactly one unit
/// of usage bills the implant. Returns `None` when the batch is not
/// consignment (the registry bills it, as before).
pub(crate) async fn registry_usage(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    entry: &ImplantRegistryEntry,
) -> Result<Option<RegistryUsage>, AppError> {
    let Some(batch_id) = entry.batch_stock_id else {
        return Ok(None);
    };
    if consignment_batch(tx, claims.tenant_id, batch_id)
        .await?
        .is_none()
    {
        return Ok(None);
    }
    if let Some(claimed) = claim_unnamed_unit(tx, claims, entry, batch_id).await? {
        return Ok(Some(claimed));
    }
    if usage_awaits_entry(tx, claims.tenant_id, entry).await? {
        return Ok(Some(RegistryUsage::AlreadyRecorded));
    }
    // The admission's bill, not a patient-only draft: the discharge desk
    // settles the admission's invoice. Only the encounter is sent: the
    // charge derives the admission from it, so a second admission row on
    // the same encounter cannot refuse the OT nurse's entry.
    let admission = current_admission(tx, claims.tenant_id, entry.patient_id).await?;
    let body = ConsignmentUsageRequest {
        batch_stock_id: batch_id,
        quantity: 1,
        patient_id: Some(entry.patient_id),
        encounter_id: admission.map(|a| a.encounter_id),
        admission_id: None,
        notes: Some("Recorded from the implant registry".to_owned()),
    };
    let movement = use_consignment(tx, claims, &body).await?;
    Ok(Some(RegistryUsage::Recorded {
        movement: movement.id,
    }))
}

/// Whether the batch has more units used on this patient than registry
/// entries for them (other than `entry`): a usage the store recorded first.
async fn usage_awaits_entry(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    entry: &ImplantRegistryEntry,
) -> Result<bool, AppError> {
    Ok(sqlx::query_scalar(
        "SELECT COALESCE((SELECT SUM(-m.quantity) FROM store_stock_movements m \
                 WHERE m.tenant_id = $1 AND m.batch_stock_id = $2 AND m.patient_id = $3 \
                   AND m.reference_type = 'consignment_usage' AND m.deleted_at IS NULL), 0) \
              > (SELECT COUNT(*) FROM implant_registry r \
                 WHERE r.tenant_id = $1 AND r.batch_stock_id = $2 AND r.patient_id = $3 \
                   AND r.deleted_at IS NULL AND r.id <> $4)",
    )
    .bind(tenant_id)
    .bind(entry.batch_stock_id)
    .bind(entry.patient_id)
    .bind(entry.id)
    .fetch_one(&mut *conn)
    .await?)
}

/// The open `implant_no_patient` row of an unnamed usage, as the charge
/// needs it, with the usage's unit count.
#[derive(Debug, sqlx::FromRow)]
struct UnnamedRow {
    id: Uuid,
    source_entity_id: Uuid,
    charge_code: String,
    quantity: i32,
    description_override: Option<String>,
    unit_price_override: Option<Decimal>,
    tax_percent_override: Option<Decimal>,
}

/// Claim one unit of the oldest unnamed usage of the batch near the implant
/// date: name a one-unit usage whole, or split one unit off a larger one.
/// `None` when there is none.
async fn claim_unnamed_unit(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    entry: &ImplantRegistryEntry,
    batch_id: Uuid,
) -> Result<Option<RegistryUsage>, AppError> {
    let row: Option<UnnamedRow> = sqlx::query_as(
        "SELECT a.id, a.source_entity_id, a.charge_code, a.quantity, a.description_override, \
                a.unit_price_override, a.tax_percent_override \
           FROM charge_attention_items a \
           JOIN store_stock_movements m ON m.id = a.source_entity_id \
                AND m.tenant_id = a.tenant_id AND m.batch_stock_id = $2 \
                AND m.reference_type = 'consignment_usage' AND m.patient_id IS NULL \
                AND m.deleted_at IS NULL AND m.quantity <= -1 \
                AND m.created_at::date BETWEEN $3::date - $4 AND $3::date + $4 \
          WHERE a.tenant_id = $1 AND a.reason = 'implant_no_patient' AND a.status = 'open' \
            AND a.patient_id IS NULL AND a.deleted_at IS NULL AND a.quantity >= 1 \
          ORDER BY a.created_at, a.id LIMIT 1 FOR UPDATE OF a, m",
    )
    .bind(claims.tenant_id)
    .bind(batch_id)
    .bind(entry.implant_date)
    .bind(CLAIM_WINDOW_DAYS)
    .fetch_optional(&mut **tx)
    .await?;
    let Some(row) = row else {
        return Ok(None);
    };
    if row.quantity > 1 {
        let movement = split_one(tx, claims, &row, entry.patient_id).await?;
        let admission = current_admission(tx, claims.tenant_id, entry.patient_id).await?;
        bill_unit(tx, claims, &row, movement, entry.patient_id, admission).await?;
        return Ok(Some(RegistryUsage::Split {
            movement,
            from: row.source_entity_id,
        }));
    }
    let admission = name_on_usage(tx, claims.tenant_id, &row, entry.patient_id).await?;
    let posted = bill_unit(
        tx,
        claims,
        &row,
        row.source_entity_id,
        entry.patient_id,
        admission,
    )
    .await?;
    if let Some(invoice_id) = posted {
        close_posted(tx, claims, row.id, invoice_id).await?;
    }
    Ok(Some(RegistryUsage::Named {
        movement: row.source_entity_id,
        queue_row: row.id,
    }))
}

/// Take one unit off a larger unnamed usage: the usage and its queue row are
/// lowered by one, and a one-unit usage naming the patient is recorded,
/// pointing back at it. The stock is not taken again: the usage took it.
async fn split_one(
    conn: &mut PgConnection,
    claims: &Claims,
    row: &UnnamedRow,
    patient_id: Uuid,
) -> Result<Uuid, AppError> {
    sqlx::query(
        "UPDATE charge_attention_items SET quantity = quantity - 1 \
          WHERE id = $1 AND tenant_id = $2",
    )
    .bind(row.id)
    .bind(claims.tenant_id)
    .execute(&mut *conn)
    .await?;
    Ok(sqlx::query_scalar(
        "WITH rest AS (UPDATE store_stock_movements SET quantity = quantity + 1 \
                        WHERE id = $1 AND tenant_id = $2 \
                        RETURNING catalog_item_id, batch_stock_id, department_id) \
         INSERT INTO store_stock_movements (tenant_id, catalog_item_id, movement_type, \
           quantity, batch_stock_id, patient_id, department_id, reference_type, \
           reference_id, notes, created_by) \
         SELECT $2, catalog_item_id, 'issue', -1, batch_stock_id, $3, department_id, \
                'consignment_usage', $1, 'One unit of an unnamed usage, named by the implant \
                registry', $4 \
           FROM rest RETURNING id",
    )
    .bind(row.source_entity_id)
    .bind(claims.tenant_id)
    .bind(patient_id)
    .bind(claims.sub)
    .fetch_one(&mut *conn)
    .await?)
}

/// A patient's current admission and the encounter it was opened under.
#[derive(Debug, Clone, Copy, sqlx::FromRow)]
struct CurrentAdmission {
    id: Uuid,
    encounter_id: Uuid,
}

/// The patient's current admission, for the bill an implant lands on.
async fn current_admission(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<Option<CurrentAdmission>, AppError> {
    Ok(sqlx::query_as(
        "SELECT id, encounter_id FROM admissions WHERE tenant_id = $1 AND patient_id = $2 \
           AND status = 'admitted' AND deleted_at IS NULL AND NOT is_dummy \
         ORDER BY admitted_at DESC LIMIT 1",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .fetch_optional(&mut *conn)
    .await?)
}

/// Write the patient onto a one-unit usage and its queue row (with their
/// current admission's encounter). Returns that admission.
async fn name_on_usage(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    row: &UnnamedRow,
    patient_id: Uuid,
) -> Result<Option<CurrentAdmission>, AppError> {
    sqlx::query(
        "UPDATE store_stock_movements SET patient_id = $3 \
          WHERE id = $1 AND tenant_id = $2 AND patient_id IS NULL",
    )
    .bind(row.source_entity_id)
    .bind(tenant_id)
    .bind(patient_id)
    .execute(&mut *conn)
    .await?;
    let admission = current_admission(conn, tenant_id, patient_id).await?;
    sqlx::query(
        "UPDATE charge_attention_items SET patient_id = $3, encounter_id = $4 \
          WHERE id = $1 AND tenant_id = $2",
    )
    .bind(row.id)
    .bind(tenant_id)
    .bind(patient_id)
    .bind(admission.map(|a| a.encounter_id))
    .execute(&mut *conn)
    .await?;
    Ok(admission)
}

/// Bill one unit of the row's charge to the patient, keyed on `movement`.
/// Returns the invoice when it posted. An unpriced row bills nothing now:
/// a named one stays open for the desk to set a tariff, and a split unit is
/// raised by the daily check. A charge that cannot post is queued. A posted
/// charge's bill is tied to the patient's current admission, if any.
async fn bill_unit(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    row: &UnnamedRow,
    movement: Uuid,
    patient_id: Uuid,
    admission: Option<CurrentAdmission>,
) -> Result<Option<Uuid>, AppError> {
    if row.unit_price_override.is_none_or(|p| p.is_zero()) {
        return Ok(None);
    }
    let req = ChargeRequest {
        tenant_id: claims.tenant_id,
        requested_by: claims.sub,
        setting_module: SETTING_CONSIGNMENT,
        charge: AutoChargeInput {
            patient_id,
            encounter_id: admission.map(|a| a.encounter_id),
            charge_code: row.charge_code.clone(),
            source: "consumable".into(),
            source_id: movement,
            quantity: 1,
            description_override: row.description_override.clone(),
            unit_price_override: row.unit_price_override,
            tax_percent_override: row.tax_percent_override,
        },
        apply_concessions: false,
    };
    let ChargeOutcome::Posted(charge) = charge_or_queue(tx, req).await? else {
        return Ok(None);
    };
    if let Some(admission) = admission {
        stamp_admission(tx, claims.tenant_id, charge.invoice_id, admission.id).await?;
    }
    Ok(Some(charge.invoice_id))
}

/// Close the named usage's queue row as posted on `invoice_id`.
async fn close_posted(
    conn: &mut PgConnection,
    claims: &Claims,
    row_id: Uuid,
    invoice_id: Uuid,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE charge_attention_items SET status = 'posted', invoice_id = $3, \
                resolved_by = $4, resolved_at = now() \
          WHERE id = $1 AND tenant_id = $2",
    )
    .bind(row_id)
    .bind(claims.tenant_id)
    .bind(invoice_id)
    .bind(claims.sub)
    .execute(&mut *conn)
    .await?;
    Ok(())
}
