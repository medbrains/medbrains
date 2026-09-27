//! `create_patient` asks the same registration rules the web form and both
//! native apps ask (`medbrains-clinical-core::registration`), so a request
//! the form would refuse is refused here in the same words — whoever sent it.

use medbrains_clinical_core::registration::{Draft, registration_problems};
use medbrains_server_core::validation::ValidationErrors;

const ALLERGY_STATUS: &str = "attributes.allergy_status";
/// What an API caller that never asked has honestly recorded.
const NOT_ASKED: &str = "not_asked_yet";

/// The request as the rules read it: nested objects as dotted ids
/// (`address.city`), toggles as `"true"`/`"false"`. Lists are not checked.
fn draft_of(body: &serde_json::Value) -> Draft {
    fn walk(prefix: &str, v: &serde_json::Value, out: &mut Draft) {
        let key = |k: &str| {
            if prefix.is_empty() {
                k.to_owned()
            } else {
                format!("{prefix}.{k}")
            }
        };
        match v {
            serde_json::Value::Object(m) => m.iter().for_each(|(k, x)| walk(&key(k), x, out)),
            serde_json::Value::String(s) => {
                out.insert(prefix.to_owned(), s.clone());
            }
            serde_json::Value::Bool(b) => {
                out.insert(prefix.to_owned(), b.to_string());
            }
            serde_json::Value::Number(n) => {
                out.insert(prefix.to_owned(), n.to_string());
            }
            serde_json::Value::Null | serde_json::Value::Array(_) => {}
        }
    }
    let mut draft = Draft::new();
    walk("", body, &mut draft);
    // A caller that did not ask about allergies records exactly that.
    draft
        .entry(ALLERGY_STATUS.to_owned())
        .or_insert_with(|| NOT_ASKED.to_owned());
    draft
}

/// Adds every rule the request breaks to `errors`.
pub(crate) fn check(body: &serde_json::Value, errors: &mut ValidationErrors) {
    for p in registration_problems(&draft_of(body)) {
        errors.add(&p.field, p.message);
    }
}

#[cfg(test)]
mod tests {
    use super::{check, draft_of};
    use medbrains_server_core::validation::ValidationErrors;
    use serde_json::json;

    #[test]
    fn nested_objects_become_dotted_ids() {
        let d = draft_of(
            &json!({ "address": { "city": "Kottur" }, "contact": { "email_opt_in": true } }),
        );
        assert_eq!(d.get("address.city").map(String::as_str), Some("Kottur"));
        assert_eq!(
            d.get("contact.email_opt_in").map(String::as_str),
            Some("true")
        );
        assert_eq!(
            d.get("attributes.allergy_status").map(String::as_str),
            Some("not_asked_yet")
        );
    }

    #[test]
    fn the_server_refuses_what_the_form_refuses() {
        let mut errors = ValidationErrors::new();
        check(
            &json!({ "first_name": "Asha", "phone": "9876543210", "gender": "female",
                     "date_of_birth": "1990-01-01", "is_medico_legal": true }),
            &mut errors,
        );
        assert!(errors.has_errors());
        let mut ok = ValidationErrors::new();
        check(
            &json!({ "first_name": "Asha", "last_name": "", "phone": "9876543210", "gender": "female",
                     "date_of_birth": "1990-01-01" }),
            &mut ok,
        );
        assert!(!ok.has_errors(), "a single name is a whole name");
    }
}
