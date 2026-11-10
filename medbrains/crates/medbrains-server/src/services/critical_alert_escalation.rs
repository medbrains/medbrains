//! Critical-value acknowledgment escalation (audit P0 #16, NABH/IPSG).
//!
//! A critical lab or radiology alert that nobody acknowledges within the
//! tenant's window (`lab`/`radiology`.`critical_ack_minutes`, default 15)
//! escalates by SMS, and repeats each window up to [`MAX_ROUNDS`] until
//! somebody acknowledges. Round 1 texts the first of the department on-call,
//! the ordering doctor's supervisor and the doctor who has a usable phone;
//! from round 2 the department head and the lab supervisors (`lab_seniors`)
//! or the radiologists are texted too.
//!
//! This used to fire once, and with no phone on file it marked the alert
//! escalated and only logged — so the screen showed an escalation nobody
//! received. Now a blocked escalation (no phone, or SMS not set up) is not
//! marked: the department head and the lab supervisors get an in-app alert
//! saying it could not be sent, and the pass tries again next window.

use std::sync::Arc;
use std::time::Duration;

use medbrains_core::secrets::SecretResolver;
use medbrains_outbox::handlers::twilio;
use medbrains_workflow::orchestration::default_pipelines::e164;
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;

const PASS_INTERVAL_SECS: u64 = 300;
const DEFAULT_ACK_WINDOW_MINUTES: i32 = 15;
/// Rounds of escalation a critical value gets before the pass stops.
const MAX_ROUNDS: i16 = 4;
/// People told of one blocked escalation, and phones texted for one round.
const SECOND_TIER_LIMIT: i64 = 20;
const NOT_SENT_TITLE: &str = "Critical value escalation not sent";

/// The two kinds of critical alert, which differ only in their tables and
/// words.
#[derive(Debug)]
pub struct Kind {
    table: &'static str,
    orders: &'static str,
    category: &'static str,
    aggregate: &'static str,
    /// SQL for the one-line summary of the value, over alias `ca`.
    summary_sql: &'static str,
    /// Access group whose permanent members are the second tier.
    group: &'static str,
    key: &'static str,
    action_url: &'static str,
    /// `AND ca.deleted_at IS NULL` where the table has the column.
    live_sql: &'static str,
}

pub const LAB: Kind = Kind {
    table: "lab_critical_alerts",
    orders: "lab_orders",
    category: "lab",
    aggregate: "lab_critical_alert",
    summary_sql: "'lab value ' || ca.parameter_name || ' = ' || ca.value",
    group: "lab_seniors",
    key: "critesc",
    action_url: "/lab",
    live_sql: "AND ca.deleted_at IS NULL",
};

pub const RADIOLOGY: Kind = Kind {
    table: "radiology_critical_alerts",
    orders: "radiology_orders",
    category: "radiology",
    aggregate: "radiology_critical_alert",
    summary_sql: "COALESCE(ca.modality, 'imaging') || ' finding: ' || ca.finding",
    group: "radiologists",
    key: "radcritesc",
    action_url: "/radiology",
    // radiology_critical_alerts has no soft-delete column.
    live_sql: "",
};

/// Run both escalation passes forever on the worker pool.
pub fn spawn(pool: PgPool, resolver: Arc<dyn SecretResolver>) {
    tokio::spawn(async move {
        loop {
            for kind in [&LAB, &RADIOLOGY] {
                match escalate(&pool, resolver.as_ref(), kind).await {
                    Ok(pass) if pass != EscalationPass::default() => tracing::warn!(
                        kind = kind.category,
                        escalated = pass.escalated,
                        blocked = pass.blocked,
                        failed = pass.failed,
                        "critical alerts escalated — unacknowledged"
                    ),
                    Ok(_) => {}
                    Err(error) => {
                        tracing::error!(kind = kind.category, %error, "critical escalation pass failed");
                    }
                }
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
    department_id: Option<Uuid>,
    summary: String,
    escalation_tier: i16,
    doctor_id: Option<Uuid>,
    doctor_phone: Option<String>,
    supervisor_id: Option<Uuid>,
    supervisor_phone: Option<String>,
}

/// What one pass did.
#[derive(Debug, Default, PartialEq, Eq)]
pub struct EscalationPass {
    pub escalated: u64,
    /// Nothing could be texted: not marked escalated, the heads told in-app.
    pub blocked: u64,
    /// The alert's transaction failed; logged, retried next pass.
    pub failed: u64,
}

/// Lab critical values. See [`escalate`].
pub async fn escalate_unacknowledged(
    pool: &PgPool,
    resolver: &dyn SecretResolver,
) -> Result<EscalationPass, AppError> {
    escalate(pool, resolver, &LAB).await
}

/// Radiology critical findings. See [`escalate`].
pub async fn escalate_radiology_unacknowledged(
    pool: &PgPool,
    resolver: &dyn SecretResolver,
) -> Result<EscalationPass, AppError> {
    escalate(pool, resolver, &RADIOLOGY).await
}

/// Escalate every alert of `kind` left unacknowledged past its window. One
/// transaction per alert; a failure is logged and never stops the others.
pub async fn escalate(
    pool: &PgPool,
    resolver: &dyn SecretResolver,
    kind: &Kind,
) -> Result<EscalationPass, AppError> {
    // notified_to is the ordering doctor recorded when the alert fired. The
    // window setting is read safely and clamped to 1-1440 minutes.
    // ponytail: a blocked alert is retried for a day; past that an SMS is no
    // longer the right tool and the open-alerts banner is what remains.
    let sql = format!(
        "SELECT ca.id, ca.tenant_id, ca.order_id, enc.department_id, \
                {summary} AS summary, ca.escalation_tier, \
                d.id AS doctor_id, d.phone AS doctor_phone, \
                s.id AS supervisor_id, s.phone AS supervisor_phone \
         FROM {table} ca \
         LEFT JOIN {orders} o ON o.id = ca.order_id \
         LEFT JOIN encounters enc ON enc.id = o.encounter_id \
         LEFT JOIN users d ON d.id = ca.notified_to \
         LEFT JOIN users s ON s.id = d.supervisor_id \
         LEFT JOIN tenant_settings ts \
           ON ts.tenant_id = ca.tenant_id AND ts.deleted_at IS NULL \
          AND ts.category = '{category}' AND ts.key = 'critical_ack_minutes' \
         WHERE ca.acknowledged_at IS NULL {live} \
           AND ca.escalation_tier < $2 \
           AND ca.created_at > now() - interval '24 hours' \
           AND COALESCE(ca.escalation_attempted_at, ca.created_at) < now() - make_interval( \
                 mins => LEAST(GREATEST(CASE WHEN (ts.value #>> '{{}}') ~ '^[0-9]{{1,4}}$' \
                          THEN (ts.value #>> '{{}}')::int ELSE $1 END, 1), 1440)) \
         ORDER BY COALESCE(ca.escalation_attempted_at, ca.created_at) \
         LIMIT 500",
        summary = kind.summary_sql,
        table = kind.table,
        orders = kind.orders,
        category = kind.category,
        live = kind.live_sql,
    );
    let overdue = sqlx::query_as::<_, OverdueAlert>(&sql)
        .bind(DEFAULT_ACK_WINDOW_MINUTES)
        .bind(MAX_ROUNDS)
        .fetch_all(pool)
        .await?;

    let sms_on = twilio::is_configured(resolver).await;
    let mut pass = EscalationPass::default();
    for alert in overdue {
        match escalate_in_tx(pool, kind, &alert, sms_on).await {
            Ok(true) => pass.escalated += 1,
            Ok(false) => pass.blocked += 1,
            Err(error) => {
                pass.failed += 1;
                tracing::error!(alert_id = %alert.id, kind = kind.category, %error, "critical escalation failed");
            }
        }
    }
    Ok(pass)
}

/// One alert's round in its own transaction. Returns whether it was texted.
async fn escalate_in_tx(
    pool: &PgPool,
    kind: &Kind,
    alert: &OverdueAlert,
    sms_on: bool,
) -> Result<bool, AppError> {
    let mut tx = pool.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &alert.tenant_id).await?;
    let sent = escalate_one(&mut tx, kind, alert, sms_on).await?;
    tx.commit().await?;
    Ok(sent)
}

/// The first candidate whose phone is usable: a number that fails E.164 is
/// no recipient, and must not hide the next one in line.
fn first_reachable(candidates: &[(Option<Uuid>, Option<&str>)]) -> Option<(Option<Uuid>, String)> {
    candidates
        .iter()
        .find_map(|(id, phone)| phone.and_then(e164).map(|p| (*id, p)))
}

/// One alert's round. Returns whether anything was texted.
async fn escalate_one(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    kind: &Kind,
    alert: &OverdueAlert,
    sms_on: bool,
) -> Result<bool, AppError> {
    let tier = alert.escalation_tier + 1;
    let on_call = super::on_call::current_on_call(tx, alert.tenant_id, alert.department_id).await?;
    let primary = first_reachable(&[
        (
            on_call.as_ref().and_then(|c| c.user_id),
            on_call.as_ref().map(|c| c.phone.as_str()),
        ),
        (alert.supervisor_id, alert.supervisor_phone.as_deref()),
        (alert.doctor_id, alert.doctor_phone.as_deref()),
    ]);
    let heads = second_tier(tx, kind, alert.tenant_id, alert.department_id).await?;

    let mut phones: Vec<String> = primary.iter().map(|(_, p)| p.clone()).collect();
    if tier >= 2 {
        phones.extend(
            heads
                .iter()
                .filter_map(|(_, p)| p.as_deref().and_then(e164)),
        );
    }
    phones.sort_unstable();
    phones.dedup();

    let blocked = if !sms_on {
        Some("Escalation not sent: SMS is not set up")
    } else if phones.is_empty() {
        Some(
            "Escalation not sent: no phone on file for the on-call doctor, the supervisor or the ordering doctor",
        )
    } else {
        None
    };
    if let Some(reason) = blocked {
        let head_ids: Vec<Uuid> = heads.iter().map(|(id, _)| *id).collect();
        tell_heads_not_sent(tx, kind, alert, (&head_ids, reason)).await?;
        sqlx::query(&format!(
            "UPDATE {} SET escalation_attempted_at = now(), escalation_blocked_reason = $3 \
              WHERE id = $1 AND tenant_id = $2",
            kind.table
        ))
        .bind(alert.id)
        .bind(alert.tenant_id)
        .bind(reason)
        .execute(&mut **tx)
        .await?;
        tracing::error!(alert_id = %alert.id, reason, "critical alert overdue and not escalated");
        return Ok(false);
    }

    let body = format!(
        "ESCALATION {tier}: unacknowledged critical {} (order {}). \
         Acknowledge in MedBrains immediately.",
        alert.summary, alert.order_id
    );
    for to in &phones {
        medbrains_outbox::queue::queue_in_tx(
            tx,
            medbrains_outbox::queue::OutboxRow {
                tenant_id: alert.tenant_id,
                aggregate_type: kind.aggregate,
                aggregate_id: Some(alert.id),
                event_type: "sms.cds_critical_interaction",
                payload: serde_json::json!({
                    "to": to, "alert_id": alert.id, "order_id": alert.order_id, "body": body,
                }),
                idempotency_key: Some(format!("{}:{}:t{tier}:{to}", kind.key, alert.id)),
            },
        )
        .await
        .map_err(|e| AppError::Internal(format!("failed to queue escalation: {e}")))?;
    }
    let primary_id = primary.and_then(|(id, _)| id);
    sqlx::query(&format!(
        "UPDATE {} \
            SET escalated_at = now(), escalation_attempted_at = now(), \
                escalated_to = COALESCE($1, escalated_to), escalation_tier = $4, \
                escalation_blocked_reason = NULL \
          WHERE id = $2 AND tenant_id = $3",
        kind.table
    ))
    .bind(primary_id.or_else(|| heads.first().map(|(id, _)| *id)))
    .bind(alert.id)
    .bind(alert.tenant_id)
    .bind(tier)
    .execute(&mut **tx)
    .await?;
    Ok(true)
}

/// The department head and the kind's supervisors (permanent members of its
/// access group), with their phone if any.
async fn second_tier(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    kind: &Kind,
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
              WHERE g.tenant_id = $1 AND g.code = $4 AND g.is_active = true \
                AND m.deleted_at IS NULL AND m.expires_at IS NULL \
           ) p \
           JOIN users u ON u.id = p.user_id AND u.is_active = true AND u.deleted_at IS NULL \
          LIMIT $3",
    )
    .bind(tenant_id)
    .bind(department_id)
    .bind(SECOND_TIER_LIMIT)
    .bind(kind.group)
    .fetch_all(&mut **tx)
    .await?)
}

/// Tell the department head and the supervisors, in-app and once, that a
/// critical value could not be escalated and why. With neither on file, the
/// administrators are told instead: somebody must hear it.
async fn tell_heads_not_sent(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    kind: &Kind,
    alert: &OverdueAlert,
    (heads, reason): (&[Uuid], &str),
) -> Result<(), AppError> {
    sqlx::query(
        "WITH told AS ( \
           SELECT unnest($4::uuid[]) AS id \
           UNION (SELECT u.id FROM users u \
                   WHERE cardinality($4::uuid[]) = 0 AND u.tenant_id = $1 AND u.is_active \
                     AND u.deleted_at IS NULL \
                     AND u.role::text IN ('hospital_admin', 'super_admin') LIMIT $5) \
         ) \
         INSERT INTO notifications \
           (tenant_id, user_id, kind, title, body, category, entity_type, entity_id, action_url) \
         SELECT $1, told.id, 'error', $6, $2, $7, $8, $3, $9 \
           FROM told \
          WHERE NOT EXISTS (SELECT 1 FROM notifications n \
                             WHERE n.tenant_id = $1 AND n.user_id = told.id \
                               AND n.entity_type = $8 AND n.entity_id = $3 \
                               AND n.title = $6)",
    )
    .bind(alert.tenant_id)
    .bind(format!(
        "Critical {} is unacknowledged. {reason}. Phone the treating clinician and record the call.",
        alert.summary
    ))
    .bind(alert.id)
    .bind(heads)
    .bind(SECOND_TIER_LIMIT)
    .bind(NOT_SENT_TITLE)
    .bind(kind.category)
    .bind(kind.aggregate)
    .bind(kind.action_url)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::first_reachable;
    use uuid::Uuid;

    #[test]
    fn an_unusable_number_does_not_hide_the_next_candidate() {
        let (on_call, doctor) = (Uuid::new_v4(), Uuid::new_v4());
        let got = first_reachable(&[
            (Some(on_call), Some("ext 42")),
            (Some(doctor), Some("98765 43210")),
        ]);
        assert_eq!(got, Some((Some(doctor), "+919876543210".to_owned())));
        assert_eq!(first_reachable(&[(None, None), (None, Some(""))]), None);
    }
}
