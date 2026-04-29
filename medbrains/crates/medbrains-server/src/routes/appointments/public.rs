use axum::{
    Json,
    extract::{Query, State},
};
use chrono::{Datelike, Duration, Utc};
use medbrains_core::appointment::{Appointment, AppointmentStatus, AvailableSlot, DoctorSchedule};
use uuid::Uuid;

use crate::{error::AppError, state::AppState};

use super::{
    KioskCheckinRequest, KioskCheckinResponse, PublicBookingRequest, PublicBookingResponse,
    PublicSlotsQuery,
};

/// POST /api/public/appointments/book
pub async fn public_book_appointment(
    State(state): State<AppState>,
    Json(body): Json<PublicBookingRequest>,
) -> Result<Json<PublicBookingResponse>, AppError> {
    let tenant_id: Uuid =
        sqlx::query_scalar("SELECT id FROM tenants WHERE code = $1 AND is_active = true")
            .bind(&body.tenant_code)
            .fetch_optional(&state.db)
            .await?
            .ok_or_else(|| AppError::BadRequest("Invalid hospital code".into()))?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;

    let patient_id = find_or_create_patient(&body, tenant_id, &mut tx).await?;
    ensure_public_slot_capacity(&body, &mut tx).await?;

    let appointment = sqlx::query_as::<_, Appointment>(
        "INSERT INTO appointments \
         (tenant_id, patient_id, doctor_id, department_id, appointment_date, slot_start, \
          slot_end, appointment_type, reason, status, booking_source) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'new_visit', $8, 'confirmed', 'online') \
         RETURNING *",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .bind(body.doctor_id)
    .bind(body.department_id)
    .bind(body.appointment_date)
    .bind(body.slot_start)
    .bind(body.slot_end)
    .bind(&body.reason)
    .fetch_one(&mut *tx)
    .await?;

    let doctor_name: String = sqlx::query_scalar("SELECT full_name FROM users WHERE id = $1")
        .bind(body.doctor_id)
        .fetch_optional(&mut *tx)
        .await?
        .unwrap_or_else(|| "Doctor".to_owned());
    let department_name: String = sqlx::query_scalar("SELECT name FROM departments WHERE id = $1")
        .bind(body.department_id)
        .fetch_optional(&mut *tx)
        .await?
        .unwrap_or_else(|| "Dept".to_owned());
    let qr_code_data = format!("MEDBRAINS:APT:{}", appointment.id);

    tx.commit().await?;

    Ok(Json(PublicBookingResponse {
        appointment_id: appointment.id,
        appointment_date: appointment.appointment_date,
        slot_start: appointment.slot_start,
        doctor_name,
        department_name,
        qr_code_data,
        status: "confirmed".to_owned(),
        message: "Appointment booked. Show QR code at kiosk on arrival.".to_owned(),
    }))
}

/// GET /api/public/appointments/slots
pub async fn public_available_slots(
    State(state): State<AppState>,
    Query(params): Query<PublicSlotsQuery>,
) -> Result<Json<Vec<AvailableSlot>>, AppError> {
    let tenant_id: Uuid =
        sqlx::query_scalar("SELECT id FROM tenants WHERE code = $1 AND is_active = true")
            .bind(&params.tenant_code)
            .fetch_optional(&state.db)
            .await?
            .ok_or_else(|| AppError::BadRequest("Invalid code".into()))?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;

    let day_of_week = params.date.weekday().num_days_from_sunday() as i32;
    let schedules = sqlx::query_as::<_, DoctorSchedule>(
        "SELECT * FROM doctor_schedules WHERE doctor_id = $1 AND day_of_week = $2 AND is_active = true",
    )
    .bind(params.doctor_id)
    .bind(day_of_week)
    .fetch_all(&mut *tx)
    .await?;

    let mut slots = Vec::new();
    for schedule in &schedules {
        let mut current = schedule.start_time;
        while current < schedule.end_time {
            let end_time = current + Duration::minutes(i64::from(schedule.slot_duration_mins));
            if end_time > schedule.end_time {
                break;
            }

            let booked: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM appointments \
                 WHERE doctor_id = $1 AND appointment_date = $2 AND slot_start = $3 \
                 AND status NOT IN ('cancelled', 'no_show')",
            )
            .bind(params.doctor_id)
            .bind(params.date)
            .bind(current)
            .fetch_one(&mut *tx)
            .await?;

            if booked < i64::from(schedule.max_patients) {
                slots.push(AvailableSlot {
                    start_time: current,
                    end_time,
                    booked_count: booked,
                    max_patients: schedule.max_patients,
                    is_available: true,
                });
            }

            current = end_time;
        }
    }

    tx.commit().await?;
    Ok(Json(slots))
}

/// POST /api/public/kiosk/checkin — QR scan → check in → generate token → broadcast to TV
pub async fn kiosk_checkin(
    State(state): State<AppState>,
    Json(body): Json<KioskCheckinRequest>,
) -> Result<Json<KioskCheckinResponse>, AppError> {
    let appointment_id = body
        .qr_data
        .strip_prefix("MEDBRAINS:APT:")
        .and_then(|value| Uuid::parse_str(value).ok())
        .ok_or_else(|| AppError::BadRequest("Invalid QR code".into()))?;

    let appointment = sqlx::query_as::<_, Appointment>("SELECT * FROM appointments WHERE id = $1")
        .bind(appointment_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)?;

    let today = Utc::now().date_naive();
    if appointment.appointment_date != today {
        return Err(AppError::BadRequest(format!(
            "Appointment is for {}",
            appointment.appointment_date
        )));
    }
    if appointment.status != AppointmentStatus::Scheduled
        && appointment.status != AppointmentStatus::Confirmed
    {
        return Err(AppError::Conflict("Already checked in".into()));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &appointment.tenant_id).await?;

    sqlx::query(
        "UPDATE appointments SET status = 'checked_in', checked_in_at = now() WHERE id = $1",
    )
    .bind(appointment_id)
    .execute(&mut *tx)
    .await?;

    let token_seq: i32 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(token_seq), 0) + 1 FROM queue_tokens \
         WHERE department_id = $1 AND token_date = CURRENT_DATE",
    )
    .bind(appointment.department_id)
    .fetch_one(&mut *tx)
    .await?;
    let token_number = format!("T-{token_seq:03}");

    sqlx::query(
        "INSERT INTO queue_tokens \
         (tenant_id, department_id, patient_id, token_date, token_seq, token_number, status) \
         VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, 'waiting')",
    )
    .bind(appointment.tenant_id)
    .bind(appointment.department_id)
    .bind(appointment.patient_id)
    .bind(token_seq)
    .bind(&token_number)
    .execute(&mut *tx)
    .await?;

    let patient_name: String = sqlx::query_scalar(
        "SELECT COALESCE(first_name || ' ' || last_name, first_name) FROM patients WHERE id = $1",
    )
    .bind(appointment.patient_id)
    .fetch_optional(&mut *tx)
    .await?
    .unwrap_or_else(|| "Patient".to_owned());
    let doctor_name: String = sqlx::query_scalar("SELECT full_name FROM users WHERE id = $1")
        .bind(appointment.doctor_id)
        .fetch_optional(&mut *tx)
        .await?
        .unwrap_or_else(|| "Doctor".to_owned());
    let department_name: String = sqlx::query_scalar("SELECT name FROM departments WHERE id = $1")
        .bind(appointment.department_id)
        .fetch_optional(&mut *tx)
        .await?
        .unwrap_or_else(|| "Dept".to_owned());

    state
        .queue_broadcaster
        .broadcast_token_called(appointment.department_id, &token_number, &patient_name)
        .await;
    tx.commit().await?;

    Ok(Json(KioskCheckinResponse {
        appointment_id,
        patient_name,
        doctor_name,
        department_name,
        token_number,
        status: "checked_in".to_owned(),
        message: "Check-in successful. Wait for your token.".to_owned(),
    }))
}

async fn find_or_create_patient(
    body: &PublicBookingRequest,
    tenant_id: Uuid,
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
) -> Result<Uuid, AppError> {
    let existing =
        sqlx::query_scalar::<_, Uuid>("SELECT id FROM patients WHERE phone_primary = $1 LIMIT 1")
            .bind(&body.patient_phone)
            .fetch_optional(&mut **tx)
            .await?;

    if let Some(patient_id) = existing {
        return Ok(patient_id);
    }

    sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO patients (tenant_id, first_name, phone_primary, date_of_birth) \
         VALUES ($1, $2, $3, $4) \
         RETURNING id",
    )
    .bind(tenant_id)
    .bind(&body.patient_name)
    .bind(&body.patient_phone)
    .bind(body.patient_dob)
    .fetch_one(&mut **tx)
    .await
    .map_err(Into::into)
}

async fn ensure_public_slot_capacity(
    body: &PublicBookingRequest,
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
) -> Result<(), AppError> {
    let booked: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM appointments \
         WHERE doctor_id = $1 AND appointment_date = $2 AND slot_start = $3 \
         AND status NOT IN ('cancelled', 'no_show')",
    )
    .bind(body.doctor_id)
    .bind(body.appointment_date)
    .bind(body.slot_start)
    .fetch_one(&mut **tx)
    .await?;

    let day_of_week = body.appointment_date.weekday().num_days_from_sunday() as i32;
    let max_patients: Option<i32> = sqlx::query_scalar(
        "SELECT max_patients FROM doctor_schedules \
         WHERE doctor_id = $1 AND day_of_week = $2 AND is_active = true",
    )
    .bind(body.doctor_id)
    .bind(day_of_week)
    .fetch_optional(&mut **tx)
    .await?;

    if let Some(max) = max_patients {
        if booked >= i64::from(max) {
            return Err(AppError::Conflict("Slot fully booked".into()));
        }
    }

    Ok(())
}
