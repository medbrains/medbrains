//! OPD Appointment routes — doctor schedules, slot availability, booking.

use axum::{Extension, Json, extract::{Path, Query, State}};
use chrono::{Datelike, NaiveDate, NaiveTime, Utc};
use medbrains_core::appointment::{
    Appointment, AppointmentStatus, AppointmentType, AvailableSlot,
    DoctorSchedule, DoctorScheduleException,
};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError,
    middleware::auth::Claims,
    middleware::authorization::require_permission,
    state::AppState,
};

// ══════════════════════════════════════════════════════════
//  Request / Response types
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateScheduleRequest {
    pub doctor_id: Uuid,
    pub department_id: Option<Uuid>,
    pub day_of_week: i32,
    pub start_time: NaiveTime,
    pub end_time: NaiveTime,
    pub slot_duration_mins: Option<i32>,
    pub max_patients: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateScheduleRequest {
    pub start_time: Option<NaiveTime>,
    pub end_time: Option<NaiveTime>,
    pub slot_duration_mins: Option<i32>,
    pub max_patients: Option<i32>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateExceptionRequest {
    pub doctor_id: Uuid,
    pub exception_date: NaiveDate,
    pub is_available: Option<bool>,
    pub start_time: Option<NaiveTime>,
    pub end_time: Option<NaiveTime>,
    pub reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListSlotsQuery {
    pub date: NaiveDate,
}

#[derive(Debug, Deserialize)]
pub struct BookAppointmentRequest {
    pub patient_id: Uuid,
    pub doctor_id: Uuid,
    pub department_id: Uuid,
    pub appointment_date: NaiveDate,
    pub slot_start: NaiveTime,
    pub slot_end: NaiveTime,
    pub appointment_type: Option<AppointmentType>,
    pub reason: Option<String>,
    pub notes: Option<String>,
    pub recurrence_pattern: Option<String>,
    pub recurrence_count: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct RescheduleRequest {
    pub appointment_date: NaiveDate,
    pub slot_start: NaiveTime,
    pub slot_end: NaiveTime,
}

#[derive(Debug, Deserialize)]
pub struct CancelRequest {
    pub cancel_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListAppointmentsQuery {
    pub date: Option<NaiveDate>,
    pub doctor_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub patient_id: Option<Uuid>,
    pub status: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AppointmentWithPatient {
    #[serde(flatten)]
    pub appointment: Appointment,
    pub patient_name: String,
    pub doctor_name: String,
}

// ══════════════════════════════════════════════════════════
//  Doctor Schedules
// ══════════════════════════════════════════════════════════

/// GET /`api/opd/schedules?doctor_id=&department_id`=
#[derive(Debug, Deserialize)]
pub struct ListSchedulesQuery {
    pub doctor_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
}

pub async fn list_schedules(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<ListSchedulesQuery>,
) -> Result<Json<Vec<DoctorSchedule>>, AppError> {
    require_permission(&claims, permissions::opd::schedule::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, DoctorSchedule>(
        "SELECT * FROM doctor_schedules \
         WHERE ($1::uuid IS NULL OR doctor_id = $1) \
         AND ($2::uuid IS NULL OR department_id = $2) \
         ORDER BY doctor_id, day_of_week, start_time",
    )
    .bind(query.doctor_id)
    .bind(query.department_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// POST /api/opd/schedules
pub async fn create_schedule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateScheduleRequest>,
) -> Result<Json<DoctorSchedule>, AppError> {
    require_permission(&claims, permissions::opd::schedule::MANAGE)?;

    if body.day_of_week > 6 {
        return Err(AppError::BadRequest("day_of_week must be 0-6".into()));
    }
    if body.start_time >= body.end_time {
        return Err(AppError::BadRequest(
            "end_time must be after start_time".into(),
        ));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, DoctorSchedule>(
        "INSERT INTO doctor_schedules \
         (tenant_id, doctor_id, department_id, day_of_week, start_time, end_time, \
          slot_duration_mins, max_patients) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.doctor_id)
    .bind(body.department_id)
    .bind(body.day_of_week)
    .bind(body.start_time)
    .bind(body.end_time)
    .bind(body.slot_duration_mins.unwrap_or(15))
    .bind(body.max_patients.unwrap_or(20))
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// PUT /api/opd/schedules/{id}
pub async fn update_schedule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateScheduleRequest>,
) -> Result<Json<DoctorSchedule>, AppError> {
    require_permission(&claims, permissions::opd::schedule::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, DoctorSchedule>(
        "UPDATE doctor_schedules SET \
         start_time = COALESCE($1, start_time), \
         end_time = COALESCE($2, end_time), \
         slot_duration_mins = COALESCE($3, slot_duration_mins), \
         max_patients = COALESCE($4, max_patients), \
         is_active = COALESCE($5, is_active), \
         updated_at = now() \
         WHERE id = $6 \
         RETURNING *",
    )
    .bind(body.start_time)
    .bind(body.end_time)
    .bind(body.slot_duration_mins)
    .bind(body.max_patients)
    .bind(body.is_active)
    .bind(id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

/// DELETE /api/opd/schedules/{id}
pub async fn delete_schedule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::opd::schedule::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let result = sqlx::query("DELETE FROM doctor_schedules WHERE id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "status": "ok" })))
}

// ══════════════════════════════════════════════════════════
//  Schedule Exceptions
// ══════════════════════════════════════════════════════════

/// GET /api/opd/schedule-exceptions?doctor_id=
#[derive(Debug, Deserialize)]
pub struct ListExceptionsQuery {
    pub doctor_id: Uuid,
    pub from: Option<NaiveDate>,
    pub to: Option<NaiveDate>,
}

pub async fn list_exceptions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<ListExceptionsQuery>,
) -> Result<Json<Vec<DoctorScheduleException>>, AppError> {
    require_permission(&claims, permissions::opd::schedule::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, DoctorScheduleException>(
        "SELECT * FROM doctor_schedule_exceptions \
         WHERE doctor_id = $1 \
         AND ($2::date IS NULL OR exception_date >= $2) \
         AND ($3::date IS NULL OR exception_date <= $3) \
         ORDER BY exception_date",
    )
    .bind(query.doctor_id)
    .bind(query.from)
    .bind(query.to)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// POST /api/opd/schedule-exceptions
pub async fn create_exception(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateExceptionRequest>,
) -> Result<Json<DoctorScheduleException>, AppError> {
    require_permission(&claims, permissions::opd::schedule::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, DoctorScheduleException>(
        "INSERT INTO doctor_schedule_exceptions \
         (tenant_id, doctor_id, exception_date, is_available, start_time, end_time, reason) \
         VALUES ($1, $2, $3, $4, $5, $6, $7) \
         ON CONFLICT (tenant_id, doctor_id, exception_date) \
         DO UPDATE SET is_available = EXCLUDED.is_available, \
                       start_time = EXCLUDED.start_time, \
                       end_time = EXCLUDED.end_time, \
                       reason = EXCLUDED.reason \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.doctor_id)
    .bind(body.exception_date)
    .bind(body.is_available.unwrap_or(false))
    .bind(body.start_time)
    .bind(body.end_time)
    .bind(body.reason.as_deref())
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// DELETE /api/opd/schedule-exceptions/{id}
pub async fn delete_exception(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::opd::schedule::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let result = sqlx::query("DELETE FROM doctor_schedule_exceptions WHERE id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "status": "ok" })))
}

// ══════════════════════════════════════════════════════════
//  Available Slots
// ══════════════════════════════════════════════════════════

/// GET /`api/opd/doctors/{doctor_id}/slots?date`=
///
/// Computes available slots for a doctor on a given date by:
/// 1. Checking schedule exceptions (holiday → no slots)
/// 2. Looking up the weekly schedule for that day of week
/// 3. Generating time slots from schedule
/// 4. Counting existing appointments per slot
pub async fn get_available_slots(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(doctor_id): Path<Uuid>,
    Query(query): Query<ListSlotsQuery>,
) -> Result<Json<Vec<AvailableSlot>>, AppError> {
    require_permission(&claims, permissions::opd::appointment::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let day_of_week = query.date.weekday().num_days_from_sunday() as i32;

    // Check for exception on this date
    let exception = sqlx::query_as::<_, DoctorScheduleException>(
        "SELECT * FROM doctor_schedule_exceptions \
         WHERE doctor_id = $1 AND exception_date = $2",
    )
    .bind(doctor_id)
    .bind(query.date)
    .fetch_optional(&mut *tx)
    .await?;

    // If exception says unavailable, return empty
    if let Some(ref exc) = exception {
        if !exc.is_available {
            tx.commit().await?;
            return Ok(Json(vec![]));
        }
    }

    // Get schedule for this day of week
    let schedule = sqlx::query_as::<_, DoctorSchedule>(
        "SELECT * FROM doctor_schedules \
         WHERE doctor_id = $1 AND day_of_week = $2 AND is_active = true",
    )
    .bind(doctor_id)
    .bind(day_of_week)
    .fetch_optional(&mut *tx)
    .await?;

    let (start, end, duration, max) = match (&exception, &schedule) {
        // Exception overrides schedule times
        (Some(exc), _) if exc.is_available => {
            let s = exc.start_time.unwrap_or(NaiveTime::from_hms_opt(9, 0, 0).unwrap_or_default());
            let e = exc.end_time.unwrap_or(NaiveTime::from_hms_opt(17, 0, 0).unwrap_or_default());
            let dur = schedule.as_ref().map_or(15, |sc| sc.slot_duration_mins);
            let m = schedule.as_ref().map_or(20, |sc| sc.max_patients);
            (s, e, dur, m)
        }
        // Normal schedule
        (None, Some(sc)) => (sc.start_time, sc.end_time, sc.slot_duration_mins, sc.max_patients),
        // No schedule for this day
        _ => {
            tx.commit().await?;
            return Ok(Json(vec![]));
        }
    };

    // Count bookings per slot time
    #[derive(sqlx::FromRow)]
    struct SlotCount {
        slot_start: NaiveTime,
        count: i64,
    }

    let booked: Vec<SlotCount> = sqlx::query_as::<_, SlotCount>(
        "SELECT slot_start, COUNT(*) as count FROM appointments \
         WHERE doctor_id = $1 AND appointment_date = $2 \
         AND status NOT IN ('cancelled', 'no_show') \
         GROUP BY slot_start",
    )
    .bind(doctor_id)
    .bind(query.date)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    // Generate slots
    let mut slots = Vec::new();
    let mut current = start;
    let duration_secs = i64::from(duration) * 60;

    while current < end {
        let slot_end_secs = current.signed_duration_since(NaiveTime::from_hms_opt(0, 0, 0).unwrap_or_default()).num_seconds() + duration_secs;
        let slot_end = NaiveTime::from_num_seconds_from_midnight_opt(
            slot_end_secs.min(86399) as u32,
            0,
        )
        .unwrap_or(end);

        if slot_end > end {
            break;
        }

        let booked_count = booked
            .iter()
            .find(|b| b.slot_start == current)
            .map_or(0, |b| b.count);

        slots.push(AvailableSlot {
            start_time: current,
            end_time: slot_end,
            booked_count,
            max_patients: max,
            is_available: booked_count < i64::from(max),
        });

        current = slot_end;
    }

    Ok(Json(slots))
}

// ══════════════════════════════════════════════════════════
//  Appointments
// ══════════════════════════════════════════════════════════

/// GET /`api/opd/appointments?date=&doctor_id=&department_id=&patient_id=&status`=
pub async fn list_appointments(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<ListAppointmentsQuery>,
) -> Result<Json<Vec<AppointmentWithPatient>>, AppError> {
    require_permission(&claims, permissions::opd::appointment::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    #[derive(sqlx::FromRow)]
    struct AppointmentRow {
        // Appointment fields
        id: Uuid,
        tenant_id: Uuid,
        patient_id: Uuid,
        doctor_id: Uuid,
        department_id: Uuid,
        appointment_date: NaiveDate,
        slot_start: NaiveTime,
        slot_end: NaiveTime,
        appointment_type: AppointmentType,
        status: AppointmentStatus,
        token_number: Option<i32>,
        reason: Option<String>,
        cancel_reason: Option<String>,
        notes: Option<String>,
        encounter_id: Option<Uuid>,
        checked_in_at: Option<chrono::DateTime<Utc>>,
        completed_at: Option<chrono::DateTime<Utc>>,
        cancelled_at: Option<chrono::DateTime<Utc>>,
        recurrence_pattern: Option<String>,
        recurrence_group_id: Option<Uuid>,
        recurrence_index: Option<i32>,
        appointment_group_id: Option<Uuid>,
        booking_source: Option<String>,
        created_by: Uuid,
        created_at: chrono::DateTime<Utc>,
        updated_at: chrono::DateTime<Utc>,
        // Joined fields
        patient_name: String,
        doctor_name: String,
    }

    let rows = sqlx::query_as::<_, AppointmentRow>(
        "SELECT a.*, \
         CONCAT(p.first_name, ' ', p.last_name) AS patient_name, \
         u.full_name AS doctor_name \
         FROM appointments a \
         JOIN patients p ON p.id = a.patient_id \
         JOIN users u ON u.id = a.doctor_id \
         WHERE ($1::date IS NULL OR a.appointment_date = $1) \
         AND ($2::uuid IS NULL OR a.doctor_id = $2) \
         AND ($3::uuid IS NULL OR a.department_id = $3) \
         AND ($4::uuid IS NULL OR a.patient_id = $4) \
         AND ($5::text IS NULL OR a.status::text = $5) \
         ORDER BY a.appointment_date, a.slot_start",
    )
    .bind(query.date)
    .bind(query.doctor_id)
    .bind(query.department_id)
    .bind(query.patient_id)
    .bind(query.status.as_deref())
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    let result = rows
        .into_iter()
        .map(|r| AppointmentWithPatient {
            appointment: Appointment {
                id: r.id,
                tenant_id: r.tenant_id,
                patient_id: r.patient_id,
                doctor_id: r.doctor_id,
                department_id: r.department_id,
                appointment_date: r.appointment_date,
                slot_start: r.slot_start,
                slot_end: r.slot_end,
                appointment_type: r.appointment_type,
                status: r.status,
                token_number: r.token_number,
                reason: r.reason,
                cancel_reason: r.cancel_reason,
                notes: r.notes,
                encounter_id: r.encounter_id,
                checked_in_at: r.checked_in_at,
                completed_at: r.completed_at,
                cancelled_at: r.cancelled_at,
                recurrence_pattern: r.recurrence_pattern,
                recurrence_group_id: r.recurrence_group_id,
                recurrence_index: r.recurrence_index,
                appointment_group_id: r.appointment_group_id,
                booking_source: r.booking_source,
                created_by: r.created_by,
                created_at: r.created_at,
                updated_at: r.updated_at,
            },
            patient_name: r.patient_name,
            doctor_name: r.doctor_name,
        })
        .collect();

    Ok(Json(result))
}

/// POST /api/opd/appointments
pub async fn book_appointment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<BookAppointmentRequest>,
) -> Result<Json<Appointment>, AppError> {
    require_permission(&claims, permissions::opd::appointment::CREATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Validate slot is not over-booked
    let booked: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM appointments \
         WHERE doctor_id = $1 AND appointment_date = $2 AND slot_start = $3 \
         AND status NOT IN ('cancelled', 'no_show')",
    )
    .bind(body.doctor_id)
    .bind(body.appointment_date)
    .bind(body.slot_start)
    .fetch_one(&mut *tx)
    .await?;

    // Check max patients for this slot (from schedule)
    let day_of_week = body.appointment_date.weekday().num_days_from_sunday() as i32;
    let max_patients: Option<i32> = sqlx::query_scalar(
        "SELECT max_patients FROM doctor_schedules \
         WHERE doctor_id = $1 AND day_of_week = $2 AND is_active = true",
    )
    .bind(body.doctor_id)
    .bind(day_of_week)
    .fetch_optional(&mut *tx)
    .await?;

    if let Some(max) = max_patients {
        if booked >= i64::from(max) {
            return Err(AppError::Conflict(
                "This time slot is fully booked".into(),
            ));
        }
    }

    let appt_type = body.appointment_type.unwrap_or(AppointmentType::NewVisit);

    let group_id = if body.recurrence_pattern.is_some() {
        Some(Uuid::new_v4())
    } else {
        None
    };

    // Determine how many appointments to create
    let count = if body.recurrence_pattern.is_some() {
        body.recurrence_count.unwrap_or(4).clamp(1, 12)
    } else {
        1
    };

    let mut first_row: Option<Appointment> = None;

    for i in 0..count {
        let date = if i == 0 {
            body.appointment_date
        } else {
            match body.recurrence_pattern.as_deref() {
                Some("weekly") => body.appointment_date + chrono::Duration::weeks(i64::from(i)),
                Some("biweekly") => body.appointment_date + chrono::Duration::weeks(i64::from(i) * 2),
                Some("monthly") => {
                    let months = i as u32;
                    let month = body.appointment_date.month0() + months;
                    let year = body.appointment_date.year() + (month / 12) as i32;
                    let m = (month % 12) + 1;
                    NaiveDate::from_ymd_opt(year, m, body.appointment_date.day().min(28))
                        .unwrap_or(body.appointment_date)
                }
                _ => body.appointment_date,
            }
        };

        let row = sqlx::query_as::<_, Appointment>(
            "INSERT INTO appointments \
             (tenant_id, patient_id, doctor_id, department_id, \
              appointment_date, slot_start, slot_end, appointment_type, \
              reason, notes, recurrence_pattern, recurrence_group_id, \
              recurrence_index, created_by) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) \
             RETURNING *",
        )
        .bind(claims.tenant_id)
        .bind(body.patient_id)
        .bind(body.doctor_id)
        .bind(body.department_id)
        .bind(date)
        .bind(body.slot_start)
        .bind(body.slot_end)
        .bind(appt_type)
        .bind(body.reason.as_deref())
        .bind(body.notes.as_deref())
        .bind(body.recurrence_pattern.as_deref())
        .bind(group_id)
        .bind(i)
        .bind(claims.sub)
        .fetch_one(&mut *tx)
        .await?;

        if first_row.is_none() {
            first_row = Some(row);
        }
    }

    tx.commit().await?;
    Ok(Json(first_row.ok_or(AppError::Internal("No appointment created".into()))?))
}

/// GET /api/opd/appointments/{id}
pub async fn get_appointment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Appointment>, AppError> {
    require_permission(&claims, permissions::opd::appointment::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, Appointment>(
        "SELECT * FROM appointments WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

/// PUT /api/opd/appointments/{id}/reschedule
pub async fn reschedule_appointment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<RescheduleRequest>,
) -> Result<Json<Appointment>, AppError> {
    require_permission(&claims, permissions::opd::appointment::UPDATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, Appointment>(
        "UPDATE appointments SET \
         appointment_date = $1, slot_start = $2, slot_end = $3, \
         status = 'scheduled', updated_at = now() \
         WHERE id = $4 AND status IN ('scheduled', 'confirmed') \
         RETURNING *",
    )
    .bind(body.appointment_date)
    .bind(body.slot_start)
    .bind(body.slot_end)
    .bind(id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

/// PUT /api/opd/appointments/{id}/cancel
pub async fn cancel_appointment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CancelRequest>,
) -> Result<Json<Appointment>, AppError> {
    require_permission(&claims, permissions::opd::appointment::CANCEL)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, Appointment>(
        "UPDATE appointments SET \
         status = 'cancelled', cancel_reason = $1, \
         cancelled_at = now(), updated_at = now() \
         WHERE id = $2 AND status NOT IN ('completed', 'cancelled') \
         RETURNING *",
    )
    .bind(body.cancel_reason.as_deref())
    .bind(id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

/// PUT /api/opd/appointments/{id}/check-in
pub async fn check_in_appointment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Appointment>, AppError> {
    require_permission(&claims, permissions::opd::appointment::UPDATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Generate token number for today
    let token: i64 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(token_number), 0) + 1 FROM appointments \
         WHERE appointment_date = CURRENT_DATE AND token_number IS NOT NULL",
    )
    .fetch_one(&mut *tx)
    .await?;

    let row = sqlx::query_as::<_, Appointment>(
        "UPDATE appointments SET \
         status = 'checked_in', token_number = $1, \
         checked_in_at = now(), updated_at = now() \
         WHERE id = $2 AND status IN ('scheduled', 'confirmed') \
         RETURNING *",
    )
    .bind(token as i32)
    .bind(id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

/// PUT /api/opd/appointments/{id}/complete
pub async fn complete_appointment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Appointment>, AppError> {
    require_permission(&claims, permissions::opd::appointment::UPDATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, Appointment>(
        "UPDATE appointments SET \
         status = 'completed', completed_at = now(), updated_at = now() \
         WHERE id = $1 AND status IN ('checked_in', 'in_consultation') \
         RETURNING *",
    )
    .bind(id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

/// PUT /api/opd/appointments/{id}/no-show
pub async fn mark_appointment_no_show(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Appointment>, AppError> {
    require_permission(&claims, permissions::opd::appointment::UPDATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, Appointment>(
        "UPDATE appointments SET \
         status = 'no_show', updated_at = now() \
         WHERE id = $1 AND status IN ('scheduled', 'confirmed') \
         RETURNING *",
    )
    .bind(id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

// ══════════════════════════════════════════════════════════
//  Public Booking + Kiosk Check-in + Reminders
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct PublicBookingRequest {
    pub tenant_code: String,
    pub doctor_id: Uuid,
    pub department_id: Uuid,
    pub appointment_date: NaiveDate,
    pub slot_start: NaiveTime,
    pub slot_end: NaiveTime,
    pub patient_name: String,
    pub patient_phone: String,
    pub patient_dob: Option<NaiveDate>,
    pub reason: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PublicBookingResponse {
    pub appointment_id: Uuid,
    pub appointment_date: NaiveDate,
    pub slot_start: NaiveTime,
    pub doctor_name: String,
    pub department_name: String,
    pub qr_code_data: String,
    pub status: String,
    pub message: String,
}

/// POST /api/public/appointments/book
pub async fn public_book_appointment(
    State(state): State<AppState>,
    Json(body): Json<PublicBookingRequest>,
) -> Result<Json<PublicBookingResponse>, AppError> {
    let tenant_id: Uuid = sqlx::query_scalar("SELECT id FROM tenants WHERE code = $1 AND is_active = true")
        .bind(&body.tenant_code).fetch_optional(&state.db).await?
        .ok_or_else(|| AppError::BadRequest("Invalid hospital code".into()))?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;

    let patient_id: Uuid = match sqlx::query_scalar::<_, Uuid>("SELECT id FROM patients WHERE phone_primary = $1 LIMIT 1")
        .bind(&body.patient_phone).fetch_optional(&mut *tx).await? {
        Some(id) => id,
        None => sqlx::query_scalar::<_, Uuid>(
            "INSERT INTO patients (tenant_id, first_name, phone_primary, date_of_birth) VALUES ($1,$2,$3,$4) RETURNING id")
            .bind(tenant_id).bind(&body.patient_name).bind(&body.patient_phone).bind(body.patient_dob)
            .fetch_one(&mut *tx).await?,
    };

    let booked: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM appointments WHERE doctor_id=$1 AND appointment_date=$2 AND slot_start=$3 AND status NOT IN ('cancelled','no_show')")
        .bind(body.doctor_id).bind(body.appointment_date).bind(body.slot_start).fetch_one(&mut *tx).await?;
    let day_of_week = body.appointment_date.weekday().num_days_from_sunday() as i32;
    let max_patients: Option<i32> = sqlx::query_scalar("SELECT max_patients FROM doctor_schedules WHERE doctor_id=$1 AND day_of_week=$2 AND is_active=true")
        .bind(body.doctor_id).bind(day_of_week).fetch_optional(&mut *tx).await?;
    if let Some(max) = max_patients { if booked >= i64::from(max) { return Err(AppError::Conflict("Slot fully booked".into())); } }

    let appt = sqlx::query_as::<_, Appointment>(
        "INSERT INTO appointments (tenant_id,patient_id,doctor_id,department_id,appointment_date,slot_start,slot_end,appointment_type,reason,status,booking_source) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,'new_visit',$8,'confirmed','online') RETURNING *")
        .bind(tenant_id).bind(patient_id).bind(body.doctor_id).bind(body.department_id)
        .bind(body.appointment_date).bind(body.slot_start).bind(body.slot_end).bind(&body.reason)
        .fetch_one(&mut *tx).await?;

    let doctor_name: String = sqlx::query_scalar("SELECT full_name FROM users WHERE id=$1").bind(body.doctor_id).fetch_optional(&mut *tx).await?.unwrap_or_else(|| "Doctor".to_owned());
    let dept_name: String = sqlx::query_scalar("SELECT name FROM departments WHERE id=$1").bind(body.department_id).fetch_optional(&mut *tx).await?.unwrap_or_else(|| "Dept".to_owned());
    let qr_data = format!("MEDBRAINS:APT:{}", appt.id);
    tx.commit().await?;

    Ok(Json(PublicBookingResponse { appointment_id: appt.id, appointment_date: appt.appointment_date, slot_start: appt.slot_start, doctor_name, department_name: dept_name, qr_code_data: qr_data, status: "confirmed".to_owned(), message: "Appointment booked. Show QR code at kiosk on arrival.".to_owned() }))
}

/// GET /api/public/appointments/slots
#[derive(Debug, Deserialize)]
pub struct PublicSlotsQuery { pub tenant_code: String, pub doctor_id: Uuid, pub date: NaiveDate }

pub async fn public_available_slots(State(state): State<AppState>, Query(params): Query<PublicSlotsQuery>) -> Result<Json<Vec<AvailableSlot>>, AppError> {
    let tenant_id: Uuid = sqlx::query_scalar("SELECT id FROM tenants WHERE code=$1 AND is_active=true")
        .bind(&params.tenant_code).fetch_optional(&state.db).await?.ok_or_else(|| AppError::BadRequest("Invalid code".into()))?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    let day_of_week = params.date.weekday().num_days_from_sunday() as i32;
    let schedules = sqlx::query_as::<_, DoctorSchedule>("SELECT * FROM doctor_schedules WHERE doctor_id=$1 AND day_of_week=$2 AND is_active=true")
        .bind(params.doctor_id).bind(day_of_week).fetch_all(&mut *tx).await?;
    let mut slots = Vec::new();
    for sched in &schedules {
        let dur = sched.slot_duration_mins;
        let mut cur = sched.start_time;
        while cur < sched.end_time {
            let end = cur + chrono::Duration::minutes(i64::from(dur));
            if end > sched.end_time { break; }
            let booked: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM appointments WHERE doctor_id=$1 AND appointment_date=$2 AND slot_start=$3 AND status NOT IN ('cancelled','no_show')")
                .bind(params.doctor_id).bind(params.date).bind(cur).fetch_one(&mut *tx).await?;
            let max = i64::from(sched.max_patients);
            if booked < max { slots.push(AvailableSlot { start_time: cur, end_time: end, booked_count: booked, max_patients: sched.max_patients, is_available: true }); }
            cur = end;
        }
    }
    tx.commit().await?;
    Ok(Json(slots))
}

/// POST /api/public/kiosk/checkin — QR scan → check in → generate token → broadcast to TV
#[derive(Debug, Deserialize)]
pub struct KioskCheckinRequest { pub qr_data: String }

#[derive(Debug, Serialize)]
pub struct KioskCheckinResponse { pub appointment_id: Uuid, pub patient_name: String, pub doctor_name: String, pub department_name: String, pub token_number: String, pub status: String, pub message: String }

pub async fn kiosk_checkin(State(state): State<AppState>, Json(body): Json<KioskCheckinRequest>) -> Result<Json<KioskCheckinResponse>, AppError> {
    let appt_id = body.qr_data.strip_prefix("MEDBRAINS:APT:").and_then(|s| Uuid::parse_str(s).ok())
        .ok_or_else(|| AppError::BadRequest("Invalid QR code".into()))?;
    let appt = sqlx::query_as::<_, Appointment>("SELECT * FROM appointments WHERE id=$1").bind(appt_id).fetch_optional(&state.db).await?.ok_or(AppError::NotFound)?;
    let today = Utc::now().date_naive();
    if appt.appointment_date != today { return Err(AppError::BadRequest(format!("Appointment is for {}", appt.appointment_date))); }
    if appt.status != AppointmentStatus::Scheduled && appt.status != AppointmentStatus::Confirmed { return Err(AppError::Conflict("Already checked in".into())); }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &appt.tenant_id).await?;
    sqlx::query("UPDATE appointments SET status='checked_in', checked_in_at=now() WHERE id=$1").bind(appt_id).execute(&mut *tx).await?;

    let token_seq: i32 = sqlx::query_scalar("SELECT COALESCE(MAX(token_seq),0)+1 FROM queue_tokens WHERE department_id=$1 AND token_date=CURRENT_DATE")
        .bind(appt.department_id).fetch_one(&mut *tx).await?;
    let token_number = format!("T-{token_seq:03}");
    sqlx::query("INSERT INTO queue_tokens (tenant_id,department_id,patient_id,token_date,token_seq,token_number,status) VALUES ($1,$2,$3,CURRENT_DATE,$4,$5,'waiting')")
        .bind(appt.tenant_id).bind(appt.department_id).bind(appt.patient_id).bind(token_seq).bind(&token_number).execute(&mut *tx).await?;

    let patient_name: String = sqlx::query_scalar("SELECT COALESCE(first_name||' '||last_name,first_name) FROM patients WHERE id=$1").bind(appt.patient_id).fetch_optional(&mut *tx).await?.unwrap_or_else(|| "Patient".to_owned());
    let doctor_name: String = sqlx::query_scalar("SELECT full_name FROM users WHERE id=$1").bind(appt.doctor_id).fetch_optional(&mut *tx).await?.unwrap_or_else(|| "Doctor".to_owned());
    let dept_name: String = sqlx::query_scalar("SELECT name FROM departments WHERE id=$1").bind(appt.department_id).fetch_optional(&mut *tx).await?.unwrap_or_else(|| "Dept".to_owned());

    state.queue_broadcaster.broadcast_token_called(appt.department_id, &token_number, &patient_name).await;
    tx.commit().await?;

    Ok(Json(KioskCheckinResponse { appointment_id: appt_id, patient_name, doctor_name, department_name: dept_name, token_number, status: "checked_in".to_owned(), message: "Check-in successful. Wait for your token.".to_owned() }))
}

/// GET /api/opd/appointments/reminder-config
#[derive(Debug, Serialize, Deserialize)]
pub struct ReminderConfig { pub sms_enabled: bool, pub whatsapp_enabled: bool, pub email_enabled: bool, pub remind_hours_before: Vec<i32>, pub sms_template: String, pub whatsapp_template: String }

pub async fn get_reminder_config(State(state): State<AppState>, Extension(claims): Extension<Claims>) -> Result<Json<ReminderConfig>, AppError> {
    require_permission(&claims, permissions::opd::appointment::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let config: Option<serde_json::Value> = sqlx::query_scalar("SELECT value FROM tenant_settings WHERE tenant_id=$1 AND category='appointments' AND key='reminder_config'")
        .bind(claims.tenant_id).fetch_optional(&mut *tx).await?;
    tx.commit().await?;
    let cfg = config.and_then(|v| serde_json::from_value(v).ok()).unwrap_or(ReminderConfig {
        sms_enabled: false, whatsapp_enabled: false, email_enabled: false, remind_hours_before: vec![24, 2],
        sms_template: "Reminder: Appointment with Dr. {doctor} on {date} at {time}.".to_owned(),
        whatsapp_template: "Appointment confirmed for {date} at {time} with Dr. {doctor}. Show QR at kiosk.".to_owned(),
    });
    Ok(Json(cfg))
}

/// PUT /api/opd/appointments/reminder-config
pub async fn update_reminder_config(State(state): State<AppState>, Extension(claims): Extension<Claims>, Json(body): Json<ReminderConfig>) -> Result<Json<ReminderConfig>, AppError> {
    require_permission(&claims, permissions::opd::appointment::UPDATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let value = serde_json::to_value(&body).map_err(|e| AppError::Internal(e.to_string()))?;
    sqlx::query("INSERT INTO tenant_settings (id,tenant_id,category,key,value) VALUES (gen_random_uuid(),$1,'appointments','reminder_config',$2) ON CONFLICT (tenant_id,category,key) DO UPDATE SET value=$2,updated_at=now()")
        .bind(claims.tenant_id).bind(&value).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(body))
}
