//! Notices — the pipelines that tell a person something happened.
//!
//! Each subscriber resolves its recipient from the record (never from the
//! payload: a phone number copied into an event is stale by the time the
//! outbox reads it), queues one outbox row per channel, and gives each row an
//! idempotency key so a redelivered event does not text anybody twice.
//!
//! Switching one off is the Integration Hub's per-event toggle, like every
//! other default pipeline. Report-ready messages additionally follow the
//! hospital's report delivery settings, which the lab screen already edits.

use serde_json::{Value, json};
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

use super::default_pipelines::{e164, enqueue, uuid_from_payload};

/// Escalate an incident at or above this severity by email.
const ESCALATED_SEVERITIES: &[&str] = &["major", "sentinel"];

/// The patient's dialable phone and email, either of which may be missing.
async fn patient_contact(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<(Option<String>, Option<String>), sqlx::Error> {
    let row: Option<(Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT phone, NULLIF(email, '') FROM patients WHERE id = $1 AND tenant_id = $2",
    )
    .bind(patient_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(row.map_or((None, None), |(phone, email)| {
        (phone.as_deref().and_then(e164), email)
    }))
}

/// Email addresses of active staff holding any of `roles`.
async fn staff_emails(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    roles: &[&str],
) -> Result<Vec<String>, sqlx::Error> {
    let roles: Vec<String> = roles.iter().map(|r| (*r).to_owned()).collect();
    sqlx::query_scalar(
        "SELECT email FROM users \
          WHERE tenant_id = $1 AND is_active = true AND role::text = ANY($2) \
            AND COALESCE(email, '') <> '' \
          ORDER BY email LIMIT 200",
    )
    .bind(tenant_id)
    .bind(&roles)
    .fetch_all(&mut **tx)
    .await
}

// ── Report ready → patient ─────────────────────────────────────────

/// Which channels the hospital lets a verified report go out on. Off unless
/// the hospital turned on automatic dispatch: a report sent to a patient is
/// not something to start doing silently on upgrade.
#[derive(Debug, Default, PartialEq, Eq)]
pub struct ReportChannels {
    pub sms: bool,
    pub whatsapp: bool,
    pub email: bool,
}

#[must_use]
pub fn report_channels(config: Option<&Value>) -> ReportChannels {
    let on = |key: &str| {
        config
            .and_then(|c| c.get(key))
            .and_then(Value::as_bool)
            .unwrap_or(false)
    };
    if !on("auto_dispatch") {
        return ReportChannels::default();
    }
    ReportChannels {
        sms: on("sms_enabled"),
        whatsapp: on("whatsapp_enabled"),
        email: on("email_enabled"),
    }
}

/// The two kinds of report, each with its own outbox event types.
#[derive(Debug, Clone, Copy)]
pub enum ReportKind {
    Lab,
    Radiology,
}

impl ReportKind {
    const fn noun(self) -> &'static str {
        match self {
            Self::Lab => "lab",
            Self::Radiology => "imaging",
        }
    }
    const fn events(self) -> (&'static str, &'static str, &'static str) {
        match self {
            Self::Lab => (
                "sms.lab_report_ready",
                "whatsapp.lab_report_ready",
                "email.lab_report",
            ),
            Self::Radiology => (
                "sms.radiology_report_ready",
                "whatsapp.radiology_report_ready",
                "email.radiology_report",
            ),
        }
    }
}

/// What the patient reads. No result values: a text message is not a place
/// for a diagnosis, and the portal is where they sign in to see it.
#[must_use]
pub fn report_ready_body(kind: ReportKind) -> String {
    format!(
        "Your {} report is ready. Sign in to the patient portal to view it, or collect it from the hospital.",
        kind.noun()
    )
}

async fn report_ready(
    pool: &PgPool,
    tenant_id: Uuid,
    payload: &Value,
    kind: ReportKind,
    id_key: &str,
) -> Result<(), sqlx::Error> {
    let (Some(record), Some(patient_id)) = (
        uuid_from_payload(payload, id_key),
        uuid_from_payload(payload, "patient_id"),
    ) else {
        return Ok(());
    };
    let mut tx = pool.begin().await?;
    let config: Option<Value> = sqlx::query_scalar(
        "SELECT value FROM tenant_settings \
          WHERE tenant_id = $1 AND category = 'lab' AND key = 'report_delivery_config' \
            AND deleted_at IS NULL LIMIT 1",
    )
    .bind(tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    let channels = report_channels(config.as_ref());
    if channels == ReportChannels::default() {
        return Ok(());
    }
    let (phone, email) = patient_contact(&mut tx, tenant_id, patient_id).await?;
    let body = report_ready_body(kind);
    let (sms, whatsapp, mail) = kind.events();
    let key = |channel: &str| Some(format!("report:{channel}:{record}"));
    if let Some(to) = phone.as_deref() {
        if channels.sms {
            let msg = json!({ "to": to, "body": body, "patient_id": patient_id });
            let _ = enqueue(
                &mut tx,
                tenant_id,
                "report",
                Some(record),
                sms,
                msg,
                key("sms"),
            )
            .await;
        }
        if channels.whatsapp {
            let msg = json!({
                "to": to, "patient_id": patient_id, "language": "en",
                "template_name": whatsapp.trim_start_matches("whatsapp."),
                "sms_fallback_body": body,
            });
            let _ = enqueue(
                &mut tx,
                tenant_id,
                "report",
                Some(record),
                whatsapp,
                msg,
                key("wa"),
            )
            .await;
        }
    }
    if let (true, Some(to)) = (channels.email, email) {
        let msg = json!({ "to": to, "subject": "Your report is ready", "text": body });
        let _ = enqueue(
            &mut tx,
            tenant_id,
            "report",
            Some(record),
            mail,
            msg,
            key("email"),
        )
        .await;
    }
    tx.commit().await
}

pub(super) async fn on_lab_result_verified(
    pool: &PgPool,
    tenant_id: Uuid,
    payload: &Value,
) -> Result<(), sqlx::Error> {
    report_ready(pool, tenant_id, payload, ReportKind::Lab, "order_id").await
}

pub(super) async fn on_radiology_report_verified(
    pool: &PgPool,
    tenant_id: Uuid,
    payload: &Value,
) -> Result<(), sqlx::Error> {
    report_ready(pool, tenant_id, payload, ReportKind::Radiology, "report_id").await
}

// ── Claim approved → patient ───────────────────────────────────────

#[must_use]
pub fn claim_approved_body(insurer: &str, amount: Option<&str>) -> String {
    let amount = amount.map(|a| format!(" for Rs {a}")).unwrap_or_default();
    format!(
        "{insurer} approved your insurance claim{amount}. The billing desk will tell you anything left to pay."
    )
}

pub(super) async fn on_billing_claim_approved(
    pool: &PgPool,
    tenant_id: Uuid,
    payload: &Value,
) -> Result<(), sqlx::Error> {
    let Some(claim_id) = uuid_from_payload(payload, "claim_id") else {
        return Ok(());
    };
    let mut tx = pool.begin().await?;
    let row: Option<(Uuid, String, Option<rust_decimal::Decimal>)> = sqlx::query_as(
        "SELECT patient_id, insurance_provider, approved_amount FROM insurance_claims \
          WHERE id = $1 AND tenant_id = $2",
    )
    .bind(claim_id)
    .bind(tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    let Some((patient_id, insurer, amount)) = row else {
        return Ok(());
    };
    let (Some(to), _) = patient_contact(&mut tx, tenant_id, patient_id).await? else {
        return Ok(());
    };
    let amount = amount.map(|a| a.round_dp(2).to_string());
    let body = claim_approved_body(&insurer, amount.as_deref());
    let msg = json!({ "to": to, "body": body, "claim_id": claim_id, "patient_id": patient_id });
    let key = Some(format!("claimok:{claim_id}"));
    let _ = enqueue(
        &mut tx,
        tenant_id,
        "insurance_claim",
        Some(claim_id),
        "sms.claim_approved",
        msg,
        key,
    )
    .await;
    tx.commit().await
}

// ── Prescription expiring → patient ────────────────────────────────

#[must_use]
pub fn prescription_expiring_body(valid_until: &str) -> String {
    format!(
        "Your prescription can be refilled until {valid_until}. After that, see your doctor for a new one."
    )
}

pub(super) async fn on_opd_prescription_expiring(
    pool: &PgPool,
    tenant_id: Uuid,
    payload: &Value,
) -> Result<(), sqlx::Error> {
    let (Some(rx), Some(patient_id), Some(until)) = (
        uuid_from_payload(payload, "prescription_id"),
        uuid_from_payload(payload, "patient_id"),
        payload.get("valid_until").and_then(Value::as_str),
    ) else {
        return Ok(());
    };
    let mut tx = pool.begin().await?;
    let (Some(to), _) = patient_contact(&mut tx, tenant_id, patient_id).await? else {
        return Ok(());
    };
    let msg = json!({ "to": to, "body": prescription_expiring_body(until), "prescription_id": rx });
    let key = Some(format!("rxexpiry:{rx}"));
    let _ = enqueue(
        &mut tx,
        tenant_id,
        "prescription",
        Some(rx),
        "sms.prescription_expiring",
        msg,
        key,
    )
    .await;
    tx.commit().await
}

// ── Low stock → pharmacists ────────────────────────────────────────

pub(super) async fn on_pharmacy_stock_low(
    pool: &PgPool,
    tenant_id: Uuid,
    payload: &Value,
) -> Result<(), sqlx::Error> {
    let Some(item) = uuid_from_payload(payload, "catalog_item_id") else {
        return Ok(());
    };
    let name = payload
        .get("drug_name")
        .and_then(Value::as_str)
        .unwrap_or("A drug");
    let on_hand = payload.get("on_hand").and_then(Value::as_i64).unwrap_or(0);
    let reorder = payload
        .get("reorder_level")
        .and_then(Value::as_i64)
        .unwrap_or(0);
    let subject = format!("Low stock: {name}");
    let text = format!("{name} is down to {on_hand} (reorder level {reorder}). Raise an indent.");
    let day = chrono::Utc::now().date_naive();
    let mut tx = pool.begin().await?;
    for to in staff_emails(&mut tx, tenant_id, &["pharmacist"]).await? {
        let msg = json!({ "to": to, "subject": subject, "text": text });
        let key = Some(format!("lowstock:{item}:{day}:{to}"));
        let _ = enqueue(
            &mut tx,
            tenant_id,
            "pharmacy_catalog",
            Some(item),
            "email.low_stock",
            msg,
            key,
        )
        .await;
    }
    tx.commit().await
}

// ── Serious incident → quality + administration ────────────────────

#[must_use]
pub fn is_escalated(severity: Option<&str>) -> bool {
    severity.is_some_and(|s| ESCALATED_SEVERITIES.contains(&s))
}

pub(super) async fn on_quality_incident_reported(
    pool: &PgPool,
    tenant_id: Uuid,
    payload: &Value,
) -> Result<(), sqlx::Error> {
    let severity = payload.get("severity").and_then(Value::as_str);
    let Some(incident) = uuid_from_payload(payload, "incident_id") else {
        return Ok(());
    };
    if !is_escalated(severity) {
        return Ok(());
    }
    let number = payload
        .get("incident_number")
        .and_then(Value::as_str)
        .unwrap_or("");
    let kind = payload
        .get("incident_type")
        .and_then(Value::as_str)
        .unwrap_or("incident");
    let subject = format!(
        "{} incident {number} reported",
        severity.unwrap_or_default()
    );
    let text = format!(
        "A {} {kind} incident ({number}) was reported. Review it in Quality → Incidents.",
        severity.unwrap_or_default()
    );
    let mut tx = pool.begin().await?;
    for to in staff_emails(&mut tx, tenant_id, &["quality_officer", "hospital_admin"]).await? {
        let msg = json!({ "to": to, "subject": subject, "text": text, "incident_id": incident });
        let key = Some(format!("incident:{incident}:{to}"));
        let _ = enqueue(
            &mut tx,
            tenant_id,
            "quality_incident",
            Some(incident),
            "email.incident_escalation",
            msg,
            key,
        )
        .await;
    }
    tx.commit().await
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{
        ReportChannels, ReportKind, claim_approved_body, is_escalated, report_channels,
        report_ready_body,
    };

    #[test]
    fn reports_go_out_only_when_the_hospital_turned_on_automatic_dispatch() {
        let manual = json!({ "auto_dispatch": false, "sms_enabled": true });
        assert_eq!(report_channels(Some(&manual)), ReportChannels::default());
        assert_eq!(report_channels(None), ReportChannels::default());
        let auto = json!({ "auto_dispatch": true, "sms_enabled": true, "email_enabled": true });
        assert_eq!(
            report_channels(Some(&auto)),
            ReportChannels {
                sms: true,
                whatsapp: false,
                email: true
            }
        );
    }

    #[test]
    fn a_report_message_carries_no_result() {
        let body = report_ready_body(ReportKind::Lab);
        assert!(body.contains("lab report is ready"));
        assert!(report_ready_body(ReportKind::Radiology).contains("imaging"));
    }

    #[test]
    fn only_major_and_sentinel_incidents_escalate() {
        assert!(is_escalated(Some("sentinel")));
        assert!(is_escalated(Some("major")));
        assert!(!is_escalated(Some("moderate")));
        assert!(!is_escalated(None));
    }

    #[test]
    fn a_claim_message_names_the_insurer_and_amount_when_known() {
        assert!(claim_approved_body("Star Health", Some("12000.00")).contains("Rs 12000.00"));
        assert!(!claim_approved_body("Star Health", None).contains("Rs"));
    }
}
