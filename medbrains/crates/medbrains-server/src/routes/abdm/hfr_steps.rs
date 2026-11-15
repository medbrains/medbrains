//! ABDM M4 HFR onboarding — the four saving calls (#5716).
//!
//! Basic, additional and detailed information, then submit. Each is recorded in
//! `abdm_hfr_registrations` with the `trackingId` it carried; the read side
//! (masters, search, the draft) is in `hfr_onboarding`.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_abdm::hfr_onboarding::{
    self as hfr, DetailedInformation, FacilityInformation, LinkedProgramIds, StepOutcome,
};
use medbrains_abdm::{AbdmError, hfr_rules};
use medbrains_core::permissions;
use serde::Serialize;
use serde_json::{Value, json};
use uuid::Uuid;

use super::hfr_onboarding::{hfr_access, hfr_error, refuse, saved_steps, tracking_of};
use super::hpr_session::{HprRole, hpr_token};
use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

/// HFR accepted a step under this `trackingId`.
#[derive(Debug, Serialize)]
pub struct StepSaved {
    pub tracking_id: String,
    pub outcome: StepOutcome,
}

/// HFR's answer to submit.
#[derive(Debug, Serialize)]
pub struct SubmitResult {
    pub tracking_id: String,
    pub facility_id: Option<String>,
    pub status: Option<String>,
    pub message: Option<String>,
}

/// One recorded call.
struct Attempt<'a> {
    step: &'a str,
    tracking_id: &'a str,
    payload: &'a Value,
}

/// Record a step's call and HFR's answer; a saved basic step also keeps the
/// `trackingId` on the campus. Returns the `trackingId` now in force.
async fn record(
    state: &AppState,
    (claims, id): (&Claims, Uuid),
    attempt: &Attempt<'_>,
    outcome: &Result<StepOutcome, AbdmError>,
) -> Result<String, AppError> {
    let tracking = outcome
        .as_ref()
        .ok()
        .and_then(|o| o.tracking_id.clone())
        .unwrap_or_else(|| attempt.tracking_id.to_owned());
    let (status, response, error) = match outcome {
        Ok(o) if o.is_saved() => ("saved", Some(json!(o)), None),
        Ok(o) => ("failed", Some(json!(o)), Some(o.errors.join("; "))),
        Err(e) => ("failed", None, Some(e.to_string())),
    };
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    // allow-raw-sql: runs in the tenant-scoped transaction and filters tenant_id
    sqlx::query!(
        "INSERT INTO abdm_hfr_registrations \
            (tenant_id, facility_id, status, step, tracking_id, payload, response, error_message) \
         VALUES ($1, $2, $3, $4, NULLIF($5, ''), $6, $7, $8)",
        claims.tenant_id,
        id,
        status,
        attempt.step,
        tracking,
        attempt.payload,
        response,
        error
    )
    .execute(&mut *tx)
    .await?;
    if !tracking.is_empty() {
        // allow-raw-sql: runs in the tenant-scoped transaction and filters tenant_id
        sqlx::query!(
            "UPDATE facilities SET hfr_tracking_id = $3 \
             WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
            id,
            claims.tenant_id,
            tracking
        )
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;
    Ok(tracking)
}

/// Record, then answer: HFR's refused fields or an outage become errors.
async fn finish(
    state: &AppState,
    (claims, id): (&Claims, Uuid),
    attempt: &Attempt<'_>,
    outcome: Result<StepOutcome, AbdmError>,
) -> Result<Json<StepSaved>, AppError> {
    let tracking_id = record(state, (claims, id), attempt, &outcome).await?;
    let outcome = outcome.map_err(hfr_error)?;
    if !outcome.is_saved() {
        return Err(AppError::BadRequest(format!(
            "HFR refused: {}",
            outcome.errors.join("; ")
        )));
    }
    Ok(Json(StepSaved {
        tracking_id,
        outcome,
    }))
}

/// `POST /api/abdm/hfr/facilities/{id}/onboarding/basic` — HFR-010…038 and,
/// with a kept `trackingId`, the update HFR-064…092.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn save_basic(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(mut info): Json<FacilityInformation>,
) -> Result<Json<StepSaved>, AppError> {
    require_permission(&claims, permissions::abdm::hfr::REGISTER)?;
    // HFR-013: the country is India and is not the user's to change.
    "India".clone_into(&mut info.facility_address_details.country);
    refuse(&hfr_rules::check_basic(&info))?;
    let manager = hpr_token(&claims, HprRole::Manager).ok_or_else(|| {
        AppError::BadRequest("sign in to HPR as the facility manager first".into())
    })?;
    let tracking = tracking_of(&state, &claims, id).await?;
    let access = hfr_access(&state, &claims).await?;
    // ponytail: two first saves at once could open two HFR records; the
    // screen sends one at a time. Add a row lock if a second writer appears.
    let outcome = hfr::hfr_save_basic(
        &access.http,
        &access.base_url,
        &access.token,
        &manager,
        (&tracking, &info),
    )
    .await;
    let payload = json!(info);
    let attempt = Attempt {
        step: "basic",
        tracking_id: &tracking,
        payload: &payload,
    };
    finish(&state, (&claims, id), &attempt, outcome).await
}

/// `POST /api/abdm/hfr/facilities/{id}/onboarding/additional` — HFR-039…046.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn save_additional(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(ids): Json<LinkedProgramIds>,
) -> Result<Json<StepSaved>, AppError> {
    require_permission(&claims, permissions::abdm::hfr::REGISTER)?;
    refuse(&hfr_rules::check_additional(&ids))?;
    let payload = json!({ "linkedProgramIds": ids });
    save_later_step(
        &state,
        (&claims, id),
        hfr::HFR_ADDITIONAL_PATH,
        "additional",
        payload,
    )
    .await
}

/// `POST /api/abdm/hfr/facilities/{id}/onboarding/detailed` — HFR-047…061;
/// the totals are computed here, never taken from the form.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn save_detailed(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(mut detailed): Json<DetailedInformation>,
) -> Result<Json<StepSaved>, AppError> {
    require_permission(&claims, permissions::abdm::hfr::REGISTER)?;
    let systems = saved_systems(&state, &claims, id).await?;
    detailed.medical_infrastructure = detailed.medical_infrastructure.with_totals();
    refuse(&hfr_rules::check_detailed(&detailed, &systems))?;
    let payload = json!(detailed);
    save_later_step(
        &state,
        (&claims, id),
        hfr::HFR_DETAILED_PATH,
        "detailed",
        payload,
    )
    .await
}

/// The systems of medicine in the saved basic step (HFR-047 needs them).
async fn saved_systems(state: &AppState, claims: &Claims, id: Uuid) -> Result<String, AppError> {
    let tracking = tracking_of(state, claims, id).await?;
    if tracking.is_empty() {
        return Err(AppError::BadRequest("save basic information first".into()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let steps = saved_steps(&mut tx, (claims.tenant_id, id), &tracking).await?;
    tx.commit().await?;
    let basic = steps.iter().find(|s| s.0 == "basic");
    Ok(basic
        .and_then(|s| s.1.get("systemOfMedicineCode").and_then(Value::as_str))
        .unwrap_or_default()
        .to_owned())
}

/// Additional or detailed: needs a `trackingId` from a saved basic step.
async fn save_later_step(
    state: &AppState,
    (claims, id): (&Claims, Uuid),
    path: &str,
    step: &str,
    payload: Value,
) -> Result<Json<StepSaved>, AppError> {
    let tracking = tracking_of(state, claims, id).await?;
    if tracking.is_empty() {
        return Err(AppError::BadRequest("save basic information first".into()));
    }
    let access = hfr_access(state, claims).await?;
    let outcome = hfr::hfr_save_step(
        &access.http,
        &access.base_url,
        &access.token,
        (path, &tracking),
        &payload,
    )
    .await;
    let attempt = Attempt {
        step,
        tracking_id: &tracking,
        payload: &payload,
    };
    finish(state, (claims, id), &attempt, outcome).await
}

/// `POST /api/abdm/hfr/facilities/{id}/onboarding/submit` — HFR-062/063 and
/// the resubmit HFR-116/117, with the manager's and verifier's HPR tokens.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn submit(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<SubmitResult>, AppError> {
    require_permission(&claims, permissions::abdm::hfr::REGISTER)?;
    let tracking = tracking_of(&state, &claims, id).await?;
    if tracking.is_empty() {
        return Err(AppError::BadRequest("save basic information first".into()));
    }
    let signed = |role, who: &str| {
        hpr_token(&claims, role)
            .ok_or_else(|| AppError::BadRequest(format!("sign in to HPR as the {who} first")))
    };
    let (manager, verifier) = (
        signed(HprRole::Manager, "facility manager")?,
        signed(HprRole::Verifier, "verifier")?,
    );
    let access = hfr_access(&state, &claims).await?;
    let outcome = hfr::hfr_submit(
        &access.http,
        &access.base_url,
        &access.token,
        &tracking,
        (&manager, &verifier),
    )
    .await;
    record_submit(&state, (&claims, id), &tracking, outcome).await
}

/// Keep the submit call; a success marks the campus submitted (a verified
/// campus stays verified on resubmit) and keeps an issued facility ID.
async fn record_submit(
    state: &AppState,
    (claims, id): (&Claims, Uuid),
    tracking: &str,
    outcome: Result<hfr::SubmitOutcome, AbdmError>,
) -> Result<Json<SubmitResult>, AppError> {
    let (status, response, error) = match &outcome {
        Ok(o) if o.errors.is_empty() => ("submitted", Some(json!(o)), None),
        Ok(o) => ("failed", Some(json!(o)), Some(o.errors.join("; "))),
        Err(e) => ("failed", None, Some(e.to_string())),
    };
    let issued = outcome
        .as_ref()
        .ok()
        .and_then(|o| o.facility_id.as_deref())
        .filter(|f| hfr_rules::is_hfr_id(f))
        .map(str::to_ascii_uppercase);
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    // allow-raw-sql: runs in the tenant-scoped transaction and filters tenant_id
    sqlx::query!(
        "INSERT INTO abdm_hfr_registrations \
            (tenant_id, facility_id, status, step, tracking_id, payload, response, \
             nha_facility_id, error_message) \
         VALUES ($1, $2, $3, 'submit', $4, '{}'::jsonb, $5, $6, $7)",
        claims.tenant_id,
        id,
        status,
        tracking,
        response,
        issued.as_deref(),
        error
    )
    .execute(&mut *tx)
    .await?;
    if status == "submitted" {
        // allow-raw-sql: runs in the tenant-scoped transaction and filters tenant_id
        sqlx::query!(
            "UPDATE facilities SET \
                hfr_status = CASE WHEN hfr_status = 'verified' THEN 'verified' ELSE 'submitted' END, \
                hfr_facility_id = COALESCE($3, hfr_facility_id) \
             WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
            id,
            claims.tenant_id,
            issued.as_deref()
        )
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;
    let outcome = outcome.map_err(hfr_error)?;
    if !outcome.errors.is_empty() {
        return Err(AppError::BadRequest(format!(
            "HFR refused: {}",
            outcome.errors.join("; ")
        )));
    }
    Ok(Json(SubmitResult {
        tracking_id: tracking.to_owned(),
        facility_id: outcome.facility_id,
        status: outcome.status,
        message: outcome.message,
    }))
}
