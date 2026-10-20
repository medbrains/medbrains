//! A UPI QR the patient pays at the counter, made by Razorpay (#4872).
//!
//! Single-use and fixed to the amount due, so the patient cannot pay the
//! wrong figure, and confirmed by Razorpay's `qr_code.credited` webhook —
//! which settles through the same exactly-once path as checkout. No UTR is
//! typed by anyone.
//!
//! Per Razorpay's QR Codes API (`POST /v1/payments/qr_codes`, `type:
//! upi_qr`): an on-demand feature Razorpay Support switches on per account.
//! An account without it answers with a refusal, and the counter falls back
//! to the hospital's own UPI ID QR, saying why.

use chrono::Utc;
use medbrains_core::secrets::SecretResolver;
use medbrains_server_core::error::AppError;
use rust_decimal::Decimal;
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

use crate::razorpay::{self, Answer, Credentials};

/// Inferred, not from Razorpay (which allows 2 minutes to 2 hours): long
/// enough to open a UPI app and pay, short enough that a QR left on the
/// screen does not take a payment hours later.
const QR_LIFETIME_SECS: i64 = 15 * 60;

/// A QR Razorpay made for a payment row.
#[derive(Debug)]
pub struct LiveQr {
    pub transaction_id: Uuid,
    pub qr_id: String,
    pub image_url: String,
    /// When Razorpay closes it (Unix seconds).
    pub close_by: i64,
}

/// What asking Razorpay for a QR came to.
#[derive(Debug)]
pub enum Made {
    Live(LiveQr),
    /// Razorpay made none; why, in words for the cashier.
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

/// Make the payment row, then Razorpay's QR for it. The row is committed
/// before the call and records the answer either way, as checkout's does.
///
/// # Errors
/// A database fault.
pub async fn make_live_qr(
    db: &PgPool,
    secrets: &dyn SecretResolver,
    keys: &Credentials,
    q: &QrFor<'_>,
) -> Result<Made, AppError> {
    let mut tx = begin(db, &q.tenant_id).await?;
    let txn_id: Uuid = sqlx::query_scalar(
        "INSERT INTO payment_gateway_transactions \
         (tenant_id, invoice_id, pharmacy_pos_sale_id, gateway, gateway_order_id, \
          amount, currency, status, created_by) \
         VALUES ($1, $2, $3, 'razorpay', '', $4, 'INR', 'pending_gateway', $5) \
         RETURNING id",
    )
    .bind(q.tenant_id)
    .bind(q.invoice_id)
    .bind(q.pos_sale_id)
    .bind(q.amount)
    .bind(q.user_id)
    .fetch_one(&mut *tx)
    .await?;
    sqlx::query("UPDATE payment_gateway_transactions SET idempotency_key = id::text WHERE id = $1")
        .bind(txn_id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;

    let close_by = Utc::now().timestamp() + QR_LIFETIME_SECS;
    let body = json!({
        "type": "upi_qr",
        "name": "MedBrains counter",
        "usage": "single_use",
        "fixed_amount": true,
        "payment_amount": q.amount_paise,
        "description": q.description,
        "close_by": close_by,
        "notes": { "tenant_id": q.tenant_id, "internal_payment_id": txn_id },
    });
    let answer = razorpay::call(secrets, keys, "/payments/qr_codes", Some(&body)).await;
    let made = match &answer {
        Answer::Ok(v) => v["id"]
            .as_str()
            .zip(v["image_url"].as_str())
            .map(|(id, url)| (id.to_owned(), url.to_owned(), v["close_by"].as_i64())),
        _ => None,
    };
    let mut tx = begin(db, &q.tenant_id).await?;
    let Some((qr_id, image_url, closes)) = made else {
        let why = match answer {
            Answer::Refused(w) => format!("Razorpay would not make a UPI QR: {w}"),
            Answer::Unreachable(w) => w,
            Answer::Ok(_) => "Razorpay's answer named no QR".to_owned(),
        };
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
    };
    let close_by = closes.unwrap_or(close_by);
    sqlx::query(
        "UPDATE payment_gateway_transactions SET status = 'created', gateway_order_id = $2, \
         notes = notes || jsonb_build_object('qr_image_url', $3::text, 'qr_close_by', $4::bigint), \
         updated_at = now() WHERE id = $1",
    )
    .bind(txn_id)
    .bind(&qr_id)
    .bind(&image_url)
    .bind(close_by)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Made::Live(LiveQr {
        transaction_id: txn_id,
        qr_id,
        image_url,
        close_by,
    }))
}
