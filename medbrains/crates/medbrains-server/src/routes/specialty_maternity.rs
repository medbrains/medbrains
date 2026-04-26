#![allow(clippy::too_many_lines)]

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use medbrains_core::permissions;
use medbrains_core::specialty::maternity::{
    AncVisit, LaborRecord, MaternityRegistration, NewbornRecord, PostnatalRecord,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

// ══════════════════════════════════════════════════════════
//  Request / Query types
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ListMaternityQuery {
    pub risk_category: Option<String>,
    pub is_high_risk: Option<bool>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateMaternityRegRequest {
    pub patient_id: Uuid,
    pub registration_number: String,
    pub lmp_date: String,
    pub edd_date: String,
    pub gravida: Option<i32>,
    pub para: Option<i32>,
    pub abortion: Option<i32>,
    pub living: Option<i32>,
    pub risk_category: Option<String>,
    pub blood_group: Option<String>,
    pub rh_factor: Option<String>,
    pub is_high_risk: Option<bool>,
    pub high_risk_reasons: Option<serde_json::Value>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAncVisitRequest {
    pub visit_number: i32,
    pub gestational_weeks: f64,
    pub weight_kg: Option<f64>,
    pub bp_systolic: Option<i32>,
    pub bp_diastolic: Option<i32>,
    pub fundal_height_cm: Option<f64>,
    pub fetal_heart_rate: Option<i32>,
    pub hemoglobin: Option<f64>,
    pub urine_protein: Option<String>,
    pub urine_sugar: Option<String>,
    pub pcpndt_form_f_filed: Option<bool>,
    pub pcpndt_form_f_number: Option<String>,
    pub ultrasound_done: Option<bool>,
    pub next_visit_date: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateLaborRecordRequest {
    pub admission_id: Option<Uuid>,
    pub labor_onset_time: Option<String>,
    pub current_stage: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateLaborRecordRequest {
    pub current_stage: Option<String>,
    pub partograph_data: Option<serde_json::Value>,
    pub cervical_dilation_log: Option<serde_json::Value>,
    pub delivery_type: Option<String>,
    pub delivery_time: Option<String>,
    pub blood_loss_ml: Option<i32>,
    pub episiotomy: Option<bool>,
    pub perineal_tear_grade: Option<i32>,
    pub apgar_1min: Option<i32>,
    pub apgar_5min: Option<i32>,
    pub baby_weight_gm: Option<i32>,
    pub complications: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateNewbornRequest {
    pub gender: String,
    pub weight_gm: i32,
    pub length_cm: Option<f64>,
    pub head_circumference_cm: Option<f64>,
    pub apgar_1min: Option<i32>,
    pub apgar_5min: Option<i32>,
    pub apgar_10min: Option<i32>,
    pub resuscitation_needed: Option<bool>,
    pub bcg_given: Option<bool>,
    pub opv_given: Option<bool>,
    pub hep_b_given: Option<bool>,
    pub vitamin_k_given: Option<bool>,
    pub nicu_admission_needed: Option<bool>,
    pub nicu_admission_reason: Option<String>,
    pub congenital_anomalies: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePostnatalRequest {
    pub day_postpartum: i32,
    pub mother_vitals: Option<serde_json::Value>,
    pub uterus_involution: Option<String>,
    pub lochia: Option<String>,
    pub breast_feeding_status: Option<String>,
    pub baby_vitals: Option<serde_json::Value>,
    pub baby_weight_gm: Option<i32>,
    pub baby_feeding: Option<String>,
    pub notes: Option<String>,
}

// ══════════════════════════════════════════════════════════
//  Handlers — Maternity Registrations
// ══════════════════════════════════════════════════════════

pub async fn list_registrations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListMaternityQuery>,
) -> Result<Json<Vec<MaternityRegistration>>, AppError> {
    require_permission(
        &claims,
        permissions::specialty::maternity::registrations::LIST,
    )?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, MaternityRegistration>(
        "SELECT * FROM maternity_registrations \
         WHERE ($1::text IS NULL OR risk_category::text = $1) \
         AND ($2::bool IS NULL OR is_high_risk = $2) \
         AND ($3::text IS NULL OR status = $3) \
         ORDER BY created_at DESC LIMIT 200",
    )
    .bind(&params.risk_category)
    .bind(params.is_high_risk)
    .bind(&params.status)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn get_registration(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<MaternityRegistration>, AppError> {
    require_permission(
        &claims,
        permissions::specialty::maternity::registrations::LIST,
    )?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, MaternityRegistration>(
        "SELECT * FROM maternity_registrations WHERE id = $1",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn create_registration(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateMaternityRegRequest>,
) -> Result<Json<MaternityRegistration>, AppError> {
    require_permission(
        &claims,
        permissions::specialty::maternity::registrations::CREATE,
    )?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, MaternityRegistration>(
        "INSERT INTO maternity_registrations \
         (tenant_id, patient_id, registration_number, lmp_date, edd_date, \
          gravida, para, abortion, living, risk_category, \
          blood_group, rh_factor, is_high_risk, high_risk_reasons, notes) \
         VALUES ($1, $2, $3, $4::date, $5::date, \
                 COALESCE($6, 1), COALESCE($7, 0), COALESCE($8, 0), COALESCE($9, 0), \
                 COALESCE($10::anc_risk_category, 'low'), $11, $12, \
                 COALESCE($13, false), COALESCE($14, '[]'::jsonb), $15) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(&body.registration_number)
    .bind(&body.lmp_date)
    .bind(&body.edd_date)
    .bind(body.gravida)
    .bind(body.para)
    .bind(body.abortion)
    .bind(body.living)
    .bind(&body.risk_category)
    .bind(&body.blood_group)
    .bind(&body.rh_factor)
    .bind(body.is_high_risk)
    .bind(&body.high_risk_reasons)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ── ANC Visits ───────────────────────────────────────────

pub async fn list_anc_visits(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(registration_id): Path<Uuid>,
) -> Result<Json<Vec<AncVisit>>, AppError> {
    require_permission(&claims, permissions::specialty::maternity::anc::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, AncVisit>(
        "SELECT * FROM anc_visits WHERE registration_id = $1 ORDER BY visit_number",
    )
    .bind(registration_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_anc_visit(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(registration_id): Path<Uuid>,
    Json(body): Json<CreateAncVisitRequest>,
) -> Result<Json<AncVisit>, AppError> {
    require_permission(&claims, permissions::specialty::maternity::anc::CREATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, AncVisit>(
        "INSERT INTO anc_visits \
         (tenant_id, registration_id, visit_number, gestational_weeks, \
          weight_kg, bp_systolic, bp_diastolic, fundal_height_cm, \
          fetal_heart_rate, hemoglobin, urine_protein, urine_sugar, \
          pcpndt_form_f_filed, pcpndt_form_f_number, ultrasound_done, \
          examined_by, next_visit_date, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, \
                 COALESCE($13, false), $14, COALESCE($15, false), \
                 $16, $17::date, $18) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(registration_id)
    .bind(body.visit_number)
    .bind(body.gestational_weeks)
    .bind(body.weight_kg)
    .bind(body.bp_systolic)
    .bind(body.bp_diastolic)
    .bind(body.fundal_height_cm)
    .bind(body.fetal_heart_rate)
    .bind(body.hemoglobin)
    .bind(&body.urine_protein)
    .bind(&body.urine_sugar)
    .bind(body.pcpndt_form_f_filed)
    .bind(&body.pcpndt_form_f_number)
    .bind(body.ultrasound_done)
    .bind(claims.sub)
    .bind(&body.next_visit_date)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ── Labor Records ────────────────────────────────────────

pub async fn list_labor_records(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(registration_id): Path<Uuid>,
) -> Result<Json<Vec<LaborRecord>>, AppError> {
    require_permission(&claims, permissions::specialty::maternity::labor::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, LaborRecord>(
        "SELECT * FROM labor_records WHERE registration_id = $1 ORDER BY created_at DESC",
    )
    .bind(registration_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_labor_record(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(registration_id): Path<Uuid>,
    Json(body): Json<CreateLaborRecordRequest>,
) -> Result<Json<LaborRecord>, AppError> {
    require_permission(&claims, permissions::specialty::maternity::labor::CREATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, LaborRecord>(
        "INSERT INTO labor_records \
         (tenant_id, registration_id, admission_id, labor_onset_time, \
          current_stage, attending_doctor_id, notes) \
         VALUES ($1, $2, $3, $4::timestamptz, \
                 COALESCE($5::labor_stage, 'first_latent'), $6, $7) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(registration_id)
    .bind(body.admission_id)
    .bind(&body.labor_onset_time)
    .bind(&body.current_stage)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_labor_record(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateLaborRecordRequest>,
) -> Result<Json<LaborRecord>, AppError> {
    require_permission(&claims, permissions::specialty::maternity::labor::CREATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, LaborRecord>(
        "UPDATE labor_records SET \
         current_stage = COALESCE($2::labor_stage, current_stage), \
         partograph_data = COALESCE($3, partograph_data), \
         cervical_dilation_log = COALESCE($4, cervical_dilation_log), \
         delivery_type = COALESCE($5::delivery_type, delivery_type), \
         delivery_time = COALESCE($6::timestamptz, delivery_time), \
         blood_loss_ml = COALESCE($7, blood_loss_ml), \
         episiotomy = COALESCE($8, episiotomy), \
         perineal_tear_grade = COALESCE($9, perineal_tear_grade), \
         apgar_1min = COALESCE($10, apgar_1min), \
         apgar_5min = COALESCE($11, apgar_5min), \
         baby_weight_gm = COALESCE($12, baby_weight_gm), \
         complications = COALESCE($13, complications), \
         notes = COALESCE($14, notes), \
         placenta_delivery_time = CASE WHEN $2 = 'completed' AND placenta_delivery_time IS NULL \
                                  THEN now() ELSE placenta_delivery_time END \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&body.current_stage)
    .bind(&body.partograph_data)
    .bind(&body.cervical_dilation_log)
    .bind(&body.delivery_type)
    .bind(&body.delivery_time)
    .bind(body.blood_loss_ml)
    .bind(body.episiotomy)
    .bind(body.perineal_tear_grade)
    .bind(body.apgar_1min)
    .bind(body.apgar_5min)
    .bind(body.baby_weight_gm)
    .bind(&body.complications)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ── Newborn Records ──────────────────────────────────────

pub async fn list_newborns(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(labor_id): Path<Uuid>,
) -> Result<Json<Vec<NewbornRecord>>, AppError> {
    require_permission(&claims, permissions::specialty::maternity::newborn::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, NewbornRecord>(
        "SELECT * FROM newborn_records WHERE labor_id = $1 ORDER BY birth_date",
    )
    .bind(labor_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_newborn(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(labor_id): Path<Uuid>,
    Json(body): Json<CreateNewbornRequest>,
) -> Result<Json<NewbornRecord>, AppError> {
    require_permission(&claims, permissions::specialty::maternity::newborn::CREATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, NewbornRecord>(
        "INSERT INTO newborn_records \
         (tenant_id, labor_id, birth_date, gender, weight_gm, length_cm, \
          head_circumference_cm, apgar_1min, apgar_5min, apgar_10min, \
          resuscitation_needed, bcg_given, opv_given, hep_b_given, vitamin_k_given, \
          nicu_admission_needed, nicu_admission_reason, congenital_anomalies, notes) \
         VALUES ($1, $2, now(), $3, $4, $5, $6, $7, $8, $9, \
                 COALESCE($10, false), COALESCE($11, false), COALESCE($12, false), \
                 COALESCE($13, false), COALESCE($14, false), \
                 COALESCE($15, false), $16, $17, $18) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(labor_id)
    .bind(&body.gender)
    .bind(body.weight_gm)
    .bind(body.length_cm)
    .bind(body.head_circumference_cm)
    .bind(body.apgar_1min)
    .bind(body.apgar_5min)
    .bind(body.apgar_10min)
    .bind(body.resuscitation_needed)
    .bind(body.bcg_given)
    .bind(body.opv_given)
    .bind(body.hep_b_given)
    .bind(body.vitamin_k_given)
    .bind(body.nicu_admission_needed)
    .bind(&body.nicu_admission_reason)
    .bind(&body.congenital_anomalies)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ── Postnatal Records ────────────────────────────────────

pub async fn list_postnatal(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(registration_id): Path<Uuid>,
) -> Result<Json<Vec<PostnatalRecord>>, AppError> {
    require_permission(&claims, permissions::specialty::maternity::newborn::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, PostnatalRecord>(
        "SELECT * FROM postnatal_records WHERE registration_id = $1 \
         ORDER BY day_postpartum",
    )
    .bind(registration_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_postnatal(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(registration_id): Path<Uuid>,
    Json(body): Json<CreatePostnatalRequest>,
) -> Result<Json<PostnatalRecord>, AppError> {
    require_permission(&claims, permissions::specialty::maternity::newborn::CREATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, PostnatalRecord>(
        "INSERT INTO postnatal_records \
         (tenant_id, registration_id, day_postpartum, mother_vitals, \
          uterus_involution, lochia, breast_feeding_status, \
          baby_vitals, baby_weight_gm, baby_feeding, examined_by, notes) \
         VALUES ($1, $2, $3, COALESCE($4, '{}'::jsonb), $5, $6, $7, \
                 COALESCE($8, '{}'::jsonb), $9, $10, $11, $12) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(registration_id)
    .bind(body.day_postpartum)
    .bind(&body.mother_vitals)
    .bind(&body.uterus_involution)
    .bind(&body.lochia)
    .bind(&body.breast_feeding_status)
    .bind(&body.baby_vitals)
    .bind(body.baby_weight_gm)
    .bind(&body.baby_feeding)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}
