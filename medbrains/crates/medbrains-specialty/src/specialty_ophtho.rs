//! Ophthalmology (eye) module — the eye OPD workup (acuity, refraction, IOP,
//! slit-lamp, fundus, diagnosis + plan) and the spectacle prescription it
//! becomes once signed (#231). Powers the `eye_hospital` edition.

use axum::Json;
use axum::extract::{Extension, Path, Query, State};
use medbrains_core::permissions;
use medbrains_core::specialty::ophthalmology::OphthoExam;
use serde::Deserialize;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

use crate::ophtho_refraction::{Workup, ready_to_sign, validate};

/// The exam with its signer's name.
const EXAM_SELECT: &str = "SELECT e.*, u.full_name AS signed_by_name FROM ophtho_exams e \
     LEFT JOIN users u ON u.id = e.signed_by";

/// The workup columns, in the order `bind_workup` binds them from `$3`.
const WORKUP_COLUMNS: [&str; 24] = [
    "visual_acuity_od",
    "visual_acuity_os",
    "bcva_od",
    "bcva_os",
    "near_va_od",
    "near_va_os",
    "sphere_od",
    "sphere_os",
    "cylinder_od",
    "cylinder_os",
    "axis_od",
    "axis_os",
    "add_od",
    "add_os",
    "iop_od",
    "iop_os",
    "pd_mm",
    "lens_type",
    "lens_advice",
    "review_after_months",
    "slit_lamp",
    "fundus",
    "diagnosis",
    "plan",
];

type PgQuery<'q> = sqlx::query::QueryAs<'q, Postgres, OphthoExam, sqlx::postgres::PgArguments>;

fn trimmed(v: Option<String>) -> Option<String> {
    v.map(|s| s.trim().to_owned()).filter(|s| !s.is_empty())
}

fn bind_workup(q: PgQuery<'_>, w: Workup) -> PgQuery<'_> {
    q.bind(trimmed(w.visual_acuity_od))
        .bind(trimmed(w.visual_acuity_os))
        .bind(trimmed(w.bcva_od))
        .bind(trimmed(w.bcva_os))
        .bind(trimmed(w.near_va_od))
        .bind(trimmed(w.near_va_os))
        .bind(w.sphere_od)
        .bind(w.sphere_os)
        .bind(w.cylinder_od)
        .bind(w.cylinder_os)
        .bind(w.axis_od)
        .bind(w.axis_os)
        .bind(w.add_od)
        .bind(w.add_os)
        .bind(w.iop_od)
        .bind(w.iop_os)
        .bind(w.pd_mm)
        .bind(trimmed(w.lens_type))
        .bind(trimmed(w.lens_advice))
        .bind(w.review_after_months)
        .bind(trimmed(w.slit_lamp))
        .bind(trimmed(w.fundus))
        .bind(trimmed(w.diagnosis))
        .bind(trimmed(w.plan))
}

async fn open(
    state: &AppState,
    claims: &Claims,
) -> Result<Transaction<'static, Postgres>, AppError> {
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "ophthalmology",
    )
    .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    Ok(tx)
}

/// One exam, after checking the caller may see its patient.
pub async fn load_exam(
    state: &AppState,
    claims: &Claims,
    id: Uuid,
) -> Result<OphthoExam, AppError> {
    require_permission(claims, permissions::specialty::ophthalmology::exams::LIST)?;
    // The URL names an exam, not a patient: authorize the exam's patient.
    medbrains_authz_gate::require_access_via(
        state,
        claims,
        medbrains_authz_gate::links::OPHTHO_EXAM,
        id,
    )
    .await?;
    let mut tx = open(state, claims).await?;
    let row = sqlx::query_as::<_, OphthoExam>(&format!(
        "{EXAM_SELECT} WHERE e.id = $1 AND e.tenant_id = $2"
    ))
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(row)
}

#[derive(Debug, Deserialize)]
pub struct ListExamsQuery {
    pub patient_id: Option<Uuid>,
    pub encounter_id: Option<Uuid>,
    pub status: Option<String>,
}

/// `GET /api/specialty/ophthalmology/exams`
pub async fn list_ophtho_exams(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListExamsQuery>,
) -> Result<Json<Vec<OphthoExam>>, AppError> {
    require_permission(&claims, permissions::specialty::ophthalmology::exams::LIST)?;
    // With ?patient_id one patient's records, without it every patient's the
    // caller may see — both resolve to a permitted set.
    let permitted = medbrains_authz_gate::patient_filter(&state, &claims, q.patient_id).await?;
    let mut tx = open(&state, &claims).await?;
    let rows = sqlx::query_as::<_, OphthoExam>(&format!(
        "{EXAM_SELECT} WHERE e.tenant_id = $1 \
           AND ($2::uuid[] IS NULL OR e.patient_id = ANY($2)) \
           AND ($3::uuid IS NULL OR e.encounter_id = $3) \
           AND ($4::text IS NULL OR e.status = $4) \
         ORDER BY e.created_at DESC LIMIT 200"
    ))
    .bind(claims.tenant_id)
    .bind(permitted.as_deref())
    .bind(q.encounter_id)
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
    Ok(Json(load_exam(&state, &claims, id).await?))
}

#[derive(Debug, Deserialize)]
pub struct CreateExamRequest {
    pub patient_id: Uuid,
    pub encounter_id: Option<Uuid>,
    #[serde(flatten)]
    pub workup: Workup,
}

/// `POST /api/specialty/ophthalmology/exams`
pub async fn create_ophtho_exam(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateExamRequest>,
) -> Result<Json<OphthoExam>, AppError> {
    require_permission(
        &claims,
        permissions::specialty::ophthalmology::exams::CREATE,
    )?;
    medbrains_authz_gate::require_patient_access(&state, &claims, body.patient_id).await?;
    validate(&body.workup).map_err(AppError::BadRequest)?;
    let mut tx = open(&state, &claims).await?;
    if let Some(encounter) = body.encounter_id {
        // The visit the exam is filed under must be this patient's.
        let same: Option<bool> = sqlx::query_scalar(
            "SELECT patient_id = $2 FROM encounters WHERE id = $1 AND tenant_id = $3",
        )
        .bind(encounter)
        .bind(body.patient_id)
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?;
        if same != Some(true) {
            return Err(AppError::BadRequest(
                "That visit is not this patient's".to_owned(),
            ));
        }
    }
    let placeholders: Vec<String> = (0..WORKUP_COLUMNS.len())
        .map(|i| format!("${}", i + 5))
        .collect();
    let sql = format!(
        "WITH e AS (INSERT INTO ophtho_exams (tenant_id, patient_id, encounter_id, examined_by, \
             examined_at, status, {cols}) \
         VALUES ($1, $2, $3, $4, now(), 'draft', {vals}) RETURNING *) \
         SELECT e.*, NULL::text AS signed_by_name FROM e",
        cols = WORKUP_COLUMNS.join(", "),
        vals = placeholders.join(", "),
    );
    let q = sqlx::query_as::<_, OphthoExam>(&sql)
        .bind(claims.tenant_id)
        .bind(body.patient_id)
        .bind(body.encounter_id)
        .bind(claims.sub);
    let row = bind_workup(q, body.workup).fetch_one(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(row))
}

async fn editable_exam(
    state: &AppState,
    claims: &Claims,
    id: Uuid,
) -> Result<OphthoExam, AppError> {
    let exam = load_exam(state, claims, id).await?;
    if exam.signed_at.is_some() {
        return Err(AppError::Conflict(
            "This prescription is signed. Record a new exam to change it.".to_owned(),
        ));
    }
    Ok(exam)
}

/// `PUT /api/specialty/ophthalmology/exams/{id}` — the whole workup, while unsigned.
pub async fn update_ophtho_exam(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(workup): Json<Workup>,
) -> Result<Json<OphthoExam>, AppError> {
    require_permission(
        &claims,
        permissions::specialty::ophthalmology::exams::UPDATE,
    )?;
    editable_exam(&state, &claims, id).await?;
    validate(&workup).map_err(AppError::BadRequest)?;
    let sets: Vec<String> = WORKUP_COLUMNS
        .iter()
        .enumerate()
        .map(|(i, c)| format!("{c} = ${}", i + 3))
        .collect();
    let sql = format!(
        "WITH e AS (UPDATE ophtho_exams SET {sets}, updated_at = now() \
           WHERE id = $1 AND tenant_id = $2 AND signed_at IS NULL RETURNING *) \
         SELECT e.*, NULL::text AS signed_by_name FROM e",
        sets = sets.join(", "),
    );
    let mut tx = open(&state, &claims).await?;
    let q = sqlx::query_as::<_, OphthoExam>(&sql)
        .bind(id)
        .bind(claims.tenant_id);
    let row = bind_workup(q, workup)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError::Conflict("This exam was signed meanwhile.".to_owned()))?;
    tx.commit().await?;
    Ok(Json(row))
}

/// `POST /api/specialty/ophthalmology/exams/{id}/sign` — complete the exam
/// under the signer's name; its prescription is fixed from here.
pub async fn sign_ophtho_exam(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<OphthoExam>, AppError> {
    require_permission(&claims, permissions::specialty::ophthalmology::exams::SIGN)?;
    let exam = editable_exam(&state, &claims, id).await?;
    ready_to_sign(
        exam.lens_type.as_deref(),
        (exam.sphere_od, exam.sphere_os),
        exam.pd_mm,
        (exam.add_od, exam.add_os),
    )
    .map_err(AppError::BadRequest)?;
    let mut tx = open(&state, &claims).await?;
    let row = sqlx::query_as::<_, OphthoExam>(
        "WITH e AS (UPDATE ophtho_exams SET signed_by = $3, signed_at = now(), status = 'completed', \
             updated_at = now() WHERE id = $1 AND tenant_id = $2 AND signed_at IS NULL RETURNING *) \
         SELECT e.*, u.full_name AS signed_by_name FROM e LEFT JOIN users u ON u.id = e.signed_by",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::Conflict("This exam is already signed.".to_owned()))?;
    tx.commit().await?;
    Ok(Json(row))
}
