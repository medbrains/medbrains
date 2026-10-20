//! The doctor agreement: how a doctor is engaged and paid. One row per doctor
//! per period, effective-dated; NULL terms fall back to the hospital default.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, NaiveDate, Utc};
use medbrains_core::permissions::doctor_payouts::agreements;
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::engine::{Basis, Bearer, Charity, Terms};
use crate::settings::Settings;
use crate::{Tx, begin};

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Agreement {
    pub id: Uuid,
    pub doctor_id: Uuid,
    pub doctor_name: Option<String>,
    pub plan_id: Uuid,
    pub plan_name: Option<String>,
    pub plan_code: Option<String>,
    pub effective_from: NaiveDate,
    pub effective_to: Option<NaiveDate>,
    pub is_active: bool,
    pub engagement_type: String,
    pub accrual_basis: Option<String>,
    pub share_on: Option<String>,
    pub discount_bearer: Option<String>,
    pub disallowance_bearer: Option<String>,
    pub charity_rule: String,
    pub charity_fixed_amount: Option<Decimal>,
    pub session_minimum: Option<Decimal>,
    pub settlement_cycle: String,
    pub tds_section_code: Option<String>,
    pub pan: Option<String>,
    pub payout_mode: String,
    pub bank_account_name: Option<String>,
    pub bank_account_number: Option<String>,
    pub bank_ifsc: Option<String>,
    pub upi_vpa: Option<String>,
    pub notes: Option<String>,
    pub updated_at: DateTime<Utc>,
}

impl Agreement {
    /// The terms the engine applies, with the hospital's defaults filled in.
    pub fn terms(&self, s: &Settings) -> Terms {
        let pick = |own: Option<&String>, default: &String| own.unwrap_or(default).clone();
        let basis = pick(self.accrual_basis.as_ref(), &s.default_basis);
        let disc = pick(self.discount_bearer.as_ref(), &s.default_discount_bearer);
        let disallow = pick(
            self.disallowance_bearer.as_ref(),
            &s.default_disallowance_bearer,
        );
        Terms {
            basis: Basis::parse(&basis).unwrap_or(Basis::Collected),
            share_on_net: pick(self.share_on.as_ref(), &s.default_share_on) == "net",
            discount_bearer: Bearer::parse(&disc).unwrap_or(Bearer::ProRata),
            disallowance_bearer: Bearer::parse(&disallow).unwrap_or(Bearer::ProRata),
            charity: match (self.charity_rule.as_str(), self.charity_fixed_amount) {
                ("full", _) => Charity::Full,
                ("fixed", Some(a)) => Charity::Fixed(a),
                _ => Charity::Zero,
            },
        }
    }

    pub fn covers(&self, day: NaiveDate) -> bool {
        self.is_active && self.effective_from <= day && self.effective_to.is_none_or(|t| t >= day)
    }
}

pub const AGREEMENT_SELECT: &str = "SELECT a.id, a.doctor_id, u.full_name AS doctor_name, a.plan_id, \
     p.plan_name, p.plan_code, a.effective_from, a.effective_to, a.is_active, a.engagement_type, \
     a.accrual_basis, a.share_on, a.discount_bearer, a.disallowance_bearer, a.charity_rule, \
     a.charity_fixed_amount, a.session_minimum, a.settlement_cycle, a.tds_section_code, a.pan, \
     a.payout_mode, a.bank_account_name, a.bank_account_number, a.bank_ifsc, a.upi_vpa, a.notes, \
     a.updated_at \
     FROM doctor_incentive_assignments a \
     JOIN users u ON u.id = a.doctor_id \
     JOIN incentive_plans p ON p.id = a.plan_id";

/// Every live agreement of these doctors, for the caller to pick by date.
pub async fn for_doctors(tx: &mut Tx<'_>, doctor_ids: &[Uuid]) -> Result<Vec<Agreement>, AppError> {
    let sql = format!(
        "{AGREEMENT_SELECT} WHERE a.doctor_id = ANY($1) AND a.deleted_at IS NULL AND a.is_active \
         ORDER BY a.effective_from DESC LIMIT 1000"
    );
    Ok(sqlx::query_as::<_, Agreement>(&sql)
        .bind(doctor_ids)
        .fetch_all(&mut **tx)
        .await?)
}

/// The agreement covering `doctor` on `day`.
pub async fn covering(
    tx: &mut Tx<'_>,
    doctor: Uuid,
    day: NaiveDate,
) -> Result<Option<Agreement>, AppError> {
    Ok(for_doctors(tx, &[doctor])
        .await?
        .into_iter()
        .find(|a| a.covers(day)))
}

/// GET /api/doctor-payouts/agreements
pub async fn list_agreements(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<Agreement>>, AppError> {
    require_permission(&claims, agreements::MANAGE)?;
    let mut tx = begin(&state, &claims).await?;
    let sql = format!(
        "{AGREEMENT_SELECT} WHERE a.deleted_at IS NULL ORDER BY u.full_name, a.effective_from DESC LIMIT 2000"
    );
    let rows = sqlx::query_as::<_, Agreement>(&sql)
        .fetch_all(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct AgreementInput {
    pub doctor_id: Uuid,
    pub plan_id: Uuid,
    pub effective_from: NaiveDate,
    pub effective_to: Option<NaiveDate>,
    pub is_active: Option<bool>,
    pub engagement_type: String,
    pub accrual_basis: Option<String>,
    pub share_on: Option<String>,
    pub discount_bearer: Option<String>,
    pub disallowance_bearer: Option<String>,
    pub charity_rule: String,
    pub charity_fixed_amount: Option<Decimal>,
    pub session_minimum: Option<Decimal>,
    pub settlement_cycle: String,
    pub tds_section_code: Option<String>,
    pub pan: Option<String>,
    pub payout_mode: String,
    pub bank_account_name: Option<String>,
    pub bank_account_number: Option<String>,
    pub bank_ifsc: Option<String>,
    pub upi_vpa: Option<String>,
    pub notes: Option<String>,
}

fn clean(v: Option<&String>) -> Option<String> {
    v.map(|s| s.trim().to_owned()).filter(|s| !s.is_empty())
}

fn check_destination(b: &AgreementInput) -> Result<(), AppError> {
    let has = |v: Option<&String>| clean(v).is_some();
    let ok = match b.payout_mode.as_str() {
        "bank" => has(b.bank_account_number.as_ref()) && has(b.bank_ifsc.as_ref()),
        "upi" => has(b.upi_vpa.as_ref()),
        _ => true,
    };
    if ok {
        Ok(())
    } else {
        Err(AppError::BadRequest(
            "A bank payout needs the account number and IFSC; a UPI payout needs the UPI ID"
                .to_owned(),
        ))
    }
}

async fn check_overlap(
    tx: &mut Tx<'_>,
    b: &AgreementInput,
    except: Option<Uuid>,
) -> Result<(), AppError> {
    let clash = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM doctor_incentive_assignments \
          WHERE doctor_id = $1 AND deleted_at IS NULL AND is_active AND id IS DISTINCT FROM $2 \
            AND effective_from <= COALESCE($4, 'infinity'::date) \
            AND COALESCE(effective_to, 'infinity'::date) >= $3)",
    )
    .bind(b.doctor_id)
    .bind(except)
    .bind(b.effective_from)
    .bind(b.effective_to)
    .fetch_one(&mut **tx)
    .await?;
    if clash {
        return Err(AppError::Conflict(
            "This doctor already has an agreement for part of these dates; end it first".to_owned(),
        ));
    }
    Ok(())
}

const AGREEMENT_SET: &str = "doctor_id = $2, plan_id = $3, effective_from = $4, effective_to = $5, \
     is_active = $6, engagement_type = $7, accrual_basis = $8, share_on = $9, discount_bearer = $10, \
     disallowance_bearer = $11, charity_rule = $12, charity_fixed_amount = $13, session_minimum = $14, \
     settlement_cycle = $15, tds_section_code = $16, pan = $17, payout_mode = $18, \
     bank_account_name = $19, bank_account_number = $20, bank_ifsc = $21, upi_vpa = $22, notes = $23, \
     updated_by = $24";

async fn write(
    tx: &mut Tx<'_>,
    sql: &str,
    id: Uuid,
    b: &AgreementInput,
    actor: Uuid,
) -> Result<(), AppError> {
    sqlx::query(sql)
        .bind(id)
        .bind(b.doctor_id)
        .bind(b.plan_id)
        .bind(b.effective_from)
        .bind(b.effective_to)
        .bind(b.is_active.unwrap_or(true))
        .bind(&b.engagement_type)
        .bind(clean(b.accrual_basis.as_ref()))
        .bind(clean(b.share_on.as_ref()))
        .bind(clean(b.discount_bearer.as_ref()))
        .bind(clean(b.disallowance_bearer.as_ref()))
        .bind(&b.charity_rule)
        .bind(b.charity_fixed_amount)
        .bind(b.session_minimum)
        .bind(&b.settlement_cycle)
        .bind(clean(b.tds_section_code.as_ref()))
        .bind(clean(b.pan.as_ref()).map(|p| p.to_uppercase()))
        .bind(&b.payout_mode)
        .bind(clean(b.bank_account_name.as_ref()))
        .bind(clean(b.bank_account_number.as_ref()))
        .bind(clean(b.bank_ifsc.as_ref()).map(|p| p.to_uppercase()))
        .bind(clean(b.upi_vpa.as_ref()))
        .bind(clean(b.notes.as_ref()))
        .bind(actor)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

async fn fetch(tx: &mut Tx<'_>, id: Uuid) -> Result<Agreement, AppError> {
    let sql = format!("{AGREEMENT_SELECT} WHERE a.id = $1 AND a.deleted_at IS NULL");
    Ok(sqlx::query_as::<_, Agreement>(&sql)
        .bind(id)
        .fetch_one(&mut **tx)
        .await?)
}

/// POST /api/doctor-payouts/agreements
pub async fn create_agreement(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<AgreementInput>,
) -> Result<Json<Agreement>, AppError> {
    require_permission(&claims, agreements::MANAGE)?;
    check_destination(&body)?;
    let mut tx = begin(&state, &claims).await?;
    check_overlap(&mut tx, &body, None).await?;
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO doctor_incentive_assignments (id, tenant_id, doctor_id, plan_id, effective_from, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.doctor_id)
    .bind(body.plan_id)
    .bind(body.effective_from)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;
    let sql = format!("UPDATE doctor_incentive_assignments SET {AGREEMENT_SET} WHERE id = $1");
    write(&mut tx, &sql, id, &body, claims.sub).await?;
    let row = fetch(&mut tx, id).await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// PUT /api/doctor-payouts/agreements/{id} — new terms apply to earnings from
/// now on; every accrual already made keeps the rate it was made at.
pub async fn update_agreement(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<AgreementInput>,
) -> Result<Json<Agreement>, AppError> {
    require_permission(&claims, agreements::MANAGE)?;
    check_destination(&body)?;
    let mut tx = begin(&state, &claims).await?;
    fetch(&mut tx, id).await?;
    if body.is_active.unwrap_or(true) {
        check_overlap(&mut tx, &body, Some(id)).await?;
    }
    let sql = format!(
        "UPDATE doctor_incentive_assignments SET {AGREEMENT_SET} WHERE id = $1 AND deleted_at IS NULL"
    );
    write(&mut tx, &sql, id, &body, claims.sub).await?;
    let row = fetch(&mut tx, id).await?;
    tx.commit().await?;
    Ok(Json(row))
}
