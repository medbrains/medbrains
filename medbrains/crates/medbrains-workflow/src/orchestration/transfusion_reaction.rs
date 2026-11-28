//! The transfusion-reaction pipeline: hold the donation's other components,
//! file the reaction on the quality register, and alert the blood bank.
//!
//! Registered in [`super::default_pipelines::PIPELINES`]; it lives here so the
//! registry file stays within the size ratchet.

use serde_json::{Value, json};
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

use super::default_pipelines::{enqueue, tenant_tx, uuid_from_payload};

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
///
/// All three steps share one transaction and every failure propagates, so the
/// dispatcher reports the event as failed and the outbox retries it. A
/// swallowed error here used to be worse than a skipped step: Postgres aborts
/// the transaction on the first failed statement, and `COMMIT` on an aborted
/// transaction rolls back without an error, so a failed alert silently undid
/// the quarantine and the incident while the event read as delivered (#6010).
pub(super) async fn on_transfusion_reaction(
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

    let mut tx = tenant_tx(pool, tenant_id).await?;

    // a) Hold every other component from the same donation. No component on
    //    the event means nothing to hold, which is a true zero.
    let quarantined = match component_id {
        Some(cid) => quarantine_siblings(&mut tx, tenant_id, cid).await?,
        None => 0,
    };

    // b) Raise an incident on the quality register.
    if let Some(rid) = reaction_id {
        let reaction = Reaction {
            id: rid,
            patient_id,
            kind: reaction_type,
            severity,
        };
        file_reaction_incident(&mut tx, tenant_id, &reaction, quarantined).await?;
    }

    // c) Tell the blood bank. A hold nobody is told about is a hold nobody
    //    investigates, and the units stay quarantined for ever.
    enqueue(
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
    .await
    .map_err(|e| sqlx::Error::Protocol(format!("blood bank reaction alert not queued: {e}")))?;

    tx.commit().await
}

/// The reaction as the incident register needs it.
struct Reaction<'a> {
    id: Uuid,
    patient_id: Option<Uuid>,
    kind: &'a str,
    severity: &'a str,
}

/// Quarantine the components that came from the same donation as `cid` and
/// return how many were held.
///
/// Only those still on the shelf: `issued`, `crossmatched` and `transfused`
/// have left the bank and are somebody else's problem to chase, while
/// `discarded` and `expired` are already out of circulation. Excluding the
/// implicated component itself keeps its own status truthful — it was
/// transfused, and rewriting that would lose what actually happened.
///
/// A failure is returned, never read as "0 held": a reaction whose siblings
/// were not held must be retried, not reported as having had none.
async fn quarantine_siblings(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    cid: Uuid,
) -> Result<i64, sqlx::Error> {
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
    .fetch_one(&mut **tx)
    .await
}

/// File the reaction on the quality register, once per reaction.
///
/// This wrote to `incident_reports` — a table with no rows, no handler and
/// no screen; the quality module's register is `quality_incidents`. The
/// reaction was therefore filed somewhere the quality team never looks.
///
/// The two vocabularies do not overlap: a transfusion reaction is
/// `mild`..`fatal`, an incident is `near_miss`..`sentinel`. Fatal
/// maps to `sentinel` because that is precisely what NABH means by one.
async fn file_reaction_incident(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    reaction: &Reaction<'_>,
    quarantined: i64,
) -> Result<(), sqlx::Error> {
    let Reaction {
        id: rid,
        patient_id,
        kind: reaction_type,
        severity,
    } = reaction;
    let incident_severity = match *severity {
        "mild" => "minor",
        "severe" => "major",
        "fatal" => "sentinel",
        _ => "moderate",
    };
    sqlx::query(
        "WITH seq AS ( \
           UPDATE sequences SET current_val = current_val + 1 \
            WHERE tenant_id = $1 AND seq_type = 'INC' \
           RETURNING prefix, current_val, pad_width \
         ) \
         INSERT INTO quality_incidents \
           (tenant_id, incident_number, title, description, incident_type, \
            severity, patient_id, immediate_action, incident_date) \
         SELECT $1, \
                COALESCE((SELECT prefix || lpad(current_val::text, GREATEST(pad_width, length(current_val::text)), '0') \
                            FROM seq), \
                         'INC-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || substr(md5(random()::text), 1, 4)), \
                $2, $3, 'transfusion_reaction', $4::text::incident_severity, \
                $5, $6, now() \
          WHERE NOT EXISTS ( \
            SELECT 1 FROM quality_incidents q \
             WHERE q.tenant_id = $1 AND q.incident_type = 'transfusion_reaction' \
               AND q.description = $3 AND q.deleted_at IS NULL)",
    )
    .bind(tenant_id)
    .bind(format!("Transfusion reaction — {reaction_type}"))
    .bind(format!(
        "Transfusion reaction reported ({reaction_type}, {severity}). Reaction {rid}."
    ))
    .bind(incident_severity)
    .bind(*patient_id)
    .bind(format!(
        "{quarantined} sibling component(s) from the same donation quarantined \
         automatically."
    ))
    .execute(&mut **tx)
    .await?;
    Ok(())
}
