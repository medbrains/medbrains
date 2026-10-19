//! A patient's own storefront orders: what they ordered, where each stands,
//! and the pharmacist's answer. Another patient's order is not found.

use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::Serialize;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use medbrains_server_core::error::AppError;

/// Orders the patient's list shows.
const ORDER_LIMIT: i64 = 20;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct StoreOrderLine {
    #[serde(skip)]
    pub store_order_id: Uuid,
    pub catalog_item_id: Uuid,
    pub drug_name: String,
    pub quantity: i32,
    pub unit_price: Option<Decimal>,
    /// `pending`, `approved` or `rejected`.
    pub status: String,
    /// When the pharmacist approved fewer than asked.
    pub approved_quantity: Option<i32>,
    pub reject_reason: Option<String>,
}

#[derive(Debug, Default, Serialize, sqlx::FromRow)]
pub struct StoreOrderView {
    pub id: Uuid,
    /// `awaiting_verification`, `released`, `rejected` or `cancelled`.
    pub status: String,
    pub rx_source: String,
    pub fulfilment: String,
    pub delivery_payment: Option<String>,
    pub placed_at: Option<DateTime<Utc>>,
    /// The pharmacist's reason, when lines or the order were not approved.
    pub decision_note: Option<String>,
    /// Where the pharmacy is with it once released: ordered … ready, collected.
    pub pharmacy_stage: Option<String>,
    #[sqlx(skip)]
    pub lines: Vec<StoreOrderLine>,
    #[sqlx(skip)]
    pub total: Decimal,
}

const SELECT: &str = "SELECT s.id, s.status, s.rx_source, s.fulfilment, s.delivery_payment, \
        s.placed_at, s.decision_note, o.status AS pharmacy_stage \
   FROM pharmacy_store_orders s \
   LEFT JOIN pharmacy_orders o ON o.id = s.pharmacy_order_id AND o.tenant_id = s.tenant_id \
  WHERE s.tenant_id = $1 AND s.patient_id = $2 AND s.status <> 'cart' AND s.deleted_at IS NULL \
    AND ($3::uuid IS NULL OR s.id = $3) \
  ORDER BY s.placed_at DESC NULLS LAST LIMIT $4";

/// Fill each order's lines and total, in one query for all of them.
pub(crate) async fn with_lines(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    mut orders: Vec<StoreOrderView>,
) -> Result<Vec<StoreOrderView>, AppError> {
    let ids: Vec<Uuid> = orders.iter().map(|o| o.id).collect();
    let lines = sqlx::query_as::<_, StoreOrderLine>(
        "SELECT store_order_id, catalog_item_id, drug_name, quantity, unit_price, status, \
                approved_quantity, reject_reason \
           FROM pharmacy_store_order_lines \
          WHERE tenant_id = $1 AND store_order_id = ANY($2) AND deleted_at IS NULL \
          ORDER BY created_at",
    )
    .bind(tenant_id)
    .bind(&ids)
    .fetch_all(&mut **tx)
    .await?;
    let mut by_order: std::collections::HashMap<Uuid, Vec<StoreOrderLine>> =
        std::collections::HashMap::new();
    for l in lines {
        by_order.entry(l.store_order_id).or_default().push(l);
    }
    for o in &mut orders {
        o.lines = by_order.remove(&o.id).unwrap_or_default();
        o.total = o
            .lines
            .iter()
            .filter(|l| l.status != "rejected")
            .filter_map(|l| {
                l.unit_price
                    .map(|p| p * Decimal::from(l.approved_quantity.unwrap_or(l.quantity)))
            })
            .sum();
    }
    Ok(orders)
}

/// The patient's orders, newest first.
pub async fn patient_orders(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<Vec<StoreOrderView>, AppError> {
    let orders = sqlx::query_as::<_, StoreOrderView>(SELECT)
        .bind(tenant_id)
        .bind(patient_id)
        .bind(None::<Uuid>)
        .bind(ORDER_LIMIT)
        .fetch_all(&mut **tx)
        .await?;
    with_lines(tx, tenant_id, orders).await
}

/// One of the patient's orders; anyone else's is not found.
pub async fn patient_order(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
    id: Uuid,
) -> Result<StoreOrderView, AppError> {
    let orders = sqlx::query_as::<_, StoreOrderView>(SELECT)
        .bind(tenant_id)
        .bind(patient_id)
        .bind(Some(id))
        .bind(1_i64)
        .fetch_all(&mut **tx)
        .await?;
    with_lines(tx, tenant_id, orders)
        .await?
        .into_iter()
        .next()
        .ok_or(AppError::NotFound)
}
