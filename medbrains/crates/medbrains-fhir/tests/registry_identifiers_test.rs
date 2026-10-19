//! ABDM registry identifiers on the wire: an encounter's doctor carries the
//! HPR ID (`https://doctor.ndhm.gov.in`) and its campus the HFR ID
//! (`https://facility.ndhm.gov.in`), as the NRCeS profile examples show — and
//! nothing is invented when either is missing.

use chrono::Utc;
use medbrains_fhir::mapper::{EncounterView, HFR_SYSTEM, HPR_SYSTEM, encounter_to_fhir};
use serde_json::{Value, json};
use uuid::Uuid;

fn encounter(hpr: Option<&str>, hfr: Option<&str>) -> Value {
    let view = EncounterView {
        id: Uuid::new_v4(),
        patient_id: Uuid::new_v4(),
        patient_display: None,
        doctor_id: Some(Uuid::new_v4()),
        doctor_display: Some("Dr A".to_owned()),
        doctor_hpr_id: hpr.map(str::to_owned),
        facility: Some((Uuid::new_v4(), hfr.map(str::to_owned))),
        encounter_type: "opd".to_owned(),
        status: "completed".to_owned(),
        started_at: Utc::now(),
        ended_at: None,
    };
    serde_json::to_value(encounter_to_fhir(&view)).unwrap_or(Value::Null)
}

#[test]
fn practitioner_and_organization_carry_registry_ids() {
    let e = encounter(Some("21-1521-3828-3227"), Some("IN0410000183"));
    assert_eq!(
        e["participant"][0]["individual"]["identifier"],
        json!({ "system": HPR_SYSTEM, "value": "21-1521-3828-3227" })
    );
    assert_eq!(
        e["serviceProvider"][0]["identifier"],
        json!({ "system": HFR_SYSTEM, "value": "IN0410000183" })
    );
    assert_eq!(HPR_SYSTEM, "https://doctor.ndhm.gov.in");
    assert_eq!(HFR_SYSTEM, "https://facility.ndhm.gov.in");
}

#[test]
fn missing_registry_ids_are_omitted_not_invented() {
    let e = encounter(None, Some(" "));
    assert!(
        e["participant"][0]["individual"]
            .get("identifier")
            .is_none()
    );
    assert!(e["serviceProvider"][0].get("identifier").is_none());
    assert!(
        e["serviceProvider"][0]["reference"].is_string(),
        "the campus is still named"
    );
}
