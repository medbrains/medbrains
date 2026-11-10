//! `POST /api/payments/refund` — an online payment back to the card / UPI /
//! bank it came from, through the provider that took it, and off the bill.
//!
//! Exactly-once holds on both sides. The provider's refund key (Razorpay's
//! `receipt`, Cashfree's `refund_id`, PhonePe's `merchantRefundId`, PayU's
//! token) is unique there and a repeat is rejected, so it is derived from
//! this refund's intent ([`refund_receipt`]): a retry after a timeout — the
//! provider refunded but the answer was lost — is refused instead of
//! refunding twice. Here the payment row is locked for the whole call, the
//! refundable remainder is checked under that lock, and the refund id is
//! taken into the books once (`settle_refund`); the provider's refund notice
//! for the same refund then finds it known. When the provider does not
//! answer nothing is posted here; if it did refund, its notice posts it.

use axum::{Extension, Json, extract::State};
use medbrains_core::payment::PaymentGatewayTransaction;
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use rust_decimal::Decimal;
use rust_decimal::prelude::ToPrimitive;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::online::choose::require_this;
use crate::online::{OnlineError, ProviderError, RefundAsk, provider_for};
use crate::{amount_to_paise, pos, require_invoice_billing, settle};

type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

#[derive(Debug, Deserialize)]
pub struct InitiateRefundRequest {
    /// The online payment to refund, by its gateway row…
    pub transaction_id: Option<Uuid>,
    /// …or by the bill's payment row it posted as (the invoice screen's view).
    pub payment_id: Option<Uuid>,
    pub amount: Option<Decimal>,
    pub reason: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RefundResponse {
    pub transaction: PaymentGatewayTransaction,
    pub refund_id: String,
}

/// The refund's key at the provider: the same for the same intent — this
/// payment, this much already refunded, this amount — so a retry carries the
/// key the provider already holds and is rejected, not refunded again. Once a
/// refund is taken into the books the refunded total moves, and the next
/// refund gets a new key. ≤ 40 characters, Razorpay's limit.
pub fn refund_receipt(txn_id: Uuid, refunded_paise: i64, amount_paise: i64) -> String {
    let intent = format!("refund:{refunded_paise}:{amount_paise}");
    format!("rf_{}", Uuid::new_v5(&txn_id, intent.as_bytes()).simple())
}

async fn txn_named(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    body: &InitiateRefundRequest,
) -> Result<Uuid, AppError> {
    match (body.transaction_id, body.payment_id) {
        (Some(id), _) => Ok(id),
        (None, Some(payment_id)) => sqlx::query_scalar::<_, Uuid>(
            "SELECT t.id FROM payment_gateway_transactions t \
             JOIN payments p ON p.reference_number = t.gateway_payment_id \
                            AND p.invoice_id = t.invoice_id \
             WHERE p.id = $1 AND p.tenant_id = $2 LIMIT 1",
        )
        .bind(payment_id)
        .bind(tenant_id)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or(AppError::NotFound),
        (None, None) => Err(AppError::BadRequest(
            "Name the payment to refund".to_owned(),
        )),
    }
}

/// Refund through the online provider that took the payment; its refund id.
async fn refund_online(
    tx: &mut Tx<'_>,
    state: &AppState,
    txn: &PaymentGatewayTransaction,
    (payment_id, refund_paise): (&str, i64),
    reason: &str,
) -> Result<String, OnlineError> {
    let provider = provider_for(&txn.gateway).ok_or_else(|| {
        AppError::BadRequest(format!(
            "This payment came through '{}', which takes no refunds through MedBrains",
            txn.gateway
        ))
    })?;
    let refunded = (txn.refund_amount.unwrap_or_default() * Decimal::ONE_HUNDRED)
        .round()
        .to_i64()
        .unwrap_or_default();
    let capability = if refunded > 0 {
        "multiple_refunds"
    } else if refund_paise < amount_to_paise(txn.amount)? {
        "partial_refund"
    } else {
        "checkout"
    };
    let secrets = state.secret_resolver.as_ref();
    let chosen = require_this(tx, secrets, txn.tenant_id, provider, capability).await?;
    let key = refund_receipt(txn.id, refunded, refund_paise);
    let ask = RefundAsk {
        txn_id: txn.id,
        order_ref: &txn.gateway_order_id,
        payment_id,
        amount_paise: refund_paise,
        idempotency_key: &key,
        reason,
    };
    let label = provider.label();
    // ponytail: the row lock is held across this call (≤ the call timeout); it
    // only blocks other settles/refunds of this one payment.
    provider.refund(&chosen.ctx(), &ask).await.map_err(|e| match e {
        ProviderError::Unavailable(w) => OnlineError::App(AppError::ServiceUnavailable(format!(
            "{w}. If {label} made the refund it will show on the bill when its notice arrives."
        ))),
        other => OnlineError::of(provider, other, |w| {
            AppError::BadRequest(format!("{label} refused the refund: {w}"))
        }, None),
    })
}

/// `POST /api/payments/refund`.
pub async fn initiate_refund(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<InitiateRefundRequest>,
) -> Result<Json<RefundResponse>, OnlineError> {
    require_permission(&claims, permissions::billing::payments::VOID)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let txn_id = txn_named(&mut tx, claims.tenant_id, &body).await?;
    let txn = settle::lock_txn(&mut tx, txn_id).await?;
    if txn.tenant_id != claims.tenant_id {
        return Err(AppError::NotFound.into());
    }
    require_invoice_billing(&state, &claims, txn.invoice_id).await?;
    let reason = body
        .reason
        .as_deref()
        .map(str::trim)
        .filter(|r| !r.is_empty())
        .unwrap_or("Refund to the patient");
    let refund = Refund {
        txn_id,
        amount: body.amount,
        reason,
        refunded_by: Some(claims.sub),
    };
    let refund_id = refund_payment(&state, &mut tx, &refund).await?;
    let updated = settle::lock_txn(&mut tx, txn_id).await?;
    tx.commit().await?;
    Ok(Json(RefundResponse {
        transaction: updated,
        refund_id,
    }))
}

/// A refund of one online payment.
#[derive(Debug, Clone, Copy)]
pub struct Refund<'a> {
    pub txn_id: Uuid,
    /// All that is left on the payment, when `None`.
    pub amount: Option<Decimal>,
    pub reason: &'a str,
    pub refunded_by: Option<Uuid>,
}

/// Refund an online payment back to where it came from — the card machine's
/// provider or the online provider that took it — and take it into the books
/// once. The caller has authorised it and set the tenant on `tx`.
/// Exactly-once as the module doc describes.
///
/// # Errors
/// Not captured, more than is left, or the provider refused or did not answer.
pub async fn refund_payment(
    state: &AppState,
    tx: &mut Tx<'_>,
    refund: &Refund<'_>,
) -> Result<String, OnlineError> {
    let txn = settle::lock_txn(tx, refund.txn_id).await?;
    if txn.status != "captured" {
        return Err(AppError::BadRequest(
            "Only a captured payment with money left on it can be refunded".to_owned(),
        )
        .into());
    }
    let Some(gateway_payment_id) = txn.gateway_payment_id.clone() else {
        return Err(
            AppError::BadRequest("no gateway payment id for this transaction".to_owned()).into(),
        );
    };
    let refundable = txn.amount - txn.refund_amount.unwrap_or_default();
    let refund_amount = refund.amount.unwrap_or(refundable);
    if refund_amount > refundable {
        return Err(AppError::BadRequest(format!(
            "Refund exceeds the {refundable} left on this payment"
        ))
        .into());
    }
    let refund_paise = amount_to_paise(refund_amount)?;
    let refund_id = match txn.terminal_id {
        // A card sale goes back through the machine's provider.
        Some(terminal_id) => {
            pos::undo::refund_on_machine(state, &txn, terminal_id, refund_paise).await?
        }
        None => {
            refund_online(tx, state, &txn, (&gateway_payment_id, refund_paise), refund.reason)
                .await?
        }
    };
    let made = settle::RefundMade {
        refund_id: &refund_id,
        amount: refund_amount,
        reason: refund.reason,
        refunded_by: refund.refunded_by,
        payload: None,
    };
    settle::settle_refund(tx, &txn, &made).await?;
    Ok(refund_id)
}

#[cfg(test)]
mod tests {
    use super::{Uuid, refund_receipt};

    #[test]
    fn a_refund_retry_carries_the_same_receipt_and_the_next_refund_a_new_one() {
        let txn = Uuid::new_v4();
        let first = refund_receipt(txn, 0, 30_000);
        assert_eq!(first, refund_receipt(txn, 0, 30_000), "a retry repeats it");
        assert_ne!(
            first,
            refund_receipt(txn, 30_000, 30_000),
            "the next refund"
        );
        assert_ne!(first, refund_receipt(Uuid::new_v4(), 0, 30_000));
        assert!(first.len() <= 40, "{first}");
    }
}
