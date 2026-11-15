//! ABDM M4 HFR onboarding — the official flow, one campus at a time
//! (#5716; NHA HFR workbook sheets "Search facility", "Registration",
//! "Facility update").
//!
//! Settings → Facilities → HFR opens a stepped screen that calls, in order:
//! search (no duplicate record), basic → additional → detailed information
//! (the first basic save returns the `trackingId`, kept on the campus), and
//! submit with the manager's and verifier's HPR tokens (`hpr_session`). An
//! update is the same steps with the kept `trackingId`, then a resubmit.
//!
//! This file is the read side: master lists, the dedupe search and the
//! draft. The saving calls are in `hfr_steps`; each is recorded in
//! `abdm_hfr_registrations`, and the latest saved row per step is the draft
//! the screen resumes from. Field rules: `medbrains_abdm::hfr_rules`.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, Utc};
use medbrains_abdm::hfr_onboarding::{
    self as hfr, FacilitySearch, Master, MasterOption, SearchPage,
};
use medbrains_abdm::{AbdmError, hfr_rules, registry};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use super::hpr_session::{HprSessionView, hpr_sessions};
use super::registry_access::{
    Registry, RegistryAccess, registry_access, registry_configured, registry_fault,
};
use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

/// `get-master-data` types the form uses; anything else is refused so the
/// endpoint is not an open proxy.
const MASTER_DATA_TYPES: [&str; 6] = [
    "OWNER",
    "FAC-STATUS",
    "WORKING-DAYS",
    "MEDICINE",
    "SPECIALITY-TYPE",
    "CENTRAL-GOVERNMENT",
];

/// Where a campus is in onboarding, and what each saved step holds.
#[derive(Debug, Serialize)]
pub struct OnboardingDraft {
    pub registry_configured: bool,
    pub tracking_id: Option<String>,
    pub hfr_status: String,
    pub hfr_facility_id: Option<String>,
    pub basic: Option<Value>,
    pub additional: Option<Value>,
    pub detailed: Option<Value>,
    pub submitted_at: Option<DateTime<Utc>>,
    pub hpr_sessions: Vec<HprSessionView>,
}

/// `?code=&code2=` for master lists that hang off a parent choice.
#[derive(Debug, Default, Deserialize)]
#[serde(default)]
pub struct MasterQuery {
    pub code: String,
    pub code2: String,
}

/// The registry, or 503 when no ABDM keys exist.
pub(super) async fn hfr_access(
    state: &AppState,
    claims: &Claims,
) -> Result<RegistryAccess, AppError> {
    registry_access(state, &claims.tenant_id, Registry::Hfr)
        .await?
        .ok_or_else(|| {
            AppError::ServiceUnavailable(
                "ABDM keys are not configured — HFR onboarding is not possible yet".to_owned(),
            )
        })
}

/// 400 listing each refused field with its workbook case.
pub(super) fn refuse(errors: &[hfr_rules::FieldError]) -> Result<(), AppError> {
    if errors.is_empty() {
        return Ok(());
    }
    let list: Vec<String> = errors
        .iter()
        .map(|e| format!("{} {}: {}", e.case, e.field, e.message))
        .collect();
    Err(AppError::BadRequest(list.join("; ")))
}

/// A registry refusal (4xx) is the hospital's to fix; anything else is an
/// outage.
pub(super) fn hfr_error(e: AbdmError) -> AppError {
    match e {
        AbdmError::Status { status, message } if status.is_client_error() => {
            AppError::BadRequest(format!("HFR refused the call: {message}"))
        }
        other => registry_fault(&other),
    }
}

/// `GET /api/abdm/hfr/masters/{kind}` — one HFR master list for a dropdown.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn masters(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(kind): Path<String>,
    Query(q): Query<MasterQuery>,
) -> Result<Json<Vec<MasterOption>>, AppError> {
    require_permission(&claims, permissions::abdm::hfr::REGISTER)?;
    let master = master_of(&kind, q)?;
    let access = hfr_access(&state, &claims).await?;
    let list = hfr::hfr_master(&access.http, &access.base_url, &access.token, &master)
        .await
        .map_err(|e| registry_fault(&e))?;
    Ok(Json(list))
}

/// Map the path and query to a master list, refusing unknown kinds and
/// codes that are not codes.
fn master_of(kind: &str, q: MasterQuery) -> Result<Master, AppError> {
    let code = |v: &str| {
        hfr_rules::is_code(v)
            .then(|| v.to_owned())
            .ok_or_else(|| AppError::BadRequest(format!("{kind} needs a parent code")))
    };
    Ok(match kind {
        "states" => Master::States,
        "districts" => Master::Districts {
            state_code: code(&q.code)?,
        },
        "sub-districts" => Master::SubDistricts {
            district_code: code(&q.code)?,
        },
        "data" if MASTER_DATA_TYPES.contains(&q.code.as_str()) => Master::Data { kind: q.code },
        "owner-subtypes" => Master::OwnerSubtypes {
            ownership_code: code(&q.code)?,
            owner_subtype_code: if q.code2.is_empty() {
                String::new()
            } else {
                code(&q.code2)?
            },
        },
        "facility-types"
            if hfr_rules::codes(&q.code2)
                .iter()
                .all(|c| hfr_rules::is_code(c)) =>
        {
            Master::FacilityTypes {
                ownership_code: code(&q.code)?,
                system_of_medicine_code: q.code2,
            }
        }
        "facility-sub-types" => Master::FacilitySubTypes {
            facility_type_code: code(&q.code)?,
        },
        "specialities" => Master::Specialities {
            system_of_medicine_code: code(&q.code)?,
        },
        _ => {
            return Err(AppError::BadRequest(format!(
                "unknown HFR master list {kind}"
            )));
        }
    })
}

/// `POST /api/abdm/hfr/search` — the dedupe search before registering.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn search(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(q): Json<FacilitySearch>,
) -> Result<Json<SearchPage>, AppError> {
    require_permission(&claims, permissions::abdm::hfr::REGISTER)?;
    refuse(&hfr_rules::check_search(&q))?;
    let access = hfr_access(&state, &claims).await?;
    let page = registry::hfr_search_page(&access.http, &access.base_url, &access.token, &q)
        .await
        .map_err(|e| registry_fault(&e))?;
    Ok(Json(page))
}

/// `GET /api/abdm/hfr/facilities/{id}/onboarding` — the draft to resume.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn draft(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<OnboardingDraft>, AppError> {
    require_permission(&claims, permissions::abdm::hfr::REGISTER)?;
    let registry_configured = registry_configured(&state, &claims.tenant_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    // allow-raw-sql: runs in the tenant-scoped transaction and filters tenant_id
    let campus = sqlx::query!(
        "SELECT hfr_tracking_id, hfr_status, hfr_facility_id FROM facilities \
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
        id,
        claims.tenant_id
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let steps = match campus.hfr_tracking_id.as_deref() {
        Some(tracking) => saved_steps(&mut tx, (claims.tenant_id, id), tracking).await?,
        None => Vec::new(),
    };
    tx.commit().await?;
    let step = |name: &str| steps.iter().find(|s| s.0 == name);
    Ok(Json(OnboardingDraft {
        registry_configured,
        tracking_id: campus.hfr_tracking_id,
        hfr_status: campus.hfr_status,
        hfr_facility_id: campus.hfr_facility_id,
        basic: step("basic").map(|s| s.1.clone()),
        additional: step("additional").map(|s| s.1.clone()),
        detailed: step("detailed").map(|s| s.1.clone()),
        submitted_at: step("submit").map(|s| s.2),
        hpr_sessions: hpr_sessions(&claims),
    }))
}

/// The latest saved request per step under `tracking`.
pub(super) async fn saved_steps(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    (tenant_id, facility_id): (Uuid, Uuid),
    tracking: &str,
) -> Result<Vec<(String, Value, DateTime<Utc>)>, AppError> {
    // allow-raw-sql: runs in the tenant-scoped transaction and filters tenant_id
    let rows = sqlx::query!(
        r#"SELECT DISTINCT ON (step) step AS "step!", payload, submitted_at
           FROM abdm_hfr_registrations
           WHERE tenant_id = $1 AND facility_id = $2 AND tracking_id = $3
             AND step IS NOT NULL AND status IN ('saved', 'submitted') AND deleted_at IS NULL
           ORDER BY step, submitted_at DESC"#,
        tenant_id,
        facility_id,
        tracking
    )
    .fetch_all(&mut **tx)
    .await?;
    Ok(rows
        .into_iter()
        .map(|r| (r.step, r.payload, r.submitted_at))
        .collect())
}

/// The campus's `trackingId`, `""` before the first basic save.
pub(super) async fn tracking_of(
    state: &AppState,
    claims: &Claims,
    id: Uuid,
) -> Result<String, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    // allow-raw-sql: runs in the tenant-scoped transaction and filters tenant_id
    let tracking = sqlx::query_scalar!(
        "SELECT hfr_tracking_id FROM facilities \
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
        id,
        claims.tenant_id
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(tracking.unwrap_or_default())
}
