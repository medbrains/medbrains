//! Settings → ABDM → Bridge: where ABDM delivers this hospital's callbacks.
//!
//! - `GET  /api/abdm/bridge`          — the bridge as the gateway holds it, and
//!   which campuses' HFR IDs are bound to it (`abdm.settings.manage`)
//! - `POST /api/abdm/bridge/register` — set the callback URL at the gateway
//!   and bind each campus to the bridge in HFR (`abdm.bridge.register`)
//!
//! Official sources: the gateway swagger (`gateway_1_0d212e29a3.yaml`,
//! sandboxcms.abdm.gov.in/uploads) for `PATCH /api/hiecm/gateway/v3/bridge/url`
//! and `GET …/bridge-services`; the HFR documentation for
//! `POST /v1/bridges/MutipleHRPAddUpdateServices`. The bridge ID is the
//! hospital's ABDM client ID; a service ID is a campus's HFR facility ID.
//!
//! A gateway that cannot be asked is shown as "unknown", never as "nothing
//! registered": a blank list would read as a fact about the bridge.
//!
//! The service id the registry issues for a campus (`<HFR ID>_<n>`, e.g.
//! `IN1410000232_1`) is the `X-HIP-ID` the gateway routes on; with the bare
//! HFR ID it answers 202 and never calls back (OHC care-abdm, MIT,
//! docs/findings.md E1/B18/B20). It is read off the gateway's service list
//! and HFR's answers here, and kept on the campus (`abdm_hip_service_id`).

use std::collections::HashMap;

use axum::{Extension, Json, extract::State};
use medbrains_abdm::{AbdmEnvironment, AbdmError, registry};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use uuid::Uuid;

use super::abha::{Session, abdm_configured, forget_session, map_abdm_error, session};
use super::bridge_rules::{HIP_NAME_MAX, belongs_to, hip_name, read_hfr_answer};
use super::hip::gateway::gateway_client;
use super::registry_access::{Registry, registry_access, registry_fault};
use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

/// Campuses listed and registered per call.
const CAMPUS_LIMIT: i64 = 50;
const PUBLIC_BASE_URL: &str = "MEDBRAINS_PUBLIC_BASE_URL";

#[derive(Debug, Serialize)]
pub struct GatewayBridge {
    /// `ok` — the gateway answered; `unknown` — it could not be asked.
    pub state: &'static str,
    pub message: Option<String>,
    pub url: Option<String>,
    pub active: Option<bool>,
    pub blocklisted: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct CampusBridge {
    pub facility_id: Uuid,
    pub name: String,
    pub hfr_facility_id: String,
    /// The bridge service id sent as `X-HIP-ID`; `None` until ABDM issued one.
    pub service_id: Option<String>,
    /// The name patients will see in their PHR app, as HFR will take it.
    pub hip_name: String,
    /// `None` when the gateway could not be asked.
    pub bound: Option<bool>,
    pub types: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct BridgeStatus {
    pub configured: bool,
    pub environment: Option<AbdmEnvironment>,
    /// The hospital's ABDM client ID.
    pub bridge_id: Option<String>,
    /// `MEDBRAINS_PUBLIC_BASE_URL`, offered as the callback URL.
    pub suggested_url: Option<String>,
    pub gateway: GatewayBridge,
    pub campuses: Vec<CampusBridge>,
}

#[derive(Debug, Deserialize)]
pub struct RegisterBridge {
    pub url: String,
    /// Per campus (facility id): the name for the PHR app; default from the
    /// campus name.
    #[serde(default)]
    pub hip_names: HashMap<Uuid, String>,
}

#[derive(Debug, Serialize)]
pub struct StepOutcome {
    pub ok: bool,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct CampusOutcome {
    pub facility_id: Uuid,
    pub hfr_facility_id: String,
    pub ok: bool,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct BridgeRegistration {
    pub url: StepOutcome,
    pub campuses: Vec<CampusOutcome>,
}

#[derive(sqlx::FromRow)]
struct Campus {
    id: Uuid,
    name: String,
    hfr_facility_id: String,
    service_id: Option<String>,
}

async fn remember_service(
    state: &AppState,
    tenant_id: Uuid,
    facility_id: Uuid,
    service_id: &str,
) -> Result<(), AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    sqlx::query(
        "UPDATE facilities SET abdm_hip_service_id = $3 \
          WHERE tenant_id = $1 AND id = $2 AND abdm_hip_service_id IS DISTINCT FROM $3",
    )
    .bind(tenant_id)
    .bind(facility_id)
    .bind(service_id.to_uppercase())
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(())
}

async fn campuses(state: &AppState, tenant_id: Uuid) -> Result<Vec<Campus>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    let rows = sqlx::query_as::<_, Campus>(
        "SELECT id, name, hfr_facility_id, abdm_hip_service_id AS service_id FROM facilities \
          WHERE tenant_id = $1 AND deleted_at IS NULL AND hfr_facility_id IS NOT NULL \
          ORDER BY name LIMIT $2",
    )
    .bind(tenant_id)
    .bind(CAMPUS_LIMIT)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(rows)
}

/// The gateway's view of the bridge, or why it could not be had.
async fn gateway_view(state: &AppState, s: &Session) -> Result<Value, String> {
    let gateway = gateway_client(state.secret_resolver.as_ref(), s.environment)
        .await
        .map_err(|e| super::hip::linking::message(&e))?;
    gateway
        .bridge_services(&s.token)
        .await
        .map_err(|e| super::hip::linking::message(&map_abdm_error(e)))
}

fn status_of(
    configured: Option<(&Session, Result<Value, String>)>,
    campuses: Vec<Campus>,
    suggested_url: Option<String>,
) -> BridgeStatus {
    let (session, answer) = configured.unzip();
    let answer = answer.unwrap_or_else(|| Err("ABDM is not set up yet".to_owned()));
    let bridge = answer.as_ref().ok().map(|v| &v["bridge"]);
    let services: Option<HashMap<String, Vec<String>>> = answer.as_ref().ok().map(|v| {
        v["services"]
            .as_array()
            .into_iter()
            .flatten()
            .filter(|s| s["active"].as_bool() != Some(false))
            .filter_map(|s| {
                let types = s["types"].as_array().into_iter().flatten();
                Some((
                    s["id"].as_str()?.to_uppercase(),
                    types
                        .filter_map(|t| t.as_str().map(str::to_owned))
                        .collect(),
                ))
            })
            .collect()
    });
    BridgeStatus {
        configured: session.is_some(),
        environment: session.map(|s| s.environment),
        bridge_id: session.map(|s| s.client_id.clone()),
        suggested_url,
        gateway: GatewayBridge {
            state: if answer.is_ok() { "ok" } else { "unknown" },
            message: answer.as_ref().err().cloned(),
            url: bridge.and_then(|b| b["url"].as_str()).map(str::to_owned),
            active: bridge.and_then(|b| b["active"].as_bool()),
            blocklisted: bridge.and_then(|b| b["blocklisted"].as_bool()),
        },
        campuses: campuses
            .into_iter()
            .map(|c| {
                let found = services.as_ref().and_then(|m| {
                    m.iter()
                        .find(|(id, _)| belongs_to(id, &c.hfr_facility_id))
                        .map(|(id, types)| (id.clone(), types.clone()))
                });
                CampusBridge {
                    facility_id: c.id,
                    hip_name: hip_name(&c.name),
                    name: c.name,
                    bound: services.as_ref().map(|_| found.is_some()),
                    service_id: found.as_ref().map(|(id, _)| id.clone()).or(c.service_id),
                    types: found.map(|(_, t)| t).unwrap_or_default(),
                    hfr_facility_id: c.hfr_facility_id,
                }
            })
            .collect(),
    }
}

async fn public_base_url(state: &AppState) -> Option<String> {
    state
        .secret_resolver
        .get(PUBLIC_BASE_URL)
        .await
        .ok()
        .map(|v| v.trim().trim_end_matches('/').to_owned())
        .filter(|v| v.starts_with("http"))
}

/// `GET /api/abdm/bridge`
///
/// # Errors
/// 403 without `abdm.settings.manage`; a database fault.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<BridgeStatus>, AppError> {
    require_permission(&claims, permissions::abdm::settings::MANAGE)?;
    let campuses = campuses(&state, claims.tenant_id).await?;
    let suggested = public_base_url(&state).await;
    if !abdm_configured(&state, claims.tenant_id).await? {
        return Ok(Json(status_of(None, campuses, suggested)));
    }
    // Keys exist: a failure to sign in is "unknown", not "not set up".
    let signed_in = session(&state.db, state.secret_resolver.as_ref(), claims.tenant_id).await;
    let status = match &signed_in {
        Ok(s) => {
            let view = status_of(
                Some((s, gateway_view(&state, s).await)),
                campuses,
                suggested,
            );
            // The gateway's list is the source of truth for the HIP ID.
            for c in view.campuses.iter().filter(|c| c.bound == Some(true)) {
                if let Some(id) = &c.service_id {
                    remember_service(&state, claims.tenant_id, c.facility_id, id).await?;
                }
            }
            view
        }
        Err(e) => {
            let mut view = status_of(None, campuses, suggested);
            view.configured = true;
            view.gateway.message = Some(super::hip::linking::message(e));
            view
        }
    };
    Ok(Json(status))
}

fn valid_url(url: &str) -> Result<String, AppError> {
    let url = url.trim().trim_end_matches('/');
    let local = super::abha::dev_overrides_allowed() && url.starts_with("http://");
    if !(url.starts_with("https://") || local) || url.contains(char::is_whitespace) {
        return Err(AppError::BadRequest(
            "the callback URL must start with https://".to_owned(),
        ));
    }
    Ok(url.to_owned())
}

async fn link_campus(
    state: &AppState,
    claims: &Claims,
    bridge_id: &str,
    (campus, name): (&Campus, String),
) -> Result<CampusOutcome, AppError> {
    let access = registry_access(state, &claims.tenant_id, Registry::Hfr)
        .await?
        .ok_or_else(|| AppError::ServiceUnavailable("ABDM is not set up yet".to_owned()))?;
    let hrp = |kind: &str| json!({ "bridgeId": bridge_id, "hipName": name, "type": kind, "active": true });
    let body = json!({ "facilityId": campus.hfr_facility_id, "facilityName": campus.name,
                       "HRP": [hrp("HIP"), hrp("HIU")] });
    let answer =
        registry::hfr_link_bridge(&access.http, &access.base_url, &access.token, &body).await;
    let (ok, message, service) = match answer {
        Ok(v) => read_hfr_answer(&v, &campus.hfr_facility_id),
        Err(AbdmError::Status { status, message }) if status.is_client_error() => {
            (false, format!("HFR refused: {message}"), None)
        }
        Err(e) => (
            false,
            super::hip::linking::message(&registry_fault(&e)),
            None,
        ),
    };
    if let Some(id) = &service {
        remember_service(state, claims.tenant_id, campus.id, id).await?;
    }
    Ok(CampusOutcome {
        facility_id: campus.id,
        hfr_facility_id: campus.hfr_facility_id.clone(),
        ok,
        message,
    })
}

/// `POST /api/abdm/bridge/register` — each step reported, none hidden.
///
/// # Errors
/// 400 for a URL that is not https or a HIP name HFR would refuse; 403
/// without `abdm.bridge.register`; 503 when ABDM is not set up.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn register(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<RegisterBridge>,
) -> Result<Json<BridgeRegistration>, AppError> {
    require_permission(&claims, permissions::abdm::bridge::REGISTER)?;
    let url = valid_url(&body.url)?;
    let campuses = campuses(&state, claims.tenant_id).await?;
    let named: Vec<(&Campus, String)> = campuses
        .iter()
        .map(|c| {
            let name = body
                .hip_names
                .get(&c.id)
                .map_or_else(|| hip_name(&c.name), |n| n.trim().to_owned());
            if name.is_empty() || name != hip_name(&name) {
                return Err(AppError::BadRequest(format!(
                    "the PHR name for {} must be 1–{HIP_NAME_MAX} letters, digits or spaces",
                    c.name
                )));
            }
            Ok((c, name))
        })
        .collect::<Result<_, _>>()?;
    let s = session(&state.db, state.secret_resolver.as_ref(), claims.tenant_id).await?;
    let gateway = gateway_client(state.secret_resolver.as_ref(), s.environment).await?;
    let url_step = match gateway.update_bridge_url(&s.token, &url).await {
        Ok(()) => StepOutcome {
            ok: true,
            message: format!("ABDM will call {url}"),
        },
        Err(e) => StepOutcome {
            ok: false,
            message: super::hip::linking::message(&map_abdm_error(e)),
        },
    };
    let mut outcomes = Vec::with_capacity(named.len());
    for campus in named {
        outcomes.push(link_campus(&state, &claims, &s.client_id, campus).await?);
    }
    // The official docs: sign in again after registering, the roles change.
    forget_session(claims.tenant_id);
    tracing::info!(
        url_ok = url_step.ok,
        campuses = outcomes.len(),
        "abdm bridge registration"
    );
    Ok(Json(BridgeRegistration {
        url: url_step,
        campuses: outcomes,
    }))
}
