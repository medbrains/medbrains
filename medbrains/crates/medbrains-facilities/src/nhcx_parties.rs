//! The parties an NHCX message names — patient, hospital, payer — as the
//! NRCeS profiles shape them, and the clean-up every message gets before it
//! leaves (FHIR has no null and no empty element).

use serde_json::{Value, json};
use uuid::Uuid;

use medbrains_core::nhcx::{
    NHCX_PARTICIPANT_SYSTEM, ORG_TYPE_SYSTEM, SUBSCRIBER_RELATIONSHIP_SYSTEM, V2_0203,
};
use medbrains_fhir::mapper::PatientView;
use medbrains_fhir::nrces::{self, NRCES_PROFILE_BASE, Party};

use crate::nhcx_common::{PatientParty, ProviderParty};

pub(crate) fn profiled(mut resource: Value, profile: &str) -> Value {
    resource["meta"] = json!({ "profile": [format!("{NRCES_PROFILE_BASE}{profile}")] });
    resource
}

pub(crate) fn patient_entry(p: &PatientParty, urn: &str) -> Value {
    let view = PatientView {
        id: p.id,
        uhid: p.uhid.clone(),
        abha_id: p.abha_number.clone().filter(|s| !s.is_empty()),
        prefix: None,
        first_name: p.first_name.clone(),
        middle_name: None,
        last_name: p.last_name.clone(),
        gender: p.gender.clone(),
        date_of_birth: p.date_of_birth,
        phone: None,
        email: None,
        is_active: true,
    };
    json!({ "fullUrl": urn, "resource": nrces::patient(&view) })
}

/// `organization-type` coding: `prov` for the hospital, `ins` for a payer.
fn org_type(code: &str, display: &str) -> Value {
    json!([{ "coding": [{ "system": ORG_TYPE_SYSTEM, "code": code, "display": display }] }])
}

/// The hospital, as the NRCeS Organization (HFR ID, else our facility ID).
pub(crate) fn provider_resource(p: &ProviderParty, id: Uuid) -> Value {
    let mut org = nrces::organization(&Party {
        id: p.id,
        name: p.name.clone(),
        registry_id: p.hfr_facility_id.clone(),
    });
    org["id"] = json!(id);
    org["type"] = org_type("prov", "Healthcare Provider");
    org
}

/// The payer, named by its NHCX participant code (NHA's samples type it as
/// v2-0203 `NIIP` under `https://nhcx.abdm.gov.in`).
pub(crate) fn payer_resource(code: &str, name: &str, id: Uuid) -> Value {
    profiled(
        json!({
            "resourceType": "Organization", "id": id,
            "identifier": [{
                "type": { "coding": [{ "system": V2_0203, "code": "NIIP",
                                      "display": "National Insurance Payor Identifier (Payor)" }] },
                "system": NHCX_PARTICIPANT_SYSTEM, "value": code,
            }],
            "type": org_type("ins", "Insurance Company"),
            "name": name,
        }),
        "Organization",
    )
}

/// HL7 subscriber-relationship code for the policy holder relation we keep
/// as free text; anything else stays text.
pub(crate) fn relationship(text: &str) -> Value {
    let code = text.trim().to_ascii_lowercase();
    match code.as_str() {
        "self" | "spouse" | "child" | "parent" | "other" => json!({
            "coding": [{ "system": SUBSCRIBER_RELATIONSHIP_SYSTEM, "code": code }], "text": text
        }),
        _ => json!({ "text": text }),
    }
}

/// Drops JSON nulls and the empty arrays and objects they leave: FHIR has
/// no null, and an empty element is invalid.
pub(crate) fn prune(v: &mut Value) {
    match v {
        Value::Object(map) => {
            map.values_mut().for_each(prune);
            map.retain(|_, x| !is_empty(x));
        }
        Value::Array(items) => {
            items.iter_mut().for_each(prune);
            items.retain(|x| !is_empty(x));
        }
        _ => {}
    }
}

fn is_empty(v: &Value) -> bool {
    match v {
        Value::Null => true,
        Value::Array(a) => a.is_empty(),
        Value::Object(o) => o.is_empty(),
        _ => false,
    }
}
