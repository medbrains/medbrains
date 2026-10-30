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
    #[serde(rename = "line_id")]
    pub id: Uuid,
    pub catalog_item_id: Uuid,
    pub drug_name: String,
    pub quantity: i32,
    pub unit_price: Option<Decimal>,
    /// `pending`, `approved`, `rejected` or `outside_pharmacy`.
    pub status: String,
    /// When the pharmacist approved fewer than asked.
    pub approved_quantity: Option<i32>,
    pub reject_reason: Option<String>,
    /// What goes out instead, while a substitute stands agreed.
    pub substitute_name: Option<String>,
    /// The latest substitute proposed for this line, and where it stands.
    #[sqlx(skip)]
    pub substitution: Option<LineSubstitution>,
}

/// A substitute proposed for a line, as the patient and the pharmacist see it.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct LineSubstitution {
    pub id: Uuid,
    #[serde(skip)]
    pub store_order_line_id: Uuid,
    pub substitute_item_id: Uuid,
    pub substitute_name: String,
    /// `with_doctor`, `phone_pending`, `approved`, `declined`, `reverted`, `lapsed`.
    pub status: String,
    /// `sign_off` or `phone`.
    pub method: String,
    pub reason: String,
    /// `accepted`, `declined`, or none yet.
    pub patient_consent: Option<String>,
    pub confirm_due_at: Option<DateTime<Utc>>,
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
    /// What the pharmacist should look at, e.g. `repeat_order`.
    pub flags: Vec<String>,
    /// The latest return asked for on it, and where it stands.
    pub return_status: Option<String>,
    #[sqlx(skip)]
    pub lines: Vec<StoreOrderLine>,
    #[sqlx(skip)]
    pub total: Decimal,
}

const SELECT: &str = "SELECT s.id, s.status, s.rx_source, s.fulfilment, s.delivery_payment, \
        s.placed_at, s.decision_note, o.status::text AS pharmacy_stage, s.flags, \
        (SELECT r.status FROM pharmacy_store_returns r WHERE r.tenant_id = s.tenant_id \
          AND r.store_order_id = s.id AND r.deleted_at IS NULL \
          ORDER BY r.created_at DESC LIMIT 1) AS return_status \
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
        "SELECT store_order_id, id, catalog_item_id, drug_name, quantity, unit_price, status, \
                approved_quantity, reject_reason, substitute_name \
           FROM pharmacy_store_order_lines \
          WHERE tenant_id = $1 AND store_order_id = ANY($2) AND deleted_at IS NULL \
          ORDER BY created_at",
    )
    .bind(tenant_id)
    .bind(&ids)
    .fetch_all(&mut **tx)
    .await?;
    let mut subs: std::collections::HashMap<Uuid, LineSubstitution> =
        sqlx::query_as::<_, LineSubstitution>(
            "SELECT DISTINCT ON (r.store_order_line_id) r.id, r.store_order_line_id, \
                r.substitute_item_id, c.name AS substitute_name, r.status, r.method, r.reason, \
                r.patient_consent, r.confirm_due_at \
           FROM pharmacy_substitution_requests r \
           JOIN pharmacy_catalog c ON c.id = r.substitute_item_id AND c.tenant_id = r.tenant_id \
          WHERE r.tenant_id = $1 AND r.store_order_id = ANY($2) AND r.deleted_at IS NULL \
          ORDER BY r.store_order_line_id, r.created_at DESC",
        )
        .bind(tenant_id)
        .bind(&ids)
        .fetch_all(&mut **tx)
        .await?
        .into_iter()
        .map(|s| (s.store_order_line_id, s))
        .collect();
    let mut by_order: std::collections::HashMap<Uuid, Vec<StoreOrderLine>> =
        std::collections::HashMap::new();
    for mut l in lines {
        l.substitution = subs.remove(&l.id);
        by_order.entry(l.store_order_id).or_default().push(l);
    }
    for o in &mut orders {
        o.lines = by_order.remove(&o.id).unwrap_or_default();
        o.total = o
            .lines
            .iter()
            .filter(|l| l.status == "pending" || l.status == "approved")
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

/// Any order, for staff who already hold the right to see it.
pub(crate) async fn any_order(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    id: Uuid,
) -> Result<StoreOrderView, AppError> {
    let patient_id: Uuid = sqlx::query_scalar(
        "SELECT patient_id FROM pharmacy_store_orders \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;
    patient_order(tx, tenant_id, patient_id, id).await
}
