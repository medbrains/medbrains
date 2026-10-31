//! The `MedBrains` integration, driven against a stand-in that reproduces the
//! FHIR R4 shapes the real instance returns.
//!
//! The point of these is that the manifest is *correct* — the URLs it builds,
//! the token it attaches, and what it makes of a Bundle — so that pointing it
//! at a real instance is a matter of filling in a credential.

#![allow(
    clippy::expect_used,
    clippy::unwrap_used,
    clippy::panic,
    clippy::indexing_slicing
)]

mod support;

#[path = "support/fake_api.rs"]
mod fake_api;

use r8r_core::declarative::DeclarativeNode;
use r8r_core::{ExecutionMode, NodeRegistry, StaticCredentials, WorkflowExecute};
use r8r_nodes_base::integrations;
use r8r_workflow::Workflow;
use r8r_workflow::interfaces::{ExecutionStatus, Items, RunResult};
use serde_json::{Value, json};
use std::collections::HashMap;
use std::sync::Arc;
use support::{edge, node};

const KNOWN_PATIENT: &str = "3f1a9c02-0000-4000-8000-000000000001";

/// Run a `MedBrains` node with a credential pointed at the stand-in instance.
async fn run_against(base: &str, token: &str, parameters: Value, input: Items) -> RunResult {
    let mut medbrains = node("medbrains", "medbrains", parameters);
    medbrains.credentials = HashMap::from([("medbrainsApi".into(), "cred".into())]);

    let workflow = Workflow {
        nodes: vec![node("trigger", "manual", json!({})), medbrains],
        connections: vec![edge("trigger", "medbrains")],
        ..Default::default()
    };

    let mut nodes = NodeRegistry::new();
    r8r_nodes_base::register_all(&mut nodes);
    for integration in integrations::all() {
        nodes.register(DeclarativeNode::new(
            integration.node,
            Some(integration.credential),
        ));
    }

    // The instance URL comes from the credential, exactly as it would in a
    // real deployment.
    let provider = StaticCredentials::new().with(
        "cred",
        "medbrainsApi",
        json!({ "baseUrl": base, "accessToken": token }),
    );

    WorkflowExecute::new(Arc::new(nodes))
        .expect("engine builds")
        .with_credentials(Arc::new(provider))
        .run(&workflow, None, input, ExecutionMode::Manual)
        .await
}

/// A registry with the integrations installed, and a credential pointing at
/// the stand-in instance.
fn registry_and_credentials(base: &str) -> (NodeRegistry, StaticCredentials) {
    let mut nodes = NodeRegistry::new();
    r8r_nodes_base::register_all(&mut nodes);
    for integration in integrations::all() {
        nodes.register(DeclarativeNode::new(
            integration.node,
            Some(integration.credential),
        ));
    }

    let credentials = StaticCredentials::new().with(
        "cred",
        "medbrainsApi",
        json!({ "baseUrl": base, "accessToken": "a-real-token" }),
    );
    (nodes, credentials)
}

async fn run_workflow(base: &str, workflow: &Workflow) -> RunResult {
    let (nodes, credentials) = registry_and_credentials(base);
    WorkflowExecute::new(Arc::new(nodes))
        .expect("engine builds")
        .with_credentials(Arc::new(credentials))
        .run(workflow, None, vec![json!({})], ExecutionMode::Manual)
        .await
}

fn expect_success(result: &RunResult) -> &Items {
    assert_eq!(
        result.status,
        ExecutionStatus::Success,
        "run failed: {:?}",
        result.error
    );
    &result.last
}

fn expect_failure(result: &RunResult) -> String {
    assert_eq!(result.status, ExecutionStatus::Error, "expected failure");
    result.error.clone().unwrap_or_default()
}

// ============================================================ connectivity

#[tokio::test]
async fn the_capability_statement_confirms_the_instance_speaks_fhir() {
    let api = fake_api::start_medbrains().await;

    let result = run_against(
        &api.base,
        "unused-for-metadata",
        json!({ "resource": "system", "operation": "metadata" }),
        vec![json!({})],
    )
    .await;

    let out = expect_success(&result);
    assert_eq!(out[0]["resourceType"], json!("CapabilityStatement"));
    assert_eq!(out[0]["fhirVersion"], json!("4.0.1"));
}

// ================================================================= patient

#[tokio::test]
async fn a_patient_comes_back_as_a_fhir_resource() {
    let api = fake_api::start_medbrains().await;

    let result = run_against(
        &api.base,
        "a-real-token",
        json!({ "resource": "patient", "operation": "get", "patientId": KNOWN_PATIENT }),
        vec![json!({})],
    )
    .await;

    let patient = &expect_success(&result)[0];
    assert_eq!(patient["resourceType"], json!("Patient"));
    assert_eq!(patient["id"], json!(KNOWN_PATIENT));
    assert_eq!(patient["name"][0]["family"], json!("Kapoor"));
}

#[tokio::test]
async fn the_patient_id_can_come_from_the_item_being_processed() {
    // The usual shape: a list of ids arrives, one lookup happens per id.
    let api = fake_api::start_medbrains().await;

    let result = run_against(
        &api.base,
        "a-real-token",
        json!({
            "resource": "patient",
            "operation": "get",
            "patientId": "{{ item.patientId }}"
        }),
        vec![json!({ "patientId": KNOWN_PATIENT })],
    )
    .await;

    assert_eq!(expect_success(&result)[0]["id"], json!(KNOWN_PATIENT));
}

#[tokio::test]
async fn a_whole_record_arrives_as_one_item_per_resource() {
    // `$everything` answers with a Bundle; a workflow wants the resources.
    let api = fake_api::start_medbrains().await;

    let result = run_against(
        &api.base,
        "a-real-token",
        json!({ "resource": "patient", "operation": "everything", "patientId": KNOWN_PATIENT }),
        vec![json!({})],
    )
    .await;

    let out = expect_success(&result);
    assert_eq!(out.len(), 3, "the Bundle held three resources");

    let kinds: Vec<&str> = out
        .iter()
        .filter_map(|item| item["resourceType"].as_str())
        .collect();
    assert_eq!(kinds, vec!["Patient", "Encounter", "Observation"]);

    // The entry wrapper is gone; these are the resources themselves.
    assert!(out.iter().all(|item| item.get("resource").is_none()));
    assert_eq!(out[2]["valueQuantity"]["value"], json!(128));
}

// =============================================================== encounter

#[tokio::test]
async fn an_encounter_can_be_read_by_id() {
    let api = fake_api::start_medbrains().await;

    let result = run_against(
        &api.base,
        "a-real-token",
        json!({ "resource": "encounter", "operation": "get", "encounterId": "enc-9" }),
        vec![json!({})],
    )
    .await;

    let encounter = &expect_success(&result)[0];
    assert_eq!(encounter["resourceType"], json!("Encounter"));
    assert_eq!(encounter["id"], json!("enc-9"));
}

// ==================================================================== auth

#[tokio::test]
async fn the_token_is_attached_without_the_manifest_mentioning_headers() {
    // Proven by the negative: the stand-in refuses a request with no bearer.
    let api = fake_api::start_medbrains().await;

    let result = run_against(
        &api.base,
        "",
        json!({ "resource": "patient", "operation": "get", "patientId": KNOWN_PATIENT }),
        vec![json!({})],
    )
    .await;

    assert!(
        expect_failure(&result).contains("401"),
        "an empty token must be refused"
    );
}

#[tokio::test]
async fn a_node_with_no_credential_selected_says_so_before_calling_out() {
    let api = fake_api::start_medbrains().await;
    let mut nodes = NodeRegistry::new();
    r8r_nodes_base::register_all(&mut nodes);
    for mut integration in integrations::all() {
        integration.node.base_url = Some(api.base.clone());
        nodes.register(DeclarativeNode::new(
            integration.node,
            Some(integration.credential),
        ));
    }

    let workflow = Workflow {
        nodes: vec![
            node("trigger", "manual", json!({})),
            node(
                "medbrains",
                "medbrains",
                json!({ "resource": "patient", "operation": "get", "patientId": "x" }),
            ),
        ],
        connections: vec![edge("trigger", "medbrains")],
        ..Default::default()
    };

    let result = WorkflowExecute::new(Arc::new(nodes))
        .expect("engine builds")
        .run(&workflow, None, vec![json!({})], ExecutionMode::Manual)
        .await;

    assert!(expect_failure(&result).contains("medbrainsApi"));
}

// ================================================================ failures

#[tokio::test]
async fn an_unknown_patient_surfaces_the_operation_outcome() {
    // `MedBrains` answers 404 with a FHIR OperationOutcome; the diagnostics are
    // the useful part and must reach the person debugging.
    let api = fake_api::start_medbrains().await;

    let result = run_against(
        &api.base,
        "a-real-token",
        json!({ "resource": "patient", "operation": "get", "patientId": "does-not-exist" }),
        vec![json!({})],
    )
    .await;

    let error = expect_failure(&result);
    assert!(error.contains("404"), "got: {error}");
    assert!(
        error.contains("was not found"),
        "the diagnostics belong in the error: {error}"
    );
}

#[tokio::test]
async fn a_missing_patient_can_be_tolerated_so_a_batch_finishes() {
    // Reconciling a list of ids should not stop at the first stale one.
    let api = fake_api::start_medbrains().await;

    let mut medbrains = node(
        "medbrains",
        "medbrains",
        json!({ "resource": "patient", "operation": "get", "patientId": "does-not-exist" }),
    );
    medbrains.credentials = HashMap::from([("medbrainsApi".into(), "cred".into())]);
    medbrains.on_error = Some(r8r_workflow::OnError::Continue);

    let workflow = Workflow {
        nodes: vec![
            node("trigger", "manual", json!({})),
            medbrains,
            node(
                "record",
                "set",
                json!({ "mode": "fields", "fields": { "checked": true } }),
            ),
        ],
        connections: vec![edge("trigger", "medbrains"), edge("medbrains", "record")],
        ..Default::default()
    };

    let result = run_workflow(&api.base, &workflow).await;

    let out = expect_success(&result);
    assert_eq!(out[0]["checked"], json!(true), "the workflow carried on");
    assert!(out[0]["error"].as_str().unwrap().contains("404"));
}

#[tokio::test]
async fn an_unreachable_instance_names_the_address_that_failed() {
    let result = run_against(
        "http://127.0.0.1:1",
        "a-real-token",
        json!({ "resource": "system", "operation": "metadata" }),
        vec![json!({})],
    )
    .await;

    assert!(expect_failure(&result).contains("127.0.0.1:1"));
}

// ============================================================== a pipeline

#[tokio::test]
async fn a_record_can_be_filtered_and_reshaped_for_another_system() {
    // The reason to put r8r in front of a HIMS: pull a record, keep the part
    // another system needs, and hand it over in that system's shape.
    let api = fake_api::start_medbrains().await;

    let mut medbrains = node(
        "medbrains",
        "medbrains",
        json!({ "resource": "patient", "operation": "everything", "patientId": KNOWN_PATIENT }),
    );
    medbrains.credentials = HashMap::from([("medbrainsApi".into(), "cred".into())]);

    let workflow = Workflow {
        nodes: vec![
            node("trigger", "manual", json!({})),
            medbrains,
            node(
                "observations",
                "filter",
                json!({ "condition": "item.resourceType == \"Observation\"" }),
            ),
            node(
                "map",
                "mapFields",
                json!({
                    "mappings": {
                        "measurement.name": "code.text",
                        "measurement.value": "valueQuantity.value",
                        "measurement.unit": "valueQuantity.unit",
                        "measurement.recorded": "{{ item.status }}"
                    }
                }),
            ),
        ],
        connections: vec![
            edge("trigger", "medbrains"),
            edge("medbrains", "observations"),
            edge("observations", "map"),
        ],
        ..Default::default()
    };

    let result = run_workflow(&api.base, &workflow).await;

    let out = expect_success(&result);
    assert_eq!(out.len(), 1, "only the observation survived the filter");
    assert_eq!(
        out[0],
        json!({
            "measurement": {
                "name": "Systolic blood pressure",
                "value": 128,
                "unit": "mm[Hg]",
                "recorded": "final"
            }
        })
    );
}

// =============================================================== manifest

#[tokio::test]
async fn the_integration_is_read_only() {
    // Write access to a hospital system must be a deliberate decision, so no
    // operation here may use a method that modifies anything.
    let medbrains = integrations::medbrains::integration();

    for property in &medbrains.node.properties {
        if property.name != "operation" {
            continue;
        }
        for option in &property.options {
            let routing = option
                .routing
                .as_ref()
                .expect("every operation has routing");
            assert_eq!(
                routing.request.method,
                r8r_workflow::HttpMethod::Get,
                "operation `{}` is not a read",
                option.value
            );
        }
    }
}

#[tokio::test]
async fn the_access_token_is_marked_secret_so_it_is_never_returned() {
    let medbrains = integrations::medbrains::integration();

    let token = medbrains
        .credential
        .properties
        .iter()
        .find(|property| property.name == "accessToken")
        .expect("an access token field");
    assert!(
        token.password,
        "a hospital token must never be echoed back to the editor"
    );

    let redacted = medbrains.credential.redact(&json!({
        "baseUrl": "http://127.0.0.1:8080",
        "accessToken": "a-real-token"
    }));
    assert!(!redacted.to_string().contains("a-real-token"));
    assert_eq!(
        redacted["baseUrl"],
        json!("http://127.0.0.1:8080"),
        "the URL is not a secret"
    );
}
