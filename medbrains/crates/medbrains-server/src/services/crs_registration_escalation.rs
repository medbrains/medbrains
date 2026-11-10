//! A birth or death not registered with CRS within 21 days is escalated.
//!
//! The RBD (Amendment) Act 2023 makes the hospital's in-charge the informant,
//! and the Registrar General has told hospitals that leaving it to families
//! is not compliance. Past the due date the MRD officers and hospital
//! administrators are told, once, and the event is marked escalated.

use std::time::Duration;

use chrono::NaiveDate;
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;
use crate::routes::notifications::{NewNotification, create_notification};

const PASS_INTERVAL_SECS: u64 = 3600; // hourly: the clock is in days
/// Events escalated per pass; the rest wait for the next one.
const PASS_LIMIT: i64 = 500;
/// People told per hospital.
const RECIPIENT_LIMIT: i64 = 50;
/// The roles that keep the hospital's statutory registers.
const REGISTER_ROLES: [&str; 2] = ["hospital_admin", "mrd_officer"];

pub fn spawn(pool: PgPool) {
    tokio::spawn(async move {
        loop {
            match escalate_overdue(&pool).await {
                Ok(escalated) if escalated > 0 => {
                    tracing::warn!(
                        escalated,
                        "births/deaths escalated — not registered with CRS"
                    );
                }
                Ok(_) => {}
                Err(error) => tracing::error!(%error, "CRS registration escalation pass failed"),
            }
            tokio::time::sleep(Duration::from_secs(PASS_INTERVAL_SECS)).await;
        }
    });
}

#[derive(sqlx::FromRow)]
struct OverdueEvent {
    id: Uuid,
    tenant_id: Uuid,
    event_type: String,
    event_date: NaiveDate,
}

fn overdue_message(e: &OverdueEvent) -> String {
    let what = if e.event_type == "birth" {
        "The birth"
    } else {
        "The death"
    };
    format!(
        "{what} of {} has not been registered with CRS within 21 days. \
         The hospital is the informant; report it on the CRS portal now.",
        e.event_date.format("%d/%m/%Y")
    )
}

/// One pass: escalate every pending event past its due date.
///
/// # Errors
/// A database fault.
pub async fn escalate_overdue(pool: &PgPool) -> Result<u64, AppError> {
    let overdue = sqlx::query_as::<_, OverdueEvent>(
        "SELECT id, tenant_id, event_type, event_date FROM crs_events \
          WHERE status = 'pending' AND escalated_at IS NULL AND deleted_at IS NULL \
            AND due_on < (now() AT TIME ZONE 'Asia/Kolkata')::date \
          ORDER BY due_on LIMIT $1",
    )
    .bind(PASS_LIMIT)
    .fetch_all(pool)
    .await?;

    let mut escalated = 0u64;
    for event in overdue {
        let mut tx = pool.begin().await?;
        medbrains_db::pool::set_tenant_context(&mut tx, &event.tenant_id).await?;
        let recipients: Vec<Uuid> = sqlx::query_scalar(
            "SELECT id FROM users \
              WHERE tenant_id = $1 AND is_active AND deleted_at IS NULL \
                AND role::text = ANY($2) \
              ORDER BY id LIMIT $3",
        )
        .bind(event.tenant_id)
        .bind(&REGISTER_ROLES[..])
        .bind(RECIPIENT_LIMIT)
        .fetch_all(&mut *tx)
        .await?;
        let body = overdue_message(&event);
        for user_id in recipients {
            create_notification(
                &mut tx,
                event.tenant_id,
                NewNotification {
                    user_id,
                    kind: "warning",
                    title: "Civil registration overdue",
                    body: Some(&body),
                    category: Some("Civil Registration"),
                    entity_type: Some("crs_events"),
                    entity_id: Some(event.id),
                    action_url: Some("/mrd#crs"),
                },
            )
            .await?;
        }
        sqlx::query(
            "UPDATE crs_events SET escalated_at = now() \
              WHERE id = $1 AND tenant_id = $2 AND escalated_at IS NULL",
        )
        .bind(event.id)
        .bind(event.tenant_id)
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        escalated += 1;
    }
    Ok(escalated)
}
