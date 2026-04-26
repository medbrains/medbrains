#![allow(clippy::too_many_lines)]

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{NaiveDate, Utc};
use medbrains_core::camp::{
    Camp, CampBillingRecord, CampFollowup, CampLabSample, CampRegistration, CampScreening,
    CampTeamMember,
};
use medbrains_core::permissions;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

// ══════════════════════════════════════════════════════════
//  Request / Query types
// ══════════════════════════════════════════════════════════

// ── Camps ────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListCampsQuery {
    pub status: Option<String>,
    pub camp_type: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCampRequest {
    pub name: String,
    pub camp_type: String,
    pub organizing_department_id: Option<Uuid>,
    pub coordinator_id: Option<Uuid>,
    pub scheduled_date: NaiveDate,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub venue_name: Option<String>,
    pub venue_address: Option<String>,
    pub venue_city: Option<String>,
    pub venue_state: Option<String>,
    pub venue_pincode: Option<String>,
    pub venue_latitude: Option<f64>,
    pub venue_longitude: Option<f64>,
    pub expected_participants: Option<i32>,
    pub budget_allocated: Option<Decimal>,
    pub logistics_notes: Option<String>,
    pub equipment_list: Option<serde_json::Value>,
    pub is_free: Option<bool>,
    pub discount_percentage: Option<Decimal>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCampRequest {
    pub name: Option<String>,
    pub organizing_department_id: Option<Uuid>,
    pub coordinator_id: Option<Uuid>,
    pub scheduled_date: Option<NaiveDate>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub venue_name: Option<String>,
    pub venue_address: Option<String>,
    pub venue_city: Option<String>,
    pub venue_state: Option<String>,
    pub venue_pincode: Option<String>,
    pub venue_latitude: Option<f64>,
    pub venue_longitude: Option<f64>,
    pub expected_participants: Option<i32>,
    pub budget_allocated: Option<Decimal>,
    pub budget_spent: Option<Decimal>,
    pub logistics_notes: Option<String>,
    pub equipment_list: Option<serde_json::Value>,
    pub is_free: Option<bool>,
    pub discount_percentage: Option<Decimal>,
    pub summary_notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CancelCampRequest {
    pub cancellation_reason: Option<String>,
}

// ── Team Members ─────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct AddTeamMemberRequest {
    pub employee_id: Uuid,
    pub role_in_camp: String,
    pub is_confirmed: Option<bool>,
    pub notes: Option<String>,
}

// ── Registrations ────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListRegistrationsQuery {
    pub camp_id: Uuid,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateRegistrationRequest {
    pub camp_id: Uuid,
    pub person_name: String,
    pub age: Option<i32>,
    pub gender: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub id_proof_type: Option<String>,
    pub id_proof_number: Option<String>,
    pub patient_id: Option<Uuid>,
    pub chief_complaint: Option<String>,
    pub is_walk_in: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateRegistrationRequest {
    pub status: Option<String>,
    pub patient_id: Option<Uuid>,
    pub chief_complaint: Option<String>,
}

// ── Screenings ───────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListScreeningsQuery {
    pub camp_id: Option<Uuid>,
    pub registration_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateScreeningRequest {
    pub registration_id: Uuid,
    pub bp_systolic: Option<i32>,
    pub bp_diastolic: Option<i32>,
    pub pulse_rate: Option<i32>,
    pub spo2: Option<i32>,
    pub temperature: Option<Decimal>,
    pub blood_sugar_random: Option<Decimal>,
    pub bmi: Option<Decimal>,
    pub height_cm: Option<Decimal>,
    pub weight_kg: Option<Decimal>,
    pub visual_acuity_left: Option<String>,
    pub visual_acuity_right: Option<String>,
    pub findings: Option<String>,
    pub diagnosis: Option<String>,
    pub advice: Option<String>,
    pub referred_to_hospital: Option<bool>,
    pub referral_department: Option<String>,
    pub referral_urgency: Option<String>,
}

// ── Lab Samples ──────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListLabSamplesQuery {
    pub camp_id: Option<Uuid>,
    pub registration_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateLabSampleRequest {
    pub registration_id: Uuid,
    pub sample_type: String,
    pub test_requested: Option<String>,
    pub barcode: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct LinkLabSampleRequest {
    pub lab_order_id: Uuid,
    pub result_summary: Option<String>,
}

// ── Billing ──────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListBillingQuery {
    pub camp_id: Option<Uuid>,
    pub registration_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateBillingRequest {
    pub registration_id: Uuid,
    pub service_description: String,
    pub standard_amount: Decimal,
    pub discount_percentage: Option<Decimal>,
    pub charged_amount: Decimal,
    pub is_free: Option<bool>,
    pub payment_mode: Option<String>,
    pub payment_reference: Option<String>,
}

// ── Follow-ups ───────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListFollowupsQuery {
    pub camp_id: Option<Uuid>,
    pub registration_id: Option<Uuid>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateFollowupRequest {
    pub registration_id: Uuid,
    pub followup_date: NaiveDate,
    pub followup_type: String,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateFollowupRequest {
    pub status: Option<String>,
    pub notes: Option<String>,
    pub outcome: Option<String>,
    pub converted_to_patient: Option<bool>,
    pub converted_patient_id: Option<Uuid>,
    pub converted_department_id: Option<Uuid>,
}

// ── Stats ────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct CampStatsResponse {
    pub total_registrations: i64,
    pub screened: i64,
    pub referred: i64,
    pub converted: i64,
    pub lab_samples: i64,
    pub followups_scheduled: i64,
    pub followups_completed: i64,
    pub billing_total: Decimal,
}

#[derive(Debug, sqlx::FromRow)]
struct CountRow {
    count: Option<i64>,
}

#[derive(Debug, sqlx::FromRow)]
struct SumRow {
    total: Option<Decimal>,
}

// ══════════════════════════════════════════════════════════
//  Handlers — Camps
// ══════════════════════════════════════════════════════════

pub async fn list_camps(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListCampsQuery>,
) -> Result<Json<Vec<Camp>>, AppError> {
    require_permission(&claims, permissions::camp::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, Camp>(
        "SELECT * FROM camps \
         WHERE ($1::text IS NULL OR status::text = $1) \
         AND ($2::text IS NULL OR camp_type::text = $2) \
         ORDER BY scheduled_date DESC LIMIT 200",
    )
    .bind(&params.status)
    .bind(&params.camp_type)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn get_camp(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Camp>, AppError> {
    require_permission(&claims, permissions::camp::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, Camp>("SELECT * FROM camps WHERE id = $1")
        .bind(id)
        .fetch_one(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn create_camp(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateCampRequest>,
) -> Result<Json<Camp>, AppError> {
    require_permission(&claims, permissions::camp::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let now = Utc::now();
    let ts = now.format("%Y%m%d%H%M%S");
    let uid = Uuid::new_v4();
    let camp_code = format!("CAMP-{ts}-{}", &uid.to_string()[..8]);

    let row = sqlx::query_as::<_, Camp>(
        "INSERT INTO camps \
         (tenant_id, camp_code, name, camp_type, organizing_department_id, coordinator_id, \
          scheduled_date, start_time, end_time, \
          venue_name, venue_address, venue_city, venue_state, venue_pincode, \
          venue_latitude, venue_longitude, \
          expected_participants, budget_allocated, logistics_notes, equipment_list, \
          is_free, discount_percentage, created_by) \
         VALUES ($1, $2, $3, $4::camp_type, $5, $6, \
                 $7, $8, $9, \
                 $10, $11, $12, $13, $14, \
                 $15, $16, \
                 $17, $18, $19, $20, \
                 COALESCE($21, true), $22, $23) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&camp_code)
    .bind(&body.name)
    .bind(&body.camp_type)
    .bind(body.organizing_department_id)
    .bind(body.coordinator_id)
    .bind(body.scheduled_date)
    .bind(&body.start_time)
    .bind(&body.end_time)
    .bind(&body.venue_name)
    .bind(&body.venue_address)
    .bind(&body.venue_city)
    .bind(&body.venue_state)
    .bind(&body.venue_pincode)
    .bind(body.venue_latitude)
    .bind(body.venue_longitude)
    .bind(body.expected_participants)
    .bind(body.budget_allocated)
    .bind(&body.logistics_notes)
    .bind(&body.equipment_list)
    .bind(body.is_free)
    .bind(body.discount_percentage)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_camp(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateCampRequest>,
) -> Result<Json<Camp>, AppError> {
    require_permission(&claims, permissions::camp::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, Camp>(
        "UPDATE camps SET \
         name = COALESCE($2, name), \
         organizing_department_id = COALESCE($3, organizing_department_id), \
         coordinator_id = COALESCE($4, coordinator_id), \
         scheduled_date = COALESCE($5, scheduled_date), \
         start_time = COALESCE($6, start_time), \
         end_time = COALESCE($7, end_time), \
         venue_name = COALESCE($8, venue_name), \
         venue_address = COALESCE($9, venue_address), \
         venue_city = COALESCE($10, venue_city), \
         venue_state = COALESCE($11, venue_state), \
         venue_pincode = COALESCE($12, venue_pincode), \
         venue_latitude = COALESCE($13, venue_latitude), \
         venue_longitude = COALESCE($14, venue_longitude), \
         expected_participants = COALESCE($15, expected_participants), \
         budget_allocated = COALESCE($16, budget_allocated), \
         budget_spent = COALESCE($17, budget_spent), \
         logistics_notes = COALESCE($18, logistics_notes), \
         equipment_list = COALESCE($19, equipment_list), \
         is_free = COALESCE($20, is_free), \
         discount_percentage = COALESCE($21, discount_percentage), \
         summary_notes = COALESCE($22, summary_notes) \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&body.name)
    .bind(body.organizing_department_id)
    .bind(body.coordinator_id)
    .bind(body.scheduled_date)
    .bind(&body.start_time)
    .bind(&body.end_time)
    .bind(&body.venue_name)
    .bind(&body.venue_address)
    .bind(&body.venue_city)
    .bind(&body.venue_state)
    .bind(&body.venue_pincode)
    .bind(body.venue_latitude)
    .bind(body.venue_longitude)
    .bind(body.expected_participants)
    .bind(body.budget_allocated)
    .bind(body.budget_spent)
    .bind(&body.logistics_notes)
    .bind(&body.equipment_list)
    .bind(body.is_free)
    .bind(body.discount_percentage)
    .bind(&body.summary_notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn approve_camp(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Camp>, AppError> {
    require_permission(&claims, permissions::camp::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, Camp>(
        "UPDATE camps SET status = 'approved', approved_by = $2, approved_at = now() \
         WHERE id = $1 AND status = 'planned' RETURNING *",
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn activate_camp(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Camp>, AppError> {
    require_permission(&claims, permissions::camp::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, Camp>(
        "UPDATE camps SET status = 'active' \
         WHERE id = $1 AND status IN ('approved', 'setup') RETURNING *",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn complete_camp(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Camp>, AppError> {
    require_permission(&claims, permissions::camp::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Count actual participants
    let count_row = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*)::bigint AS count FROM camp_registrations WHERE camp_id = $1",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;

    let actual = i32::try_from(count_row.count.unwrap_or(0)).unwrap_or(0);

    let row = sqlx::query_as::<_, Camp>(
        "UPDATE camps SET status = 'completed', actual_participants = $2, completed_at = now() \
         WHERE id = $1 AND status = 'active' RETURNING *",
    )
    .bind(id)
    .bind(actual)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn cancel_camp(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CancelCampRequest>,
) -> Result<Json<Camp>, AppError> {
    require_permission(&claims, permissions::camp::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, Camp>(
        "UPDATE camps SET status = 'cancelled', cancellation_reason = $2 \
         WHERE id = $1 AND status NOT IN ('completed', 'cancelled') RETURNING *",
    )
    .bind(id)
    .bind(&body.cancellation_reason)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Team Members
// ══════════════════════════════════════════════════════════

pub async fn list_team_members(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(camp_id): Path<Uuid>,
) -> Result<Json<Vec<CampTeamMember>>, AppError> {
    require_permission(&claims, permissions::camp::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CampTeamMember>(
        "SELECT * FROM camp_team_members WHERE camp_id = $1 ORDER BY created_at",
    )
    .bind(camp_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn add_team_member(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(camp_id): Path<Uuid>,
    Json(body): Json<AddTeamMemberRequest>,
) -> Result<Json<CampTeamMember>, AppError> {
    require_permission(&claims, permissions::camp::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CampTeamMember>(
        "INSERT INTO camp_team_members \
         (tenant_id, camp_id, employee_id, role_in_camp, is_confirmed, notes) \
         VALUES ($1, $2, $3, $4, COALESCE($5, false), $6) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(camp_id)
    .bind(body.employee_id)
    .bind(&body.role_in_camp)
    .bind(body.is_confirmed)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn remove_team_member(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((_camp_id, member_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::camp::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    sqlx::query("DELETE FROM camp_team_members WHERE id = $1")
        .bind(member_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "deleted": true })))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Registrations
// ══════════════════════════════════════════════════════════

pub async fn list_registrations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListRegistrationsQuery>,
) -> Result<Json<Vec<CampRegistration>>, AppError> {
    require_permission(&claims, permissions::camp::registrations::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CampRegistration>(
        "SELECT * FROM camp_registrations \
         WHERE camp_id = $1 \
         AND ($2::text IS NULL OR status::text = $2) \
         ORDER BY created_at DESC LIMIT 500",
    )
    .bind(params.camp_id)
    .bind(&params.status)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_registration(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateRegistrationRequest>,
) -> Result<Json<CampRegistration>, AppError> {
    require_permission(&claims, permissions::camp::registrations::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Get camp_code for the registration number
    let camp = sqlx::query_as::<_, Camp>("SELECT * FROM camps WHERE id = $1")
        .bind(body.camp_id)
        .fetch_one(&mut *tx)
        .await?;

    // Count existing registrations for sequence
    let count_row = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*)::bigint AS count FROM camp_registrations WHERE camp_id = $1",
    )
    .bind(body.camp_id)
    .fetch_one(&mut *tx)
    .await?;

    let seq = count_row.count.unwrap_or(0) + 1;
    let reg_number = format!("CR-{}-{seq:04}", camp.camp_code);

    let row = sqlx::query_as::<_, CampRegistration>(
        "INSERT INTO camp_registrations \
         (tenant_id, camp_id, registration_number, person_name, age, gender, phone, \
          address, id_proof_type, id_proof_number, patient_id, chief_complaint, \
          is_walk_in, registered_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, \
                 $8, $9, $10, $11, $12, \
                 COALESCE($13, true), $14) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.camp_id)
    .bind(&reg_number)
    .bind(&body.person_name)
    .bind(body.age)
    .bind(&body.gender)
    .bind(&body.phone)
    .bind(&body.address)
    .bind(&body.id_proof_type)
    .bind(&body.id_proof_number)
    .bind(body.patient_id)
    .bind(&body.chief_complaint)
    .bind(body.is_walk_in)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_registration(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateRegistrationRequest>,
) -> Result<Json<CampRegistration>, AppError> {
    require_permission(&claims, permissions::camp::registrations::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CampRegistration>(
        "UPDATE camp_registrations SET \
         status = COALESCE($2::camp_registration_status, status), \
         patient_id = COALESCE($3, patient_id), \
         chief_complaint = COALESCE($4, chief_complaint) \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&body.status)
    .bind(body.patient_id)
    .bind(&body.chief_complaint)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Screenings
// ══════════════════════════════════════════════════════════

pub async fn list_screenings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListScreeningsQuery>,
) -> Result<Json<Vec<CampScreening>>, AppError> {
    require_permission(&claims, permissions::camp::screenings::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CampScreening>(
        "SELECT s.* FROM camp_screenings s \
         JOIN camp_registrations r ON r.id = s.registration_id \
         WHERE ($1::uuid IS NULL OR r.camp_id = $1) \
         AND ($2::uuid IS NULL OR s.registration_id = $2) \
         ORDER BY s.created_at DESC LIMIT 500",
    )
    .bind(params.camp_id)
    .bind(params.registration_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_screening(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateScreeningRequest>,
) -> Result<Json<CampScreening>, AppError> {
    require_permission(&claims, permissions::camp::screenings::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CampScreening>(
        "INSERT INTO camp_screenings \
         (tenant_id, registration_id, bp_systolic, bp_diastolic, pulse_rate, spo2, \
          temperature, blood_sugar_random, bmi, height_cm, weight_kg, \
          visual_acuity_left, visual_acuity_right, \
          findings, diagnosis, advice, \
          referred_to_hospital, referral_department, referral_urgency, screened_by) \
         VALUES ($1, $2, $3, $4, $5, $6, \
                 $7, $8, $9, $10, $11, \
                 $12, $13, \
                 $14, $15, $16, \
                 COALESCE($17, false), $18, $19, $20) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.registration_id)
    .bind(body.bp_systolic)
    .bind(body.bp_diastolic)
    .bind(body.pulse_rate)
    .bind(body.spo2)
    .bind(body.temperature)
    .bind(body.blood_sugar_random)
    .bind(body.bmi)
    .bind(body.height_cm)
    .bind(body.weight_kg)
    .bind(&body.visual_acuity_left)
    .bind(&body.visual_acuity_right)
    .bind(&body.findings)
    .bind(&body.diagnosis)
    .bind(&body.advice)
    .bind(body.referred_to_hospital)
    .bind(&body.referral_department)
    .bind(&body.referral_urgency)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    // Auto-update registration status to screened
    sqlx::query(
        "UPDATE camp_registrations SET status = 'screened' \
         WHERE id = $1 AND status = 'registered'",
    )
    .bind(body.registration_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Lab Samples
// ══════════════════════════════════════════════════════════

pub async fn list_lab_samples(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListLabSamplesQuery>,
) -> Result<Json<Vec<CampLabSample>>, AppError> {
    require_permission(&claims, permissions::camp::lab::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CampLabSample>(
        "SELECT ls.* FROM camp_lab_samples ls \
         JOIN camp_registrations r ON r.id = ls.registration_id \
         WHERE ($1::uuid IS NULL OR r.camp_id = $1) \
         AND ($2::uuid IS NULL OR ls.registration_id = $2) \
         ORDER BY ls.created_at DESC LIMIT 500",
    )
    .bind(params.camp_id)
    .bind(params.registration_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_lab_sample(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateLabSampleRequest>,
) -> Result<Json<CampLabSample>, AppError> {
    require_permission(&claims, permissions::camp::lab::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CampLabSample>(
        "INSERT INTO camp_lab_samples \
         (tenant_id, registration_id, sample_type, test_requested, barcode, \
          collected_at, collected_by) \
         VALUES ($1, $2, $3, $4, $5, now(), $6) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.registration_id)
    .bind(&body.sample_type)
    .bind(&body.test_requested)
    .bind(&body.barcode)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn link_lab_sample(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<LinkLabSampleRequest>,
) -> Result<Json<CampLabSample>, AppError> {
    require_permission(&claims, permissions::camp::lab::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CampLabSample>(
        "UPDATE camp_lab_samples SET \
         lab_order_id = $2, result_summary = $3, sent_to_lab = true \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(body.lab_order_id)
    .bind(&body.result_summary)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Billing
// ══════════════════════════════════════════════════════════

pub async fn list_billing(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListBillingQuery>,
) -> Result<Json<Vec<CampBillingRecord>>, AppError> {
    require_permission(&claims, permissions::camp::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CampBillingRecord>(
        "SELECT b.* FROM camp_billing_records b \
         JOIN camp_registrations r ON r.id = b.registration_id \
         WHERE ($1::uuid IS NULL OR r.camp_id = $1) \
         AND ($2::uuid IS NULL OR b.registration_id = $2) \
         ORDER BY b.created_at DESC LIMIT 500",
    )
    .bind(params.camp_id)
    .bind(params.registration_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_billing(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateBillingRequest>,
) -> Result<Json<CampBillingRecord>, AppError> {
    require_permission(&claims, permissions::camp::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CampBillingRecord>(
        "INSERT INTO camp_billing_records \
         (tenant_id, registration_id, service_description, standard_amount, \
          discount_percentage, charged_amount, is_free, payment_mode, payment_reference, \
          billed_by) \
         VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, true), $8, $9, $10) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.registration_id)
    .bind(&body.service_description)
    .bind(body.standard_amount)
    .bind(body.discount_percentage)
    .bind(body.charged_amount)
    .bind(body.is_free)
    .bind(&body.payment_mode)
    .bind(&body.payment_reference)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Follow-ups
// ══════════════════════════════════════════════════════════

pub async fn list_followups(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListFollowupsQuery>,
) -> Result<Json<Vec<CampFollowup>>, AppError> {
    require_permission(&claims, permissions::camp::followups::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CampFollowup>(
        "SELECT f.* FROM camp_followups f \
         JOIN camp_registrations r ON r.id = f.registration_id \
         WHERE ($1::uuid IS NULL OR r.camp_id = $1) \
         AND ($2::uuid IS NULL OR f.registration_id = $2) \
         AND ($3::text IS NULL OR f.status::text = $3) \
         ORDER BY f.followup_date DESC LIMIT 500",
    )
    .bind(params.camp_id)
    .bind(params.registration_id)
    .bind(&params.status)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_followup(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateFollowupRequest>,
) -> Result<Json<CampFollowup>, AppError> {
    require_permission(&claims, permissions::camp::followups::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CampFollowup>(
        "INSERT INTO camp_followups \
         (tenant_id, registration_id, followup_date, followup_type, notes, followed_up_by) \
         VALUES ($1, $2, $3, $4, $5, $6) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.registration_id)
    .bind(body.followup_date)
    .bind(&body.followup_type)
    .bind(&body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_followup(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateFollowupRequest>,
) -> Result<Json<CampFollowup>, AppError> {
    require_permission(&claims, permissions::camp::followups::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CampFollowup>(
        "UPDATE camp_followups SET \
         status = COALESCE($2::camp_followup_status, status), \
         notes = COALESCE($3, notes), \
         outcome = COALESCE($4, outcome), \
         converted_to_patient = COALESCE($5, converted_to_patient), \
         converted_patient_id = COALESCE($6, converted_patient_id), \
         converted_department_id = COALESCE($7, converted_department_id) \
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&body.status)
    .bind(&body.notes)
    .bind(&body.outcome)
    .bind(body.converted_to_patient)
    .bind(body.converted_patient_id)
    .bind(body.converted_department_id)
    .fetch_one(&mut *tx)
    .await?;

    // If converted, also update the registration status
    if body.converted_to_patient == Some(true) {
        sqlx::query(
            "UPDATE camp_registrations SET status = 'converted' \
             WHERE id = (SELECT registration_id FROM camp_followups WHERE id = $1)",
        )
        .bind(id)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Handlers — Stats
// ══════════════════════════════════════════════════════════

pub async fn camp_stats(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<CampStatsResponse>, AppError> {
    require_permission(&claims, permissions::camp::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let total = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*)::bigint AS count FROM camp_registrations WHERE camp_id = $1",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;

    let screened = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*)::bigint AS count FROM camp_registrations \
         WHERE camp_id = $1 AND status IN ('screened', 'referred', 'converted')",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;

    let referred = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*)::bigint AS count FROM camp_registrations \
         WHERE camp_id = $1 AND status IN ('referred', 'converted')",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;

    let converted = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*)::bigint AS count FROM camp_registrations \
         WHERE camp_id = $1 AND status = 'converted'",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;

    let lab_samples = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*)::bigint AS count FROM camp_lab_samples ls \
         JOIN camp_registrations r ON r.id = ls.registration_id \
         WHERE r.camp_id = $1",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;

    let fu_scheduled = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*)::bigint AS count FROM camp_followups f \
         JOIN camp_registrations r ON r.id = f.registration_id \
         WHERE r.camp_id = $1",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;

    let fu_completed = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*)::bigint AS count FROM camp_followups f \
         JOIN camp_registrations r ON r.id = f.registration_id \
         WHERE r.camp_id = $1 AND f.status = 'completed'",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;

    let billing_sum = sqlx::query_as::<_, SumRow>(
        "SELECT COALESCE(SUM(b.charged_amount), 0) AS total FROM camp_billing_records b \
         JOIN camp_registrations r ON r.id = b.registration_id \
         WHERE r.camp_id = $1",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(CampStatsResponse {
        total_registrations: total.count.unwrap_or(0),
        screened: screened.count.unwrap_or(0),
        referred: referred.count.unwrap_or(0),
        converted: converted.count.unwrap_or(0),
        lab_samples: lab_samples.count.unwrap_or(0),
        followups_scheduled: fu_scheduled.count.unwrap_or(0),
        followups_completed: fu_completed.count.unwrap_or(0),
        billing_total: billing_sum.total.unwrap_or_default(),
    }))
}

// ══════════════════════════════════════════════════════════
//  GET /api/camp/analytics
// ══════════════════════════════════════════════════════════

#[derive(Debug, Serialize)]
pub struct CampAnalyticsResponse {
    pub total_camps: i64,
    pub total_registrations: i64,
    pub total_screened: i64,
    pub total_referred: i64,
    pub total_converted: i64,
    pub conversion_rate_pct: f64,
    pub screening_yield_pct: f64,
    pub total_billing: Decimal,
    pub avg_cost_per_patient: Decimal,
    pub followup_scheduled: i64,
    pub followup_completed: i64,
    pub followup_compliance_pct: f64,
}

pub async fn camp_analytics(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<CampAnalyticsResponse>, AppError> {
    require_permission(&claims, permissions::camp::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let camps_count = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*)::bigint AS count FROM camps WHERE tenant_id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let regs = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*)::bigint AS count FROM camp_registrations WHERE tenant_id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let screened = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(DISTINCT registration_id)::bigint AS count FROM camp_screenings \
         WHERE tenant_id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let referred = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*)::bigint AS count FROM camp_registrations \
         WHERE tenant_id = $1 AND status = 'referred'",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let converted = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*)::bigint AS count FROM camp_registrations \
         WHERE tenant_id = $1 AND status = 'converted'",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let billing_total = sqlx::query_as::<_, SumRow>(
        "SELECT COALESCE(SUM(charged_amount), 0) AS total FROM camp_billing_records \
         WHERE tenant_id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let fu_scheduled = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*)::bigint AS count FROM camp_followups WHERE tenant_id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let fu_completed = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*)::bigint AS count FROM camp_followups \
         WHERE tenant_id = $1 AND status = 'completed'",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    let total_regs = regs.count.unwrap_or(0);
    let total_scr = screened.count.unwrap_or(0);
    let total_ref = referred.count.unwrap_or(0);
    let total_conv = converted.count.unwrap_or(0);
    let bill = billing_total.total.unwrap_or_default();
    let fu_sched = fu_scheduled.count.unwrap_or(0);
    let fu_comp = fu_completed.count.unwrap_or(0);

    let conversion_rate = if total_regs > 0 {
        (total_conv as f64 / total_regs as f64) * 100.0
    } else {
        0.0
    };
    let screening_yield = if total_scr > 0 {
        (total_ref as f64 / total_scr as f64) * 100.0
    } else {
        0.0
    };
    let avg_cost = if total_regs > 0 {
        bill / Decimal::from(total_regs)
    } else {
        Decimal::ZERO
    };
    let fu_compliance = if fu_sched > 0 {
        (fu_comp as f64 / fu_sched as f64) * 100.0
    } else {
        0.0
    };

    Ok(Json(CampAnalyticsResponse {
        total_camps: camps_count.count.unwrap_or(0),
        total_registrations: total_regs,
        total_screened: total_scr,
        total_referred: total_ref,
        total_converted: total_conv,
        conversion_rate_pct: conversion_rate,
        screening_yield_pct: screening_yield,
        total_billing: bill,
        avg_cost_per_patient: avg_cost,
        followup_scheduled: fu_sched,
        followup_completed: fu_comp,
        followup_compliance_pct: fu_compliance,
    }))
}

// ══════════════════════════════════════════════════════════
//  GET /api/camp/camps/{id}/report
// ══════════════════════════════════════════════════════════

pub async fn camp_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::camp::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let camp = sqlx::query_as::<_, Camp>("SELECT * FROM camps WHERE id = $1 AND tenant_id = $2")
        .bind(id)
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(AppError::NotFound)?;

    let registrations = sqlx::query_as::<_, CampRegistration>(
        "SELECT * FROM camp_registrations WHERE camp_id = $1 AND tenant_id = $2 \
         ORDER BY created_at",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let screenings = sqlx::query_as::<_, CampScreening>(
        "SELECT s.* FROM camp_screenings s \
         JOIN camp_registrations r ON r.id = s.registration_id \
         WHERE r.camp_id = $1 AND s.tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let followups = sqlx::query_as::<_, CampFollowup>(
        "SELECT f.* FROM camp_followups f \
         JOIN camp_registrations r ON r.id = f.registration_id \
         WHERE r.camp_id = $1 AND f.tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let billing_total = sqlx::query_as::<_, SumRow>(
        "SELECT COALESCE(SUM(b.charged_amount), 0) AS total \
         FROM camp_billing_records b \
         JOIN camp_registrations r ON r.id = b.registration_id \
         WHERE r.camp_id = $1",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    let total_regs = registrations.len() as i64;
    let referred_count = registrations
        .iter()
        .filter(|r| {
            matches!(
                r.status,
                medbrains_core::camp::CampRegistrationStatus::Referred
            )
        })
        .count() as i64;
    let converted_count = registrations
        .iter()
        .filter(|r| {
            matches!(
                r.status,
                medbrains_core::camp::CampRegistrationStatus::Converted
            )
        })
        .count() as i64;
    let fu_completed = followups
        .iter()
        .filter(|f| {
            matches!(
                f.status,
                medbrains_core::camp::CampFollowupStatus::Completed
            )
        })
        .count() as i64;

    Ok(Json(serde_json::json!({
        "camp": {
            "id": camp.id,
            "name": camp.name,
            "camp_type": camp.camp_type,
            "scheduled_date": camp.scheduled_date,
            "venue_name": camp.venue_name,
            "status": camp.status,
        },
        "stats": {
            "total_registrations": total_regs,
            "total_screenings": screenings.len(),
            "referred": referred_count,
            "converted": converted_count,
            "followups_total": followups.len(),
            "followups_completed": fu_completed,
            "billing_total": billing_total.total.unwrap_or_default(),
        },
        "generated_at": Utc::now(),
        "generated_by": claims.sub,
    })))
}
