//! The radiology order's side of the PACS (#226): put the order on the
//! modality worklist so the technologist picks the patient from a list
//! rather than typing them in, under the order's accession number — which
//! the modality writes into every image, and by which the study comes back.

use chrono::{DateTime, NaiveDate, Utc};
use medbrains_core::radiology::RadiologyOrder;
use medbrains_server_core::error::AppError;
use serde_json::{Value, json};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// The outbox event the worklist handler serves.
pub const WORKLIST_EVENT: &str = "pacs.worklist.create";

/// A DICOM person name: `Family^Given`.
#[must_use]
pub fn dicom_name(last: &str, first: &str) -> String {
    format!("{}^{}", last.trim(), first.trim())
}

/// DICOM sex code: M, F or O.
#[must_use]
pub fn dicom_sex(gender: &str) -> &'static str {
    match gender {
        "male" => "M",
        "female" => "F",
        _ => "O",
    }
}

/// Who and what the worklist entry describes.
pub struct WorklistEntry<'a> {
    pub accession: &'a str,
    pub uhid: &'a str,
    pub last_name: &'a str,
    pub first_name: &'a str,
    pub date_of_birth: Option<NaiveDate>,
    pub gender: &'a str,
    pub modality: &'a str,
    pub procedure: &'a str,
    pub scheduled: DateTime<Utc>,
}

/// The worklist item's DICOM tags, as Orthanc's worklists plugin takes them.
#[must_use]
pub fn worklist_tags(e: &WorklistEntry<'_>) -> Value {
    json!({
        "AccessionNumber": e.accession,
        "PatientID": e.uhid,
        "PatientName": dicom_name(e.last_name, e.first_name),
        "PatientBirthDate": e.date_of_birth.map(|d| d.format("%Y%m%d").to_string()).unwrap_or_default(),
        "PatientSex": dicom_sex(e.gender),
        "RequestedProcedureDescription": e.procedure,
        "ScheduledProcedureStepSequence": [{
            "Modality": e.modality,
            "ScheduledProcedureStepStartDate": e.scheduled.format("%Y%m%d").to_string(),
            "ScheduledProcedureStepStartTime": e.scheduled.format("%H%M%S").to_string(),
            "ScheduledProcedureStepDescription": e.procedure,
        }],
    })
}

/// Whether this hospital has a PACS address set.
pub async fn has_pacs(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
) -> Result<bool, AppError> {
    Ok(sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM tenant_settings \
          WHERE tenant_id = $1 AND category = 'radiology' AND key = 'pacs_config' \
            AND deleted_at IS NULL AND btrim(COALESCE(value->>'orthanc_url', '')) <> '')",
    )
    .bind(tenant_id)
    .fetch_one(&mut **tx)
    .await?)
}

#[derive(sqlx::FromRow)]
struct OrderFacts {
    uhid: String,
    first_name: String,
    last_name: String,
    date_of_birth: Option<NaiveDate>,
    gender: String,
    modality: String,
    procedure: String,
}

/// Queue the order onto the worklist, if the hospital has a PACS.
pub async fn queue_worklist(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    order: &RadiologyOrder,
) -> Result<(), AppError> {
    if !has_pacs(tx, tenant_id).await? {
        return Ok(());
    }
    let facts = sqlx::query_as::<_, OrderFacts>(
        "SELECT p.uhid, p.first_name, p.last_name, p.date_of_birth, p.gender::text AS gender, \
                m.code AS modality, \
                COALESCE(e.name, m.name || COALESCE(' — ' || o.body_part, '')) AS procedure \
           FROM radiology_orders o \
           JOIN patients p ON p.id = o.patient_id AND p.tenant_id = o.tenant_id \
           JOIN radiology_modalities m ON m.id = o.modality_id \
           LEFT JOIN radiology_exams e ON e.id = o.exam_id \
          WHERE o.id = $1 AND o.tenant_id = $2",
    )
    .bind(order.id)
    .bind(tenant_id)
    .fetch_one(&mut **tx)
    .await?;
    let tags = worklist_tags(&WorklistEntry {
        accession: &order.accession_number,
        uhid: &facts.uhid,
        last_name: &facts.last_name,
        first_name: &facts.first_name,
        date_of_birth: facts.date_of_birth,
        gender: &facts.gender,
        modality: &facts.modality,
        procedure: &facts.procedure,
        scheduled: order.scheduled_at.unwrap_or(order.created_at),
    });
    medbrains_outbox::queue_in_tx(
        tx,
        medbrains_outbox::queue::OutboxRow {
            tenant_id,
            aggregate_type: "radiology_order",
            aggregate_id: Some(order.id),
            event_type: WORKLIST_EVENT,
            // Where the PACS is, and how to sign in, the handler reads from the
            // hospital's settings when it sends — never carried in the event.
            payload: json!({ "tags": tags }),
            idempotency_key: Some(format!("mwl:{}", order.id)),
        },
    )
    .await
    .map_err(|e| AppError::Internal(format!("worklist queue: {e}")))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use chrono::{NaiveDate, TimeZone, Utc};

    use super::{WorklistEntry, dicom_name, dicom_sex, worklist_tags};

    #[test]
    fn names_and_sex_are_in_dicom_form() {
        assert_eq!(dicom_name(" Kumar ", "Ravi"), "Kumar^Ravi");
        assert_eq!(dicom_sex("female"), "F");
        assert_eq!(dicom_sex("transgender"), "O");
    }

    #[test]
    fn the_worklist_carries_the_accession_and_the_scheduled_step() {
        let tags = worklist_tags(&WorklistEntry {
            accession: "RA00000042",
            uhid: "UH-1",
            last_name: "Devi",
            first_name: "Lakshmi",
            date_of_birth: NaiveDate::from_ymd_opt(1980, 3, 9),
            gender: "female",
            modality: "CT",
            procedure: "CT head plain",
            scheduled: Utc
                .with_ymd_and_hms(2026, 10, 17, 9, 30, 0)
                .single()
                .unwrap_or_default(),
        });
        assert_eq!(tags["AccessionNumber"], "RA00000042");
        assert_eq!(tags["PatientBirthDate"], "19800309");
        let step = &tags["ScheduledProcedureStepSequence"][0];
        assert_eq!(step["Modality"], "CT");
        assert_eq!(step["ScheduledProcedureStepStartDate"], "20261017");
        assert_eq!(step["ScheduledProcedureStepStartTime"], "093000");
    }
}
