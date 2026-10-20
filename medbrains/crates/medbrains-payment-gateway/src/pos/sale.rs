//! A card sale at the counter: follow it on the machine and apply whatever
//! the machine said — once. Starting one is [`super::start`].

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::Utc;
use medbrains_core::payment::{PaymentGatewayTransaction, PaymentTerminal};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::{
    require_any_permission, require_permission,
};
use medbrains_server_core::state::AppState;
use sqlx::PgPool;
use uuid::Uuid;

use super::view::{PosSaleView, view};
use super::{
    ANSWER_WITHIN_SECS, Approval, Ctx, NO_ANSWER, PosError, SaleState, Step, Tender, UNKNOWN,
    next_step, provider_for,
};
use crate::razorpay::mode_for_method;
use crate::settle::{Capture, Received, lock_txn, rupees, settle_capture};
use crate::terminals::{load, note_health};

pub(super) type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;
pub(super) const OPEN: &str = "status IN ('pending_gateway', 'created')";
/// A sale a step may still change: open, or closed with no known outcome.
pub(super) const LIVE: &str =
    "(status IN ('pending_gateway', 'created') OR (status = 'failed' AND error_code = 'unknown'))";
/// A bridge sale its bridge never took: it never reached a machine.
const NEVER_TAKEN: &str = "The card machine's bridge never took the sale — nothing was charged";

pub(super) async fn begin(db: &PgPool, tenant_id: Uuid) -> Result<Tx<'static>, AppError> {
    let mut tx = db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    Ok(tx)
}

/// Taking money for a bill is billing's; a pharmacy counter sale that has
/// no bill yet is the pharmacy counter's.
/// Either counter may follow a card sale; which one it is decides the rest.
pub(super) fn require_counter(claims: &Claims) -> Result<(), AppError> {
    require_any_permission(
        claims,
        &[
            permissions::billing::payments::CREATE,
            permissions::pharmacy::pos::CREATE,
        ],
    )
}

pub(super) async fn require_collect(
    state: &AppState,
    claims: &Claims,
    invoice_id: Option<Uuid>,
) -> Result<(), AppError> {
    match invoice_id {
        Some(id) => {
            require_permission(claims, permissions::billing::payments::CREATE)?;
            crate::require_invoice_billing(state, claims, Some(id)).await
        }
        None => require_counter(claims),
    }
}

pub(super) fn ctx<'a>(
    state: &'a AppState,
    tenant_id: Uuid,
    terminal: &'a PaymentTerminal,
) -> Ctx<'a> {
    Ctx {
        secrets: state.secret_resolver.as_ref(),
        db: &state.db,
        tenant_id,
        terminal,
    }
}

/// Apply a step to a sale. Settling goes through P0's `settle_capture`, so
/// however many times the machine's approval arrives, it posts once.
pub(crate) async fn apply(
    db: &PgPool,
    tenant_id: Uuid,
    txn_id: Uuid,
    step: Step,
) -> Result<(), AppError> {
    let mut tx = begin(db, tenant_id).await?;
    apply_in(&mut tx, txn_id, step).await?;
    tx.commit().await?;
    Ok(())
}

/// [`apply`] inside the caller's transaction.
pub(super) async fn apply_in(tx: &mut Tx<'_>, txn_id: Uuid, step: Step) -> Result<(), AppError> {
    match step {
        Step::Keep { waiting: false } => {}
        Step::Keep { waiting: true } => {
            sqlx::query(&format!(
                "UPDATE payment_gateway_transactions SET status = 'created', \
                 notes = notes || '{{\"stage\":\"waiting\"}}' WHERE id = $1 AND {OPEN}"
            ))
            .bind(txn_id)
            .execute(&mut **tx)
            .await?;
        }
        Step::Settle(a) => settle(tx, txn_id, &a).await?,
        Step::Fail { code, why } => close(tx, txn_id, "failed", Some(code), &why).await?,
        Step::Expire(why) => close(tx, txn_id, "expired", None, &why).await?,
        Step::Unknown(why) => close(tx, txn_id, "failed", Some(UNKNOWN), &why).await?,
    }
    Ok(())
}

/// The payment mode to post: what the provider says it was paid by (UPI on
/// the machine is UPI, not card), else what the cashier asked for.
fn method_of(a: &Approval, notes: &serde_json::Value) -> &'static str {
    a.method
        .as_deref()
        .and_then(mode_for_method)
        .unwrap_or_else(|| Tender::fallback_method(notes["tender"].as_str()))
}

async fn settle(tx: &mut Tx<'_>, txn_id: Uuid, a: &Approval) -> Result<(), AppError> {
    let txn = lock_txn(tx, txn_id).await?;
    let approved = a.approved_paise.map_or(txn.amount, rupees);
    let received = if approved < txn.amount {
        Received::Credited(approved)
    } else {
        Received::Exactly(approved)
    };
    let capture = Capture {
        provider: &txn.gateway,
        payment_id: &a.reference,
        method: Some(method_of(a, &txn.notes)),
        received,
        signature: None,
        payload: Some(&a.payload),
    };
    if let crate::settle::Settled::Now(_) = settle_capture(tx, txn_id, &capture).await? {
        sqlx::query(
            "UPDATE payment_gateway_transactions SET card_last4 = $2, card_auth_code = $3, \
             notes = notes || jsonb_strip_nulls(jsonb_build_object('stage', 'approved', \
                     'approved_amount', $4::text, 'rrn', $5::text)) \
             WHERE id = $1",
        )
        .bind(txn_id)
        .bind(&a.card_last4)
        .bind(&a.auth_code)
        .bind(approved)
        .bind(&a.rrn)
        .execute(&mut **tx)
        .await?;
    }
    Ok(())
}

pub(super) async fn close(
    tx: &mut Tx<'_>,
    txn_id: Uuid,
    status: &str,
    code: Option<&str>,
    why: &str,
) -> Result<(), AppError> {
    sqlx::query(&format!(
        "UPDATE payment_gateway_transactions SET status = $2, error_code = $3, \
         error_description = $4, updated_at = now() WHERE id = $1 AND {LIVE}"
    ))
    .bind(txn_id)
    .bind(status)
    .bind(code)
    .bind(why)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

pub(super) async fn load_sale(
    db: &PgPool,
    tenant_id: Uuid,
    id: Uuid,
) -> Result<(PaymentGatewayTransaction, PaymentTerminal), AppError> {
    let mut tx = begin(db, tenant_id).await?;
    let txn = sqlx::query_as::<_, PaymentGatewayTransaction>(
        "SELECT * FROM payment_gateway_transactions WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let terminal_id = txn.terminal_id.ok_or(AppError::NotFound)?;
    let terminal = load(&mut tx, tenant_id, terminal_id)
        .await?
        .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok((txn, terminal))
}

/// Keep the terminal's health in step with what it just said.
async fn note(
    db: &PgPool,
    tenant_id: Uuid,
    terminal: &PaymentTerminal,
    answer: &Result<SaleState, PosError>,
) -> Result<(), AppError> {
    let health = match answer {
        Err(PosError::Offline(w)) => Err(w.clone()),
        Err(_) => return Ok(()),
        Ok(_) => Ok(()),
    };
    let mut tx = begin(db, tenant_id).await?;
    note_health(&mut tx, terminal.id, health).await?;
    tx.commit().await?;
    Ok(())
}

/// Whether nobody knows yet how this sale ended.
pub(super) fn is_unknown(txn: &PaymentGatewayTransaction) -> bool {
    txn.status == "failed" && txn.error_code.as_deref() == Some(UNKNOWN)
}

/// Ask the machine where a sale stands and apply the answer. A bridge sale
/// is told its result by the bridge, so only its deadline is checked. A sale
/// with no known outcome is still asked, so a late approval posts — but only
/// a definite answer changes it.
pub(crate) async fn refresh(state: &AppState, tenant_id: Uuid, id: Uuid) -> Result<(), AppError> {
    let (txn, terminal) = load_sale(&state.db, tenant_id, id).await?;
    let unknown = is_unknown(&txn);
    if !unknown && !matches!(txn.status.as_str(), "pending_gateway" | "created") {
        return Ok(());
    }
    let overdue = (Utc::now() - txn.created_at).num_seconds() > ANSWER_WITHIN_SECS;
    // A bridge reports on its own; a sale the provider never named cannot be asked.
    if terminal.connection == "bridge" || txn.gateway_order_id.is_empty() {
        if overdue && !unknown {
            // Untaken by its bridge, it never reached a machine; anything else might have.
            let never_taken = terminal.connection == "bridge" && txn.status == "pending_gateway";
            let step = if never_taken {
                Step::Expire(NEVER_TAKEN.to_owned())
            } else {
                Step::Unknown(NO_ANSWER.to_owned())
            };
            apply(&state.db, tenant_id, id, step).await?;
        }
        return Ok(());
    }
    let provider = provider_for(&terminal).ok_or_else(|| {
        AppError::ServiceUnavailable(format!("No adapter for '{}'", terminal.provider))
    })?;
    let c = ctx(state, tenant_id, &terminal);
    let reference = txn.gateway_order_id.as_str();
    let mut answer = provider.status(&c, reference).await;
    if unknown {
        return match answer {
            Ok(SaleState::Waiting) | Err(_) => Ok(()),
            definite => apply(&state.db, tenant_id, id, next_step(definite, false, false)).await,
        };
    }
    let mut cancel_confirmed = txn.notes["cancel_confirmed"] == serde_json::Value::Bool(true);
    if overdue && !cancel_confirmed && matches!(answer, Ok(SaleState::Waiting) | Err(_)) {
        // Close it on the machine, then ask once more: an approval that
        // landed meanwhile must still post.
        let paise = crate::amount_to_paise(txn.amount)?;
        match provider.cancel(&c, reference, paise).await {
            Ok(()) => cancel_confirmed = true,
            Err(e) => {
                tracing::warn!(txn = %id, error = %e.words(), "card machine did not take the cancel");
            }
        }
        answer = provider.status(&c, reference).await;
    }
    note(&state.db, tenant_id, &terminal, &answer).await?;
    let step = next_step(answer, overdue, cancel_confirmed);
    apply(&state.db, tenant_id, id, step).await
}

/// `GET /api/payments/pos-sale/{id}` — where the sale stands; asks the
/// machine when it is still open.
pub async fn sale_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PosSaleView>, AppError> {
    require_counter(&claims)?;
    let (txn, _) = load_sale(&state.db, claims.tenant_id, id).await?;
    require_collect(&state, &claims, txn.invoice_id).await?;
    refresh(&state, claims.tenant_id, id).await?;
    view(&state.db, claims.tenant_id, id).await.map(Json)
}
