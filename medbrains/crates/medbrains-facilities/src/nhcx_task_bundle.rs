//! The NHCX `TaskBundle` the hospital sends to ask a payer something about a
//! claim rather than to claim: which claims it holds, to cancel one, or to
//! reprocess one. Shapes follow the NRCeS NHCX IG 6.5.0 examples
//! (`TaskBundleForSearchRequest`, `TaskBundleForReprocessRequest`). A status
//! enquiry is no Task: `/v1/status` carries an empty sealed payload, and its
//! correlation id names the message asked about (docs.abdm.gov.in).

use chrono::{NaiveDate, Utc};
use serde_json::{Value, json};
use uuid::Uuid;

use medbrains_core::nhcx::{
    FINANCIAL_TASK_CODE_SYSTEM, NDHM_REASON_CODE_SYSTEM, NDHM_TASK_CODE_SYSTEM,
    NDHM_TASK_INPUT_TYPE_SYSTEM, TASK_BUNDLE_PROFILE,
};
use medbrains_fhir::mapper::HFR_SYSTEM;

/// What the Task asks.
pub(crate) enum TaskAsk<'a> {
    /// Where the message sent under api call `checks` stands.
    Status { checks: Uuid },
    /// The payer's claims in a date range, optionally one claim number.
    Search {
        from: NaiveDate,
        to: NaiveDate,
        claim_number: Option<&'a str>,
    },
    Cancel {
        focus: Uuid,
        number: &'a str,
        reason: &'a str,
    },
    /// `rejected` picks the IG's `claimrejected` reason code.
    Reprocess {
        focus: Uuid,
        number: &'a str,
        reason: &'a str,
        rejected: bool,
    },
}

impl TaskAsk<'_> {
    /// `nhcx_tasks.kind`.
    pub(crate) const fn kind(&self) -> &'static str {
        match self {
            Self::Status { .. } => "status",
            Self::Search { .. } => "search",
            Self::Cancel { .. } => "cancel",
            Self::Reprocess { .. } => "reprocess",
        }
    }
}

/// The two organisations a Task names.
pub(crate) struct TaskParties<'a> {
    pub(crate) hospital_name: &'a str,
    pub(crate) hfr_id: Option<&'a str>,
    pub(crate) payer_name: &'a str,
    pub(crate) payer_code: &'a str,
}

fn input(code: &str, value: Value) -> Value {
    let mut v =
        json!({ "type": { "coding": [{ "system": NDHM_TASK_INPUT_TYPE_SYSTEM, "code": code }] } });
    if let (Some(obj), Value::Object(val)) = (v.as_object_mut(), value) {
        obj.extend(val);
    }
    v
}

fn text_input(code: &str, value: &str) -> Value {
    input(code, json!({ "valueString": value }))
}

fn date_input(code: &str, value: NaiveDate) -> Value {
    input(code, json!({ "valueDate": value }))
}

/// The Task's fields for one ask.
struct Shape {
    system: &'static str,
    code: &'static str,
    description: String,
    focus: Option<Value>,
    inputs: Vec<Value>,
    reason: Option<Value>,
}

const fn shape_of(
    (system, code): (&'static str, &'static str),
    description: String,
    focus: Option<Value>,
    inputs: Vec<Value>,
    reason: Option<Value>,
) -> Shape {
    Shape {
        system,
        code,
        description,
        focus,
        inputs,
        reason,
    }
}

/// The Task's shape; `None` for a status enquiry, which sends no Task.
fn shape(ask: &TaskAsk<'_>) -> Option<Shape> {
    let focus = |id: &Uuid| Some(json!({ "reference": format!("Claim/{id}") }));
    Some(match ask {
        TaskAsk::Status { .. } => return None,
        TaskAsk::Search {
            from,
            to,
            claim_number,
        } => {
            let mut inputs = vec![date_input("fromDate", *from), date_input("toDate", *to)];
            inputs.extend(claim_number.map(|n| text_input("claimNumber", n)));
            shape_of(
                (NDHM_TASK_CODE_SYSTEM, "search"),
                format!("Search for claims from {from} to {to}"),
                None,
                inputs,
                None,
            )
        }
        TaskAsk::Cancel {
            focus: id,
            number,
            reason,
        } => shape_of(
            (FINANCIAL_TASK_CODE_SYSTEM, "cancel"),
            format!("Request for cancelling the claim with number - {number}"),
            focus(id),
            vec![text_input("claimNumber", number)],
            Some(json!({ "text": reason })),
        ),
        TaskAsk::Reprocess {
            focus: id,
            number,
            reason,
            rejected,
        } => {
            let reason = if *rejected {
                json!({ "coding": [{ "system": NDHM_REASON_CODE_SYSTEM, "code": "claimrejected",
                                      "display": "Reprocess request due to claim rejected by payer" }],
                        "text": reason })
            } else {
                json!({ "text": reason })
            };
            shape_of(
                (FINANCIAL_TASK_CODE_SYSTEM, "reprocess"),
                format!("Request for reprocesing the claim with number - {number}"),
                focus(id),
                vec![text_input("claimNumber", number)],
                Some(reason),
            )
        }
    })
}

/// The `TaskBundle`: the Task, then the hospital (requester) and the payer
/// (owner). A status enquiry's payload is empty.
pub(crate) fn task_bundle(ask: &TaskAsk<'_>, parties: &TaskParties<'_>) -> Value {
    let Some(Shape {
        system,
        code,
        description,
        focus,
        inputs,
        reason,
    }) = shape(ask)
    else {
        return json!({});
    };
    let (task_id, hospital, payer) = (Uuid::new_v4(), Uuid::new_v4(), Uuid::new_v4());
    let now = medbrains_core::nhcx_wire::ist_timestamp(Utc::now());
    let hospital_ids: Vec<Value> = parties
        .hfr_id
        .iter()
        .map(|h| json!({ "system": HFR_SYSTEM, "value": h }))
        .collect();
    json!({
        "resourceType": "Bundle",
        "id": Uuid::new_v4(),
        "meta": { "profile": [TASK_BUNDLE_PROFILE] },
        "identifier": { "value": task_id },
        "type": "collection",
        "timestamp": now,
        "entry": [
            { "fullUrl": format!("urn:uuid:{task_id}"), "resource": {
                "resourceType": "Task", "id": task_id,
                "status": "requested", "intent": "order",
                "code": { "coding": [{ "system": system, "code": code }] },
                "description": description,
                "focus": focus,
                "reasonCode": reason,
                "authoredOn": now,
                "requester": { "reference": format!("urn:uuid:{hospital}") },
                "owner": { "reference": format!("urn:uuid:{payer}") },
                "input": inputs,
            }},
            { "fullUrl": format!("urn:uuid:{hospital}"), "resource": {
                "resourceType": "Organization", "id": hospital,
                "identifier": hospital_ids, "name": parties.hospital_name,
            }},
            { "fullUrl": format!("urn:uuid:{payer}"), "resource": {
                "resourceType": "Organization", "id": payer,
                "identifier": [{ "value": parties.payer_code }], "name": parties.payer_name,
            }},
        ]
    })
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;

    const PARTIES: TaskParties<'static> = TaskParties {
        hospital_name: "City Hospital",
        hfr_id: Some("IN0001"),
        payer_name: "Payer",
        payer_code: "payer@sbx",
    };

    #[test]
    fn a_search_task_carries_the_date_range_and_the_ig_search_code() {
        let from = NaiveDate::from_ymd_opt(2026, 10, 1).unwrap();
        let to = NaiveDate::from_ymd_opt(2026, 10, 19).unwrap();
        let b = task_bundle(
            &TaskAsk::Search {
                from,
                to,
                claim_number: None,
            },
            &PARTIES,
        );
        let task = &b["entry"][0]["resource"];
        assert_eq!(
            task["code"]["coding"][0]["system"],
            json!(NDHM_TASK_CODE_SYSTEM)
        );
        assert_eq!(task["code"]["coding"][0]["code"], json!("search"));
        assert_eq!(
            task["input"][0]["type"]["coding"][0]["code"],
            json!("fromDate")
        );
        assert_eq!(task["input"][0]["valueDate"], json!("2026-10-01"));
        assert_eq!(task["input"][1]["valueDate"], json!("2026-10-19"));
        assert_eq!(
            b["entry"][1]["resource"]["identifier"][0]["value"],
            json!("IN0001")
        );
    }

    #[test]
    fn cancel_and_reprocess_name_the_claim_and_the_reason() {
        let id = Uuid::new_v4();
        let ask = TaskAsk::Reprocess {
            focus: id,
            number: "CLM-1",
            reason: "Bills attached",
            rejected: true,
        };
        let task = task_bundle(&ask, &PARTIES)["entry"][0]["resource"].clone();
        assert_eq!(task["code"]["coding"][0]["code"], json!("reprocess"));
        assert_eq!(
            task["reasonCode"]["coding"][0]["code"],
            json!("claimrejected")
        );
        assert_eq!(task["input"][0]["valueString"], json!("CLM-1"));
        assert_eq!(task["focus"]["reference"], json!(format!("Claim/{id}")));
        let cancel = TaskAsk::Cancel {
            focus: id,
            number: "CLM-1",
            reason: "Duplicate",
        };
        let task = task_bundle(&cancel, &PARTIES)["entry"][0]["resource"].clone();
        assert_eq!(
            task["code"]["coding"][0]["system"],
            json!(FINANCIAL_TASK_CODE_SYSTEM)
        );
        assert_eq!(task["code"]["coding"][0]["code"], json!("cancel"));
        assert_eq!(task["reasonCode"]["text"], json!("Duplicate"));
    }
}
