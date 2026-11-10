//! Periodontal charts on dental exams, and the patient's chart history.
//!
//! A chart is recorded whole on an exam and read back with its summary and,
//! against the chart before it, every site that changed by 2 mm or more
//! (`medbrains_core::specialty::perio`).

use axum::Json;
use axum::extract::{Extension, Path, State};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use medbrains_core::specialty::perio::{
    PerioSummary, PerioTooth, SiteChange, invalid, significant_changes, summary,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

/// Teeth one chart may hold: both dentitions in a mixed mouth.
const MAX_TEETH: usize = 52;
/// Charts read back for one patient.
const HISTORY: i64 = 20;

#[derive(Debug, Deserialize)]
pub struct RecordPerioChart {
    pub teeth: Vec<PerioTooth>,
    pub notes: Option<String>,
}

/// A chart as the screen shows it.
#[derive(Debug, Serialize)]
pub struct PerioChart {
    pub id: Uuid,
    pub exam_id: Uuid,
    pub recorded_by_name: Option<String>,
    pub created_at: DateTime<Utc>,
    pub notes: Option<String>,
    pub teeth: Vec<PerioTooth>,
    pub summary: PerioSummary,
    /// Sites that changed by 2 mm or more since the chart before this one.
    pub changes_since_previous: Vec<SiteChange>,
}

#[derive(sqlx::FromRow)]
struct Row {
    id: Uuid,
    exam_id: Uuid,
    recorded_by_name: Option<String>,
    created_at: DateTime<Utc>,
    notes: Option<String>,
    teeth: sqlx::types::Json<Vec<PerioTooth>>,
}

/// What is wrong with a chart, if anything.
fn invalid_chart(teeth: &[PerioTooth]) -> Option<String> {
    if teeth.is_empty() || teeth.len() > MAX_TEETH {
        return Some(format!("a chart holds 1–{MAX_TEETH} teeth"));
    }
    let mut seen = std::collections::HashSet::new();
    if let Some(t) = teeth.iter().find(|t| !seen.insert(t.tooth.as_str())) {
        return Some(format!("tooth {} is charted twice", t.tooth));
    }
    teeth.iter().find_map(invalid)
}

/// Charts newest first, each compared with the one before it.
fn with_history(rows: &[Row]) -> Vec<PerioChart> {
    let mut out: Vec<PerioChart> = Vec::with_capacity(rows.len());
    for (i, r) in rows.iter().enumerate() {
        let teeth = r.teeth.0.clone();
        let changes = rows
            .get(i + 1)
            .map(|older| significant_changes(&older.teeth.0, &teeth))
            .unwrap_or_default();
        out.push(PerioChart {
            id: r.id,
            exam_id: r.exam_id,
            recorded_by_name: r.recorded_by_name.clone(),
            created_at: r.created_at,
            notes: r.notes.clone(),
            summary: summary(&teeth),
            teeth,
            changes_since_previous: changes,
        });
    }
    out
}

async fn module_on(state: &AppState, claims: &Claims) -> Result<(), AppError> {
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "dental",
    )
    .await
}

/// `POST /api/specialty/dental/exams/{exam_id}/perio` — record a chart.
pub async fn record_perio_chart(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(exam_id): Path<Uuid>,
    Json(body): Json<RecordPerioChart>,
) -> Result<Json<Uuid>, AppError> {
    require_permission(&claims, permissions::specialty::dental::perio::RECORD)?;
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::DENTAL_EXAM,
        exam_id,
    )
    .await?;
    module_on(&state, &claims).await?;
    if let Some(why) = invalid_chart(&body.teeth) {
        return Err(AppError::BadRequest(why));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let id: Option<Uuid> = sqlx::query_scalar(
        "INSERT INTO dental_perio_charts (tenant_id, exam_id, patient_id, teeth, notes, recorded_by) \
         SELECT $1, e.id, e.patient_id, $3, $4, $5 FROM dental_exams e \
         WHERE e.id = $2 AND e.tenant_id = $1 RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(exam_id)
    .bind(sqlx::types::Json(&body.teeth))
    .bind(body.notes.as_deref().map(str::trim).filter(|n| !n.is_empty()))
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    id.map(Json).ok_or(AppError::NotFound)
}

/// `GET /api/specialty/dental/patients/{patient_id}/perio` — the patient's
/// charts, newest first, each compared with the one before.
pub async fn patient_perio_history(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Vec<PerioChart>>, AppError> {
    require_permission(&claims, permissions::specialty::dental::perio::LIST)?;
    medbrains_authz_gate::require_patient_access(&state, &claims, patient_id).await?;
    module_on(&state, &claims).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let rows = sqlx::query_as::<_, Row>(
        "SELECT c.id, c.exam_id, u.full_name AS recorded_by_name, c.created_at, c.notes, c.teeth \
         FROM dental_perio_charts c LEFT JOIN users u ON u.id = c.recorded_by \
         WHERE c.tenant_id = $1 AND c.patient_id = $2 AND c.deleted_at IS NULL \
         ORDER BY c.created_at DESC LIMIT $3",
    )
    .bind(claims.tenant_id)
    .bind(patient_id)
    .bind(HISTORY)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(with_history(&rows)))
}

#[cfg(test)]
mod tests {
    use super::invalid_chart;
    use medbrains_core::specialty::perio::PerioTooth;

    fn tooth(t: &str) -> PerioTooth {
        PerioTooth {
            tooth: t.to_owned(),
            missing: false,
            probing: [Some(3); 6],
            recession: [Some(0); 6],
            bleeding: [false; 6],
            mobility: None,
            furcation: None,
        }
    }

    #[test]
    fn a_chart_holds_each_tooth_once_and_only_real_teeth() {
        assert_eq!(invalid_chart(&[tooth("16"), tooth("11")]), None);
        assert!(invalid_chart(&[]).is_some());
        assert!(invalid_chart(&[tooth("16"), tooth("16")]).is_some_and(|e| e.contains("twice")));
        assert!(invalid_chart(&[tooth("99")]).is_some());
    }
}
