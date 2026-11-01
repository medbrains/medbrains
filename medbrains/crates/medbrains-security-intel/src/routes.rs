//! Security → Intelligence: each check's heartbeat, the posture checklist,
//! and opening an incident from a finding. The findings themselves are the
//! existing `/api/vulnerabilities` list.

use axum::extract::{Path, State};
use axum::routing::{get, post};
use axum::{Extension, Json, Router};
use chrono::{DateTime, Utc};
use medbrains_core::permissions::security::{incidents, intel};
use medbrains_kernel::{Actor, AppError, Claims, require_permission};
use medbrains_server_core::state::AppState;
use serde::Serialize;
use serde_json::Value;
use uuid::Uuid;

use crate::watchers::{Latest, latest_runs};
use crate::{CHECKS, POSTURE};

/// One check on the screen: its cadence and its latest heartbeat (`None`
/// fields when it has never reported).
#[derive(Debug, Serialize)]
pub struct CheckStatus {
    pub key: &'static str,
    pub label: &'static str,
    pub every_secs: u64,
    pub last: Option<Latest>,
}

/// The latest posture run; `detail.items` is the checklist.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PostureReport {
    pub started_at: DateTime<Utc>,
    pub finished_at: DateTime<Utc>,
    pub outcome: String,
    pub error: Option<String>,
    pub detail: Value,
}

#[derive(Debug, Serialize)]
pub struct OpenedIncident {
    pub incident_id: Uuid,
    pub created: bool,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/security/intel/checks", get(list_checks))
        .route("/api/security/intel/posture", get(get_posture))
        .route(
            "/api/security/intel/findings/{id}/incident",
            post(open_incident),
        )
}

/// Every check's cadence and latest heartbeat.
pub async fn list_checks(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<CheckStatus>>, AppError> {
    require_permission(&claims, intel::VIEW)?;
    let tenant = claims.tenant_id;
    let mut latest = medbrains_kernel::work(&state.db, Actor::from_claims(&claims), async |tx| {
        Ok(latest_runs(&mut **tx, tenant).await?)
    })
    .await?;
    Ok(Json(
        CHECKS
            .iter()
            .map(|c| CheckStatus {
                key: c.key,
                label: c.label,
                every_secs: c.every_secs,
                last: latest.remove(c.key),
            })
            .collect(),
    ))
}

/// The latest posture run, or `null` when it has never run.
pub async fn get_posture(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Option<PostureReport>>, AppError> {
    require_permission(&claims, intel::VIEW)?;
    let tenant = claims.tenant_id;
    let report = medbrains_kernel::work(&state.db, Actor::from_claims(&claims), async |tx| {
        Ok(sqlx::query_as::<_, PostureReport>(
            "SELECT started_at, finished_at, outcome, error, detail FROM security_check_runs \
              WHERE tenant_id = $1 AND check_key = $2 ORDER BY started_at DESC LIMIT 1",
        )
        .bind(tenant)
        .bind(POSTURE)
        .fetch_optional(&mut **tx)
        .await?)
    })
    .await?;
    Ok(Json(report))
}

/// Open an incident in the breach register from a finding, once: a second
/// call returns the incident the first one opened.
pub async fn open_incident(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<OpenedIncident>, AppError> {
    require_permission(&claims, intel::MANAGE)?;
    require_permission(&claims, incidents::CREATE)?;
    let (tenant, user) = (claims.tenant_id, claims.sub);
    let opened = medbrains_kernel::work(&state.db, Actor::from_claims(&claims), async |tx| {
        let finding = sqlx::query_as::<_, (String, String, String, Option<String>, Option<Uuid>)>(
            "SELECT title, severity, affected_component, how_to_fix, incident_id FROM vulnerabilities \
              WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL FOR UPDATE",
        )
        .bind(id)
        .bind(tenant)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or(AppError::NotFound)?;
        let (title, severity, asset, fix, existing) = finding;
        if let Some(incident_id) = existing {
            return Ok(OpenedIncident { incident_id, created: false });
        }
        let number = format!(
            "SEC-{}-{}",
            Utc::now().format("%Y%m%d%H%M%S"),
            &Uuid::new_v4().simple().to_string()[..6]
        );
        let description = format!(
            "Raised from a security intelligence finding.\n{title}\nAsset: {asset}\nHow to fix: {}",
            fix.unwrap_or_default()
        );
        let incident_id: Uuid = sqlx::query_scalar(
            "INSERT INTO security_incidents \
               (tenant_id, incident_number, severity, category, description, reported_by) \
             VALUES ($1, $2, $3::sec_incident_severity, 'cyber_security', $4, $5) RETURNING id",
        )
        .bind(tenant)
        .bind(&number)
        .bind(&severity)
        .bind(&description)
        .bind(user)
        .fetch_one(&mut **tx)
        .await?;
        sqlx::query(
            "UPDATE vulnerabilities SET incident_id = $2, updated_at = now(), \
                    remediation_status = CASE WHEN remediation_status = 'open' THEN 'in_progress' \
                                              ELSE remediation_status END \
              WHERE id = $1 AND tenant_id = $3",
        )
        .bind(id)
        .bind(incident_id)
        .bind(tenant)
        .execute(&mut **tx)
        .await?;
        Ok(OpenedIncident { incident_id, created: true })
    })
    .await?;
    Ok(Json(opened))
}
