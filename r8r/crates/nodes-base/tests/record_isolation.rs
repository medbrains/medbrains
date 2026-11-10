//! One bad record should not destroy the batch it arrived in.
//!
//! This is the difference between an import that reports "1 record needs
//! attention" and one that reports "failed" — with 249 good records discarded
//! and no indication of which one was at fault.

#![allow(
    clippy::expect_used,
    clippy::unwrap_used,
    clippy::panic,
    clippy::indexing_slicing
)]

mod support;

use r8r_workflow::{Node, OnError};
use serde_json::{Value, json};
use support::{expect_failure, expect_success, node, output_on, run_chain};

#[path = "support/fake_api.rs"]
mod fake_api;

fn isolating(mut node: Node) -> Node {
    node.on_error = Some(OnError::ContinueRecord);
    node
}

fn whole_batch(mut node: Node) -> Node {
    node.on_error = Some(OnError::Continue);
    node
}

/// A patient list where one record is missing the field the workflow needs.
fn patients_with_one_bad() -> Vec<Value> {
    let mut records: Vec<Value> = (0..10)
        .map(|index| json!({ "id": index, "mrn": format!("MRN{index:05}") }))
        .collect();
    records[4] = json!({ "id": 4 });
    records
}

#[tokio::test]
async fn the_records_that_worked_still_arrive_when_one_of_them_does_not() {
    let api = fake_api::start().await;

    let result = run_chain(
        vec![isolating(node(
            "fetch",
            "httpRequest",
            json!({
                "method": "GET",
                // The record with no `mrn` produces a lookup the API refuses.
                "url": format!("{}?mrn={{{{ item.mrn }}}}", api.url("/lookup")),
            }),
        ))],
        patients_with_one_bad(),
    )
    .await;

    expect_success(&result);
    let passed = output_on(&result, "fetch", "main");
    assert_eq!(passed.len(), 9, "nine records got through");
}

#[tokio::test]
async fn a_failed_record_arrives_on_the_error_port_with_the_record_that_caused_it() {
    let api = fake_api::start().await;

    let result = run_chain(
        vec![isolating(node(
            "fetch",
            "httpRequest",
            json!({
                "method": "GET",
                "url": format!("{}?mrn={{{{ item.mrn }}}}", api.url("/boom")),
            }),
        ))],
        vec![json!({ "id": 1, "mrn": "MRN00001" })],
    )
    .await;

    expect_success(&result);
    let failures = output_on(&result, "fetch", "error");
    assert_eq!(failures.len(), 1);
    // The message alone would say a request failed. The record says which
    // patient to go and look at, which is what makes it fixable.
    assert_eq!(failures[0]["item"]["mrn"], json!("MRN00001"));
    assert_eq!(failures[0]["node"], json!("fetch"));
    assert!(failures[0]["error"].as_str().unwrap().contains("500"));
}

#[tokio::test]
async fn failures_can_be_routed_somewhere_that_deals_with_them() {
    let api = fake_api::start().await;

    // The point of a separate port: successes go on to be imported, failures
    // go to a review queue. Both in the same run.
    let result = run_chain(
        vec![isolating(node(
            "fetch",
            "httpRequest",
            json!({ "method": "GET", "url": api.url("/boom") }),
        ))],
        vec![json!({ "id": 1 }), json!({ "id": 2 })],
    )
    .await;

    expect_success(&result);
    assert!(output_on(&result, "fetch", "main").is_empty());
    assert_eq!(output_on(&result, "fetch", "error").len(), 2);
}

#[tokio::test]
async fn losing_the_whole_batch_is_still_what_happens_without_isolation() {
    let api = fake_api::start().await;

    // The contrast that makes the feature worth having: the same ten records,
    // the same one bad, and this time nine good records are replaced by a
    // single error item.
    let result = run_chain(
        vec![whole_batch(node(
            "fetch",
            "httpRequest",
            json!({
                "method": "GET",
                "url": format!("{}?mrn={{{{ item.mrn }}}}", api.url("/lookup")),
            }),
        ))],
        patients_with_one_bad(),
    )
    .await;

    expect_success(&result);
    let out = output_on(&result, "fetch", "main");
    assert_eq!(out.len(), 1, "nine good records gone");
    assert!(out[0].get("error").is_some());
}

#[tokio::test]
async fn a_batch_where_nothing_fails_passes_every_record_through_unchanged() {
    let api = fake_api::start().await;

    let result = run_chain(
        vec![isolating(node(
            "fetch",
            "httpRequest",
            json!({ "method": "GET", "url": api.url("/users") }),
        ))],
        vec![json!({ "id": 1 }), json!({ "id": 2 }), json!({ "id": 3 })],
    )
    .await;

    expect_success(&result);
    assert_eq!(output_on(&result, "fetch", "main").len(), 3);
    assert!(output_on(&result, "fetch", "error").is_empty());
}

#[tokio::test]
async fn one_record_in_isolation_behaves_exactly_as_it_did_before() {
    let api = fake_api::start().await;

    // A single-item batch takes the ordinary path, so nothing about the common
    // case changes — including that a failure is still routed, not raised.
    let result = run_chain(
        vec![isolating(node(
            "fetch",
            "httpRequest",
            json!({ "method": "GET", "url": api.url("/users") }),
        ))],
        vec![json!({})],
    )
    .await;

    let out = expect_success(&result);
    assert_eq!(out[0]["statusCode"], json!(200));
}

#[tokio::test]
async fn a_node_that_stops_on_error_is_untouched_by_any_of_this() {
    let api = fake_api::start().await;

    // The default stays the default: a broken step is never silent.
    let result = run_chain(
        vec![node(
            "fetch",
            "httpRequest",
            json!({ "method": "GET", "url": api.url("/boom") }),
        )],
        vec![json!({ "id": 1 }), json!({ "id": 2 })],
    )
    .await;

    assert!(expect_failure(&result).contains("500"));
}
