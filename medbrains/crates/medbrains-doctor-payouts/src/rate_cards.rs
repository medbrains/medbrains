//! Versioned rate cards. A version is frozen the first time an accrual uses
//! it; a change after that is a new version from a date, so a past month is
//! never re-priced.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, Days, NaiveDate, Utc};
use medbrains_core::permissions::doctor_payouts::{agreements, rate_cards};
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::{require_any_permission, require_permission},
    state::AppState,
};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::engine::{self, Bearer, Charity, Line, Terms};
use crate::{Tx, begin, settings};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct RateCard {
    pub id: Uuid,
    pub plan_name: String,
    pub plan_code: String,
    pub description: Option<String>,
    pub effective_from: NaiveDate,
    pub effective_to: Option<NaiveDate>,
    pub is_active: bool,
    pub version: i32,
    pub frozen_at: Option<DateTime<Utc>>,
    pub supersedes_id: Option<Uuid>,
    pub rule_count: i64,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct RuleRow {
    pub id: Uuid,
    pub plan_id: Uuid,
    pub rule_name: String,
    /// The category matched.
    pub service_type: Option<String>,
    pub match_charge_code: Option<String>,
    pub department_id: Option<Uuid>,
    pub payer_class: Option<String>,
    pub visit_kind: Option<String>,
    pub role: String,
    pub calc_kind: String,
    pub percentage: Option<Decimal>,
    pub fixed_amount: Option<Decimal>,
    pub min_threshold: Option<Decimal>,
    pub max_threshold: Option<Decimal>,
}

impl RuleRow {
    pub fn to_rule(&self) -> engine::Rule {
        engine::Rule {
            id: self.id,
            charge_code: self.match_charge_code.clone(),
            category: self.service_type.clone(),
            department_id: self.department_id,
            payer_class: self.payer_class.clone(),
            visit_kind: self.visit_kind.clone(),
            role: self.role.clone(),
            is_fixed: self.calc_kind == "fixed",
            percentage: self.percentage,
            fixed_amount: self.fixed_amount,
            cap_min: self.min_threshold,
            cap_max: self.max_threshold,
        }
    }
}

const RULE_SELECT: &str = "SELECT id, plan_id, rule_name, service_type, match_charge_code, department_id, \
     payer_class, visit_kind, role, calc_kind, percentage, fixed_amount, min_threshold, max_threshold \
     FROM incentive_plan_rules";

/// The rules of these rate-card versions, in the order they were written.
pub async fn rules_for(tx: &mut Tx<'_>, plan_ids: &[Uuid]) -> Result<Vec<RuleRow>, AppError> {
    let sql = format!(
        "{RULE_SELECT} WHERE plan_id = ANY($1) AND deleted_at IS NULL ORDER BY created_at, id LIMIT 5000"
    );
    Ok(sqlx::query_as::<_, RuleRow>(&sql)
        .bind(plan_ids)
        .fetch_all(&mut **tx)
        .await?)
}

/// A rate-card version and the dates it covers.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct Version {
    pub id: Uuid,
    /// The agreement's plan this version belongs to.
    pub family_of: Uuid,
    pub effective_from: NaiveDate,
    pub effective_to: Option<NaiveDate>,
}

/// Every version of the rate cards these agreement plans belong to.
pub async fn versions_of(tx: &mut Tx<'_>, plan_ids: &[Uuid]) -> Result<Vec<Version>, AppError> {
    Ok(sqlx::query_as::<_, Version>(
        "SELECT v.id, p.id AS family_of, v.effective_from, v.effective_to \
           FROM incentive_plans p \
           JOIN incentive_plans v ON v.tenant_id = p.tenant_id AND v.plan_code = p.plan_code \
          WHERE p.id = ANY($1) AND v.deleted_at IS NULL AND v.is_active \
          LIMIT 1000",
    )
    .bind(plan_ids)
    .fetch_all(&mut **tx)
    .await?)
}

/// The version of `plan`'s card in force on `day`.
pub fn version_on(versions: &[Version], plan: Uuid, day: NaiveDate) -> Option<Uuid> {
    versions
        .iter()
        .filter(|v| v.family_of == plan && v.effective_from <= day)
        .filter(|v| v.effective_to.is_none_or(|t| t >= day))
        .max_by_key(|v| v.effective_from)
        .map(|v| v.id)
}

/// GET /api/doctor-payouts/rate-cards — also read by whoever writes
/// agreements, which name a card.
pub async fn list_rate_cards(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<RateCard>>, AppError> {
    require_any_permission(&claims, &[rate_cards::MANAGE, agreements::MANAGE])?;
    let mut tx = begin(&state, &claims).await?;
    let rows = sqlx::query_as::<_, RateCard>(
        "SELECT p.id, p.plan_name, p.plan_code, p.description, p.effective_from, p.effective_to, \
                p.is_active, p.version, p.frozen_at, p.supersedes_id, \
                (SELECT COUNT(*) FROM incentive_plan_rules r WHERE r.plan_id = p.id AND r.deleted_at IS NULL) AS rule_count \
           FROM incentive_plans p WHERE p.deleted_at IS NULL \
          ORDER BY p.plan_code, p.version DESC LIMIT 1000",
    )
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct CreateRateCard {
    pub plan_name: String,
    pub plan_code: String,
    pub description: Option<String>,
    pub effective_from: NaiveDate,
    pub effective_to: Option<NaiveDate>,
}

/// POST /api/doctor-payouts/rate-cards — version 1 of a new card.
pub async fn create_rate_card(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateRateCard>,
) -> Result<Json<Uuid>, AppError> {
    require_permission(&claims, rate_cards::MANAGE)?;
    let mut tx = begin(&state, &claims).await?;
    let id = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO incentive_plans (tenant_id, plan_name, plan_code, description, effective_from, \
         effective_to, calculation_basis, created_by) VALUES ($1, $2, $3, $4, $5, $6, 'rate_card', $7) RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(body.plan_name.trim())
    .bind(body.plan_code.trim().to_uppercase())
    .bind(body.description.as_deref())
    .bind(body.effective_from)
    .bind(body.effective_to)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(id))
}

#[derive(Debug, Deserialize)]
pub struct NewVersion {
    pub effective_from: NaiveDate,
}

/// POST /api/doctor-payouts/rate-cards/{id}/versions — copy the card and its
/// rules into the next version from a date; the old one ends the day before.
pub async fn new_version(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<NewVersion>,
) -> Result<Json<Uuid>, AppError> {
    require_permission(&claims, rate_cards::MANAGE)?;
    let mut tx = begin(&state, &claims).await?;
    let (from, code) = sqlx::query_as::<_, (NaiveDate, String)>(
        "SELECT effective_from, plan_code FROM incentive_plans WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;
    let Some(day_before) = body.effective_from.checked_sub_days(Days::new(1)) else {
        return Err(AppError::BadRequest("Invalid date".to_owned()));
    };
    if body.effective_from <= from {
        return Err(AppError::BadRequest(
            "A new version must start after the current one".to_owned(),
        ));
    }
    let new_id = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO incentive_plans (tenant_id, plan_name, plan_code, description, effective_from, \
         effective_to, calculation_basis, created_by, version, supersedes_id) \
         SELECT tenant_id, plan_name, plan_code, description, $2, effective_to, calculation_basis, $3, \
                (SELECT MAX(version) + 1 FROM incentive_plans WHERE tenant_id = p.tenant_id AND plan_code = $4), id \
           FROM incentive_plans p WHERE id = $1 RETURNING id",
    )
    .bind(id)
    .bind(body.effective_from)
    .bind(claims.sub)
    .bind(&code)
    .fetch_one(&mut *tx)
    .await?;
    sqlx::query(
        "INSERT INTO incentive_plan_rules (tenant_id, plan_id, rule_name, service_type, department_id, \
         min_threshold, max_threshold, percentage, fixed_amount, match_charge_code, payer_class, \
         visit_kind, role, calc_kind) \
         SELECT tenant_id, $2, rule_name, service_type, department_id, min_threshold, max_threshold, \
                percentage, fixed_amount, match_charge_code, payer_class, visit_kind, role, calc_kind \
           FROM incentive_plan_rules WHERE plan_id = $1 AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(new_id)
    .execute(&mut *tx)
    .await?;
    sqlx::query("UPDATE incentive_plans SET effective_to = $2 WHERE id = $1")
        .bind(id)
        .bind(day_before)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(new_id))
}

/// GET /api/doctor-payouts/rate-cards/{id}/rules
pub async fn list_rules(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<RuleRow>>, AppError> {
    require_permission(&claims, rate_cards::MANAGE)?;
    let mut tx = begin(&state, &claims).await?;
    let rows = rules_for(&mut tx, &[id]).await?;
    tx.commit().await?;
    Ok(Json(rows))
}

async fn refuse_if_frozen(tx: &mut Tx<'_>, plan: Uuid) -> Result<(), AppError> {
    let frozen = sqlx::query_scalar::<_, bool>(
        "SELECT frozen_at IS NOT NULL FROM incentive_plans WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
    )
    .bind(plan)
    .fetch_one(&mut **tx)
    .await?;
    if frozen {
        return Err(AppError::Conflict(
            "This version has already been used to pay doctors; start a new version to change it"
                .to_owned(),
        ));
    }
    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct RuleInput {
    pub rule_name: String,
    pub category: Option<String>,
    pub charge_code: Option<String>,
    pub department_id: Option<Uuid>,
    pub payer_class: Option<String>,
    pub visit_kind: Option<String>,
    pub role: String,
    pub calc_kind: String,
    pub percentage: Option<Decimal>,
    pub fixed_amount: Option<Decimal>,
    pub cap_min: Option<Decimal>,
    pub cap_max: Option<Decimal>,
}

fn blank(v: Option<&String>) -> Option<String> {
    v.map(|s| s.trim().to_owned()).filter(|s| !s.is_empty())
}

/// POST /api/doctor-payouts/rate-cards/{id}/rules
pub async fn add_rule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<RuleInput>,
) -> Result<Json<RuleRow>, AppError> {
    require_permission(&claims, rate_cards::MANAGE)?;
    let mut tx = begin(&state, &claims).await?;
    refuse_if_frozen(&mut tx, id).await?;
    let inserted = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO incentive_plan_rules (tenant_id, plan_id, rule_name, service_type, \
         match_charge_code, department_id, payer_class, visit_kind, role, calc_kind, percentage, \
         fixed_amount, min_threshold, max_threshold) \
         VALUES ($1, $2, $3, lower($4), upper($5), $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .bind(body.rule_name.trim())
    .bind(blank(body.category.as_ref()))
    .bind(blank(body.charge_code.as_ref()))
    .bind(body.department_id)
    .bind(blank(body.payer_class.as_ref()))
    .bind(blank(body.visit_kind.as_ref()))
    .bind(&body.role)
    .bind(&body.calc_kind)
    .bind(body.percentage)
    .bind(body.fixed_amount)
    .bind(body.cap_min)
    .bind(body.cap_max)
    .fetch_one(&mut *tx)
    .await?;
    let rules: Vec<engine::Rule> = rules_for(&mut tx, &[id])
        .await?
        .iter()
        .map(RuleRow::to_rule)
        .collect();
    if let Some(total) = engine::split_overflow(&rules) {
        return Err(AppError::BadRequest(format!(
            "The roles sharing these lines would get {total}% between them; a split cannot exceed 100%"
        )));
    }
    let row = rules_for(&mut tx, &[id])
        .await?
        .into_iter()
        .find(|r| r.id == inserted);
    tx.commit().await?;
    row.map(Json).ok_or(AppError::NotFound)
}

/// DELETE /api/doctor-payouts/rate-cards/{id}/rules/{rule_id}
pub async fn remove_rule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, rule_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Uuid>, AppError> {
    require_permission(&claims, rate_cards::MANAGE)?;
    let mut tx = begin(&state, &claims).await?;
    refuse_if_frozen(&mut tx, id).await?;
    let done = sqlx::query(
        "UPDATE incentive_plan_rules SET deleted_at = now(), deleted_by = $3, delete_reason = 'removed from rate card' \
         WHERE id = $1 AND plan_id = $2 AND deleted_at IS NULL",
    )
    .bind(rule_id)
    .bind(id)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;
    if done.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    tx.commit().await?;
    Ok(Json(rule_id))
}

#[derive(Debug, Deserialize)]
pub struct CalcInput {
    pub charge_code: String,
    pub category: String,
    pub department_id: Option<Uuid>,
    pub payer_class: String,
    pub visit_kind: Option<String>,
    pub role: String,
    pub quantity: i32,
    pub gross: Decimal,
    pub discount: Decimal,
    pub share_on: Option<String>,
    pub discount_bearer: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CalcResult {
    pub rule: Option<RuleRow>,
    pub base: Decimal,
    pub amount: Decimal,
}

/// POST /api/doctor-payouts/rate-cards/{id}/calculate — "this line would pay X".
pub async fn calculate(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CalcInput>,
) -> Result<Json<CalcResult>, AppError> {
    require_permission(&claims, rate_cards::MANAGE)?;
    let mut tx = begin(&state, &claims).await?;
    let defaults = settings::load(&mut tx, claims.tenant_id).await?;
    let rows = rules_for(&mut tx, &[id]).await?;
    tx.commit().await?;
    let rules: Vec<engine::Rule> = rows.iter().map(RuleRow::to_rule).collect();
    let category = body.category.to_lowercase();
    let line = Line {
        charge_code: &body.charge_code,
        category: &category,
        department_id: body.department_id,
        payer_class: &body.payer_class,
        visit_kind: body.visit_kind.as_deref(),
        role: &body.role,
        quantity: body.quantity,
        gross: body.gross,
        discount: body.discount,
    };
    let bearer = body
        .discount_bearer
        .as_deref()
        .unwrap_or(&defaults.default_discount_bearer);
    let terms = Terms {
        basis: engine::Basis::Billed,
        share_on_net: body
            .share_on
            .as_deref()
            .unwrap_or(&defaults.default_share_on)
            == "net",
        discount_bearer: Bearer::parse(bearer).unwrap_or(Bearer::ProRata),
        disallowance_bearer: Bearer::ProRata,
        charity: Charity::Zero,
    };
    let Some(rule) = engine::pick_rule(&rules, &line) else {
        return Ok(Json(CalcResult {
            rule: None,
            base: Decimal::ZERO,
            amount: Decimal::ZERO,
        }));
    };
    let share = engine::compute_share(rule, &line, &terms);
    let row = rows.into_iter().find(|r| r.id == rule.id);
    Ok(Json(CalcResult {
        rule: row,
        base: share.base,
        amount: share.amount,
    }))
}
