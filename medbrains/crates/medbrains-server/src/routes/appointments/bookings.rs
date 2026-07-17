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
    error::AppError,
    middleware::auth::Claims,
    middleware::authorization::{is_bypass_role, require_permission},
    routes::notifications::{NewNotification, create_notification},
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
    let can_view_patient_identity = is_bypass_role(&claims)
        || claims
            .permissions
            .iter()
            .any(|permission| permission == permissions::patients::VIEW);

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
        patient_name: Option<String>,
        doctor_name: String,
    }

    let rows = sqlx::query_as::<_, AppointmentRow>(
        "SELECT a.*, \
         CASE WHEN $6::bool THEN CONCAT(p.first_name, ' ', p.last_name) ELSE NULL END AS patient_name, \
         u.full_name AS doctor_name \
         FROM appointments a \
         JOIN patients p ON p.id = a.patient_id \
         JOIN users u ON u.id = a.doctor_id \
         WHERE ($1::date IS NULL OR a.appointment_date = $1) \
         AND ($2::uuid IS NULL OR a.doctor_id = $2) \
         AND ($3::uuid IS NULL OR a.department_id = $3) \
         AND ($4::uuid IS NULL OR a.patient_id = $4) \
         AND ($5::text IS NULL OR a.status::text = $5) \
         ORDER BY a.appointment_date, a.slot_start LIMIT 5000",
    )
    .bind(query.date)
    .bind(query.doctor_id)
    .bind(query.department_id)
    .bind(query.patient_id)
    .bind(query.status.as_deref())
    .bind(can_view_patient_identity)
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

    let appointment_type = body.appointment_type.unwrap_or(AppointmentType::NewVisit);

    // Slot-capacity gate. Two reasons we may skip it:
    //
    //   1. Follow-up visits — these are by definition continuity-of-care
    //      from a prior encounter and should never be blocked by the
    //      doctor's "new patient" cap. Operators routinely report being
    //      unable to schedule a 1-week post-op review because the slot
    //      is full of new walk-ins.
    //
    //   2. Tenant opted to treat schedules as advisory — by default the
    //      cap is informational ("this slot is filling up") and the UI
    //      surfaces a soft warning, not a hard rejection. Tenants that
    //      want strict caps set `tenant_settings.appointment_enforce_slot_cap=true`.
    //
    // The schedule rows are still useful — they drive the slot picker UI,
    // doctor availability calendars, and the analytics dashboard. They
    // just don't gate booking.
    let enforce_cap = sqlx::query_scalar::<_, Option<serde_json::Value>>(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'appointments' AND key = 'enforce_slot_cap'",
    )
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .flatten()
    .and_then(|v| v.as_bool())
    .unwrap_or(false);

    if enforce_cap && appointment_type != AppointmentType::FollowUp {
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

        if let Some(max) = max_patients
            && booked >= i64::from(max)
        {
            return Err(AppError::Conflict("This time slot is fully booked".into()));
        }
    }
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

    // Notify the doctor in-app (once for the series), unless they booked it
    // themselves. doctor_id references users.id directly.
    if body.doctor_id != claims.sub
        && let Some(appt) = first_row.as_ref()
    {
        let patient_name: String = sqlx::query_scalar(
            "SELECT COALESCE(NULLIF(TRIM(CONCAT(first_name, ' ', last_name)), ''), uhid) \
             FROM patients WHERE id = $1 AND tenant_id = $2",
        )
        .bind(body.patient_id)
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?;
        let summary = format!("{patient_name} — {} {}", appt.appointment_date, appt.slot_start);
        create_notification(
            &mut tx,
            claims.tenant_id,
            NewNotification {
                user_id: body.doctor_id,
                kind: "info",
                title: "New appointment booked",
                body: Some(&summary),
                category: Some("Appointments"),
                entity_type: Some("appointment"),
                entity_id: Some(appt.id),
                action_url: Some("/appointments"),
            },
        )
        .await?;
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

    // Checked-in appointments have an encounter, a queue entry, and
    // possibly an auto-charged consultation fee — unwind all of it so
    // cancellation doesn't leave the patient billed for a visit that
    // never happened (audit P1: manual reversal only).
    if let Some(encounter_id) = row.encounter_id {
        let queue: Option<(Uuid, String)> = sqlx::query_as(
            "SELECT id, status::text FROM opd_queues \
             WHERE tenant_id = $1 AND encounter_id = $2 \
             ORDER BY created_at DESC LIMIT 1",
        )
        .bind(claims.tenant_id)
        .bind(encounter_id)
        .fetch_optional(&mut *tx)
        .await?;

        if let Some((queue_id, queue_status)) = queue {
            if queue_status == "in_consultation" || queue_status == "completed" {
                return Err(AppError::Conflict(
                    "Consultation already started — complete or close the OPD visit instead \
                     of cancelling the appointment"
                        .to_owned(),
                ));
            }

            sqlx::query(
                "UPDATE opd_queues SET status = 'cancelled'::queue_status, updated_at = now() \
                 WHERE id = $1 AND tenant_id = $2",
            )
            .bind(queue_id)
            .bind(claims.tenant_id)
            .execute(&mut *tx)
            .await?;

            // Reverse the consultation auto-charge if one was posted
            // (source 'opd' keyed on the queue row). No-op when unbilled.
            medbrains_server_services::billing::reverse_auto_charge_for_source(
                &mut tx,
                &claims.tenant_id,
                "opd",
                queue_id,
                claims.sub,
                body.cancel_reason
                    .as_deref()
                    .unwrap_or("Appointment cancelled"),
            )
            .await?;
        }

        sqlx::query(
            "UPDATE encounters SET status = 'cancelled'::encounter_status \
             WHERE id = $1 AND tenant_id = $2 AND status = 'open'::encounter_status",
        )
        .bind(encounter_id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;

        // TV token board cleanup — drop any live token for this patient.
        sqlx::query(
            "UPDATE queue_tokens SET status = 'cancelled' \
             WHERE tenant_id = $1 AND patient_id = $2 AND token_date = CURRENT_DATE \
               AND status IN ('waiting', 'called')",
        )
        .bind(claims.tenant_id)
        .bind(row.patient_id)
        .execute(&mut *tx)
        .await?;
    }

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

    let mut row = sqlx::query_as::<_, Appointment>(
        "UPDATE appointments SET \
         status = 'checked_in', checked_in_at = now(), updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND status IN ('scheduled', 'confirmed') \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    // Check-in must land the patient in the doctor's OPD queue — until
    // now this was a separate manual receptionist step. opd_queues needs
    // an encounter, so create one unless the appointment already has it.
    if row.encounter_id.is_none() {
        let visit_type = if row.appointment_type == AppointmentType::FollowUp {
            "follow_up"
        } else {
            "booked"
        };

        let encounter_id = sqlx::query_scalar::<_, Uuid>(
            "INSERT INTO encounters \
             (tenant_id, patient_id, encounter_type, status, department_id, doctor_id, \
              encounter_date, visit_type) \
             VALUES ($1, $2, 'opd'::encounter_type, 'open'::encounter_status, $3, $4, \
              $5, $6) \
             RETURNING id",
        )
        .bind(claims.tenant_id)
        .bind(row.patient_id)
        .bind(row.department_id)
        .bind(row.doctor_id)
        .bind(row.appointment_date)
        .bind(visit_type)
        .fetch_one(&mut *tx)
        .await?;

        let token = crate::routes::opd::generate_opd_token(&mut tx, &claims.tenant_id).await?;

        let queue_id = sqlx::query_scalar::<_, Uuid>(
            "INSERT INTO opd_queues \
             (tenant_id, encounter_id, department_id, doctor_id, token_number, \
              status, queue_date) \
             VALUES ($1, $2, $3, $4, $5, 'waiting'::queue_status, $6) \
             RETURNING id",
        )
        .bind(claims.tenant_id)
        .bind(encounter_id)
        .bind(row.department_id)
        .bind(row.doctor_id)
        .bind(token)
        .bind(row.appointment_date)
        .fetch_one(&mut *tx)
        .await?;

        row = sqlx::query_as::<_, Appointment>(
            "UPDATE appointments SET encounter_id = $1, token_number = $2, updated_at = now() \
             WHERE id = $3 AND tenant_id = $4 RETURNING *",
        )
        .bind(encounter_id)
        .bind(token)
        .bind(id)
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?;

        let event = medbrains_core::clinical_events::ClinicalEventEnvelope::new(
            claims.tenant_id,
            medbrains_core::clinical_events::ClinicalEventName::OpdEncounterCreated,
            encounter_id,
            claims.sub,
            serde_json::json!({
                "encounter_id": encounter_id,
                "patient_id": row.patient_id,
                "queue_id": queue_id,
                "token_number": token,
                "visit_type": visit_type,
                "appointment_id": row.id,
            }),
        )
        .with_patient(row.patient_id)
        .with_encounter(encounter_id)
        .with_department(row.department_id);
        crate::events::queue_clinical_event_in_tx(&mut tx, &event).await?;
    }

    // TV token board entry + broadcast (same path the kiosk uses).
    let queue_token =
        super::issue_queue_token(&mut tx, claims.tenant_id, row.department_id, row.patient_id)
            .await?;
    state
        .queue_broadcaster
        .broadcast_token_called(row.department_id, &queue_token)
        .await;

    // Unified OPD token (department scope) for the new token boards / console.
    crate::routes::tokens::issue_token_in_tx(
        &mut tx,
        claims.tenant_id,
        crate::routes::tokens::IssueToken {
            module: "opd",
            scope: "department",
            scope_id: Some(row.department_id),
            scope_label: None,
            priority: "normal",
            patient_id: Some(row.patient_id),
            patient_name: None,
            entity_type: Some("appointment"),
            entity_id: Some(row.id),
            issued_by: Some(claims.sub),
        },
    )
    .await?;

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
