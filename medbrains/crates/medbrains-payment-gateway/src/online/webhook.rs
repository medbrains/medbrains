//! Every provider's webhook, one way: find the payment row it is about,
//! verify it with that hospital's secret, take it once (`processed_webhooks`)
//! and settle it through [`crate::settle`].

use axum::Json;
use axum::extract::State;
use axum::http::HeaderMap;
use medbrains_core::payment::PaymentGatewayTransaction;
use medbrains_server_core::error::AppError;
use medbrains_server_core::state::AppState;
use serde_json::{Value, json};

use super::choose::with_keys;
use super::{
    ClientProof, Located, Notice, OnlineProvider, ProviderError, ProviderEvent, payu, provider_for,
    received,
};
use crate::settle::{self, Capture, GatewayPosting, RefundMade};

type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

/// The webhook body as JSON, for the record (PayU's form fields as an object).
fn as_json(body: &str) -> Value {
    serde_json::from_str(body).unwrap_or_else(|_| json!(payu::fields_of(body)))
}

async fn row_for(
    state: &AppState,
    code: &str,
    order_ref: &str,
) -> Result<Option<PaymentGatewayTransaction>, AppError> {
    Ok(sqlx::query_as::<_, PaymentGatewayTransaction>(
        // allow-raw-sql: webhook entry, tenant context not yet resolved
        "SELECT * FROM payment_gateway_transactions \
         WHERE gateway_order_id = $1 AND gateway = $2 LIMIT 1",
    )
    .bind(order_ref)
    .bind(code)
    .fetch_optional(&state.db)
    .await?)
}

/// Verify and normalise; a link notice that does not say how it was paid
/// asks the provider (outside any transaction).
async fn verified(
    state: &AppState,
    provider: &'static dyn OnlineProvider,
    row: &PaymentGatewayTransaction,
    headers: &HeaderMap,
    body: &str,
) -> Result<Notice, AppError> {
    let secrets = state.secret_resolver.as_ref();
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &row.tenant_id).await?;
    let chosen = with_keys(&mut tx, secrets, row.tenant_id, provider)
        .await?
        .ok_or_else(|| {
            AppError::ServiceUnavailable(format!("{} is not configured", provider.label()))
        })?;
    tx.commit().await?;
    let mut notice = provider
        .parse_webhook(&chosen.keys, headers, body)
        .map_err(|e| match e {
            ProviderError::BadSignature | ProviderError::Refused(_) => {
                AppError::BadRequest(e.words())
            }
            other => AppError::ServiceUnavailable(other.words()),
        })?;
    if let ProviderEvent::Captured {
        method: method @ None,
        lookup: Some(order),
        ..
    } = &mut notice.event
    {
        let proof = ClientProof {
            order_ref: order,
            payment_id: None,
            signature: None,
        };
        match provider.fetch_payment(&chosen.ctx(), &proof).await {
            Ok(record) => *method = record.method,
            // Unknown method: settling parks it for finance rather than guess.
            Err(e) => tracing::warn!(error = %e.words(), "could not read how a link was paid"),
        }
    }
    Ok(notice)
}

/// `POST /api/webhooks/{provider}` for every online provider.
///
/// # Errors
/// 400 for a bad signature, a database fault.
pub async fn receive(
    state: &AppState,
    provider: &'static dyn OnlineProvider,
    headers: &HeaderMap,
    body: &str,
) -> Result<Json<Value>, AppError> {
    let code = provider.code();
    let order_ref = match provider.locate(headers, body) {
        Located::Order(r) => r,
        Located::NotOurs => return Ok(Json(json!({ "status": "ignored" }))),
        Located::Unreadable => {
            tracing::warn!(provider = code, "webhook names no order");
            crate::log_webhook_exception(&state.db, code, None, "unknown_order", &as_json(body))
                .await?;
            return Ok(Json(json!({ "status": "ignored" })));
        }
    };
    let Some(row) = row_for(state, code, &order_ref).await? else {
        tracing::warn!(provider = code, order_ref, "webhook for unknown order");
        crate::log_webhook_exception(
            &state.db,
            code,
            Some(&order_ref),
            "unknown_order",
            &as_json(body),
        )
        .await?;
        return Ok(Json(json!({ "status": "unknown_order" })));
    };
    let notice = verified(state, provider, &row, headers, body).await?;
    let payload = as_json(body);
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &row.tenant_id).await?;
    let fresh: Option<(String,)> = sqlx::query_as(
        // allow-raw-sql: webhook idempotency PK insert
        "INSERT INTO processed_webhooks (provider, event_id, tenant_id, payload) \
         VALUES ($1, $2, $3, $4) ON CONFLICT (provider, event_id) DO NOTHING RETURNING event_id",
    )
    .bind(code)
    .bind(&notice.event_id)
    .bind(row.tenant_id)
    .bind(&payload)
    .fetch_optional(&mut *tx)
    .await?;
    if fresh.is_none() {
        tx.commit().await?;
        return Ok(Json(
            json!({ "status": "duplicate", "event_id": notice.event_id }),
        ));
    }
    apply(&mut tx, provider, &row, notice.event, &payload).await?;
    tx.commit().await?;
    Ok(Json(json!({ "status": "ok" })))
}

/// Settle what a verified notice says, once.
async fn apply(
    tx: &mut Tx<'_>,
    provider: &'static dyn OnlineProvider,
    row: &PaymentGatewayTransaction,
    event: ProviderEvent,
    payload: &Value,
) -> Result<(), AppError> {
    let code = provider.code();
    // A balance link (#4871) takes its parts and its end itself.
    if crate::balance_link::parts::on_event(tx, row, &event, payload).await? {
        return Ok(());
    }
    match event {
        ProviderEvent::Captured {
            payment_id,
            amount_paise,
            method,
            ..
        } => {
            let capture = Capture {
                provider: code,
                payment_id: &payment_id,
                method: method.as_deref(),
                received: received(amount_paise, false),
                signature: None,
                payload: Some(payload),
            };
            settle::settle_capture(tx, row.id, &capture).await?;
        }
        ProviderEvent::Failed {
            code: error,
            reason,
        } => {
            // A failed attempt never undoes a later attempt that succeeded.
            sqlx::query(
                "UPDATE payment_gateway_transactions SET status = 'failed', error_code = $2, \
                 error_description = $3, webhook_payload = $4, updated_at = now() \
                 WHERE id = $1 AND status NOT IN ('captured', 'refunded')",
            )
            .bind(row.id)
            .bind(error)
            .bind(reason)
            .bind(payload)
            .execute(&mut **tx)
            .await?;
        }
        ProviderEvent::Refunded {
            refund_id,
            amount_paise,
            reason,
        } => {
            let txn = settle::lock_txn(tx, row.id).await?;
            let fallback = format!("Refunded through {}", provider.label());
            let made = RefundMade {
                refund_id: &refund_id,
                amount: settle::rupees(amount_paise),
                reason: reason.as_deref().unwrap_or(&fallback),
                refunded_by: None,
                payload: Some(payload),
            };
            settle::settle_refund(tx, &txn, &made).await?;
        }
        ProviderEvent::RefundFailed {
            refund_id,
            amount_paise,
        } => {
            let why = format!("{} could not make this refund", provider.label());
            hand_to_finance(
                tx,
                row,
                code,
                (&refund_id, amount_paise),
                "refund_failed",
                &why,
                payload,
            )
            .await?;
        }
        ProviderEvent::Dispute {
            payment_id,
            amount_paise,
            reason,
        } => {
            let paise = amount_paise.unwrap_or_default();
            hand_to_finance(
                tx,
                row,
                code,
                (&payment_id, paise),
                "dispute",
                &reason,
                payload,
            )
            .await?;
        }
        ProviderEvent::PayoutDone { reference, .. }
        | ProviderEvent::PayoutFailed { reference, .. } => {
            tracing::info!(
                provider = code,
                reference,
                "payout notice: payouts are not made from here"
            );
        }
        ProviderEvent::LinkClosed { expired } => {
            tracing::info!(
                provider = code,
                expired,
                "a booking or delivery link closed unpaid"
            );
        }
        ProviderEvent::Ignored(what) => {
            tracing::info!(provider = code, what, "webhook not acted on")
        }
    }
    Ok(())
}

/// Money finance must put right, filed under the hospital and bill.
async fn hand_to_finance(
    tx: &mut Tx<'_>,
    row: &PaymentGatewayTransaction,
    code: &str,
    (reference, paise): (&str, i64),
    reason: &str,
    why: &str,
    payload: &Value,
) -> Result<(), AppError> {
    let Some(invoice_id) = row.invoice_id else {
        tracing::warn!(
            provider = code,
            reason,
            "provider notice for a payment with no bill"
        );
        return Ok(());
    };
    let posting = GatewayPosting {
        tenant_id: row.tenant_id,
        invoice_id,
        provider: code,
        order_ref: reference,
        amount: settle::rupees(paise),
        method: row.payment_method.as_deref(),
        reference,
        payload: Some(payload),
    };
    settle::park(tx, &posting, reason, why).await
}

macro_rules! webhook_route {
    ($name:ident, $code:literal) => {
        #[doc = concat!("`POST /api/webhooks/", $code, "` (public — signature-verified).")]
        pub async fn $name(
            State(state): State<AppState>,
            headers: HeaderMap,
            body: String,
        ) -> Result<Json<Value>, AppError> {
            let provider = provider_for($code)
                .ok_or_else(|| AppError::Internal(concat!("no provider ", $code).to_owned()))?;
            receive(&state, provider, &headers, &body).await
        }
    };
}

webhook_route!(razorpay_webhook, "razorpay");
webhook_route!(cashfree_webhook, "cashfree");
webhook_route!(phonepe_webhook, "phonepe");
webhook_route!(payu_webhook, "payu");
