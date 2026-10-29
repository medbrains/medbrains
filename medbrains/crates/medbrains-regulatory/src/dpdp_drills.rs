//! Breach-response drills: an untested breach plan shows as a gap on the
//! dashboard until a drill is recorded, and again when the next is due.

use axum::{Extension, Json, extract::State};
use chrono::{DateTime, NaiveDate, Utc};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

/// Months between breach-response drills unless a drill sets its own next date.
const DRILL_INTERVAL_MONTHS: u32 = 12;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Drill {
    pub id: Uuid,
    pub held_on: NaiveDate,
    pub format: String,
    pub scenario: String,
    pub findings: String,
    pub next_due_on: NaiveDate,
    pub conducted_by_name: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// `GET /api/regulatory/dpdp/drills`
pub async fn list_drills(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<Drill>>, AppError> {
    require_permission(&claims, permissions::regulatory::dpdp::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, Drill>(
        "SELECT d.id, d.held_on, d.format, d.scenario, d.findings, d.next_due_on, \
                u.full_name AS conducted_by_name, d.created_at \
           FROM compliance_drills d LEFT JOIN users u ON u.id = d.conducted_by \
          WHERE d.tenant_id = $1 AND d.deleted_at IS NULL ORDER BY d.held_on DESC LIMIT 100",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct RecordDrill {
    pub held_on: NaiveDate,
    pub format: String,
    pub scenario: String,
    pub findings: String,
    /// Defaults to 12 months after `held_on`.
    pub next_due_on: Option<NaiveDate>,
}

/// When the next drill is due: as given, or a year after this one.
#[must_use]
pub fn next_due(held_on: NaiveDate, given: Option<NaiveDate>) -> Option<NaiveDate> {
    given.or_else(|| held_on.checked_add_months(chrono::Months::new(DRILL_INTERVAL_MONTHS)))
}

/// `POST /api/regulatory/dpdp/drills`
pub async fn record_drill(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(b): Json<RecordDrill>,
) -> Result<Json<Vec<Drill>>, AppError> {
    require_permission(&claims, permissions::regulatory::dpdp::DRILLS)?;
    if !matches!(b.format.as_str(), "tabletop" | "live") {
        return Err(AppError::BadRequest(
            "A drill is a tabletop exercise or a live drill".into(),
        ));
    }
    if b.scenario.trim().chars().count() < 3 || b.findings.trim().chars().count() < 3 {
        return Err(AppError::BadRequest(
            "Say what was rehearsed and what it found".into(),
        ));
    }
    if b.held_on > Utc::now().date_naive() {
        return Err(AppError::BadRequest(
            "A drill is recorded after it is held".into(),
        ));
    }
    let next = next_due(b.held_on, b.next_due_on)
        .filter(|n| *n > b.held_on)
        .ok_or_else(|| AppError::BadRequest("The next drill must be after this one".into()))?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    sqlx::query(
        "INSERT INTO compliance_drills (tenant_id, held_on, format, scenario, findings, \
             next_due_on, conducted_by) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    )
    .bind(claims.tenant_id)
    .bind(b.held_on)
    .bind(&b.format)
    .bind(b.scenario.trim())
    .bind(b.findings.trim())
    .bind(next)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    list_drills(State(state), Extension(claims)).await
}
