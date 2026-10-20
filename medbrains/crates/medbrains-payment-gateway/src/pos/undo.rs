//! Stopping a card sale at the counter, and giving card money back.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::payment::PaymentGatewayTransaction;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::state::AppState;
use serde_json::{Value, json};
use uuid::Uuid;

use super::sale::{apply, begin, ctx, load_sale, require_collect, require_counter};
use super::view::{PosSaleView, view};
use super::{PosError, SaleState, Step, cancelled, provider_for};
use crate::terminals::load;

/// `POST /api/payments/pos-sale/{id}/cancel` — stop the sale on the machine.
///
/// A sale is closed as cancelled only on the provider's word. If the card
/// already went through, it is approved, not cancelled. If the provider will
/// not cancel it (the PIN is in) or cannot be reached, the sale stays live:
/// the screen says the machine is still taking the card and keeps watching,
/// and an approval that follows posts once.
pub async fn cancel_sale(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PosSaleView>, AppError> {
    require_counter(&claims)?;
    let (txn, terminal) = load_sale(&state.db, claims.tenant_id, id).await?;
    require_collect(&state, &claims, txn.invoice_id).await?;
    match (txn.status.as_str(), terminal.connection.as_str()) {
        ("pending_gateway", _) => apply(&state.db, claims.tenant_id, id, cancelled()).await?,
        ("created", "bridge") => {
            mark(
                &state,
                claims.tenant_id,
                id,
                json!({ "cancel_requested": true }),
            )
            .await?
        }
        ("created", _) => {
            let provider = provider_for(&terminal).ok_or_else(|| {
                AppError::ServiceUnavailable(format!("No adapter for '{}'", terminal.provider))
            })?;
            let c = ctx(&state, claims.tenant_id, &terminal);
            let paise = crate::amount_to_paise(txn.amount)?;
            if let Err(e) = provider.cancel(&c, &txn.gateway_order_id, paise).await {
                let refused = json!({ "cancel_refused": true, "cancel_refusal": e.words() });
                mark(&state, claims.tenant_id, id, refused).await?;
                return view(&state.db, claims.tenant_id, id).await.map(Json);
            }
            let step = match provider.status(&c, &txn.gateway_order_id).await {
                Ok(SaleState::Approved(a)) => Step::Settle(a),
                Ok(SaleState::Declined(why)) => Step::Fail {
                    code: "declined",
                    why,
                },
                Ok(SaleState::Cancelled | SaleState::TimedOut) => cancelled(),
                // Confirmed, but the status has not caught up: keep watching.
                Ok(SaleState::Waiting) | Err(_) => {
                    let confirmed = json!({ "cancel_requested": true, "cancel_confirmed": true,
                                            "cancel_refused": false });
                    mark(&state, claims.tenant_id, id, confirmed).await?;
                    Step::Keep { waiting: false }
                }
            };
            apply(&state.db, claims.tenant_id, id, step).await?;
        }
        _ => {}
    }
    view(&state.db, claims.tenant_id, id).await.map(Json)
}

/// Note what the cancel did on an open sale.
async fn mark(state: &AppState, tenant_id: Uuid, id: Uuid, notes: Value) -> Result<(), AppError> {
    let mut tx = begin(&state.db, tenant_id).await?;
    sqlx::query(
        "UPDATE payment_gateway_transactions SET notes = notes || $2 \
         WHERE id = $1 AND status = 'created'",
    )
    .bind(id)
    .bind(notes)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(())
}

/// Refund an approved card sale on the provider that took it; the refund id.
/// Called with the payment row locked (`initiate_refund`).
pub(crate) async fn refund_on_machine(
    state: &AppState,
    txn: &PaymentGatewayTransaction,
    terminal_id: Uuid,
    amount_paise: i64,
) -> Result<String, AppError> {
    let mut tx = begin(&state.db, txn.tenant_id).await?;
    let terminal = load(&mut tx, txn.tenant_id, terminal_id)
        .await?
        .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    let provider = provider_for(&terminal).ok_or_else(|| {
        AppError::ServiceUnavailable(format!("No adapter for '{}'", terminal.provider))
    })?;
    let reference = txn
        .gateway_payment_id
        .as_deref()
        .unwrap_or(&txn.gateway_order_id);
    provider
        .refund(
            &ctx(state, txn.tenant_id, &terminal),
            reference,
            amount_paise,
        )
        .await
        .map_err(|e| match e {
            PosError::Offline(w) => AppError::ServiceUnavailable(w),
            other => AppError::Conflict(other.words()),
        })
}
