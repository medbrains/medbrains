use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{Datelike, NaiveTime};
use medbrains_core::{
    appointment::{AvailableSlot, DoctorSchedule, DoctorScheduleException},
    permissions,
};
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

use super::{
    CreateExceptionRequest, CreateScheduleRequest, ListExceptionsQuery, ListSchedulesQuery,
    ListSlotsQuery, UpdateScheduleRequest,
};

/// GET /`api/opd/schedules?doctor_id=&department_id`=
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

/// GET /api/opd/schedule-exceptions?doctor_id=
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

    let exception = sqlx::query_as::<_, DoctorScheduleException>(
        "SELECT * FROM doctor_schedule_exceptions \
         WHERE doctor_id = $1 AND exception_date = $2",
    )
    .bind(doctor_id)
    .bind(query.date)
    .fetch_optional(&mut *tx)
    .await?;

    if let Some(ref exc) = exception {
        if !exc.is_available {
            tx.commit().await?;
            return Ok(Json(vec![]));
        }
    }

    let schedule = sqlx::query_as::<_, DoctorSchedule>(
        "SELECT * FROM doctor_schedules \
         WHERE doctor_id = $1 AND day_of_week = $2 AND is_active = true",
    )
    .bind(doctor_id)
    .bind(day_of_week)
    .fetch_optional(&mut *tx)
    .await?;

    let (start, end, duration, max) = match (&exception, &schedule) {
        (Some(exc), _) if exc.is_available => {
            let schedule_start = NaiveTime::from_hms_opt(9, 0, 0).unwrap_or_default();
            let schedule_end = NaiveTime::from_hms_opt(17, 0, 0).unwrap_or_default();
            let dur = schedule
                .as_ref()
                .map_or(15, |entry| entry.slot_duration_mins);
            let max_patients = schedule.as_ref().map_or(20, |entry| entry.max_patients);
            (
                exc.start_time.unwrap_or(schedule_start),
                exc.end_time.unwrap_or(schedule_end),
                dur,
                max_patients,
            )
        }
        (None, Some(schedule_entry)) => (
            schedule_entry.start_time,
            schedule_entry.end_time,
            schedule_entry.slot_duration_mins,
            schedule_entry.max_patients,
        ),
        _ => {
            tx.commit().await?;
            return Ok(Json(vec![]));
        }
    };

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

    let mut slots = Vec::new();
    let mut current = start;
    let duration_secs = i64::from(duration) * 60;
    let midnight = NaiveTime::from_hms_opt(0, 0, 0).unwrap_or_default();

    while current < end {
        let slot_end_secs = current.signed_duration_since(midnight).num_seconds() + duration_secs;
        let slot_end =
            NaiveTime::from_num_seconds_from_midnight_opt(slot_end_secs.min(86_399) as u32, 0)
                .unwrap_or(end);

        if slot_end > end {
            break;
        }

        let booked_count = booked
            .iter()
            .find(|slot| slot.slot_start == current)
            .map_or(0, |slot| slot.count);

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
