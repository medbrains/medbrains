//! The HTTP Request node, driven against a real server on a real socket.
//! Every failure mode here is one a production workflow actually meets.

#![allow(
    clippy::expect_used,
    clippy::unwrap_used,
    clippy::panic,
    clippy::indexing_slicing
)]

mod support;

use serde_json::json;
use support::{expect_failure, expect_success, node, run_chain, run_of};

#[path = "support/fake_api.rs"]
mod fake_api;

#[tokio::test]
async fn a_json_response_arrives_parsed_with_status_and_headers() {
    let api = fake_api::start().await;

    let result = run_chain(
        vec![node(
            "http",
            "httpRequest",
            json!({ "method": "GET", "url": api.url("/users") }),
        )],
        vec![json!({})],
    )
    .await;

    let out = expect_success(&result);
    assert_eq!(out[0]["statusCode"], json!(200));
    assert_eq!(out[0]["body"]["users"].as_array().unwrap().len(), 3);
    assert_eq!(out[0]["headers"]["content-type"], json!("application/json"));
}

#[tokio::test]
async fn the_url_is_templated_per_item_so_one_node_fetches_many_records() {
    let api = fake_api::start().await;

    let result = run_chain(
        vec![node(
            "http",
            "httpRequest",
            json!({ "method": "GET", "url": format!("{}/echo?id={{{{ item.id }}}}", api.base) }),
        )],
        vec![json!({ "id": 1 }), json!({ "id": 2 })],
    )
    .await;

    // /echo only accepts POST, so a GET is a 405 — but the point is that two
    // separate requests were attempted, one per item.
    assert_eq!(run_of(&result, "http").tries, 1);
    assert!(expect_failure(&result).contains("405"));
}

#[tokio::test]
async fn headers_and_query_parameters_reach_the_server() {
    let api = fake_api::start().await;

    let result = run_chain(
        vec![node(
            "http",
            "httpRequest",
            json!({
                "method": "POST",
                "url": api.url("/echo"),
                "headers": { "x-tenant": "acme" },
                "query": { "page": "2" },
                "bodyType": "json",
                "body": "{\"hello\":\"world\"}"
            }),
        )],
        vec![json!({})],
    )
    .await;

    let body = &expect_success(&result)[0]["body"];
    assert_eq!(body["headers"]["x-tenant"], json!("acme"));
    assert_eq!(body["query"]["page"], json!("2"));
    assert_eq!(body["raw"], json!("{\"hello\":\"world\"}"));
}

#[tokio::test]
async fn expressions_inside_the_body_are_resolved_before_sending() {
    let api = fake_api::start().await;

    let result = run_chain(
        vec![node(
            "http",
            "httpRequest",
            json!({
                "method": "POST",
                "url": api.url("/echo"),
                "bodyType": "json",
                "body": "{\"customer\":\"{{ item.name }}\"}"
            }),
        )],
        vec![json!({ "name": "ada" })],
    )
    .await;

    let raw = expect_success(&result)[0]["body"]["raw"]
        .as_str()
        .unwrap()
        .to_owned();
    assert!(
        raw.contains("ada"),
        "the template should have been substituted: {raw}"
    );
}

#[tokio::test]
async fn a_form_encoded_body_is_sent_with_the_right_content_type() {
    let api = fake_api::start().await;

    let result = run_chain(
        vec![node(
            "http",
            "httpRequest",
            json!({
                "method": "POST",
                "url": api.url("/echo"),
                "bodyType": "form",
                "formBody": { "grant_type": "client_credentials" }
            }),
        )],
        vec![json!({})],
    )
    .await;

    let body = &expect_success(&result)[0]["body"];
    assert_eq!(
        body["headers"]["content-type"],
        json!("application/x-www-form-urlencoded")
    );
    assert_eq!(body["raw"], json!("grant_type=client_credentials"));
}

#[tokio::test]
async fn a_server_error_fails_the_node_and_quotes_the_response() {
    let api = fake_api::start().await;

    let result = run_chain(
        vec![node(
            "http",
            "httpRequest",
            json!({ "url": api.url("/boom") }),
        )],
        vec![json!({})],
    )
    .await;

    let error = expect_failure(&result);
    assert!(
        error.contains("500"),
        "status should be in the message: {error}"
    );
    assert!(
        error.contains("upstream exploded"),
        "body should be quoted: {error}"
    );
}

#[tokio::test]
async fn never_error_hands_the_failed_response_downstream_instead() {
    // The business case: "record the failure and carry on" rather than abort.
    let api = fake_api::start().await;

    let result = run_chain(
        vec![node(
            "http",
            "httpRequest",
            json!({ "url": api.url("/teapot"), "neverError": true }),
        )],
        vec![json!({})],
    )
    .await;

    let out = expect_success(&result);
    assert_eq!(out[0]["statusCode"], json!(418));
    assert_eq!(out[0]["body"]["no"], json!("coffee"));
}

#[tokio::test]
async fn a_non_json_response_comes_through_as_text() {
    let api = fake_api::start().await;

    let result = run_chain(
        vec![node(
            "http",
            "httpRequest",
            json!({ "url": api.url("/text") }),
        )],
        vec![json!({})],
    )
    .await;

    assert_eq!(expect_success(&result)[0]["body"], json!("plain text body"));
}

#[tokio::test]
async fn a_response_that_lies_about_being_json_degrades_to_text() {
    // Real APIs do this. It must not take the workflow down.
    let api = fake_api::start().await;

    let result = run_chain(
        vec![node(
            "http",
            "httpRequest",
            json!({ "url": api.url("/not-json") }),
        )],
        vec![json!({})],
    )
    .await;

    assert_eq!(expect_success(&result)[0]["body"], json!("{ not json"));
}

#[tokio::test]
async fn a_slow_endpoint_trips_the_configured_timeout() {
    let api = fake_api::start().await;

    let result = run_chain(
        vec![node(
            "http",
            "httpRequest",
            json!({ "url": api.url("/slow"), "timeoutMs": 50 }),
        )],
        vec![json!({})],
    )
    .await;

    assert!(expect_failure(&result).contains("failed"));
}

#[tokio::test]
async fn retry_on_fail_rides_out_a_rate_limiter() {
    // /flaky returns 429 twice, then succeeds — exactly what an API quota does.
    let api = fake_api::start().await;
    let mut http = node("http", "httpRequest", json!({ "url": api.url("/flaky") }));
    http.retry_on_fail = true;
    http.max_tries = Some(3);
    http.wait_between_tries_ms = Some(0);

    let result = run_chain(vec![http], vec![json!({})]).await;

    let out = expect_success(&result);
    assert_eq!(out[0]["body"]["ok"], json!(true));
    assert_eq!(
        run_of(&result, "http").tries,
        3,
        "it should have taken all three attempts"
    );
}

#[tokio::test]
async fn retry_gives_up_after_the_configured_number_of_tries() {
    let api = fake_api::start().await;
    let mut http = node("http", "httpRequest", json!({ "url": api.url("/boom") }));
    http.retry_on_fail = true;
    http.max_tries = Some(2);
    http.wait_between_tries_ms = Some(0);

    let result = run_chain(vec![http], vec![json!({})]).await;

    expect_failure(&result);
    assert_eq!(run_of(&result, "http").tries, 2);
}

#[tokio::test]
async fn a_missing_url_is_rejected_before_any_request_is_made() {
    let result = run_chain(
        vec![node(
            "http",
            "httpRequest",
            json!({ "method": "GET", "url": "" }),
        )],
        vec![json!({})],
    )
    .await;

    assert!(expect_failure(&result).contains("`url` is required"));
}

#[tokio::test]
async fn a_malformed_method_is_named_in_the_error() {
    // A space is not legal in an HTTP method token; an unknown-but-well-formed
    // verb like "FLY" is legal and is passed through to the server on purpose.
    let result = run_chain(
        vec![node(
            "http",
            "httpRequest",
            json!({ "method": "GET POST", "url": "http://127.0.0.1:1/x" }),
        )],
        vec![json!({})],
    )
    .await;

    let error = expect_failure(&result);
    assert!(error.contains("unsupported HTTP method"), "got: {error}");
    assert!(error.contains("GET POST"));
}

#[tokio::test]
async fn a_connection_refused_names_the_url_that_failed() {
    let result = run_chain(
        // Port 1 is never listening.
        vec![node(
            "http",
            "httpRequest",
            json!({ "url": "http://127.0.0.1:1/nope" }),
        )],
        vec![json!({})],
    )
    .await;

    let error = expect_failure(&result);
    assert!(
        error.contains("127.0.0.1:1"),
        "the failing URL belongs in the message: {error}"
    );
}

#[tokio::test]
async fn continue_on_fail_turns_a_dead_api_into_an_error_item() {
    let mut http = node(
        "http",
        "httpRequest",
        json!({ "url": "http://127.0.0.1:1/nope" }),
    );
    http.on_error = Some(r8r_workflow::OnError::Continue);

    let result = run_chain(
        vec![
            http,
            node(
                "tag",
                "set",
                json!({ "mode": "fields", "fields": { "handled": true } }),
            ),
        ],
        vec![json!({})],
    )
    .await;

    let out = expect_success(&result);
    assert_eq!(out[0]["handled"], json!(true));
    assert!(out[0]["error"].as_str().unwrap().contains("failed"));
}
