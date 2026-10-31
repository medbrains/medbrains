//! Per-node behaviour, including the edge cases that break workflows in
//! production: missing fields, hostile input, broken upstream APIs.

#![allow(
    clippy::expect_used,
    clippy::unwrap_used,
    clippy::panic,
    clippy::indexing_slicing
)]

mod support;

use serde_json::{Value, json};
use support::{expect_failure, expect_success, node, output_on, run_chain, run_of};

fn items(values: &[Value]) -> Vec<Value> {
    values.to_vec()
}

// ==================================================================== set

#[tokio::test]
async fn set_adds_fields_without_touching_the_rest_of_the_item() {
    let result = run_chain(
        vec![node(
            "set",
            "set",
            json!({ "mode": "fields", "fields": { "greeting": "hi {{ item.name }}" } }),
        )],
        items(&[json!({ "name": "ada", "keep": true })]),
    )
    .await;

    let out = expect_success(&result);
    assert_eq!(out[0]["greeting"], json!("hi ada"));
    assert_eq!(out[0]["keep"], json!(true), "existing fields must survive");
}

#[tokio::test]
async fn set_keep_only_discards_everything_it_did_not_write() {
    let result = run_chain(
        vec![node(
            "set",
            "set",
            json!({
                "mode": "fields",
                "fields": { "id": "{{ item.id }}" },
                "keepOnlySet": true
            }),
        )],
        items(&[json!({ "id": 7, "secret": "do-not-leak" })]),
    )
    .await;

    let out = expect_success(&result);
    assert_eq!(out[0], json!({ "id": 7 }));
}

#[tokio::test]
async fn set_referencing_a_missing_field_yields_empty_rather_than_failing() {
    // A half-populated record is normal; it must not take the whole run down.
    let result = run_chain(
        vec![node(
            "set",
            "set",
            json!({ "mode": "fields", "fields": { "city": "{{ item.address.city }}" } }),
        )],
        items(&[json!({ "name": "ada" })]),
    )
    .await;

    let out = expect_success(&result);
    assert_eq!(out[0]["city"], Value::Null);
}

#[tokio::test]
async fn set_json_mode_replaces_the_item_entirely() {
    let result = run_chain(
        vec![node(
            "set",
            "set",
            json!({ "mode": "json", "json": "{\"only\": \"this\"}" }),
        )],
        items(&[json!({ "dropped": true })]),
    )
    .await;

    assert_eq!(expect_success(&result)[0], json!({ "only": "this" }));
}

#[tokio::test]
async fn set_json_mode_reports_malformed_json_clearly() {
    let result = run_chain(
        vec![node(
            "set",
            "set",
            json!({ "mode": "json", "json": "{ nope" }),
        )],
        items(&[json!({})]),
    )
    .await;

    assert!(expect_failure(&result).contains("invalid JSON"));
}

#[tokio::test]
async fn set_runs_once_per_item_not_once_per_node() {
    let result = run_chain(
        vec![node(
            "set",
            "set",
            json!({ "mode": "fields", "fields": { "n": "{{ item.n * 2 }}" } }),
        )],
        items(&[json!({ "n": 1 }), json!({ "n": 2 }), json!({ "n": 3 })]),
    )
    .await;

    let out = expect_success(&result);
    assert_eq!(out.len(), 3);
    assert_eq!(
        out.iter()
            .map(|i| i["n"].as_i64().unwrap())
            .collect::<Vec<_>>(),
        vec![2, 4, 6]
    );
}

// =================================================================== code

#[tokio::test]
async fn code_transforms_each_item_independently() {
    let result = run_chain(
        vec![node(
            "code",
            "code",
            json!({ "mode": "eachItem", "script": "item.total = item.qty * item.price; item" }),
        )],
        items(&[
            json!({ "qty": 2, "price": 5 }),
            json!({ "qty": 3, "price": 10 }),
        ]),
    )
    .await;

    let out = expect_success(&result);
    assert_eq!(out[0]["total"], json!(10));
    assert_eq!(out[1]["total"], json!(30));
}

#[tokio::test]
async fn code_returning_an_array_fans_out_into_several_items() {
    let result = run_chain(
        vec![node(
            "code",
            "code",
            json!({ "mode": "eachItem", "script": "[#{ half: item.n }, #{ half: item.n }]" }),
        )],
        items(&[json!({ "n": 1 })]),
    )
    .await;

    assert_eq!(expect_success(&result).len(), 2);
}

#[tokio::test]
async fn code_returning_unit_drops_the_item() {
    let result = run_chain(
        vec![node(
            "code",
            "code",
            json!({ "mode": "eachItem", "script": "if item.keep { item } else { () }" }),
        )],
        items(&[
            json!({ "keep": true, "id": 1 }),
            json!({ "keep": false, "id": 2 }),
        ]),
    )
    .await;

    let out = expect_success(&result);
    assert_eq!(out.len(), 1);
    assert_eq!(out[0]["id"], json!(1));
}

#[tokio::test]
async fn code_in_all_items_mode_sees_the_whole_batch_at_once() {
    let result = run_chain(
        vec![node(
            "code",
            "code",
            json!({ "mode": "allItems", "script": "#{ count: items.len() }" }),
        )],
        items(&[json!({}), json!({}), json!({})]),
    )
    .await;

    assert_eq!(expect_success(&result)[0]["count"], json!(3));
}

#[tokio::test]
async fn code_reports_a_script_error_with_its_message() {
    let result = run_chain(
        vec![node(
            "code",
            "code",
            json!({ "script": "this is not rhai (" }),
        )],
        items(&[json!({})]),
    )
    .await;

    let error = expect_failure(&result);
    assert!(
        error.contains("code"),
        "the failing node should be named: {error}"
    );
}

#[tokio::test]
async fn code_cannot_hang_the_worker_with_an_infinite_loop() {
    let result = run_chain(
        vec![node(
            "code",
            "code",
            json!({ "script": "let i = 0; loop { i += 1; }" }),
        )],
        items(&[json!({})]),
    )
    .await;

    expect_failure(&result);
}

#[tokio::test]
async fn code_preserves_unicode_and_emoji_intact() {
    let result = run_chain(
        vec![node(
            "code",
            "code",
            json!({ "script": "item.label = \"héllo 🚀 世界\"; item" }),
        )],
        items(&[json!({})]),
    )
    .await;

    assert_eq!(expect_success(&result)[0]["label"], json!("héllo 🚀 世界"));
}

#[tokio::test]
async fn code_returning_a_scalar_is_boxed_into_an_item() {
    let result = run_chain(
        vec![node("code", "code", json!({ "script": "item.n * 10" }))],
        items(&[json!({ "n": 4 })]),
    )
    .await;

    assert_eq!(expect_success(&result)[0], json!({ "value": 40 }));
}

// ===================================================================== if

#[tokio::test]
async fn if_splits_items_across_its_two_ports() {
    let result = run_chain(
        vec![node(
            "if",
            "if",
            json!({ "condition": "item.plan == \"pro\"" }),
        )],
        items(&[
            json!({ "id": 1, "plan": "pro" }),
            json!({ "id": 2, "plan": "free" }),
            json!({ "id": 3, "plan": "pro" }),
        ]),
    )
    .await;

    assert_eq!(output_on(&result, "if", "main").len(), 2);
    assert_eq!(output_on(&result, "if", "false").len(), 1);
    assert_eq!(output_on(&result, "if", "false")[0]["id"], json!(2));
}

#[tokio::test]
async fn if_treats_missing_fields_as_false_rather_than_erroring() {
    let result = run_chain(
        vec![node("if", "if", json!({ "condition": "item.flag" }))],
        items(&[json!({}), json!({ "flag": true })]),
    )
    .await;

    assert_eq!(output_on(&result, "if", "main").len(), 1);
    assert_eq!(output_on(&result, "if", "false").len(), 1);
}

#[tokio::test]
async fn if_on_a_webhook_field_is_false_when_run_by_hand_with_no_payload() {
    // Pressing Execute on a webhook workflow feeds a single empty item, so
    // `item.body` does not exist. That must route to the false branch, not
    // abort the run with an expression error.
    let result = run_chain(
        vec![node(
            "if",
            "if",
            json!({ "condition": "item.body.tier == \"vip\"" }),
        )],
        items(&[json!({})]),
    )
    .await;

    expect_success(&result);
    assert!(output_on(&result, "if", "main").is_empty());
    assert_eq!(output_on(&result, "if", "false").len(), 1);
}

#[tokio::test]
async fn if_sends_everything_down_one_side_when_all_items_agree() {
    let result = run_chain(
        vec![node("if", "if", json!({ "condition": "true" }))],
        items(&[json!({}), json!({})]),
    )
    .await;

    assert_eq!(output_on(&result, "if", "main").len(), 2);
    assert!(
        output_on(&result, "if", "false").is_empty(),
        "the empty side stays empty"
    );
}

// ================================================================= filter

#[tokio::test]
async fn filter_keeps_only_matching_items() {
    let result = run_chain(
        vec![node(
            "filter",
            "filter",
            json!({ "condition": "item.mrr > 0" }),
        )],
        items(&[
            json!({ "mrr": 99 }),
            json!({ "mrr": 0 }),
            json!({ "mrr": 149 }),
        ]),
    )
    .await;

    assert_eq!(expect_success(&result).len(), 2);
}

#[tokio::test]
async fn filtering_everything_out_starves_the_downstream_node() {
    // The business case: "notify me about failed payments" should send nothing
    // at all when there are none, not send an empty notification.
    let result = run_chain(
        vec![
            node("filter", "filter", json!({ "condition": "item.failed" })),
            node(
                "notify",
                "set",
                json!({ "mode": "fields", "fields": { "sent": "yes" } }),
            ),
        ],
        items(&[json!({ "failed": false })]),
    )
    .await;

    assert_eq!(
        run_of(&result, "notify").status,
        r8r_workflow::NodeRunStatus::Skipped
    );
}

// ============================================================== split out

#[tokio::test]
async fn split_out_turns_an_array_field_into_one_item_each() {
    let result = run_chain(
        vec![node("split", "splitOut", json!({ "field": "orders" }))],
        items(&[json!({ "orders": [{ "id": "a" }, { "id": "b" }] })]),
    )
    .await;

    let out = expect_success(&result);
    assert_eq!(out.len(), 2);
    assert_eq!(out[1]["id"], json!("b"));
}

#[tokio::test]
async fn split_out_follows_a_dotted_path_into_a_nested_payload() {
    let result = run_chain(
        vec![node(
            "split",
            "splitOut",
            json!({ "field": "body.data.rows" }),
        )],
        items(&[json!({ "body": { "data": { "rows": [1, 2, 3] } } })]),
    )
    .await;

    let out = expect_success(&result);
    assert_eq!(out.len(), 3);
    assert_eq!(
        out[0],
        json!({ "value": 1 }),
        "scalars are boxed into items"
    );
}

#[tokio::test]
async fn split_out_on_a_missing_field_produces_nothing() {
    let result = run_chain(
        vec![node("split", "splitOut", json!({ "field": "not.there" }))],
        items(&[json!({ "body": {} })]),
    )
    .await;

    assert!(output_on(&result, "split", "main").is_empty());
}

#[tokio::test]
async fn split_out_on_an_empty_array_produces_nothing() {
    let result = run_chain(
        vec![node("split", "splitOut", json!({ "field": "rows" }))],
        items(&[json!({ "rows": [] })]),
    )
    .await;

    assert!(output_on(&result, "split", "main").is_empty());
}

#[tokio::test]
async fn split_out_on_a_single_object_passes_it_through() {
    let result = run_chain(
        vec![node("split", "splitOut", json!({ "field": "order" }))],
        items(&[json!({ "order": { "id": "solo" } })]),
    )
    .await;

    assert_eq!(expect_success(&result)[0]["id"], json!("solo"));
}

// ============================================================== aggregate

#[tokio::test]
async fn aggregate_rolls_every_item_into_one() {
    let result = run_chain(
        vec![node("agg", "aggregate", json!({ "field": "rows" }))],
        items(&[json!({ "id": 1 }), json!({ "id": 2 })]),
    )
    .await;

    let out = expect_success(&result);
    assert_eq!(out.len(), 1);
    assert_eq!(out[0]["rows"].as_array().unwrap().len(), 2);
}

#[tokio::test]
async fn aggregate_then_split_out_is_a_round_trip() {
    let result = run_chain(
        vec![
            node("agg", "aggregate", json!({ "field": "rows" })),
            node("split", "splitOut", json!({ "field": "rows" })),
        ],
        items(&[json!({ "id": 1 }), json!({ "id": 2 }), json!({ "id": 3 })]),
    )
    .await;

    assert_eq!(expect_success(&result).len(), 3);
}

// =================================================================== wait

#[tokio::test]
async fn wait_passes_items_through_untouched() {
    let result = run_chain(
        vec![node("wait", "wait", json!({ "ms": 5 }))],
        items(&[json!({ "id": 1 })]),
    )
    .await;

    assert_eq!(expect_success(&result)[0]["id"], json!(1));
}

#[tokio::test]
async fn wait_clamps_an_absurd_delay_instead_of_hanging() {
    // A user typing "one year in ms" must not pin the worker for a year.
    let started = std::time::Instant::now();
    let result = run_chain(
        vec![node("wait", "wait", json!({ "ms": -50 }))],
        items(&[json!({})]),
    )
    .await;

    expect_success(&result);
    assert!(
        started.elapsed().as_millis() < 1000,
        "a negative wait must be instant"
    );
}
