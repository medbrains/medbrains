//! `MedBrains`, as a manifest.
//!
//! `MedBrains` exposes its clinical data as FHIR R4 (ABDM IG conformant,
//! `application/fhir+json`), read-only, behind a bearer token and scoped to a
//! tenant. That is a well-specified surface, so the integration is data like
//! any other — the engine needs no knowledge of healthcare.
//!
//! Every operation here is a read. Nothing in this file can modify a patient
//! record, which is deliberate: write access to a hospital system should be an
//! explicit decision, not something a workflow acquires by accident.

use super::Integration;
use super::builder::{field, get, operations, required_field, resource};
use r8r_workflow::credentials::{AuthMethod, CredentialTest, CredentialTypeDescription};
use r8r_workflow::interfaces::{
    CredentialRequirement, NodeGroup, NodeProperty, NodePropertyKind, NodeTypeDescription,
    PropertyOption,
};
use r8r_workflow::routing::{HttpMethod, OutputRouting, PostReceive, RequestRouting, Routing};
use serde_json::json;

/// Every deployment is its own instance, so there is no useful default host —
/// but a local development server is the common case while building.
const DEFAULT_BASE_URL: &str = "http://127.0.0.1:8080";

pub fn integration() -> Integration {
    Integration {
        node: node(),
        credential: credential(),
    }
}

fn credential() -> CredentialTypeDescription {
    CredentialTypeDescription {
        name: "medbrainsApi".into(),
        display_name: "MedBrains".into(),
        documentation_url: None,
        base_url: Some(DEFAULT_BASE_URL.into()),
        properties: vec![
            NodeProperty::new(
                "baseUrl",
                "Instance URL",
                NodePropertyKind::String,
                json!(DEFAULT_BASE_URL),
            )
            .required()
            .describe("Where this MedBrains instance is reachable"),
            NodeProperty::new(
                "accessToken",
                "Access Token",
                NodePropertyKind::String,
                json!(""),
            )
            .required()
            .secret()
            .describe("A bearer token for the tenant this workflow acts on behalf of"),
        ],
        authenticate: AuthMethod::Bearer {
            field: "accessToken".into(),
        },
        // The capability statement needs no authentication, so it proves the
        // instance is reachable and speaking FHIR before a token is blamed.
        test: Some(CredentialTest {
            request: RequestRouting::new(HttpMethod::Get, "api/fhir/metadata"),
            expect: Some(r#"item.body.resourceType == "CapabilityStatement""#.into()),
        }),
    }
}

fn node() -> NodeTypeDescription {
    NodeTypeDescription {
        name: "medbrains".into(),
        display_name: "MedBrains".into(),
        group: NodeGroup::Input,
        description: "Read patients, encounters and observations as FHIR R4".into(),
        icon: "🏥".into(),
        color: "#0ea5a4".into(),
        properties: properties(),
        outputs: vec!["main".into()],
        inputs: vec!["main".into()],
        credentials: vec![CredentialRequirement::required("medbrainsApi")],
        base_url: Some(DEFAULT_BASE_URL.into()),
    }
}

fn properties() -> Vec<NodeProperty> {
    let mut all = vec![resource(vec![
        PropertyOption::new("Patient", "patient"),
        PropertyOption::new("Encounter", "encounter"),
        PropertyOption::new("System", "system"),
    ])];
    all.extend(patient_properties());
    all.extend(encounter_properties());
    all.extend(system_properties());
    all
}

fn patient_properties() -> Vec<NodeProperty> {
    vec![
        operations(
            "patient",
            vec![
                get(
                    "Get",
                    "get",
                    "api/fhir/Patient/{{ parameter.patientId }}",
                    "Fetch one patient as a FHIR Patient resource",
                ),
                // `$everything` answers with a Bundle; splitting its entries
                // turns one clinical record into one item per resource, which
                // is the shape the rest of a workflow wants.
                PropertyOption::new("Get Everything", "everything")
                    .describes("Fetch a patient's whole record as separate items")
                    .routes(
                        Routing::new(
                            HttpMethod::Get,
                            "api/fhir/Patient/{{ parameter.patientId }}/$everything",
                        )
                        .returning(OutputRouting {
                            post_receive: vec![
                                PostReceive::RootProperty {
                                    property: "entry".into(),
                                },
                                PostReceive::Split,
                                // Each Bundle entry wraps the resource itself.
                                PostReceive::RootProperty {
                                    property: "resource".into(),
                                },
                            ],
                        }),
                    ),
            ],
        ),
        required_field("patientId", "Patient ID", "patient", &["get", "everything"])
            .placeholder("a UUID, or {{ item.patientId }}"),
    ]
}

fn encounter_properties() -> Vec<NodeProperty> {
    vec![
        operations(
            "encounter",
            vec![get(
                "Get",
                "get",
                "api/fhir/Encounter/{{ parameter.encounterId }}",
                "Fetch one encounter as a FHIR Encounter resource",
            )],
        ),
        required_field("encounterId", "Encounter ID", "encounter", &["get"]),
    ]
}

fn system_properties() -> Vec<NodeProperty> {
    vec![
        operations(
            "system",
            vec![get(
                "Capabilities",
                "metadata",
                "api/fhir/metadata",
                "Read the instance's FHIR capability statement",
            )],
        ),
        // Nothing to configure, but a field keeps the panel from looking broken.
        field("note", "Note", "system", &["metadata"])
            .describe("Needs no authentication — useful for checking connectivity"),
    ]
}
