//! An early-warning escalation nobody acknowledges goes further.
//!
//! When an open escalation passes its acknowledgement window, it climbs one
//! level and is told again, wider each time:
//!
//! * level 1 — everyone first told, again, and the duty doctor by SMS;
//! * level 2 — and the attending doctor's supervisor, by SMS too;
//! * level 3 and on — and the head of the department.
//!
//! After the hospital's last level it stays at the top and is told again
//! every window: an unanswered deteriorating patient never goes quiet. The
//! background pass in `medbrains-server` calls [`escalate_due`] every minute.

use chrono::{Duration, Utc};
use medbrains_clinical_scores::ews::EwsPolicy;
use sqlx::PgPool;
use uuid::Uuid;

use medbrains_server_core::error::AppError;

use crate::nurse_ews::{NewNotificationOwned, band_of, load_policy};
use crate::nurse_ews_escalate::headline;

type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

#[derive(Debug, sqlx::FromRow)]
struct Due {
    id: Uuid,
    tenant_id: Uuid,
    level: i32,
    band: String,
    ews_tool: String,
    ews_total: i32,
    incomplete: bool,
    notified_user_ids: Vec<Uuid>,
    department_id: Option<Uuid>,
    doctor_id: Option<Uuid>,
    patient_label: String,
}

/// Escalate every open escalation past its window. Returns how many moved.
///
/// # Errors
/// A database fault; escalations already moved in this pass stay moved.
pub async fn escalate_due(pool: &PgPool) -> Result<u64, AppError> {
    let due = sqlx::query_as::<_, Due>(
        "SELECT x.id, x.tenant_id, x.level, x.band, x.ews_tool, x.ews_total, x.incomplete, \
                x.notified_user_ids, a.department_id, \
                COALESCE(a.attending_doctor_id, a.admitting_doctor) AS doctor_id, \
                btrim(concat_ws(' ', p.first_name, p.last_name)) || ' (' || p.uhid || ')' \
                  AS patient_label \
           FROM ews_escalations x \
           JOIN admissions a ON a.id = x.admission_id \
           JOIN patients p ON p.id = x.patient_id \
          WHERE x.status = 'open' AND x.deleted_at IS NULL AND x.next_escalation_at <= now() \
          ORDER BY x.next_escalation_at \
          LIMIT 200",
    )
    .fetch_all(pool)
    .await?;
    let mut moved = 0u64;
    for d in due {
        let mut tx = pool.begin().await?;
        medbrains_db::pool::set_tenant_context(&mut tx, &d.tenant_id).await?;
        let policy = load_policy(&mut tx, d.tenant_id).await?;
        escalate_one(&mut tx, &d, &policy).await?;
        tx.commit().await?;
        moved += 1;
    }
    Ok(moved)
}

/// Who is told at `level`, and which of them by SMS (with their phone).
async fn tier(
    tx: &mut Tx<'_>,
    d: &Due,
    level: i32,
) -> Result<(Vec<Uuid>, Vec<(Uuid, String)>), AppError> {
    let mut inbox = d.notified_user_ids.clone();
    let mut sms = Vec::new();
    if let Some(c) =
        medbrains_notifications::on_call::current_on_call(tx, d.tenant_id, d.department_id).await?
    {
        inbox.extend(c.user_id);
        if let Some(u) = c.user_id {
            sms.push((u, c.phone));
        }
    }
    let wider: Vec<(Uuid, Option<String>)> = sqlx::query_as(
        "SELECT u.id, NULLIF(btrim(u.phone), '') FROM users u \
          WHERE u.tenant_id = $1 AND u.is_active AND ( \
                ($3 >= 2 AND u.id = (SELECT supervisor_id FROM users WHERE id = $2)) \
             OR ($3 >= 3 AND u.id IN (SELECT e.user_id FROM departments dp \
                                        JOIN employees e ON e.id = dp.head_employee_id \
                                       WHERE dp.id = $4)))",
    )
    .bind(d.tenant_id)
    .bind(d.doctor_id)
    .bind(level)
    .bind(d.department_id)
    .fetch_all(&mut **tx)
    .await?;
    for (u, phone) in wider {
        inbox.push(u);
        if let Some(p) = phone {
            sms.push((u, p));
        }
    }
    inbox.sort_unstable();
    inbox.dedup();
    sms.sort_unstable();
    sms.dedup_by_key(|(u, _)| *u);
    Ok((inbox, sms))
}

async fn escalate_one(tx: &mut Tx<'_>, d: &Due, policy: &EwsPolicy) -> Result<(), AppError> {
    let band = band_of(&d.band);
    let level = (d.level + 1).min(policy.max_escalation_levels);
    let (inbox, sms) = tier(tx, d, level).await?;
    let (kind, head) = headline(band, &d.ews_tool, d.ews_total, d.incomplete);
    let title = format!("Not yet acknowledged — {head}");
    let body = format!(
        "{} — no one has acknowledged this score. Escalation level {level}. Review now.",
        d.patient_label
    );
    for user_id in &inbox {
        let n = NewNotificationOwned {
            user_id: *user_id,
            kind,
            title: title.clone(),
            body: body.clone(),
            entity_id: d.id,
            action_url: format!("/care-view?tab=escalations&escalation={}", d.id),
        };
        medbrains_notifications::create_notification(tx, d.tenant_id, n.borrow()).await?;
    }
    for (user_id, phone) in &sms {
        medbrains_outbox::queue::queue_in_tx(
            tx,
            medbrains_outbox::queue::OutboxRow {
                tenant_id: d.tenant_id,
                aggregate_type: "ews_escalation",
                aggregate_id: Some(d.id),
                event_type: "sms.cds_critical_interaction",
                payload: serde_json::json!({
                    "to": phone,
                    "escalation_id": d.id,
                    "body": format!("ESCALATION: {head}, {}. Not acknowledged. Review now in MedBrains.",
                                    d.patient_label),
                }),
                // Keyed to the minute: a retried pass sends once, the next window sends again.
                idempotency_key: Some(format!("ewsesc:{}:{}:{user_id}", d.id, Utc::now().timestamp() / 60)),
            },
        )
        .await
        .map_err(|e| AppError::Internal(format!("failed to queue escalation SMS: {e}")))?;
    }
    let mut told = inbox;
    told.extend(d.notified_user_ids.iter().copied());
    told.sort_unstable();
    told.dedup();
    sqlx::query(
        "UPDATE ews_escalations SET level = $1, last_escalated_at = now(), \
                next_escalation_at = $2, notified_user_ids = $3 \
          WHERE id = $4 AND tenant_id = $5 AND status = 'open'",
    )
    .bind(level)
    .bind(Utc::now() + Duration::minutes(i64::from(policy.ack_minutes(band))))
    .bind(&told)
    .bind(d.id)
    .bind(d.tenant_id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}
