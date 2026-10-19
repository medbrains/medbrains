//! Warns a patient before a prescription they can still refill runs out.
//!
//! `valid_until` was only ever checked at the counter, by which point the
//! patient has come in for a refill they can no longer have. Each pass finds
//! prescriptions with refills left that expire within `NOTICE_DAYS` and raises
//! `opd.prescription.expiring` once per prescription; the default pipeline
//! texts the patient, and a hospital switches it off in the Integration Hub.

use std::time::Duration;

use medbrains_core::clinical_events::{ClinicalEventEnvelope, ClinicalEventName};
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;

const PASS_INTERVAL_SECS: u64 = 3600;
/// How far ahead of expiry the patient is told.
pub const NOTICE_DAYS: i32 = 3;

pub fn spawn(pool: PgPool) {
    tokio::spawn(async move {
        loop {
            match scan_once(&pool).await {
                Ok(raised) if raised > 0 => {
                    tracing::info!(raised, "prescription expiry notices raised");
                }
                Ok(_) => {}
                Err(error) => tracing::error!(%error, "prescription expiry scan failed"),
            }
            tokio::time::sleep(Duration::from_secs(PASS_INTERVAL_SECS)).await;
        }
    });
}

#[derive(sqlx::FromRow)]
struct Expiring {
    id: Uuid,
    tenant_id: Uuid,
    doctor_id: Uuid,
    patient_id: Uuid,
    valid_until: chrono::NaiveDate,
}

/// One pass across every tenant. Returns how many notices it raised.
pub async fn scan_once(pool: &PgPool) -> Result<u64, AppError> {
    let due = sqlx::query_as::<_, Expiring>(
        "SELECT rx.id, rx.tenant_id, rx.doctor_id, \
                COALESCE(rx.patient_id, e.patient_id) AS patient_id, rx.valid_until \
           FROM prescriptions rx \
           JOIN encounters e ON e.id = rx.encounter_id AND e.tenant_id = rx.tenant_id \
          WHERE rx.deleted_at IS NULL AND rx.repeats_used < rx.repeats_allowed \
            AND rx.valid_until BETWEEN current_date AND current_date + $1 \
            AND NOT EXISTS (SELECT 1 FROM outbox_events o \
                 WHERE o.tenant_id = rx.tenant_id AND o.event_type = 'opd.prescription.expiring' \
                   AND o.aggregate_id = rx.id) \
          LIMIT 1000",
    )
    .bind(NOTICE_DAYS)
    .fetch_all(pool)
    .await?;

    let mut tx = pool.begin().await?;
    for rx in &due {
        let event = ClinicalEventEnvelope::new(
            rx.tenant_id,
            ClinicalEventName::OpdPrescriptionExpiring,
            rx.id,
            rx.doctor_id,
            serde_json::json!({
                "prescription_id": rx.id,
                "patient_id": rx.patient_id,
                "valid_until": rx.valid_until.to_string(),
            }),
        )
        .with_patient(rx.patient_id);
        medbrains_workflow::events::queue_clinical_event_in_tx(&mut tx, &event).await?;
    }
    tx.commit().await?;
    Ok(due.len() as u64)
}
