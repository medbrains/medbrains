//! Refunds for online orders: back the way the patient paid — the online
//! payment, through the hospital's payment provider, or cash at the pharmacy
//! — once. A refund is recorded the moment it is owed (a cancellation, an
//! accepted return) under a key made from its cause, so asking twice finds
//! the first; the pharmacy issues it within 24 hours (research brief §7),
//! and issuing twice does nothing more.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::permissions;
use medbrains_payment_gateway::online::OnlineError;
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};
use rust_decimal::Decimal;
use serde::Serialize;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// Hours within which a refund owed is to be issued.
pub const ISSUE_WITHIN_HOURS: i64 = 24;
/// Refunds one screen lists, at most.
const LIST_LIMIT: i64 = 200;

/// What a refund is owed for.
pub(crate) struct Owed {
    pub store_order_id: Uuid,
    pub store_return_id: Option<Uuid>,
    /// `cancelled` or `returned`.
    pub cause: &'static str,
    pub amount: Decimal,
}

/// The online payment's id and what is left on it, the bill, and what the
/// bill has been paid.
type Paid = (Option<Uuid>, Option<Decimal>, Option<Uuid>, Decimal);

/// Record the refund owed, once per cause: a second call finds the first.
/// Back to the online payment when the order was paid online, else in cash
/// against the bill. Nothing paid, nothing owed.
pub(crate) async fn owe(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    owed: &Owed,
) -> Result<Option<Uuid>, AppError> {
    let paid: Paid = sqlx::query_as(
        "SELECT t.id, t.amount - COALESCE(t.refund_amount, 0), \
                (SELECT ii.invoice_id FROM invoice_items ii \
                  WHERE ii.tenant_id = o.tenant_id AND ii.pharmacy_order_id = o.pharmacy_order_id \
                  LIMIT 1), \
                COALESCE((SELECT i.paid_amount FROM invoices i WHERE i.tenant_id = o.tenant_id \
                    AND i.id = (SELECT ii.invoice_id FROM invoice_items ii \
                                 WHERE ii.tenant_id = o.tenant_id \
                                   AND ii.pharmacy_order_id = o.pharmacy_order_id LIMIT 1)), 0) \
           FROM pharmacy_store_orders o \
           LEFT JOIN payment_gateway_transactions t ON t.id = o.payment_txn_id \
                AND t.status IN ('captured', 'refunded') \
          WHERE o.id = $1 AND o.tenant_id = $2",
    )
    .bind(owed.store_order_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let (txn, online_left, invoice, invoice_paid) = paid;
    let (method, cap) = match (txn, online_left) {
        (Some(_), Some(left)) => ("online", left),
        _ => ("cash", invoice_paid),
    };
    let amount = owed.amount.min(cap).round_dp(2);
    if amount <= Decimal::ZERO {
        return Ok(None);
    }
    let key = format!(
        "{}:{}:{}",
        owed.cause,
        owed.store_order_id,
        owed.store_return_id
            .map_or_else(String::new, |r| r.to_string())
    );
    sqlx::query(
        "INSERT INTO pharmacy_store_refunds \
           (tenant_id, store_order_id, store_return_id, cause, amount, method, payment_txn_id, \
            invoice_id, idempotency_key, due_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now() + make_interval(hours => $10)) \
         ON CONFLICT (tenant_id, idempotency_key) DO NOTHING",
    )
    .bind(tenant_id)
    .bind(owed.store_order_id)
    .bind(owed.store_return_id)
    .bind(owed.cause)
    .bind(amount)
    .bind(method)
    .bind(if method == "online" { txn } else { None })
    .bind(invoice)
    .bind(&key)
    .bind(i32::try_from(ISSUE_WITHIN_HOURS).unwrap_or(i32::MAX))
    .execute(&mut **tx)
    .await?;
    Ok(sqlx::query_scalar(
        "SELECT id FROM pharmacy_store_refunds WHERE tenant_id = $1 AND idempotency_key = $2",
    )
    .bind(tenant_id)
    .bind(&key)
    .fetch_optional(&mut **tx)
    .await?)
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct StoreRefund {
    pub id: Uuid,
    pub store_order_id: Uuid,
    pub cause: String,
    pub amount: Decimal,
    pub method: String,
    pub status: String,
    pub due_by: chrono::DateTime<chrono::Utc>,
    pub refund_reference: Option<String>,
    pub issued_at: Option<chrono::DateTime<chrono::Utc>>,
    pub patient_id: Uuid,
}

const REFUND_SELECT: &str = "SELECT r.id, r.store_order_id, r.cause, r.amount, r.method, \
        r.status, r.due_by, r.refund_reference, r.issued_at, o.patient_id \
   FROM pharmacy_store_refunds r \
   JOIN pharmacy_store_orders o ON o.id = r.store_order_id AND o.tenant_id = r.tenant_id \
  WHERE r.tenant_id = $1 AND r.deleted_at IS NULL";

/// `GET /api/pharmacy/storefront/refunds` — refunds owed first, oldest due
/// first, then the latest issued.
pub async fn list(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<StoreRefund>>, AppError> {
    require_permission(&claims, permissions::pharmacy::storefront::RETURNS)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, StoreRefund>(&format!(
        "{REFUND_SELECT} ORDER BY r.status = 'pending' DESC, \
           CASE WHEN r.status = 'pending' THEN r.due_by END, r.issued_at DESC LIMIT $2"
    ))
    .bind(claims.tenant_id)
    .bind(LIST_LIMIT)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(sqlx::FromRow)]
struct Owing {
    status: String,
    method: String,
    amount: Decimal,
    payment_txn_id: Option<Uuid>,
    invoice_id: Option<Uuid>,
}

/// `POST /api/pharmacy/storefront/refunds/{id}/issue` — send the money back:
/// through the payment provider for an online payment, or as cash paid out
/// against the bill. Issuing an issued refund returns it unchanged. A provider
/// that cannot refund or does not answer says so (422 / 503), as at billing.
pub async fn issue(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<StoreRefund>, OnlineError> {
    require_permission(&claims, permissions::pharmacy::storefront::RETURNS)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let Owing {
        status,
        method,
        amount,
        payment_txn_id: txn,
        invoice_id: invoice,
    } = sqlx::query_as::<_, Owing>(
        "SELECT status, method, amount, payment_txn_id, invoice_id FROM pharmacy_store_refunds \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL FOR UPDATE",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    if status == "pending" {
        let reference = match (method.as_str(), txn) {
            ("online", Some(txn_id)) => {
                let refund = medbrains_payment_gateway::refund::Refund {
                    txn_id,
                    amount: Some(amount),
                    reason: "Online pharmacy order refund",
                    refunded_by: Some(claims.sub),
                };
                medbrains_payment_gateway::refund::refund_payment(&state, &mut tx, &refund).await?
            }
            _ => cash_refund(&mut tx, &claims, id, amount, invoice).await?,
        };
        sqlx::query(
            "UPDATE pharmacy_store_refunds \
                SET status = 'issued', refund_reference = $3, issued_by = $4, issued_at = now() \
              WHERE id = $1 AND tenant_id = $2",
        )
        .bind(id)
        .bind(claims.tenant_id)
        .bind(&reference)
        .bind(claims.sub)
        .execute(&mut *tx)
        .await?;
    }
    let row = sqlx::query_as::<_, StoreRefund>(&format!("{REFUND_SELECT} AND r.id = $2"))
        .bind(claims.tenant_id)
        .bind(id)
        .fetch_one(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// Cash paid out at the pharmacy, taken off the bill through billing's
/// refund posting. With no bill, the reference alone records it.
async fn cash_refund(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    id: Uuid,
    amount: Decimal,
    invoice: Option<Uuid>,
) -> Result<String, AppError> {
    let reference = format!("STORE-RF-{}", &id.simple().to_string()[..12]);
    if let Some(invoice_id) = invoice {
        let posted = medbrains_billing::posting::post_refund(
            tx,
            &medbrains_billing::posting::PostRefund {
                tenant_id: claims.tenant_id,
                invoice_id,
                payment_id: None,
                amount,
                reason: "Online pharmacy order refund",
                mode: "cash",
                reference_number: Some(&reference),
                refunded_by: Some(claims.sub),
            },
        )
        .await?;
        if let medbrains_billing::posting::Posted::Refused(why) = posted {
            return Err(AppError::Conflict(why));
        }
    }
    Ok(reference)
}
