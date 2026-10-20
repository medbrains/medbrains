//! The payout run: approved statements out by bank file, RazorpayX or cash;
//! UTRs recorded; failures returned to approved so they can be paid again.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::permissions::doctor_payouts::payouts;
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::payout_ops::{self, Attempt};
use crate::provider::{BankFile, PayoutProvider, PayoutRequest, RazorpayX, Sent};
use crate::statement_ops::{self, Statement};
use crate::{Tx, begin};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Payout {
    pub id: Uuid,
    pub statement_id: Uuid,
    pub run_id: Uuid,
    pub mode: String,
    pub provider: String,
    pub amount: Decimal,
    pub status: String,
    pub provider_ref: Option<String>,
    pub utr: Option<String>,
    pub warning: Option<String>,
    pub failure_reason: Option<String>,
    pub paid_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub payee_name: Option<String>,
    pub statement_kind: String,
}

const PAYOUT_SELECT: &str = "SELECT o.id, o.statement_id, o.run_id, o.mode, o.provider, o.amount, o.status, \
     o.provider_ref, o.utr, o.warning, o.failure_reason, o.paid_at, o.created_at, \
     COALESCE(u.full_name, r.name) AS payee_name, s.kind AS statement_kind \
     FROM doctor_payouts o JOIN incentive_calculations s ON s.id = o.statement_id \
     LEFT JOIN users u ON u.id = s.doctor_id \
     LEFT JOIN lab_referral_doctors r ON r.id = s.referral_doctor_id";

#[derive(Debug, Deserialize)]
pub struct PayoutQuery {
    pub status: Option<String>,
    pub run_id: Option<Uuid>,
}

/// GET /api/doctor-payouts/payouts
pub async fn list_payouts(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<PayoutQuery>,
) -> Result<Json<Vec<Payout>>, AppError> {
    require_permission(&claims, payouts::EXECUTE)?;
    let mut tx = begin(&state, &claims).await?;
    let sql = format!(
        "{PAYOUT_SELECT} WHERE o.tenant_id = $1 AND o.deleted_at IS NULL \
           AND ($2::text IS NULL OR o.status = $2) AND ($3::uuid IS NULL OR o.run_id = $3) \
         ORDER BY o.created_at DESC LIMIT 500"
    );
    let rows = sqlx::query_as::<_, Payout>(&sql)
        .bind(claims.tenant_id)
        .bind(q.status.as_deref().filter(|s| !s.is_empty()))
        .bind(q.run_id)
        .fetch_all(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// Where the money goes, from the doctor's agreement.
#[derive(Debug, sqlx::FromRow)]
struct Destination {
    payout_mode: String,
    bank_account_name: Option<String>,
    bank_account_number: Option<String>,
    bank_ifsc: Option<String>,
    upi_vpa: Option<String>,
}

async fn destination(tx: &mut Tx<'_>, s: &Statement) -> Result<Option<Destination>, AppError> {
    let Some(id) = s.agreement_id else {
        return Ok(None);
    };
    Ok(sqlx::query_as::<_, Destination>(
        "SELECT payout_mode, bank_account_name, bank_account_number, bank_ifsc, upi_vpa \
           FROM doctor_incentive_assignments WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&mut **tx)
    .await?)
}

#[derive(Debug, Deserialize)]
pub struct RunInput {
    pub statement_ids: Vec<Uuid>,
    /// `bank_file`, `razorpayx` or `manual` (cash, or a transfer made outside).
    pub provider: String,
    /// Override the agreement's mode: `cash`, `bank` or `upi`.
    pub mode: Option<String>,
    /// For manual payouts: the receipt or bank reference.
    pub reference: Option<String>,
}

/// One statement queued in a run.
struct Queued {
    payout: Uuid,
    request: PayoutRequest,
}

/// POST /api/doctor-payouts/payouts — pay a batch of approved statements.
pub async fn run_payouts(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<RunInput>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, payouts::EXECUTE)?;
    if body.statement_ids.is_empty() || body.statement_ids.len() > 500 {
        return Err(AppError::BadRequest(
            "Choose between 1 and 500 statements".to_owned(),
        ));
    }
    let run_id = Uuid::new_v4();
    let mut tx = begin(&state, &claims).await?;
    let provider: Option<Box<dyn PayoutProvider>> = match body.provider.as_str() {
        "razorpayx" => {
            let cfg =
                RazorpayX::configured(&mut tx, state.secret_resolver.as_ref(), claims.tenant_id)
                    .await?;
            Some(Box::new(cfg.ok_or_else(|| {
                AppError::Conflict("RazorpayX payouts are not set up for this hospital".to_owned())
            })?))
        }
        "bank_file" => Some(Box::new(BankFile)),
        "manual" => None,
        _ => return Err(AppError::BadRequest("Unknown payout provider".to_owned())),
    };
    let mut queued = Vec::new();
    let mut warnings = Vec::new();
    for id in &body.statement_ids {
        let s = statement_ops::lock(&mut tx, *id).await?;
        let dest = destination(&mut tx, &s).await?;
        let mode = body
            .mode
            .clone()
            .or_else(|| dest.as_ref().map(|d| d.payout_mode.clone()))
            .unwrap_or_else(|| "bank".to_owned());
        let code = match &provider {
            Some(p) if mode != "cash" => p.code(),
            _ => "manual",
        };
        let request = request_for(&s, &mode, dest.as_ref(), code)?;
        let warning = if mode == "cash" {
            payout_ops::cash_check(
                &mut tx,
                claims.tenant_id,
                &s,
                s.net_payable.unwrap_or_default(),
            )
            .await?
        } else {
            None
        };
        let attempt = Attempt {
            statement: &s,
            run_id,
            mode: &mode,
            provider: code,
            warning: warning.as_deref(),
            actor: claims.sub,
        };
        let payout = payout_ops::record(&mut tx, claims.tenant_id, &attempt).await?;
        warnings.extend(warning);
        if code == "manual" {
            payout_ops::finish_paid(
                &mut tx,
                claims.tenant_id,
                payout,
                body.reference.as_deref(),
                claims.sub,
            )
            .await?;
        } else {
            let key = sqlx::query_scalar::<_, String>(
                "SELECT idempotency_key FROM doctor_payouts WHERE id = $1",
            )
            .bind(payout)
            .fetch_one(&mut *tx)
            .await?;
            queued.push(Queued {
                payout,
                request: PayoutRequest {
                    idempotency_key: key,
                    ..request
                },
            });
        }
    }
    tx.commit().await?;
    if let Some(p) = provider {
        send_all(&state, &claims, p.as_ref(), &queued).await?;
    }
    Ok(Json(json!({ "run_id": run_id, "warnings": warnings })))
}

fn request_for(
    s: &Statement,
    mode: &str,
    dest: Option<&Destination>,
    provider: &str,
) -> Result<PayoutRequest, AppError> {
    let req = PayoutRequest {
        idempotency_key: String::new(),
        statement_id: s.id,
        amount: s.net_payable.unwrap_or_default(),
        mode: mode.to_owned(),
        payee_name: dest
            .and_then(|d| d.bank_account_name.clone())
            .unwrap_or_else(|| payout_ops::payee(s)),
        account_number: dest.and_then(|d| d.bank_account_number.clone()),
        ifsc: dest.and_then(|d| d.bank_ifsc.clone()),
        vpa: dest.and_then(|d| d.upi_vpa.clone()),
    };
    let complete = match (provider, mode) {
        ("manual", _) => true,
        (_, "upi") => req.vpa.is_some(),
        _ => req.account_number.is_some() && req.ifsc.is_some(),
    };
    if !complete {
        return Err(AppError::BadRequest(format!(
            "{} has no {} details on their agreement",
            payout_ops::payee(s),
            if mode == "upi" {
                "UPI ID"
            } else {
                "bank account"
            }
        )));
    }
    Ok(req)
}

/// Send each queued payout to RazorpayX outside the database transaction,
/// then record each answer in its own.
async fn send_all(
    state: &AppState,
    claims: &Claims,
    provider: &dyn PayoutProvider,
    queued: &[Queued],
) -> Result<(), AppError> {
    for q in queued {
        let sent = provider.send(&q.request).await;
        let mut tx = begin(state, claims).await?;
        match sent {
            Sent::Paid { provider_ref, utr } => {
                set(&mut tx, q.payout, "processing", Some(&provider_ref), None).await?;
                payout_ops::finish_paid(
                    &mut tx,
                    claims.tenant_id,
                    q.payout,
                    utr.as_deref(),
                    claims.sub,
                )
                .await?;
            }
            Sent::Processing { provider_ref } => {
                set(&mut tx, q.payout, "processing", Some(&provider_ref), None).await?
            }
            Sent::Refused(why) => set(&mut tx, q.payout, "failed", None, Some(&why)).await?,
            Sent::Unreachable(why) => {
                // Unknown whether it paid: leave it processing for a person to
                // check RazorpayX and mark it paid or failed.
                sqlx::query(
                    "UPDATE doctor_payouts SET status = 'processing', warning = $2 WHERE id = $1",
                )
                .bind(q.payout)
                .bind(format!(
                    "{why}. Check RazorpayX before marking this paid or failed."
                ))
                .execute(&mut *tx)
                .await?;
            }
            // A bank file waits for finance to upload it and enter the UTRs.
            Sent::Pending => {}
        }
        tx.commit().await?;
    }
    Ok(())
}

async fn set(
    tx: &mut Tx<'_>,
    id: Uuid,
    status: &str,
    provider_ref: Option<&str>,
    why: Option<&str>,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE doctor_payouts SET status = $2, provider_ref = COALESCE($3, provider_ref), failure_reason = $4 WHERE id = $1",
    )
    .bind(id)
    .bind(status)
    .bind(provider_ref)
    .bind(why)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct PaidInput {
    pub utr: Option<String>,
}

/// POST /api/doctor-payouts/payouts/{id}/paid — the bank confirmed it.
pub async fn mark_paid(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<PaidInput>,
) -> Result<Json<Uuid>, AppError> {
    require_permission(&claims, payouts::EXECUTE)?;
    let utr = body.utr.as_deref().map(str::trim).filter(|u| !u.is_empty());
    let mut tx = begin(&state, &claims).await?;
    let mode = sqlx::query_scalar::<_, String>(
        "SELECT mode FROM doctor_payouts WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;
    if mode != "cash" && utr.is_none() {
        return Err(AppError::BadRequest(
            "Enter the bank's UTR for this transfer".to_owned(),
        ));
    }
    payout_ops::finish_paid(&mut tx, claims.tenant_id, id, utr, claims.sub).await?;
    tx.commit().await?;
    Ok(Json(id))
}

#[derive(Debug, Deserialize)]
pub struct FailedInput {
    pub reason: String,
}

/// POST /api/doctor-payouts/payouts/{id}/failed — the statement stays
/// approved and can go in the next run.
pub async fn mark_failed(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<FailedInput>,
) -> Result<Json<Uuid>, AppError> {
    require_permission(&claims, payouts::EXECUTE)?;
    let reason = body.reason.trim();
    if reason.is_empty() {
        return Err(AppError::BadRequest("Say why the payout failed".to_owned()));
    }
    let mut tx = begin(&state, &claims).await?;
    let done = sqlx::query(
        "UPDATE doctor_payouts SET status = 'failed', failure_reason = $2 \
          WHERE id = $1 AND status IN ('pending', 'processing') AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(reason)
    .execute(&mut *tx)
    .await?;
    if done.rows_affected() == 0 {
        return Err(AppError::Conflict(
            "This payout is not waiting to be paid".to_owned(),
        ));
    }
    tx.commit().await?;
    Ok(Json(id))
}

fn csv_field(v: &str) -> String {
    if v.contains([',', '"', '\n']) {
        format!("\"{}\"", v.replace('"', "\"\""))
    } else {
        v.to_owned()
    }
}

/// GET /api/doctor-payouts/runs/{run_id}/bank-file — the upload file for the
/// run's pending bank and UPI payouts.
pub async fn bank_file(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(run_id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, payouts::EXECUTE)?;
    let mut tx = begin(&state, &claims).await?;
    let rows = sqlx::query_as::<_, (String, Option<String>, Option<String>, Option<String>, Decimal, Uuid)>(
        "SELECT COALESCE(a.bank_account_name, u.full_name, ''), a.bank_account_number, a.bank_ifsc, a.upi_vpa, \
                o.amount, o.statement_id \
           FROM doctor_payouts o JOIN incentive_calculations s ON s.id = o.statement_id \
           LEFT JOIN doctor_incentive_assignments a ON a.id = s.agreement_id \
           LEFT JOIN users u ON u.id = s.doctor_id \
          WHERE o.tenant_id = $1 AND o.run_id = $2 AND o.provider = 'bank_file' AND o.status = 'pending' \
            AND o.deleted_at IS NULL ORDER BY u.full_name LIMIT 500",
    )
    .bind(claims.tenant_id)
    .bind(run_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    let mut csv = String::from("beneficiary_name,account_number,ifsc,upi_id,amount,reference\n");
    for (name, acct, ifsc, vpa, amount, statement) in &rows {
        let fields = [
            csv_field(name),
            csv_field(acct.as_deref().unwrap_or_default()),
            csv_field(ifsc.as_deref().unwrap_or_default()),
            csv_field(vpa.as_deref().unwrap_or_default()),
            amount.to_string(),
            statement.simple().to_string(),
        ];
        csv.push_str(&fields.join(","));
        csv.push('\n');
    }
    Ok(Json(
        json!({ "filename": format!("doctor-payouts-{}.csv", run_id.simple()), "rows": rows.len(), "csv": csv }),
    ))
}
