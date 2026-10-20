//! Paying a statement: record the attempt, finish it with the TDS row, and
//! the s.40A(3) cash check. Shared by the payout run and day settlement.

use chrono::Utc;
use medbrains_server_core::error::AppError;
use rust_decimal::Decimal;
use uuid::Uuid;

use crate::statement_ops::{self, Statement};
use crate::{Tx, engine, settings};

/// What TDS returns use when a deductee has no PAN.
const NO_PAN: &str = "PANNOTAVBL";

/// Cash already paid to this doctor today (India time).
pub async fn cash_paid_today(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    doctor: Uuid,
) -> Result<Decimal, AppError> {
    Ok(sqlx::query_scalar::<_, Decimal>(
        "SELECT COALESCE(SUM(o.amount), 0) FROM doctor_payouts o \
           JOIN incentive_calculations s ON s.id = o.statement_id \
          WHERE o.tenant_id = $1 AND s.doctor_id = $2 AND o.mode = 'cash' AND o.status = 'paid' \
            AND o.deleted_at IS NULL \
            AND (o.paid_at AT TIME ZONE 'Asia/Kolkata')::date = (now() AT TIME ZONE 'Asia/Kolkata')::date",
    )
    .bind(tenant_id)
    .bind(doctor)
    .fetch_one(&mut **tx)
    .await?)
}

/// The warning for paying `amount` more in cash, if any. Never a refusal.
pub async fn cash_check(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    s: &Statement,
    amount: Decimal,
) -> Result<Option<String>, AppError> {
    let Some(doctor) = s.doctor_id else {
        return Ok(None);
    };
    let limit = settings::load(tx, tenant_id).await?.cash_daily_warn_limit;
    let today = cash_paid_today(tx, tenant_id, doctor).await?;
    Ok(engine::cash_warning(today, amount, limit))
}

/// A payout attempt to record.
#[derive(Debug, Clone, Copy)]
pub struct Attempt<'a> {
    pub statement: &'a Statement,
    pub run_id: Uuid,
    pub mode: &'a str,
    pub provider: &'a str,
    pub warning: Option<&'a str>,
    pub actor: Uuid,
}

/// Record a payout attempt for an approved statement.
pub async fn record(tx: &mut Tx<'_>, tenant_id: Uuid, a: &Attempt<'_>) -> Result<Uuid, AppError> {
    let s = a.statement;
    if s.status != "approved" {
        return Err(AppError::Conflict(format!(
            "Statement for {} is {}, not approved",
            payee(s),
            s.status
        )));
    }
    let amount = s.net_payable.unwrap_or_default();
    if amount <= Decimal::ZERO {
        return Err(AppError::Conflict(format!(
            "Nothing is payable on the statement for {}",
            payee(s)
        )));
    }
    let attempt: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM doctor_payouts WHERE statement_id = $1")
            .bind(s.id)
            .fetch_one(&mut **tx)
            .await?;
    Ok(sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO doctor_payouts (tenant_id, statement_id, run_id, mode, provider, amount, \
         idempotency_key, warning, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id",
    )
    .bind(tenant_id)
    .bind(s.id)
    .bind(a.run_id)
    .bind(a.mode)
    .bind(a.provider)
    .bind(amount)
    .bind(format!("dp-{}-{}", s.id.simple(), attempt + 1))
    .bind(a.warning)
    .bind(a.actor)
    .fetch_one(&mut **tx)
    .await?)
}

pub fn payee(s: &Statement) -> String {
    s.doctor_name
        .clone()
        .or_else(|| s.partner_name.clone())
        .unwrap_or_default()
}

/// Finish a payout as paid: the statement is paid and its TDS goes into the
/// TDS register (`tds_deductions`), tracked per PAN — PANNOTAVBL without one.
pub async fn finish_paid(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    payout: Uuid,
    utr: Option<&str>,
    actor: Uuid,
) -> Result<(), AppError> {
    let statement_id = sqlx::query_scalar::<_, Uuid>(
        "UPDATE doctor_payouts SET status = 'paid', utr = COALESCE($2, utr), paid_by = $3, paid_at = now() \
          WHERE id = $1 AND status IN ('pending', 'processing') AND deleted_at IS NULL RETURNING statement_id",
    )
    .bind(payout)
    .bind(utr)
    .bind(actor)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(|| AppError::Conflict("This payout is not waiting to be paid".to_owned()))?;
    let s = statement_ops::lock(tx, statement_id).await?;
    let tds_row = if s.tds_amount > Decimal::ZERO {
        let today = Utc::now().date_naive();
        Some(
            sqlx::query_scalar::<_, Uuid>(
                "INSERT INTO tds_deductions (tenant_id, deductee_name, deductee_pan, tds_section, tds_rate, \
                 base_amount, tds_amount, deducted_date, financial_year, quarter, created_by) \
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id",
            )
            .bind(tenant_id)
            .bind(payee(&s))
            .bind(s.payee_pan.as_deref().unwrap_or(NO_PAN))
            .bind(s.tds_section.as_deref().unwrap_or_default())
            .bind(s.tds_rate.unwrap_or_default())
            .bind(s.tds_base)
            .bind(s.tds_amount)
            .bind(today)
            .bind(engine::financial_year(today))
            .bind(engine::tds_quarter(today))
            .bind(actor)
            .fetch_one(&mut **tx)
            .await?,
        )
    } else {
        None
    };
    sqlx::query(
        "UPDATE incentive_calculations SET status = 'paid', paid_at = now(), \
         payment_reference = COALESCE($2, payment_reference), tds_deduction_id = $3 WHERE id = $1",
    )
    .bind(statement_id)
    .bind(utr)
    .bind(tds_row)
    .execute(&mut **tx)
    .await?;
    sqlx::query("UPDATE lab_referral_payouts SET status = 'paid', paid_at = now(), paid_by = $2, payment_reference = $3 WHERE statement_id = $1")
        .bind(statement_id)
        .bind(actor)
        .bind(utr)
        .execute(&mut **tx)
        .await?;
    Ok(())
}
