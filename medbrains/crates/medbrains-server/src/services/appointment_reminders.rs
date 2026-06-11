//! Appointment reminder delivery (audit P1 — reminders were stored,
//! never sent; 30-40% no-show cost).
//!
//! Every 5 minutes: for each tenant with SMS reminders enabled, find
//! scheduled/confirmed appointments entering a reminder window
//! (`remind_hours_before`, default 24h + 2h) and enqueue the matching
//! `sms.appointment_reminder_*` outbox event. The registered Twilio
//! handler delivers with retry + DLQ; the outbox unique key
//! (tenant, event_type, idempotency_key) guarantees one send per
//! appointment per window across restarts and re-polls.

use std::time::Duration;

use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;

const PASS_INTERVAL_SECS: u64 = 300;

pub fn spawn(pool: PgPool) {
    tokio::spawn(async move {
        loop {
            match send_due_reminders(&pool).await {
                Ok(sent) if sent > 0 => {
                    tracing::info!(sent, "appointment reminder pass complete");
                }
                Ok(_) => {}
                Err(error) => tracing::error!(%error, "appointment reminder pass failed"),
            }
            tokio::time::sleep(Duration::from_secs(PASS_INTERVAL_SECS)).await;
        }
    });
}

#[derive(sqlx::FromRow)]
struct TenantReminderConfig {
    tenant_id: Uuid,
    value: serde_json::Value,
}

#[derive(sqlx::FromRow)]
struct DueAppointment {
    id: Uuid,
    patient_id: Uuid,
    phone: String,
    doctor_name: String,
    appointment_date: chrono::NaiveDate,
    slot_start: chrono::NaiveTime,
}

fn event_type_for_window(hours: i64) -> &'static str {
    if hours >= 12 {
        "sms.appointment_reminder_24h"
    } else {
        "sms.appointment_reminder_2h"
    }
}

async fn send_due_reminders(pool: &PgPool) -> Result<u64, AppError> {
    let configs = sqlx::query_as::<_, TenantReminderConfig>(
        "SELECT tenant_id, value FROM tenant_settings \
         WHERE category = 'appointments' AND key = 'reminder_config' \
           AND (value->>'sms_enabled')::boolean = true \
         LIMIT 5000",
    )
    .fetch_all(pool)
    .await?;

    let mut sent = 0u64;
    for config in configs {
        let windows: Vec<i64> = config
            .value
            .get("remind_hours_before")
            .and_then(|v| serde_json::from_value(v.clone()).ok())
            .unwrap_or_else(|| vec![24, 2]);
        let template = config
            .value
            .get("sms_template")
            .and_then(serde_json::Value::as_str)
            .unwrap_or("Reminder: Appointment with Dr. {doctor} on {date} at {time}.")
            .to_owned();

        for hours in windows {
            if !(1..=168).contains(&hours) {
                continue;
            }
            sent += enqueue_window(pool, config.tenant_id, hours, &template).await?;
        }
    }

    Ok(sent)
}

async fn enqueue_window(
    pool: &PgPool,
    tenant_id: Uuid,
    hours: i64,
    template: &str,
) -> Result<u64, AppError> {
    let mut tx = pool.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;

    // Appointments whose start time falls inside the next `hours` —
    // i.e. the reminder window has opened. The outbox idempotency key
    // makes each (appointment, window) fire exactly once.
    let due = sqlx::query_as::<_, DueAppointment>(
        "SELECT a.id, a.patient_id, p.phone, u.full_name AS doctor_name, \
                a.appointment_date, a.slot_start \
         FROM appointments a \
         JOIN patients p ON p.id = a.patient_id \
         JOIN users u ON u.id = a.doctor_id \
         WHERE a.tenant_id = $1 \
           AND a.status IN ('scheduled', 'confirmed') \
           AND p.phone <> '' \
           AND (a.appointment_date + a.slot_start) > now() \
           AND (a.appointment_date + a.slot_start) <= now() + make_interval(hours => $2) \
           AND NOT EXISTS ( \
             SELECT 1 FROM outbox_events oe \
             WHERE oe.tenant_id = a.tenant_id AND oe.event_type = $3 \
               AND oe.idempotency_key = 'rem:' || a.id || ':' || $2 || 'h') \
         LIMIT 1000",
    )
    .bind(tenant_id)
    .bind(hours as i32)
    .bind(event_type_for_window(hours))
    .fetch_all(&mut *tx)
    .await?;

    let event_type = event_type_for_window(hours);
    let mut sent = 0u64;
    for appointment in due {
        let body = template
            .replace("{doctor}", &appointment.doctor_name)
            .replace("{date}", &appointment.appointment_date.to_string())
            .replace(
                "{time}",
                &appointment.slot_start.format("%H:%M").to_string(),
            );

        medbrains_outbox::queue::queue_in_tx(
            &mut tx,
            medbrains_outbox::queue::OutboxRow {
                tenant_id,
                aggregate_type: "appointment",
                aggregate_id: Some(appointment.id),
                event_type,
                payload: serde_json::json!({
                    "to": appointment.phone,
                    "body": body,
                    "appointment_id": appointment.id,
                    "patient_id": appointment.patient_id,
                }),
                idempotency_key: Some(format!("rem:{}:{hours}h", appointment.id)),
            },
        )
        .await
        .map_err(|e| AppError::Internal(format!("failed to queue reminder: {e}")))?;
        sent += 1;
    }

    tx.commit().await?;
    Ok(sent)
}
