//! Ophthalmology (eye) module — comprehensive eye exams (acuity, refraction, IOP,
//! slit-lamp, fundus, diagnosis + plan). Powers the `eye_hospital` edition.

use axum::Json;
use axum::extract::{Extension, Path, Query, State};
use medbrains_core::permissions;
use medbrains_core::specialty::ophthalmology::OphthoExam;
use rust_decimal::Decimal;
use serde::Deserialize;
use uuid::Uuid;

use crate::error::AppError;
use crate::middleware::auth::Claims;
use crate::middleware::authorization::require_permission;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct ListExamsQuery {
    pub patient_id: Option<Uuid>,
    pub status: Option<String>,
}

/// `GET /api/specialty/ophthalmology/exams`
pub async fn list_ophtho_exams(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListExamsQuery>,
) -> Result<Json<Vec<OphthoExam>>, AppError> {
    require_permission(&claims, permissions::specialty::ophthalmology::exams::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let rows = sqlx::query_as::<_, OphthoExam>(
        "SELECT * FROM ophtho_exams \
         WHERE tenant_id = $1 \
           AND ($2::uuid IS NULL OR patient_id = $2) \
           AND ($3::text IS NULL OR status = $3) \
         ORDER BY created_at DESC LIMIT 200",
    )
    .bind(claims.tenant_id)
    .bind(q.patient_id)
    .bind(q.status.as_deref())
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// `GET /api/specialty/ophthalmology/exams/{id}`
pub async fn get_ophtho_exam(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<OphthoExam>, AppError> {
    require_permission(&claims, permissions::specialty::ophthalmology::exams::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let row =
        sqlx::query_as::<_, OphthoExam>("SELECT * FROM ophtho_exams WHERE id = $1 AND tenant_id = $2")
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
    pub visual_acuity_od: Option<String>,
    pub visual_acuity_os: Option<String>,
    pub sphere_od: Option<Decimal>,
    pub sphere_os: Option<Decimal>,
    pub cylinder_od: Option<Decimal>,
    pub cylinder_os: Option<Decimal>,
    pub axis_od: Option<i16>,
    pub axis_os: Option<i16>,
    pub iop_od: Option<Decimal>,
    pub iop_os: Option<Decimal>,
    pub slit_lamp: Option<String>,
    pub fundus: Option<String>,
    pub diagnosis: Option<String>,
    pub plan: Option<String>,
    pub status: Option<String>,
}

/// `POST /api/specialty/ophthalmology/exams`
pub async fn create_ophtho_exam(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateExamRequest>,
) -> Result<Json<OphthoExam>, AppError> {
    require_permission(&claims, permissions::specialty::ophthalmology::exams::CREATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let row = sqlx::query_as::<_, OphthoExam>(
        "INSERT INTO ophtho_exams \
         (tenant_id, patient_id, encounter_id, visual_acuity_od, visual_acuity_os, \
          sphere_od, sphere_os, cylinder_od, cylinder_os, axis_od, axis_os, \
          iop_od, iop_os, slit_lamp, fundus, diagnosis, plan, examined_by, examined_at, status) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18, now(), \
                 COALESCE($19, 'draft')) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.encounter_id)
    .bind(body.visual_acuity_od)
    .bind(body.visual_acuity_os)
    .bind(body.sphere_od)
    .bind(body.sphere_os)
    .bind(body.cylinder_od)
    .bind(body.cylinder_os)
    .bind(body.axis_od)
    .bind(body.axis_os)
    .bind(body.iop_od)
    .bind(body.iop_os)
    .bind(body.slit_lamp)
    .bind(body.fundus)
    .bind(body.diagnosis)
    .bind(body.plan)
    .bind(claims.sub)
    .bind(body.status)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct UpdateExamRequest {
    pub slit_lamp: Option<String>,
    pub fundus: Option<String>,
    pub diagnosis: Option<String>,
    pub plan: Option<String>,
    pub status: Option<String>,
}

/// `PUT /api/specialty/ophthalmology/exams/{id}` — complete/edit the exam narrative.
pub async fn update_ophtho_exam(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateExamRequest>,
) -> Result<Json<OphthoExam>, AppError> {
    require_permission(&claims, permissions::specialty::ophthalmology::exams::UPDATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let row = sqlx::query_as::<_, OphthoExam>(
        "UPDATE ophtho_exams SET \
           slit_lamp = COALESCE($3, slit_lamp), \
           fundus = COALESCE($4, fundus), \
           diagnosis = COALESCE($5, diagnosis), \
           plan = COALESCE($6, plan), \
           status = COALESCE($7, status), \
           updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.slit_lamp)
    .bind(body.fundus)
    .bind(body.diagnosis)
    .bind(body.plan)
    .bind(body.status)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(row))
}
