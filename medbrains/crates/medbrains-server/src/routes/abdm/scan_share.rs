//! ABDM Scan & Share, staff side.
//!
//! - `GET  /api/abdm/scan-share/counters` — each registration counter's QR
//!   (`abdm.scanshare.manage`).
//! - `GET  /api/abdm/scan-share/queue` — today's shares at the counters
//!   (`abdm.scanshare.view`). Shares left waiting past their expiry are
//!   marked expired here, a bounded batch per read; no job does it.
//! - `POST /api/abdm/scan-share/{id}/verification` — record the shared
//!   profile as an ABDM-verified ABHA, built from the stored share, so the
//!   registration form can link it through `link_verified_abha`.
//! - `POST /api/abdm/scan-share/{id}/complete` — the share is dealt with:
//!   the patient is the one it matched or the one its verification linked
//!   (registered from it, or an existing patient found by search).
//! - `POST /api/abdm/scan-share/{id}/dismiss` — not acted on; its token is
//!   cancelled.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, Utc};
use medbrains_abdm::{AbdmEnvironment, scan_share::counter_qr_payload};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::abha::stored_abdm_config;
use super::abha_common::{VerificationStep, VerifiedProfile, digits, record_verified};
use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

/// Counters and HIP IDs shown at most; a hospital has a handful of each.
const COUNTER_LIMIT: i64 = 200;
const FACILITY_LIMIT: i64 = 20;
/// Shares listed for one day; a busy desk sees a few hundred.
const QUEUE_LIMIT: i64 = 300;
/// Waiting shares expired per read.
const SWEEP_LIMIT: i64 = 500;
/// How long the desk has to use a share's verification.
const VERIFICATION_MINUTES: i32 = 30;
/// Station types that are registration counters.
const COUNTER_TYPES: [&str; 2] = ["reception", "opd_counter"];

#[derive(Debug, Serialize)]
pub struct CounterQr {
    pub facility_id: Uuid,
    pub facility_name: String,
    pub hip_id: String,
    /// What the QR encodes.
    pub payload: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ScanShareCounter {
    pub station_id: Uuid,
    pub code: String,
    pub name: String,
    pub station_type: String,
    pub qr_codes: Vec<CounterQr>,
}

#[derive(Debug, Serialize)]
pub struct ScanShareCounters {
    pub hospital_name: String,
    pub environment: AbdmEnvironment,
    pub counters: Vec<ScanShareCounter>,
}

type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

async fn begin(state: &AppState, claims: &Claims) -> Result<Tx<'static>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    Ok(tx)
}

/// `GET /api/abdm/scan-share/counters`
///
/// # Errors
/// 403 without `abdm.scanshare.manage`.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn counters(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<ScanShareCounters>, AppError> {
    require_permission(&claims, permissions::abdm::scanshare::MANAGE)?;
    let mut tx = begin(&state, &claims).await?;
    let environment = stored_abdm_config(&mut tx, &claims.tenant_id)
        .await?
        .environment
        .unwrap_or(AbdmEnvironment::Sandbox);
    let hospital_name: String = sqlx::query_scalar("SELECT name FROM tenants WHERE id = $1")
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?;
    let facilities = sqlx::query_as::<_, (Uuid, String, String)>(
        "SELECT id, name, hfr_facility_id FROM facilities \
          WHERE tenant_id = $1 AND deleted_at IS NULL AND hfr_facility_id IS NOT NULL \
          ORDER BY parent_id NULLS FIRST, name LIMIT $2",
    )
    .bind(claims.tenant_id)
    .bind(FACILITY_LIMIT)
    .fetch_all(&mut *tx)
    .await?;
    let stations = sqlx::query_as::<_, (Uuid, String, String, String)>(
        "SELECT id, code, name, station_type FROM stations \
          WHERE tenant_id = $1 AND deleted_at IS NULL AND is_active AND station_type = ANY($2) \
          ORDER BY name LIMIT $3",
    )
    .bind(claims.tenant_id)
    .bind(&COUNTER_TYPES[..])
    .bind(COUNTER_LIMIT)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    let counters = stations
        .into_iter()
        .map(|(station_id, code, name, station_type)| ScanShareCounter {
            qr_codes: facilities
                .iter()
                .map(|(facility_id, facility_name, hip_id)| CounterQr {
                    facility_id: *facility_id,
                    facility_name: facility_name.clone(),
                    hip_id: hip_id.clone(),
                    payload: counter_qr_payload(environment, hip_id, &code),
                })
                .collect(),
            station_id,
            code,
            name,
            station_type,
        })
        .collect();
    Ok(Json(ScanShareCounters {
        hospital_name,
        environment,
        counters,
    }))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ProfileShareRow {
    pub id: Uuid,
    pub station_id: Option<Uuid>,
    pub counter_name: Option<String>,
    pub token_number: Option<String>,
    pub status: String,
    pub abha_number: Option<String>,
    pub abha_address: String,
    /// The shared profile: name, gender, date of birth, mobile, address.
    pub profile: serde_json::Value,
    pub patient_id: Option<Uuid>,
    pub patient_uhid: Option<String>,
    pub patient_name: Option<String>,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

const ROW_SELECT: &str = "SELECT s.id, s.station_id, st.name AS counter_name, s.token_number, \
       s.status, s.abha_number, s.abha_address, s.profile, s.patient_id, \
       p.uhid AS patient_uhid, \
       NULLIF(btrim(concat_ws(' ', p.first_name, p.last_name)), '') AS patient_name, \
       s.expires_at, s.created_at \
  FROM abdm_profile_shares s \
  LEFT JOIN stations st ON st.id = s.station_id \
  LEFT JOIN patients p ON p.id = s.patient_id";

/// `GET /api/abdm/scan-share/queue`
///
/// # Errors
/// 403 without `abdm.scanshare.view`.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn queue(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<ProfileShareRow>>, AppError> {
    require_permission(&claims, permissions::abdm::scanshare::VIEW)?;
    let mut tx = begin(&state, &claims).await?;
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    sqlx::query(
        "UPDATE abdm_profile_shares SET status = 'expired' \
          WHERE id IN (SELECT id FROM abdm_profile_shares \
             WHERE tenant_id = $1 AND status = 'waiting' AND expires_at <= now() \
               AND deleted_at IS NULL LIMIT $2)",
    )
    .bind(claims.tenant_id)
    .bind(SWEEP_LIMIT)
    .execute(&mut *tx)
    .await?;
    let rows = sqlx::query_as::<_, ProfileShareRow>(&format!(
        "{ROW_SELECT} WHERE s.tenant_id = $1 AND s.deleted_at IS NULL \
           AND s.created_at >= date_trunc('day', now()) \
         ORDER BY s.created_at DESC LIMIT $2"
    ))
    .bind(claims.tenant_id)
    .bind(QUEUE_LIMIT)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

async fn load(tx: &mut Tx<'_>, claims: &Claims, id: Uuid) -> Result<ProfileShareRow, AppError> {
    sqlx::query_as::<_, ProfileShareRow>(&format!(
        "{ROW_SELECT} WHERE s.tenant_id = $1 AND s.id = $2 AND s.deleted_at IS NULL"
    ))
    .bind(claims.tenant_id)
    .bind(id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)
}

/// The stored share as the profile the desk's ABHA screens use.
fn verified_profile(row: &ProfileShareRow, abha_number: String) -> VerifiedProfile {
    let p = &row.profile;
    let text = |k: &str| p[k].as_str().map(str::to_owned);
    VerifiedProfile {
        abha_number,
        abha_address: Some(row.abha_address.clone()),
        full_name: text("full_name"),
        first_name: text("first_name"),
        middle_name: text("middle_name"),
        last_name: text("last_name"),
        date_of_birth: text("date_of_birth"),
        year_of_birth: text("year_of_birth"),
        gender: text("gender"),
        mobile_masked: text("mobile"),
        email: None,
        address: text("address"),
        pincode: text("pincode"),
        state: text("state"),
        district: text("district"),
        kyc_verified: false,
        photo: None,
    }
}

/// `POST /api/abdm/scan-share/{id}/verification`
///
/// # Errors
/// 403 without `abdm.scanshare.view` and `abdm.abha.manage`; 404 for an
/// unknown share; 409 when it is no longer waiting; 400 when it carried no
/// ABHA number.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn verification(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<VerificationStep>, AppError> {
    require_permission(&claims, permissions::abdm::scanshare::VIEW)?;
    require_permission(&claims, permissions::abdm::abha::MANAGE)?;
    let mut tx = begin(&state, &claims).await?;
    let row = load(&mut tx, &claims, id).await?;
    if !matches!(row.status.as_str(), "waiting" | "expired") {
        return Err(AppError::Conflict(format!(
            "this share is already {}",
            row.status
        )));
    }
    let number = row.abha_number.as_deref().map(digits).ok_or_else(|| {
        AppError::BadRequest(
            "this share carried no ABHA number — verify the ABHA at the desk instead".to_owned(),
        )
    })?;
    let environment = stored_abdm_config(&mut tx, &claims.tenant_id)
        .await?
        .environment
        .unwrap_or(AbdmEnvironment::Sandbox);
    let env_name = match environment {
        AbdmEnvironment::Sandbox => "sandbox",
        AbdmEnvironment::Production => "production",
    };
    let verification_id: Uuid = sqlx::query_scalar(
        "INSERT INTO abha_verifications (tenant_id, created_by, method, otp_system, environment, \
            abdm_txn_id, expires_at) \
         SELECT $1, $2, 'scan_share', 'abdm', $3, request_id, \
                now() + make_interval(mins => $4) \
           FROM abdm_profile_shares WHERE tenant_id = $1 AND id = $5 \
         RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(env_name)
    .bind(VERIFICATION_MINUTES)
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    sqlx::query(
        "UPDATE abdm_profile_shares SET verification_id = $3 WHERE tenant_id = $1 AND id = $2",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .bind(verification_id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    record_verified(
        &state,
        &claims,
        verification_id,
        verified_profile(&row, number),
    )
    .await
}

#[derive(Debug, Deserialize)]
pub struct CompleteShare {
    pub patient_id: Uuid,
}

/// `POST /api/abdm/scan-share/{id}/complete` — the patient was opened,
/// registered, or found by search and linked. Only the patient the share
/// matched, or the one its verification was linked to, is accepted: a patient
/// found by search qualifies only after `POST /api/abdm/abha/verifications/
/// {id}/link`, which checks the tenant, the caller's access to that patient
/// and that it carries no other ABHA, and audits the link.
///
/// # Errors
/// 403 without `abdm.scanshare.view`; 404 for an unknown share; 400 for any
/// other patient; 409 when the share was dismissed or already dealt with.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn complete(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CompleteShare>,
) -> Result<Json<ProfileShareRow>, AppError> {
    require_permission(&claims, permissions::abdm::scanshare::VIEW)?;
    let mut tx = begin(&state, &claims).await?;
    let status: Option<String> = sqlx::query_scalar(
        "UPDATE abdm_profile_shares s SET \
           status = CASE WHEN s.patient_id IS NULL AND EXISTS (SELECT 1 FROM patients n \
                 WHERE n.id = $3 AND n.created_at >= s.created_at) \
               THEN 'registered' ELSE 'linked' END, \
           patient_id = $3, acted_by = $4, acted_at = now() \
          WHERE s.tenant_id = $1 AND s.id = $2 AND s.status IN ('waiting', 'expired') \
            AND (s.patient_id = $3 OR EXISTS (SELECT 1 FROM abha_verifications v \
                 WHERE v.id = s.verification_id AND v.tenant_id = s.tenant_id \
                   AND v.linked_patient_id = $3)) \
          RETURNING status",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .bind(body.patient_id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?;
    if status.is_none() {
        let row = load(&mut tx, &claims, id).await?;
        return Err(if matches!(row.status.as_str(), "waiting" | "expired") {
            AppError::BadRequest("that patient is not the one this ABHA was shared for".to_owned())
        } else {
            AppError::Conflict(format!("this share is already {}", row.status))
        });
    }
    // The registration token now names the patient, for the desk console.
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    sqlx::query(
        "UPDATE tokens SET patient_id = $3 \
          WHERE tenant_id = $1 AND id = (SELECT token_id FROM abdm_profile_shares \
                 WHERE tenant_id = $1 AND id = $2) AND patient_id IS NULL",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .bind(body.patient_id)
    .execute(&mut *tx)
    .await?;
    let row = load(&mut tx, &claims, id).await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// `POST /api/abdm/scan-share/{id}/dismiss`
///
/// # Errors
/// 403 without `abdm.scanshare.view`; 404 for an unknown share; 409 when it
/// was already dealt with.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn dismiss(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<ProfileShareRow>, AppError> {
    require_permission(&claims, permissions::abdm::scanshare::VIEW)?;
    let mut tx = begin(&state, &claims).await?;
    let token: Option<Option<Uuid>> = sqlx::query_scalar(
        "UPDATE abdm_profile_shares SET status = 'dismissed', acted_by = $3, acted_at = now() \
          WHERE tenant_id = $1 AND id = $2 AND status IN ('waiting', 'expired') \
          RETURNING token_id",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?;
    let Some(token) = token else {
        let row = load(&mut tx, &claims, id).await?;
        return Err(AppError::Conflict(format!(
            "this share is already {}",
            row.status
        )));
    };
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    sqlx::query(
        "UPDATE tokens SET status = 'cancelled' \
          WHERE tenant_id = $1 AND id = $2 AND status = 'waiting'",
    )
    .bind(claims.tenant_id)
    .bind(token)
    .execute(&mut *tx)
    .await?;
    let row = load(&mut tx, &claims, id).await?;
    tx.commit().await?;
    Ok(Json(row))
}
