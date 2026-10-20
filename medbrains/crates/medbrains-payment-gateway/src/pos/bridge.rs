//! A card machine wired to a counter PC (USB, serial, Bluetooth), reached
//! through the site bridge — the way print jobs reach printers (#4798).
//!
//! The server never talks to the machine. A sale waits as an open row; the
//! bridge polls `claim`, which is also its heartbeat for the machines it
//! names, drives each claimed sale on the machine through its device adapter,
//! and reports `waiting`, then approved / declined / timed out / cancelled to
//! `result`. A cancel asked for at the counter goes out on the next claim. A
//! result reported twice settles once.

use async_trait::async_trait;
use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use uuid::Uuid;

use super::{Approval, Ctx, PosError, PosProvider, SaleAsk, SaleState, Step, next_step};

/// Sales one claim hands out — a counter machine runs one at a time.
const MAX_CLAIM: i64 = 20;

#[derive(Debug)]
pub struct Bridge;

#[async_trait]
impl PosProvider for Bridge {
    /// The open row is the job; the bridge takes it on its next claim.
    async fn start(&self, _ctx: &Ctx<'_>, sale: SaleAsk) -> Result<String, PosError> {
        Ok(format!("bridge:{}", sale.txn_id))
    }

    /// The bridge reports results; there is nothing to ask.
    async fn status(&self, _ctx: &Ctx<'_>, _reference: &str) -> Result<SaleState, PosError> {
        Ok(SaleState::Waiting)
    }

    /// Asked for on the row (`cancel_requested`); sent on the next claim.
    async fn cancel(&self, _ctx: &Ctx<'_>, _reference: &str, _paise: i64) -> Result<(), PosError> {
        Ok(())
    }

    async fn ping(&self, ctx: &Ctx<'_>) -> Result<(), PosError> {
        if ctx.terminal.status == "online" {
            Ok(())
        } else {
            Err(PosError::Offline(
                "Its bridge has not reported it lately".to_owned(),
            ))
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct MachineHealth {
    pub terminal_id: Uuid,
    /// Whether the adapter could reach the machine just now.
    pub online: bool,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ClaimRequest {
    /// The machines this bridge drives, and how each answered.
    pub terminals: Vec<MachineHealth>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TerminalJob {
    pub job_id: Uuid,
    /// `sale` or `cancel`.
    pub action: String,
    pub terminal_id: Uuid,
    pub adapter: Option<String>,
    pub device_address: Option<String>,
    pub amount_paise: i64,
}

/// `POST /api/payments/terminal-jobs/claim` — the bridge's heartbeat for its
/// machines, and the sales and cancels waiting for them.
pub async fn claim_terminal_jobs(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ClaimRequest>,
) -> Result<Json<Vec<TerminalJob>>, AppError> {
    require_permission(&claims, permissions::billing::terminals::DRIVE)?;
    let ids: Vec<Uuid> = body.terminals.iter().map(|t| t.terminal_id).collect();
    let online: Vec<bool> = body.terminals.iter().map(|t| t.online).collect();
    let errors: Vec<Option<String>> = body.terminals.iter().map(|t| t.error.clone()).collect();
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    sqlx::query(
        "UPDATE payment_terminals t SET last_seen_at = now(), \
                last_status = CASE WHEN h.online THEN 'online' ELSE 'offline' END, last_error = h.error \
           FROM unnest($2::uuid[], $3::bool[], $4::text[]) AS h(id, online, error) \
          WHERE t.id = h.id AND t.tenant_id = $1 AND t.connection = 'bridge'",
    )
    .bind(claims.tenant_id)
    .bind(&ids)
    .bind(&online)
    .bind(&errors)
    .execute(&mut *tx)
    .await?;
    let jobs = sqlx::query_as::<_, TerminalJob>(
        "WITH ready AS ( \
             SELECT g.id FROM payment_gateway_transactions g \
               JOIN payment_terminals t ON t.id = g.terminal_id \
              WHERE g.tenant_id = $1 AND t.connection = 'bridge' AND t.is_active \
                AND t.id = ANY($2) AND t.last_status = 'online' \
                AND (g.status = 'pending_gateway' \
                     OR (g.status = 'created' AND g.notes->>'cancel_requested' = 'true' \
                         AND g.notes->>'cancel_sent' IS NULL)) \
              ORDER BY g.created_at LIMIT $3 FOR UPDATE OF g SKIP LOCKED), \
         taken AS ( \
             UPDATE payment_gateway_transactions g SET \
                    status = 'created', gateway_order_id = 'bridge:' || g.id, \
                    notes = CASE WHEN g.status = 'created' THEN g.notes || '{\"cancel_sent\":true}' \
                                 ELSE g.notes END \
               FROM ready WHERE g.id = ready.id \
             RETURNING g.id, g.terminal_id, g.amount, \
                       CASE WHEN g.notes->>'cancel_sent' = 'true' THEN 'cancel' ELSE 'sale' END AS action) \
         SELECT k.id AS job_id, k.action, k.terminal_id, t.adapter, t.device_address, \
                (k.amount * 100)::bigint AS amount_paise \
           FROM taken k JOIN payment_terminals t ON t.id = k.terminal_id",
    )
    .bind(claims.tenant_id)
    .bind(&ids)
    .bind(MAX_CLAIM)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(jobs))
}

#[derive(Debug, Deserialize)]
pub struct JobResult {
    /// waiting | approved | declined | timed_out | cancelled
    pub outcome: String,
    pub reference: Option<String>,
    pub approved_paise: Option<i64>,
    pub card_last4: Option<String>,
    pub auth_code: Option<String>,
    pub rrn: Option<String>,
    /// How it was paid (`card`, `upi`…), when the machine says.
    pub method: Option<String>,
    pub message: Option<String>,
}

/// What the bridge reported, as the machine's answer.
pub fn read_result(job: Uuid, r: &JobResult) -> Result<SaleState, AppError> {
    let words = |fallback: &str| {
        r.message
            .clone()
            .filter(|m| !m.trim().is_empty())
            .unwrap_or_else(|| fallback.to_owned())
    };
    Ok(match r.outcome.as_str() {
        "waiting" => SaleState::Waiting,
        "approved" => SaleState::Approved(Approval {
            reference: r
                .reference
                .clone()
                .filter(|x| !x.is_empty())
                .unwrap_or_else(|| format!("bridge:{job}")),
            approved_paise: r.approved_paise,
            card_last4: r.card_last4.clone(),
            auth_code: r.auth_code.clone(),
            rrn: r.rrn.clone(),
            method: r.method.clone(),
            payload: json!({ "reported_by": "bridge", "message": r.message }),
        }),
        "declined" => SaleState::Declined(words("Declined at the machine")),
        "timed_out" => SaleState::TimedOut,
        "cancelled" => SaleState::Cancelled,
        other => {
            return Err(AppError::BadRequest(format!(
                "'{other}' is not a card machine outcome"
            )));
        }
    })
}

/// `POST /api/payments/terminal-jobs/{id}/result` — what the machine did.
pub async fn report_terminal_job(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<JobResult>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::billing::terminals::DRIVE)?;
    let answer = read_result(id, &body)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let ours: Option<Uuid> = sqlx::query_scalar(
        "SELECT g.id FROM payment_gateway_transactions g JOIN payment_terminals t ON t.id = g.terminal_id \
          WHERE g.id = $1 AND g.tenant_id = $2 AND t.connection = 'bridge'",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    ours.ok_or(AppError::NotFound)?;
    // A late approval still settles; nothing else reopens a closed sale.
    let step: Step = next_step(Ok(answer), false, false);
    super::sale::apply(&state.db, claims.tenant_id, id, step).await?;
    Ok(Json(json!({ "status": "recorded" })))
}
