//! Starting a card sale at the counter: check the machine and the bill,
//! make the one open sale row the machine may run, and hand it over.

use axum::{Extension, Json, extract::State};
use medbrains_core::payment::PaymentTerminal;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::state::AppState;
use rust_decimal::Decimal;
use serde::Deserialize;
use uuid::Uuid;

use super::sale::{OPEN, Tx, begin, close, ctx, refresh, require_collect};
use super::view::{PosSaleView, view};
use super::{PosError, SaleAsk, Tender, provider_for};
use crate::terminals::{load, note_health};

#[derive(Debug, Deserialize)]
pub struct StartSale {
    pub terminal_id: Uuid,
    pub invoice_id: Option<Uuid>,
    pub amount: Decimal,
    /// Card, UPI on the machine, or either.
    #[serde(default)]
    pub tender: Tender,
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

/// The bill still owes `amount`, and no earlier card payment on it is
/// waiting for a person to say whether it was taken — charging again then
/// could take the money twice.
async fn check_balance(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    invoice_id: Uuid,
    amount: Decimal,
) -> Result<(), AppError> {
    let due: Option<(Decimal, bool)> = sqlx::query_as(
        "SELECT i.total_amount - i.paid_amount, \
                EXISTS(SELECT 1 FROM payment_gateway_transactions g \
                        WHERE g.tenant_id = i.tenant_id AND g.invoice_id = i.id \
                          AND g.status = 'failed' AND g.error_code = 'unknown') \
           FROM invoices i WHERE i.id = $1 AND i.tenant_id = $2",
    )
    .bind(invoice_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;
    match due {
        None => Err(AppError::NotFound),
        Some((_, true)) => Err(AppError::Conflict(
            "An earlier card payment on this bill has no definite outcome yet. A supervisor \
             checks the machine's slip and resolves it before the card is charged again."
                .to_owned(),
        )),
        Some((due, _)) if amount > due => Err(AppError::BadRequest(format!(
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
                 jsonb_build_object('stage', 'sent', 'tender', $7::text)) \
         ON CONFLICT (terminal_id) WHERE terminal_id IS NOT NULL AND {OPEN} DO NOTHING RETURNING id"
    ))
    .bind(claims.tenant_id)
    .bind(body.invoice_id)
    .bind(&t.provider)
    .bind(body.amount)
    .bind(claims.sub)
    .bind(t.id)
    .bind(body.tender.word())
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
                tender: body.tender,
            },
        )
        .await?;
    }
    view(&state.db, claims.tenant_id, txn_id).await.map(Json)
}
