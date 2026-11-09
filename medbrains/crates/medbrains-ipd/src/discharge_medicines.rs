//! The shape of `ipd_discharge_summaries.medications_on_discharge`.
//!
//! The list is the prescription behind discharge dispensing: the pharmacy
//! matches each Schedule H/H1 line to it by catalogue id
//! (`medbrains_pharmacy::discharge_rx`), and the discharge step bags it into a
//! pharmacy order. So every medicine is picked from the formulary and carries
//! its catalogue id; free text would match nothing, or the wrong drug.
//!
//! The one exception is chosen, never inferred: a medicine the doctor marks
//! `buy_outside` names no catalogue item. It prints as "Buy from outside the
//! hospital" and is never bagged, dispensed or billed (owner, 2026-11-09).

use medbrains_server_core::error::AppError;
use serde::Deserialize;
use uuid::Uuid;

/// The most medicines one discharge summary lists.
const MAX_MEDICINES: usize = 50;

/// One medicine on the discharge summary.
#[derive(Debug, Deserialize)]
struct DischargeMedicine {
    catalog_item_id: Option<Uuid>,
    drug_name: String,
    quantity: Option<i32>,
    #[serde(default)]
    buy_outside: bool,
}

/// What a medicine with neither a catalogue item nor the buy-outside mark,
/// or with both, is told.
const PICK_OR_MARK: &str = "Pick each medicine on discharge from the formulary, with its \
                            quantity, or mark it buy outside.";

/// Refuses a `medications_on_discharge` that is not a list of formulary
/// medicines (each with its catalogue id) or medicines marked buy outside
/// (with none), each with a name and a positive quantity.
///
/// # Errors
/// `BadRequest` naming what is wrong, for the screen to show.
pub(crate) fn validate(value: Option<&serde_json::Value>) -> Result<(), AppError> {
    let Some(value) = value else {
        return Ok(());
    };
    let medicines: Vec<DischargeMedicine> = serde_json::from_value(value.clone())
        .map_err(|_| AppError::BadRequest(PICK_OR_MARK.to_owned()))?;
    if medicines.len() > MAX_MEDICINES {
        return Err(AppError::BadRequest(format!(
            "A discharge summary lists at most {MAX_MEDICINES} medicines."
        )));
    }
    if medicines
        .iter()
        .any(|m| m.buy_outside == m.catalog_item_id.is_some())
    {
        return Err(AppError::BadRequest(PICK_OR_MARK.to_owned()));
    }
    let bad = medicines
        .iter()
        .find(|m| m.drug_name.trim().is_empty() || m.quantity.is_some_and(|q| q <= 0));
    bad.map_or(Ok(()), |m| {
        Err(AppError::BadRequest(format!(
            "Medicine on discharge \"{}\": give a name and a quantity above zero.",
            m.drug_name.trim()
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

    #[test]
    fn a_medicine_marked_buy_outside_names_no_catalogue_item() {
        let id = "51935e7a-9edc-4dd0-96ee-d110bf1bfe81";
        let outside = json!([{ "drug_name": "Zincovit", "quantity": 10, "buy_outside": true }]);
        assert!(validate(Some(&outside)).is_ok());
        // Marked and mapped at once: which is it? Refused.
        let both = json!([{ "catalog_item_id": id, "drug_name": "Z", "quantity": 1,
                            "buy_outside": true }]);
        assert!(validate(Some(&both)).is_err());
        // The mark, with no name: refused.
        let nameless = json!([{ "drug_name": "  ", "quantity": 1, "buy_outside": true }]);
        assert!(validate(Some(&nameless)).is_err());
    }
}
