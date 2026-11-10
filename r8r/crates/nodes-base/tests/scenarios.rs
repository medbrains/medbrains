//! Whole workflows a business would actually run, asserted on the outcome the
//! business cares about rather than on node internals.

#![allow(
    clippy::expect_used,
    clippy::unwrap_used,
    clippy::panic,
    clippy::indexing_slicing
)]

mod support;

#[path = "support/fake_api.rs"]
mod fake_api;

use r8r_workflow::Workflow;
use r8r_workflow::interfaces::NodeRunStatus;
use serde_json::json;
use support::{edge, expect_success, node, output_on, port_edge, run_of, run_workflow};

/// Fetch customers, keep the paying ones, and shape them for a billing report.
#[tokio::test]
async fn revenue_report_only_counts_paying_customers() {
    let api = fake_api::start().await;

    let workflow = Workflow {
        nodes: vec![
            node("trigger", "manual", json!({})),
            node("fetch", "httpRequest", json!({ "url": api.url("/users") })),
            node("split", "splitOut", json!({ "field": "body.users" })),
            node("paying", "filter", json!({ "condition": "item.mrr > 0" })),
            node(
                "shape",
                "set",
                json!({
                    "mode": "fields",
                    "keepOnlySet": true,
                    "fields": { "customer": "{{ item.name }}", "monthly": "{{ item.mrr }}" }
                }),
            ),
            node("total", "aggregate", json!({ "field": "lines" })),
        ],
        connections: vec![
            edge("trigger", "fetch"),
            edge("fetch", "split"),
            edge("split", "paying"),
            edge("paying", "shape"),
            edge("shape", "total"),
        ],
        ..Default::default()
    };

    let result = run_workflow(workflow, vec![json!({})]).await;
    let out = expect_success(&result);

    let lines = out[0]["lines"].as_array().unwrap();
    assert_eq!(lines.len(), 2, "the free-plan customer must be excluded");
    let names: Vec<&str> = lines
        .iter()
        .map(|l| l["customer"].as_str().unwrap())
        .collect();
    assert_eq!(names, vec!["Ada", "Linus"]);
    assert_eq!(lines[0]["monthly"], json!(99));
}

/// Route incoming support tickets: urgent ones get escalated, the rest queued.
#[tokio::test]
async fn ticket_triage_sends_each_ticket_down_exactly_one_path() {
    let workflow = Workflow {
        nodes: vec![
            node("hook", "manual", json!({})),
            node(
                "urgent",
                "if",
                json!({ "condition": "item.priority == \"p1\"" }),
            ),
            node(
                "escalate",
                "set",
                json!({
                    "mode": "fields",
                    "fields": { "route": "pager", "ticket": "{{ item.id }}" }
                }),
            ),
            node(
                "queue",
                "set",
                json!({ "mode": "fields", "fields": { "route": "backlog", "ticket": "{{ item.id }}" } }),
            ),
            node("collect", "merge", json!({})),
        ],
        connections: vec![
            edge("hook", "urgent"),
            port_edge("urgent", "escalate", "main"),
            port_edge("urgent", "queue", "false"),
            edge("escalate", "collect"),
            edge("queue", "collect"),
        ],
        ..Default::default()
    };

    let result = run_workflow(
        workflow,
        vec![
            json!({ "id": "T-1", "priority": "p1" }),
            json!({ "id": "T-2", "priority": "p3" }),
            json!({ "id": "T-3", "priority": "p1" }),
        ],
    )
    .await;

    let collected = expect_success(&result);
    assert_eq!(
        collected.len(),
        3,
        "every ticket is accounted for exactly once"
    );

    let paged = collected
        .iter()
        .filter(|t| t["route"] == json!("pager"))
        .count();
    assert_eq!(paged, 2);
    assert_eq!(
        output_on(&result, "queue", "main")[0]["ticket"],
        json!("T-2")
    );
}

/// A quiet day: no urgent tickets, so the pager branch must stay silent.
#[tokio::test]
async fn nobody_is_paged_when_no_ticket_is_urgent() {
    let workflow = Workflow {
        nodes: vec![
            node("hook", "manual", json!({})),
            node(
                "urgent",
                "if",
                json!({ "condition": "item.priority == \"p1\"" }),
            ),
            node(
                "escalate",
                "set",
                json!({ "mode": "fields", "fields": { "paged": true } }),
            ),
        ],
        connections: vec![
            edge("hook", "urgent"),
            port_edge("urgent", "escalate", "main"),
        ],
        ..Default::default()
    };

    let result = run_workflow(workflow, vec![json!({ "id": "T-9", "priority": "p4" })]).await;

    assert_eq!(
        run_of(&result, "escalate").status,
        NodeRunStatus::Skipped,
        "an empty branch must not fire the pager"
    );
}

/// An enrichment step against a flaky vendor must not lose the order; the
/// order should continue with the failure recorded on it.
#[tokio::test]
async fn an_order_survives_an_enrichment_vendor_being_down() {
    let mut enrich = node(
        "enrich",
        "httpRequest",
        json!({ "url": "http://127.0.0.1:1/enrich" }),
    );
    enrich.on_error = Some(r8r_workflow::OnError::Continue);

    let workflow = Workflow {
        nodes: vec![
            node("trigger", "manual", json!({})),
            enrich,
            node(
                "record",
                "code",
                json!({
                    "mode": "eachItem",
                    "script": "#{ enriched: item.error == (), note: \"processed\" }"
                }),
            ),
        ],
        connections: vec![edge("trigger", "enrich"), edge("enrich", "record")],
        ..Default::default()
    };

    let result = run_workflow(workflow, vec![json!({ "order": "O-1" })]).await;

    let out = expect_success(&result);
    assert_eq!(
        out[0]["note"],
        json!("processed"),
        "the order still went through"
    );
    assert_eq!(
        out[0]["enriched"],
        json!(false),
        "and it knows enrichment failed"
    );
}

/// Two independent lookups feeding one summary — the fan-out/fan-in shape.
#[tokio::test]
async fn a_summary_waits_for_both_of_its_inputs() {
    let api = fake_api::start().await;

    let workflow = Workflow {
        nodes: vec![
            node("trigger", "manual", json!({})),
            node("left", "httpRequest", json!({ "url": api.url("/users") })),
            node("right", "httpRequest", json!({ "url": api.url("/text") })),
            node("summary", "aggregate", json!({ "field": "sources" })),
        ],
        connections: vec![
            edge("trigger", "left"),
            edge("trigger", "right"),
            edge("left", "summary"),
            edge("right", "summary"),
        ],
        ..Default::default()
    };

    let result = run_workflow(workflow, vec![json!({})]).await;
    let out = expect_success(&result);

    assert_eq!(
        out[0]["sources"].as_array().unwrap().len(),
        2,
        "the summary must see both lookups"
    );
}

/// Deduplicate a batch before writing it anywhere — a very common first step.
#[tokio::test]
async fn a_batch_can_be_deduplicated_before_it_is_written() {
    let workflow = Workflow {
        nodes: vec![
            node("trigger", "manual", json!({})),
            node(
                "dedupe",
                "code",
                json!({
                    "mode": "allItems",
                    "script": r"
                        let seen = #{};
                        let unique = [];
                        for row in items {
                            let key = row.email;
                            if !seen.contains(key) {
                                seen[key] = true;
                                unique.push(row);
                            }
                        }
                        unique
                    "
                }),
            ),
        ],
        connections: vec![edge("trigger", "dedupe")],
        ..Default::default()
    };

    let result = run_workflow(
        workflow,
        vec![
            json!({ "email": "a@example.com", "name": "first" }),
            json!({ "email": "b@example.com", "name": "second" }),
            json!({ "email": "a@example.com", "name": "duplicate" }),
        ],
    )
    .await;

    let out = expect_success(&result);
    assert_eq!(out.len(), 2);
    assert_eq!(out[0]["name"], json!("first"), "the first occurrence wins");
}

/// A later node reading an earlier node's output by name, which is how
/// multi-step workflows carry context forward.
#[tokio::test]
async fn a_later_step_can_read_an_earlier_steps_output_by_name() {
    let workflow = Workflow {
        nodes: vec![
            node("trigger", "manual", json!({})),
            node(
                "Lookup",
                "set",
                json!({ "mode": "fields", "fields": { "region": "emea" } }),
            ),
            node("Split", "splitOut", json!({ "field": "line_items" })),
            node(
                "Label",
                "set",
                json!({
                    "mode": "fields",
                    "fields": { "region": "{{ nodes[\"Lookup\"][0].region }}" }
                }),
            ),
        ],
        connections: vec![
            edge("trigger", "Lookup"),
            edge("Lookup", "Split"),
            edge("Split", "Label"),
        ],
        ..Default::default()
    };

    let result = run_workflow(
        workflow,
        vec![json!({ "line_items": [{ "sku": "A" }, { "sku": "B" }] })],
    )
    .await;

    let out = expect_success(&result);
    assert_eq!(out.len(), 2);
    assert!(out.iter().all(|item| item["region"] == json!("emea")));
}

/// An empty upstream result should end the run quietly, not crash it.
#[tokio::test]
async fn an_empty_payload_ends_the_run_without_an_error() {
    let workflow = Workflow {
        nodes: vec![
            node("trigger", "manual", json!({})),
            node("split", "splitOut", json!({ "field": "rows" })),
            node(
                "write",
                "set",
                json!({ "mode": "fields", "fields": { "written": true } }),
            ),
        ],
        connections: vec![edge("trigger", "split"), edge("split", "write")],
        ..Default::default()
    };

    let result = run_workflow(workflow, vec![json!({ "rows": [] })]).await;

    assert_eq!(
        result.status,
        r8r_workflow::interfaces::ExecutionStatus::Success
    );
    assert_eq!(run_of(&result, "write").status, NodeRunStatus::Skipped);
}
