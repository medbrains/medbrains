use axum::{
    Extension, Json,
    extract::{Path, State},
    http::HeaderMap,
};
use hmac::{Hmac, Mac};
use medbrains_core::payment::{
    CreateOrderResponse, PaymentGatewayTransaction, VerifyPaymentRequest,
};
use medbrains_core::permissions;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

type HmacSha256 = Hmac<Sha256>;

// ══════════════════════════════════════════════════════════
//  Config helpers
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
struct RazorpayConfig {
    key_id: String,
    key_secret: String,
    #[serde(default)]
    webhook_secret: Option<String>,
}

/// Read Razorpay config from `tenant_settings` or env vars.
async fn get_razorpay_config(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
) -> Result<RazorpayConfig, AppError> {
    // Try tenant_settings first
    let row = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'payments' AND key = 'razorpay_config'",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;

    if let Some(val) = row {
        let cfg: RazorpayConfig = serde_json::from_value(val)
            .map_err(|e| AppError::Internal(format!("invalid razorpay_config: {e}")))?;
        return Ok(cfg);
    }

    // Fall back to env vars
    let key_id = std::env::var("RAZORPAY_KEY_ID")
        .map_err(|_| AppError::Internal("RAZORPAY_KEY_ID not configured".to_owned()))?;
    let key_secret = std::env::var("RAZORPAY_KEY_SECRET")
        .map_err(|_| AppError::Internal("RAZORPAY_KEY_SECRET not configured".to_owned()))?;
    let webhook_secret = std::env::var("RAZORPAY_WEBHOOK_SECRET").ok();

    Ok(RazorpayConfig {
        key_id,
        key_secret,
        webhook_secret,
    })
}

/// Read UPI VPA from `tenant_settings`.
async fn get_upi_vpa(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
) -> Result<Option<String>, AppError> {
    let row = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'payments' AND key = 'upi_vpa'",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;

    Ok(row.and_then(|v| v.as_str().map(ToOwned::to_owned)))
}

// ══════════════════════════════════════════════════════════
//  Request / Response types
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateOrderRequest {
    pub invoice_id: Option<Uuid>,
    pub pos_sale_id: Option<Uuid>,
    pub amount: Decimal,
    pub currency: Option<String>,
    pub receipt: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PaymentStatusResponse {
    pub transaction: PaymentGatewayTransaction,
}

#[derive(Debug, Deserialize)]
pub struct GenerateUpiQrRequest {
    pub amount: Decimal,
    pub invoice_id: Option<Uuid>,
    pub pos_sale_id: Option<Uuid>,
    pub description: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct UpiQrResponse {
    pub upi_uri: String,
    pub vpa: String,
    pub amount: Decimal,
    pub transaction_ref: String,
}

#[derive(Debug, Deserialize)]
pub struct InitiateRefundRequest {
    pub transaction_id: Uuid,
    pub amount: Option<Decimal>,
    pub reason: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RefundResponse {
    pub transaction: PaymentGatewayTransaction,
    pub refund_id: String,
}

// ══════════════════════════════════════════════════════════
//  POST /api/payments/create-order
// ══════════════════════════════════════════════════════════

pub async fn create_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateOrderRequest>,
) -> Result<Json<CreateOrderResponse>, AppError> {
    require_permission(&claims, permissions::billing::payments::CREATE)?;

    if body.invoice_id.is_none() && body.pos_sale_id.is_none() {
        return Err(AppError::BadRequest(
            "either invoice_id or pos_sale_id is required".to_owned(),
        ));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let config = get_razorpay_config(&mut tx, &claims.tenant_id).await?;
    let currency = body.currency.as_deref().unwrap_or("INR");

    // Convert amount to paise (smallest unit)
    let amount_paise = (body.amount * Decimal::from(100))
        .to_string()
        .parse::<i64>()
        .map_err(|e| AppError::Internal(format!("amount conversion: {e}")))?;

    let receipt = body
        .receipt
        .clone()
        .unwrap_or_else(|| format!("rcpt_{}", Uuid::new_v4()));

    // Call Razorpay Orders API
    let client = reqwest::Client::new();
    let rz_body = serde_json::json!({
        "amount": amount_paise,
        "currency": currency,
        "receipt": receipt,
    });

    let response = client
        .post("https://api.razorpay.com/v1/orders")
        .basic_auth(&config.key_id, Some(&config.key_secret))
        .json(&rz_body)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("razorpay request failed: {e}")))?;

    if !response.status().is_success() {
        let err_text = response
            .text()
            .await
            .unwrap_or_else(|_| "unknown".to_owned());
        return Err(AppError::Internal(format!(
            "razorpay order creation failed: {err_text}"
        )));
    }

    let rz_order: serde_json::Value = response
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("razorpay response parse: {e}")))?;

    let gateway_order_id = rz_order["id"]
        .as_str()
        .ok_or_else(|| AppError::Internal("missing order id in razorpay response".to_owned()))?
        .to_owned();

    // Save transaction record
    let txn = sqlx::query_as::<_, PaymentGatewayTransaction>(
        "INSERT INTO payment_gateway_transactions \
         (tenant_id, invoice_id, pharmacy_pos_sale_id, gateway, gateway_order_id, \
          amount, currency, status, created_by) \
         VALUES ($1, $2, $3, 'razorpay', $4, $5, $6, 'created', $7) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.invoice_id)
    .bind(body.pos_sale_id)
    .bind(&gateway_order_id)
    .bind(body.amount)
    .bind(currency)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(CreateOrderResponse {
        transaction_id: txn.id,
        order_id: gateway_order_id,
        amount: body.amount,
        currency: currency.to_owned(),
        key_id: config.key_id,
    }))
}

// ══════════════════════════════════════════════════════════
//  POST /api/payments/verify
// ══════════════════════════════════════════════════════════

pub async fn verify_payment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<VerifyPaymentRequest>,
) -> Result<Json<PaymentGatewayTransaction>, AppError> {
    require_permission(&claims, permissions::billing::payments::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let config = get_razorpay_config(&mut tx, &claims.tenant_id).await?;

    // Verify HMAC-SHA256 signature
    let payload = format!("{}|{}", body.razorpay_order_id, body.razorpay_payment_id);
    let mut mac = HmacSha256::new_from_slice(config.key_secret.as_bytes())
        .map_err(|e| AppError::Internal(format!("hmac init: {e}")))?;
    mac.update(payload.as_bytes());
    let expected = hex::encode(mac.finalize().into_bytes());

    if expected != body.razorpay_signature {
        return Err(AppError::BadRequest(
            "payment signature verification failed".to_owned(),
        ));
    }

    // Update transaction to captured
    let txn = sqlx::query_as::<_, PaymentGatewayTransaction>(
        "UPDATE payment_gateway_transactions SET \
         gateway_payment_id = $1, gateway_signature = $2, \
         status = 'captured', verified_at = now(), updated_at = now() \
         WHERE gateway_order_id = $3 AND tenant_id = $4 \
         RETURNING *",
    )
    .bind(&body.razorpay_payment_id)
    .bind(&body.razorpay_signature)
    .bind(&body.razorpay_order_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    // Auto-record payment in billing payments table if linked to an invoice
    if let Some(invoice_id) = txn.invoice_id {
        record_invoice_payment(
            &mut tx,
            claims.tenant_id,
            invoice_id,
            txn.amount,
            &body.razorpay_payment_id,
        )
        .await?;
    }

    tx.commit().await?;

    let _ = crate::events::emit_event(
        &state.db,
        claims.tenant_id,
        claims.sub,
        "payment.gateway.captured",
        serde_json::json!({
            "transaction_id": txn.id,
            "gateway_payment_id": body.razorpay_payment_id,
            "amount": txn.amount,
        }),
    )
    .await;

    Ok(Json(txn))
}

// ══════════════════════════════════════════════════════════
//  POST /api/webhooks/razorpay  (PUBLIC — no auth)
// ══════════════════════════════════════════════════════════

pub async fn razorpay_webhook(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: String,
) -> Result<Json<serde_json::Value>, AppError> {
    let signature = headers
        .get("X-Razorpay-Signature")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| AppError::BadRequest("missing X-Razorpay-Signature header".to_owned()))?;

    let payload: serde_json::Value = serde_json::from_str(&body)
        .map_err(|e| AppError::BadRequest(format!("invalid webhook payload: {e}")))?;

    let order_id = payload["payload"]["order"]["entity"]["id"]
        .as_str()
        .or_else(|| payload["payload"]["payment"]["entity"]["order_id"].as_str());

    let Some(order_id) = order_id else {
        tracing::warn!("webhook missing order_id in payload");
        return Ok(Json(serde_json::json!({ "status": "ignored" })));
    };

    let txn_row = sqlx::query_as::<_, PaymentGatewayTransaction>(
        "SELECT * FROM payment_gateway_transactions WHERE gateway_order_id = $1 LIMIT 1",
    )
    .bind(order_id)
    .fetch_optional(&state.db)
    .await?;

    let Some(txn_row) = txn_row else {
        tracing::warn!(order_id, "webhook for unknown order");
        return Ok(Json(serde_json::json!({ "status": "unknown_order" })));
    };

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &txn_row.tenant_id).await?;

    verify_webhook_signature(&mut tx, &txn_row, &body, signature).await?;

    let event = payload["event"].as_str().unwrap_or("");
    match event {
        "payment.captured" => {
            handle_webhook_captured(&mut tx, &txn_row, order_id, &payload).await?
        }
        "payment.failed" => handle_webhook_failed(&mut tx, &txn_row, order_id, &payload).await?,
        "refund.created" => handle_webhook_refund(&mut tx, &txn_row, order_id, &payload).await?,
        _ => tracing::info!(event, "unhandled razorpay webhook event"),
    }

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "status": "ok" })))
}

async fn verify_webhook_signature(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    txn_row: &PaymentGatewayTransaction,
    body: &str,
    signature: &str,
) -> Result<(), AppError> {
    let config = get_razorpay_config(tx, &txn_row.tenant_id).await?;
    let secret = config
        .webhook_secret
        .as_deref()
        .unwrap_or(&config.key_secret);
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes())
        .map_err(|e| AppError::Internal(format!("hmac init: {e}")))?;
    mac.update(body.as_bytes());
    let expected = hex::encode(mac.finalize().into_bytes());
    if expected != signature {
        return Err(AppError::BadRequest(
            "webhook signature verification failed".to_owned(),
        ));
    }
    Ok(())
}

async fn handle_webhook_captured(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    txn_row: &PaymentGatewayTransaction,
    order_id: &str,
    payload: &serde_json::Value,
) -> Result<(), AppError> {
    let payment = &payload["payload"]["payment"]["entity"];
    let payment_id = payment["id"].as_str().unwrap_or("");
    let method = payment["method"].as_str();

    sqlx::query(
        "UPDATE payment_gateway_transactions SET \
         gateway_payment_id = $1, status = 'captured', payment_method = $2, \
         webhook_payload = $3, verified_at = now(), updated_at = now() \
         WHERE gateway_order_id = $4 AND tenant_id = $5 AND status != 'captured'",
    )
    .bind(payment_id)
    .bind(method)
    .bind(payload)
    .bind(order_id)
    .bind(txn_row.tenant_id)
    .execute(&mut **tx)
    .await?;

    if let Some(invoice_id) = txn_row.invoice_id {
        if txn_row.status != "captured" {
            record_invoice_payment(
                tx,
                txn_row.tenant_id,
                invoice_id,
                txn_row.amount,
                payment_id,
            )
            .await?;
        }
    }
    Ok(())
}

async fn handle_webhook_failed(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    txn_row: &PaymentGatewayTransaction,
    order_id: &str,
    payload: &serde_json::Value,
) -> Result<(), AppError> {
    let payment = &payload["payload"]["payment"]["entity"];
    sqlx::query(
        "UPDATE payment_gateway_transactions SET \
         status = 'failed', error_code = $1, error_description = $2, \
         webhook_payload = $3, updated_at = now() \
         WHERE gateway_order_id = $4 AND tenant_id = $5",
    )
    .bind(payment["error_code"].as_str())
    .bind(payment["error_description"].as_str())
    .bind(payload)
    .bind(order_id)
    .bind(txn_row.tenant_id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

async fn handle_webhook_refund(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    txn_row: &PaymentGatewayTransaction,
    order_id: &str,
    payload: &serde_json::Value,
) -> Result<(), AppError> {
    let refund = &payload["payload"]["refund"]["entity"];
    let refund_id = refund["id"].as_str().unwrap_or("");
    let refund_paise = refund["amount"].as_i64().unwrap_or(0);
    let refund_amount = Decimal::from(refund_paise) / Decimal::from(100);

    sqlx::query(
        "UPDATE payment_gateway_transactions SET \
         status = 'refunded', refund_id = $1, refund_amount = $2, \
         webhook_payload = $3, updated_at = now() \
         WHERE gateway_order_id = $4 AND tenant_id = $5",
    )
    .bind(refund_id)
    .bind(refund_amount)
    .bind(payload)
    .bind(order_id)
    .bind(txn_row.tenant_id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Record a payment against an invoice and update its status.
async fn record_invoice_payment(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    invoice_id: Uuid,
    amount: Decimal,
    reference: &str,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO payments \
         (tenant_id, invoice_id, amount, mode, reference_number, notes, paid_at) \
         VALUES ($1, $2, $3, 'upi'::payment_mode, $4, 'Razorpay gateway', now())",
    )
    .bind(tenant_id)
    .bind(invoice_id)
    .bind(amount)
    .bind(reference)
    .execute(&mut **tx)
    .await?;

    sqlx::query(
        "UPDATE invoices SET \
         paid_amount = paid_amount + $1, \
         status = CASE \
           WHEN paid_amount + $1 >= total_amount THEN 'paid'::invoice_status \
           ELSE 'partially_paid'::invoice_status \
         END, \
         updated_at = now() \
         WHERE id = $2 AND tenant_id = $3",
    )
    .bind(amount)
    .bind(invoice_id)
    .bind(tenant_id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

// ══════════════════════════════════════════════════════════
//  GET /api/payments/{id}/status
// ══════════════════════════════════════════════════════════

pub async fn get_payment_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PaymentStatusResponse>, AppError> {
    require_permission(&claims, permissions::billing::payments::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let txn = sqlx::query_as::<_, PaymentGatewayTransaction>(
        "SELECT * FROM payment_gateway_transactions WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(PaymentStatusResponse { transaction: txn }))
}

// ══════════════════════════════════════════════════════════
//  POST /api/payments/upi-qr
// ══════════════════════════════════════════════════════════

pub async fn generate_upi_qr(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<GenerateUpiQrRequest>,
) -> Result<Json<UpiQrResponse>, AppError> {
    require_permission(&claims, permissions::billing::payments::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let vpa = get_upi_vpa(&mut tx, &claims.tenant_id)
        .await?
        .ok_or_else(|| {
            AppError::BadRequest("UPI VPA not configured in tenant settings".to_owned())
        })?;

    // Get hospital name for payee name
    let hospital_name = sqlx::query_scalar::<_, String>("SELECT name FROM tenants WHERE id = $1")
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .unwrap_or_else(|| "Hospital".to_owned());

    let txn_ref = format!("MDB{}", Uuid::new_v4().simple());
    let description = body.description.as_deref().unwrap_or("Hospital Payment");

    let upi_uri = format!(
        "upi://pay?pa={vpa}&pn={pn}&am={am}&tn={tn}&tr={tr}",
        vpa = vpa,
        pn = urlencoded(&hospital_name),
        am = body.amount,
        tn = urlencoded(description),
        tr = txn_ref,
    );

    // Save a transaction record for tracking
    sqlx::query(
        "INSERT INTO payment_gateway_transactions \
         (tenant_id, invoice_id, pharmacy_pos_sale_id, gateway, gateway_order_id, \
          amount, currency, status, upi_vpa, created_by) \
         VALUES ($1, $2, $3, 'upi_qr', $4, $5, 'INR', 'created', $6, $7)",
    )
    .bind(claims.tenant_id)
    .bind(body.invoice_id)
    .bind(body.pos_sale_id)
    .bind(&txn_ref)
    .bind(body.amount)
    .bind(&vpa)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(UpiQrResponse {
        upi_uri,
        vpa,
        amount: body.amount,
        transaction_ref: txn_ref,
    }))
}

// ══════════════════════════════════════════════════════════
//  POST /api/payments/refund
// ══════════════════════════════════════════════════════════

pub async fn initiate_refund(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<InitiateRefundRequest>,
) -> Result<Json<RefundResponse>, AppError> {
    require_permission(&claims, permissions::billing::payments::VOID)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let txn = sqlx::query_as::<_, PaymentGatewayTransaction>(
        "SELECT * FROM payment_gateway_transactions WHERE id = $1 AND tenant_id = $2",
    )
    .bind(body.transaction_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    if txn.status != "captured" {
        return Err(AppError::BadRequest(
            "can only refund captured payments".to_owned(),
        ));
    }

    let Some(ref gateway_payment_id) = txn.gateway_payment_id else {
        return Err(AppError::BadRequest(
            "no gateway payment id for this transaction".to_owned(),
        ));
    };

    let config = get_razorpay_config(&mut tx, &claims.tenant_id).await?;

    let refund_amount = body.amount.unwrap_or(txn.amount);
    let refund_paise = (refund_amount * Decimal::from(100))
        .to_string()
        .parse::<i64>()
        .map_err(|e| AppError::Internal(format!("amount conversion: {e}")))?;

    let mut rz_body = serde_json::json!({
        "amount": refund_paise,
    });
    if let Some(ref reason) = body.reason {
        rz_body["notes"] = serde_json::json!({ "reason": reason });
    }

    let client = reqwest::Client::new();
    let url = format!("https://api.razorpay.com/v1/payments/{gateway_payment_id}/refund");
    let response = client
        .post(&url)
        .basic_auth(&config.key_id, Some(&config.key_secret))
        .json(&rz_body)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("razorpay refund request failed: {e}")))?;

    if !response.status().is_success() {
        let err_text = response
            .text()
            .await
            .unwrap_or_else(|_| "unknown".to_owned());
        return Err(AppError::Internal(format!(
            "razorpay refund failed: {err_text}"
        )));
    }

    let rz_refund: serde_json::Value = response
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("razorpay refund parse: {e}")))?;

    let refund_id = rz_refund["id"].as_str().unwrap_or("unknown").to_owned();

    let updated = sqlx::query_as::<_, PaymentGatewayTransaction>(
        "UPDATE payment_gateway_transactions SET \
         status = 'refunded', refund_id = $1, refund_amount = $2, updated_at = now() \
         WHERE id = $3 AND tenant_id = $4 \
         RETURNING *",
    )
    .bind(&refund_id)
    .bind(refund_amount)
    .bind(body.transaction_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(RefundResponse {
        transaction: updated,
        refund_id,
    }))
}

/// Minimal URL encoding for UPI URI parameters.
fn urlencoded(s: &str) -> String {
    s.replace(' ', "%20")
        .replace('&', "%26")
        .replace('=', "%3D")
        .replace('#', "%23")
}
