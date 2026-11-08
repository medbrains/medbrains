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
//!   catalogue item the stock leaves from, never on the line's free-text name.

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

/// Whether the summary lists the catalogue item an order line dispenses.
///
/// A listed medicine with a catalogue id matches that id only. One without
/// (written before the screen picked from the formulary) matches by name,
/// against the catalogue item's own names (`names`: name and generic name),
/// ignoring case. The order line's free-text name is never compared: a line
/// for Tramadol stock named "Paracetamol 500mg" must not pass as paracetamol.
pub fn lists(listed: &[ListedMedicine], catalog_item_id: Uuid, names: [&str; 2]) -> bool {
    let matches_name = |entry: &str| {
        let entry = entry.trim();
        !entry.is_empty() && names.iter().any(|n| n.trim().eq_ignore_ascii_case(entry))
    };
    listed.iter().any(|m| {
        m.catalog_item_id.map_or_else(
            || m.drug_name.as_deref().is_some_and(matches_name),
            |id| id == catalog_item_id,
        )
    })
}

#[cfg(test)]
mod tests {
    use super::{ListedMedicine, Uuid, lists};

    #[test]
    fn a_line_is_covered_only_by_its_own_listing() {
        let amox = Uuid::from_u128(1);
        let other = Uuid::from_u128(2);
        let listed = vec![ListedMedicine {
            catalog_item_id: Some(amox),
            drug_name: Some("Amoxicillin 500mg".into()),
        }];
        assert!(lists(&listed, amox, ["Anything", ""]));
        // A listing with an id matches that id only, whatever the names say.
        assert!(!lists(&listed, other, ["amoxicillin 500MG", ""]));
        // Tramadol stock on a line named after the listed paracetamol: the
        // caller passes the catalogue's names, and the id decides.
        let paracetamol = Uuid::from_u128(3);
        let tramadol = Uuid::from_u128(4);
        let para = vec![ListedMedicine {
            catalog_item_id: Some(paracetamol),
            drug_name: Some("Paracetamol 500mg".into()),
        }];
        assert!(!lists(&para, tramadol, ["Tramadol 50mg", "Tramadol"]));
        assert!(lists(
            &para,
            paracetamol,
            ["Paracetamol 500mg", "Paracetamol"]
        ));
        // No id on the listing: the catalogue's own names, never the line's.
        let by_name = vec![ListedMedicine {
            catalog_item_id: None,
            drug_name: Some("Paracetamol 500mg".into()),
        }];
        assert!(!lists(&by_name, tramadol, ["Tramadol 50mg", "Tramadol"]));
        assert!(lists(
            &by_name,
            paracetamol,
            ["PARACETAMOL 500MG", "Paracetamol"]
        ));
        assert!(!lists(&listed, other, ["Cefixime", "Cefixime 200"]));
        assert!(!lists(&[], amox, ["Amoxicillin 500mg", ""]));
        let unnamed = vec![ListedMedicine {
            catalog_item_id: None,
            drug_name: Some(" ".into()),
        }];
        assert!(!lists(&unnamed, other, ["", " "]));
    }
}
