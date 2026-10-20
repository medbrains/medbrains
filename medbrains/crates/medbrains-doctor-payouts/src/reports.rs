//! Reports: doctor-wise revenue against earnings and payouts, the TDS
//! register for doctor payouts, and the referral compliance report.

use axum::{
    Extension, Json,
    extract::{Query, State},
};
use chrono::{DateTime, NaiveDate, Utc};
use medbrains_core::permissions::doctor_payouts::reports;
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::{begin, settings};

#[derive(Debug, Deserialize)]
pub struct PeriodQuery {
    pub from: NaiveDate,
    pub to: NaiveDate,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DoctorSummary {
    pub doctor_id: Uuid,
    pub doctor_name: String,
    /// Billed value of the services the doctor performed (before tax).
    pub revenue: Decimal,
    /// Earned in the ledger for services in the period.
    pub earned: Decimal,
    pub paid: Decimal,
    pub tds: Decimal,
    pub awaiting_payment: Decimal,
}

/// GET /api/doctor-payouts/reports/summary
pub async fn summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<PeriodQuery>,
) -> Result<Json<Vec<DoctorSummary>>, AppError> {
    require_permission(&claims, reports::VIEW)?;
    let mut tx = begin(&state, &claims).await?;
    let rows = sqlx::query_as::<_, DoctorSummary>(
        "WITH acc AS (SELECT doctor_id, SUM(amount) AS earned FROM doctor_payout_accruals \
                       WHERE tenant_id = $1 AND doctor_id IS NOT NULL AND deleted_at IS NULL \
                         AND service_date BETWEEN $2 AND $3 GROUP BY doctor_id), \
              rev AS (SELECT performing_doctor_id AS doctor_id, SUM(unit_price * quantity) AS revenue \
                        FROM invoice_items WHERE tenant_id = $1 AND performing_doctor_id IS NOT NULL \
                         AND deleted_at IS NULL AND created_at::date BETWEEN $2 AND $3 GROUP BY 1), \
              st AS (SELECT doctor_id, \
                            SUM(net_payable) FILTER (WHERE status = 'paid') AS paid, \
                            SUM(tds_amount) FILTER (WHERE status = 'paid') AS tds, \
                            SUM(net_payable) FILTER (WHERE status = 'approved') AS awaiting \
                       FROM incentive_calculations WHERE tenant_id = $1 AND doctor_id IS NOT NULL \
                        AND deleted_at IS NULL AND period_end BETWEEN $2 AND $3 GROUP BY doctor_id) \
         SELECT u.id AS doctor_id, u.full_name AS doctor_name, \
                COALESCE(rev.revenue, 0)::numeric(14,2) AS revenue, COALESCE(acc.earned, 0) AS earned, \
                COALESCE(st.paid, 0) AS paid, COALESCE(st.tds, 0) AS tds, \
                COALESCE(st.awaiting, 0) AS awaiting_payment \
           FROM users u \
           LEFT JOIN acc ON acc.doctor_id = u.id LEFT JOIN rev ON rev.doctor_id = u.id \
           LEFT JOIN st ON st.doctor_id = u.id \
          WHERE u.tenant_id = $1 AND (acc.doctor_id IS NOT NULL OR rev.doctor_id IS NOT NULL OR st.doctor_id IS NOT NULL) \
          ORDER BY u.full_name LIMIT 1000",
    )
    .bind(claims.tenant_id)
    .bind(q.from)
    .bind(q.to)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct YearQuery {
    /// e.g. `2026-27`.
    pub financial_year: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TdsRow {
    pub statement_id: Uuid,
    pub kind: String,
    pub payee_name: Option<String>,
    pub payee_pan: Option<String>,
    pub tds_section: Option<String>,
    pub tds_rate: Option<Decimal>,
    pub gross: Option<Decimal>,
    pub tds_base: Decimal,
    pub tds_amount: Decimal,
    pub paid_at: Option<DateTime<Utc>>,
    pub quarter: Option<String>,
    pub tds_status: Option<String>,
    pub challan_number: Option<String>,
}

/// GET /api/doctor-payouts/reports/tds — every paid statement in the year
/// with its TDS, for the quarterly return and certificates.
pub async fn tds_register(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<YearQuery>,
) -> Result<Json<Vec<TdsRow>>, AppError> {
    require_permission(&claims, reports::VIEW)?;
    let mut tx = begin(&state, &claims).await?;
    let rows = sqlx::query_as::<_, TdsRow>(
        "SELECT s.id AS statement_id, s.kind, COALESCE(u.full_name, r.name) AS payee_name, s.payee_pan, \
                s.tds_section, s.tds_rate, s.incentive_amount AS gross, s.tds_base, s.tds_amount, s.paid_at, \
                t.quarter, t.status::text AS tds_status, t.challan_number \
           FROM incentive_calculations s \
           LEFT JOIN users u ON u.id = s.doctor_id \
           LEFT JOIN lab_referral_doctors r ON r.id = s.referral_doctor_id \
           LEFT JOIN tds_deductions t ON t.id = s.tds_deduction_id \
          WHERE s.tenant_id = $1 AND s.financial_year = $2 AND s.status = 'paid' AND s.deleted_at IS NULL \
          ORDER BY s.paid_at LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .bind(q.financial_year.trim())
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ReferralRow {
    pub statement_id: Uuid,
    pub partner_name: Option<String>,
    pub partner_kind: Option<String>,
    pub payee_pan: Option<String>,
    pub period_start: NaiveDate,
    pub period_end: NaiveDate,
    pub commission: Option<Decimal>,
    pub tds_amount: Decimal,
    pub status: String,
    pub prepared_by_name: Option<String>,
    pub approved_by_name: Option<String>,
    pub paid_at: Option<DateTime<Utc>>,
    pub payment_reference: Option<String>,
}

/// GET /api/doctor-payouts/reports/referral-compliance — every referral
/// payout in the year, with the switch history that allowed it.
pub async fn referral_compliance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<YearQuery>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, reports::VIEW)?;
    let mut tx = begin(&state, &claims).await?;
    let rows = sqlx::query_as::<_, ReferralRow>(
        "SELECT s.id AS statement_id, r.name AS partner_name, r.partner_kind, s.payee_pan, s.period_start, \
                s.period_end, s.incentive_amount AS commission, s.tds_amount, s.status, \
                pu.full_name AS prepared_by_name, au.full_name AS approved_by_name, s.paid_at, \
                s.payment_reference \
           FROM incentive_calculations s \
           JOIN lab_referral_doctors r ON r.id = s.referral_doctor_id \
           LEFT JOIN users pu ON pu.id = s.prepared_by \
           LEFT JOIN users au ON au.id = s.approved_by \
          WHERE s.tenant_id = $1 AND s.kind = 'referral' AND s.financial_year = $2 \
            AND s.deleted_at IS NULL AND s.status <> 'superseded' \
          ORDER BY s.period_end DESC LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .bind(q.financial_year.trim())
    .fetch_all(&mut *tx)
    .await?;
    let cfg = settings::load(&mut tx, claims.tenant_id).await?;
    let events = settings::policy_events(&mut tx, claims.tenant_id).await?;
    tx.commit().await?;
    Ok(Json(json!({
        "referral_enabled": cfg.referral_enabled,
        "referral_individuals_enabled": cfg.referral_individuals_enabled,
        "events": events,
        "rows": rows,
    })))
}
