//! Critical-value acknowledgment escalation (audit P0 #16, NABH/IPSG).
//!
//! A critical lab alert that nobody acknowledges within the tenant's
//! window (lab.critical_ack_minutes, default 15) escalates: SMS to the
//! ordering doctor's supervisor when one is on file with a phone,
//! otherwise a repeat SMS to the doctor. Each alert escalates once;
//! the outbox idempotency key guards against double-sends.

use std::time::Duration;

use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;

const PASS_INTERVAL_SECS: u64 = 300;
const DEFAULT_ACK_WINDOW_MINUTES: i32 = 15;

pub fn spawn(pool: PgPool) {
    tokio::spawn(async move {
        loop {
            match escalate_unacknowledged(&pool).await {
                Ok(escalated) if escalated > 0 => {
                    tracing::warn!(escalated, "critical alerts escalated — unacknowledged");
                }
                Ok(_) => {}
                Err(error) => tracing::error!(%error, "critical alert escalation pass failed"),
            }
            tokio::time::sleep(Duration::from_secs(PASS_INTERVAL_SECS)).await;
        }
    });
}

#[derive(sqlx::FromRow)]
struct OverdueAlert {
    id: Uuid,
    tenant_id: Uuid,
    order_id: Uuid,
    parameter_name: String,
    value: String,
    doctor_id: Option<Uuid>,
    doctor_phone: Option<String>,
    supervisor_id: Option<Uuid>,
    supervisor_phone: Option<String>,
}

async fn escalate_unacknowledged(pool: &PgPool) -> Result<u64, AppError> {
    // notified_to is the ordering doctor recorded when the alert fired.
    let overdue = sqlx::query_as::<_, OverdueAlert>(
        "SELECT ca.id, ca.tenant_id, ca.order_id, ca.parameter_name, ca.value, \
                d.id AS doctor_id, d.phone AS doctor_phone, \
                s.id AS supervisor_id, s.phone AS supervisor_phone \
         FROM lab_critical_alerts ca \
         LEFT JOIN users d ON d.id = ca.notified_to \
         LEFT JOIN users s ON s.id = d.supervisor_id \
         LEFT JOIN tenant_settings ts \
           ON ts.tenant_id = ca.tenant_id \
          AND ts.category = 'lab' AND ts.key = 'critical_ack_minutes' \
         WHERE ca.acknowledged_at IS NULL \
           AND ca.escalated_at IS NULL \
           AND ca.created_at < now() - make_interval(mins => \
                 COALESCE((ts.value #>> '{}')::int, $1)) \
         ORDER BY ca.created_at \
         LIMIT 500",
    )
    .bind(DEFAULT_ACK_WINDOW_MINUTES)
    .fetch_all(pool)
    .await?;

    let mut escalated = 0u64;
    for alert in overdue {
        let mut tx = pool.begin().await?;
        medbrains_db::pool::set_tenant_context(&mut tx, &alert.tenant_id).await?;

        let has_phone = |phone: &Option<String>| {
            phone
                .as_deref()
                .is_some_and(|value| !value.trim().is_empty())
        };
        let (recipient_id, recipient_phone) = if has_phone(&alert.supervisor_phone) {
            (alert.supervisor_id, alert.supervisor_phone.clone())
        } else {
            (alert.doctor_id, alert.doctor_phone.clone())
        };

        if let Some(phone) = recipient_phone.filter(|value| !value.trim().is_empty()) {
            medbrains_outbox::queue::queue_in_tx(
                &mut tx,
                medbrains_outbox::queue::OutboxRow {
                    tenant_id: alert.tenant_id,
                    aggregate_type: "lab_critical_alert",
                    aggregate_id: Some(alert.id),
                    event_type: "sms.cds_critical_interaction",
                    payload: serde_json::json!({
                        "to": phone,
                        "alert_id": alert.id,
                        "order_id": alert.order_id,
                        "body": format!(
                            "ESCALATION: unacknowledged critical lab value {} = {} \
                             (order {}). Acknowledge in MedBrains immediately.",
                            alert.parameter_name, alert.value, alert.order_id
                        ),
                    }),
                    idempotency_key: Some(format!("critesc:{}", alert.id)),
                },
            )
            .await
            .map_err(|e| AppError::Internal(format!("failed to queue escalation: {e}")))?;
        } else {
            tracing::error!(
                alert_id = %alert.id, order_id = %alert.order_id,
                "critical alert overdue but no phone on file for doctor or supervisor"
            );
        }

        // Mark escalated either way — without a phone the escalation is
        // the error log + dashboard state, and re-firing every pass
        // would just spam the log.
        sqlx::query(
            "UPDATE lab_critical_alerts SET escalated_at = now(), escalated_to = $1 \
             WHERE id = $2 AND tenant_id = $3 AND escalated_at IS NULL",
        )
        .bind(recipient_id)
        .bind(alert.id)
        .bind(alert.tenant_id)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        escalated += 1;
    }

    Ok(escalated)
}
