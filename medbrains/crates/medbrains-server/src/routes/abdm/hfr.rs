//! ABDM HFR — Health Facility Registry, one entry per campus.
//!
//! NHA issues an HFR ID per physical facility, so each row of `facilities`
//! carries its own ID and status (migration 1104). Two ways onto the registry,
//! both from Settings → Facilities:
//!   - link an ID the hospital already holds — confirmed against HFR search
//!     when ABDM keys are configured (`verified`), recorded as `registered`
//!     when they are not;
//!   - submit a registration through the HFR API (`submitted`), recorded in
//!     `abdm_hfr_registrations` with the request and HFR's answer.
//!
//! Registry hosts and the session token come from `registry_access`.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, Utc};
use medbrains_abdm::{AbdmError, registry};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use super::registry_access::{Registry, registry_access, registry_configured, registry_fault};
use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

/// DHIS (Digital Health Incentive Scheme) needs at least this many beds with IPD.
const DHIS_MIN_BEDS: i32 = 10;

const FACILITY_COLUMNS: &str = "id, code, name, facility_type::text AS facility_type, \
    bed_count, is_active, hfr_facility_id, hfr_status, hfr_bed_count, hfr_ipd, hfr_checked_at";

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct HfrRegistration {
    pub id: Uuid,
    pub facility_id: Option<Uuid>,
    pub status: String,
    pub nha_facility_id: Option<String>,
    pub error_message: Option<String>,
    pub submitted_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct FacilityHfr {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub facility_type: String,
    pub bed_count: i32,
    pub is_active: bool,
    pub hfr_facility_id: Option<String>,
    pub hfr_status: String,
    pub hfr_bed_count: Option<i32>,
    pub hfr_ipd: bool,
    pub hfr_checked_at: Option<DateTime<Utc>>,
    #[sqlx(skip)]
    pub dhis_eligible: bool,
}

impl FacilityHfr {
    fn with_dhis(mut self) -> Self {
        self.dhis_eligible = self.hfr_ipd && self.hfr_bed_count.unwrap_or(0) >= DHIS_MIN_BEDS;
        self
    }
}

#[derive(Debug, Serialize)]
pub struct FacilityHfrList {
    /// Whether ABDM keys exist, so linking verifies against HFR.
    pub registry_configured: bool,
    pub facilities: Vec<FacilityHfr>,
}

#[derive(Debug, Deserialize)]
pub struct LinkHfrRequest {
    /// `None` / empty unlinks the campus.
    pub hfr_facility_id: Option<String>,
    pub hfr_bed_count: Option<i32>,
    #[serde(default)]
    pub hfr_ipd: bool,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct RegisterHfrRequest {
    /// `government` | `private` | `trust`.
    pub ownership: String,
    pub state_lgd_code: String,
    pub district_lgd_code: String,
    pub pincode: String,
    pub hfr_bed_count: Option<i32>,
    #[serde(default)]
    pub hfr_ipd: bool,
    #[serde(default)]
    pub specializations: Vec<String>,
}

pub async fn list_registrations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<HfrRegistration>>, AppError> {
    require_permission(&claims, permissions::abdm::hfr::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, HfrRegistration>(
        "SELECT id, facility_id, status, nha_facility_id, error_message, submitted_at, \
                updated_at \
         FROM abdm_hfr_registrations \
         WHERE deleted_at IS NULL \
         ORDER BY submitted_at DESC \
         LIMIT 50",
    )
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// `GET /api/abdm/hfr/facilities` — every live campus with its HFR state.
pub async fn list_facilities(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<FacilityHfrList>, AppError> {
    require_permission(&claims, permissions::abdm::hfr::VIEW)?;
    let registry_configured = registry_configured(&state, &claims.tenant_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let facilities = facilities(&mut tx, claims.tenant_id).await?;
    tx.commit().await?;
    Ok(Json(FacilityHfrList {
        registry_configured,
        facilities,
    }))
}

/// Every live campus with its HFR state and DHIS eligibility.
pub(crate) async fn facilities(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
) -> Result<Vec<FacilityHfr>, sqlx::Error> {
    let rows = sqlx::query_as::<_, FacilityHfr>(&format!(
        "SELECT {FACILITY_COLUMNS} FROM facilities \
         WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY code LIMIT 500"
    ))
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?;
    Ok(rows.into_iter().map(FacilityHfr::with_dhis).collect())
}

/// `PUT /api/abdm/hfr/facilities/{id}` — link (or unlink) an existing HFR ID.
pub async fn link_facility(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<LinkHfrRequest>,
) -> Result<Json<FacilityHfr>, AppError> {
    require_permission(&claims, permissions::abdm::hfr::REGISTER)?;
    validate_beds(body.hfr_bed_count)?;
    let hfr_id = match body.hfr_facility_id.as_deref().map(str::trim) {
        None | Some("") => None,
        Some(raw) => Some(normalize_hfr_id(raw)?),
    };
    let (status, checked_at) = match hfr_id.as_deref() {
        None => ("not_registered", None),
        Some(fid) => verify_hfr_id(&state, &claims.tenant_id, fid).await?,
    };
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, FacilityHfr>(&format!(
        "UPDATE facilities SET hfr_facility_id = $3, hfr_status = $4, hfr_checked_at = $5, \
                hfr_bed_count = $6, hfr_ipd = $7 \
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
         RETURNING {FACILITY_COLUMNS}"
    ))
    .bind(id)
    .bind(claims.tenant_id)
    .bind(hfr_id.as_deref())
    .bind(status)
    .bind(checked_at)
    .bind(body.hfr_bed_count)
    .bind(body.hfr_ipd)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row.with_dhis()))
}

/// With keys: HFR must know the ID (`verified`), else 409. Without keys the
/// ID is recorded as `registered` — claimed, not yet confirmed.
async fn verify_hfr_id(
    state: &AppState,
    tenant_id: &Uuid,
    facility_id: &str,
) -> Result<(&'static str, Option<DateTime<Utc>>), AppError> {
    let Some(access) = registry_access(state, tenant_id, Registry::Hfr).await? else {
        return Ok(("registered", None));
    };
    let found = registry::hfr_search(&access.http, &access.base_url, &access.token, facility_id)
        .await
        .map_err(|e| registry_fault(&e))?;
    if found.is_none() {
        return Err(AppError::Conflict(format!(
            "HFR does not list facility ID {facility_id}"
        )));
    }
    Ok(("verified", Some(Utc::now())))
}

/// `POST /api/abdm/hfr/facilities/{id}/register` — submit a new registration.
pub async fn register_facility(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<RegisterHfrRequest>,
) -> Result<Json<FacilityHfr>, AppError> {
    require_permission(&claims, permissions::abdm::hfr::REGISTER)?;
    validate_register(&body)?;
    let Some(access) = registry_access(&state, &claims.tenant_id, Registry::Hfr).await? else {
        return Err(AppError::ServiceUnavailable(
            "ABDM keys are not configured — register on facility.abdm.gov.in and link the ID"
                .to_owned(),
        ));
    };
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let facility: (
        String,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
    ) = sqlx::query_as(
        "SELECT name, address_line1, city, phone, email FROM facilities \
             WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;

    let (name, address, city, phone, email) = facility;
    let payload = json!({
        "facilityName": name, "ownership": body.ownership, "address": address,
        "city": city, "pincode": body.pincode, "stateLGDCode": body.state_lgd_code,
        "districtLGDCode": body.district_lgd_code, "contactNumber": phone, "email": email,
        "bedCount": body.hfr_bed_count, "hasIpd": body.hfr_ipd,
        "specializations": body.specializations,
    });
    let outcome =
        registry::hfr_register(&access.http, &access.base_url, &access.token, &payload).await;
    record_registration(&state, &claims, id, &payload, &body, outcome).await
}

/// Every attempt is kept — a failed one with HFR's reason — and a success
/// moves the campus to `submitted` (NHA approval is out of band).
async fn record_registration(
    state: &AppState,
    claims: &Claims,
    facility_id: Uuid,
    payload: &serde_json::Value,
    body: &RegisterHfrRequest,
    outcome: Result<(Option<String>, serde_json::Value), AbdmError>,
) -> Result<Json<FacilityHfr>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let (status, nha_id, response, error) = match &outcome {
        Ok((nha_id, resp)) => ("submitted", nha_id.clone(), Some(resp.clone()), None),
        Err(e) => ("failed", None, None, Some(e.to_string())),
    };
    sqlx::query(
        "INSERT INTO abdm_hfr_registrations \
            (tenant_id, facility_id, status, payload, response, nha_facility_id, error_message) \
         VALUES ($1, $2, $3, $4, $5, $6, $7)",
    )
    .bind(claims.tenant_id)
    .bind(facility_id)
    .bind(status)
    .bind(payload)
    .bind(response)
    .bind(nha_id.as_deref())
    .bind(error.as_deref())
    .execute(&mut *tx)
    .await?;
    if let Err(e) = outcome {
        tx.commit().await?;
        return Err(match e {
            AbdmError::Status { status, message } if status.is_client_error() => {
                AppError::BadRequest(format!("HFR refused the registration: {message}"))
            }
            other => registry_fault(&other),
        });
    }
    let issued = nha_id.and_then(|v| normalize_hfr_id(&v).ok());
    let row = sqlx::query_as::<_, FacilityHfr>(&format!(
        "UPDATE facilities SET hfr_status = 'submitted', \
                hfr_facility_id = COALESCE($3, hfr_facility_id), \
                hfr_bed_count = $4, hfr_ipd = $5 \
         WHERE id = $1 AND tenant_id = $2 RETURNING {FACILITY_COLUMNS}"
    ))
    .bind(facility_id)
    .bind(claims.tenant_id)
    .bind(issued)
    .bind(body.hfr_bed_count)
    .bind(body.hfr_ipd)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row.with_dhis()))
}

/// HFR IDs are `IN` + 10 alphanumerics (e.g. `IN0410000183`).
fn normalize_hfr_id(raw: &str) -> Result<String, AppError> {
    let id = raw.trim().to_ascii_uppercase();
    let ok = id.len() == 12
        && id.starts_with("IN")
        && id.chars().skip(2).all(|c| c.is_ascii_alphanumeric());
    if ok {
        Ok(id)
    } else {
        Err(AppError::BadRequest(
            "HFR facility ID is IN followed by 10 letters or digits".into(),
        ))
    }
}

fn validate_beds(beds: Option<i32>) -> Result<(), AppError> {
    if beds.is_some_and(|b| b < 0) {
        return Err(AppError::BadRequest("bed count cannot be negative".into()));
    }
    Ok(())
}

fn validate_register(body: &RegisterHfrRequest) -> Result<(), AppError> {
    validate_beds(body.hfr_bed_count)?;
    if body.pincode.len() != 6 || !body.pincode.chars().all(|c| c.is_ascii_digit()) {
        return Err(AppError::BadRequest("pincode must be 6 digits".into()));
    }
    if !matches!(body.ownership.as_str(), "government" | "private" | "trust") {
        return Err(AppError::BadRequest(
            "ownership must be government | private | trust".into(),
        ));
    }
    let lgd = |v: &str| !v.is_empty() && v.chars().all(|c| c.is_ascii_digit());
    if !lgd(&body.state_lgd_code) || !lgd(&body.district_lgd_code) {
        return Err(AppError::BadRequest(
            "LGD state and district codes are numeric".into(),
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::normalize_hfr_id;

    #[test]
    fn hfr_id_shape() {
        assert_eq!(
            normalize_hfr_id(" in0410000183 ").ok().as_deref(),
            Some("IN0410000183")
        );
        assert!(normalize_hfr_id("IN041000018").is_err());
        assert!(normalize_hfr_id("XX0410000183").is_err());
        assert!(normalize_hfr_id("IN04100001-3").is_err());
    }
}
