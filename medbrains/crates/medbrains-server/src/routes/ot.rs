#![allow(clippy::too_many_lines)]

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{NaiveDate, Utc};
use medbrains_core::ipd::{AnesthesiaComplicationEntry, SurgeonCaseloadEntry};
use medbrains_core::ot::{
    OtAnesthesiaRecord, OtBooking, OtCaseRecord, OtConsumableCategory, OtConsumableUsage,
    OtPostopRecord, OtPreopAssessment, OtRoom, OtSurgeonPreference, OtSurgicalSafetyChecklist,
};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

// ══════════════════════════════════════════════════════════
//  Request / Response types
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateRoomRequest {
    pub name: String,
    pub code: String,
    pub location_id: Option<Uuid>,
    pub specialties: Option<serde_json::Value>,
    pub equipment: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateRoomRequest {
    pub name: Option<String>,
    pub code: Option<String>,
    pub status: Option<String>,
    pub specialties: Option<serde_json::Value>,
    pub equipment: Option<serde_json::Value>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct ListBookingsQuery {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub status: Option<String>,
    pub date: Option<NaiveDate>,
    pub room_id: Option<Uuid>,
    pub surgeon_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct BookingListResponse {
    pub bookings: Vec<OtBooking>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateBookingRequest {
    pub patient_id: Uuid,
    pub admission_id: Option<Uuid>,
    pub ot_room_id: Uuid,
    pub primary_surgeon_id: Uuid,
    pub anesthetist_id: Option<Uuid>,
    pub scheduled_date: NaiveDate,
    pub scheduled_start: chrono::DateTime<Utc>,
    pub scheduled_end: chrono::DateTime<Utc>,
    pub procedure_name: String,
    pub procedure_code: Option<String>,
    pub laterality: Option<String>,
    pub priority: Option<String>,
    pub estimated_duration_min: Option<i32>,
    pub assistant_surgeons: Option<serde_json::Value>,
    pub scrub_nurses: Option<serde_json::Value>,
    pub circulating_nurses: Option<serde_json::Value>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateBookingRequest {
    pub ot_room_id: Option<Uuid>,
    pub anesthetist_id: Option<Uuid>,
    pub scheduled_date: Option<NaiveDate>,
    pub scheduled_start: Option<chrono::DateTime<Utc>>,
    pub scheduled_end: Option<chrono::DateTime<Utc>>,
    pub procedure_name: Option<String>,
    pub laterality: Option<String>,
    pub estimated_duration_min: Option<i32>,
    pub consent_obtained: Option<bool>,
    pub site_marked: Option<bool>,
    pub blood_arranged: Option<bool>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateBookingStatusRequest {
    pub status: String,
    pub reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePreopRequest {
    pub clearance_status: String,
    pub asa_class: Option<String>,
    pub airway_assessment: Option<serde_json::Value>,
    pub cardiac_assessment: Option<serde_json::Value>,
    pub pulmonary_assessment: Option<serde_json::Value>,
    pub lab_results_reviewed: Option<bool>,
    pub imaging_reviewed: Option<bool>,
    pub blood_group_confirmed: Option<bool>,
    pub fasting_status: Option<bool>,
    pub npo_since: Option<chrono::DateTime<Utc>>,
    pub allergies_noted: Option<String>,
    pub current_medications: Option<String>,
    pub conditions: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePreopRequest {
    pub clearance_status: Option<String>,
    pub asa_class: Option<String>,
    pub lab_results_reviewed: Option<bool>,
    pub imaging_reviewed: Option<bool>,
    pub blood_group_confirmed: Option<bool>,
    pub fasting_status: Option<bool>,
    pub npo_since: Option<chrono::DateTime<Utc>>,
    pub conditions: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateChecklistRequest {
    pub phase: String,
    pub items: serde_json::Value,
}

#[derive(Debug, Deserialize)]
pub struct UpdateChecklistRequest {
    pub items: Option<serde_json::Value>,
    pub completed: Option<bool>,
    pub verified_by: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCaseRecordRequest {
    pub patient_in_time: Option<chrono::DateTime<Utc>>,
    pub incision_time: Option<chrono::DateTime<Utc>>,
    pub procedure_performed: String,
    pub findings: Option<String>,
    pub technique: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCaseRecordRequest {
    pub patient_out_time: Option<chrono::DateTime<Utc>>,
    pub closure_time: Option<chrono::DateTime<Utc>>,
    pub findings: Option<String>,
    pub technique: Option<String>,
    pub complications: Option<String>,
    pub blood_loss_ml: Option<i32>,
    pub specimens: Option<serde_json::Value>,
    pub implants: Option<serde_json::Value>,
    pub drains: Option<serde_json::Value>,
    pub instrument_count_correct_before: Option<bool>,
    pub instrument_count_correct_after: Option<bool>,
    pub sponge_count_correct: Option<bool>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAnesthesiaRequest {
    pub anesthesia_type: String,
    pub asa_class: Option<String>,
    pub induction_time: Option<chrono::DateTime<Utc>>,
    pub airway_details: Option<serde_json::Value>,
    pub drugs_administered: Option<serde_json::Value>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAnesthesiaRequest {
    pub intubation_time: Option<chrono::DateTime<Utc>>,
    pub extubation_time: Option<chrono::DateTime<Utc>>,
    pub monitoring_events: Option<serde_json::Value>,
    pub fluids_given: Option<serde_json::Value>,
    pub blood_products: Option<serde_json::Value>,
    pub adverse_events: Option<serde_json::Value>,
    pub complications: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePostopRequest {
    pub destination_bed_id: Option<Uuid>,
    pub recovery_status: String,
    pub arrival_time: Option<chrono::DateTime<Utc>>,
    pub aldrete_score_arrival: Option<i32>,
    pub vitals_on_arrival: Option<serde_json::Value>,
    pub pain_assessment: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePostopRequest {
    pub recovery_status: Option<String>,
    pub discharge_time: Option<chrono::DateTime<Utc>>,
    pub aldrete_score_discharge: Option<i32>,
    pub monitoring_entries: Option<serde_json::Value>,
    pub fluid_orders: Option<String>,
    pub diet_orders: Option<String>,
    pub activity_orders: Option<String>,
    pub disposition: Option<String>,
    pub postop_orders: Option<serde_json::Value>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateSurgeonPreferenceRequest {
    pub surgeon_id: Uuid,
    pub procedure_name: String,
    pub position: Option<String>,
    pub skin_prep: Option<String>,
    pub draping: Option<String>,
    pub instruments: Option<serde_json::Value>,
    pub sutures: Option<serde_json::Value>,
    pub implants: Option<serde_json::Value>,
    pub equipment: Option<serde_json::Value>,
    pub medications: Option<serde_json::Value>,
    pub special_instructions: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSurgeonPreferenceRequest {
    pub position: Option<String>,
    pub skin_prep: Option<String>,
    pub draping: Option<String>,
    pub instruments: Option<serde_json::Value>,
    pub sutures: Option<serde_json::Value>,
    pub implants: Option<serde_json::Value>,
    pub equipment: Option<serde_json::Value>,
    pub medications: Option<serde_json::Value>,
    pub special_instructions: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct ScheduleQuery {
    pub date: Option<NaiveDate>,
    pub room_id: Option<Uuid>,
}

// ══════════════════════════════════════════════════════════
//  Rooms
// ══════════════════════════════════════════════════════════

pub async fn list_rooms(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<OtRoom>>, AppError> {
    require_permission(&claims, permissions::ot::rooms::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, OtRoom>(
        "SELECT * FROM ot_rooms WHERE tenant_id = $1 ORDER BY name ASC",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_room(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateRoomRequest>,
) -> Result<Json<OtRoom>, AppError> {
    require_permission(&claims, permissions::ot::rooms::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, OtRoom>(
        "INSERT INTO ot_rooms \
           (tenant_id, location_id, name, code, status, specialties, equipment, is_active) \
         VALUES ($1, $2, $3, $4, 'available'::ot_room_status, $5, $6, true) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.location_id)
    .bind(&body.name)
    .bind(&body.code)
    .bind(body.specialties.as_ref().unwrap_or(&serde_json::json!([])))
    .bind(body.equipment.as_ref().unwrap_or(&serde_json::json!([])))
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_room(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateRoomRequest>,
) -> Result<Json<OtRoom>, AppError> {
    require_permission(&claims, permissions::ot::rooms::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, OtRoom>(
        "UPDATE ot_rooms SET \
           name = COALESCE($3, name), \
           code = COALESCE($4, code), \
           status = COALESCE($5::ot_room_status, status), \
           specialties = COALESCE($6, specialties), \
           equipment = COALESCE($7, equipment), \
           is_active = COALESCE($8, is_active) \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.name)
    .bind(&body.code)
    .bind(&body.status)
    .bind(&body.specialties)
    .bind(&body.equipment)
    .bind(body.is_active)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Bookings
// ══════════════════════════════════════════════════════════

pub async fn list_bookings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListBookingsQuery>,
) -> Result<Json<BookingListResponse>, AppError> {
    require_permission(&claims, permissions::ot::bookings::LIST)?;

    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * per_page;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let mut conditions = vec!["tenant_id = $1".to_owned()];
    let mut bind_idx: usize = 2;

    #[allow(clippy::items_after_statements, clippy::struct_field_names)]
    struct Bind {
        uuid_val: Option<Uuid>,
        string_val: Option<String>,
        date_val: Option<NaiveDate>,
    }
    let mut binds: Vec<Bind> = Vec::new();

    if let Some(ref status) = params.status {
        conditions.push(format!("status::text = ${bind_idx}"));
        binds.push(Bind {
            uuid_val: None,
            string_val: Some(status.clone()),
            date_val: None,
        });
        bind_idx += 1;
    }
    if let Some(date) = params.date {
        conditions.push(format!("scheduled_date = ${bind_idx}"));
        binds.push(Bind {
            uuid_val: None,
            string_val: None,
            date_val: Some(date),
        });
        bind_idx += 1;
    }
    if let Some(room_id) = params.room_id {
        conditions.push(format!("ot_room_id = ${bind_idx}"));
        binds.push(Bind {
            uuid_val: Some(room_id),
            string_val: None,
            date_val: None,
        });
        bind_idx += 1;
    }
    if let Some(surgeon_id) = params.surgeon_id {
        conditions.push(format!("primary_surgeon_id = ${bind_idx}"));
        binds.push(Bind {
            uuid_val: Some(surgeon_id),
            string_val: None,
            date_val: None,
        });
        bind_idx += 1;
    }

    let where_clause = conditions.join(" AND ");

    let count_sql = format!("SELECT COUNT(*) FROM ot_bookings WHERE {where_clause}");
    let mut count_q = sqlx::query_scalar::<_, i64>(&count_sql).bind(claims.tenant_id);
    for b in &binds {
        if let Some(u) = b.uuid_val {
            count_q = count_q.bind(u);
        }
        if let Some(ref s) = b.string_val {
            count_q = count_q.bind(s.clone());
        }
        if let Some(d) = b.date_val {
            count_q = count_q.bind(d);
        }
    }
    let total = count_q.fetch_one(&mut *tx).await?;

    let data_sql = format!(
        "SELECT * FROM ot_bookings WHERE {where_clause} \
         ORDER BY scheduled_date ASC, scheduled_start ASC \
         LIMIT ${bind_idx} OFFSET ${}",
        bind_idx + 1
    );
    let mut data_q = sqlx::query_as::<_, OtBooking>(&data_sql).bind(claims.tenant_id);
    for b in &binds {
        if let Some(u) = b.uuid_val {
            data_q = data_q.bind(u);
        }
        if let Some(ref s) = b.string_val {
            data_q = data_q.bind(s.clone());
        }
        if let Some(d) = b.date_val {
            data_q = data_q.bind(d);
        }
    }
    let bookings = data_q
        .bind(per_page)
        .bind(offset)
        .fetch_all(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(Json(BookingListResponse {
        bookings,
        total,
        page,
        per_page,
    }))
}

pub async fn get_booking(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<OtBooking>, AppError> {
    require_permission(&claims, permissions::ot::bookings::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, OtBooking>(
        "SELECT * FROM ot_bookings WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn create_booking(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateBookingRequest>,
) -> Result<Json<OtBooking>, AppError> {
    require_permission(&claims, permissions::ot::bookings::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let priority = body.priority.as_deref().unwrap_or("elective");
    let empty = serde_json::json!([]);

    let row = sqlx::query_as::<_, OtBooking>(
        "INSERT INTO ot_bookings \
           (tenant_id, patient_id, admission_id, ot_room_id, primary_surgeon_id, \
            anesthetist_id, scheduled_date, scheduled_start, scheduled_end, \
            procedure_name, procedure_code, laterality, priority, status, \
            consent_obtained, site_marked, blood_arranged, \
            assistant_surgeons, scrub_nurses, circulating_nurses, \
            estimated_duration_min, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, \
                 $13::ot_case_priority, 'requested'::ot_booking_status, \
                 false, false, false, $14, $15, $16, $17, $18) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.admission_id)
    .bind(body.ot_room_id)
    .bind(body.primary_surgeon_id)
    .bind(body.anesthetist_id)
    .bind(body.scheduled_date)
    .bind(body.scheduled_start)
    .bind(body.scheduled_end)
    .bind(&body.procedure_name)
    .bind(&body.procedure_code)
    .bind(&body.laterality)
    .bind(priority)
    .bind(body.assistant_surgeons.as_ref().unwrap_or(&empty))
    .bind(body.scrub_nurses.as_ref().unwrap_or(&empty))
    .bind(body.circulating_nurses.as_ref().unwrap_or(&empty))
    .bind(body.estimated_duration_min)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_booking(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateBookingRequest>,
) -> Result<Json<OtBooking>, AppError> {
    require_permission(&claims, permissions::ot::bookings::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, OtBooking>(
        "UPDATE ot_bookings SET \
           ot_room_id = COALESCE($3, ot_room_id), \
           anesthetist_id = COALESCE($4, anesthetist_id), \
           scheduled_date = COALESCE($5, scheduled_date), \
           scheduled_start = COALESCE($6, scheduled_start), \
           scheduled_end = COALESCE($7, scheduled_end), \
           procedure_name = COALESCE($8, procedure_name), \
           laterality = COALESCE($9, laterality), \
           estimated_duration_min = COALESCE($10, estimated_duration_min), \
           consent_obtained = COALESCE($11, consent_obtained), \
           site_marked = COALESCE($12, site_marked), \
           blood_arranged = COALESCE($13, blood_arranged), \
           notes = COALESCE($14, notes) \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.ot_room_id)
    .bind(body.anesthetist_id)
    .bind(body.scheduled_date)
    .bind(body.scheduled_start)
    .bind(body.scheduled_end)
    .bind(&body.procedure_name)
    .bind(&body.laterality)
    .bind(body.estimated_duration_min)
    .bind(body.consent_obtained)
    .bind(body.site_marked)
    .bind(body.blood_arranged)
    .bind(&body.notes)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_booking_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateBookingStatusRequest>,
) -> Result<Json<OtBooking>, AppError> {
    require_permission(&claims, permissions::ot::bookings::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let (actual_start, actual_end) = match body.status.as_str() {
        "in_progress" => (Some(Utc::now()), None),
        "completed" => (None, Some(Utc::now())),
        _ => (None, None),
    };
    let (cancel_reason, postpone_reason) = match body.status.as_str() {
        "cancelled" => (body.reason.clone(), None),
        "postponed" => (None, body.reason.clone()),
        _ => (None, None),
    };

    let row = sqlx::query_as::<_, OtBooking>(
        "UPDATE ot_bookings SET \
           status = $3::ot_booking_status, \
           actual_start = COALESCE($4, actual_start), \
           actual_end = COALESCE($5, actual_end), \
           cancellation_reason = COALESCE($6, cancellation_reason), \
           postpone_reason = COALESCE($7, postpone_reason) \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.status)
    .bind(actual_start)
    .bind(actual_end)
    .bind(&cancel_reason)
    .bind(&postpone_reason)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    // Auto-bill OT charges on surgery completion
    if body.status == "completed"
        && super::billing::is_auto_billing_enabled(&mut tx, &claims.tenant_id, "ot")
            .await
            .unwrap_or(false)
    {
        let encounter_id = row.admission_id.unwrap_or(row.id);
        let _ = super::billing::create_service_charge(
            &mut tx,
            super::billing::ServiceChargeInput {
                tenant_id: claims.tenant_id,
                patient_id: row.patient_id,
                encounter_id,
                charge_code: "OT_SURGERY",
                quantity: 1,
                source_module: "ot",
                source_entity_id: row.id,
                requested_by: claims.sub,
            },
        )
        .await;
    }

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Pre-Op
// ══════════════════════════════════════════════════════════

pub async fn get_preop(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(booking_id): Path<Uuid>,
) -> Result<Json<Option<OtPreopAssessment>>, AppError> {
    require_permission(&claims, permissions::ot::preop::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, OtPreopAssessment>(
        "SELECT * FROM ot_preop_assessments WHERE booking_id = $1 AND tenant_id = $2",
    )
    .bind(booking_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn create_preop(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(booking_id): Path<Uuid>,
    Json(body): Json<CreatePreopRequest>,
) -> Result<Json<OtPreopAssessment>, AppError> {
    require_permission(&claims, permissions::ot::preop::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let empty = serde_json::json!({});
    let row = sqlx::query_as::<_, OtPreopAssessment>(
        "INSERT INTO ot_preop_assessments \
           (tenant_id, booking_id, clearance_status, asa_class, \
            airway_assessment, cardiac_assessment, pulmonary_assessment, \
            lab_results_reviewed, imaging_reviewed, blood_group_confirmed, \
            fasting_status, npo_since, allergies_noted, current_medications, \
            conditions, assessed_by, assessed_at) \
         VALUES ($1, $2, $3::preop_clearance_status, $4::asa_classification, \
                 $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW()) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(booking_id)
    .bind(&body.clearance_status)
    .bind(&body.asa_class)
    .bind(body.airway_assessment.as_ref().unwrap_or(&empty))
    .bind(body.cardiac_assessment.as_ref().unwrap_or(&empty))
    .bind(body.pulmonary_assessment.as_ref().unwrap_or(&empty))
    .bind(body.lab_results_reviewed.unwrap_or(false))
    .bind(body.imaging_reviewed.unwrap_or(false))
    .bind(body.blood_group_confirmed.unwrap_or(false))
    .bind(body.fasting_status.unwrap_or(false))
    .bind(body.npo_since)
    .bind(&body.allergies_noted)
    .bind(&body.current_medications)
    .bind(&body.conditions)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_preop(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(booking_id): Path<Uuid>,
    Json(body): Json<UpdatePreopRequest>,
) -> Result<Json<OtPreopAssessment>, AppError> {
    require_permission(&claims, permissions::ot::preop::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, OtPreopAssessment>(
        "UPDATE ot_preop_assessments SET \
           clearance_status = COALESCE($3::preop_clearance_status, clearance_status), \
           asa_class = COALESCE($4::asa_classification, asa_class), \
           lab_results_reviewed = COALESCE($5, lab_results_reviewed), \
           imaging_reviewed = COALESCE($6, imaging_reviewed), \
           blood_group_confirmed = COALESCE($7, blood_group_confirmed), \
           fasting_status = COALESCE($8, fasting_status), \
           npo_since = COALESCE($9, npo_since), \
           conditions = COALESCE($10, conditions) \
         WHERE booking_id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(booking_id)
    .bind(claims.tenant_id)
    .bind(&body.clearance_status)
    .bind(&body.asa_class)
    .bind(body.lab_results_reviewed)
    .bind(body.imaging_reviewed)
    .bind(body.blood_group_confirmed)
    .bind(body.fasting_status)
    .bind(body.npo_since)
    .bind(&body.conditions)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Safety Checklists
// ══════════════════════════════════════════════════════════

pub async fn get_checklists(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(booking_id): Path<Uuid>,
) -> Result<Json<Vec<OtSurgicalSafetyChecklist>>, AppError> {
    require_permission(&claims, permissions::ot::safety_checklist::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, OtSurgicalSafetyChecklist>(
        "SELECT * FROM ot_surgical_safety_checklists \
         WHERE booking_id = $1 AND tenant_id = $2 ORDER BY created_at ASC",
    )
    .bind(booking_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_checklist(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(booking_id): Path<Uuid>,
    Json(body): Json<CreateChecklistRequest>,
) -> Result<Json<OtSurgicalSafetyChecklist>, AppError> {
    require_permission(&claims, permissions::ot::safety_checklist::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, OtSurgicalSafetyChecklist>(
        "INSERT INTO ot_surgical_safety_checklists \
           (tenant_id, booking_id, phase, items, completed) \
         VALUES ($1, $2, $3::checklist_phase, $4, false) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(booking_id)
    .bind(&body.phase)
    .bind(&body.items)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_checklist(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((booking_id, checklist_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateChecklistRequest>,
) -> Result<Json<OtSurgicalSafetyChecklist>, AppError> {
    require_permission(&claims, permissions::ot::safety_checklist::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let (completed_by, completed_at) = if body.completed == Some(true) {
        (Some(claims.sub), Some(Utc::now()))
    } else {
        (None, None)
    };

    let row = sqlx::query_as::<_, OtSurgicalSafetyChecklist>(
        "UPDATE ot_surgical_safety_checklists SET \
           items = COALESCE($4, items), \
           completed = COALESCE($5, completed), \
           completed_by = COALESCE($6, completed_by), \
           completed_at = COALESCE($7, completed_at), \
           verified_by = COALESCE($8, verified_by) \
         WHERE id = $1 AND booking_id = $2 AND tenant_id = $3 \
         RETURNING *",
    )
    .bind(checklist_id)
    .bind(booking_id)
    .bind(claims.tenant_id)
    .bind(&body.items)
    .bind(body.completed)
    .bind(completed_by)
    .bind(completed_at)
    .bind(body.verified_by)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Case Records
// ══════════════════════════════════════════════════════════

pub async fn get_case_record(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(booking_id): Path<Uuid>,
) -> Result<Json<Option<OtCaseRecord>>, AppError> {
    require_permission(&claims, permissions::ot::case_records::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, OtCaseRecord>(
        "SELECT * FROM ot_case_records WHERE booking_id = $1 AND tenant_id = $2",
    )
    .bind(booking_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn create_case_record(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(booking_id): Path<Uuid>,
    Json(body): Json<CreateCaseRecordRequest>,
) -> Result<Json<OtCaseRecord>, AppError> {
    require_permission(&claims, permissions::ot::case_records::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let empty = serde_json::json!([]);
    let row = sqlx::query_as::<_, OtCaseRecord>(
        "INSERT INTO ot_case_records \
           (tenant_id, booking_id, surgeon_id, patient_in_time, incision_time, \
            procedure_performed, findings, technique, \
            specimens, implants, drains, cssd_issuance_ids, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(booking_id)
    .bind(claims.sub)
    .bind(body.patient_in_time)
    .bind(body.incision_time)
    .bind(&body.procedure_performed)
    .bind(&body.findings)
    .bind(&body.technique)
    .bind(&empty)
    .bind(&empty)
    .bind(&empty)
    .bind(&empty)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_case_record(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(booking_id): Path<Uuid>,
    Json(body): Json<UpdateCaseRecordRequest>,
) -> Result<Json<OtCaseRecord>, AppError> {
    require_permission(&claims, permissions::ot::case_records::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, OtCaseRecord>(
        "UPDATE ot_case_records SET \
           patient_out_time = COALESCE($3, patient_out_time), \
           closure_time = COALESCE($4, closure_time), \
           findings = COALESCE($5, findings), \
           technique = COALESCE($6, technique), \
           complications = COALESCE($7, complications), \
           blood_loss_ml = COALESCE($8, blood_loss_ml), \
           specimens = COALESCE($9, specimens), \
           implants = COALESCE($10, implants), \
           drains = COALESCE($11, drains), \
           instrument_count_correct_before = COALESCE($12, instrument_count_correct_before), \
           instrument_count_correct_after = COALESCE($13, instrument_count_correct_after), \
           sponge_count_correct = COALESCE($14, sponge_count_correct), \
           notes = COALESCE($15, notes) \
         WHERE booking_id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(booking_id)
    .bind(claims.tenant_id)
    .bind(body.patient_out_time)
    .bind(body.closure_time)
    .bind(&body.findings)
    .bind(&body.technique)
    .bind(&body.complications)
    .bind(body.blood_loss_ml)
    .bind(&body.specimens)
    .bind(&body.implants)
    .bind(&body.drains)
    .bind(body.instrument_count_correct_before)
    .bind(body.instrument_count_correct_after)
    .bind(body.sponge_count_correct)
    .bind(&body.notes)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Anesthesia
// ══════════════════════════════════════════════════════════

pub async fn get_anesthesia(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(booking_id): Path<Uuid>,
) -> Result<Json<Option<OtAnesthesiaRecord>>, AppError> {
    require_permission(&claims, permissions::ot::anesthesia::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, OtAnesthesiaRecord>(
        "SELECT * FROM ot_anesthesia_records WHERE booking_id = $1 AND tenant_id = $2",
    )
    .bind(booking_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn create_anesthesia(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(booking_id): Path<Uuid>,
    Json(body): Json<CreateAnesthesiaRequest>,
) -> Result<Json<OtAnesthesiaRecord>, AppError> {
    require_permission(&claims, permissions::ot::anesthesia::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let empty = serde_json::json!([]);
    let row = sqlx::query_as::<_, OtAnesthesiaRecord>(
        "INSERT INTO ot_anesthesia_records \
           (tenant_id, booking_id, anesthetist_id, anesthesia_type, asa_class, \
            induction_time, airway_details, drugs_administered, \
            monitoring_events, fluids_given, blood_products, adverse_events, notes) \
         VALUES ($1, $2, $3, $4::anesthesia_type, $5::asa_classification, \
                 $6, $7, $8, $9, $10, $11, $12, $13) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(booking_id)
    .bind(claims.sub)
    .bind(&body.anesthesia_type)
    .bind(&body.asa_class)
    .bind(body.induction_time)
    .bind(
        body.airway_details
            .as_ref()
            .unwrap_or(&serde_json::json!({})),
    )
    .bind(body.drugs_administered.as_ref().unwrap_or(&empty))
    .bind(&empty)
    .bind(&empty)
    .bind(&empty)
    .bind(&empty)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_anesthesia(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(booking_id): Path<Uuid>,
    Json(body): Json<UpdateAnesthesiaRequest>,
) -> Result<Json<OtAnesthesiaRecord>, AppError> {
    require_permission(&claims, permissions::ot::anesthesia::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, OtAnesthesiaRecord>(
        "UPDATE ot_anesthesia_records SET \
           intubation_time = COALESCE($3, intubation_time), \
           extubation_time = COALESCE($4, extubation_time), \
           monitoring_events = COALESCE($5, monitoring_events), \
           fluids_given = COALESCE($6, fluids_given), \
           blood_products = COALESCE($7, blood_products), \
           adverse_events = COALESCE($8, adverse_events), \
           complications = COALESCE($9, complications), \
           notes = COALESCE($10, notes) \
         WHERE booking_id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(booking_id)
    .bind(claims.tenant_id)
    .bind(body.intubation_time)
    .bind(body.extubation_time)
    .bind(&body.monitoring_events)
    .bind(&body.fluids_given)
    .bind(&body.blood_products)
    .bind(&body.adverse_events)
    .bind(&body.complications)
    .bind(&body.notes)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Post-Op
// ══════════════════════════════════════════════════════════

pub async fn get_postop(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(booking_id): Path<Uuid>,
) -> Result<Json<Option<OtPostopRecord>>, AppError> {
    require_permission(&claims, permissions::ot::postop::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, OtPostopRecord>(
        "SELECT * FROM ot_postop_records WHERE booking_id = $1 AND tenant_id = $2",
    )
    .bind(booking_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn create_postop(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(booking_id): Path<Uuid>,
    Json(body): Json<CreatePostopRequest>,
) -> Result<Json<OtPostopRecord>, AppError> {
    require_permission(&claims, permissions::ot::postop::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, OtPostopRecord>(
        "INSERT INTO ot_postop_records \
           (tenant_id, booking_id, destination_bed_id, recovery_status, \
            arrival_time, aldrete_score_arrival, vitals_on_arrival, \
            monitoring_entries, postop_orders, pain_assessment) \
         VALUES ($1, $2, $3, $4::postop_recovery_status, $5, $6, $7, '[]', '[]', $8) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(booking_id)
    .bind(body.destination_bed_id)
    .bind(&body.recovery_status)
    .bind(body.arrival_time)
    .bind(body.aldrete_score_arrival)
    .bind(
        body.vitals_on_arrival
            .as_ref()
            .unwrap_or(&serde_json::json!({})),
    )
    .bind(&body.pain_assessment)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_postop(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(booking_id): Path<Uuid>,
    Json(body): Json<UpdatePostopRequest>,
) -> Result<Json<OtPostopRecord>, AppError> {
    require_permission(&claims, permissions::ot::postop::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, OtPostopRecord>(
        "UPDATE ot_postop_records SET \
           recovery_status = COALESCE($3::postop_recovery_status, recovery_status), \
           discharge_time = COALESCE($4, discharge_time), \
           aldrete_score_discharge = COALESCE($5, aldrete_score_discharge), \
           monitoring_entries = COALESCE($6, monitoring_entries), \
           fluid_orders = COALESCE($7, fluid_orders), \
           diet_orders = COALESCE($8, diet_orders), \
           activity_orders = COALESCE($9, activity_orders), \
           disposition = COALESCE($10, disposition), \
           postop_orders = COALESCE($11, postop_orders), \
           notes = COALESCE($12, notes) \
         WHERE booking_id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(booking_id)
    .bind(claims.tenant_id)
    .bind(&body.recovery_status)
    .bind(body.discharge_time)
    .bind(body.aldrete_score_discharge)
    .bind(&body.monitoring_entries)
    .bind(&body.fluid_orders)
    .bind(&body.diet_orders)
    .bind(&body.activity_orders)
    .bind(&body.disposition)
    .bind(&body.postop_orders)
    .bind(&body.notes)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Surgeon Preferences
// ══════════════════════════════════════════════════════════

pub async fn list_surgeon_preferences(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Result<Json<Vec<OtSurgeonPreference>>, AppError> {
    require_permission(&claims, permissions::ot::preferences::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(surgeon_id) = params.get("surgeon_id") {
        let sid: Uuid = surgeon_id
            .parse()
            .map_err(|_| AppError::BadRequest("Invalid surgeon_id".to_owned()))?;
        sqlx::query_as::<_, OtSurgeonPreference>(
            "SELECT * FROM ot_surgeon_preferences \
             WHERE tenant_id = $1 AND surgeon_id = $2 AND is_active = true \
             ORDER BY procedure_name ASC",
        )
        .bind(claims.tenant_id)
        .bind(sid)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, OtSurgeonPreference>(
            "SELECT * FROM ot_surgeon_preferences \
             WHERE tenant_id = $1 AND is_active = true \
             ORDER BY procedure_name ASC",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_surgeon_preference(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateSurgeonPreferenceRequest>,
) -> Result<Json<OtSurgeonPreference>, AppError> {
    require_permission(&claims, permissions::ot::preferences::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let empty = serde_json::json!([]);
    let row = sqlx::query_as::<_, OtSurgeonPreference>(
        "INSERT INTO ot_surgeon_preferences \
           (tenant_id, surgeon_id, procedure_name, position, skin_prep, draping, \
            instruments, sutures, implants, equipment, medications, \
            special_instructions, is_active) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.surgeon_id)
    .bind(&body.procedure_name)
    .bind(&body.position)
    .bind(&body.skin_prep)
    .bind(&body.draping)
    .bind(body.instruments.as_ref().unwrap_or(&empty))
    .bind(body.sutures.as_ref().unwrap_or(&empty))
    .bind(body.implants.as_ref().unwrap_or(&empty))
    .bind(body.equipment.as_ref().unwrap_or(&empty))
    .bind(body.medications.as_ref().unwrap_or(&empty))
    .bind(&body.special_instructions)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_surgeon_preference(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateSurgeonPreferenceRequest>,
) -> Result<Json<OtSurgeonPreference>, AppError> {
    require_permission(&claims, permissions::ot::preferences::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, OtSurgeonPreference>(
        "UPDATE ot_surgeon_preferences SET \
           position = COALESCE($3, position), \
           skin_prep = COALESCE($4, skin_prep), \
           draping = COALESCE($5, draping), \
           instruments = COALESCE($6, instruments), \
           sutures = COALESCE($7, sutures), \
           implants = COALESCE($8, implants), \
           equipment = COALESCE($9, equipment), \
           medications = COALESCE($10, medications), \
           special_instructions = COALESCE($11, special_instructions), \
           is_active = COALESCE($12, is_active) \
         WHERE id = $1 AND tenant_id = $2 \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.position)
    .bind(&body.skin_prep)
    .bind(&body.draping)
    .bind(&body.instruments)
    .bind(&body.sutures)
    .bind(&body.implants)
    .bind(&body.equipment)
    .bind(&body.medications)
    .bind(&body.special_instructions)
    .bind(body.is_active)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn delete_surgeon_preference(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::ot::preferences::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    sqlx::query(
        "UPDATE ot_surgeon_preferences SET is_active = false \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "deleted": true })))
}

// ══════════════════════════════════════════════════════════
//  Schedule
// ══════════════════════════════════════════════════════════

pub async fn get_schedule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ScheduleQuery>,
) -> Result<Json<Vec<OtBooking>>, AppError> {
    require_permission(&claims, permissions::ot::bookings::LIST)?;

    let date = params.date.unwrap_or_else(|| Utc::now().date_naive());

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(room_id) = params.room_id {
        sqlx::query_as::<_, OtBooking>(
            "SELECT * FROM ot_bookings \
             WHERE tenant_id = $1 AND scheduled_date = $2 AND ot_room_id = $3 \
             ORDER BY scheduled_start ASC",
        )
        .bind(claims.tenant_id)
        .bind(date)
        .bind(room_id)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, OtBooking>(
            "SELECT * FROM ot_bookings \
             WHERE tenant_id = $1 AND scheduled_date = $2 \
             ORDER BY scheduled_start ASC",
        )
        .bind(claims.tenant_id)
        .bind(date)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Consumables
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateConsumableRequest {
    pub item_name: String,
    pub category: OtConsumableCategory,
    pub quantity: rust_decimal::Decimal,
    pub unit: Option<String>,
    pub unit_price: Option<rust_decimal::Decimal>,
    pub batch_number: Option<String>,
    pub notes: Option<String>,
}

pub async fn list_consumables(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(booking_id): Path<Uuid>,
) -> Result<Json<Vec<OtConsumableUsage>>, AppError> {
    require_permission(&claims, permissions::ot::consumables::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, OtConsumableUsage>(
        "SELECT * FROM ot_consumable_usage \
         WHERE tenant_id = $1 AND booking_id = $2 \
         ORDER BY created_at ASC",
    )
    .bind(claims.tenant_id)
    .bind(booking_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_consumable(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(booking_id): Path<Uuid>,
    Json(body): Json<CreateConsumableRequest>,
) -> Result<Json<OtConsumableUsage>, AppError> {
    require_permission(&claims, permissions::ot::consumables::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, OtConsumableUsage>(
        "INSERT INTO ot_consumable_usage \
         (tenant_id, booking_id, item_name, category, quantity, unit, \
          unit_price, batch_number, recorded_by, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(booking_id)
    .bind(&body.item_name)
    .bind(body.category)
    .bind(body.quantity)
    .bind(&body.unit)
    .bind(body.unit_price)
    .bind(&body.batch_number)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn delete_consumable(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((booking_id, item_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::ot::consumables::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    sqlx::query(
        "DELETE FROM ot_consumable_usage \
         WHERE id = $1 AND tenant_id = $2 AND booking_id = $3",
    )
    .bind(item_id)
    .bind(claims.tenant_id)
    .bind(booking_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "deleted": true })))
}

// ══════════════════════════════════════════════════════════
//  Analytics
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct UtilizationQuery {
    pub from: Option<NaiveDate>,
    pub to: Option<NaiveDate>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct RoomUtilization {
    pub room_id: Uuid,
    pub room_name: String,
    pub total_bookings: i64,
    pub total_surgery_minutes: Option<i64>,
    pub avg_turnaround_minutes: Option<f64>,
}

pub async fn ot_utilization(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<UtilizationQuery>,
) -> Result<Json<Vec<RoomUtilization>>, AppError> {
    require_permission(&claims, permissions::ot::consumables::MANAGE)?;

    let from = params
        .from
        .unwrap_or_else(|| (Utc::now() - chrono::Duration::days(30)).date_naive());
    let to = params.to.unwrap_or_else(|| Utc::now().date_naive());

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, RoomUtilization>(
        "SELECT r.id AS room_id, r.name AS room_name, \
         COUNT(b.id) AS total_bookings, \
         SUM(EXTRACT(EPOCH FROM (b.actual_end_time - b.actual_start_time)) / 60)::BIGINT \
           AS total_surgery_minutes, \
         AVG(b.turnaround_minutes)::FLOAT8 AS avg_turnaround_minutes \
         FROM ot_rooms r \
         LEFT JOIN ot_bookings b ON b.ot_room_id = r.id \
           AND b.tenant_id = r.tenant_id \
           AND b.scheduled_date BETWEEN $2 AND $3 \
         WHERE r.tenant_id = $1 AND r.is_active = true \
         GROUP BY r.id, r.name \
         ORDER BY r.name",
    )
    .bind(claims.tenant_id)
    .bind(from)
    .bind(to)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Phase 3b — OT Analytics
// ══════════════════════════════════════════════════════════

pub async fn get_surgeon_caseload(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<UtilizationQuery>,
) -> Result<Json<Vec<SurgeonCaseloadEntry>>, AppError> {
    require_permission(&claims, permissions::ot::reports::VIEW)?;

    let from = params
        .from
        .unwrap_or_else(|| (Utc::now() - chrono::Duration::days(90)).date_naive());
    let to = params.to.unwrap_or_else(|| Utc::now().date_naive());

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, SurgeonCaseloadEntry>(
        "SELECT \
           cr.primary_surgeon AS surgeon_id, \
           COALESCE(u.full_name, 'Unknown') AS surgeon_name, \
           COUNT(cr.id)::BIGINT AS total_cases, \
           AVG(cr.actual_duration_minutes)::FLOAT8 AS avg_duration_minutes, \
           COUNT(CASE WHEN ar.complications IS NOT NULL AND ar.complications <> '' THEN 1 END)::BIGINT \
             AS complication_count, \
           COUNT(CASE WHEN b.status = 'cancelled' THEN 1 END)::BIGINT AS cancellation_count \
         FROM ot_case_records cr \
         JOIN ot_bookings b ON b.id = cr.booking_id AND b.tenant_id = cr.tenant_id \
         LEFT JOIN users u ON u.id = cr.primary_surgeon \
         LEFT JOIN ot_anesthesia_records ar ON ar.booking_id = cr.booking_id AND ar.tenant_id = cr.tenant_id \
         WHERE cr.tenant_id = $1 AND b.scheduled_date BETWEEN $2 AND $3 \
         GROUP BY cr.primary_surgeon, u.full_name \
         ORDER BY total_cases DESC",
    )
    .bind(claims.tenant_id)
    .bind(from)
    .bind(to)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn list_anesthesia_complications(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<UtilizationQuery>,
) -> Result<Json<Vec<AnesthesiaComplicationEntry>>, AppError> {
    require_permission(&claims, permissions::ot::reports::VIEW)?;

    let from = params
        .from
        .unwrap_or_else(|| (Utc::now() - chrono::Duration::days(90)).date_naive());
    let to = params.to.unwrap_or_else(|| Utc::now().date_naive());

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, AnesthesiaComplicationEntry>(
        "SELECT \
           cr.id AS case_id, \
           COALESCE(p.first_name || ' ' || p.last_name, 'Unknown') AS patient_name, \
           cr.procedure_name, \
           COALESCE(ar.anesthesia_type, 'unknown') AS anesthesia_type, \
           ar.complications, \
           ar.adverse_events, \
           b.scheduled_date AS case_date \
         FROM ot_anesthesia_records ar \
         JOIN ot_bookings b ON b.id = ar.booking_id AND b.tenant_id = ar.tenant_id \
         JOIN ot_case_records cr ON cr.booking_id = ar.booking_id AND cr.tenant_id = ar.tenant_id \
         JOIN admissions adm ON adm.encounter_id = b.encounter_id AND adm.tenant_id = b.tenant_id \
         JOIN patients p ON p.id = adm.patient_id \
         WHERE ar.tenant_id = $1 \
           AND b.scheduled_date BETWEEN $2 AND $3 \
           AND (ar.complications IS NOT NULL AND ar.complications <> '' \
                OR ar.adverse_events IS NOT NULL AND ar.adverse_events <> 'null'::jsonb) \
         ORDER BY b.scheduled_date DESC",
    )
    .bind(claims.tenant_id)
    .bind(from)
    .bind(to)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}
