//! Stopping a card sale at the counter, and giving card money back.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::payment::PaymentGatewayTransaction;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::state::AppState;
use uuid::Uuid;

use super::sale::{apply, begin, ctx, load_sale, require_collect, require_counter};
use super::view::{PosSaleView, view};
use super::{PosError, SaleState, Step, provider_for};
use crate::terminals::load;

/// `POST /api/payments/pos-sale/{id}/cancel` — stop the sale on the machine.
/// If the card already went through, the sale is approved, not cancelled.
pub async fn cancel_sale(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PosSaleView>, AppError> {
    require_counter(&claims)?;
    let (txn, terminal) = load_sale(&state.db, claims.tenant_id, id).await?;
    require_collect(&state, &claims, txn.invoice_id).await?;
    let cancelled = || Step::Fail {
        code: "cancelled",
        why: "Cancelled — no money was taken".to_owned(),
    };
    match (txn.status.as_str(), terminal.connection.as_str()) {
        ("pending_gateway", _) => apply(&state.db, claims.tenant_id, id, cancelled()).await?,
        ("created", "bridge") => {
            let mut tx = begin(&state.db, claims.tenant_id).await?;
            sqlx::query(
                "UPDATE payment_gateway_transactions SET notes = notes || '{\"cancel_requested\":true}' \
                 WHERE id = $1 AND status = 'created'",
            )
            .bind(id)
            .execute(&mut *tx)
            .await?;
            tx.commit().await?;
        }
        ("created", _) => {
            let provider = provider_for(&terminal).ok_or_else(|| {
                AppError::ServiceUnavailable(format!("No adapter for '{}'", terminal.provider))
            })?;
            let c = ctx(&state, claims.tenant_id, &terminal);
            if let Err(e) = provider.cancel(&c, &txn.gateway_order_id).await {
                return Err(AppError::Conflict(format!(
                    "{}. Cancel it on the machine itself; this screen keeps watching.",
                    e.words()
                )));
            }
            let step = match provider.status(&c, &txn.gateway_order_id).await {
                Ok(SaleState::Approved(a)) => Step::Settle(a),
                Ok(SaleState::Declined(why)) => Step::Fail {
                    code: "declined",
                    why,
                },
                _ => cancelled(),
            };
            apply(&state.db, claims.tenant_id, id, step).await?;
        }
        _ => {}
    }
    view(&state.db, claims.tenant_id, id).await.map(Json)
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
