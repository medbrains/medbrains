//! Verbal/telephone order countersignature escalation (NABH medication safety).
//!
//! A verbal or telephone medication order must be countersigned by the
//! prescriber within policy (the `countersign_due_at` set at transcription,
//! default 24h). When that deadline passes without a signature, this pass
//! actively notifies the ordering doctor (reminder) and their supervisor, then
//! marks the order escalated so it isn't re-notified each pass — mirroring the
//! critical-alert escalation. Until then, an overdue order is only a passive
//! badge on the prescriber's own sign-off queue.

use std::time::Duration;

use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;
use crate::routes::notifications::{NewNotification, create_notification};

const PASS_INTERVAL_SECS: u64 = 1800; // 30 minutes

pub fn spawn(pool: PgPool) {
    tokio::spawn(async move {
        loop {
            match escalate_overdue(&pool).await {
                Ok(escalated) if escalated > 0 => {
                    tracing::warn!(escalated, "verbal orders escalated — countersign overdue");
                }
                Ok(_) => {}
                Err(error) => tracing::error!(%error, "verbal-order escalation pass failed"),
            }
            tokio::time::sleep(Duration::from_secs(PASS_INTERVAL_SECS)).await;
        }
    });
}

#[derive(sqlx::FromRow)]
struct OverdueOrder {
    id: Uuid,
    tenant_id: Uuid,
    doctor_id: Option<Uuid>,
    supervisor_id: Option<Uuid>,
}

async fn escalate_overdue(pool: &PgPool) -> Result<u64, AppError> {
    let overdue = sqlx::query_as::<_, OverdueOrder>(
        "SELECT p.id, p.tenant_id, p.doctor_id, d.supervisor_id \
         FROM prescriptions p \
         LEFT JOIN users d ON d.id = p.doctor_id \
         WHERE p.order_mode <> 'written' \
           AND NOT p.is_signed \
           AND p.countersign_due_at IS NOT NULL \
           AND p.countersign_due_at < now() \
           AND p.countersign_escalated_at IS NULL \
         ORDER BY p.countersign_due_at \
         LIMIT 500",
    )
    .fetch_all(pool)
    .await?;

    let mut escalated = 0u64;
    for order in overdue {
        let mut tx = pool.begin().await?;
        medbrains_db::pool::set_tenant_context(&mut tx, &order.tenant_id).await?;

        // Reminder to the ordering doctor + their supervisor.
        let recipients: Vec<Uuid> = [order.doctor_id, order.supervisor_id]
            .into_iter()
            .flatten()
            .collect();
        for user_id in &recipients {
            create_notification(
                &mut tx,
                order.tenant_id,
                NewNotification {
                    user_id: *user_id,
                    kind: "verbal_order_overdue",
                    title: "Verbal order countersignature overdue",
                    body: Some(
                        "A verbal/telephone order is past its countersignature deadline. \
                         Please countersign it now.",
                    ),
                    category: Some("clinical"),
                    entity_type: Some("prescriptions"),
                    entity_id: Some(order.id),
                    action_url: None,
                },
            )
            .await?;
        }

        // Mark escalated either way so we don't re-fire next pass.
        sqlx::query(
            "UPDATE prescriptions \
             SET countersign_escalated_at = now(), countersign_escalated_to = $1 \
             WHERE id = $2 AND tenant_id = $3 AND countersign_escalated_at IS NULL",
        )
        .bind(order.doctor_id)
        .bind(order.id)
        .bind(order.tenant_id)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        escalated += 1;
    }

    Ok(escalated)
}
