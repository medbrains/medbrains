use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{Datelike, Duration, NaiveDate, NaiveTime, Utc};
use medbrains_core::{
    appointment::{Appointment, AppointmentStatus, AppointmentType},
    permissions,
};
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

use super::{
    AppointmentWithPatient, BookAppointmentRequest, CancelRequest, ListAppointmentsQuery,
    RescheduleRequest,
};

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
        .map(|row| AppointmentWithPatient {
            appointment: Appointment {
                id: row.id,
                tenant_id: row.tenant_id,
                patient_id: row.patient_id,
                doctor_id: row.doctor_id,
                department_id: row.department_id,
                appointment_date: row.appointment_date,
                slot_start: row.slot_start,
                slot_end: row.slot_end,
                appointment_type: row.appointment_type,
                status: row.status,
                token_number: row.token_number,
                reason: row.reason,
                cancel_reason: row.cancel_reason,
                notes: row.notes,
                encounter_id: row.encounter_id,
                checked_in_at: row.checked_in_at,
                completed_at: row.completed_at,
                cancelled_at: row.cancelled_at,
                recurrence_pattern: row.recurrence_pattern,
                recurrence_group_id: row.recurrence_group_id,
                recurrence_index: row.recurrence_index,
                appointment_group_id: row.appointment_group_id,
                booking_source: row.booking_source,
                created_by: row.created_by,
                created_at: row.created_at,
                updated_at: row.updated_at,
            },
            patient_name: row.patient_name,
            doctor_name: row.doctor_name,
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
            return Err(AppError::Conflict("This time slot is fully booked".into()));
        }
    }

    let appointment_type = body.appointment_type.unwrap_or(AppointmentType::NewVisit);
    let recurrence_group_id = body.recurrence_pattern.as_ref().map(|_| Uuid::new_v4());
    let count = if body.recurrence_pattern.is_some() {
        body.recurrence_count.unwrap_or(4).clamp(1, 12)
    } else {
        1
    };

    let mut first_row: Option<Appointment> = None;

    for recurrence_index in 0..count {
        let date = build_recurrence_date(&body, recurrence_index);

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
        .bind(appointment_type)
        .bind(body.reason.as_deref())
        .bind(body.notes.as_deref())
        .bind(body.recurrence_pattern.as_deref())
        .bind(recurrence_group_id)
        .bind(recurrence_index)
        .bind(claims.sub)
        .fetch_one(&mut *tx)
        .await?;

        if first_row.is_none() {
            first_row = Some(row);
        }
    }

    tx.commit().await?;
    Ok(Json(first_row.ok_or(AppError::Internal(
        "No appointment created".into(),
    ))?))
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

    let row = sqlx::query_as::<_, Appointment>("SELECT * FROM appointments WHERE id = $1")
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

fn build_recurrence_date(body: &BookAppointmentRequest, recurrence_index: i32) -> NaiveDate {
    if recurrence_index == 0 {
        return body.appointment_date;
    }

    match body.recurrence_pattern.as_deref() {
        Some("weekly") => body.appointment_date + Duration::weeks(i64::from(recurrence_index)),
        Some("biweekly") => {
            body.appointment_date + Duration::weeks(i64::from(recurrence_index) * 2)
        }
        Some("monthly") => {
            let months = recurrence_index as u32;
            let month = body.appointment_date.month0() + months;
            let year = body.appointment_date.year() + (month / 12) as i32;
            let normalized_month = (month % 12) + 1;
            NaiveDate::from_ymd_opt(year, normalized_month, body.appointment_date.day().min(28))
                .unwrap_or(body.appointment_date)
        }
        _ => body.appointment_date,
    }
}
