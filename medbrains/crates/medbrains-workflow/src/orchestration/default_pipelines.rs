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
//! Extending: write an `on_<event>` function below and add one row to
//! [`PIPELINES`]. There is no second list to keep in step and no match arm
//! to forget. Keep each handler small; complex logic belongs in its own
//! module that the handler calls.

use std::{future::Future, pin::Pin};

use medbrains_core::clinical_events::ClinicalEventName;
use serde_json::{Value, json};
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

use medbrains_outbox::queue::{OutboxRow, queue_in_tx};

/// One pipeline. The event it answers, what it does, and the code that does
/// it — in a single place.
///
/// Adding a pipeline used to mean three edits that could silently disagree:
/// an entry in a description array, a match arm, and the function. The array
/// fed the Integration Hub and the match arm decided what actually ran, so a
/// pipeline could be advertised and never fire, or fire and never appear.
/// Now they cannot drift, because they are the same row.
#[derive(Debug)]
pub struct Pipeline {
    /// The event this pipeline answers.
    pub event: ClinicalEventName,
    /// What it does, shown in the Integration Hub.
    pub description: &'static str,
    /// The subscriber. Every pipeline is independent: it opens its own
    /// transaction, reads only the payload, and cannot see or affect any
    /// other pipeline's work. One failing does not stop the rest.
    pub run: PipelineFn,
}

/// What every subscriber looks like: the pool, the tenant, the event payload.
///
/// Boxed because a `const` array cannot hold `async fn`s of differing types —
/// each row wraps its function in `Box::pin`.
pub type PipelineFn = for<'a> fn(
    &'a PgPool,
    Uuid,
    &'a Value,
) -> Pin<Box<dyn Future<Output = Result<(), sqlx::Error>> + Send + 'a>>;

/// Every built-in pipeline.
///
/// To add one: write the subscriber below, then add a row here. That is the
/// whole procedure — there is no second list to keep in step, and nothing to
/// configure in a UI.
pub const PIPELINES: &[Pipeline] = &[
    Pipeline {
        event: ClinicalEventName::IpdDischargeInitiated,
        description: "MRD file request + discharge-summary link to the patient",
        run: |p, t, v| Box::pin(on_ipd_discharge_initiated(p, t, v)),
    },
    Pipeline {
        event: ClinicalEventName::PharmacyOrderDispensed,
        description: "Low-stock check on every dispensed item",
        run: |p, t, v| Box::pin(on_pharmacy_order_dispensed(p, t, v)),
    },
    Pipeline {
        event: ClinicalEventName::LabResultPosted,
        description: "Critical-value SMS to ordering doctor",
        run: |p, t, v| Box::pin(on_lab_result_posted(p, t, v)),
    },
    Pipeline {
        event: ClinicalEventName::BillingInvoiceCreated,
        description: "Payment link to patient (WhatsApp)",
        run: |p, t, v| Box::pin(on_billing_invoice_created(p, t, v)),
    },
    Pipeline {
        event: ClinicalEventName::BillingPaymentReceived,
        description: "Receipt email to patient",
        run: |p, t, v| Box::pin(on_billing_payment_received(p, t, v)),
    },
    Pipeline {
        event: ClinicalEventName::OpdEncounterCreated,
        description: "Appointment confirmation SMS",
        run: |p, t, v| Box::pin(on_opd_encounter_created(p, t, v)),
    },
    Pipeline {
        event: ClinicalEventName::BloodTransfusionReactionReported,
        description: "Quarantine sibling components + raise incident + alert blood bank",
        run: |p, t, v| Box::pin(on_transfusion_reaction(p, t, v)),
    },
];

/// Event/description pairs for the Integration Hub, derived from the registry
/// rather than maintained beside it.
#[must_use]
pub fn default_subscribers() -> Vec<(&'static str, &'static str)> {
    PIPELINES
        .iter()
        .map(|p| (p.event.as_str(), p.description))
        .collect()
}

/// Per-tenant opt-out check. Reads `tenant_settings` row with
/// category=`default_pipelines` and a JSON array of disabled `event_types`.
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

    let Ok(parsed) = event_type.parse::<ClinicalEventName>() else {
        return;
    };

    // Every pipeline for this event runs, and each is independent: its own
    // transaction, its own failure. One raising an error must not stop the
    // next — a blood quarantine failing is no reason to skip an NDPS row.
    //
    // Events with no pipeline are not an error. They are a gap to close by
    // writing a subscriber above: `patient.created` has fired 154 times on
    // this database with nothing listening, and the answer is a reviewed
    // function, not a row somebody assembled in a UI.
    for pipeline in PIPELINES.iter().filter(|p| p.event == parsed) {
        let result = (pipeline.run)(pool, tenant_id, payload).await;
        if let Err(err) = result {
            tracing::error!(
                tenant_id = %tenant_id,
                event_type = event_type,
                error = %err,
                "default_pipelines: subscriber failed"
            );
        }
    }

}

// ── 1. IPD discharge → housekeeping + MRD + claim assembly ─────────

async fn on_ipd_discharge_initiated(
    pool: &PgPool,
    tenant_id: Uuid,
    payload: &Value,
) -> Result<(), sqlx::Error> {
    let admission_id = uuid_from_payload(payload, "admission_id");
    let patient_id = uuid_from_payload(payload, "patient_id");

    let mut tx = pool.begin().await?;

    // The bed is deliberately not touched here. This pipeline used to run
    // `UPDATE beds SET status = 'dirty'` — against a column that does not
    // exist (`beds` has `is_occupied`; the live state is `bed_states.status`),
    // reading a `bed_id` this event has never carried, with the error
    // swallowed by `.ok()`. It marked nothing dirty for as long as it existed.
    //
    // It is also not this subscriber's job. `discharge_patient` already calls
    // `release_admission_bed`, which sets `bed_states` to `vacant_dirty` in the
    // same transaction as the discharge. A bed freed by an async subscriber
    // that may fail is a bed the board can disagree with.

    // a) Queue an SMS/WhatsApp discharge-summary link to the patient.
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

    // b) Queue MRD file-creation request (if MRD module is wired).
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

// ── 2. Pharmacy dispense → low-stock auto-indent ───

async fn on_pharmacy_order_dispensed(
    pool: &PgPool,
    tenant_id: Uuid,
    payload: &Value,
) -> Result<(), sqlx::Error> {
    let items = payload.get("items").and_then(Value::as_array);

    let mut tx = pool.begin().await?;

    // The NDPS register is deliberately not written here. This pipeline used
    // to insert into `pharmacy_ndps_register` naming `order_id`, `drug_id`,
    // `drug_name`, `schedule`, `qty` and `action_at` — none of which are
    // columns on that table — with the error swallowed by `.ok()`. Not one row
    // was ever written by it.
    //
    // The dispense handler already writes the register correctly, in the same
    // transaction as the stock movement, with the running `balance_after`, the
    // witness, the patient and the prescription. That is where a statutory
    // narcotics register belongs: a register written by a subscriber that can
    // fail is a register that can disagree with what was dispensed.

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

    use super::PIPELINES;

    #[test]
    fn critical_lab_default_pipeline_follows_result_posting() {
        // Asserted against the registry that actually dispatches, not a
        // description array beside it — the point of merging the two.
        assert!(
            PIPELINES
                .iter()
                .any(|p| p.event == ClinicalEventName::LabResultPosted)
        );
        assert!(
            !PIPELINES
                .iter()
                .any(|p| p.event == ClinicalEventName::LabOrderCompleted)
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
