//! The create-patient request a finished draft becomes, built once here so
//! the two native wizards only draw fields and send what this returns.
//!
//! Dotted ids become nested objects (`address.city` → `{"address":
//! {"city": …}}`), toggles become booleans, numbers numbers. Desk-only inputs
//! (`sent: false`) are not sent as themselves: an age becomes an estimated
//! date of birth. An unknown patient is named "Unknown Patient" and sexed
//! "unknown", as the web form does; "has no phone" sends an empty phone.

use serde_json::{Map, Value};

use super::catalogue::{Field, Kind};
use super::{Draft, estimated_date_of_birth, fields};

fn value<'a>(draft: &'a Draft, id: &str) -> &'a str {
    draft.get(id).map_or("", |v| v.trim())
}

fn typed(field: &Field, v: &str) -> Option<Value> {
    match field.kind {
        Kind::Toggle => Some(Value::Bool(v == "true")),
        Kind::Number => v.parse::<i64>().ok().map(Value::from),
        _ if v.is_empty() => None,
        _ => Some(Value::String(v.to_owned())),
    }
}

/// Puts `v` at the dotted path `id` inside `root`.
fn insert(root: &mut Map<String, Value>, id: &str, v: Value) {
    match id.split_once('.') {
        None => {
            root.insert(id.to_owned(), v);
        }
        Some((head, rest)) => {
            let child = root
                .entry(head.to_owned())
                .or_insert_with(|| Value::Object(Map::new()));
            if let Value::Object(m) = child {
                insert(m, rest, v);
            }
        }
    }
}

/// The request body for `POST /api/patients`, as JSON.
#[must_use]
pub fn registration_request(draft: &Draft, today_year: i32) -> Value {
    let mut body = Map::new();
    for field in fields().filter(|f| f.sent) {
        let v = value(draft, field.id);
        // A toggle the desk never touched is off, not absent.
        if field.kind != Kind::Toggle && v.is_empty() {
            continue;
        }
        if let Some(typed) = typed(field, v) {
            insert(&mut body, field.id, typed);
        }
    }
    let unknown = value(draft, "is_unknown_patient") == "true";
    if unknown {
        insert(&mut body, "first_name", Value::from("Unknown"));
        insert(&mut body, "last_name", Value::from("Patient"));
        insert(&mut body, "gender", Value::from("unknown"));
    }
    // The server's name field is not optional; a single name sends an empty one.
    body.entry("last_name").or_insert_with(|| Value::from(""));
    if unknown || value(draft, "attributes.has_no_phone") == "true" {
        insert(&mut body, "phone", Value::from(""));
    }
    body.entry("phone").or_insert_with(|| Value::from(""));
    if value(draft, "date_of_birth").is_empty() {
        if let Ok(age) = value(draft, "age_years").parse::<u32>() {
            insert(
                &mut body,
                "date_of_birth",
                Value::from(estimated_date_of_birth(age, today_year)),
            );
            insert(&mut body, "is_dob_estimated", Value::Bool(true));
        }
    }
    if value(draft, "attributes.allergy_status") == "no_known_allergies" {
        insert(
            &mut body,
            "attributes.no_known_allergies",
            Value::Bool(true),
        );
    }
    Value::Object(body)
}

#[cfg(test)]
mod tests {
    use super::registration_request;
    use crate::registration::tests_rules::draft;
    use serde_json::json;

    #[test]
    fn dotted_ids_nest_and_toggles_are_booleans() {
        let body = registration_request(
            &draft(&[
                ("first_name", "Asha"),
                ("address.city", "Kottur"),
                ("contact.whatsapp_opt_in", "true"),
                ("attributes.allergy_status", "no_known_allergies"),
            ]),
            2026,
        );
        assert_eq!(body["address"]["city"], "Kottur");
        assert_eq!(body["contact"]["whatsapp_opt_in"], true);
        assert_eq!(
            body["contact"]["email_opt_in"], false,
            "an untouched toggle is off"
        );
        assert_eq!(body["attributes"]["allergy_status"], "no_known_allergies");
        assert_eq!(
            body["attributes"]["no_known_allergies"], true,
            "the key the web also writes"
        );
    }

    #[test]
    fn an_age_becomes_an_estimated_birthday_and_is_not_sent() {
        let body =
            registration_request(&draft(&[("first_name", "Asha"), ("age_years", "36")]), 2026);
        assert_eq!(body["date_of_birth"], "1990-01-01");
        assert_eq!(body["is_dob_estimated"], true);
        assert!(body.get("age_years").is_none());
        assert!(body.get("create_opd_visit").is_none());
    }

    #[test]
    fn an_unknown_patient_and_a_patient_without_a_phone() {
        let body = registration_request(
            &draft(&[("is_unknown_patient", "true"), ("phone", "98765")]),
            2026,
        );
        assert_eq!(body["first_name"], "Unknown");
        assert_eq!(body["gender"], "unknown");
        assert_eq!(body["phone"], "");
        let body = registration_request(
            &draft(&[
                ("first_name", "Kamala"),
                ("attributes.has_no_phone", "true"),
            ]),
            2026,
        );
        assert_eq!(body["phone"], "");
        assert_eq!(
            body["last_name"], "",
            "a single name sends an empty last name"
        );
        assert_eq!(body["attributes"]["has_no_phone"], true);
    }

    #[test]
    fn numbers_are_numbers() {
        let body =
            registration_request(&draft(&[("attributes.attendant_passes_count", "2")]), 2026);
        assert_eq!(body["attributes"]["attendant_passes_count"], json!(2));
    }
}
