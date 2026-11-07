//! Critical-value acknowledgment escalation (audit P0 #16, NABH/IPSG).
//!
//! A critical lab or radiology alert that nobody acknowledges within the
//! tenant's window (`lab`/`radiology`.`critical_ack_minutes`, default 15)
//! escalates by SMS. Recipient priority: department on-call (duty roster) →
//! ordering doctor's supervisor → repeat to the doctor. A lab alert repeats
//! each window, adding the department head and the lab supervisors from the
//! second round; a radiology alert still escalates once. The outbox
//! idempotency key guards against double-sends.

use std::time::Duration;

use sqlx::PgPool;
use uuid::Uuid;

use medbrains_workflow::orchestration::default_pipelines::e164;

use crate::error::AppError;

const PASS_INTERVAL_SECS: u64 = 300;
const DEFAULT_ACK_WINDOW_MINUTES: i32 = 15;

/// Run both escalation passes forever on the worker pool.
pub fn spawn(pool: PgPool) {
    tokio::spawn(async move {
        loop {
            match escalate_unacknowledged(&pool).await {
                Ok(pass) if pass.escalated + pass.blocked > 0 => tracing::warn!(
                    escalated = pass.escalated,
                    blocked = pass.blocked,
                    "critical lab alerts escalated — unacknowledged"
                ),
                Ok(_) => {}
                Err(error) => tracing::error!(%error, "critical lab alert escalation pass failed"),
            }
            match escalate_radiology_unacknowledged(&pool).await {
                Ok(escalated) if escalated > 0 => {
                    tracing::warn!(
                        escalated,
                        "critical radiology alerts escalated — unacknowledged"
                    );
                }
                Ok(_) => {}
                Err(error) => {
                    tracing::error!(%error, "critical radiology alert escalation pass failed");
                }
            }
            tokio::time::sleep(Duration::from_secs(PASS_INTERVAL_SECS)).await;
        }
    });
}

/// Rounds of escalation a lab critical value gets before the pass stops.
const MAX_LAB_ROUNDS: i16 = 4;
/// People told of one blocked escalation, and phones texted for one round.
const SECOND_TIER_LIMIT: i64 = 20;

#[derive(sqlx::FromRow)]
struct OverdueAlert {
    id: Uuid,
    tenant_id: Uuid,
    order_id: Uuid,
    department_id: Option<Uuid>,
    parameter_name: String,
    value: String,
    escalation_tier: i16,
    doctor_id: Option<Uuid>,
    doctor_phone: Option<String>,
    supervisor_id: Option<Uuid>,
    supervisor_phone: Option<String>,
}

/// What one pass did with the overdue lab critical values.
#[derive(Debug, Default, PartialEq, Eq)]
pub struct LabEscalationPass {
    pub escalated: u64,
    /// No phone anywhere: not marked escalated, the heads told in-app.
    pub blocked: u64,
}

/// Escalate every lab critical value left unacknowledged past the window.
///
/// Tier 1 texts the on-call doctor, else the ordering doctor's supervisor,
/// else the doctor. From tier 2 the department head and the lab supervisors
/// (`lab_seniors`) are texted too, and it repeats each window up to
/// [`MAX_LAB_ROUNDS`] until somebody acknowledges.
///
/// This used to fire once, and with no phone on file it marked the alert
/// escalated and only logged — so the screen showed an escalation nobody
/// received. Now a blocked escalation is not marked: the department head and
/// the lab supervisor get an in-app alert saying it could not be sent.
pub async fn escalate_unacknowledged(pool: &PgPool) -> Result<LabEscalationPass, AppError> {
    // notified_to is the ordering doctor recorded when the alert fired.
    // ponytail: a blocked alert is retried for a day; past that an SMS is no
    // longer the right tool and the open-alerts banner is what remains.
    let overdue = sqlx::query_as::<_, OverdueAlert>(
        "SELECT ca.id, ca.tenant_id, ca.order_id, enc.department_id, \
                ca.parameter_name, ca.value, ca.escalation_tier, \
                d.id AS doctor_id, d.phone AS doctor_phone, \
                s.id AS supervisor_id, s.phone AS supervisor_phone \
         FROM lab_critical_alerts ca \
         LEFT JOIN lab_orders lo ON lo.id = ca.order_id \
         LEFT JOIN encounters enc ON enc.id = lo.encounter_id \
         LEFT JOIN users d ON d.id = ca.notified_to \
         LEFT JOIN users s ON s.id = d.supervisor_id \
         LEFT JOIN tenant_settings ts \
           ON ts.tenant_id = ca.tenant_id \
          AND ts.category = 'lab' AND ts.key = 'critical_ack_minutes' \
         WHERE ca.acknowledged_at IS NULL AND ca.deleted_at IS NULL \
           AND ca.escalation_tier < $2 \
           AND ca.created_at > now() - interval '24 hours' \
           AND COALESCE(ca.escalation_attempted_at, ca.created_at) < now() - make_interval( \
                 mins => COALESCE((ts.value #>> '{}')::int, $1)) \
         ORDER BY COALESCE(ca.escalation_attempted_at, ca.created_at) \
         LIMIT 500",
    )
    .bind(DEFAULT_ACK_WINDOW_MINUTES)
    .bind(MAX_LAB_ROUNDS)
    .fetch_all(pool)
    .await?;

    let mut pass = LabEscalationPass::default();
    for alert in overdue {
        let mut tx = pool.begin().await?;
        medbrains_db::pool::set_tenant_context(&mut tx, &alert.tenant_id).await?;
        let sent = escalate_one(&mut tx, &alert).await?;
        tx.commit().await?;
        if sent {
            pass.escalated += 1;
        } else {
            pass.blocked += 1;
        }
    }
    Ok(pass)
}

/// One alert's round. Returns whether anything was texted.
async fn escalate_one(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    alert: &OverdueAlert,
) -> Result<bool, AppError> {
    let tier = alert.escalation_tier + 1;
    let has_phone = |phone: &Option<String>| phone.as_deref().is_some_and(|v| !v.trim().is_empty());
    let on_call = super::on_call::current_on_call(tx, alert.tenant_id, alert.department_id).await?;
    let (primary_id, primary_phone) = if let Some(contact) = on_call {
        (contact.user_id, Some(contact.phone))
    } else if has_phone(&alert.supervisor_phone) {
        (alert.supervisor_id, alert.supervisor_phone.clone())
    } else {
        (alert.doctor_id, alert.doctor_phone.clone())
    };
    let heads = second_tier(tx, alert.tenant_id, alert.department_id).await?;

    let mut phones: Vec<String> = primary_phone.iter().filter_map(|p| e164(p)).collect();
    if tier >= 2 {
        phones.extend(
            heads
                .iter()
                .filter_map(|(_, p)| p.as_deref().and_then(e164)),
        );
    }
    phones.sort_unstable();
    phones.dedup();

    if phones.is_empty() {
        let head_ids: Vec<Uuid> = heads.iter().map(|(id, _)| *id).collect();
        tell_heads_not_sent(tx, alert, &head_ids).await?;
        sqlx::query(
            "UPDATE lab_critical_alerts SET escalation_attempted_at = now(), \
                    escalation_blocked_reason = $3 \
              WHERE id = $1 AND tenant_id = $2",
        )
        .bind(alert.id)
        .bind(alert.tenant_id)
        .bind("Escalation not sent: no phone on file for the on-call doctor, the supervisor or the ordering doctor")
        .execute(&mut **tx)
        .await?;
        tracing::error!(alert_id = %alert.id, "critical alert overdue and no phone to escalate to");
        return Ok(false);
    }

    let body = format!(
        "ESCALATION {tier}: unacknowledged critical lab value {} = {} (order {}). \
         Acknowledge in MedBrains immediately.",
        alert.parameter_name, alert.value, alert.order_id
    );
    for to in &phones {
        medbrains_outbox::queue::queue_in_tx(
            tx,
            medbrains_outbox::queue::OutboxRow {
                tenant_id: alert.tenant_id,
                aggregate_type: "lab_critical_alert",
                aggregate_id: Some(alert.id),
                event_type: "sms.cds_critical_interaction",
                payload: serde_json::json!({
                    "to": to, "alert_id": alert.id, "order_id": alert.order_id, "body": body,
                }),
                idempotency_key: Some(format!("critesc:{}:t{tier}:{to}", alert.id)),
            },
        )
        .await
        .map_err(|e| AppError::Internal(format!("failed to queue escalation: {e}")))?;
    }
    sqlx::query(
        "UPDATE lab_critical_alerts \
            SET escalated_at = now(), escalation_attempted_at = now(), \
                escalated_to = COALESCE($1, escalated_to), escalation_tier = $4, \
                escalation_blocked_reason = NULL \
          WHERE id = $2 AND tenant_id = $3",
    )
    .bind(primary_id.or_else(|| heads.first().map(|(id, _)| *id)))
    .bind(alert.id)
    .bind(alert.tenant_id)
    .bind(tier)
    .execute(&mut **tx)
    .await?;
    Ok(true)
}

/// The department head and the lab supervisors (permanent `lab_seniors`
/// members), with their phone if any.
async fn second_tier(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    department_id: Option<Uuid>,
) -> Result<Vec<(Uuid, Option<String>)>, AppError> {
    Ok(sqlx::query_as(
        "SELECT p.user_id, COALESCE(NULLIF(u.phone, ''), NULLIF(p.phone, '')) \
           FROM ( \
             SELECT e.user_id, e.phone FROM departments d \
               JOIN employees e ON e.id = d.head_employee_id AND e.tenant_id = d.tenant_id \
              WHERE d.tenant_id = $1 AND d.id = $2 AND e.user_id IS NOT NULL \
             UNION \
             SELECT m.user_id, NULL FROM access_group_members m \
               JOIN access_groups g ON g.id = m.group_id \
              WHERE g.tenant_id = $1 AND g.code = 'lab_seniors' AND g.is_active = true \
                AND m.deleted_at IS NULL AND m.expires_at IS NULL \
           ) p \
           JOIN users u ON u.id = p.user_id AND u.is_active = true \
          LIMIT $3",
    )
    .bind(tenant_id)
    .bind(department_id)
    .bind(SECOND_TIER_LIMIT)
    .fetch_all(&mut **tx)
    .await?)
}

/// Tell the department head and the lab supervisors, in-app and once, that a
/// critical value could not be escalated. With neither on file, the
/// administrators are told instead: somebody must hear it.
async fn tell_heads_not_sent(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    alert: &OverdueAlert,
    heads: &[Uuid],
) -> Result<(), AppError> {
    sqlx::query(
        "WITH told AS ( \
           SELECT unnest($4::uuid[]) AS id \
           UNION (SELECT u.id FROM users u \
                   WHERE cardinality($4::uuid[]) = 0 AND u.tenant_id = $1 AND u.is_active \
                     AND u.role::text IN ('hospital_admin', 'super_admin') LIMIT $5) \
         ) \
         INSERT INTO notifications \
           (tenant_id, user_id, kind, title, body, category, entity_type, entity_id, action_url) \
         SELECT $1, told.id, 'error', 'Critical value escalation not sent', $2, 'lab', \
                'lab_critical_alert', $3, '/lab' \
           FROM told \
          WHERE NOT EXISTS (SELECT 1 FROM notifications n \
                             WHERE n.tenant_id = $1 AND n.user_id = told.id \
                               AND n.entity_type = 'lab_critical_alert' AND n.entity_id = $3 \
                               AND n.title = 'Critical value escalation not sent')",
    )
    .bind(alert.tenant_id)
    .bind(format!(
        "{} = {} is unacknowledged and the escalation could not be sent: no phone on file. \
         Phone the treating clinician and record the call.",
        alert.parameter_name, alert.value
    ))
    .bind(alert.id)
    .bind(heads)
    .bind(SECOND_TIER_LIMIT)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

#[derive(sqlx::FromRow)]
struct RadiologyOverdueAlert {
    id: Uuid,
    tenant_id: Uuid,
    order_id: Uuid,
    department_id: Option<Uuid>,
    finding: String,
    modality: Option<String>,
    doctor_id: Option<Uuid>,
    doctor_phone: Option<String>,
    supervisor_id: Option<Uuid>,
    supervisor_phone: Option<String>,
}

/// Radiology mirror of [`escalate_unacknowledged`]: a critical imaging finding the ordering
/// physician never acknowledges within the tenant's window escalates up the same on-call chain.
async fn escalate_radiology_unacknowledged(pool: &PgPool) -> Result<u64, AppError> {
    let overdue = sqlx::query_as::<_, RadiologyOverdueAlert>(
        "SELECT ca.id, ca.tenant_id, ca.order_id, enc.department_id, \
                ca.finding, ca.modality, \
                d.id AS doctor_id, d.phone AS doctor_phone, \
                s.id AS supervisor_id, s.phone AS supervisor_phone \
         FROM radiology_critical_alerts ca \
         LEFT JOIN radiology_orders ro ON ro.id = ca.order_id \
         LEFT JOIN encounters enc ON enc.id = ro.encounter_id \
         LEFT JOIN users d ON d.id = ca.notified_to \
         LEFT JOIN users s ON s.id = d.supervisor_id \
         LEFT JOIN tenant_settings ts \
           ON ts.tenant_id = ca.tenant_id \
          AND ts.category = 'radiology' AND ts.key = 'critical_ack_minutes' \
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
        let on_call =
            super::on_call::current_on_call(&mut tx, alert.tenant_id, alert.department_id).await?;
        let (recipient_id, recipient_phone) = if let Some(contact) = on_call {
            (contact.user_id, Some(contact.phone))
        } else if has_phone(&alert.supervisor_phone) {
            (alert.supervisor_id, alert.supervisor_phone.clone())
        } else {
            (alert.doctor_id, alert.doctor_phone.clone())
        };

        if let Some(phone) = recipient_phone.filter(|value| !value.trim().is_empty()) {
            let modality = alert.modality.as_deref().unwrap_or("imaging");
            medbrains_outbox::queue::queue_in_tx(
                &mut tx,
                medbrains_outbox::queue::OutboxRow {
                    tenant_id: alert.tenant_id,
                    aggregate_type: "radiology_critical_alert",
                    aggregate_id: Some(alert.id),
                    event_type: "sms.cds_critical_interaction",
                    payload: serde_json::json!({
                        "to": phone,
                        "alert_id": alert.id,
                        "order_id": alert.order_id,
                        "body": format!(
                            "ESCALATION: unacknowledged critical {modality} finding: {} \
                             (order {}). Acknowledge in MedBrains immediately.",
                            alert.finding, alert.order_id
                        ),
                    }),
                    idempotency_key: Some(format!("radcritesc:{}", alert.id)),
                },
            )
            .await
            .map_err(|e| {
                AppError::Internal(format!("failed to queue radiology escalation: {e}"))
            })?;
        } else {
            tracing::error!(
                alert_id = %alert.id, order_id = %alert.order_id,
                "critical radiology alert overdue but no phone on file for doctor or supervisor"
            );
        }

        sqlx::query(
            "UPDATE radiology_critical_alerts SET escalated_at = now(), escalated_to = $1 \
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
