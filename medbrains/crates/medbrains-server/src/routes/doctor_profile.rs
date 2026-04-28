//! Doctor profile management — admin CRUD + self-service.
//!
//! Per `RFCs/sprints/SPRINT-doctor-activities.md` §2.1.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, NaiveDate, Utc};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError,
    middleware::auth::Claims,
    middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DoctorProfile {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub user_id: Uuid,
    pub prefix: Option<String>,
    pub display_name: String,
    pub qualification_string: Option<String>,
    pub mci_number: Option<String>,
    pub state_council_number: Option<String>,
    pub state_council_name: Option<String>,
    pub registration_valid_until: Option<NaiveDate>,
    pub specialty_ids: Vec<Uuid>,
    pub subspecialty: Option<String>,
    pub years_experience: Option<i32>,
    pub is_full_time: bool,
    pub is_visiting: bool,
    pub parent_employee_id: Option<Uuid>,
    pub can_prescribe_schedule_x: bool,
    pub can_perform_surgery: bool,
    pub can_sign_mlc: bool,
    pub can_sign_death_certificate: bool,
    pub can_sign_fitness_certificate: bool,
    pub bio_short: Option<String>,
    pub bio_long: Option<String>,
    pub photo_url: Option<String>,
    pub languages_spoken: Vec<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct ListDoctorsQuery {
    pub specialty_id: Option<Uuid>,
    pub is_active: Option<bool>,
    pub is_visiting: Option<bool>,
    pub search: Option<String>,
    pub limit: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct CreateDoctorRequest {
    pub user_id: Uuid,
    pub prefix: Option<String>,
    pub display_name: String,
    pub qualification_string: Option<String>,
    pub mci_number: Option<String>,
    pub state_council_number: Option<String>,
    pub state_council_name: Option<String>,
    pub registration_valid_until: Option<NaiveDate>,
    #[serde(default)]
    pub specialty_ids: Vec<Uuid>,
    pub subspecialty: Option<String>,
    pub years_experience: Option<i32>,
    pub is_full_time: Option<bool>,
    pub is_visiting: Option<bool>,
    pub can_prescribe_schedule_x: Option<bool>,
    pub can_perform_surgery: Option<bool>,
    pub can_sign_mlc: Option<bool>,
    pub can_sign_death_certificate: Option<bool>,
    pub can_sign_fitness_certificate: Option<bool>,
    pub bio_short: Option<String>,
    pub photo_url: Option<String>,
    #[serde(default)]
    pub languages_spoken: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateDoctorRequest {
    pub prefix: Option<String>,
    pub display_name: Option<String>,
    pub qualification_string: Option<String>,
    pub mci_number: Option<String>,
    pub state_council_number: Option<String>,
    pub state_council_name: Option<String>,
    pub registration_valid_until: Option<NaiveDate>,
    pub specialty_ids: Option<Vec<Uuid>>,
    pub subspecialty: Option<String>,
    pub years_experience: Option<i32>,
    pub is_full_time: Option<bool>,
    pub is_visiting: Option<bool>,
    pub can_prescribe_schedule_x: Option<bool>,
    pub can_perform_surgery: Option<bool>,
    pub can_sign_mlc: Option<bool>,
    pub can_sign_death_certificate: Option<bool>,
    pub can_sign_fitness_certificate: Option<bool>,
    pub bio_short: Option<String>,
    pub bio_long: Option<String>,
    pub photo_url: Option<String>,
    pub languages_spoken: Option<Vec<String>>,
    pub is_active: Option<bool>,
}

// ── Admin: list doctors ───────────────────────────────────────────────

pub async fn list_doctors(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListDoctorsQuery>,
) -> Result<Json<Vec<DoctorProfile>>, AppError> {
    require_permission(&claims, permissions::admin::doctors::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let limit = q.limit.unwrap_or(200).min(1000);

    let rows = sqlx::query_as::<_, DoctorProfile>(
        "SELECT * FROM doctor_profiles \
         WHERE tenant_id = $1 \
           AND ($2::boolean IS NULL OR is_active = $2) \
           AND ($3::boolean IS NULL OR is_visiting = $3) \
           AND ($4::uuid IS NULL OR $4 = ANY(specialty_ids)) \
           AND ($5::text IS NULL OR display_name ILIKE '%' || $5 || '%' \
                                 OR mci_number ILIKE '%' || $5 || '%') \
         ORDER BY display_name \
         LIMIT $6",
    )
    .bind(claims.tenant_id)
    .bind(q.is_active)
    .bind(q.is_visiting)
    .bind(q.specialty_id)
    .bind(q.search.as_deref())
    .bind(limit)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn get_doctor(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<DoctorProfile>, AppError> {
    require_permission(&claims, permissions::admin::doctors::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, DoctorProfile>(
        "SELECT * FROM doctor_profiles WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn create_doctor(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateDoctorRequest>,
) -> Result<Json<DoctorProfile>, AppError> {
    require_permission(&claims, permissions::admin::doctors::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, DoctorProfile>(
        "INSERT INTO doctor_profiles ( \
            tenant_id, user_id, prefix, display_name, qualification_string, \
            mci_number, state_council_number, state_council_name, \
            registration_valid_until, specialty_ids, subspecialty, years_experience, \
            is_full_time, is_visiting, can_prescribe_schedule_x, \
            can_perform_surgery, can_sign_mlc, can_sign_death_certificate, \
            can_sign_fitness_certificate, bio_short, photo_url, languages_spoken \
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.user_id)
    .bind(&body.prefix)
    .bind(&body.display_name)
    .bind(&body.qualification_string)
    .bind(&body.mci_number)
    .bind(&body.state_council_number)
    .bind(&body.state_council_name)
    .bind(body.registration_valid_until)
    .bind(&body.specialty_ids)
    .bind(&body.subspecialty)
    .bind(body.years_experience)
    .bind(body.is_full_time.unwrap_or(true))
    .bind(body.is_visiting.unwrap_or(false))
    .bind(body.can_prescribe_schedule_x.unwrap_or(false))
    .bind(body.can_perform_surgery.unwrap_or(false))
    .bind(body.can_sign_mlc.unwrap_or(false))
    .bind(body.can_sign_death_certificate.unwrap_or(false))
    .bind(body.can_sign_fitness_certificate.unwrap_or(true))
    .bind(&body.bio_short)
    .bind(&body.photo_url)
    .bind(&body.languages_spoken)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_doctor(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateDoctorRequest>,
) -> Result<Json<DoctorProfile>, AppError> {
    require_permission(&claims, permissions::admin::doctors::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, DoctorProfile>(
        "UPDATE doctor_profiles SET \
           prefix = COALESCE($3, prefix), \
           display_name = COALESCE($4, display_name), \
           qualification_string = COALESCE($5, qualification_string), \
           mci_number = COALESCE($6, mci_number), \
           state_council_number = COALESCE($7, state_council_number), \
           state_council_name = COALESCE($8, state_council_name), \
           registration_valid_until = COALESCE($9, registration_valid_until), \
           specialty_ids = COALESCE($10, specialty_ids), \
           subspecialty = COALESCE($11, subspecialty), \
           years_experience = COALESCE($12, years_experience), \
           is_full_time = COALESCE($13, is_full_time), \
           is_visiting = COALESCE($14, is_visiting), \
           can_prescribe_schedule_x = COALESCE($15, can_prescribe_schedule_x), \
           can_perform_surgery = COALESCE($16, can_perform_surgery), \
           can_sign_mlc = COALESCE($17, can_sign_mlc), \
           can_sign_death_certificate = COALESCE($18, can_sign_death_certificate), \
           can_sign_fitness_certificate = COALESCE($19, can_sign_fitness_certificate), \
           bio_short = COALESCE($20, bio_short), \
           bio_long = COALESCE($21, bio_long), \
           photo_url = COALESCE($22, photo_url), \
           languages_spoken = COALESCE($23, languages_spoken), \
           is_active = COALESCE($24, is_active), \
           updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.prefix)
    .bind(&body.display_name)
    .bind(&body.qualification_string)
    .bind(&body.mci_number)
    .bind(&body.state_council_number)
    .bind(&body.state_council_name)
    .bind(body.registration_valid_until)
    .bind(body.specialty_ids.as_ref())
    .bind(&body.subspecialty)
    .bind(body.years_experience)
    .bind(body.is_full_time)
    .bind(body.is_visiting)
    .bind(body.can_prescribe_schedule_x)
    .bind(body.can_perform_surgery)
    .bind(body.can_sign_mlc)
    .bind(body.can_sign_death_certificate)
    .bind(body.can_sign_fitness_certificate)
    .bind(&body.bio_short)
    .bind(&body.bio_long)
    .bind(&body.photo_url)
    .bind(body.languages_spoken.as_ref())
    .bind(body.is_active)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

// ── Self-service: doctor's own profile ────────────────────────────────

pub async fn get_my_profile(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<DoctorProfile>, AppError> {
    require_permission(&claims, permissions::doctor::profile::VIEW_OWN)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, DoctorProfile>(
        "SELECT * FROM doctor_profiles WHERE user_id = $1 AND tenant_id = $2",
    )
    .bind(claims.sub)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_my_profile(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpdateMyProfileRequest>,
) -> Result<Json<DoctorProfile>, AppError> {
    require_permission(&claims, permissions::doctor::profile::UPDATE_OWN)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Doctors can only edit safe self-service fields. Capability flags
    // (can_sign_mlc, can_prescribe_schedule_x, etc.) are admin-only.
    let row = sqlx::query_as::<_, DoctorProfile>(
        "UPDATE doctor_profiles SET \
           bio_short = COALESCE($3, bio_short), \
           bio_long = COALESCE($4, bio_long), \
           photo_url = COALESCE($5, photo_url), \
           languages_spoken = COALESCE($6, languages_spoken), \
           updated_at = now() \
         WHERE user_id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(claims.sub)
    .bind(claims.tenant_id)
    .bind(&body.bio_short)
    .bind(&body.bio_long)
    .bind(&body.photo_url)
    .bind(body.languages_spoken.as_ref())
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct UpdateMyProfileRequest {
    pub bio_short: Option<String>,
    pub bio_long: Option<String>,
    pub photo_url: Option<String>,
    pub languages_spoken: Option<Vec<String>>,
}
