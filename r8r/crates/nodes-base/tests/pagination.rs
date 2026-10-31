//! Pagination, driven against a real server that really pages.
//!
//! The failure this guards against is quiet: a workflow asks for every patient
//! in a directory, gets the first hundred, and reports success. Nothing looks
//! wrong — the run is green, the data is valid, and it is missing 150 people.
//! So every test here asserts the *total*, not that a request was made.

#![allow(
    clippy::expect_used,
    clippy::unwrap_used,
    clippy::panic,
    clippy::indexing_slicing
)]

mod support;

use serde_json::json;
use support::{expect_failure, expect_success, node, output_on, run_chain};

#[path = "support/fake_api.rs"]
mod fake_api;

use fake_api::DIRECTORY_SIZE;

/// A node that retries three times, quickly — so a test measuring a honoured
/// `Retry-After` is measuring the service's wait and not the node's.
fn retrying(mut node: r8r_workflow::Node) -> r8r_workflow::Node {
    node.retry_on_fail = true;
    node.max_tries = Some(3);
    node.wait_between_tries_ms = Some(50);
    node
}

async fn fetch(
    api: &fake_api::FakeApi,
    path: &str,
    params: serde_json::Value,
) -> Vec<serde_json::Value> {
    let mut config = json!({ "method": "GET", "url": api.url(path) });
    let object = config.as_object_mut().expect("object");
    for (key, value) in params.as_object().expect("params object") {
        object.insert(key.clone(), value.clone());
    }
    let result = run_chain(vec![node("http", "httpRequest", config)], vec![json!({})]).await;
    expect_success(&result).clone()
}

// ============================================================ the four shapes

#[tokio::test]
async fn a_cursor_in_the_body_is_followed_until_the_directory_is_exhausted() {
    let api = fake_api::start().await;

    let out = fetch(
        &api,
        "/paged/cursor",
        json!({
            "paginationMode": "cursor",
            "paginationPath": "meta.next_cursor",
            "paginationParam": "cursor",
            "itemsPath": "patients",
        }),
    )
    .await;

    assert_eq!(
        out.len(),
        DIRECTORY_SIZE,
        "every patient, not just the first page"
    );
    assert_eq!(out[0]["mrn"], json!("MRN00000"));
    assert_eq!(out[DIRECTORY_SIZE - 1]["mrn"], json!("MRN00249"));
    assert_eq!(api.requests(), 3, "100 + 100 + 50");
}

#[tokio::test]
async fn an_offset_advances_by_what_has_already_been_collected() {
    let api = fake_api::start().await;

    let out = fetch(
        &api,
        "/paged/offset",
        json!({
            "paginationMode": "offset",
            "paginationParam": "offset",
            "paginationSizeParam": "limit",
            "paginationPageSize": 100,
            "itemsPath": "data",
        }),
    )
    .await;

    assert_eq!(out.len(), DIRECTORY_SIZE);
    // No record appears twice: an offset that failed to advance would repeat
    // the first page forever, and a total of 250 alone would not catch it.
    let ids: std::collections::BTreeSet<i64> = out
        .iter()
        .filter_map(|record| record["id"].as_i64())
        .collect();
    assert_eq!(ids.len(), DIRECTORY_SIZE, "no record fetched twice");
}

#[tokio::test]
async fn page_numbers_are_walked_from_wherever_the_api_starts_counting() {
    let api = fake_api::start().await;

    let out = fetch(
        &api,
        "/paged/pages",
        json!({
            "paginationMode": "page",
            "paginationParam": "page",
            "paginationSizeParam": "per_page",
            "paginationPageSize": 100,
            "paginationStart": 1,
            "itemsPath": "results",
        }),
    )
    .await;

    assert_eq!(out.len(), DIRECTORY_SIZE);
    assert_eq!(
        out[100]["id"],
        json!(100),
        "page two starts where page one ended"
    );
}

#[tokio::test]
async fn a_link_header_is_followed_to_next_and_not_to_prev() {
    let api = fake_api::start().await;

    // The fixture names `prev` before `next`, as real headers do. Taking the
    // first URL in the header would loop on page one.
    let out = fetch(
        &api,
        "/paged/link",
        json!({ "paginationMode": "link", "itemsPath": "items" }),
    )
    .await;

    assert_eq!(out.len(), DIRECTORY_SIZE);
    assert_eq!(api.requests(), 3);
}

// ================================================================== stopping

#[tokio::test]
async fn a_vendor_that_always_offers_more_is_stopped_by_the_ceiling() {
    let api = fake_api::start().await;

    let out = fetch(
        &api,
        "/paged/forever",
        json!({
            "paginationMode": "cursor",
            "paginationPath": "next",
            "paginationParam": "cursor",
            "itemsPath": "items",
            "maxPages": 5,
        }),
    )
    .await;

    assert_eq!(
        api.requests(),
        5,
        "stopped at the ceiling, not at the vendor's word"
    );
    assert_eq!(out.len(), 50);
}

#[tokio::test]
async fn a_short_page_ends_an_offset_walk_without_one_more_empty_request() {
    let api = fake_api::start().await;

    let out = fetch(
        &api,
        "/paged/offset",
        json!({
            "paginationMode": "offset",
            "paginationParam": "offset",
            "paginationSizeParam": "limit",
            "paginationPageSize": 125,
            "itemsPath": "data",
        }),
    )
    .await;

    assert_eq!(out.len(), DIRECTORY_SIZE);
    // 125 + 125 fills the directory exactly, so the third request is the one
    // that comes back empty and stops the walk.
    assert_eq!(api.requests(), 3);
}

#[tokio::test]
async fn pagination_left_off_makes_exactly_one_request() {
    let api = fake_api::start().await;

    let out = fetch(&api, "/paged/cursor", json!({ "itemsPath": "patients" })).await;

    assert_eq!(api.requests(), 1);
    assert_eq!(out.len(), 100, "one page, unwrapped");
}

// =================================================================== records

#[tokio::test]
async fn without_a_records_path_each_page_arrives_whole() {
    let api = fake_api::start().await;

    let out = fetch(
        &api,
        "/paged/cursor",
        json!({
            "paginationMode": "cursor",
            "paginationPath": "meta.next_cursor",
            "paginationParam": "cursor",
        }),
    )
    .await;

    // Three pages, three items — status and headers intact, for a workflow
    // that cares about the response rather than the records.
    assert_eq!(out.len(), 3);
    assert_eq!(out[0]["statusCode"], json!(200));
    assert_eq!(out[0]["body"]["patients"].as_array().unwrap().len(), 100);
}

#[tokio::test]
async fn a_records_path_that_matches_nothing_yields_nothing_rather_than_failing() {
    let api = fake_api::start().await;

    // A mistyped path is a configuration error, but failing the run buries it.
    // An empty result with a green run is visible in the execution log.
    //
    // Read from the node's own output rather than the run's final items: the
    // engine keeps the last *non-empty* output as `last`, so a node that emits
    // nothing is invisible there.
    let result = run_chain(
        vec![node(
            "http",
            "httpRequest",
            json!({
                "method": "GET",
                "url": api.url("/paged/cursor"),
                "itemsPath": "pateints",
            }),
        )],
        vec![json!({})],
    )
    .await;

    expect_success(&result);
    assert!(output_on(&result, "http", "main").is_empty());
}

// =============================================================== the query

#[tokio::test]
async fn cursors_replace_each_other_rather_than_piling_up_in_the_query() {
    let api = fake_api::start().await;

    // Appending each page's cursor would send `?cursor=0&cursor=100&cursor=200`
    // by page three. Most servers take the first value, which would mean
    // re-fetching page one forever.
    let out = fetch(
        &api,
        "/paged/cursor",
        json!({
            "paginationMode": "cursor",
            "paginationPath": "meta.next_cursor",
            "paginationParam": "cursor",
            "itemsPath": "patients",
            "query": { "cursor": "0" },
        }),
    )
    .await;

    assert_eq!(out.len(), DIRECTORY_SIZE);
}

#[tokio::test]
async fn a_page_size_is_sent_on_the_very_first_request() {
    let api = fake_api::start().await;

    // Not sending it means the server picks its own, and every offset we
    // compute afterwards is measured against the wrong page.
    let out = fetch(
        &api,
        "/paged/offset",
        json!({
            "paginationMode": "offset",
            "paginationParam": "offset",
            "paginationSizeParam": "limit",
            "paginationPageSize": 50,
            "itemsPath": "data",
        }),
    )
    .await;

    assert_eq!(out.len(), DIRECTORY_SIZE);
    assert_eq!(
        api.requests(),
        6,
        "250 records at 50 a page, then a short one"
    );
}

#[tokio::test]
async fn a_page_size_of_zero_falls_back_instead_of_stopping_after_one_page() {
    let api = fake_api::start().await;

    // Zero would make every page "short", which ends the walk immediately and
    // silently returns a fraction of the directory.
    let out = fetch(
        &api,
        "/paged/offset",
        json!({
            "paginationMode": "offset",
            "paginationParam": "offset",
            "paginationSizeParam": "limit",
            "paginationPageSize": 0,
            "itemsPath": "data",
        }),
    )
    .await;

    assert_eq!(out.len(), DIRECTORY_SIZE);
}

// =================================================================== failure

#[tokio::test]
async fn a_page_that_fails_halfway_fails_the_run_rather_than_returning_a_partial_list() {
    let api = fake_api::start().await;

    // Half a directory presented as a whole one is worse than an error: the
    // downstream node would treat the missing patients as deleted.
    let result = run_chain(
        vec![node(
            "http",
            "httpRequest",
            json!({
                "method": "GET",
                "url": api.url("/boom"),
                "paginationMode": "cursor",
                "paginationPath": "next",
                "itemsPath": "items",
            }),
        )],
        vec![json!({})],
    )
    .await;

    let message = expect_failure(&result);
    assert!(message.contains("500"), "{message}");
}

#[tokio::test]
async fn each_input_item_walks_its_own_pages() {
    let api = fake_api::start().await;

    let result = run_chain(
        vec![node(
            "http",
            "httpRequest",
            json!({
                "method": "GET",
                "url": format!("{}?from={{{{ item.start }}}}", api.url("/paged/link")),
                "paginationMode": "link",
                "itemsPath": "items",
                "maxPages": 2,
            }),
        )],
        vec![json!({ "start": 0 }), json!({ "start": 100 })],
    )
    .await;

    let out = expect_success(&result);
    assert_eq!(
        out.len(),
        350,
        "200 from the first item, 150 from the second"
    );
}

// =============================================================== rate limits

#[tokio::test]
async fn a_service_that_names_a_wait_gets_that_wait_and_not_the_node_s_own() {
    let api = fake_api::start().await;

    // The node would retry after 50ms. The service asked for a second. Coming
    // back early spends quota that is already exhausted, which is how a brief
    // throttle turns into a long one.
    let started = std::time::Instant::now();
    let result = run_chain(
        vec![retrying(node(
            "http",
            "httpRequest",
            json!({ "method": "GET", "url": api.url("/throttled/1") }),
        ))],
        vec![json!({})],
    )
    .await;

    let out = expect_success(&result);
    assert_eq!(out[0]["body"]["ok"], json!(true));
    assert!(
        started.elapsed() >= std::time::Duration::from_secs(1),
        "waited only {:?}",
        started.elapsed()
    );
}

#[tokio::test]
async fn a_wait_longer_than_the_engine_will_ever_accept_fails_now_rather_than_later() {
    let api = fake_api::start().await;

    // A two-hour Retry-After is a refusal, not a delay. Sleeping on it would
    // hold an execution slot for two hours and then fail anyway; retrying
    // sooner would ignore what the service asked. So: fail immediately, with
    // the service's own words in the error.
    let started = std::time::Instant::now();
    let result = run_chain(
        vec![retrying(node(
            "http",
            "httpRequest",
            json!({ "method": "GET", "url": api.url("/throttled-until") }),
        ))],
        vec![json!({})],
    )
    .await;

    let message = expect_failure(&result);
    assert!(message.contains("503"), "{message}");
    assert!(started.elapsed() < std::time::Duration::from_secs(2));
}

#[tokio::test]
async fn a_throttle_still_fails_the_run_when_the_retries_are_used_up() {
    let api = fake_api::start().await;

    // Honouring Retry-After is not the same as retrying forever. One attempt
    // means one attempt.
    let result = run_chain(
        vec![node(
            "http",
            "httpRequest",
            json!({ "method": "GET", "url": api.url("/throttled/1") }),
        )],
        vec![json!({})],
    )
    .await;

    let message = expect_failure(&result);
    assert!(message.contains("429"), "{message}");
}
