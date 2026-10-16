//! Notifications that must leave the building: the statutory police
//! intimation of a medico-legal case, and the mass-casualty (Code Yellow)
//! alert to the people who have to respond.
//!
//! Both used to be recorded by hand and sent by nobody. They now go through
//! the outbox in the same transaction as the record, so the record and the
//! message stand or fall together, and the delivery status is read back from
//! the outbox rather than claimed by a client.

use medbrains_core::emergency::{MassCasualtyEvent, MlcPoliceIntimation};
use medbrains_outbox::queue::{OutboxRow, queue_in_tx};
use medbrains_server_core::error::AppError;
use medbrains_workflow::orchestration::default_pipelines::e164;
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// `tenant_settings` row holding the jurisdictional police contact:
/// `{ "station": "...", "phone": "+91...", "email": "..." }`.
pub const POLICE_CONTACT_CATEGORY: &str = "emergency";
pub const POLICE_CONTACT_KEY: &str = "police_contact";

pub const SMS_POLICE_INTIMATION: &str = "sms.mlc_police_intimation";
pub const EMAIL_POLICE_INTIMATION: &str = "email.mlc_police_intimation";
pub const SMS_MASS_CASUALTY_ALERT: &str = "sms.mass_casualty_alert";

const INTIMATION_AGGREGATE: &str = "mlc_police_intimation";
const MCI_AGGREGATE: &str = "mass_casualty_event";
/// In-app alert fan-out ceiling for one activation.
const MCI_IN_APP_LIMIT: i64 = 5000;
/// SMS fan-out ceiling: admins, blood bank and today's on-call roster.
// ponytail: whole-day on-call roster, not the shift window; the shift-window
// resolver lives in medbrains-server (services::on_call) — move it to a
// shared crate if a night roster pages the day team.
const MCI_SMS_LIMIT: i64 = 50;
/// Emergency duty doctors told of a new MLC.
const MLC_DUTY_LIMIT: i64 = 200;

#[derive(Debug, Default, Deserialize)]
struct PoliceContact {
    phone: Option<String>,
    email: Option<String>,
}

fn looks_like_email(value: &str) -> bool {
    let value = value.trim();
    value.contains('@') && !value.contains(' ') && value.len() > 3
}

/// One outbound message.
#[derive(Debug, PartialEq, Eq)]
struct Recipient {
    channel: &'static str,
    to: String,
}

/// The configured station contact plus the officer contact typed on the
/// intimation (another station's officer), deduplicated.
fn police_recipients(contact: &PoliceContact, officer_contact: Option<&str>) -> Vec<Recipient> {
    let mut out: Vec<Recipient> = Vec::new();
    let mut push = |channel: &'static str, to: String| {
        let candidate = Recipient { channel, to };
        if !out.contains(&candidate) {
            out.push(candidate);
        }
    };
    if let Some(phone) = contact.phone.as_deref().and_then(e164) {
        push(SMS_POLICE_INTIMATION, phone);
    }
    if let Some(email) = contact.email.as_deref().filter(|e| looks_like_email(e)) {
        push(EMAIL_POLICE_INTIMATION, email.trim().to_owned());
    }
    if let Some(officer) = officer_contact.map(str::trim).filter(|v| !v.is_empty()) {
        if looks_like_email(officer) {
            push(EMAIL_POLICE_INTIMATION, officer.to_owned());
        } else if let Some(phone) = e164(officer) {
            push(SMS_POLICE_INTIMATION, phone);
        }
    }
    out
}

#[derive(Debug, sqlx::FromRow)]
struct IntimationContext {
    hospital: String,
    mlc_number: String,
    case_type: Option<String>,
    registered_local: String,
    patient_name: String,
    patient_age: Option<i32>,
    patient_gender: String,
}

/// Queue the police intimation by SMS and email to the configured police
/// contact. Returns how many messages were queued — zero means no contact is
/// configured, which the screen says in words.
pub async fn queue_police_intimation(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    intimation: &MlcPoliceIntimation,
) -> Result<usize, AppError> {
    let contact = sqlx::query_scalar::<_, Value>(
        "SELECT value FROM tenant_settings \
          WHERE tenant_id = $1 AND category = $2 AND key = $3 AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(POLICE_CONTACT_CATEGORY)
    .bind(POLICE_CONTACT_KEY)
    .fetch_optional(&mut **tx)
    .await?
    .and_then(|v| serde_json::from_value::<PoliceContact>(v).ok())
    .unwrap_or_default();
    let recipients = police_recipients(&contact, intimation.officer_contact.as_deref());
    if recipients.is_empty() {
        return Ok(0);
    }
    let ctx = sqlx::query_as::<_, IntimationContext>(
        "SELECT t.name AS hospital, m.mlc_number, m.case_type, \
                to_char(m.registered_at AT TIME ZONE COALESCE(t.timezone, 'Asia/Kolkata'), \
                        'DD-Mon-YYYY HH24:MI') AS registered_local, \
                (p.first_name || ' ' || p.last_name) AS patient_name, \
                EXTRACT(YEAR FROM age(p.date_of_birth))::int AS patient_age, \
                p.gender::text AS patient_gender \
           FROM mlc_cases m \
           JOIN patients p ON p.id = m.patient_id AND p.tenant_id = m.tenant_id \
           JOIN tenants t ON t.id = m.tenant_id \
          WHERE m.id = $1 AND m.tenant_id = $2",
    )
    .bind(intimation.mlc_case_id)
    .bind(tenant_id)
    .fetch_one(&mut **tx)
    .await?;
    let age = ctx
        .patient_age
        .map_or_else(|| "age not recorded".to_owned(), |a| a.to_string());
    let body = format!(
        "{}: medico-legal intimation {} for MLC {} ({}), registered {}. Patient {}, {}/{}. \
         Quote {} when acknowledging.",
        ctx.hospital,
        intimation.intimation_number,
        ctx.mlc_number,
        ctx.case_type.as_deref().unwrap_or("medico-legal"),
        ctx.registered_local,
        ctx.patient_name,
        age,
        ctx.patient_gender,
        intimation.intimation_number,
    );
    for recipient in &recipients {
        let payload = if recipient.channel == SMS_POLICE_INTIMATION {
            json!({ "to": recipient.to, "body": body })
        } else {
            json!({
                "to": recipient.to,
                "subject": format!(
                    "Medico-legal intimation {} — {}",
                    intimation.intimation_number, ctx.hospital
                ),
                "text": body,
            })
        };
        queue_in_tx(
            tx,
            OutboxRow {
                tenant_id,
                aggregate_type: INTIMATION_AGGREGATE,
                aggregate_id: Some(intimation.id),
                event_type: recipient.channel,
                payload,
                idempotency_key: Some(format!("mlc_pi:{}:{}", intimation.id, recipient.to)),
            },
        )
        .await
        .map_err(|e| AppError::Internal(format!("failed to queue police intimation: {e}")))?;
    }
    Ok(recipients.len())
}

/// The intimation columns plus `delivery`, read back from the outbox.
pub const INTIMATION_WITH_DELIVERY: &str = "SELECT i.*, \
       COALESCE((SELECT jsonb_agg(jsonb_build_object( \
           'channel', split_part(o.event_type, '.', 1), \
           'to', o.payload->>'to', \
           'status', CASE WHEN o.status IN ('pending', 'retrying') THEN 'queued' \
                          WHEN o.status = 'sent' THEN 'sent' \
                          WHEN o.status = 'skipped_unconfigured' THEN 'not_configured' \
                          ELSE 'failed' END, \
           'last_error', o.last_error, \
           'sent_at', o.sent_at) ORDER BY o.created_at) \
          FROM outbox_events o \
         WHERE o.tenant_id = i.tenant_id AND o.aggregate_type = 'mlc_police_intimation' \
           AND o.aggregate_id = i.id AND o.deleted_at IS NULL), '[]'::jsonb) AS delivery \
     FROM mlc_police_intimations i";

pub async fn load_intimation(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    id: Uuid,
) -> Result<MlcPoliceIntimation, AppError> {
    Ok(sqlx::query_as::<_, MlcPoliceIntimation>(&format!(
        "{INTIMATION_WITH_DELIVERY} WHERE i.id = $1 AND i.tenant_id = $2"
    ))
    .bind(id)
    .bind(tenant_id)
    .fetch_one(&mut **tx)
    .await?)
}

/// Tell the emergency duty doctors that an MLC has been registered — the
/// police intimation and the examination are now due. In-app, through the
/// same `notifications` path as Code Blue / Code Yellow: doctors of the
/// Emergency department plus today's emergency on-call roster. Returns how
/// many were notified.
pub async fn notify_mlc_registered(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    mlc_case_id: Uuid,
    mlc_number: &str,
) -> Result<u64, AppError> {
    let notified = sqlx::query(
        "WITH er AS ( \
           SELECT id FROM departments \
            WHERE tenant_id = $1 AND code = 'EMERGENCY' AND deleted_at IS NULL \
         ), duty AS ( \
           SELECT u.id FROM users u \
            WHERE u.tenant_id = $1 AND u.is_active = true AND u.role::text = 'doctor' \
              AND (u.department_id IN (SELECT id FROM er) \
                   OR u.department_ids && ARRAY(SELECT id FROM er)) \
           UNION \
           SELECT e.user_id FROM duty_rosters dr \
             JOIN employees e ON e.id = dr.employee_id AND e.tenant_id = dr.tenant_id \
            WHERE dr.tenant_id = $1 AND dr.is_on_call = true AND dr.deleted_at IS NULL \
              AND dr.department_id IN (SELECT id FROM er) AND e.user_id IS NOT NULL \
              AND dr.roster_date = (now() AT TIME ZONE COALESCE( \
                    (SELECT timezone FROM tenants WHERE id = $1), 'Asia/Kolkata'))::date \
         ) \
         INSERT INTO notifications \
           (tenant_id, user_id, kind, title, body, category, entity_type, entity_id, action_url) \
         SELECT $1, duty.id, 'warning', 'New MLC registered', $2, 'emergency', 'mlc_case', $3, \
                '/emergency?tab=mlc' \
           FROM duty \
          WHERE NOT EXISTS (SELECT 1 FROM notifications n \
                             WHERE n.tenant_id = $1 AND n.user_id = duty.id \
                               AND n.entity_type = 'mlc_case' AND n.entity_id = $3) \
          LIMIT $4",
    )
    .bind(tenant_id)
    .bind(format!(
        "{mlc_number}: medico-legal case registered. Examine, record the injuries and send the \
         police intimation."
    ))
    .bind(mlc_case_id)
    .bind(MLC_DUTY_LIMIT)
    .execute(&mut **tx)
    .await?
    .rows_affected();
    if notified == 0 {
        // A case nobody was told about must not look like it was handled.
        tracing::warn!(%tenant_id, %mlc_case_id, "MLC registered but no emergency duty doctor found");
    }
    Ok(notified)
}

/// Alert everyone who must respond to a mass-casualty activation: an in-app
/// alert to doctors, nurses, administrators and blood bank; an SMS to
/// administrators, blood bank and today's on-call roster. Writes what was
/// sent to `notifications_sent` — server-recorded, never client-claimed.
pub async fn alert_mass_casualty(
    tx: &mut Transaction<'_, Postgres>,
    event: &MassCasualtyEvent,
) -> Result<MassCasualtyEvent, AppError> {
    let location = event.location.as_deref().unwrap_or("location not recorded");
    let body = format!(
        "CODE YELLOW — mass casualty: {} at {location}. Estimated casualties: {}. \
         Report to your disaster station.",
        event.event_name,
        event
            .estimated_casualties
            .map_or_else(|| "unknown".to_owned(), |n| n.to_string()),
    );
    let in_app = sqlx::query(
        "INSERT INTO notifications \
           (tenant_id, user_id, kind, title, body, category, entity_type, entity_id, action_url) \
         SELECT $1, u.id, 'error', 'CODE YELLOW', $2, 'emergency', 'mass_casualty_event', $3, \
                '/emergency?tab=mass-casualty' \
           FROM users u \
          WHERE u.tenant_id = $1 AND u.is_active = true \
            AND u.role::text IN ('doctor', 'nurse', 'hospital_admin', 'super_admin', \
                                 'blood_bank_tech') \
          LIMIT $4",
    )
    .bind(event.tenant_id)
    .bind(&body)
    .bind(event.id)
    .bind(MCI_IN_APP_LIMIT)
    .execute(&mut **tx)
    .await?
    .rows_affected();

    let phones = sqlx::query_scalar::<_, String>(
        "SELECT DISTINCT phone FROM ( \
           SELECT u.phone FROM users u \
            WHERE u.tenant_id = $1 AND u.is_active = true \
              AND u.role::text IN ('hospital_admin', 'blood_bank_tech') \
           UNION \
           SELECT COALESCE(NULLIF(u.phone, ''), e.phone) \
             FROM duty_rosters dr \
             JOIN employees e ON e.id = dr.employee_id AND e.tenant_id = dr.tenant_id \
             LEFT JOIN users u ON u.id = e.user_id \
            WHERE dr.tenant_id = $1 AND dr.is_on_call = true AND dr.deleted_at IS NULL \
              AND dr.roster_date = (now() AT TIME ZONE COALESCE( \
                    (SELECT timezone FROM tenants WHERE id = $1), 'Asia/Kolkata'))::date \
         ) p WHERE phone IS NOT NULL AND phone <> '' LIMIT $2",
    )
    .bind(event.tenant_id)
    .bind(MCI_SMS_LIMIT)
    .fetch_all(&mut **tx)
    .await?;
    let mut numbers: Vec<String> = phones.iter().filter_map(|p| e164(p)).collect();
    numbers.sort_unstable();
    numbers.dedup();
    for to in &numbers {
        queue_in_tx(
            tx,
            OutboxRow {
                tenant_id: event.tenant_id,
                aggregate_type: MCI_AGGREGATE,
                aggregate_id: Some(event.id),
                event_type: SMS_MASS_CASUALTY_ALERT,
                payload: json!({ "to": to, "body": body }),
                idempotency_key: Some(format!("mci:{}:{to}", event.id)),
            },
        )
        .await
        .map_err(|e| AppError::Internal(format!("failed to queue mass-casualty alert: {e}")))?;
    }
    let record = json!({
        "in_app_alerts": in_app,
        "sms_queued": numbers.len(),
        "unusable_phones": phones.len().saturating_sub(numbers.len()),
        "queued_at": chrono::Utc::now(),
    });
    Ok(sqlx::query_as::<_, MassCasualtyEvent>(
        "UPDATE mass_casualty_events SET notifications_sent = $3 \
          WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(event.id)
    .bind(event.tenant_id)
    .bind(record)
    .fetch_one(&mut **tx)
    .await?)
}

#[cfg(test)]
mod tests {
    use super::{EMAIL_POLICE_INTIMATION, PoliceContact, SMS_POLICE_INTIMATION, police_recipients};

    #[test]
    fn no_contact_means_nothing_is_sent() {
        assert!(police_recipients(&PoliceContact::default(), None).is_empty());
        assert!(police_recipients(&PoliceContact::default(), Some("SI Kumar")).is_empty());
    }

    #[test]
    fn station_and_officer_contacts_are_normalised_and_deduplicated() {
        let contact = PoliceContact {
            phone: Some("98765 43210".to_owned()),
            email: Some("ps@police.gov.in".to_owned()),
        };
        let out = police_recipients(&contact, Some("+91 9876543210"));
        assert_eq!(
            out.len(),
            2,
            "the officer's number is the station's: one SMS"
        );
        assert_eq!(out[0].channel, SMS_POLICE_INTIMATION);
        assert_eq!(out[0].to, "+919876543210");
        assert_eq!(out[1].channel, EMAIL_POLICE_INTIMATION);
    }
}
