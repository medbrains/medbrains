//! A pretend card machine for development and testing — never production.
//!
//! On only when `MEDBRAINS_POS_SIMULATOR=true` (in the environment, or through
//! the secret resolver so a test turns it on for its own server) and `MEDBRAINS_ENV`
//! is not `production`; the server also refuses to start with it on in
//! production. A sale waits at the "machine" until someone plays the patient:
//! the Payment terminals settings screen (or this API) says what the card
//! did — approve, decline, time out, go offline, or approve part of it.

use async_trait::async_trait;
use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use medbrains_core::secrets::SecretResolver;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use uuid::Uuid;

use super::{Approval, Ctx, PosError, PosProvider, SaleAsk, SaleState};

pub const PROVIDER: &str = "simulator";
pub const ENV_FLAG: &str = "MEDBRAINS_POS_SIMULATOR";
/// What an unplugged simulated machine says when asked.
pub const UNPLUGGED: &str = "Unplugged (simulator)";
/// The simulated card.
const CARD_LAST4: &str = "4242";
const OUTCOMES: &[&str] = &["approve", "decline", "timeout", "offline", "partial"];

/// Whether the simulator may run here.
pub async fn enabled(secrets: &dyn SecretResolver) -> bool {
    let production = std::env::var("MEDBRAINS_ENV").is_ok_and(|e| e == "production");
    let on = |v: &str| v == "true";
    !production
        && (std::env::var(ENV_FLAG).is_ok_and(|v| on(&v))
            || secrets.get(ENV_FLAG).await.is_ok_and(|v| on(&v)))
}

#[derive(Debug)]
pub struct Simulator;

/// What a person at the simulated machine did, kept on the sale row.
pub fn read_outcome(reference: &str, sim: &Value) -> Result<SaleState, PosError> {
    let approved = |paise: Option<i64>| {
        SaleState::Approved(Approval {
            reference: format!(
                "SIM-{}",
                &reference[..8.min(reference.len())].to_uppercase()
            ),
            approved_paise: paise,
            card_last4: Some(CARD_LAST4.to_owned()),
            auth_code: Some("SIM0K1".to_owned()),
            payload: sim.clone(),
        })
    };
    match sim["outcome"].as_str() {
        Some("approve") => Ok(approved(None)),
        Some("partial") => Ok(approved(sim["approved_paise"].as_i64())),
        Some("decline") => Ok(SaleState::Declined(
            "Declined by the bank (simulated)".to_owned(),
        )),
        Some("timeout") => Ok(SaleState::TimedOut),
        Some("cancelled") => Ok(SaleState::Cancelled),
        Some("offline") => Err(PosError::Offline(
            "The simulated machine went offline".to_owned(),
        )),
        _ => Ok(SaleState::Waiting),
    }
}

async fn sim_of(ctx: &Ctx<'_>, reference: &str) -> Result<Value, PosError> {
    let id: Uuid = reference
        .parse()
        .map_err(|_| PosError::Refused("Not a simulator sale".to_owned()))?;
    let fault = |e: sqlx::Error| PosError::Offline(format!("simulator: {e}"));
    let mut tx = super::scoped(ctx.db, ctx.tenant_id).await?;
    let sim = sqlx::query_scalar::<_, Value>(
        "SELECT COALESCE(notes->'sim', 'null'::jsonb) FROM payment_gateway_transactions \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(ctx.tenant_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(fault)?;
    tx.commit().await.map_err(fault)?;
    sim.ok_or_else(|| PosError::Refused("The simulator has no such sale".to_owned()))
}

fn unplugged(ctx: &Ctx<'_>) -> Result<(), PosError> {
    if ctx.terminal.last_error.as_deref() == Some(UNPLUGGED) {
        return Err(PosError::Offline(UNPLUGGED.to_owned()));
    }
    Ok(())
}

#[async_trait]
impl PosProvider for Simulator {
    async fn start(&self, ctx: &Ctx<'_>, sale: SaleAsk) -> Result<String, PosError> {
        unplugged(ctx)?;
        Ok(sale.txn_id.to_string())
    }

    async fn status(&self, ctx: &Ctx<'_>, reference: &str) -> Result<SaleState, PosError> {
        read_outcome(reference, &sim_of(ctx, reference).await?)
    }

    async fn cancel(&self, ctx: &Ctx<'_>, reference: &str) -> Result<(), PosError> {
        // Too late once the card went through; the status then says approved.
        let fault = |e: sqlx::Error| PosError::Offline(format!("simulator: {e}"));
        let mut tx = super::scoped(ctx.db, ctx.tenant_id).await?;
        sqlx::query(
            "UPDATE payment_gateway_transactions SET notes = notes || '{\"sim\":{\"outcome\":\"cancelled\"}}' \
             WHERE id::text = $1 AND tenant_id = $2 \
               AND COALESCE(notes->'sim'->>'outcome', '') NOT IN ('approve', 'partial')",
        )
        .bind(reference)
        .bind(ctx.tenant_id)
        .execute(&mut *tx)
        .await
        .map_err(fault)?;
        tx.commit().await.map_err(fault)?;
        Ok(())
    }

    async fn refund(
        &self,
        _ctx: &Ctx<'_>,
        reference: &str,
        _paise: i64,
    ) -> Result<String, PosError> {
        Ok(format!(
            "SIMRF-{}-{}",
            &reference[..8.min(reference.len())],
            Uuid::new_v4().simple()
        ))
    }

    async fn ping(&self, ctx: &Ctx<'_>) -> Result<(), PosError> {
        unplugged(ctx)
    }
}

// ── The person at the machine ──────────────────────────────────────────────

async fn require_simulator(state: &AppState, claims: &Claims) -> Result<(), AppError> {
    require_permission(claims, permissions::billing::terminals::MANAGE)?;
    if enabled(state.secret_resolver.as_ref()).await {
        Ok(())
    } else {
        Err(AppError::NotFound)
    }
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SimulatedSale {
    pub transaction_id: Uuid,
    pub terminal_id: Uuid,
    pub terminal_label: String,
    pub amount: Decimal,
    pub created_at: DateTime<Utc>,
}

/// `GET /api/payments/simulator/sales` — sales waiting at a simulated machine.
pub async fn list_simulated_sales(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<SimulatedSale>>, AppError> {
    require_simulator(&state, &claims).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, SimulatedSale>(
        "SELECT g.id AS transaction_id, t.id AS terminal_id, t.label AS terminal_label, \
                g.amount, g.created_at \
           FROM payment_gateway_transactions g JOIN payment_terminals t ON t.id = g.terminal_id \
          WHERE g.tenant_id = $1 AND g.gateway = $2 AND g.status IN ('pending_gateway', 'created') \
          ORDER BY g.created_at DESC LIMIT 50",
    )
    .bind(claims.tenant_id)
    .bind(PROVIDER)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct OutcomeRequest {
    /// approve | decline | timeout | offline | partial
    pub outcome: String,
    /// For `partial`: what the card covered, in rupees.
    pub approved_amount: Option<Decimal>,
}

/// `POST /api/payments/simulator/sales/{id}` — what the card did.
pub async fn act_on_simulated_sale(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<OutcomeRequest>,
) -> Result<Json<Value>, AppError> {
    require_simulator(&state, &claims).await?;
    let outcome = body.outcome.trim();
    if !OUTCOMES.contains(&outcome) {
        return Err(AppError::BadRequest(format!(
            "Outcome must be one of {}",
            OUTCOMES.join(", ")
        )));
    }
    let approved_paise = match (outcome, body.approved_amount) {
        ("partial", Some(a)) if a > Decimal::ZERO => Some(crate::amount_to_paise(a)?),
        ("partial", _) => {
            return Err(AppError::BadRequest(
                "Say how much of it the card covered".to_owned(),
            ));
        }
        _ => None,
    };
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let done = sqlx::query(
        "UPDATE payment_gateway_transactions SET notes = notes || jsonb_build_object('sim', $3::jsonb), \
                updated_at = now() \
          WHERE id = $1 AND tenant_id = $2 AND gateway = $4 AND status IN ('pending_gateway', 'created')",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(json!({ "outcome": outcome, "approved_paise": approved_paise }))
    .bind(PROVIDER)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    tx.commit().await?;
    if done == 0 {
        return Err(AppError::NotFound);
    }
    Ok(Json(json!({ "outcome": outcome })))
}

#[derive(Debug, Deserialize)]
pub struct PowerRequest {
    pub on: bool,
}

/// `POST /api/payments/simulator/terminals/{id}/power` — plug the simulated
/// machine in or pull its cable.
pub async fn power_simulated_terminal(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<PowerRequest>,
) -> Result<Json<Value>, AppError> {
    require_simulator(&state, &claims).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let done = sqlx::query(
        "UPDATE payment_terminals SET \
            last_status = CASE WHEN $3 THEN 'online' ELSE 'offline' END, \
            last_error = CASE WHEN $3 THEN NULL ELSE $5 END, \
            last_seen_at = CASE WHEN $3 THEN now() ELSE last_seen_at END \
          WHERE id = $1 AND tenant_id = $2 AND provider = $4",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.on)
    .bind(PROVIDER)
    .bind(UNPLUGGED)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    tx.commit().await?;
    if done == 0 {
        return Err(AppError::NotFound);
    }
    Ok(Json(json!({ "on": body.on })))
}

#[cfg(test)]
mod tests {
    use super::{PosError, SaleState, read_outcome};
    use serde_json::json;

    #[test]
    fn each_scripted_outcome_reads_as_the_machine_would_say_it() {
        let r = "0a1b2c3d-0000-0000-0000-000000000000";
        assert_eq!(read_outcome(r, &json!(null)), Ok(SaleState::Waiting));
        assert!(matches!(read_outcome(r, &json!({ "outcome": "approve" })),
            Ok(SaleState::Approved(a)) if a.approved_paise.is_none() && a.reference == "SIM-0A1B2C3D"));
        assert!(
            matches!(read_outcome(r, &json!({ "outcome": "partial", "approved_paise": 2000 })),
            Ok(SaleState::Approved(a)) if a.approved_paise == Some(2000))
        );
        assert!(matches!(
            read_outcome(r, &json!({ "outcome": "decline" })),
            Ok(SaleState::Declined(_))
        ));
        assert_eq!(
            read_outcome(r, &json!({ "outcome": "timeout" })),
            Ok(SaleState::TimedOut)
        );
        assert!(matches!(
            read_outcome(r, &json!({ "outcome": "offline" })),
            Err(PosError::Offline(_))
        ));
    }
}
