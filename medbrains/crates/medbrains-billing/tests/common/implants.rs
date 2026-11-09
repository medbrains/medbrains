//! Implant helpers for the stock-leakage tests: the store's consignment
//! usage, the OT's registry entry, and what the bill and queue say after.

use axum::extract::{Path, State};
use axum::{Extension, Json};
use medbrains_billing::charge_attention::{
    ChargeAttentionItem, NamePatientRequest, name_patient_charge_attention,
};
use medbrains_core::inventory::ImplantRegistryEntry;
use medbrains_indent::implants::create_implant_entry;
use medbrains_indent::{ConsignmentUsageRequest, CreateImplantRequest, record_consignment_usage};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use sqlx::PgPool;
use uuid::Uuid;

use super::state;
use super::stock::Ward;

/// The store records one knee implant of `batch` used, naming no one.
pub(crate) async fn unnamed_usage(db: &PgPool, claims: &Claims, batch: Uuid) -> Uuid {
    unnamed_usage_of(db, claims, batch, 1).await
}

/// The store records `quantity` knee implants of `batch` used, naming no one.
pub(crate) async fn unnamed_usage_of(
    db: &PgPool,
    claims: &Claims,
    batch: Uuid,
    quantity: i32,
) -> Uuid {
    record_consignment_usage(
        State(state(db.clone())),
        Extension(claims.clone()),
        Json(ConsignmentUsageRequest {
            batch_stock_id: batch,
            quantity,
            patient_id: None,
            encounter_id: None,
            admission_id: None,
            notes: None,
        }),
    )
    .await
    .expect("usage saves")
    .0
    .id
}

/// The OT nurse enters an implant of `batch` in the registry for `patient`.
pub(crate) async fn registry_entry(
    db: &PgPool,
    claims: &Claims,
    w: &Ward,
    batch: Uuid,
    patient: Uuid,
) -> ImplantRegistryEntry {
    create_implant_entry(
        State(state(db.clone())),
        Extension(claims.clone()),
        Json(CreateImplantRequest {
            catalog_item_id: knee(db, w.v.tenant).await,
            batch_stock_id: Some(batch),
            patient_id: patient,
            serial_number: Some("SN-1".to_owned()),
            // Today: a usage is claimed only near the implant date.
            implant_date: chrono::Utc::now().date_naive().to_string(),
            implant_site: Some("Left knee".to_owned()),
            surgeon_id: None,
            manufacturer: None,
            model_number: None,
            warranty_expiry: None,
            notes: None,
        }),
    )
    .await
    .expect("entry saves")
    .0
}

/// The knee implant store item of the tenant.
pub(crate) async fn knee(db: &PgPool, tenant: Uuid) -> Uuid {
    sqlx::query_scalar("SELECT id FROM store_catalog WHERE tenant_id = $1 AND code = 'LKKNEE'")
        .bind(tenant)
        .fetch_one(db)
        .await
        .unwrap()
}

/// Every bill line of the tenant under `code`: (source, source id, quantity).
pub(crate) async fn code_lines(db: &PgPool, tenant: Uuid, code: &str) -> Vec<(String, Uuid, i32)> {
    sqlx::query_as(
        "SELECT source::text, source_id, quantity FROM invoice_items \
          WHERE tenant_id = $1 AND charge_code = $2",
    )
    .bind(tenant)
    .bind(code)
    .fetch_all(db)
    .await
    .unwrap()
}

/// The queue row for `source`: (id, status, quantity, patient).
pub(crate) async fn row(db: &PgPool, source: Uuid) -> (Uuid, String, i32, Option<Uuid>) {
    sqlx::query_as(
        "SELECT id, status, quantity, patient_id FROM charge_attention_items \
          WHERE source_entity_id = $1",
    )
    .bind(source)
    .fetch_one(db)
    .await
    .unwrap()
}

/// Audit rows of the tenant under `action`.
pub(crate) async fn audits(db: &PgPool, tenant: Uuid, action: &str) -> i64 {
    sqlx::query_scalar("SELECT COUNT(*) FROM audit_log WHERE tenant_id = $1 AND action = $2")
        .bind(tenant)
        .bind(action)
        .fetch_one(db)
        .await
        .unwrap()
}

/// Name `patient` on the queue row `id`.
pub(crate) async fn name(
    db: &PgPool,
    claims: &Claims,
    id: Uuid,
    patient: Uuid,
) -> Result<Json<ChargeAttentionItem>, AppError> {
    name_patient_charge_attention(
        State(state(db.clone())),
        Extension(claims.clone()),
        Path(id),
        Json(NamePatientRequest {
            patient_id: patient,
        }),
    )
    .await
}
