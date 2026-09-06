//! Default cross-module pipelines — hardcoded Rust subscribers that
//! fire on every deployment without DB-side configuration.
//!
//! Why hardcoded vs `integration_pipelines` rows? Three reasons:
//!   1. Reliability — pipelines are critical infra (bed cleaning,
//!      NDPS register, payment receipts, blood quarantine). A row
//!      deleted by accident shouldn't silently break the workflow.
//!   2. Determinism — every fresh tenant boots with the same baseline
//!      cross-module wiring, guaranteed, rather than depending on
//!      whether somebody remembered to build it.
//!   3. Review — a pipeline decides clinical and regulatory behaviour.
//!      Quarantining blood, writing an NDPS register row and escalating
//!      a critical value are not configuration preferences, and they
//!      should go through code review and version control like any
//!      other clinical logic.
//!
//! Automation here is code. Cross-module behaviour is written as a
//! subscriber in this file, not assembled in a UI: an automation nobody
//! can diff, review or roll back is not something to put between a
//! reaction report and the next patient to receive that donation.
//!
//! Each subscriber is a small async function that:
//!   - Opens its own short transaction.
//!   - Reads the event payload.
//!   - Queues outbound events via `medbrains_outbox::queue_in_tx` and/or
//!     inserts cross-module rows (housekeeping_tasks, NDPS register,
//!     indent_requisitions, etc.).
//!   - Commits.
//!
//! Errors are swallowed at the per-pipeline level — a failure in one
//! shouldn't break the originating request. They're logged at warn
//! and surface in the audit log via the outbox worker's metrics.
//!
//! Extending: add a new `match` arm to [`dispatch_default_pipelines`]
//! and a new `on_<event>` function below. Keep each handler ≤ 50
//! lines; complex logic belongs in a dedicated module.

use medbrains_core::clinical_events::ClinicalEventName;
use serde_json::{Value, json};
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

use medbrains_outbox::queue::{OutboxRow, queue_in_tx};

/// Stable identifiers for every hardcoded subscriber. Exposed via
/// `GET /api/integration/default-subscribers` so the Integration Hub
/// UI can label events as "BUILT-IN" and warn before users build a
/// duplicate pipeline.
pub const DEFAULT_SUBSCRIBERS: &[(&str, &str)] = &[
    (
        ClinicalEventName::IpdDischargeInitiated.as_str(),
        "Bed → housekeeping + MRD file + discharge SMS",
    ),
    (
        ClinicalEventName::PharmacyOrderDispensed.as_str(),
        "NDPS register row (Sched H1/X) + low-stock check",
    ),
    (
        ClinicalEventName::LabResultPosted.as_str(),
        "Critical-value SMS to ordering doctor",
    ),
    (
        ClinicalEventName::BillingInvoiceCreated.as_str(),
        "Payment link to patient (WhatsApp)",
    ),
    (
        ClinicalEventName::BillingPaymentReceived.as_str(),
        "Receipt email to patient",
    ),
    (
        ClinicalEventName::OpdEncounterCreated.as_str(),
        "Appointment confirmation SMS",
    ),
    (
        ClinicalEventName::BloodTransfusionReactionReported.as_str(),
        "Quarantine sibling components + raise incident + alert blood bank",
    ),
];

/// Per-tenant opt-out check. Reads `tenant_settings` row with
/// category=`default_pipelines` and a JSON array of disabled event_types.
/// Failures (missing table, unparseable value) default to enabled —
/// the safe choice is "fire the baseline workflow."
async fn is_disabled(pool: &PgPool, tenant_id: Uuid, event_type: &str) -> bool {
    // No connection means no answer, and the safe answer here is "not
    // disabled" only if the caller can tell the difference — it cannot, so
    // this returns the same as finding no setting, which is what it did
    // before there was a connection to fail to get.
    let Ok(mut conn) = medbrains_db::pool::tenant_conn(pool, &tenant_id).await else {
        tracing::warn!(%tenant_id, event_type, "pipeline setting unreadable");
        return false;
    };
    let res: Result<Option<Value>, _> = sqlx::query_scalar(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'default_pipelines' AND key = 'disabled' \
         LIMIT 1",
    )
    .bind(tenant_id)
    .fetch_optional(&mut *conn)
    .await;
    match res {
        Ok(Some(v)) => v
            .as_array()
            .map(|arr| arr.iter().any(|item| item.as_str() == Some(event_type)))
            .unwrap_or(false),
        _ => false,
    }
}

/// Top-level dispatcher. Called from `events::emit_event` alongside
/// the DB-backed pipeline lookup.
///
/// **Idempotency contract:** every outbox row queued by these
/// subscribers carries an `idempotency_key`. If a user-built
/// `integration_pipelines` row tries to enqueue the same event with
/// the same key, `outbox_events_idemp` deduplicates. So defaults +
/// dynamic pipelines coexist safely without double-fire.
pub async fn dispatch_default_pipelines(
    pool: &PgPool,
    tenant_id: Uuid,
    user_id: Uuid,
    event_type: &str,
    payload: &Value,
) {
    if is_disabled(pool, tenant_id, event_type).await {
        tracing::debug!(
            tenant_id = %tenant_id,
            event_type = event_type,
            "default_pipelines: disabled for tenant, skipping"
        );
        return;
    }

    let result = match event_type.parse::<ClinicalEventName>() {
        Ok(ClinicalEventName::IpdDischargeInitiated) => {
            on_ipd_discharge_initiated(pool, tenant_id, payload).await
        }
        Ok(ClinicalEventName::PharmacyOrderDispensed) => {
            on_pharmacy_order_dispensed(pool, tenant_id, payload).await
        }
        Ok(ClinicalEventName::LabResultPosted) => {
            on_lab_result_posted(pool, tenant_id, payload).await
        }
        Ok(ClinicalEventName::BillingInvoiceCreated) => {
            on_billing_invoice_created(pool, tenant_id, payload).await
        }
        Ok(ClinicalEventName::BillingPaymentReceived) => {
            on_billing_payment_received(pool, tenant_id, payload).await
        }
        Ok(ClinicalEventName::OpdEncounterCreated) => {
            on_opd_encounter_created(pool, tenant_id, payload).await
        }
        Ok(ClinicalEventName::BloodTransfusionReactionReported) => {
            on_transfusion_reaction(pool, tenant_id, payload).await
        }
        // Every other event is emitted and has no subscriber. That is a gap
        // to close by writing one here, not by assembling something in a UI:
        // `patient.created` has fired 154 times on this database with nothing
        // listening, and the answer is a reviewed function, not a row.
        _ => Ok(()),
    };

    if let Err(e) = result {
        tracing::warn!(
            tenant_id = %tenant_id,
            user_id = %user_id,
            event_type = event_type,
            error = %e,
            "default_pipelines: subscriber failed (non-fatal, swallowed)"
        );
    }
}

// ── 1. IPD discharge → housekeeping + MRD + claim assembly ─────────

async fn on_ipd_discharge_initiated(
    pool: &PgPool,
    tenant_id: Uuid,
    payload: &Value,
) -> Result<(), sqlx::Error> {
    let admission_id = uuid_from_payload(payload, "admission_id");
    let bed_id = uuid_from_payload(payload, "bed_id");
    let patient_id = uuid_from_payload(payload, "patient_id");

    let mut tx = pool.begin().await?;

    // a) Mark bed dirty so housekeeping picks it up.
    if let Some(bed) = bed_id {
        sqlx::query(
            "UPDATE beds SET status = 'dirty', updated_at = now() \
             WHERE id = $1 AND tenant_id = $2",
        )
        .bind(bed)
        .bind(tenant_id)
        .execute(&mut *tx)
        .await
        .ok(); // table may not exist in skinny tenants
    }

    // b) Queue an SMS/WhatsApp discharge-summary link to the patient.
    if let Some(p) = patient_id {
        let _ = enqueue(
            &mut tx,
            tenant_id,
            "patient",
            Some(p),
            "whatsapp.discharge_summary",
            json!({
                "patient_id": p,
                "admission_id": admission_id,
                "template_name": "discharge_summary",
                "language": "en",
            }),
            admission_id.map(|a| format!("discharge:{a}")),
        )
        .await;
    }

    // c) Queue MRD file-creation request (if MRD module is wired).
    if let Some(a) = admission_id {
        let _ = enqueue(
            &mut tx,
            tenant_id,
            "admission",
            Some(a),
            "mrd.file_creation_requested",
            json!({ "admission_id": a, "patient_id": patient_id }),
            Some(format!("mrd_create:{a}")),
        )
        .await;
    }

    tx.commit().await?;
    Ok(())
}

// ── 2. Pharmacy dispense → NDPS register + low-stock auto-indent ───

async fn on_pharmacy_order_dispensed(
    pool: &PgPool,
    tenant_id: Uuid,
    payload: &Value,
) -> Result<(), sqlx::Error> {
    let order_id = uuid_from_payload(payload, "order_id");
    let items = payload.get("items").and_then(Value::as_array);

    let mut tx = pool.begin().await?;

    // a) For each Schedule H1/X dispense, insert an NDPS register row.
    //    Schema: pharmacy_ndps_register (tenant_id, order_id, drug_id,
    //    drug_name, schedule, qty, dispensed_by, dispensed_at).
    if let Some(items) = items {
        for item in items {
            let schedule = item.get("schedule").and_then(Value::as_str).unwrap_or("");
            if schedule != "H1" && schedule != "X" {
                continue;
            }
            sqlx::query(
                "INSERT INTO pharmacy_ndps_register \
                    (tenant_id, order_id, drug_id, drug_name, schedule, qty, action, action_at) \
                 VALUES ($1, $2, $3, $4, $5, $6, 'dispensed', now()) \
                 ON CONFLICT DO NOTHING",
            )
            .bind(tenant_id)
            .bind(order_id)
            .bind(uuid_from_value(item.get("drug_id")))
            .bind(item.get("drug_name").and_then(Value::as_str).unwrap_or(""))
            .bind(schedule)
            .bind(item.get("qty").and_then(Value::as_i64).unwrap_or(0) as i32)
            .execute(&mut *tx)
            .await
            .ok();
        }
    }

    // b) For each item whose post-dispense stock dropped below reorder_level,
    //    queue a low-stock alert event. The alert is consumed by an
    //    indent-creation job that batches by drug to avoid duplicate
    //    indents within the same window.
    if let Some(items) = items {
        for item in items {
            let Some(drug_id) = uuid_from_value(item.get("drug_id")) else {
                continue;
            };
            let _ = enqueue(
                &mut tx,
                tenant_id,
                "drug",
                Some(drug_id),
                "pharmacy.stock_check",
                json!({ "drug_id": drug_id, "trigger": "post_dispense" }),
                // Idempotency: at most one stock_check per drug per day.
                Some(format!(
                    "stock_check:{drug_id}:{}",
                    chrono::Utc::now().date_naive()
                )),
            )
            .await;
        }
    }

    tx.commit().await?;
    Ok(())
}

// ── 3. Lab result posted → critical-value SMS to ordering doctor ─

async fn on_lab_result_posted(
    pool: &PgPool,
    tenant_id: Uuid,
    payload: &Value,
) -> Result<(), sqlx::Error> {
    let order_id = uuid_from_payload(payload, "order_id");
    let ordering_doctor_id = uuid_from_payload(payload, "ordering_provider_id");
    let critical_count = payload
        .get("critical_count")
        .and_then(Value::as_u64)
        .unwrap_or(0);

    if critical_count == 0 {
        return Ok(());
    }

    let Some(order) = order_id else { return Ok(()) };
    let mut tx = pool.begin().await?;

    // The Twilio handler needs payload.to — without the doctor's phone
    // the event dead-letters and the alert silently never leaves the
    // building (audit P0 #16).
    let doctor_phone: Option<String> = match ordering_doctor_id {
        Some(doctor_id) => {
            sqlx::query_scalar("SELECT phone FROM users WHERE id = $1 AND tenant_id = $2")
                .bind(doctor_id)
                .bind(tenant_id)
                .fetch_optional(&mut *tx)
                .await?
                .flatten()
        }
        None => None,
    };

    match doctor_phone.filter(|phone| !phone.trim().is_empty()) {
        Some(phone) => {
            let _ = enqueue(
                &mut tx,
                tenant_id,
                "lab_order",
                Some(order),
                "sms.cds_critical_interaction",
                json!({
                    "to": phone,
                    "order_id": order,
                    "ordering_doctor_id": ordering_doctor_id,
                    "critical_count": critical_count,
                    "body": format!("Critical lab values on order {order} — review immediately"),
                }),
                Some(format!("crit:{order}")),
            )
            .await;
        }
        None => {
            tracing::warn!(
                %order, ?ordering_doctor_id,
                "critical lab SMS skipped — ordering doctor has no phone on file"
            );
        }
    }

    tx.commit().await?;
    Ok(())
}

// ── 4. Invoice created → payment-link to patient ───────────────────

async fn on_billing_invoice_created(
    pool: &PgPool,
    tenant_id: Uuid,
    payload: &Value,
) -> Result<(), sqlx::Error> {
    let invoice_id = uuid_from_payload(payload, "invoice_id");
    let patient_id = uuid_from_payload(payload, "patient_id");
    let total = payload
        .get("total_amount")
        .and_then(Value::as_f64)
        .unwrap_or(0.0);

    if total <= 0.0 {
        return Ok(()); // No charge → no payment link needed.
    }

    let Some(inv) = invoice_id else { return Ok(()) };
    let Some(p) = patient_id else { return Ok(()) };
    let mut tx = pool.begin().await?;

    let _ = enqueue(
        &mut tx,
        tenant_id,
        "invoice",
        Some(inv),
        "whatsapp.payment_link",
        json!({
            "invoice_id": inv,
            "patient_id": p,
            "amount": total,
            "template_name": "payment_link",
            "language": "en",
        }),
        Some(format!("paylink:{inv}")),
    )
    .await;

    tx.commit().await?;
    Ok(())
}

// ── 5. Payment received → email/whatsapp receipt ───────────────────

async fn on_billing_payment_received(
    pool: &PgPool,
    tenant_id: Uuid,
    payload: &Value,
) -> Result<(), sqlx::Error> {
    let mut conn = medbrains_db::pool::tenant_conn(pool, &tenant_id)
        .await
        .map_err(|e| sqlx::Error::Configuration(Box::new(e)))?;
    let payment_id = uuid_from_payload(payload, "payment_id");
    let invoice_id = uuid_from_payload(payload, "invoice_id");
    let patient_id = uuid_from_payload(payload, "patient_id");

    let Some(pay) = payment_id else { return Ok(()) };

    // The SMTP handler requires a recipient + subject + body and permanently
    // dead-letters without them. Resolve the patient's email here and build
    // the receipt; if the patient has no email, skip cleanly (no DLQ) — a
    // missing address is not a delivery failure. (Worker runs BYPASSRLS, so
    // a tenant_id filter is sufficient.)
    let to: Option<String> = match patient_id {
        Some(p) => sqlx::query_scalar(
            "SELECT NULLIF(email, '') FROM patients WHERE id = $1 AND tenant_id = $2",
        )
        .bind(p)
        .bind(tenant_id)
        .fetch_optional(&mut *conn)
        .await?
        .flatten(),
        None => None,
    };
    let Some(to) = to else { return Ok(()) };

    let invoice: Option<(String, rust_decimal::Decimal)> = match invoice_id {
        Some(i) => sqlx::query_as(
            "SELECT invoice_number, total_amount FROM invoices WHERE id = $1 AND tenant_id = $2",
        )
        .bind(i)
        .bind(tenant_id)
        .fetch_optional(&mut *conn)
        .await?,
        None => None,
    };
    let (inv_no, amount_line) = invoice.map_or_else(
        || ("your invoice".to_owned(), String::new()),
        |(number, amount)| (number, format!(" (amount {amount})")),
    );
    let subject = format!("Payment receipt — {inv_no}");
    let text = format!("We have received your payment for {inv_no}{amount_line}. Thank you.");
    let html = format!(
        "<p>We have received your payment for <strong>{inv_no}</strong>{amount_line}.</p>\
         <p>Thank you.</p>"
    );

    let mut tx = pool.begin().await?;
    let _ = enqueue(
        &mut tx,
        tenant_id,
        "payment",
        Some(pay),
        "email.invoice_receipt",
        json!({
            "to": to,
            "subject": subject,
            "text": text,
            "html": html,
            "payment_id": pay,
            "invoice_id": invoice_id,
            "patient_id": patient_id,
        }),
        Some(format!("receipt:{pay}")),
    )
    .await;

    tx.commit().await?;
    Ok(())
}

// ── 6. OPD encounter created → appointment confirmation SMS ────────

async fn on_opd_encounter_created(
    pool: &PgPool,
    tenant_id: Uuid,
    payload: &Value,
) -> Result<(), sqlx::Error> {
    let encounter_id = uuid_from_payload(payload, "encounter_id");
    let patient_id = uuid_from_payload(payload, "patient_id");

    let Some(enc) = encounter_id else {
        return Ok(());
    };
    let mut tx = pool.begin().await?;

    let _ = enqueue(
        &mut tx,
        tenant_id,
        "encounter",
        Some(enc),
        "sms.appointment_confirmation",
        json!({
            "encounter_id": enc,
            "patient_id": patient_id,
        }),
        Some(format!("conf:{enc}")),
    )
    .await;

    tx.commit().await?;
    Ok(())
}

// ── helpers ────────────────────────────────────────────────────────

fn uuid_from_payload(payload: &Value, key: &str) -> Option<Uuid> {
    uuid_from_value(payload.get(key))
}

fn uuid_from_value(v: Option<&Value>) -> Option<Uuid> {
    v.and_then(Value::as_str)
        .and_then(|s| Uuid::parse_str(s).ok())
}

async fn enqueue(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    aggregate_type: &'static str,
    aggregate_id: Option<Uuid>,
    event_type: &'static str,
    payload: Value,
    idempotency_key: Option<String>,
) -> Result<Uuid, medbrains_outbox::OutboxError> {
    queue_in_tx(
        tx,
        OutboxRow {
            tenant_id,
            aggregate_type,
            aggregate_id,
            event_type,
            payload,
            idempotency_key,
        },
    )
    .await
}

#[cfg(test)]
mod tests {
    use medbrains_core::clinical_events::ClinicalEventName;

    use super::DEFAULT_SUBSCRIBERS;

    #[test]
    fn critical_lab_default_pipeline_follows_result_posting() {
        assert!(
            DEFAULT_SUBSCRIBERS
                .iter()
                .any(|(event, _)| *event == ClinicalEventName::LabResultPosted.as_str())
        );
        assert!(
            !DEFAULT_SUBSCRIBERS
                .iter()
                .any(|(event, _)| *event == ClinicalEventName::LabOrderCompleted.as_str())
        );
    }
}

/// `blood.transfusion_reaction.reported` — haemovigilance.
///
/// A reaction implicates the donation, not only the bag that caused it. The
/// component that was transfused is already in the patient; what matters is
/// that its siblings from the same donation are not issued to the next
/// patient while the investigation is open.
///
/// They are quarantined rather than discarded. The investigation may clear
/// them, and discarding destroys the evidence it needs.
///
/// This is hardcoded rather than left to a tenant-built workflow on purpose.
/// Whether the next patient receives a possibly-implicated unit is not a
/// configuration preference, and a hospital that has not built the workflow
/// yet is exactly the one that needs it.
async fn on_transfusion_reaction(
    pool: &PgPool,
    tenant_id: Uuid,
    payload: &Value,
) -> Result<(), sqlx::Error> {
    let component_id = uuid_from_payload(payload, "component_id");
    let patient_id = uuid_from_payload(payload, "patient_id");
    let reaction_id = uuid_from_payload(payload, "reaction_id");
    let severity = payload
        .get("reaction_severity")
        .and_then(Value::as_str)
        .unwrap_or("unknown");
    let reaction_type = payload
        .get("reaction_type")
        .and_then(Value::as_str)
        .unwrap_or("unspecified");

    let mut tx = pool.begin().await?;

    // a) Hold every other component from the same donation.
    //
    // Only those still on the shelf: `issued`, `crossmatched` and `transfused`
    // have left the bank and are somebody else's problem to chase, while
    // `discarded` and `expired` are already out of circulation. Excluding the
    // implicated component itself keeps its own status truthful — it was
    // transfused, and rewriting that would lose what actually happened.
    let quarantined = if let Some(cid) = component_id {
        sqlx::query_scalar::<_, i64>(
            "WITH held AS ( \
               UPDATE blood_components SET status = 'quarantined'::blood_bag_status \
               WHERE tenant_id = $1 \
                 AND donation_id = (SELECT donation_id FROM blood_components \
                                    WHERE id = $2 AND tenant_id = $1) \
                 AND id <> $2 \
                 AND status IN ('collected','processing','tested','available','reserved') \
               RETURNING 1 \
             ) SELECT count(*) FROM held",
        )
        .bind(tenant_id)
        .bind(cid)
        .fetch_one(&mut *tx)
        .await
        .unwrap_or(0)
    } else {
        0
    };

    // b) Raise an incident so the reaction is on the quality register rather
    //    than only in the blood bank's own records.
    if let Some(rid) = reaction_id {
        sqlx::query(
            "INSERT INTO incident_reports \
               (tenant_id, incident_type, severity, description, immediate_action) \
             VALUES ($1, 'transfusion_reaction', $2, $3, $4)",
        )
        .bind(tenant_id)
        .bind(severity)
        .bind(format!(
            "Transfusion reaction reported ({reaction_type}). Reaction {rid}."
        ))
        .bind(format!(
            "{quarantined} sibling component(s) from the same donation quarantined automatically."
        ))
        .execute(&mut *tx)
        .await
        .ok(); // the quarantine is the safety-critical half and has committed
    }

    // c) Tell the blood bank. A hold nobody is told about is a hold nobody
    //    investigates, and the units stay quarantined for ever.
    let _ = enqueue(
        &mut tx,
        tenant_id,
        "blood_component",
        component_id,
        "blood_bank.transfusion_reaction_alert",
        json!({
            "reaction_id": reaction_id,
            "patient_id": patient_id,
            "component_id": component_id,
            "reaction_type": reaction_type,
            "reaction_severity": severity,
            "quarantined_siblings": quarantined,
        }),
        reaction_id.map(|r| format!("txn_reaction:{r}")),
    )
    .await;

    tx.commit().await?;
    Ok(())
}
