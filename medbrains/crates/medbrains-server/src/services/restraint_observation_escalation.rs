//! A restrained patient is observed every thirty minutes (MHCA 2017 s.97,
//! NABH). The ward recorded the checks; nothing noticed when one was missed.
//!
//! An open restraint episode is an unresolved `restraint` clinical document
//! whose latest check is not `released`. When thirty minutes pass with no
//! check, this pass tells the ward's on-call nurse and the clinician who
//! started the restraint. It alerts once per silent thirty minutes:
//! `overdue_alerted_at` restarts the clock, so a missed check is told again
//! half an hour later if still nobody has looked, never every pass.

use std::time::Duration;

use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;

const PASS_INTERVAL_SECS: u64 = 60;
const OBSERVATION_INTERVAL_MINS: i32 = 30;

pub fn spawn(pool: PgPool) {
    tokio::spawn(async move {
        loop {
            match escalate_missed_checks(&pool).await {
                Ok(alerted) if alerted > 0 => {
                    tracing::warn!(alerted, "restraint observations overdue — escalated");
                }
                Ok(_) => {}
                Err(error) => tracing::error!(%error, "restraint observation pass failed"),
            }
            tokio::time::sleep(Duration::from_secs(PASS_INTERVAL_SECS)).await;
        }
    });
}

#[derive(sqlx::FromRow)]
struct OverdueEpisode {
    id: Uuid,
    tenant_id: Uuid,
    admission_id: Uuid,
    recorded_by: Uuid,
    department_id: Option<Uuid>,
    minutes_since_check: i32,
    bed_number: Option<String>,
    ward_name: Option<String>,
}

async fn escalate_missed_checks(pool: &PgPool) -> Result<u64, AppError> {
    let overdue = sqlx::query_as::<_, OverdueEpisode>(
        "SELECT d.id, d.tenant_id, d.admission_id, d.recorded_by, a.department_id, \
                (EXTRACT(EPOCH FROM (now() - COALESCE(last.check_time, d.recorded_at))) / 60)::int \
                  AS minutes_since_check, \
                b.bed_number, w.name AS ward_name \
           FROM ipd_clinical_documentations d \
           JOIN admissions a ON a.id = d.admission_id AND a.tenant_id = d.tenant_id \
           LEFT JOIN LATERAL ( \
             SELECT r.check_time, r.status::text AS status \
               FROM restraint_monitoring_logs r \
              WHERE r.clinical_doc_id = d.id AND r.tenant_id = d.tenant_id \
                AND r.deleted_at IS NULL \
              ORDER BY r.check_time DESC LIMIT 1 \
           ) last ON true \
           LEFT JOIN beds b ON b.id = a.bed_id AND b.tenant_id = a.tenant_id \
           LEFT JOIN wards w ON w.id = a.ward_id AND w.tenant_id = a.tenant_id \
          WHERE d.doc_type = 'restraint'::ipd_clinical_doc_type \
            AND d.is_resolved = false AND d.deleted_at IS NULL \
            AND a.status = 'admitted'::admission_status AND a.deleted_at IS NULL \
            AND COALESCE(last.status, '') <> 'released' \
            AND GREATEST(COALESCE(last.check_time, d.recorded_at), \
                         COALESCE(d.overdue_alerted_at, d.recorded_at)) \
                < now() - make_interval(mins => $1) \
          ORDER BY d.recorded_at \
          LIMIT 500",
    )
    .bind(OBSERVATION_INTERVAL_MINS)
    .fetch_all(pool)
    .await?;

    let mut alerted = 0u64;
    for episode in overdue {
        let mut tx = pool.begin().await?;
        medbrains_db::pool::set_tenant_context(&mut tx, &episode.tenant_id).await?;

        let on_call =
            super::on_call::current_on_call(&mut tx, episode.tenant_id, episode.department_id)
                .await?
                .and_then(|contact| contact.user_id);
        let mut recipients = vec![episode.recorded_by];
        if let Some(nurse) = on_call.filter(|n| *n != episode.recorded_by) {
            recipients.push(nurse);
        }

        let where_it_is = match (episode.bed_number.as_deref(), episode.ward_name.as_deref()) {
            (Some(bed), Some(ward)) => format!("{ward}, bed {bed}"),
            (Some(bed), None) => format!("bed {bed}"),
            (None, Some(ward)) => ward.to_owned(),
            (None, None) => "an unassigned bed".to_owned(),
        };
        let body = format!(
            "The restrained patient in {where_it_is} has had no observation for {} minutes. \
             Check circulation, skin and response now and record it.",
            episode.minutes_since_check
        );
        let action_url = format!("/ipd/admissions/{}", episode.admission_id);

        for user_id in recipients {
            // A failed notification must not roll back the mark, or the pass
            // would retry every minute and bury the ward in the same message.
            let mut notify = sqlx::Connection::begin(&mut *tx).await?;
            let sent = sqlx::query(
                "INSERT INTO notifications \
                    (tenant_id, user_id, kind, title, body, category, \
                     entity_type, entity_id, action_url) \
                 VALUES ($1, $2, 'sla_breach', 'Restraint observation overdue', $3, \
                         'nursing', 'ipd_clinical_documentation', $4, $5)",
            )
            .bind(episode.tenant_id)
            .bind(user_id)
            .bind(&body)
            .bind(episode.id)
            .bind(&action_url)
            .execute(&mut *notify)
            .await;
            match sent {
                Ok(_) => notify.commit().await?,
                Err(error) => {
                    notify.rollback().await?;
                    tracing::error!(%error, episode = %episode.id, "restraint overdue notify failed");
                }
            }
        }

        sqlx::query(
            "UPDATE ipd_clinical_documentations SET overdue_alerted_at = now() \
              WHERE id = $1 AND tenant_id = $2",
        )
        .bind(episode.id)
        .bind(episode.tenant_id)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        alerted += 1;
    }

    Ok(alerted)
}
