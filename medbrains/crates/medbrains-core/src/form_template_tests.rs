use serde_json::{Map, Value, json};

use super::{
    FieldKind, FormDefinition, FormFieldSpec, FormSectionSpec, PROCEDURE_CONSENT, built_in,
    check_answers, check_definition,
};

fn field(key: &str, kind: FieldKind, required: bool, options: &[&str]) -> FormFieldSpec {
    FormFieldSpec {
        key: key.to_owned(),
        label: key.replace('_', " "),
        kind,
        required,
        options: options.iter().map(|o| (*o).to_owned()).collect(),
        help: None,
    }
}

fn form(fields: Vec<FormFieldSpec>) -> FormDefinition {
    FormDefinition {
        sections: vec![FormSectionSpec {
            title: "Main".to_owned(),
            fields,
        }],
    }
}

fn answers(v: Value) -> Map<String, Value> {
    v.as_object().cloned().unwrap_or_default()
}

#[test]
fn a_draft_may_be_empty_but_a_published_form_asks_something() {
    let empty = FormDefinition::default();
    assert!(check_definition(&empty, false).is_ok());
    assert!(check_definition(&empty, true).is_err());
}

#[test]
fn keys_are_unique_and_machine_safe() {
    let dup = form(vec![
        field("allergy", FieldKind::Text, false, &[]),
        field("allergy", FieldKind::Text, false, &[]),
    ]);
    assert!(
        check_definition(&dup, true)
            .unwrap_err()
            .contains("share the key")
    );
    let bad = form(vec![field("Allergy Note", FieldKind::Text, false, &[])]);
    assert!(check_definition(&bad, true).is_err());
}

#[test]
fn a_choice_question_offers_two_different_choices() {
    let one = form(vec![field("side", FieldKind::Select, true, &["Left"])]);
    assert!(check_definition(&one, true).is_err());
    let same = form(vec![field(
        "side",
        FieldKind::Radio,
        true,
        &["Left", "Left"],
    )]);
    assert!(check_definition(&same, true).is_err());
    let ok = form(vec![field(
        "side",
        FieldKind::Radio,
        true,
        &["Left", "Right"],
    )]);
    assert!(check_definition(&ok, true).is_ok());
}

#[test]
fn a_required_question_left_blank_is_refused_by_name() {
    let def = form(vec![field("witness_name", FieldKind::Text, true, &[])]);
    let problems = check_answers(&def, &answers(json!({ "witness_name": "  " }))).unwrap_err();
    assert_eq!(problems["witness_name"], "witness name is required");
}

#[test]
fn answers_must_fit_the_question() {
    let def = form(vec![
        field("side", FieldKind::Select, false, &["Left", "Right"]),
        field("units", FieldKind::Number, false, &[]),
        field("on", FieldKind::Date, false, &[]),
        field("agrees", FieldKind::YesNo, false, &[]),
        field(
            "risks",
            FieldKind::Multiselect,
            false,
            &["Bleeding", "Infection"],
        ),
    ]);
    let wrong = answers(json!({
        "side": "Middle", "units": "two", "on": "16/10/2026", "agrees": "yes", "risks": ["Death"],
    }));
    assert_eq!(check_answers(&def, &wrong).unwrap_err().len(), 5);
    let right = answers(json!({
        "side": "Left", "units": 2, "on": "2026-10-16", "agrees": true, "risks": ["Bleeding"],
    }));
    assert_eq!(check_answers(&def, &right).map(|a| a.len()), Ok(5));
}

#[test]
fn an_answer_to_a_question_not_on_the_form_is_refused() {
    let def = form(vec![field("note", FieldKind::Text, false, &[])]);
    let problems = check_answers(&def, &answers(json!({ "doctor_id": "x" }))).unwrap_err();
    assert!(problems.contains_key("doctor_id"));
}

#[test]
fn the_built_in_consent_is_valid_and_asks_what_the_record_stores() {
    let (_, module, def) = built_in(PROCEDURE_CONSENT).expect("built in");
    assert_eq!(module, "opd");
    assert!(check_definition(&def, true).is_ok());
    let keys: Vec<&str> = def.fields().map(|f| f.key.as_str()).collect();
    assert!(keys.contains(&"risks_explained") && keys.contains(&"witness_name"));
    assert!(built_in("unknown").is_none());
}
