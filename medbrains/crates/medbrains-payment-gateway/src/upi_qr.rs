//! A UPI QR the patient pays at the counter, made by the hospital's online
//! provider (#4872, provider-neutral since #4884).
//!
//! Single-use and fixed to the amount due, so the patient cannot pay the
//! wrong figure, and confirmed by the provider's own webhook — which settles
//! through the same exactly-once path as checkout. No UTR is typed by
//! anyone. A provider without dynamic QR (or an account without the
//! feature) answers with a reason, and the counter falls back to the
//! hospital's own UPI ID QR, saying why.

use chrono::Utc;
use medbrains_server_core::error::AppError;
use rust_decimal::Decimal;
use sqlx::PgPool;
use uuid::Uuid;

use crate::online::{Chosen, QrAsk};

/// Inferred, not from any provider (Razorpay allows 2 minutes to 2 hours):
/// long enough to open a UPI app and pay, short enough that a QR left on the
/// screen does not take a payment hours later.
const QR_LIFETIME_SECS: i64 = 15 * 60;

/// A QR the provider made for a payment row.
#[derive(Debug)]
pub struct LiveQr {
    pub transaction_id: Uuid,
    pub qr_id: String,
    pub image_url: String,
    /// When the provider closes it (Unix seconds).
    pub close_by: i64,
}

/// What asking the provider for a QR came to.
#[derive(Debug)]
pub enum Made {
    Live(LiveQr),
    /// The provider made none; why, in words for the cashier.
    Unavailable(String),
}

/// What the QR is for.
#[derive(Debug)]
pub struct QrFor<'a> {
    pub tenant_id: Uuid,
    pub user_id: Uuid,
    pub invoice_id: Option<Uuid>,
    pub pos_sale_id: Option<Uuid>,
    pub amount: Decimal,
    pub amount_paise: i64,
    pub description: &'a str,
}

async fn begin(
    db: &PgPool,
    tenant_id: &Uuid,
) -> Result<sqlx::Transaction<'static, sqlx::Postgres>, AppError> {
    let mut tx = db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, tenant_id).await?;
    Ok(tx)
}

/// Make the payment row, then the provider's QR for it. The row is
/// committed before the call and records the answer either way, as
/// checkout's does.
///
/// # Errors
/// A database fault.
pub async fn make_live_qr(db: &PgPool, chosen: &Chosen, q: &QrFor<'_>) -> Result<Made, AppError> {
    let mut tx = begin(db, &q.tenant_id).await?;
    let txn_id: Uuid = sqlx::query_scalar(
        "INSERT INTO payment_gateway_transactions \
         (tenant_id, invoice_id, pharmacy_pos_sale_id, gateway, gateway_order_id, \
          amount, currency, status, created_by) \
         VALUES ($1, $2, $3, $4, '', $5, 'INR', 'pending_gateway', $6) \
         RETURNING id",
    )
    .bind(q.tenant_id)
    .bind(q.invoice_id)
    .bind(q.pos_sale_id)
    .bind(chosen.provider.code())
    .bind(q.amount)
    .bind(q.user_id)
    .fetch_one(&mut *tx)
    .await?;
    sqlx::query("UPDATE payment_gateway_transactions SET idempotency_key = id::text WHERE id = $1")
        .bind(txn_id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;

    let ask = QrAsk {
        txn_id,
        tenant_id: q.tenant_id,
        amount_paise: q.amount_paise,
        description: q.description,
        close_by: Utc::now().timestamp() + QR_LIFETIME_SECS,
    };
    let answer = chosen.provider.create_dynamic_qr(&chosen.ctx(), &ask).await;
    let mut tx = begin(db, &q.tenant_id).await?;
    let qr = match answer {
        Ok(qr) => qr,
        Err(e) => {
            let why = e.words();
            sqlx::query(
                "UPDATE payment_gateway_transactions SET status = 'failed', \
                 error_description = $2, updated_at = now() WHERE id = $1",
            )
            .bind(txn_id)
            .bind(&why)
            .execute(&mut *tx)
            .await?;
            tx.commit().await?;
            return Ok(Made::Unavailable(why));
        }
    };
    sqlx::query(
        "UPDATE payment_gateway_transactions SET status = 'created', gateway_order_id = $2, \
         notes = notes || jsonb_build_object('qr_image_url', $3::text, 'qr_close_by', $4::bigint), \
         updated_at = now() WHERE id = $1",
    )
    .bind(txn_id)
    .bind(&qr.order_ref)
    .bind(&qr.image_url)
    .bind(qr.close_by)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Made::Live(LiveQr {
        transaction_id: txn_id,
        qr_id: qr.order_ref,
        image_url: qr.image_url,
        close_by: qr.close_by,
    }))
}
