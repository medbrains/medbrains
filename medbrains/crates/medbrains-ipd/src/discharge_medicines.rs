//! The shape of `ipd_discharge_summaries.medications_on_discharge`.
//!
//! The list is the prescription behind discharge dispensing: the pharmacy
//! matches each Schedule H/H1 line to it by catalogue id
//! (`medbrains_pharmacy::discharge_rx`), and the discharge step bags it into a
//! pharmacy order. So every medicine is picked from the formulary and carries
//! its catalogue id; free text would match nothing, or the wrong drug.

use medbrains_server_core::error::AppError;
use serde::Deserialize;
use uuid::Uuid;

/// The most medicines one discharge summary lists.
const MAX_MEDICINES: usize = 50;

/// One medicine on the discharge summary.
#[derive(Debug, Deserialize)]
struct DischargeMedicine {
    catalog_item_id: Uuid,
    drug_name: String,
    quantity: Option<i32>,
}

/// Refuses a `medications_on_discharge` that is not a list of formulary
/// medicines, each with its catalogue id, a name and a positive quantity.
///
/// # Errors
/// `BadRequest` naming what is wrong, for the screen to show.
pub(crate) fn validate(value: Option<&serde_json::Value>) -> Result<(), AppError> {
    let Some(value) = value else {
        return Ok(());
    };
    let medicines: Vec<DischargeMedicine> =
        serde_json::from_value(value.clone()).map_err(|_| {
            AppError::BadRequest(
                "Pick each medicine on discharge from the formulary, with its quantity.".to_owned(),
            )
        })?;
    if medicines.len() > MAX_MEDICINES {
        return Err(AppError::BadRequest(format!(
            "A discharge summary lists at most {MAX_MEDICINES} medicines."
        )));
    }
    let bad = medicines
        .iter()
        .find(|m| m.drug_name.trim().is_empty() || m.quantity.is_some_and(|q| q <= 0));
    bad.map_or(Ok(()), |m| {
        Err(AppError::BadRequest(format!(
            "Medicine on discharge {}: give a name and a quantity above zero.",
            m.catalog_item_id
        )))
    })
}

#[cfg(test)]
mod tests {
    use super::validate;
    use serde_json::json;

    #[test]
    fn only_formulary_medicines_with_ids_are_kept() {
        let id = "51935e7a-9edc-4dd0-96ee-d110bf1bfe81";
        assert!(validate(None).is_ok());
        assert!(validate(Some(&json!([]))).is_ok());
        assert!(
            validate(Some(
                &json!([{ "catalog_item_id": id, "drug_name": "Amoxicillin", "quantity": 15 }])
            ))
            .is_ok()
        );
        // Free text, no catalogue id: refused.
        assert!(
            validate(Some(
                &json!([{ "drug_name": "Amoxicillin", "quantity": 15 }])
            ))
            .is_err()
        );
        assert!(validate(Some(&json!(["Amoxicillin 500mg TDS"]))).is_err());
        assert!(
            validate(Some(
                &json!([{ "catalog_item_id": id, "drug_name": " ", "quantity": 1 }])
            ))
            .is_err()
        );
        assert!(
            validate(Some(
                &json!([{ "catalog_item_id": id, "drug_name": "A", "quantity": 0 }])
            ))
            .is_err()
        );
    }
}
