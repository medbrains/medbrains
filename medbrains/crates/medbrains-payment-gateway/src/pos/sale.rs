//! A card sale at the counter: start it on the machine, follow it, cancel it,
//! and apply whatever the machine said — once.

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
use rust_decimal::Decimal;
use serde::Deserialize;
use sqlx::PgPool;
use uuid::Uuid;

use super::view::{PosSaleView, view};
use super::{
    ANSWER_WITHIN_SECS, Ctx, NO_ANSWER, PosError, SaleAsk, SaleState, Step, next_step, provider_for,
};
use crate::settle::{Capture, Received, lock_txn, rupees, settle_capture};
use crate::terminals::{load, note_health};

type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;
const OPEN: &str = "status IN ('pending_gateway', 'created')";

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
    match step {
        Step::Keep { waiting: false } => {}
        Step::Keep { waiting: true } => {
            sqlx::query(&format!(
                "UPDATE payment_gateway_transactions SET status = 'created', \
                 notes = notes || '{{\"stage\":\"waiting\"}}' WHERE id = $1 AND {OPEN}"
            ))
            .bind(txn_id)
            .execute(&mut *tx)
            .await?;
        }
        Step::Settle(a) => {
            let txn = lock_txn(&mut tx, txn_id).await?;
            let approved = a.approved_paise.map_or(txn.amount, rupees);
            let received = if approved < txn.amount {
                Received::Credited(approved)
            } else {
                Received::Exactly(approved)
            };
            let capture = Capture {
                provider: &txn.gateway,
                payment_id: &a.reference,
                method: Some("card"),
                received,
                signature: None,
                payload: Some(&a.payload),
            };
            if let crate::settle::Settled::Now(_) =
                settle_capture(&mut tx, txn_id, &capture).await?
            {
                sqlx::query(
                    "UPDATE payment_gateway_transactions SET card_last4 = $2, card_auth_code = $3, \
                     notes = notes || jsonb_build_object('stage', 'approved', 'approved_amount', $4::text) \
                     WHERE id = $1",
                )
                .bind(txn_id)
                .bind(&a.card_last4)
                .bind(&a.auth_code)
                .bind(approved)
                .execute(&mut *tx)
                .await?;
            }
        }
        Step::Fail { code, why } => close(&mut tx, txn_id, "failed", Some(code), &why).await?,
        Step::Expire(why) => close(&mut tx, txn_id, "expired", None, &why).await?,
    }
    tx.commit().await?;
    Ok(())
}

async fn close(
    tx: &mut Tx<'_>,
    txn_id: Uuid,
    status: &str,
    code: Option<&str>,
    why: &str,
) -> Result<(), AppError> {
    sqlx::query(&format!(
        "UPDATE payment_gateway_transactions SET status = $2, error_code = $3, \
         error_description = $4, updated_at = now() WHERE id = $1 AND {OPEN}"
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

/// Ask the machine where an open sale stands and apply the answer. A bridge
/// sale is told its result by the bridge, so only its deadline is checked.
pub(crate) async fn refresh(state: &AppState, tenant_id: Uuid, id: Uuid) -> Result<(), AppError> {
    let (txn, terminal) = load_sale(&state.db, tenant_id, id).await?;
    if !matches!(txn.status.as_str(), "pending_gateway" | "created") {
        return Ok(());
    }
    let overdue = (Utc::now() - txn.created_at).num_seconds() > ANSWER_WITHIN_SECS;
    if terminal.connection == "bridge" || txn.status == "pending_gateway" {
        if overdue {
            apply(&state.db, tenant_id, id, Step::Expire(NO_ANSWER.to_owned())).await?;
        }
        return Ok(());
    }
    let provider = provider_for(&terminal).ok_or_else(|| {
        AppError::ServiceUnavailable(format!("No adapter for '{}'", terminal.provider))
    })?;
    let c = ctx(state, tenant_id, &terminal);
    let mut answer = provider.status(&c, &txn.gateway_order_id).await;
    if overdue && matches!(answer, Ok(SaleState::Waiting) | Err(PosError::Offline(_))) {
        // Close it on the machine, then ask once more: an approval that
        // landed meanwhile must still post.
        if let Err(e) = provider.cancel(&c, &txn.gateway_order_id).await {
            tracing::warn!(txn = %id, error = %e.words(), "card machine did not take the cancel");
        }
        answer = provider.status(&c, &txn.gateway_order_id).await;
    }
    note(&state.db, tenant_id, &terminal, &answer).await?;
    apply(&state.db, tenant_id, id, next_step(answer, overdue)).await
}

#[derive(Debug, Deserialize)]
pub struct StartSale {
    pub terminal_id: Uuid,
    pub invoice_id: Option<Uuid>,
    pub amount: Decimal,
}

fn usable(t: &PaymentTerminal) -> Result<(), AppError> {
    if !t.is_active || t.retired_at.is_some() {
        return Err(AppError::Conflict(format!(
            "{} is not in use any more",
            t.label
        )));
    }
    if t.kind != "pos" {
        return Err(AppError::BadRequest(format!(
            "{} is not a card machine",
            t.label
        )));
    }
    if t.status == "offline" {
        let why = t
            .last_error
            .as_deref()
            .map(|e| format!(" ({e})"))
            .unwrap_or_default();
        return Err(AppError::Conflict(format!(
            "{} is offline{why}. Take the payment another way, or check the machine and its cable.",
            t.label
        )));
    }
    Ok(())
}

async fn check_balance(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    invoice_id: Uuid,
    amount: Decimal,
) -> Result<(), AppError> {
    let due: Option<Decimal> = sqlx::query_scalar(
        "SELECT total_amount - paid_amount FROM invoices WHERE id = $1 AND tenant_id = $2",
    )
    .bind(invoice_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;
    match due {
        None => Err(AppError::NotFound),
        Some(due) if amount > due => Err(AppError::BadRequest(format!(
            "₹{amount} is more than the ₹{due} still due on this bill"
        ))),
        Some(_) => Ok(()),
    }
}

/// Bring the terminal's earlier sales up to date first, so one the patient
/// already finished, or that ran out of time, does not hold the machine.
async fn settle_earlier(
    state: &AppState,
    tenant_id: Uuid,
    terminal_id: Uuid,
) -> Result<(), AppError> {
    let mut tx = begin(&state.db, tenant_id).await?;
    let open: Vec<Uuid> = sqlx::query_scalar(&format!(
        "SELECT id FROM payment_gateway_transactions WHERE terminal_id = $1 AND {OPEN} LIMIT 5"
    ))
    .bind(terminal_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    for id in open {
        refresh(state, tenant_id, id).await?;
    }
    Ok(())
}

/// The sale row; `None` when the machine already has an open one (a unique
/// index allows one open sale per machine).
async fn insert_sale(
    tx: &mut Tx<'_>,
    claims: &Claims,
    t: &PaymentTerminal,
    body: &StartSale,
) -> Result<Option<Uuid>, AppError> {
    Ok(sqlx::query_scalar(&format!(
        "INSERT INTO payment_gateway_transactions \
         (tenant_id, invoice_id, gateway, gateway_order_id, amount, currency, status, created_by, \
          terminal_id, idempotency_key, notes) \
         VALUES ($1, $2, $3, '', $4, 'INR', 'pending_gateway', $5, $6, gen_random_uuid()::text, \
                 '{{\"stage\":\"sent\"}}') \
         ON CONFLICT (terminal_id) WHERE terminal_id IS NOT NULL AND {OPEN} DO NOTHING RETURNING id"
    ))
    .bind(claims.tenant_id)
    .bind(body.invoice_id)
    .bind(&t.provider)
    .bind(body.amount)
    .bind(claims.sub)
    .bind(t.id)
    .fetch_optional(&mut **tx)
    .await?)
}

/// Hand a cloud sale to its provider. Nothing is charged if this fails.
async fn send(
    state: &AppState,
    tenant_id: Uuid,
    t: &PaymentTerminal,
    sale: SaleAsk,
) -> Result<(), AppError> {
    let provider = provider_for(t)
        .ok_or_else(|| AppError::ServiceUnavailable(format!("No adapter for '{}'", t.provider)))?;
    let started = provider.start(&ctx(state, tenant_id, t), sale).await;
    let mut tx = begin(&state.db, tenant_id).await?;
    let failed = match started {
        Ok(reference) => {
            sqlx::query(
                "UPDATE payment_gateway_transactions SET status = 'created', gateway_order_id = $2, \
                 notes = notes || '{\"stage\":\"waiting\"}' WHERE id = $1 AND status = 'pending_gateway'",
            )
            .bind(sale.txn_id)
            .bind(reference)
            .execute(&mut *tx)
            .await?;
            note_health(&mut tx, t.id, Ok(())).await?;
            None
        }
        Err(e) => {
            let code = if matches!(e, PosError::Offline(_)) {
                "offline"
            } else {
                "refused"
            };
            if code == "offline" {
                note_health(&mut tx, t.id, Err(e.words())).await?;
            }
            close(&mut tx, sale.txn_id, "failed", Some(code), &e.words()).await?;
            Some(e.words())
        }
    };
    tx.commit().await?;
    match failed {
        None => Ok(()),
        Some(why) => Err(AppError::Conflict(format!(
            "{why}. Nothing was charged — take the payment another way, or try again."
        ))),
    }
}

/// `POST /api/payments/pos-sale` — send the amount to the card machine at the
/// counter. A bridge machine's sale waits for its bridge to take it.
pub async fn start_sale(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<StartSale>,
) -> Result<Json<PosSaleView>, AppError> {
    require_collect(&state, &claims, body.invoice_id).await?;
    let amount_paise = crate::amount_to_paise(body.amount)?;
    settle_earlier(&state, claims.tenant_id, body.terminal_id).await?;
    let mut tx = begin(&state.db, claims.tenant_id).await?;
    let terminal = load(&mut tx, claims.tenant_id, body.terminal_id)
        .await?
        .ok_or(AppError::NotFound)?;
    usable(&terminal)?;
    if let Some(invoice_id) = body.invoice_id {
        check_balance(&mut tx, claims.tenant_id, invoice_id, body.amount).await?;
    }
    let Some(txn_id) = insert_sale(&mut tx, &claims, &terminal, &body).await? else {
        return Err(AppError::Conflict(format!(
            "{} is still busy with another payment. Finish or cancel that one first.",
            terminal.label
        )));
    };
    tx.commit().await?;
    if terminal.connection != "bridge" {
        send(
            &state,
            claims.tenant_id,
            &terminal,
            SaleAsk {
                txn_id,
                amount_paise,
            },
        )
        .await?;
    }
    view(&state.db, claims.tenant_id, txn_id).await.map(Json)
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
