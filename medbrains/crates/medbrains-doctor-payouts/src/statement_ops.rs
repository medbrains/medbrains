//! Statement mechanics shared by the monthly, same-day and referral paths:
//! prepare, re-issue a version, approve with TDS.

use chrono::{DateTime, Days, NaiveDate, Utc};
use medbrains_server_core::error::AppError;
use rust_decimal::Decimal;
use serde::Serialize;
use uuid::Uuid;

use crate::agreements::{self, Agreement};
use crate::engine::{self, TdsInput};
use crate::{Tx, accrual, session, settings};

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Statement {
    pub id: Uuid,
    pub kind: String,
    pub status: String,
    pub version: i32,
    pub supersedes_id: Option<Uuid>,
    pub doctor_id: Option<Uuid>,
    pub doctor_name: Option<String>,
    pub referral_doctor_id: Option<Uuid>,
    pub partner_name: Option<String>,
    pub agreement_id: Option<Uuid>,
    pub period_start: NaiveDate,
    pub period_end: NaiveDate,
    pub incentive_amount: Option<Decimal>,
    pub adjustments_total: Decimal,
    pub session_minimum_total: Decimal,
    pub tds_section: Option<String>,
    pub tds_rate: Option<Decimal>,
    pub tds_base: Decimal,
    pub tds_amount: Decimal,
    pub net_payable: Option<Decimal>,
    pub payee_pan: Option<String>,
    pub financial_year: Option<String>,
    pub prepared_by: Option<Uuid>,
    pub prepared_by_name: Option<String>,
    pub approved_by: Option<Uuid>,
    pub approved_at: Option<DateTime<Utc>>,
    pub disputed_reason: Option<String>,
    pub paid_at: Option<DateTime<Utc>>,
    pub payment_reference: Option<String>,
    pub created_at: DateTime<Utc>,
}

pub const STATEMENT_SELECT: &str = "SELECT s.id, s.kind, s.status, s.version, s.supersedes_id, \
     s.doctor_id, u.full_name AS doctor_name, s.referral_doctor_id, r.name AS partner_name, \
     s.agreement_id, s.period_start, s.period_end, s.incentive_amount, s.adjustments_total, \
     s.session_minimum_total, s.tds_section, s.tds_rate, s.tds_base, s.tds_amount, s.net_payable, \
     s.payee_pan, s.financial_year, s.prepared_by, pu.full_name AS prepared_by_name, s.approved_by, \
     s.approved_at, s.disputed_reason, s.paid_at, s.payment_reference, s.created_at \
     FROM incentive_calculations s \
     LEFT JOIN users u ON u.id = s.doctor_id \
     LEFT JOIN lab_referral_doctors r ON r.id = s.referral_doctor_id \
     LEFT JOIN users pu ON pu.id = s.prepared_by";

pub async fn fetch(tx: &mut Tx<'_>, id: Uuid) -> Result<Statement, AppError> {
    let sql = format!("{STATEMENT_SELECT} WHERE s.id = $1 AND s.deleted_at IS NULL");
    Ok(sqlx::query_as::<_, Statement>(&sql)
        .bind(id)
        .fetch_one(&mut **tx)
        .await?)
}

/// Lock a statement for a state change.
pub async fn lock(tx: &mut Tx<'_>, id: Uuid) -> Result<Statement, AppError> {
    sqlx::query(
        "SELECT id FROM incentive_calculations WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
    )
    .bind(id)
    .fetch_one(&mut **tx)
    .await?;
    fetch(tx, id).await
}

/// Totals follow from the lines; TDS is kept as last assessed.
pub async fn recompute(tx: &mut Tx<'_>, id: Uuid) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE incentive_calculations s SET \
            incentive_amount = t.total, adjustments_total = t.adj, session_minimum_total = t.sess, \
            deductions = s.tds_amount, net_payable = t.total - s.tds_amount \
           FROM (SELECT COALESCE(SUM(a.amount), 0) AS total, \
                        COALESCE(SUM(a.amount) FILTER (WHERE a.event = 'adjustment'), 0) AS adj, \
                        COALESCE(SUM(a.amount) FILTER (WHERE a.event = 'session_minimum'), 0) AS sess \
                   FROM doctor_payout_statement_lines l \
                   JOIN doctor_payout_accruals a ON a.id = l.accrual_id \
                  WHERE l.statement_id = $1) t \
          WHERE s.id = $1",
    )
    .bind(id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// What to prepare.
#[derive(Debug, Clone, Copy)]
pub struct Prepare {
    pub tenant_id: Uuid,
    pub doctor_id: Uuid,
    pub from: NaiveDate,
    pub to: NaiveDate,
    /// `monthly` carries forward every earlier open row; `same_day` takes
    /// only the day's.
    pub same_day: bool,
    pub actor: Uuid,
}

/// How far back a statement looks for bills still being paid or settled.
const LOOKBACK_DAYS: u64 = 180;

/// Bring every bill this doctor earned on between `since` and `to` up to date.
pub async fn sync_doctor(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    doctor: Uuid,
    since: NaiveDate,
    to: NaiveDate,
) -> Result<(), AppError> {
    // ponytail: one sync per bill, bounded at 2000 bills; batch the engine across bills if months get bigger.
    let invoices = sqlx::query_scalar::<_, Uuid>(
        "SELECT DISTINCT ii.invoice_id FROM invoice_items ii \
           LEFT JOIN ot_bookings b ON ii.source = 'ot' AND b.id = ii.source_id \
          WHERE ii.tenant_id = $1 AND ii.deleted_at IS NULL \
            AND ii.created_at::date BETWEEN $3 AND $4 \
            AND (ii.performing_doctor_id = $2 OR b.anesthetist_id = $2 OR b.assistant_surgeons ? $2::text \
                 OR (ii.performing_doctor_id IS NULL AND ii.source IN ('lab', 'radiology', 'procedure') \
                     AND invoice_item_performer(ii.source::text, ii.source_id) = $2)) \
          LIMIT 2000",
    )
    .bind(tenant_id)
    .bind(doctor)
    .bind(since)
    .bind(to)
    .fetch_all(&mut **tx)
    .await?;
    for invoice in invoices {
        accrual::sync_invoice(tx, tenant_id, invoice).await?;
    }
    Ok(())
}

async fn apply_minimums(
    tx: &mut Tx<'_>,
    p: &Prepare,
    agreement: &Agreement,
) -> Result<(), AppError> {
    if agreement.session_minimum.is_none() {
        return Ok(());
    }
    let days = sqlx::query_scalar::<_, NaiveDate>(
        "SELECT DISTINCT service_date FROM doctor_payout_accruals \
          WHERE tenant_id = $1 AND doctor_id = $2 AND service_date BETWEEN $3 AND $4 \
            AND event IN ('billed', 'collected', 'realised') AND deleted_at IS NULL LIMIT 366",
    )
    .bind(p.tenant_id)
    .bind(p.doctor_id)
    .bind(p.from)
    .bind(p.to)
    .fetch_all(&mut **tx)
    .await?;
    for day in days {
        session::apply_session_minimum(tx, p.tenant_id, p.doctor_id, day).await?;
    }
    Ok(())
}

/// Open ledger rows: on no live statement version.
pub const OPEN_ROW: &str = "NOT EXISTS (SELECT 1 FROM doctor_payout_statement_lines l \
     JOIN incentive_calculations s ON s.id = l.statement_id \
     WHERE l.accrual_id = a.id AND s.status NOT IN ('superseded', 'cancelled'))";

/// Gather a doctor's open earnings into a draft statement.
pub async fn prepare(tx: &mut Tx<'_>, p: &Prepare) -> Result<Uuid, AppError> {
    let Some(agreement) = agreements::covering(tx, p.doctor_id, p.to).await? else {
        return Err(AppError::Conflict(
            "This doctor has no payout agreement covering the period".to_owned(),
        ));
    };
    if agreement.engagement_type == "salaried" {
        return Err(AppError::BadRequest(
            "A salaried doctor's incentive is salary (s.192) and goes through payroll, not a professional-fee payout".to_owned(),
        ));
    }
    let since = if p.same_day {
        p.from
    } else {
        p.from
            .checked_sub_days(Days::new(LOOKBACK_DAYS))
            .unwrap_or(p.from)
    };
    sync_doctor(tx, p.tenant_id, p.doctor_id, since, p.to).await?;
    apply_minimums(tx, p, &agreement).await?;
    let sql = format!(
        "SELECT a.id, a.amount FROM doctor_payout_accruals a \
          WHERE a.tenant_id = $1 AND a.doctor_id = $2 AND a.deleted_at IS NULL \
            AND a.service_date <= $3 AND (NOT $4 OR a.service_date >= $5) AND {OPEN_ROW} \
          LIMIT 20000"
    );
    let open = sqlx::query_as::<_, (Uuid, Decimal)>(&sql)
        .bind(p.tenant_id)
        .bind(p.doctor_id)
        .bind(p.to)
        .bind(p.same_day)
        .bind(p.from)
        .fetch_all(&mut **tx)
        .await?;
    let total: Decimal = open.iter().map(|r| r.1).sum();
    if open.is_empty() {
        return Err(AppError::Conflict(
            "Nothing has been earned to put on a statement for this period".to_owned(),
        ));
    }
    if total <= Decimal::ZERO {
        return Err(AppError::Conflict(format!(
            "Nothing is payable: the open balance is Rs {total}, which carries forward to the next statement"
        )));
    }
    let id = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO incentive_calculations (tenant_id, doctor_id, plan_id, agreement_id, period_start, \
         period_end, kind, status, prepared_by, payee_pan, financial_year) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8, $9, $10) RETURNING id",
    )
    .bind(p.tenant_id)
    .bind(p.doctor_id)
    .bind(agreement.plan_id)
    .bind(agreement.id)
    .bind(p.from)
    .bind(p.to)
    .bind(if p.same_day { "same_day" } else { "monthly" })
    .bind(p.actor)
    .bind(agreement.pan.as_deref())
    .bind(engine::financial_year(p.to))
    .fetch_one(&mut **tx)
    .await?;
    let ids: Vec<Uuid> = open.iter().map(|r| r.0).collect();
    attach(tx, p.tenant_id, id, &ids).await?;
    recompute(tx, id).await?;
    Ok(id)
}

pub async fn attach(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    statement: Uuid,
    accruals: &[Uuid],
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO doctor_payout_statement_lines (tenant_id, statement_id, accrual_id) \
         SELECT $1, $2, x FROM UNNEST($3::uuid[]) x",
    )
    .bind(tenant_id)
    .bind(statement)
    .bind(accruals)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Issue the next version of a statement: same lines plus `extra`, prepared
/// by `actor`; the old version is superseded, never edited.
pub async fn reissue(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    old: &Statement,
    extra: Option<Uuid>,
    actor: Uuid,
) -> Result<Uuid, AppError> {
    let id = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO incentive_calculations (tenant_id, doctor_id, referral_doctor_id, plan_id, agreement_id, \
         period_start, period_end, kind, status, version, supersedes_id, prepared_by, payee_pan, financial_year) \
         SELECT tenant_id, doctor_id, referral_doctor_id, plan_id, agreement_id, period_start, period_end, kind, \
                'draft', version + 1, id, $2, payee_pan, financial_year \
           FROM incentive_calculations WHERE id = $1 RETURNING id",
    )
    .bind(old.id)
    .bind(actor)
    .fetch_one(&mut **tx)
    .await?;
    sqlx::query(
        "INSERT INTO doctor_payout_statement_lines (tenant_id, statement_id, accrual_id) \
         SELECT tenant_id, $2, accrual_id FROM doctor_payout_statement_lines WHERE statement_id = $1",
    )
    .bind(old.id)
    .bind(id)
    .execute(&mut **tx)
    .await?;
    sqlx::query("UPDATE incentive_calculations SET status = 'superseded' WHERE id = $1")
        .bind(old.id)
        .execute(&mut **tx)
        .await?;
    if let Some(row) = extra {
        attach(tx, tenant_id, id, &[row]).await?;
    }
    recompute(tx, id).await?;
    Ok(id)
}

/// TDS on a statement, from the payee's aggregate this financial year:
/// per PAN when there is one, per payee otherwise; professional fees and
/// referral commission are separate categories with their own thresholds.
async fn assess_tds(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    s: &Statement,
) -> Result<(String, engine::Tds), AppError> {
    let cfg = settings::load(tx, tenant_id).await?;
    let referral = s.kind == "referral";
    let section = if referral {
        cfg.referral_tds_section_code.clone()
    } else {
        let own = match s.agreement_id {
            Some(id) => {
                sqlx::query_scalar::<_, Option<String>>(
                    "SELECT tds_section_code FROM doctor_incentive_assignments WHERE id = $1",
                )
                .bind(id)
                .fetch_one(&mut **tx)
                .await?
            }
            None => None,
        };
        own.unwrap_or_else(|| cfg.tds_section_code.clone())
    };
    let (paid_before, taxed_before) = sqlx::query_as::<_, (Decimal, Decimal)>(
        "SELECT COALESCE(SUM(incentive_amount), 0), COALESCE(SUM(tds_base), 0) \
           FROM incentive_calculations \
          WHERE tenant_id = $1 AND financial_year = $2 AND status IN ('approved', 'paid') \
            AND id <> $3 AND deleted_at IS NULL AND ((kind = 'referral') = $4) \
            AND CASE WHEN $5::text IS NOT NULL THEN payee_pan = $5 \
                     ELSE payee_pan IS NULL AND doctor_id IS NOT DISTINCT FROM $6 \
                          AND referral_doctor_id IS NOT DISTINCT FROM $7 END",
    )
    .bind(tenant_id)
    .bind(s.financial_year.as_deref().unwrap_or_default())
    .bind(s.id)
    .bind(referral)
    .bind(s.payee_pan.as_deref())
    .bind(s.doctor_id)
    .bind(s.referral_doctor_id)
    .fetch_one(&mut **tx)
    .await?;
    let tds = engine::compute_tds(&TdsInput {
        amount: s.incentive_amount.unwrap_or_default(),
        paid_before,
        taxed_before,
        has_pan: s.payee_pan.is_some(),
        rate: if referral {
            cfg.referral_tds_rate
        } else {
            cfg.tds_rate
        },
        no_pan_rate: cfg.tds_no_pan_rate,
        threshold: if referral {
            cfg.referral_tds_threshold
        } else {
            cfg.tds_threshold
        },
    });
    Ok((section, tds))
}

/// Approve a draft. Maker-checker: the preparer may not approve, except a
/// same-day settlement, which is the engine's arithmetic with nothing typed in.
pub async fn approve(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    id: Uuid,
    actor: Uuid,
) -> Result<Statement, AppError> {
    let s = lock(tx, id).await?;
    if s.status != "draft" {
        return Err(AppError::Conflict(format!(
            "Only a draft can be approved; this statement is {}",
            s.status
        )));
    }
    if s.kind != "same_day" && s.prepared_by == Some(actor) {
        return Err(AppError::ForbiddenReason(
            "You prepared this statement, so someone else must approve it".to_owned(),
        ));
    }
    let (section, tds) = assess_tds(tx, tenant_id, &s).await?;
    sqlx::query(
        "UPDATE incentive_calculations SET status = 'approved', approved_by = $2, approved_at = now(), \
         tds_section = $3, tds_rate = $4, tds_base = $5, tds_amount = $6 WHERE id = $1",
    )
    .bind(id)
    .bind(actor)
    .bind(&section)
    .bind(tds.rate)
    .bind(tds.base)
    .bind(tds.amount)
    .execute(&mut **tx)
    .await?;
    recompute(tx, id).await?;
    fetch(tx, id).await
}
