//! A discharge summary as the prescription behind a Schedule H/H1 dispense.
//!
//! Discharge medicines carry no prescription row: the discharging doctor lists
//! them on the summary. The summary counts, line by line, only when all of
//! these hold — otherwise any holder of `dispensing.create` could attach an
//! old signed summary to an order for any H/H1 drug:
//!
//! - the order is a discharge dispense;
//! - the summary is this patient's (checked again when the order is created);
//! - it was finalized, or carries a signature, by someone with a doctor
//!   profile (finalizing needs only a permission a custom role may hold, so
//!   `finalized_by` is checked like the signer; a summary finalized before
//!   that column existed names nobody and counts for nothing);
//! - it is recent: the patient was discharged, or the summary finalized or
//!   signed, within `DISCHARGE_RX_DAYS`;
//! - the drug itself is listed in `medications_on_discharge`, matched on the
//!   catalogue item the stock leaves from, never on the line's free-text name,
//!   and every order on the summary together stays within the quantity listed
//!   (`schedule_gate`).

use medbrains_server_core::error::AppError;
use serde::Deserialize;
use uuid::Uuid;

/// How long a discharge summary backs Schedule H/H1 medicines.
pub const DISCHARGE_RX_DAYS: i32 = 7;

/// One medicine as `medications_on_discharge` lists it.
#[derive(Debug, Default, Deserialize)]
pub struct ListedMedicine {
    pub catalog_item_id: Option<Uuid>,
    pub drug_name: Option<String>,
    /// What the doctor listed: the cap across every order on the summary.
    pub quantity: Option<i32>,
}

/// Refuses a discharge summary that is not this patient's, when an order is
/// raised against it.
///
/// # Errors
/// `BadRequest` when the summary is missing, deleted, or another patient's.
pub async fn check_summary_patient(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    summary_id: Uuid,
    patient_id: Uuid,
) -> Result<(), AppError> {
    let theirs: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM ipd_discharge_summaries ds \
                          JOIN admissions a ON a.id = ds.admission_id AND a.tenant_id = ds.tenant_id \
                         WHERE ds.id = $1 AND ds.tenant_id = $2 AND ds.deleted_at IS NULL \
                           AND a.patient_id = $3)",
    )
    .bind(summary_id)
    .bind(tenant_id)
    .bind(patient_id)
    .fetch_one(&mut **tx)
    .await?;
    if theirs {
        Ok(())
    } else {
        Err(AppError::BadRequest(
            "That discharge summary does not belong to this patient.".to_owned(),
        ))
    }
}

/// The medicines a discharge summary prescribes for this order, or `None`
/// when the summary is not evidence for it (see the module comment).
///
/// # Errors
/// The database could not be read.
pub async fn discharge_medicines(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    order_id: Uuid,
) -> Result<Option<Vec<ListedMedicine>>, AppError> {
    let listed: Option<serde_json::Value> = sqlx::query_scalar(
        "SELECT ds.medications_on_discharge \
           FROM pharmacy_orders o \
           JOIN ipd_discharge_summaries ds ON ds.id = o.discharge_summary_id \
                AND ds.tenant_id = o.tenant_id AND ds.deleted_at IS NULL \
           JOIN admissions a ON a.id = ds.admission_id AND a.tenant_id = ds.tenant_id \
                AND a.patient_id = o.patient_id \
           LEFT JOIN signed_records sr ON sr.id = ds.signed_record_id \
                AND sr.tenant_id = ds.tenant_id AND sr.deleted_at IS NULL \
          WHERE o.id = $1 AND o.tenant_id = $2 \
            AND o.dispensing_type::text = 'discharge' \
            AND ((ds.status::text = 'finalized' \
                  AND EXISTS (SELECT 1 FROM doctor_profiles dp \
                               WHERE dp.user_id = ds.finalized_by AND dp.tenant_id = ds.tenant_id)) \
                 OR (ds.is_signed AND EXISTS (SELECT 1 FROM doctor_profiles dp \
                                               WHERE dp.user_id = sr.signer_user_id \
                                                 AND dp.tenant_id = ds.tenant_id))) \
            AND GREATEST(a.discharged_at, ds.finalized_at, sr.signed_at) \
                > now() - make_interval(days => $3)",
    )
    .bind(order_id)
    .bind(tenant_id)
    .bind(DISCHARGE_RX_DAYS)
    .fetch_optional(&mut **tx)
    .await?;
    // A list that does not parse lists nothing: no line is covered by it.
    Ok(listed.map(|value| serde_json::from_value(value).unwrap_or_default()))
}
