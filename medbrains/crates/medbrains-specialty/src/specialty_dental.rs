//! Dental module — dental exams with tooth-wise chart entries (FDI numbering).
//! Powers the `dental_college` edition.

use axum::Json;
use axum::extract::{Extension, Path, Query, State};
use medbrains_core::permissions;
use medbrains_core::specialty::dental::{DentalChartEntry, DentalExam};
use serde::Deserialize;
use uuid::Uuid;

use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

#[derive(Debug, Deserialize)]
pub struct ListExamsQuery {
    pub patient_id: Option<Uuid>,
    pub status: Option<String>,
}

/// `GET /api/specialty/dental/exams`
pub async fn list_dental_exams(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListExamsQuery>,
) -> Result<Json<Vec<DentalExam>>, AppError> {
    require_permission(&claims, permissions::specialty::dental::exams::LIST)?;

    // The id arrives on the query string rather than the path, so the route map
    // reads as unscoped. It is still a per-record read and needs a per-record check.
    // Dual-mode: with ?patient_id it is one patient's records, without it it is
    // every patient's. Both resolve to a set of permitted ids so the dangerous
    // mode cannot be left open while the safe one looks guarded.
    let permitted_patients =
        medbrains_authz_gate::patient_filter(&state, &claims, q.patient_id).await?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(&state.db, claims.tenant_id, "dental")
        .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let rows = sqlx::query_as::<_, DentalExam>(
        "SELECT * FROM dental_exams \
         WHERE tenant_id = $1 \
           AND ($2::uuid[] IS NULL OR patient_id = ANY($2)) \
           AND ($3::text IS NULL OR status = $3) \
         ORDER BY created_at DESC LIMIT 200",
    )
    .bind(claims.tenant_id)
    .bind(permitted_patients.as_deref())
    .bind(q.status.as_deref())
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// `GET /api/specialty/dental/exams/{id}`
pub async fn get_dental_exam(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<DentalExam>, AppError> {
    require_permission(&claims, permissions::specialty::dental::exams::LIST)?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(&state.db, claims.tenant_id, "dental")
        .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let row =
        sqlx::query_as::<_, DentalExam>("SELECT * FROM dental_exams WHERE id = $1 AND tenant_id = $2")
            .bind(id)
            .bind(claims.tenant_id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct CreateExamRequest {
    pub patient_id: Uuid,
    pub encounter_id: Option<Uuid>,
    pub chief_complaint: Option<String>,
    pub diagnosis: Option<String>,
    pub treatment_plan: Option<String>,
    pub status: Option<String>,
}

/// `POST /api/specialty/dental/exams`
pub async fn create_dental_exam(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateExamRequest>,
) -> Result<Json<DentalExam>, AppError> {
    require_permission(&claims, permissions::specialty::dental::exams::CREATE)?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(&state.db, claims.tenant_id, "dental")
        .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let row = sqlx::query_as::<_, DentalExam>(
        "INSERT INTO dental_exams \
         (tenant_id, patient_id, encounter_id, chief_complaint, diagnosis, treatment_plan, \
          examined_by, examined_at, status) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, now(), COALESCE($8, 'draft')) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.encounter_id)
    .bind(body.chief_complaint)
    .bind(body.diagnosis)
    .bind(body.treatment_plan)
    .bind(claims.sub)
    .bind(body.status)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct UpdateExamRequest {
    pub diagnosis: Option<String>,
    pub treatment_plan: Option<String>,
    pub status: Option<String>,
}

/// `PUT /api/specialty/dental/exams/{id}`
pub async fn update_dental_exam(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateExamRequest>,
) -> Result<Json<DentalExam>, AppError> {
    require_permission(&claims, permissions::specialty::dental::exams::UPDATE)?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(&state.db, claims.tenant_id, "dental")
        .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let row = sqlx::query_as::<_, DentalExam>(
        "UPDATE dental_exams SET \
           diagnosis = COALESCE($3, diagnosis), \
           treatment_plan = COALESCE($4, treatment_plan), \
           status = COALESCE($5, status), \
           updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.diagnosis)
    .bind(body.treatment_plan)
    .bind(body.status)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}

/// `GET /api/specialty/dental/exams/{exam_id}/chart`
pub async fn list_chart_entries(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(exam_id): Path<Uuid>,
) -> Result<Json<Vec<DentalChartEntry>>, AppError> {
    require_permission(&claims, permissions::specialty::dental::chart::LIST)?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(&state.db, claims.tenant_id, "dental")
        .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let rows = sqlx::query_as::<_, DentalChartEntry>(
        "SELECT * FROM dental_chart_entries \
         WHERE tenant_id = $1 AND exam_id = $2 ORDER BY tooth_number LIMIT 200",
    )
    .bind(claims.tenant_id)
    .bind(exam_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct CreateChartEntryRequest {
    pub tooth_number: String,
    pub condition: String,
    pub surface: Option<String>,
    pub treatment_planned: Option<String>,
    pub notes: Option<String>,
}

/// `POST /api/specialty/dental/exams/{exam_id}/chart`
pub async fn create_chart_entry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(exam_id): Path<Uuid>,
    Json(body): Json<CreateChartEntryRequest>,
) -> Result<Json<DentalChartEntry>, AppError> {
    require_permission(&claims, permissions::specialty::dental::chart::CREATE)?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(&state.db, claims.tenant_id, "dental")
        .await?;
    if body.tooth_number.trim().is_empty() || body.condition.trim().is_empty() {
        return Err(AppError::BadRequest(
            "tooth_number and condition are required".to_owned(),
        ));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let row = sqlx::query_as::<_, DentalChartEntry>(
        "INSERT INTO dental_chart_entries \
         (tenant_id, exam_id, tooth_number, condition, surface, treatment_planned, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(exam_id)
    .bind(body.tooth_number.trim())
    .bind(body.condition.trim())
    .bind(body.surface)
    .bind(body.treatment_planned)
    .bind(body.notes)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}
