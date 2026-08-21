//! Reading FHIR terminology responses.
//!
//! Kept separate from the HTTP client and free of any network dependency, so
//! every shape a server can return — including the awkward ones — is settled
//! by a test against a captured response rather than discovered against a live
//! endpoint.
//!
//! FHIR's `Parameters` resource is the awkward part. `$lookup` does not return
//! an object with fields; it returns a list of name/value pairs where the
//! value key varies by type (`valueString`, `valueCode`, `valueBoolean`) and
//! related concepts arrive as nested `part` arrays. Parsing it by hand is
//! error-prone in exactly the way a test catches and a type signature does
//! not.

use serde_json::Value;

use crate::error::SnomedError;
use crate::model::{Concept, Relationship};

/// The SNOMED CT code system URI. Fixed by the standard.
pub const SNOMED_SYSTEM: &str = "http://snomed.info/sct";

/// A concept from a `CodeSystem/$lookup` response.
///
/// # Errors
/// [`SnomedError::UnexpectedResponse`] when the payload is not a `Parameters`
/// resource, or carries no display name.
pub fn concept_from_lookup(code: &str, body: &Value) -> Result<Concept, SnomedError> {
    if let Some(outcome) = operation_outcome(body) {
        return Err(SnomedError::Server(outcome));
    }

    let parameters = body
        .get("parameter")
        .and_then(Value::as_array)
        .ok_or_else(|| {
            SnomedError::UnexpectedResponse(
                "a $lookup response must be a Parameters resource with a 'parameter' array"
                    .to_owned(),
            )
        })?;

    let display = named_string(parameters, "display").ok_or_else(|| {
        SnomedError::UnexpectedResponse(format!("$lookup for {code} returned no display name"))
    })?;

    Ok(Concept {
        code: code.to_owned(),
        display,
        // The semantic tag is not a first-class FHIR field; servers surface it
        // either as a property or inside the fully specified name.
        semantic_tag: property(parameters, "semanticTag")
            .or_else(|| semantic_tag_from_fsn(&designation_fsn(parameters).unwrap_or_default())),
        // Absent means "the server did not say", which is not the same as
        // "inactive" — a missing property must never retire a concept.
        active: property_bool(parameters, "inactive").map(|inactive| !inactive),
        relationships: relationships(parameters),
    })
}

/// Concepts from a `ValueSet/$expand` response.
///
/// Used for both search and ECL: `$expand` with a `filter` is a text search,
/// and `$expand` of an implicit value set (`?fhir_vs=ecl/...`) is a hierarchy
/// query. One parser serves both because the response shape is identical.
///
/// # Errors
/// [`SnomedError::UnexpectedResponse`] when the payload is not a `ValueSet`.
pub fn concepts_from_expansion(body: &Value) -> Result<Vec<Concept>, SnomedError> {
    if let Some(outcome) = operation_outcome(body) {
        return Err(SnomedError::Server(outcome));
    }

    // An expansion with no matches omits `contains` entirely rather than
    // sending an empty array. That is a valid empty result, not an error —
    // treating it as malformed would turn "no such concept" into a 500.
    let Some(contains) = body
        .get("expansion")
        .and_then(|expansion| expansion.get("contains"))
    else {
        if body.get("expansion").is_some() {
            return Ok(Vec::new());
        }
        return Err(SnomedError::UnexpectedResponse(
            "an $expand response must be a ValueSet with an 'expansion'".to_owned(),
        ));
    };

    let entries = contains.as_array().ok_or_else(|| {
        SnomedError::UnexpectedResponse("'expansion.contains' must be an array".to_owned())
    })?;

    Ok(entries
        .iter()
        .filter_map(|entry| {
            let code = entry.get("code").and_then(Value::as_str)?;
            let display = entry.get("display").and_then(Value::as_str)?;
            Some(Concept {
                code: code.to_owned(),
                display: display.to_owned(),
                semantic_tag: semantic_tag_from_fsn(display),
                // `inactive` on an expansion entry defaults to false per the
                // spec, but only when the server chose to include inactive
                // concepts at all. Absent is left as unknown.
                active: entry.get("inactive").and_then(Value::as_bool).map(|i| !i),
                relationships: Vec::new(),
            })
        })
        .collect())
}

/// Whether `$validate-code` said the code is valid.
///
/// # Errors
/// [`SnomedError::UnexpectedResponse`] when no `result` parameter is present.
pub fn validation_result(body: &Value) -> Result<bool, SnomedError> {
    if let Some(outcome) = operation_outcome(body) {
        return Err(SnomedError::Server(outcome));
    }
    let parameters = body.get("parameter").and_then(Value::as_array);
    parameters
        .and_then(|params| named_bool(params, "result"))
        .ok_or_else(|| {
            // Absence must not be read as "valid". A server that failed to
            // answer would otherwise silently approve every code sent to it.
            SnomedError::UnexpectedResponse(
                "a $validate-code response must carry a boolean 'result'".to_owned(),
            )
        })
}

// ── Parameters helpers ──────────────────────────────────────────────────────

/// A top-level parameter's string value, whichever `value[x]` key it used.
fn named_string(parameters: &[Value], name: &str) -> Option<String> {
    parameters
        .iter()
        .find(|p| p.get("name").and_then(Value::as_str) == Some(name))
        .and_then(any_string)
}

fn named_bool(parameters: &[Value], name: &str) -> Option<bool> {
    parameters
        .iter()
        .find(|p| p.get("name").and_then(Value::as_str) == Some(name))
        .and_then(|p| p.get("valueBoolean").and_then(Value::as_bool))
}

/// FHIR spells a value differently depending on its type, and servers differ
/// in which they pick for the same field. Trying each is more robust than
/// betting on one.
fn any_string(parameter: &Value) -> Option<String> {
    for key in ["valueString", "valueCode", "valueCoding", "valueUri"] {
        if let Some(value) = parameter.get(key) {
            if let Some(text) = value.as_str() {
                return Some(text.to_owned());
            }
            // `valueCoding` is an object; its display is the readable part.
            if let Some(display) = value.get("display").and_then(Value::as_str) {
                return Some(display.to_owned());
            }
        }
    }
    None
}

/// A `property` parameter's value, found by its inner `code` part.
fn property(parameters: &[Value], code: &str) -> Option<String> {
    parts_of(parameters, "property")
        .find(|parts| part_string(parts, "code").as_deref() == Some(code))
        .and_then(|parts| part_value(&parts))
}

fn property_bool(parameters: &[Value], code: &str) -> Option<bool> {
    parts_of(parameters, "property")
        .find(|parts| part_string(parts, "code").as_deref() == Some(code))
        .and_then(|parts| {
            parts
                .iter()
                .find_map(|part| part.get("valueBoolean").and_then(Value::as_bool))
        })
}

/// Parent and child concepts, which `$lookup` returns as properties named
/// `parent` and `child`.
///
/// These are what a flat code table cannot provide, and the reason for using a
/// terminology server at all: without them there is no way to ask whether one
/// concept is a kind of another.
fn relationships(parameters: &[Value]) -> Vec<Relationship> {
    parts_of(parameters, "property")
        .filter_map(|parts| {
            let kind = part_string(&parts, "code")?;
            if kind != "parent" && kind != "child" {
                return None;
            }
            let code = part_value(&parts)?;
            Some(Relationship {
                is_parent: kind == "parent",
                code,
                display: part_string(&parts, "description"),
            })
        })
        .collect()
}

fn parts_of<'a>(parameters: &'a [Value], name: &'a str) -> impl Iterator<Item = Vec<Value>> + 'a {
    parameters
        .iter()
        .filter(move |p| p.get("name").and_then(Value::as_str) == Some(name))
        .filter_map(|p| p.get("part").and_then(Value::as_array).cloned())
}

fn part_string(parts: &[Value], name: &str) -> Option<String> {
    parts
        .iter()
        .find(|part| part.get("name").and_then(Value::as_str) == Some(name))
        .and_then(any_string)
}

/// The `value` part of a property, whatever type it carries.
fn part_value(parts: &[Value]) -> Option<String> {
    parts
        .iter()
        .find(|part| part.get("name").and_then(Value::as_str) == Some("value"))
        .and_then(any_string)
}

fn designation_fsn(parameters: &[Value]) -> Option<String> {
    parts_of(parameters, "designation")
        .find(|parts| {
            part_string(parts, "use")
                .is_some_and(|use_| use_.to_lowercase().contains("fully specified"))
        })
        .and_then(|parts| part_string(&parts, "value"))
}

/// The bracketed tag a fully specified name ends with.
///
/// `"Diabetes mellitus (disorder)"` -> `disorder`. Only the trailing bracket
/// counts: `"Fracture of neck of femur (disorder)"` has no earlier bracket,
/// but `"Entire left kidney (body structure)"` shows why anchoring at the end
/// matters more than finding the first parenthesis.
#[must_use]
pub fn semantic_tag_from_fsn(fsn: &str) -> Option<String> {
    let trimmed = fsn.trim_end();
    let close = trimmed.strip_suffix(')')?;
    let open = close.rfind('(')?;
    let tag = close[open + 1..].trim();
    if tag.is_empty() {
        return None;
    }
    Some(tag.to_owned())
}

/// A server-reported error, as a readable string.
fn operation_outcome(body: &Value) -> Option<String> {
    if body.get("resourceType").and_then(Value::as_str) != Some("OperationOutcome") {
        return None;
    }
    let text = body
        .get("issue")
        .and_then(Value::as_array)
        .map(|issues| {
            issues
                .iter()
                .filter_map(|issue| {
                    issue
                        .get("diagnostics")
                        .or_else(|| issue.get("details").and_then(|d| d.get("text")))
                        .and_then(Value::as_str)
                })
                .collect::<Vec<_>>()
                .join("; ")
        })
        .unwrap_or_default();
    Some(if text.is_empty() {
        "the terminology server returned an OperationOutcome with no diagnostics".to_owned()
    } else {
        text
    })
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::panic)]
mod tests {
    use super::{
        SNOMED_SYSTEM, concept_from_lookup, concepts_from_expansion, semantic_tag_from_fsn,
        validation_result,
    };
    use crate::error::SnomedError;
    use serde_json::json;

    #[test]
    fn the_system_uri_is_the_one_the_standard_fixes() {
        assert_eq!(SNOMED_SYSTEM, "http://snomed.info/sct");
    }

    #[test]
    fn a_lookup_yields_the_concept_with_its_hierarchy() {
        // Shape as Snowstorm returns it: name/value pairs, with parents and
        // children as nested property parts.
        let body = json!({
            "resourceType": "Parameters",
            "parameter": [
                {"name": "name", "valueString": "SNOMED CT"},
                {"name": "display", "valueString": "Type 2 diabetes mellitus"},
                {"name": "property", "part": [
                    {"name": "code", "valueCode": "parent"},
                    {"name": "value", "valueCode": "73211009"},
                    {"name": "description", "valueString": "Diabetes mellitus"}
                ]},
                {"name": "property", "part": [
                    {"name": "code", "valueCode": "child"},
                    {"name": "value", "valueCode": "237599002"},
                    {"name": "description", "valueString": "Insulin treated type 2 diabetes"}
                ]}
            ]
        });
        let concept = concept_from_lookup("44054006", &body).unwrap();
        assert_eq!(concept.display, "Type 2 diabetes mellitus");
        assert_eq!(concept.relationships.len(), 2);
        assert!(
            concept
                .relationships
                .iter()
                .any(|r| r.is_parent && r.code == "73211009")
        );
        assert!(
            concept
                .relationships
                .iter()
                .any(|r| !r.is_parent && r.code == "237599002")
        );
    }

    #[test]
    fn a_missing_inactive_property_does_not_retire_the_concept() {
        // "the server did not say" must never be read as "inactive" — that
        // would hide live concepts from every picker.
        let body = json!({
            "resourceType": "Parameters",
            "parameter": [{"name": "display", "valueString": "Asthma"}]
        });
        assert_eq!(
            concept_from_lookup("195967001", &body).unwrap().active,
            None
        );
    }

    #[test]
    fn an_inactive_property_is_read_as_not_active() {
        let body = json!({
            "resourceType": "Parameters",
            "parameter": [
                {"name": "display", "valueString": "Gestational diabetes"},
                {"name": "property", "part": [
                    {"name": "code", "valueCode": "inactive"},
                    {"name": "valueBoolean", "valueBoolean": true}
                ]}
            ]
        });
        assert_eq!(
            concept_from_lookup("11687002", &body).unwrap().active,
            Some(false)
        );
    }

    #[test]
    fn an_expansion_with_no_matches_is_empty_not_an_error() {
        // Servers omit `contains` entirely rather than sending []. Treating
        // that as malformed turns "no such concept" into a 500.
        let body = json!({"resourceType": "ValueSet", "expansion": {"total": 0}});
        assert_eq!(concepts_from_expansion(&body).unwrap().len(), 0);
    }

    #[test]
    fn an_expansion_yields_concepts_with_tags_from_their_names() {
        let body = json!({
            "resourceType": "ValueSet",
            "expansion": {"contains": [
                {"system": "http://snomed.info/sct", "code": "73211009",
                 "display": "Diabetes mellitus (disorder)"},
                {"system": "http://snomed.info/sct", "code": "44054006",
                 "display": "Type 2 diabetes mellitus (disorder)"}
            ]}
        });
        let concepts = concepts_from_expansion(&body).unwrap();
        assert_eq!(concepts.len(), 2);
        assert_eq!(concepts[0].semantic_tag.as_deref(), Some("disorder"));
    }

    #[test]
    fn an_entry_missing_its_code_is_skipped_not_faked() {
        let body = json!({
            "resourceType": "ValueSet",
            "expansion": {"contains": [
                {"display": "no code here"},
                {"code": "73211009", "display": "Diabetes mellitus (disorder)"}
            ]}
        });
        let concepts = concepts_from_expansion(&body).unwrap();
        assert_eq!(concepts.len(), 1);
        assert_eq!(concepts[0].code, "73211009");
    }

    #[test]
    fn validation_never_defaults_to_valid() {
        // The important one. A server that answered strangely must not be
        // read as approving the code — that would validate anything.
        let missing = json!({"resourceType": "Parameters", "parameter": []});
        assert!(matches!(
            validation_result(&missing),
            Err(SnomedError::UnexpectedResponse(_))
        ));

        let yes = json!({"resourceType": "Parameters",
                         "parameter": [{"name": "result", "valueBoolean": true}]});
        assert!(validation_result(&yes).unwrap());

        let no = json!({"resourceType": "Parameters",
                        "parameter": [{"name": "result", "valueBoolean": false}]});
        assert!(!validation_result(&no).unwrap());
    }

    #[test]
    fn an_operation_outcome_surfaces_the_servers_own_words() {
        let body = json!({
            "resourceType": "OperationOutcome",
            "issue": [{"severity": "error", "code": "not-found",
                       "diagnostics": "Concept 99999999 not found"}]
        });
        match concept_from_lookup("99999999", &body) {
            Err(SnomedError::Server(message)) => {
                assert!(message.contains("99999999"), "got: {message}");
            }
            other => panic!("expected a server error, got {other:?}"),
        }
    }

    #[test]
    fn semantic_tags_come_from_the_trailing_bracket() {
        assert_eq!(
            semantic_tag_from_fsn("Diabetes mellitus (disorder)").as_deref(),
            Some("disorder")
        );
        assert_eq!(
            semantic_tag_from_fsn("Entire left kidney (body structure)").as_deref(),
            Some("body structure")
        );
        // A bracket that is not at the end is part of the name, not a tag.
        assert_eq!(semantic_tag_from_fsn("Fracture (traumatic) of femur"), None);
        assert_eq!(semantic_tag_from_fsn("No brackets at all"), None);
        assert_eq!(semantic_tag_from_fsn("Empty tag ()"), None);
    }
}
