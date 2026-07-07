//! Payroll — salary structures, payroll runs, and generated payslips. Attendance drives
//! loss-of-pay (present-by-default; mark absences); India statutory heads (PF/ESI/PT) are
//! computed at generation. Rates are the common statutory defaults — configurable later.

use std::collections::HashMap;

use axum::Json;
use axum::extract::{Extension, Path, Query, State};
use medbrains_core::hr::{PayrollRun, Payslip, SalaryStructure};
use medbrains_core::permissions;
use rust_decimal::Decimal;
use serde::Deserialize;
use uuid::Uuid;

use crate::error::AppError;
use crate::middleware::auth::Claims;
use crate::middleware::authorization::require_permission;
use crate::state::AppState;

// Statutory defaults (India). PF 12% of basic capped at ₹1800 (₹15k ceiling); ESI 0.75%
// of gross when gross ≤ ₹21k; PT a flat ₹200 above ₹15k earned. Configurable later.
fn pf_rate() -> Decimal {
    Decimal::new(12, 2)
}
fn esi_rate() -> Decimal {
    Decimal::new(75, 4)
}
fn pf_cap() -> Decimal {
    Decimal::from(1800)
}
fn esi_ceiling() -> Decimal {
    Decimal::from(21000)
}
fn pt_threshold() -> Decimal {
    Decimal::from(15000)
}
fn pt_amount() -> Decimal {
    Decimal::from(200)
}

// ── Salary structures ─────────────────────────────────────────

pub async fn list_salary_structures(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<SalaryStructure>>, AppError> {
    require_permission(&claims, permissions::hr::payroll::structures::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, SalaryStructure>(
        "SELECT * FROM salary_structures WHERE tenant_id = $1 ORDER BY updated_at DESC LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct UpsertStructureRequest {
    pub employee_id: Uuid,
    pub basic: Decimal,
    pub hra: Decimal,
    pub other_allowances: Decimal,
    pub monthly_tds: Option<Decimal>,
    pub pf_applicable: Option<bool>,
    pub esi_applicable: Option<bool>,
    pub pt_applicable: Option<bool>,
}

pub async fn upsert_salary_structure(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpsertStructureRequest>,
) -> Result<Json<SalaryStructure>, AppError> {
    require_permission(&claims, permissions::hr::payroll::structures::MANAGE)?;
    if body.basic < Decimal::ZERO || body.hra < Decimal::ZERO || body.other_allowances < Decimal::ZERO
    {
        return Err(AppError::BadRequest("Salary components cannot be negative".to_owned()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, SalaryStructure>(
        "INSERT INTO salary_structures \
         (tenant_id, employee_id, basic, hra, other_allowances, monthly_tds, \
          pf_applicable, esi_applicable, pt_applicable) \
         VALUES ($1, $2, $3, $4, $5, COALESCE($6, 0), \
                 COALESCE($7, true), COALESCE($8, true), COALESCE($9, true)) \
         ON CONFLICT (tenant_id, employee_id) DO UPDATE SET \
           basic = EXCLUDED.basic, hra = EXCLUDED.hra, \
           other_allowances = EXCLUDED.other_allowances, monthly_tds = EXCLUDED.monthly_tds, \
           pf_applicable = EXCLUDED.pf_applicable, esi_applicable = EXCLUDED.esi_applicable, \
           pt_applicable = EXCLUDED.pt_applicable, updated_at = now() \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.employee_id)
    .bind(body.basic)
    .bind(body.hra)
    .bind(body.other_allowances)
    .bind(body.monthly_tds)
    .bind(body.pf_applicable)
    .bind(body.esi_applicable)
    .bind(body.pt_applicable)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

// ── Payroll runs + generation ─────────────────────────────────

pub async fn list_payroll_runs(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<PayrollRun>>, AppError> {
    require_permission(&claims, permissions::hr::payroll::runs::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, PayrollRun>(
        "SELECT * FROM payroll_runs WHERE tenant_id = $1 \
         ORDER BY period_year DESC, period_month DESC LIMIT 500",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct CreateRunRequest {
    pub period_month: i16,
    pub period_year: i16,
}

fn days_in_month(year: i32, month: u32) -> Result<i64, AppError> {
    let (ny, nm) = if month == 12 { (year + 1, 1) } else { (year, month + 1) };
    let first = chrono::NaiveDate::from_ymd_opt(year, month, 1)
        .ok_or_else(|| AppError::BadRequest("Invalid period".to_owned()))?;
    let first_next = chrono::NaiveDate::from_ymd_opt(ny, nm, 1)
        .ok_or_else(|| AppError::BadRequest("Invalid period".to_owned()))?;
    Ok((first_next - first).num_days())
}

/// Row projection for the generation: the structure plus applicability flags.
#[derive(sqlx::FromRow)]
struct StructureCalcRow {
    employee_id: Uuid,
    basic: Decimal,
    hra: Decimal,
    other_allowances: Decimal,
    monthly_tds: Decimal,
    pf_applicable: bool,
    esi_applicable: bool,
    pt_applicable: bool,
}

struct PayslipCalc {
    gross: Decimal,
    paid_days: Decimal,
    earned_basic: Decimal,
    earned_hra: Decimal,
    earned_allow: Decimal,
    earned_gross: Decimal,
    pf: Decimal,
    esi: Decimal,
    pt: Decimal,
    tds: Decimal,
    total_deductions: Decimal,
    net_pay: Decimal,
}

/// Pure payslip math (pro-rate by attendance + statutory deductions). Extracted so the
/// money path is unit-tested. Rounding to paise (2 dp) at each earned head.
fn compute_payslip(s: &StructureCalcRow, working_days: Decimal, lop: Decimal) -> PayslipCalc {
    let gross = s.basic + s.hra + s.other_allowances;
    let paid_days = (working_days - lop).max(Decimal::ZERO);
    let ratio = if working_days.is_zero() {
        Decimal::ZERO
    } else {
        paid_days / working_days
    };
    let earned_basic = (s.basic * ratio).round_dp(2);
    let earned_hra = (s.hra * ratio).round_dp(2);
    let earned_allow = (s.other_allowances * ratio).round_dp(2);
    let earned_gross = (earned_basic + earned_hra + earned_allow).round_dp(2);

    let pf = if s.pf_applicable {
        (earned_basic * pf_rate()).round_dp(2).min(pf_cap())
    } else {
        Decimal::ZERO
    };
    let esi = if s.esi_applicable && gross <= esi_ceiling() {
        (earned_gross * esi_rate()).round_dp(2)
    } else {
        Decimal::ZERO
    };
    let pt = if s.pt_applicable && earned_gross >= pt_threshold() {
        pt_amount()
    } else {
        Decimal::ZERO
    };
    let tds = s.monthly_tds;
    let total_deductions = pf + esi + pt + tds;
    let net_pay = earned_gross - total_deductions;

    PayslipCalc {
        gross,
        paid_days,
        earned_basic,
        earned_hra,
        earned_allow,
        earned_gross,
        pf,
        esi,
        pt,
        tds,
        total_deductions,
        net_pay,
    }
}

pub async fn create_payroll_run(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateRunRequest>,
) -> Result<Json<PayrollRun>, AppError> {
    require_permission(&claims, permissions::hr::payroll::runs::CREATE)?;
    if !(1..=12).contains(&body.period_month) || !(2000..=2100).contains(&body.period_year) {
        return Err(AppError::BadRequest("Invalid pay period".to_owned()));
    }
    let year = i32::from(body.period_year);
    let month = u32::try_from(body.period_month).unwrap_or(1);
    let working_days = days_in_month(year, month)?;
    let working_days_dec = Decimal::from(working_days);
    let first = chrono::NaiveDate::from_ymd_opt(year, month, 1)
        .ok_or_else(|| AppError::BadRequest("Invalid period".to_owned()))?;
    let last = chrono::NaiveDate::from_ymd_opt(year, month, u32::try_from(working_days).unwrap_or(28))
        .ok_or_else(|| AppError::BadRequest("Invalid period".to_owned()))?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM payroll_runs \
         WHERE tenant_id = $1 AND period_month = $2 AND period_year = $3)",
    )
    .bind(claims.tenant_id)
    .bind(body.period_month)
    .bind(body.period_year)
    .fetch_one(&mut *tx)
    .await?;
    if exists {
        return Err(AppError::Conflict("Payroll for this period already exists".to_owned()));
    }

    let structures = sqlx::query_as::<_, StructureCalcRow>(
        "SELECT s.employee_id, s.basic, s.hra, s.other_allowances, s.monthly_tds, \
                s.pf_applicable, s.esi_applicable, s.pt_applicable \
         FROM salary_structures s JOIN employees e ON e.id = s.employee_id \
         WHERE s.tenant_id = $1 AND e.status = 'active'",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    // Loss-of-pay: absences in the period, grouped per employee (present-by-default).
    let lop_rows: Vec<(Uuid, i64)> = sqlx::query_as(
        "SELECT employee_id, COUNT(*) FROM attendance_records \
         WHERE tenant_id = $1 AND status = 'absent' AND attendance_date BETWEEN $2 AND $3 \
         GROUP BY employee_id",
    )
    .bind(claims.tenant_id)
    .bind(first)
    .bind(last)
    .fetch_all(&mut *tx)
    .await?;
    let lop_map: HashMap<Uuid, i64> = lop_rows.into_iter().collect();

    let run_id = Uuid::new_v4();
    let mut total_net = Decimal::ZERO;
    let mut count: i32 = 0;

    for s in &structures {
        let lop = Decimal::from(*lop_map.get(&s.employee_id).unwrap_or(&0));
        let c = compute_payslip(s, working_days_dec, lop);

        sqlx::query(
            "INSERT INTO payslips \
             (tenant_id, run_id, employee_id, working_days, lop_days, paid_days, gross, \
              earned_gross, earned_basic, pf, esi, pt, tds, other_deductions, \
              total_deductions, net_pay, earnings, deductions) \
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,0,$14,$15,$16,$17)",
        )
        .bind(claims.tenant_id)
        .bind(run_id)
        .bind(s.employee_id)
        .bind(i16::try_from(working_days).unwrap_or(30))
        .bind(lop)
        .bind(c.paid_days)
        .bind(c.gross)
        .bind(c.earned_gross)
        .bind(c.earned_basic)
        .bind(c.pf)
        .bind(c.esi)
        .bind(c.pt)
        .bind(c.tds)
        .bind(c.total_deductions)
        .bind(c.net_pay)
        .bind(serde_json::json!({ "basic": c.earned_basic, "hra": c.earned_hra, "other_allowances": c.earned_allow }))
        .bind(serde_json::json!({ "pf": c.pf, "esi": c.esi, "pt": c.pt, "tds": c.tds }))
        .execute(&mut *tx)
        .await?;

        total_net += c.net_pay;
        count += 1;
    }

    let run = sqlx::query_as::<_, PayrollRun>(
        "INSERT INTO payroll_runs \
         (id, tenant_id, period_month, period_year, status, working_days, employee_count, \
          total_net_pay, run_by) \
         VALUES ($1, $2, $3, $4, 'draft', $5, $6, $7, $8) RETURNING *",
    )
    .bind(run_id)
    .bind(claims.tenant_id)
    .bind(body.period_month)
    .bind(body.period_year)
    .bind(i16::try_from(working_days).unwrap_or(30))
    .bind(count)
    .bind(total_net)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(run))
}

#[derive(Debug, Deserialize)]
pub struct PayslipQuery {
    pub run_id: Uuid,
}

pub async fn list_payslips(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<PayslipQuery>,
) -> Result<Json<Vec<Payslip>>, AppError> {
    require_permission(&claims, permissions::hr::payroll::runs::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, Payslip>(
        "SELECT * FROM payslips WHERE tenant_id = $1 AND run_id = $2 ORDER BY net_pay DESC LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .bind(q.run_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// `POST /api/hr/payroll/runs/{id}/finalize`
pub async fn finalize_payroll_run(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PayrollRun>, AppError> {
    require_permission(&claims, permissions::hr::payroll::runs::CREATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let run = sqlx::query_as::<_, PayrollRun>(
        "UPDATE payroll_runs SET status = 'finalized', updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND status = 'draft' RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::BadRequest("Run not found or already finalized".to_owned()))?;
    tx.commit().await?;
    Ok(Json(run))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn row(basic: i64, hra: i64, allow: i64) -> StructureCalcRow {
        StructureCalcRow {
            employee_id: Uuid::nil(),
            basic: Decimal::from(basic),
            hra: Decimal::from(hra),
            other_allowances: Decimal::from(allow),
            monthly_tds: Decimal::ZERO,
            pf_applicable: true,
            esi_applicable: true,
            pt_applicable: true,
        }
    }

    #[test]
    fn full_month_no_lop() {
        // gross 50k, 30 working days, 0 LOP.
        let c = compute_payslip(&row(30000, 12000, 8000), Decimal::from(30), Decimal::ZERO);
        assert_eq!(c.gross, Decimal::from(50000));
        assert_eq!(c.earned_gross, Decimal::from(50000));
        assert_eq!(c.pf, Decimal::from(1800)); // min(30000*12%=3600, cap 1800)
        assert_eq!(c.esi, Decimal::ZERO); // gross 50k > 21k ceiling
        assert_eq!(c.pt, Decimal::from(200)); // earned 50k >= 15k
        assert_eq!(c.total_deductions, Decimal::from(2000));
        assert_eq!(c.net_pay, Decimal::from(48000));
    }

    #[test]
    fn esi_applies_below_ceiling() {
        let c = compute_payslip(&row(12000, 5000, 3000), Decimal::from(30), Decimal::ZERO);
        assert_eq!(c.gross, Decimal::from(20000));
        assert_eq!(c.esi, Decimal::from(150)); // 20000 * 0.75%
    }

    #[test]
    fn lop_prorates() {
        // 6 LOP of 30 → ratio 0.8 → earned_gross 40000.
        let c = compute_payslip(&row(30000, 12000, 8000), Decimal::from(30), Decimal::from(6));
        assert_eq!(c.paid_days, Decimal::from(24));
        assert_eq!(c.earned_gross, Decimal::from(40000));
    }
}
