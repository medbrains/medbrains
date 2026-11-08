//! Consignment (vendor-owned) stock used on a patient, and how it is billed.
//!
//! The usage movement (`store_stock_movements`, `consignment_usage`) is the one
//! record that takes the stock and bills the patient. An implant registry entry
//! on a consignment batch never bills or takes stock itself (review of #5265:
//! both did, so the patient paid twice). It names the patient on the store's
//! unnamed usage when there is one, or records the usage when there is none.

use axum::{Extension, Json, extract::State};
use medbrains_core::indent::StoreStockMovement;
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use medbrains_server_services::billing::{
    AutoChargeInput, ChargeOutcome, ChargeRequest, charge_or_queue, queue_patient_unknown,
    require_live_patient,
};
use rust_decimal::Decimal;
use serde::Deserialize;
use sqlx::{PgConnection, Postgres, Transaction};
use uuid::Uuid;

/// `auto_charge_consignment`: vendor-owned stock used on a patient.
pub(crate) const SETTING_CONSIGNMENT: &str = "consignment";

#[derive(Debug, Deserialize)]
pub struct ConsignmentUsageRequest {
    pub batch_stock_id: Uuid,
    pub quantity: i32,
    pub patient_id: Option<Uuid>,
    pub encounter_id: Option<Uuid>,
    pub admission_id: Option<Uuid>,
    pub notes: Option<String>,
}

/// `POST /api/indent/consignment-usage` — the store records consignment stock
/// used, on a patient or (not yet known) on no one.
pub async fn record_consignment_usage(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ConsignmentUsageRequest>,
) -> Result<Json<StoreStockMovement>, AppError> {
    require_permission(&claims, permissions::indent::STOCK_MANAGE)?;
    // patient_id is optional — consignment stock moves without being used
    // on anybody — so the guard covers only the case where one is named.
    if let Some(pid) = body.patient_id {
        medbrains_authz_gate::require_patient_access(&state, &claims, pid).await?;
    }
    if body.quantity <= 0 {
        return Err(AppError::BadRequest("Quantity must be positive".into()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let movement = use_consignment(&mut tx, &claims, &body).await?;
    tx.commit().await?;
    Ok(Json(movement))
}

/// Take consignment stock and bill it: the movement, both stock counts, and
/// the charge through `charge_or_queue`. Keyed on the movement (which keeps
/// the batch, so the vendor). With no patient named the charge is queued as
/// `implant_no_patient` for the desk to name one — never skipped.
pub(crate) async fn use_consignment(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    body: &ConsignmentUsageRequest,
) -> Result<StoreStockMovement, AppError> {
    if let Some(patient_id) = body.patient_id {
        require_live_patient(tx, claims.tenant_id, patient_id).await?;
    }
    let batch = consignment_batch(tx, claims.tenant_id, body.batch_stock_id)
        .await?
        .ok_or_else(|| AppError::BadRequest("Consignment batch not found".into()))?;
    let item = take_stock(tx, claims.tenant_id, &batch, body.quantity).await?;
    let movement = sqlx::query_as::<_, StoreStockMovement>(
        "INSERT INTO store_stock_movements \
         (tenant_id, catalog_item_id, movement_type, quantity, \
          batch_stock_id, patient_id, reference_type, notes, created_by) \
         VALUES ($1,$2,'issue',$3,$4,$5,'consignment_usage',$6,$7) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(batch.catalog_item_id)
    .bind(-body.quantity)
    .bind(body.batch_stock_id)
    .bind(body.patient_id)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&mut **tx)
    .await?;
    let mut req = ChargeRequest {
        tenant_id: claims.tenant_id,
        requested_by: claims.sub,
        setting_module: SETTING_CONSIGNMENT,
        charge: AutoChargeInput {
            patient_id: body.patient_id.unwrap_or_default(),
            encounter_id: body.encounter_id,
            charge_code: item.code,
            source: "consumable".into(),
            source_id: movement.id,
            quantity: body.quantity,
            description_override: Some(format!(
                "Consignment: {} · batch {}",
                item.name, batch.batch_number
            )),
            unit_price_override: Some(item.base_price),
            tax_percent_override: None,
        },
        apply_concessions: false,
    };
    let Some(patient_id) = body.patient_id else {
        queue_patient_unknown(tx, &req).await?;
        return Ok(movement);
    };
    req.charge.patient_id = patient_id;
    if let ChargeOutcome::Posted(charge) = charge_or_queue(tx, req).await?
        && let Some(admission_id) = body.admission_id
    {
        stamp_admission(tx, claims.tenant_id, charge.invoice_id, admission_id).await?;
    }
    Ok(movement)
}

/// The consignment batch, or `None` when the id is not one (or not ours).
async fn consignment_batch(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    batch_id: Uuid,
) -> Result<Option<medbrains_core::procurement::BatchStock>, AppError> {
    Ok(
        sqlx::query_as::<_, medbrains_core::procurement::BatchStock>(
            "SELECT * FROM batch_stock WHERE id = $1 AND tenant_id = $2 AND is_consignment = true",
        )
        .bind(batch_id)
        .bind(tenant_id)
        .fetch_optional(&mut *conn)
        .await?,
    )
}

/// The item's billing identity and selling price: the patient is billed the
/// catalogue price, not the vendor's unit cost.
#[derive(Debug, sqlx::FromRow)]
struct BilledItem {
    code: String,
    name: String,
    base_price: Decimal,
}

/// Take `quantity` off the batch and the catalogue count.
async fn take_stock(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    batch: &medbrains_core::procurement::BatchStock,
    quantity: i32,
) -> Result<BilledItem, AppError> {
    sqlx::query(
        "UPDATE batch_stock SET quantity = quantity - $1, updated_at = now() \
         WHERE id = $2 AND tenant_id = $3",
    )
    .bind(quantity)
    .bind(batch.id)
    .bind(tenant_id)
    .execute(&mut *conn)
    .await?;
    Ok(sqlx::query_as::<_, BilledItem>(
        "UPDATE store_catalog SET current_stock = current_stock - $1, \
         last_issue_date = now(), updated_at = now() \
         WHERE id = $2 AND tenant_id = $3 RETURNING code, name, base_price",
    )
    .bind(quantity)
    .bind(batch.catalog_item_id)
    .bind(tenant_id)
    .fetch_one(&mut *conn)
    .await?)
}

/// Tie the bill to the admission so the line rolls up onto the discharge bill.
pub(crate) async fn stamp_admission(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    invoice_id: Uuid,
    admission_id: Uuid,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE invoices SET admission_id = COALESCE(admission_id, $1), updated_at = now() \
         WHERE id = $2 AND tenant_id = $3",
    )
    .bind(admission_id)
    .bind(invoice_id)
    .bind(tenant_id)
    .execute(&mut *conn)
    .await?;
    Ok(())
}

/// What a registry entry on a consignment batch did about the usage record.
#[derive(Debug, Clone, Copy)]
pub(crate) enum RegistryUsage {
    /// The store's unnamed usage now names the patient (`movement`), and its
    /// queued charge was posted or left for the desk.
    Named { movement: Uuid, queue_row: Uuid },
    /// A usage already names the patient and is not yet matched to an entry.
    AlreadyRecorded,
    /// No usage existed; one was recorded now, and it bills.
    Recorded { movement: Uuid },
}

/// For a registry entry on a consignment batch, make sure exactly one usage
/// record bills the implant: claim the store's unnamed usage, or accept one
/// already naming the patient, or record one. Returns `None` when the batch is
/// not consignment (the registry bills it, as before).
pub(crate) async fn registry_usage(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    entry: &medbrains_core::inventory::ImplantRegistryEntry,
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
    if let Some(named) = claim_unnamed_usage(tx, claims, batch_id, entry.patient_id).await? {
        return Ok(Some(named));
    }
    if usage_awaits_entry(tx, claims.tenant_id, entry).await? {
        return Ok(Some(RegistryUsage::AlreadyRecorded));
    }
    let body = ConsignmentUsageRequest {
        batch_stock_id: batch_id,
        quantity: 1,
        patient_id: Some(entry.patient_id),
        encounter_id: None,
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
    entry: &medbrains_core::inventory::ImplantRegistryEntry,
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

/// The open `implant_no_patient` row of an unnamed usage of the batch, as
/// the charge needs it.
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

/// Name `patient_id` on the oldest unnamed usage of the batch and its queue
/// row, then post the charge (or leave it queued for the desk). `None` when
/// the batch has no unnamed usage.
async fn claim_unnamed_usage(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    batch_id: Uuid,
    patient_id: Uuid,
) -> Result<Option<RegistryUsage>, AppError> {
    let row: Option<UnnamedRow> = sqlx::query_as(
        "SELECT a.id, a.source_entity_id, a.charge_code, a.quantity, a.description_override, \
                a.unit_price_override, a.tax_percent_override \
           FROM charge_attention_items a \
           JOIN store_stock_movements m ON m.id = a.source_entity_id \
                AND m.tenant_id = a.tenant_id AND m.batch_stock_id = $2 \
                AND m.reference_type = 'consignment_usage' AND m.patient_id IS NULL \
          WHERE a.tenant_id = $1 AND a.reason = 'implant_no_patient' AND a.status = 'open' \
            AND a.patient_id IS NULL AND a.deleted_at IS NULL \
          ORDER BY a.created_at, a.id LIMIT 1 FOR UPDATE OF a, m",
    )
    .bind(claims.tenant_id)
    .bind(batch_id)
    .fetch_optional(&mut **tx)
    .await?;
    let Some(row) = row else {
        return Ok(None);
    };
    let encounter_id = name_on_usage(tx, claims.tenant_id, &row, patient_id).await?;
    post_named(tx, claims, &row, patient_id, encounter_id).await?;
    Ok(Some(RegistryUsage::Named {
        movement: row.source_entity_id,
        queue_row: row.id,
    }))
}

/// Write the patient onto the usage and its queue row (with their current
/// admission's encounter). Returns that encounter.
async fn name_on_usage(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    row: &UnnamedRow,
    patient_id: Uuid,
) -> Result<Option<Uuid>, AppError> {
    sqlx::query(
        "UPDATE store_stock_movements SET patient_id = $3 \
          WHERE id = $1 AND tenant_id = $2 AND patient_id IS NULL",
    )
    .bind(row.source_entity_id)
    .bind(tenant_id)
    .bind(patient_id)
    .execute(&mut *conn)
    .await?;
    Ok(sqlx::query_scalar(
        "UPDATE charge_attention_items SET patient_id = $3, \
                encounter_id = (SELECT ad.encounter_id FROM admissions ad \
                                 WHERE ad.tenant_id = $2 AND ad.patient_id = $3 \
                                   AND ad.status = 'admitted' \
                                 ORDER BY ad.admitted_at DESC LIMIT 1) \
          WHERE id = $1 AND tenant_id = $2 RETURNING encounter_id",
    )
    .bind(row.id)
    .bind(tenant_id)
    .bind(patient_id)
    .fetch_one(&mut *conn)
    .await?)
}

/// Post the named usage's charge and close its queue row as posted. A row
/// with no price stays open for the desk to set a tariff; a charge that
/// cannot post stays open on the queue (`charge_or_queue` adds nothing).
async fn post_named(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    row: &UnnamedRow,
    patient_id: Uuid,
    encounter_id: Option<Uuid>,
) -> Result<(), AppError> {
    if row.unit_price_override.is_none_or(|p| p.is_zero()) {
        return Ok(());
    }
    let req = ChargeRequest {
        tenant_id: claims.tenant_id,
        requested_by: claims.sub,
        setting_module: SETTING_CONSIGNMENT,
        charge: AutoChargeInput {
            patient_id,
            encounter_id,
            charge_code: row.charge_code.clone(),
            source: "consumable".into(),
            source_id: row.source_entity_id,
            quantity: row.quantity,
            description_override: row.description_override.clone(),
            unit_price_override: row.unit_price_override,
            tax_percent_override: row.tax_percent_override,
        },
        apply_concessions: false,
    };
    if let ChargeOutcome::Posted(charge) = charge_or_queue(tx, req).await? {
        sqlx::query(
            "UPDATE charge_attention_items SET status = 'posted', invoice_id = $3, \
                    resolved_by = $4, resolved_at = now() \
              WHERE id = $1 AND tenant_id = $2",
        )
        .bind(row.id)
        .bind(claims.tenant_id)
        .bind(charge.invoice_id)
        .bind(claims.sub)
        .execute(&mut **tx)
        .await?;
    }
    Ok(())
}
