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
pub(crate) async fn consignment_batch(
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
