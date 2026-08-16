use axum::{
    Json,
    extract::{Query, State},
};
use chrono::{Datelike, Duration, NaiveTime, Utc};
use medbrains_core::appointment::{Appointment, AppointmentStatus, AvailableSlot, DoctorSchedule};
use uuid::Uuid;

use crate::{error::AppError, event_tokens, state::AppState};

use super::{
    KioskCheckinRequest, KioskCheckinResponse, PublicBookableDoctor, PublicBookingDirectory,
    PublicBookingRequest, PublicBookingResponse, PublicDirectoryQuery, PublicSlotsQuery,
    PublicTokenLink, PublicTokenStatus,
};

/// How long a patient's status link stays live.
///
/// The token belongs to one day's queue, so the link is useless past it either
/// way; the expiry is what stops a link shared or logged today from being
/// replayed next week.
const STATUS_LINK_HOURS: i64 = 16;

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

    verify_booking_otp(
        &mut tx,
        tenant_id,
        body.patient_phone.trim(),
        body.otp.as_deref(),
    )
    .await?;

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
    let end_of_day = NaiveTime::from_hms_opt(23, 59, 59)
        .ok_or_else(|| AppError::Internal("invalid appointment QR expiry".to_owned()))?;
    let qr_expires_at = appointment.appointment_date.and_time(end_of_day).and_utc();
    let qr_code_data = event_tokens::issue_event_token(
        &state,
        tenant_id,
        "appointment.checkin",
        "appointment",
        appointment.id,
        qr_expires_at,
    )
    .await?;

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

/// GET /api/public/appointments/directory
///
/// The doctors a member of the public may book with, so the booking page has
/// something to offer. Booking already needed a `doctor_id` and there was no
/// public way to learn one — the flow could not be started from outside.
///
/// **Opt-in per tenant.** Publishing a staff roster is a decision a hospital
/// makes, not a default it discovers. Without
/// `appointments.public_booking_enabled` this answers exactly as an unknown
/// hospital does, so the setting cannot be probed for.
///
/// Only doctors with an active schedule are listed. Offering one with no
/// schedule sends a patient to a date picker that will never show a slot, and
/// nothing on the page could explain why.
pub async fn public_bookable_doctors(
    State(state): State<AppState>,
    Query(params): Query<PublicDirectoryQuery>,
) -> Result<Json<PublicBookingDirectory>, AppError> {
    let tenant_id: Uuid =
        sqlx::query_scalar("SELECT id FROM tenants WHERE code = $1 AND is_active = true")
            .bind(&params.tenant_code)
            .fetch_optional(&state.db)
            .await?
            .ok_or(AppError::NotFound)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;

    // Both switches in one read. Two round trips to learn two booleans off the
    // same row set is the kind of thing that is free once and expensive at a
    // thousand page loads.
    let settings = sqlx::query_as::<_, (String, serde_json::Value)>(
        "SELECT key, value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'appointments' \
           AND key IN ('public_booking_enabled', 'public_booking_otp_required')",
    )
    .bind(tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let flag = |name: &str| {
        settings
            .iter()
            .find(|(key, _)| key == name)
            .map(|(_, value)| value.as_bool().unwrap_or(value.as_str() == Some("true")))
            .unwrap_or(false)
    };

    if !flag("public_booking_enabled") {
        return Err(AppError::NotFound);
    }
    let otp_required = flag("public_booking_otp_required");

    // One query, not a doctor list followed by a schedule lookup each. DISTINCT
    // because a doctor holding several weekday schedules in one department is
    // still one choice on the page.
    let rows = sqlx::query_as::<_, PublicBookableDoctor>(
        "SELECT DISTINCT u.id AS doctor_id, u.full_name AS doctor_name, \
                d.id AS department_id, d.name AS department_name \
           FROM doctor_schedules ds \
           JOIN users u ON u.id = ds.doctor_id AND u.tenant_id = ds.tenant_id \
           JOIN departments d ON d.id = ds.department_id AND d.tenant_id = ds.tenant_id \
          WHERE ds.tenant_id = $1 AND ds.is_active \
            AND u.is_active AND u.role = 'doctor' \
          ORDER BY d.name, u.full_name",
    )
    .bind(tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(PublicBookingDirectory {
        otp_required,
        doctors: rows,
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

/// POST /api/public/kiosk/checkin — opaque QR scan → check in → generate token → broadcast to TV
pub async fn kiosk_checkin(
    State(state): State<AppState>,
    Json(body): Json<KioskCheckinRequest>,
) -> Result<Json<KioskCheckinResponse>, AppError> {
    let qr_token =
        event_tokens::open_event_token(&state, &body.qr_data, "appointment.checkin").await?;
    if qr_token.subject_type != "appointment" {
        return Err(AppError::BadRequest("Invalid QR code".to_owned()));
    }
    let appointment_id = qr_token.subject_id;

    let appointment = sqlx::query_as::<_, Appointment>("SELECT * FROM appointments WHERE id = $1")
        .bind(appointment_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound)?;
    if appointment.tenant_id != qr_token.tenant_id {
        return Err(AppError::BadRequest("Invalid QR code".to_owned()));
    }

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

    let (queue_token_id, token_number) = super::issue_queue_token(
        &mut tx,
        appointment.tenant_id,
        appointment.department_id,
        appointment.patient_id,
    )
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
        .broadcast_token_called(appointment.department_id, &token_number)
        .await;
    tx.commit().await?;

    let status_token = event_tokens::issue_event_token(
        &state,
        appointment.tenant_id,
        "queue.status",
        "queue_token",
        queue_token_id,
        Utc::now() + Duration::hours(STATUS_LINK_HOURS),
    )
    .await?;

    Ok(Json(KioskCheckinResponse {
        appointment_id,
        patient_name,
        doctor_name,
        department_name,
        token_number,
        status: "checked_in".to_owned(),
        message: "Check-in successful. Wait for your token.".to_owned(),
        status_token,
    }))
}

/// GET /api/opd/queue-tokens/{id}/status-link — the link to hand a patient.
///
/// Most patients check in at the desk rather than at a kiosk, so this is the
/// path that actually reaches them: staff open a token and give the patient the
/// link (as a QR on screen, or a message) to follow it on their own phone.
///
/// Returns the opaque handle only. Turning it into a URL or a QR is the caller's
/// business — the desk, the slip and a message each render it differently.
pub async fn queue_token_status_link(
    State(state): State<AppState>,
    axum::Extension(claims): axum::Extension<crate::middleware::auth::Claims>,
    axum::extract::Path(id): axum::extract::Path<Uuid>,
) -> Result<Json<PublicTokenLink>, AppError> {
    crate::middleware::authorization::require_permission(
        &claims,
        medbrains_core::permissions::front_office::queue::LIST,
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    // Confirm the token is this tenant's before sealing its id into a link that
    // needs no further authorisation to use.
    let exists: Option<(Uuid,)> = sqlx::query_as(
        "SELECT id FROM queue_tokens \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    exists.ok_or(AppError::NotFound)?;

    let status_token = event_tokens::issue_event_token(
        &state,
        claims.tenant_id,
        "queue.status",
        "queue_token",
        id,
        Utc::now() + Duration::hours(STATUS_LINK_HOURS),
    )
    .await?;

    Ok(Json(PublicTokenLink { status_token }))
}

/// GET /api/public/queue-token/{token} — follow your own token from your phone.
///
/// Checking in gives a patient a number and, until now, nowhere to watch it.
/// The board is in the waiting room; a digital token you cannot follow is a
/// screenshot, and the patient still has to stand in front of the screen.
///
/// Unauthenticated by necessity — the patient has no login — so the opaque
/// token is the whole of the authorisation: it is encrypted, tenant-stamped and
/// expiring, and it names one queue row. Nothing here widens that to a second
/// row, and the reply carries no identity.
pub async fn public_token_status(
    State(state): State<AppState>,
    axum::extract::Path(token): axum::extract::Path<String>,
) -> Result<Json<PublicTokenStatus>, AppError> {
    let opened = event_tokens::open_event_token(&state, &token, "queue.status").await?;
    if opened.subject_type != "queue_token" {
        return Err(AppError::BadRequest("Invalid token".to_owned()));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &opened.tenant_id).await?;

    // Tenant is matched from the sealed token, not from the request: a link
    // minted for one tenant must not read another's queue even if the ids were
    // somehow known.
    let row = sqlx::query_as::<_, QueueTokenStatusRow>(
        "SELECT qt.token_number, qt.status, qt.token_date, qt.token_seq, \
                qt.priority::text AS priority, qt.department_id, \
                COALESCE(d.name, '') AS department_name \
           FROM queue_tokens qt \
           LEFT JOIN departments d ON d.id = qt.department_id \
                                  AND d.tenant_id = qt.tenant_id \
          WHERE qt.id = $1 AND qt.tenant_id = $2 AND qt.deleted_at IS NULL",
    )
    .bind(opened.subject_id)
    .bind(opened.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;

    // Position only means anything while still queued. A patient who has been
    // called or seen gets the status and no count, rather than a stale "3 ahead"
    // that would read as though they were still waiting.
    let (ahead, estimated_wait_minutes) = if row.status == "waiting" {
        let (ahead, wait) = medbrains_tv::position_and_wait(
            &state.db,
            opened.tenant_id,
            row.department_id,
            row.token_date,
            row.token_seq,
            &row.priority,
        )
        .await?;
        (Some(ahead), wait)
    } else {
        (None, None)
    };

    Ok(Json(PublicTokenStatus {
        token_number: row.token_number,
        department_name: row.department_name,
        status: row.status,
        ahead,
        estimated_wait_minutes,
    }))
}

#[derive(sqlx::FromRow)]
struct QueueTokenStatusRow {
    token_number: String,
    status: String,
    token_date: chrono::NaiveDate,
    token_seq: i32,
    priority: String,
    department_id: Uuid,
    department_name: String,
}

async fn find_or_create_patient(
    body: &PublicBookingRequest,
    tenant_id: Uuid,
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
) -> Result<Uuid, AppError> {
    // Family members share phones — phone alone booked into the wrong
    // record (audit P1). Match phone + first name; anything else gets a
    // fresh patient record that MRD can merge later.
    let (first_name_match, _) = split_public_patient_name(&body.patient_name);
    let existing = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM patients \
         WHERE tenant_id = $1 AND phone = $2 AND lower(first_name) = lower($3) \
         LIMIT 1",
    )
    .bind(tenant_id)
    .bind(&body.patient_phone)
    .bind(&first_name_match)
    .fetch_optional(&mut **tx)
    .await?;

    if let Some(patient_id) = existing {
        return Ok(patient_id);
    }

    let uhid = crate::routes::patients::generate_uhid(tx, &tenant_id).await?;

    let (first_name, last_name) = split_public_patient_name(&body.patient_name);

    sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone, date_of_birth) \
         VALUES ($1, $2, $3, $4, 'unknown'::gender, $5, $6) \
         RETURNING id",
    )
    .bind(tenant_id)
    .bind(&uhid)
    .bind(&first_name)
    .bind(&last_name)
    .bind(&body.patient_phone)
    .bind(body.patient_dob)
    .fetch_one(&mut **tx)
    .await
    .map_err(Into::into)
}

fn split_public_patient_name(name: &str) -> (String, String) {
    let mut parts = name.split_whitespace();
    let first_name = parts.next().unwrap_or("Public").to_owned();
    let last_name = parts.collect::<Vec<_>>().join(" ");
    let last_name = if last_name.is_empty() {
        "Patient".to_owned()
    } else {
        last_name
    };
    (first_name, last_name)
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

// ── Public booking phone verification ───────────────────────

const BOOKING_OTP_TTL_MINUTES: i32 = 10;
const BOOKING_OTP_MAX_ATTEMPTS: i32 = 5;

fn hash_booking_otp(otp: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(otp.as_bytes());
    hex::encode(hasher.finalize())
}

/// POST /api/public/appointments/otp — request a booking OTP by phone.
/// Always answers 200 (no phone-number enumeration); delivery rides the
/// outbox → Twilio handler.
// Public (unauthenticated) endpoint: the tenant is resolved from the request
// body inside the handler, so the span field is recorded once it is known.
#[tracing::instrument(skip_all, fields(tenant_id = tracing::field::Empty))]
pub async fn request_public_booking_otp(
    State(state): State<AppState>,
    Json(body): Json<super::PublicBookingOtpRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let ack = Json(serde_json::json!({
        "status": "ok",
        "message": "If SMS is configured, a verification code has been sent."
    }));

    let phone = body.patient_phone.trim();
    if phone.len() < 8 {
        return Ok(ack);
    }

    let Some(tenant_id) = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM tenants WHERE code = $1 AND is_active = true",
    )
    .bind(&body.tenant_code)
    .fetch_optional(&state.db)
    .await?
    else {
        return Ok(ack);
    };
    tracing::Span::current().record("tenant_id", tracing::field::display(tenant_id));

    let mut buf = [0u8; 4];
    getrandom::fill(&mut buf)
        .map_err(|e| AppError::Internal(format!("otp generation failed: {e}")))?;
    let otp = format!("{:06}", u32::from_le_bytes(buf) % 1_000_000);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;

    sqlx::query(
        "UPDATE public_booking_otps SET used_at = now() \
         WHERE tenant_id = $1 AND phone = $2 AND used_at IS NULL",
    )
    .bind(tenant_id)
    .bind(phone)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "INSERT INTO public_booking_otps (tenant_id, phone, otp_hash, expires_at) \
         VALUES ($1, $2, $3, now() + make_interval(mins => $4))",
    )
    .bind(tenant_id)
    .bind(phone)
    .bind(hash_booking_otp(&otp))
    .bind(BOOKING_OTP_TTL_MINUTES)
    .execute(&mut *tx)
    .await?;

    medbrains_outbox::queue::queue_in_tx(
        &mut tx,
        medbrains_outbox::queue::OutboxRow {
            tenant_id,
            aggregate_type: "public_booking",
            aggregate_id: None,
            event_type: "sms.public_booking_otp",
            payload: serde_json::json!({
                "to": phone,
                "body": format!(
                    "Your appointment booking verification code is {otp}. \
                     Valid for {BOOKING_OTP_TTL_MINUTES} minutes."
                ),
            }),
            idempotency_key: None,
        },
    )
    .await
    .map_err(|e| AppError::Internal(format!("failed to queue booking OTP: {e}")))?;

    tx.commit().await?;
    Ok(ack)
}

/// Verify a booking OTP inside the booking transaction. Errors when the
/// tenant requires verification and the code is absent/wrong/expired.
pub(super) async fn verify_booking_otp(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    phone: &str,
    otp: Option<&str>,
) -> Result<(), AppError> {
    let required = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'appointments' \
           AND key = 'public_booking_otp_required'",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .map(|v| v.as_bool().unwrap_or(v.as_str() == Some("true")))
    .unwrap_or(false);
    if !required {
        return Ok(());
    }

    let Some(otp) = otp.map(str::trim).filter(|value| !value.is_empty()) else {
        return Err(AppError::BadRequest(
            "Phone verification required: request an OTP and include it in the booking".to_owned(),
        ));
    };

    let row: Option<(Uuid, bool, bool, i32)> = sqlx::query_as(
        "SELECT id, expires_at > now(), otp_hash = $3, attempts \
         FROM public_booking_otps \
         WHERE tenant_id = $1 AND phone = $2 AND used_at IS NULL \
         ORDER BY created_at DESC LIMIT 1 \
         FOR UPDATE",
    )
    .bind(tenant_id)
    .bind(phone)
    .bind(hash_booking_otp(otp))
    .fetch_optional(&mut **tx)
    .await?;

    let Some((otp_id, in_window, otp_matches, attempts)) = row else {
        return Err(AppError::BadRequest(
            "Invalid or expired verification code — request a new one".to_owned(),
        ));
    };

    if !in_window || attempts >= BOOKING_OTP_MAX_ATTEMPTS {
        sqlx::query("UPDATE public_booking_otps SET used_at = now() WHERE id = $1")
            .bind(otp_id)
            .execute(&mut **tx)
            .await?;
        return Err(AppError::BadRequest(
            "Verification code expired — request a new one".to_owned(),
        ));
    }

    if !otp_matches {
        sqlx::query("UPDATE public_booking_otps SET attempts = attempts + 1 WHERE id = $1")
            .bind(otp_id)
            .execute(&mut **tx)
            .await?;
        return Err(AppError::BadRequest("Invalid verification code".to_owned()));
    }

    sqlx::query("UPDATE public_booking_otps SET used_at = now() WHERE id = $1")
        .bind(otp_id)
        .execute(&mut **tx)
        .await?;
    Ok(())
}
