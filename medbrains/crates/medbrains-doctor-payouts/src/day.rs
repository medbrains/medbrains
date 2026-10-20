//! Day-doctor settlement at session close: the patients seen today, what
//! the day earned with the session minimum, then pay by cash / UPI / bank or
//! roll it into the monthly statement.

use axum::{
    Extension, Json,
    extract::{Query, State},
};
use chrono::NaiveDate;
use medbrains_core::permissions::doctor_payouts::day_settlement;
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::ledger::{LedgerLine, ledger_select};
use crate::payout_ops::{self, Attempt};
use crate::statement_ops::{self, OPEN_ROW, Prepare};
use crate::{agreements, begin, engine, session, settings};

#[derive(Debug, Deserialize)]
pub struct DayQuery {
    pub doctor_id: Uuid,
    pub date: NaiveDate,
}

#[derive(Debug, Serialize)]
pub struct DaySummary {
    pub doctor_id: Uuid,
    pub date: NaiveDate,
    pub has_agreement: bool,
    pub engagement_type: Option<String>,
    pub payout_mode: Option<String>,
    pub session_minimum: Option<Decimal>,
    pub lines: Vec<LedgerLine>,
    pub earned: Decimal,
    pub session_topup: Decimal,
    pub total: Decimal,
    pub cash_paid_today: Decimal,
    pub cash_limit: Decimal,
    /// What paying `total` in cash now would warn.
    pub cash_warning: Option<String>,
}

/// GET /api/doctor-payouts/day — read only; settling appends the rows.
pub async fn day_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<DayQuery>,
) -> Result<Json<DaySummary>, AppError> {
    require_permission(&claims, day_settlement::EXECUTE)?;
    let mut tx = begin(&state, &claims).await?;
    let agreement = agreements::covering(&mut tx, q.doctor_id, q.date).await?;
    let sql = format!(
        "{} WHERE a.tenant_id = $1 AND a.doctor_id = $2 AND a.service_date = $3 AND a.deleted_at IS NULL \
           AND {OPEN_ROW} ORDER BY a.created_at LIMIT 500",
        ledger_select()
    );
    let lines = sqlx::query_as::<_, LedgerLine>(&sql)
        .bind(claims.tenant_id)
        .bind(q.doctor_id)
        .bind(q.date)
        .fetch_all(&mut *tx)
        .await?;
    let earned: Decimal = lines
        .iter()
        .filter(|l| l.event != "session_minimum")
        .map(|l| l.amount)
        .sum();
    let topped: Decimal = lines
        .iter()
        .filter(|l| l.event == "session_minimum")
        .map(|l| l.amount)
        .sum();
    let minimum = agreement.as_ref().and_then(|a| a.session_minimum);
    let topup = minimum.map_or(topped, |m| engine::session_topup(m, earned));
    let total = earned + topup;
    let cash_paid_today =
        payout_ops::cash_paid_today(&mut tx, claims.tenant_id, q.doctor_id).await?;
    let cash_limit = settings::load(&mut tx, claims.tenant_id)
        .await?
        .cash_daily_warn_limit;
    tx.commit().await?;
    Ok(Json(DaySummary {
        doctor_id: q.doctor_id,
        date: q.date,
        has_agreement: agreement.is_some(),
        engagement_type: agreement.as_ref().map(|a| a.engagement_type.clone()),
        payout_mode: agreement.as_ref().map(|a| a.payout_mode.clone()),
        session_minimum: minimum,
        lines,
        earned,
        session_topup: topup,
        total,
        cash_paid_today,
        cash_limit,
        cash_warning: engine::cash_warning(cash_paid_today, total, cash_limit),
    }))
}

#[derive(Debug, Deserialize)]
pub struct SettleInput {
    pub doctor_id: Uuid,
    pub date: NaiveDate,
    /// `cash`, `upi`, `bank`, or `roll` to leave it for the monthly statement.
    pub mode: String,
    /// The UPI or bank transaction reference; required unless cash.
    pub reference: Option<String>,
}

/// POST /api/doctor-payouts/day/settle
pub async fn settle_day(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<SettleInput>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, day_settlement::EXECUTE)?;
    let reference = body
        .reference
        .as_deref()
        .map(str::trim)
        .filter(|r| !r.is_empty());
    if !matches!(body.mode.as_str(), "cash" | "upi" | "bank" | "roll") {
        return Err(AppError::BadRequest(
            "Settle by cash, UPI or bank, or roll into the monthly statement".to_owned(),
        ));
    }
    if matches!(body.mode.as_str(), "upi" | "bank") && reference.is_none() {
        return Err(AppError::BadRequest(
            "Enter the UPI or bank transaction reference".to_owned(),
        ));
    }
    let mut tx = begin(&state, &claims).await?;
    statement_ops::sync_doctor(
        &mut tx,
        claims.tenant_id,
        body.doctor_id,
        body.date,
        body.date,
    )
    .await?;
    session::apply_session_minimum(&mut tx, claims.tenant_id, body.doctor_id, body.date).await?;
    if body.mode == "roll" {
        tx.commit().await?;
        return Ok(Json(json!({ "rolled": true })));
    }
    let ask = Prepare {
        tenant_id: claims.tenant_id,
        doctor_id: body.doctor_id,
        from: body.date,
        to: body.date,
        same_day: true,
        actor: claims.sub,
    };
    let id = statement_ops::prepare(&mut tx, &ask).await?;
    let statement = statement_ops::approve(&mut tx, claims.tenant_id, id, claims.sub).await?;
    let amount = statement.net_payable.unwrap_or_default();
    let warning = if body.mode == "cash" {
        payout_ops::cash_check(&mut tx, claims.tenant_id, &statement, amount).await?
    } else {
        None
    };
    let attempt = Attempt {
        statement: &statement,
        run_id: Uuid::new_v4(),
        mode: &body.mode,
        provider: "manual",
        warning: warning.as_deref(),
        actor: claims.sub,
    };
    let payout = payout_ops::record(&mut tx, claims.tenant_id, &attempt).await?;
    payout_ops::finish_paid(&mut tx, claims.tenant_id, payout, reference, claims.sub).await?;
    let paid = statement_ops::fetch(&mut tx, id).await?;
    tx.commit().await?;
    Ok(Json(
        json!({ "statement": paid, "payout_id": payout, "warning": warning }),
    ))
}
