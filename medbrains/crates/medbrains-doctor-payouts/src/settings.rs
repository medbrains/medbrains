//! The hospital's payout policy: defaults every agreement falls back to, the
//! TDS section as data, the cash warning limit, and the referral switches,
//! each of which needs a recorded acknowledgement to turn on.

use axum::{Extension, Json, extract::State};
use chrono::{DateTime, Utc};
use medbrains_core::permissions::doctor_payouts::policy;
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::{Tx, begin};

/// What a hospital must accept to switch referral payouts on.
pub const REFERRAL_ACK: &str = "We understand that IMC (Professional Conduct, Etiquette and Ethics) \
Regulations 2002 Reg 6.4 and the NMC 2023 code forbid a doctor taking a commission for referring a \
patient or a specimen, and that the Supreme Court held such payments not deductible (Apex \
Laboratories v DCIT, 2022). We switch referral payouts on at our own responsibility; each payout \
is recorded with TDS and listed in the referral compliance report.";

/// What a hospital must accept, separately, to pay individual doctors.
pub const INDIVIDUAL_ACK: &str = "We understand that a referral payment to an individual doctor is \
the case IMC Reg 6.4.1 names directly, and that paying one exposes both the doctor and the hospital. \
We switch it on knowingly; organisation partners remain the default.";

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Settings {
    pub default_basis: String,
    pub default_share_on: String,
    pub default_discount_bearer: String,
    pub default_disallowance_bearer: String,
    pub excluded_categories: Vec<String>,
    pub tds_section_code: String,
    pub tds_section_label: String,
    pub tds_rate: Decimal,
    pub tds_no_pan_rate: Decimal,
    pub tds_threshold: Decimal,
    pub cash_daily_warn_limit: Decimal,
    pub referral_enabled: bool,
    pub referral_individuals_enabled: bool,
    pub referral_tds_section_code: String,
    pub referral_tds_rate: Decimal,
    pub referral_tds_threshold: Decimal,
    pub updated_at: DateTime<Utc>,
}

const SETTINGS_COLUMNS: &str = "default_basis, default_share_on, default_discount_bearer, \
     default_disallowance_bearer, excluded_categories, tds_section_code, tds_section_label, \
     tds_rate, tds_no_pan_rate, tds_threshold, cash_daily_warn_limit, referral_enabled, \
     referral_individuals_enabled, referral_tds_section_code, referral_tds_rate, \
     referral_tds_threshold, updated_at";

/// The tenant's settings, created with the defaults on first use.
pub async fn load(tx: &mut Tx<'_>, tenant_id: Uuid) -> Result<Settings, AppError> {
    sqlx::query(
        "INSERT INTO doctor_payout_settings (tenant_id) VALUES ($1) ON CONFLICT (tenant_id) DO NOTHING",
    )
    .bind(tenant_id)
    .execute(&mut **tx)
    .await?;
    let sql = format!("SELECT {SETTINGS_COLUMNS} FROM doctor_payout_settings WHERE tenant_id = $1");
    Ok(sqlx::query_as::<_, Settings>(&sql)
        .bind(tenant_id)
        .fetch_one(&mut **tx)
        .await?)
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PolicyEvent {
    pub id: Uuid,
    pub switch: String,
    pub enabled: bool,
    pub acknowledgement: Option<String>,
    pub acted_by: Uuid,
    pub acted_by_name: Option<String>,
    pub created_at: DateTime<Utc>,
}

pub async fn policy_events(tx: &mut Tx<'_>, tenant_id: Uuid) -> Result<Vec<PolicyEvent>, AppError> {
    Ok(sqlx::query_as::<_, PolicyEvent>(
        "SELECT e.id, e.switch, e.enabled, e.acknowledgement, e.acted_by, \
                u.full_name AS acted_by_name, e.created_at \
           FROM doctor_payout_policy_events e LEFT JOIN users u ON u.id = e.acted_by \
          WHERE e.tenant_id = $1 AND e.deleted_at IS NULL \
          ORDER BY e.created_at DESC LIMIT 100",
    )
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?)
}

async fn settings_body(tx: &mut Tx<'_>, tenant_id: Uuid) -> Result<Value, AppError> {
    let settings = load(tx, tenant_id).await?;
    let events = policy_events(tx, tenant_id).await?;
    Ok(json!({
        "settings": settings,
        "acknowledgements": { "referral": REFERRAL_ACK, "referral_individuals": INDIVIDUAL_ACK },
        "events": events,
    }))
}

/// GET /api/doctor-payouts/settings
pub async fn get_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, policy::MANAGE)?;
    let mut tx = begin(&state, &claims).await?;
    let body = settings_body(&mut tx, claims.tenant_id).await?;
    tx.commit().await?;
    Ok(Json(body))
}

#[derive(Debug, Deserialize)]
pub struct UpdateSettings {
    pub default_basis: String,
    pub default_share_on: String,
    pub default_discount_bearer: String,
    pub default_disallowance_bearer: String,
    pub excluded_categories: Vec<String>,
    pub tds_section_code: String,
    pub tds_section_label: String,
    pub tds_rate: Decimal,
    pub tds_no_pan_rate: Decimal,
    pub tds_threshold: Decimal,
    pub cash_daily_warn_limit: Decimal,
    pub referral_tds_section_code: String,
    pub referral_tds_rate: Decimal,
    pub referral_tds_threshold: Decimal,
}

/// PUT /api/doctor-payouts/settings — the defaults; not the referral switches.
pub async fn update_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpdateSettings>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, policy::MANAGE)?;
    let mut tx = begin(&state, &claims).await?;
    load(&mut tx, claims.tenant_id).await?;
    let excluded: Vec<String> = body
        .excluded_categories
        .iter()
        .map(|c| c.trim().to_lowercase())
        .collect();
    sqlx::query(
        "UPDATE doctor_payout_settings SET default_basis = $2, default_share_on = $3, \
         default_discount_bearer = $4, default_disallowance_bearer = $5, excluded_categories = $6, \
         tds_section_code = $7, tds_section_label = $8, tds_rate = $9, tds_no_pan_rate = $10, \
         tds_threshold = $11, cash_daily_warn_limit = $12, referral_tds_section_code = $13, \
         referral_tds_rate = $14, referral_tds_threshold = $15, updated_by = $16 \
         WHERE tenant_id = $1",
    )
    .bind(claims.tenant_id)
    .bind(&body.default_basis)
    .bind(&body.default_share_on)
    .bind(&body.default_discount_bearer)
    .bind(&body.default_disallowance_bearer)
    .bind(&excluded)
    .bind(body.tds_section_code.trim())
    .bind(body.tds_section_label.trim())
    .bind(body.tds_rate)
    .bind(body.tds_no_pan_rate)
    .bind(body.tds_threshold)
    .bind(body.cash_daily_warn_limit)
    .bind(body.referral_tds_section_code.trim())
    .bind(body.referral_tds_rate)
    .bind(body.referral_tds_threshold)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;
    let out = settings_body(&mut tx, claims.tenant_id).await?;
    tx.commit().await?;
    Ok(Json(out))
}

#[derive(Debug, Deserialize)]
pub struct ReferralSwitch {
    /// `referral` or `referral_individuals`.
    pub switch: String,
    pub enabled: bool,
    pub acknowledgement: Option<String>,
}

/// POST /api/doctor-payouts/settings/referral — flip a referral switch. On
/// needs the exact acknowledgement text; off needs none. Turning referral
/// payouts off turns individual payouts off with it.
pub async fn set_referral_switch(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ReferralSwitch>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, policy::MANAGE)?;
    let expected = match body.switch.as_str() {
        "referral" => REFERRAL_ACK,
        "referral_individuals" => INDIVIDUAL_ACK,
        _ => return Err(AppError::BadRequest("Unknown switch".to_owned())),
    };
    let ack = body.acknowledgement.as_deref().map(str::trim);
    if body.enabled && ack != Some(expected) {
        return Err(AppError::BadRequest(
            "Switching this on needs the acknowledgement, accepted word for word".to_owned(),
        ));
    }
    let mut tx = begin(&state, &claims).await?;
    let current = load(&mut tx, claims.tenant_id).await?;
    if body.switch == "referral_individuals" && body.enabled && !current.referral_enabled {
        return Err(AppError::Conflict(
            "Switch referral payouts on before paying individual doctors".to_owned(),
        ));
    }
    sqlx::query(
        "INSERT INTO doctor_payout_policy_events (tenant_id, switch, enabled, acknowledgement, acted_by) \
         VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(claims.tenant_id)
    .bind(&body.switch)
    .bind(body.enabled)
    .bind(if body.enabled { ack } else { None })
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;
    let sql = if body.switch == "referral" {
        "UPDATE doctor_payout_settings SET referral_enabled = $2, \
         referral_individuals_enabled = referral_individuals_enabled AND $2, updated_by = $3 \
         WHERE tenant_id = $1"
    } else {
        "UPDATE doctor_payout_settings SET referral_individuals_enabled = $2, updated_by = $3 \
         WHERE tenant_id = $1"
    };
    sqlx::query(sql)
        .bind(claims.tenant_id)
        .bind(body.enabled)
        .bind(claims.sub)
        .execute(&mut *tx)
        .await?;
    let out = settings_body(&mut tx, claims.tenant_id).await?;
    tx.commit().await?;
    Ok(Json(out))
}
