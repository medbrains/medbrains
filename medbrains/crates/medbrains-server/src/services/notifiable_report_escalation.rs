//! A notifiable-disease report not submitted in time is escalated.
//!
//! Each worklist row is due 24 hours after detection (a week for diseases the
//! list reports weekly). Past that, the detecting clinician and the people who
//! work the list -- hospital administrators, the infection control officer,
//! the MRD officer -- are told, once, and the row is marked escalated. The
//! TB notification gazette makes a late Ni-kshay notification an offence, so
//! an overdue row must not sit quietly on a tab nobody opened.

use std::time::Duration;

use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;
use crate::routes::notifications::{NewNotification, create_notification};

const PASS_INTERVAL_SECS: u64 = 1800; // 30 minutes
/// Rows escalated per pass; the rest wait for the next one.
const PASS_LIMIT: i64 = 500;
/// People told per hospital, beyond the detecting clinician.
const RECIPIENT_LIMIT: i64 = 50;
/// The roles that work the notifiable worklist.
const WORKLIST_ROLES: [&str; 3] = ["hospital_admin", "infection_control_officer", "mrd_officer"];

pub fn spawn(pool: PgPool) {
    tokio::spawn(async move {
        loop {
            match escalate_overdue(&pool).await {
                Ok(escalated) if escalated > 0 => {
                    tracing::warn!(escalated, "notifiable-disease reports escalated — overdue");
                }
                Ok(_) => {}
                Err(error) => tracing::error!(%error, "notifiable report escalation pass failed"),
            }
            tokio::time::sleep(Duration::from_secs(PASS_INTERVAL_SECS)).await;
        }
    });
}

#[derive(sqlx::FromRow)]
struct OverdueReport {
    id: Uuid,
    tenant_id: Uuid,
    disease_name: String,
    icd10_code: String,
    case_class: String,
    reporting_body: Option<String>,
    detected_by: Option<Uuid>,
}

/// One pass: escalate every pending report past its due time.
///
/// # Errors
/// A database fault.
pub async fn escalate_overdue(pool: &PgPool) -> Result<u64, AppError> {
    let overdue = sqlx::query_as::<_, OverdueReport>(
        "SELECT id, tenant_id, disease_name, icd10_code, case_class, reporting_body, detected_by \
           FROM notifiable_disease_reports \
          WHERE status = 'pending' AND escalated_at IS NULL \
            AND due_at IS NOT NULL AND due_at < now() \
          ORDER BY due_at LIMIT $1",
    )
    .bind(PASS_LIMIT)
    .fetch_all(pool)
    .await?;

    let mut escalated = 0u64;
    for report in overdue {
        let mut tx = pool.begin().await?;
        medbrains_db::pool::set_tenant_context(&mut tx, &report.tenant_id).await?;
        let mut recipients: Vec<Uuid> = sqlx::query_scalar(
            "SELECT id FROM users \
              WHERE tenant_id = $1 AND is_active AND deleted_at IS NULL \
                AND role::text = ANY($2) \
              ORDER BY id LIMIT $3",
        )
        .bind(report.tenant_id)
        .bind(&WORKLIST_ROLES[..])
        .bind(RECIPIENT_LIMIT)
        .fetch_all(&mut *tx)
        .await?;
        if let Some(clinician) = report.detected_by {
            if !recipients.contains(&clinician) {
                recipients.push(clinician);
            }
        }
        let form = if report.case_class == "confirmed" {
            "L"
        } else {
            "P"
        };
        let body = format!(
            "{} ({}) has not been reported to {} ({form}-form) within its deadline.",
            report.disease_name,
            report.icd10_code,
            report.reporting_body.as_deref().unwrap_or("IDSP"),
        );
        for user_id in recipients {
            create_notification(
                &mut tx,
                report.tenant_id,
                NewNotification {
                    user_id,
                    kind: "warning",
                    title: "Notifiable disease report overdue",
                    body: Some(&body),
                    category: Some("Notifiable Disease"),
                    entity_type: Some("notifiable_disease_reports"),
                    entity_id: Some(report.id),
                    action_url: Some("/clinical-kb#reports"),
                },
            )
            .await?;
        }
        sqlx::query(
            "UPDATE notifiable_disease_reports SET escalated_at = now() \
              WHERE id = $1 AND tenant_id = $2 AND escalated_at IS NULL",
        )
        .bind(report.id)
        .bind(report.tenant_id)
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        escalated += 1;
    }
    Ok(escalated)
}
