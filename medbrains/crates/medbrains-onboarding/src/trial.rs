//! Self-serve trials: a hospital signs itself up on the trial server, gets 30
//! days without a card, and is told up front what running it would take.
//!
//! Only a server started with `TRIAL_SIGNUP=open` takes sign-ups beyond its
//! first hospital — the trial server. A hospital's own server never does: an
//! open door there would let a stranger create an organisation beside that
//! hospital's patients.

use axum::Json;
use chrono::{DateTime, Duration, Utc};
use medbrains_server_core::error::AppError;
use serde::Deserialize;
use uuid::Uuid;

use crate::sizing::{self, MAX_BEDS, MAX_STAFF, Placement, Sizing, SizingInput};

/// The length of a self-serve trial. No card is asked for.
pub const TRIAL_DAYS: i64 = 30;

/// Sign-ups one network address may start in a day before it is refused.
const MAX_SIGNUPS_PER_ADDRESS_PER_DAY: i64 = 3;

/// Whether this server takes sign-ups from anyone (the trial server).
pub fn signup_open() -> bool {
    std::env::var("TRIAL_SIGNUP").is_ok_and(|v| v.eq_ignore_ascii_case("open"))
}

/// What the sign-up page sends about the facility, beside the hospital and
/// admin details the wizard always took.
#[derive(Debug, Clone, Deserialize)]
pub struct TrialPlan {
    pub beds: u32,
    pub staff_users: u32,
    #[serde(default)]
    pub imaging: bool,
    pub placement: Placement,
}

impl TrialPlan {
    fn sizing_input(&self) -> SizingInput {
        SizingInput {
            beds: self.beds,
            staff_users: self.staff_users,
            imaging: self.imaging,
            placement: self.placement,
        }
    }
}

fn check_bounds(beds: u32, staff_users: u32) -> Result<(), AppError> {
    if beds > MAX_BEDS || staff_users == 0 || staff_users > MAX_STAFF {
        return Err(AppError::BadRequest(format!(
            "Beds must be 0–{MAX_BEDS} and staff 1–{MAX_STAFF}"
        )));
    }
    Ok(())
}

/// `POST /api/onboarding/sizing` — public: the quote the sign-up page shows.
pub async fn quote(Json(input): Json<SizingInput>) -> Result<Json<Sizing>, AppError> {
    check_bounds(input.beds, input.staff_users)?;
    Ok(Json(sizing::recommend(&input)))
}

/// The address the sign-up came from, as the proxy forwards it.
pub fn client_ip(headers: &axum::http::HeaderMap) -> Option<String> {
    headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.split(',').next())
        .map(|ip| ip.trim().to_owned())
        .filter(|ip| !ip.is_empty())
}

/// Refuse a fourth trial from the same address in a day.
pub async fn throttle(db: &sqlx::PgPool, ip: Option<&str>) -> Result<(), AppError> {
    let Some(ip) = ip else { return Ok(()) };
    let recent: i64 = sqlx::query_scalar("SELECT public.app_recent_trial_signups($1)")
        .bind(ip)
        .fetch_one(db)
        .await?;
    if recent >= MAX_SIGNUPS_PER_ADDRESS_PER_DAY {
        return Err(AppError::Conflict(
            "Several trials have already been started from this network today. \
             Write to hello@medbrains.in and we will set one up for you."
                .to_owned(),
        ));
    }
    Ok(())
}

/// Record the trial, inside the transaction that creates the hospital.
pub async fn start(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    plan: &TrialPlan,
    ip: Option<&str>,
) -> Result<DateTime<Utc>, AppError> {
    check_bounds(plan.beds, plan.staff_users)?;
    let quoted = serde_json::to_value(sizing::recommend(&plan.sizing_input()))
        .map_err(|e| AppError::Internal(format!("sizing: {e}")))?;
    let placement = serde_json::to_value(plan.placement)
        .map_err(|e| AppError::Internal(format!("placement: {e}")))?;
    let ends = Utc::now() + Duration::days(TRIAL_DAYS);
    sqlx::query(
        "INSERT INTO tenant_subscriptions \
           (tenant_id, status, placement, beds, staff_users, imaging, sizing, trial_ends_at, signup_ip) \
         VALUES ($1, 'trial', $2, $3, $4, $5, $6, $7, $8)",
    )
    .bind(tenant_id)
    .bind(placement.as_str().unwrap_or("shared_cloud"))
    .bind(i32::try_from(plan.beds).unwrap_or(0))
    .bind(i32::try_from(plan.staff_users).unwrap_or(1))
    .bind(plan.imaging)
    .bind(quoted)
    .bind(ends)
    .bind(ip)
    .execute(&mut **tx)
    .await?;
    Ok(ends)
}
