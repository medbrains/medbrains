//! `POST /api/indent/implant-registry`: the lifetime, recallable record of an
//! implant inside a named person, and the one place it is billed.
//!
//! An implant from the hospital's own stock is billed here and takes stock
//! here, as before. One from a consignment batch is billed by its usage
//! record (`consignment`), never here: the entry names the patient on the
//! store's unnamed usage, or records the usage, and audits what it did.

use axum::{Extension, Json, extract::State};
use chrono::NaiveDate;
use medbrains_core::inventory::ImplantRegistryEntry;
use medbrains_core::permissions;
use medbrains_kernel::Actor;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use medbrains_server_services::billing::{
    AutoChargeInput, ChargeRequest, charge_or_queue, require_live_patient,
};
use rust_decimal::Decimal;
use sqlx::{Postgres, Transaction};

use crate::CreateImplantRequest;
use crate::registry_usage::{RegistryUsage, registry_usage};

/// `auto_charge_implant`: an implant from the hospital's stock, entered in the registry.
const SETTING_IMPLANT: &str = "implant";

/// Record the implant, and bill it exactly once.
pub async fn create_implant_entry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateImplantRequest>,
) -> Result<Json<ImplantRegistryEntry>, AppError> {
    require_permission(&claims, permissions::indent::IMPLANTS_MANAGE)?;
    // The implant registry is a lifetime, recallable record of what is
    // inside a named person.
    medbrains_authz_gate::require_patient_access(&state, &claims, body.patient_id).await?;
    let implant_date = NaiveDate::parse_from_str(&body.implant_date, "%Y-%m-%d")
        .map_err(|_| AppError::BadRequest("Invalid implant_date format".into()))?;
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    // A savepoint on the unit of work: the billing helpers take a transaction.
    let mut work = sqlx::Acquire::begin(&mut *tx).await?;
    require_live_patient(&mut work, claims.tenant_id, body.patient_id).await?;
    let entry = insert_entry(&mut work, &claims, &body, implant_date).await?;
    let usage = registry_usage(&mut work, &claims, &entry).await?;
    if usage.is_none() {
        bill_own_stock(&mut work, &claims, &entry).await?;
    }
    work.commit().await?;
    if let Some(usage) = usage {
        audit_usage(&mut tx, &claims, &entry, usage).await?;
    }
    tx.commit().await?;
    Ok(Json(entry))
}

/// Write the registry entry.
async fn insert_entry(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    body: &CreateImplantRequest,
    implant_date: NaiveDate,
) -> Result<ImplantRegistryEntry, AppError> {
    let warranty = body
        .warranty_expiry
        .as_deref()
        .and_then(|d| NaiveDate::parse_from_str(d, "%Y-%m-%d").ok());
    Ok(sqlx::query_as::<_, ImplantRegistryEntry>(
        "INSERT INTO implant_registry \
         (tenant_id, catalog_item_id, batch_stock_id, patient_id, serial_number, \
          implant_date, implant_site, surgeon_id, manufacturer, model_number, \
          warranty_expiry, notes) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.catalog_item_id)
    .bind(body.batch_stock_id)
    .bind(body.patient_id)
    .bind(&body.serial_number)
    .bind(implant_date)
    .bind(&body.implant_site)
    .bind(body.surgeon_id)
    .bind(&body.manufacturer)
    .bind(&body.model_number)
    .bind(warranty)
    .bind(&body.notes)
    .fetch_one(&mut **tx)
    .await?)
}

/// An implant from the hospital's own stock: take one off the count and
/// charge it through `charge_or_queue` onto a patient-only draft, keyed on
/// the entry. A charge that cannot post is queued; the entry still saves.
async fn bill_own_stock(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    entry: &ImplantRegistryEntry,
) -> Result<(), AppError> {
    let (item_code, item_name, base_price) = sqlx::query_as::<_, (String, String, Decimal)>(
        "UPDATE store_catalog SET current_stock = current_stock - 1, \
         last_issue_date = now(), updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 RETURNING code, name, base_price",
    )
    .bind(entry.catalog_item_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut **tx)
    .await?;
    charge_or_queue(
        tx,
        ChargeRequest {
            tenant_id: claims.tenant_id,
            requested_by: claims.sub,
            setting_module: SETTING_IMPLANT,
            charge: AutoChargeInput {
                patient_id: entry.patient_id,
                encounter_id: None,
                charge_code: item_code,
                source: "ot".into(),
                source_id: entry.id,
                quantity: 1,
                description_override: Some(format!("Implant: {item_name}")),
                unit_price_override: Some(base_price),
                tax_percent_override: None,
            },
            apply_concessions: false,
        },
    )
    .await?;
    Ok(())
}

/// Audit what the entry did to the consignment usage record: named the
/// patient on the store's usage, matched one already naming them, or
/// recorded one.
async fn audit_usage(
    tx: &mut medbrains_kernel::Tx,
    claims: &Claims,
    entry: &ImplantRegistryEntry,
    usage: RegistryUsage,
) -> Result<(), AppError> {
    let (action, detail) = match usage {
        RegistryUsage::Named {
            movement,
            queue_row,
        } => (
            "indent.consignment_usage.patient_named",
            serde_json::json!({ "movement_id": movement, "charge_attention_id": queue_row }),
        ),
        RegistryUsage::Split { movement, from } => (
            "indent.consignment_usage.unit_named",
            serde_json::json!({ "movement_id": movement, "split_from_movement_id": from }),
        ),
        RegistryUsage::AlreadyRecorded => (
            "indent.consignment_usage.matched",
            serde_json::json!({ "batch_stock_id": entry.batch_stock_id }),
        ),
        RegistryUsage::Recorded { movement } => (
            "indent.consignment_usage.recorded",
            serde_json::json!({ "movement_id": movement }),
        ),
    };
    let new_values = serde_json::json!({
        "implant_registry_id": entry.id,
        "patient_id": entry.patient_id,
        "usage": detail,
    });
    medbrains_kernel::audit(
        tx,
        &medbrains_kernel::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action,
            entity_type: "store_stock_movements",
            entity_id: None,
            old_values: None,
            new_values: Some(&new_values),
            ip_address: None,
        },
    )
    .await?;
    Ok(())
}
