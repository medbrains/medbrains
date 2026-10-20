//! Online checkout at the counter, through whichever provider the counter
//! uses (#4884): `POST /api/payments/create-order` opens it, `POST
//! /api/payments/verify` takes the browser's word for it — checked with the
//! provider, never believed — and settles exactly once with the webhook.

use axum::{Extension, Json, extract::State};
use medbrains_core::payment::{
    CreateOrderResponse, PaymentGatewayTransaction, VerifyPaymentRequest,
};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use rust_decimal::Decimal;
use serde::Deserialize;
use uuid::Uuid;

use crate::online::choose::{Fallback, active_code, fallback, require_this};
use crate::online::{
    Checkout, CheckoutAsk, ClientProof, OnlineError, OnlineProvider, PaymentState, ProviderError,
    provider_for, received,
};
use crate::{amount_to_paise, require_invoice_billing, settle};

type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

#[derive(Debug, Deserialize)]
pub struct CreateOrderRequest {
    pub invoice_id: Option<Uuid>,
    pub pos_sale_id: Option<Uuid>,
    pub amount: Decimal,
    pub currency: Option<String>,
    pub receipt: Option<String>,
    pub phone: Option<String>,
    /// The page the patient returns to after a hosted checkout.
    pub callback_url: Option<String>,
    /// The counter collecting, whose provider may differ from the hospital's.
    pub station_id: Option<Uuid>,
    /// The hospital's fallback provider, chosen by the cashier after the
    /// first did not answer. Any other provider is refused.
    pub provider: Option<String>,
}

/// The provider to use: the counter's, or — when the cashier chose it — the
/// hospital's fallback. Never an arbitrary one.
async fn pick(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    body: &CreateOrderRequest,
) -> Result<(&'static dyn OnlineProvider, Option<Fallback>), AppError> {
    let (code, _) = active_code(tx, tenant_id, body.station_id).await?;
    let backup = fallback(tx, tenant_id).await?;
    let offered = backup.map(|p| Fallback {
        provider: p.code(),
        label: p.label(),
    });
    let wanted = body.provider.as_deref().unwrap_or(&code);
    if wanted != code && backup.is_none_or(|p| p.code() != wanted) {
        return Err(AppError::BadRequest(format!(
            "'{wanted}' is not this counter's payment provider or its fallback"
        )));
    }
    let provider = provider_for(wanted).ok_or_else(|| {
        AppError::ServiceUnavailable(format!(
            "Payment provider '{wanted}' has no MedBrains adapter"
        ))
    })?;
    Ok((provider, offered))
}

async fn record_failure(
    state: &AppState,
    txn: &PaymentGatewayTransaction,
    why: &str,
) -> Result<(), AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &txn.tenant_id).await?;
    sqlx::query(
        "UPDATE payment_gateway_transactions SET status = 'failed', \
         error_description = $2, updated_at = now() WHERE id = $1",
    )
    .bind(txn.id)
    .bind(why)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(())
}

/// `POST /api/payments/create-order` — the provider's order for a payment
/// row, made in the request: checkout cannot open without it. The row is
/// committed first (no transaction is held across the call) and records the
/// answer either way. A provider that does not answer gets a 503 offering
/// the hospital's fallback; nothing switches on its own.
pub async fn create_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateOrderRequest>,
) -> Result<Json<CreateOrderResponse>, OnlineError> {
    require_permission(&claims, permissions::billing::payments::CREATE)?;
    require_invoice_billing(&state, &claims, body.invoice_id).await?;
    if body.invoice_id.is_none() && body.pos_sale_id.is_none() {
        return Err(AppError::BadRequest(
            "either invoice_id or pos_sale_id is required".to_owned(),
        )
        .into());
    }
    if body.currency.as_deref().is_some_and(|c| c != "INR") {
        return Err(AppError::BadRequest("Online payments are taken in INR".to_owned()).into());
    }
    let amount_paise = amount_to_paise(body.amount)?;
    let secrets = state.secret_resolver.as_ref();

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let (provider, offered) = pick(&mut tx, claims.tenant_id, &body).await?;
    let chosen = require_this(&mut tx, secrets, claims.tenant_id, provider, "checkout").await?;
    // idempotency_key = the row's id, which is also the provider's receipt /
    // order reference, so no path makes a second order for one row.
    let txn = sqlx::query_as::<_, PaymentGatewayTransaction>(
        "INSERT INTO payment_gateway_transactions \
         (tenant_id, invoice_id, pharmacy_pos_sale_id, gateway, gateway_order_id, \
          amount, currency, status, created_by) \
         VALUES ($1, $2, $3, $4, '', $5, 'INR', 'pending_gateway', $6) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.invoice_id)
    .bind(body.pos_sale_id)
    .bind(provider.code())
    .bind(body.amount)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    sqlx::query("UPDATE payment_gateway_transactions SET idempotency_key = id::text WHERE id = $1")
        .bind(txn.id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;

    let ask = CheckoutAsk {
        txn_id: txn.id,
        tenant_id: claims.tenant_id,
        amount_paise,
        description: body.receipt.as_deref().unwrap_or("MedBrains payment"),
        phone: body.phone.as_deref(),
        return_url: body.callback_url.as_deref(),
    };
    let opened = match provider.create_checkout(&chosen.ctx(), &ask).await {
        Ok(o) => o,
        Err(e) => {
            record_failure(&state, &txn, &e.words()).await?;
            let label = provider.label();
            return Err(OnlineError::of(
                provider,
                e,
                |w| {
                    AppError::ServiceUnavailable(format!(
                        "{label} refused the order: {w}. Online payment is not available right now; \
                 take the payment another way."
                    ))
                },
                offered,
            ));
        }
    };
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    sqlx::query(
        "UPDATE payment_gateway_transactions SET status = 'created', \
         gateway_order_id = $2, updated_at = now() WHERE id = $1",
    )
    .bind(txn.id)
    .bind(&opened.order_ref)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    let key_id = match &opened.checkout {
        Checkout::RazorpayJs { key_id, .. } => key_id.clone(),
        _ => String::new(),
    };
    Ok(Json(CreateOrderResponse {
        transaction_id: txn.id,
        order_id: opened.order_ref,
        amount: body.amount,
        currency: "INR".to_owned(),
        key_id,
        status: "created".to_owned(),
        provider: provider.code().to_owned(),
        checkout: serde_json::to_value(&opened.checkout).ok(),
    }))
}

/// The row the browser names, under this hospital.
async fn row_named(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    body: &VerifyPaymentRequest,
) -> Result<PaymentGatewayTransaction, AppError> {
    let row = match (body.transaction_id, body.order_id.as_deref()) {
        (Some(id), _) => sqlx::query_as::<_, PaymentGatewayTransaction>(
            "SELECT * FROM payment_gateway_transactions WHERE id = $1 AND tenant_id = $2",
        )
        .bind(id)
        .bind(tenant_id),
        (None, Some(order)) => sqlx::query_as::<_, PaymentGatewayTransaction>(
            "SELECT * FROM payment_gateway_transactions WHERE gateway_order_id = $1 AND tenant_id = $2",
        )
        .bind(order)
        .bind(tenant_id),
        (None, None) => return Err(AppError::BadRequest("Name the payment to verify".to_owned())),
    };
    row.fetch_optional(&mut **tx)
        .await?
        .ok_or(AppError::NotFound)
}

/// `POST /api/payments/verify` — the checkout's word that the patient paid.
/// A signed result (Razorpay) must verify; then the amount and method come
/// from the provider's own record, never the browser. Settled through the
/// same path as the webhook, so whichever arrives first posts.
pub async fn verify_payment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<VerifyPaymentRequest>,
) -> Result<Json<PaymentGatewayTransaction>, AppError> {
    require_permission(&claims, permissions::billing::payments::CREATE)?;
    let secrets = state.secret_resolver.as_ref();
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let txn = row_named(&mut tx, claims.tenant_id, &body).await?;
    let provider = provider_for(&txn.gateway).ok_or_else(|| {
        AppError::BadRequest(format!("'{}' payments are not verified here", txn.gateway))
    })?;
    let chosen = crate::online::choose::with_keys(&mut tx, secrets, claims.tenant_id, provider)
        .await?
        .ok_or_else(|| {
            AppError::ServiceUnavailable(format!(
                "{} credentials are not configured",
                provider.label()
            ))
        })?;
    tx.commit().await?;
    let proof = ClientProof {
        order_ref: &txn.gateway_order_id,
        payment_id: body.payment_id.as_deref(),
        signature: body.signature.as_deref(),
    };
    provider
        .verify_payment(&chosen.keys, &proof)
        .map_err(|e| match e {
            ProviderError::BadSignature => {
                AppError::BadRequest("payment signature verification failed".to_owned())
            }
            other => AppError::BadRequest(other.words()),
        })?;
    let record = provider.fetch_payment(&chosen.ctx(), &proof).await.map_err(|e| match e {
        ProviderError::Unavailable(w) => AppError::ServiceUnavailable(format!(
            "{w}. The payment posts when {}'s notice arrives; check the bill before collecting again.",
            provider.label()
        )),
        other => AppError::BadRequest(other.words()),
    })?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let current = match &record.state {
        PaymentState::Paid => {
            let capture = settle::Capture {
                provider: provider.code(),
                payment_id: &record.payment_id,
                method: record.method.as_deref(),
                received: received(record.amount_paise, false),
                signature: body.signature.as_deref(),
                payload: None,
            };
            match settle::settle_capture(&mut tx, txn.id, &capture).await? {
                settle::Settled::Now(t) => *t,
                settle::Settled::Already => settle::lock_txn(&mut tx, txn.id).await?,
            }
        }
        // Authorised or not yet attempted: the webhook settles it.
        PaymentState::Pending => {
            sqlx::query(
                "UPDATE payment_gateway_transactions SET status = 'authorized', \
                 gateway_payment_id = $2, updated_at = now() \
                 WHERE id = $1 AND status IN ('pending_gateway', 'created') AND $2 <> ''",
            )
            .bind(txn.id)
            .bind(&record.payment_id)
            .execute(&mut *tx)
            .await?;
            settle::lock_txn(&mut tx, txn.id).await?
        }
        PaymentState::Failed(why) => {
            sqlx::query(
                "UPDATE payment_gateway_transactions SET status = 'failed', error_description = $2, \
                 updated_at = now() WHERE id = $1 AND status NOT IN ('captured', 'refunded')",
            )
            .bind(txn.id)
            .bind(why)
            .execute(&mut *tx)
            .await?;
            settle::lock_txn(&mut tx, txn.id).await?
        }
    };
    tx.commit().await?;

    if record.state == PaymentState::Paid {
        let _ = medbrains_workflow::events::emit_event(
            &state.db,
            claims.tenant_id,
            claims.sub,
            "payment.gateway.captured",
            serde_json::json!({
                "transaction_id": current.id,
                "gateway_payment_id": record.payment_id,
                "amount": current.amount,
            }),
        )
        .await;
    }
    Ok(Json(current))
}
