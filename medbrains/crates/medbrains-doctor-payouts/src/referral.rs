//! Referral commission, kept because the owner decided so — but off until a
//! hospital switches it on with a recorded acknowledgement of IMC Reg 6.4 /
//! NMC and of non-deductibility (Apex Laboratories, SC 2022). Organisation
//! partners by default; individual doctors need their own switch. Every
//! payout goes through the same statement, approval, TDS and payout path,
//! and appears in the compliance report.

use axum::{Extension, Json, extract::State};
use chrono::NaiveDate;
use medbrains_core::permissions::doctor_payouts::statements;
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};
use rust_decimal::Decimal;
use serde::Deserialize;
use uuid::Uuid;

use crate::statement_ops;
use crate::statements::{StatementDetail, detail};
use crate::{Tx, begin, engine, settings};

#[derive(Debug, Deserialize)]
pub struct ReferralInput {
    pub referral_doctor_id: Uuid,
    pub period_start: NaiveDate,
    pub period_end: NaiveDate,
}

#[derive(Debug, sqlx::FromRow)]
struct Partner {
    name: String,
    partner_kind: String,
    commission_pct: Option<Decimal>,
    pan: Option<String>,
}

/// Who and what a referral statement is for.
#[derive(Debug, Clone, Copy)]
pub struct ReferralAsk {
    pub tenant_id: Uuid,
    pub partner: Uuid,
    pub from: NaiveDate,
    pub to: NaiveDate,
    pub actor: Uuid,
}

async fn refuse_unless_allowed(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    partner: &Partner,
) -> Result<(), AppError> {
    let cfg = settings::load(tx, tenant_id).await?;
    if !cfg.referral_enabled {
        return Err(AppError::ForbiddenReason(
            "Referral payouts are switched off. An administrator must switch them on under Doctor payouts, \
             Policy, and accept the acknowledgement"
                .to_owned(),
        ));
    }
    if partner.partner_kind == "individual" && !cfg.referral_individuals_enabled {
        return Err(AppError::ForbiddenReason(format!(
            "{} is an individual doctor. Referral payouts to individuals need their own switch and acknowledgement",
            partner.name
        )));
    }
    Ok(())
}

/// Count the partner's referred lab orders in the period, price the
/// commission, and put it on a draft statement. Returns the statement id.
pub async fn create_referral_statement(tx: &mut Tx<'_>, a: &ReferralAsk) -> Result<Uuid, AppError> {
    let partner = sqlx::query_as::<_, Partner>(
        "SELECT name, partner_kind, commission_pct, pan FROM lab_referral_doctors \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL AND is_active",
    )
    .bind(a.partner)
    .bind(a.tenant_id)
    .fetch_one(&mut **tx)
    .await?;
    refuse_unless_allowed(tx, a.tenant_id, &partner).await?;
    let clash = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM incentive_calculations WHERE tenant_id = $1 AND referral_doctor_id = $2 \
          AND deleted_at IS NULL AND status NOT IN ('superseded', 'cancelled') \
          AND period_start <= $4 AND period_end >= $3)",
    )
    .bind(a.tenant_id)
    .bind(a.partner)
    .bind(a.from)
    .bind(a.to)
    .fetch_one(&mut **tx)
    .await?;
    if clash {
        return Err(AppError::Conflict(
            "This partner already has a statement for part of this period".to_owned(),
        ));
    }
    let (orders, revenue) = sqlx::query_as::<_, (i64, Decimal)>(
        "SELECT COUNT(DISTINCT o.id), COALESCE(SUM(ii.unit_price * ii.quantity + COALESCE(rv.reversed, 0)), 0) \
           FROM lab_orders o \
           JOIN invoice_items ii ON ii.source = 'lab' AND ii.source_id = o.id AND ii.reversal_of_id IS NULL \
                                AND NOT ii.is_reversal AND ii.deleted_at IS NULL \
           JOIN invoices i ON i.id = ii.invoice_id AND i.status IN ('issued', 'partially_paid', 'paid') \
           LEFT JOIN LATERAL (SELECT SUM(r.unit_price * r.quantity) AS reversed FROM invoice_items r \
                               WHERE r.reversal_of_id = ii.id AND r.deleted_at IS NULL) rv ON true \
          WHERE o.tenant_id = $1 AND o.referral_doctor_id = $2 AND o.created_at::date BETWEEN $3 AND $4",
    )
    .bind(a.tenant_id)
    .bind(a.partner)
    .bind(a.from)
    .bind(a.to)
    .fetch_one(&mut **tx)
    .await?;
    let pct = partner.commission_pct.unwrap_or_default();
    let commission = engine::money(revenue * pct / Decimal::ONE_HUNDRED);
    if commission <= Decimal::ZERO {
        return Err(AppError::Conflict(
            "No billed referrals in this period, so nothing is payable".to_owned(),
        ));
    }
    let row = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO doctor_payout_accruals (tenant_id, referral_doctor_id, event, role, service_date, \
         line_amount, base_amount, share_amount, amount, reason, created_by) \
         VALUES ($1, $2, 'referral', 'referrer', $3, $4, $4, $5, $5, $6, $7) RETURNING id",
    )
    .bind(a.tenant_id)
    .bind(a.partner)
    .bind(a.to)
    .bind(revenue)
    .bind(commission)
    .bind(format!("{orders} referred lab orders at {pct}%"))
    .bind(a.actor)
    .fetch_one(&mut **tx)
    .await?;
    let id = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO incentive_calculations (tenant_id, referral_doctor_id, period_start, period_end, kind, \
         status, prepared_by, payee_pan, financial_year) \
         VALUES ($1, $2, $3, $4, 'referral', 'draft', $5, $6, $7) RETURNING id",
    )
    .bind(a.tenant_id)
    .bind(a.partner)
    .bind(a.from)
    .bind(a.to)
    .bind(a.actor)
    .bind(partner.pan.as_deref())
    .bind(engine::financial_year(a.to))
    .fetch_one(&mut **tx)
    .await?;
    statement_ops::attach(tx, a.tenant_id, id, &[row]).await?;
    statement_ops::recompute(tx, id).await?;
    sqlx::query(
        "INSERT INTO lab_referral_payouts (tenant_id, referral_doctor_id, period_start, period_end, \
         order_count, total_revenue, commission_amount, statement_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    )
    .bind(a.tenant_id)
    .bind(a.partner)
    .bind(a.from)
    .bind(a.to)
    .bind(i32::try_from(orders).unwrap_or(i32::MAX))
    .bind(revenue)
    .bind(commission)
    .bind(id)
    .execute(&mut **tx)
    .await?;
    Ok(id)
}

/// POST /api/doctor-payouts/referral-statements
pub async fn create_referral_statement_handler(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ReferralInput>,
) -> Result<Json<StatementDetail>, AppError> {
    require_permission(&claims, statements::PREPARE)?;
    if body.period_end < body.period_start {
        return Err(AppError::BadRequest(
            "The period ends before it starts".to_owned(),
        ));
    }
    let mut tx = begin(&state, &claims).await?;
    let ask = ReferralAsk {
        tenant_id: claims.tenant_id,
        partner: body.referral_doctor_id,
        from: body.period_start,
        to: body.period_end,
        actor: claims.sub,
    };
    let id = create_referral_statement(&mut tx, &ask).await?;
    let out = detail(&mut tx, id).await?;
    tx.commit().await?;
    Ok(Json(out))
}
