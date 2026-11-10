//! Comparing two versions of a workflow.
//!
//! The audience for a diff is somebody whose workflow worked yesterday and
//! does not today. Every test here is phrased as that question.

#![allow(
    clippy::expect_used,
    clippy::unwrap_used,
    clippy::indexing_slicing,
    clippy::needless_pass_by_value
)]

use r8r_workflow::diff::{WorkflowDiff, diff};
use r8r_workflow::{Connection, Node, Workflow};
use serde_json::json;

fn node(id: &str, kind: &str, parameters: serde_json::Value) -> Node {
    serde_json::from_value(json!({
        "id": id, "type": kind, "name": id, "parameters": parameters
    }))
    .expect("node")
}

fn workflow(nodes: Vec<Node>, connections: Vec<Connection>) -> Workflow {
    Workflow {
        id: "wf".into(),
        name: "Nightly patient sync".into(),
        active: true,
        nodes,
        connections,
        settings: json!({}),
    }
}

fn edge(from: &str, to: &str) -> Connection {
    Connection {
        from: from.into(),
        to: to.into(),
        port: "main".into(),
    }
}

fn baseline() -> Workflow {
    workflow(
        vec![
            node("trigger", "scheduleTrigger", json!({ "cron": "0 2 * * *" })),
            node(
                "fetch",
                "httpRequest",
                json!({ "url": "https://api/patients", "timeoutMs": 30000 }),
            ),
            node("save", "medbrainsPatient", json!({ "operation": "upsert" })),
        ],
        vec![edge("trigger", "fetch"), edge("fetch", "save")],
    )
}

// ================================================================= no change

#[test]
fn saving_without_editing_anything_reports_no_change() {
    let unchanged = diff(&baseline(), &baseline());

    assert!(unchanged.is_empty());
    assert_eq!(unchanged.summary(), "No changes");
}

#[test]
fn moving_a_node_around_the_canvas_is_not_a_change() {
    // The most common edit there is, and never the cause of anything. Counting
    // it would bury the edits that matter under the ones that do not.
    let mut moved = baseline();
    moved.nodes[1].position = [400.0, 250.0];

    assert!(diff(&baseline(), &moved).is_empty());
}

#[test]
fn reordering_the_node_list_is_not_a_change() {
    // A JSON diff would call this every node changing. Nodes are compared by
    // identity, so the order they happen to be stored in does not matter.
    let mut reordered = baseline();
    reordered.nodes.reverse();
    reordered.connections.reverse();

    assert!(diff(&baseline(), &reordered).is_empty());
}

// ==================================================================== fields

#[test]
fn an_edited_parameter_names_the_setting_and_both_of_its_values() {
    // "The fetch step changed" is not actionable. "timeoutMs went from 30000
    // to 1" is the whole answer.
    let mut broken = baseline();
    broken.nodes[1].parameters = json!({ "url": "https://api/patients", "timeoutMs": 1 });

    let changed = diff(&baseline(), &broken);

    assert_eq!(changed.nodes_changed.len(), 1);
    let node = &changed.nodes_changed[0];
    assert_eq!(node.name, "fetch");
    assert_eq!(node.fields.len(), 1);
    assert_eq!(node.fields[0].path, "timeoutMs");
    assert_eq!(node.fields[0].before, Some(json!(30000)));
    assert_eq!(node.fields[0].after, Some(json!(1)));
}

#[test]
fn a_nested_parameter_is_reported_by_its_full_path() {
    // Reporting that `pagination` changed says nothing; reporting that
    // `pagination.maxPages` went to 1 says what will silently truncate.
    let before = workflow(
        vec![node(
            "fetch",
            "httpRequest",
            json!({
                "pagination": { "mode": "cursor", "maxPages": 200 }
            }),
        )],
        vec![],
    );
    let after = workflow(
        vec![node(
            "fetch",
            "httpRequest",
            json!({
                "pagination": { "mode": "cursor", "maxPages": 1 }
            }),
        )],
        vec![],
    );

    let changed = diff(&before, &after);

    assert_eq!(
        changed.nodes_changed[0].fields[0].path,
        "pagination.maxPages"
    );
    assert_eq!(changed.nodes_changed[0].fields[0].after, Some(json!(1)));
}

#[test]
fn a_parameter_that_was_removed_reads_as_removed_rather_than_as_null() {
    // A field set to null and a field that is gone behave differently at run
    // time, so the diff distinguishes them.
    let before = workflow(
        vec![node(
            "fetch",
            "httpRequest",
            json!({ "url": "x", "auth": "bearer" }),
        )],
        vec![],
    );
    let after = workflow(
        vec![node("fetch", "httpRequest", json!({ "url": "x" }))],
        vec![],
    );

    let field = &diff(&before, &after).nodes_changed[0].fields[0];

    assert_eq!(field.path, "auth");
    assert_eq!(field.before, Some(json!("bearer")));
    assert_eq!(field.after, None);
}

#[test]
fn a_new_parameter_reads_as_added() {
    let before = workflow(
        vec![node("fetch", "httpRequest", json!({ "url": "x" }))],
        vec![],
    );
    let after = workflow(
        vec![node(
            "fetch",
            "httpRequest",
            json!({ "url": "x", "itemsPath": "data" }),
        )],
        vec![],
    );

    let field = &diff(&before, &after).nodes_changed[0].fields[0];

    assert_eq!(field.path, "itemsPath");
    assert_eq!(field.before, None);
    assert_eq!(field.after, Some(json!("data")));
}

#[test]
fn changed_fields_come_back_in_a_stable_order() {
    // A history view that reshuffles its rows between reloads is one nobody
    // trusts.
    let before = workflow(
        vec![node(
            "fetch",
            "httpRequest",
            json!({ "z": 1, "a": 1, "m": 1 }),
        )],
        vec![],
    );
    let after = workflow(
        vec![node(
            "fetch",
            "httpRequest",
            json!({ "z": 2, "a": 2, "m": 2 }),
        )],
        vec![],
    );

    let changed = diff(&before, &after);
    let paths: Vec<&str> = changed.nodes_changed[0]
        .fields
        .iter()
        .map(|field| field.path.as_str())
        .collect();

    assert_eq!(paths, ["a", "m", "z"]);
}

// ============================================================ node settings

#[test]
fn switching_a_step_to_keep_going_on_failure_is_a_change() {
    // It lives outside `parameters`, and it changes what the workflow does
    // when something goes wrong — which is exactly when somebody reads a diff.
    let mut after = baseline();
    after.nodes[1].on_error = Some(r8r_workflow::OnError::ContinueRecord);

    let field = &diff(&baseline(), &after).nodes_changed[0].fields[0];

    assert_eq!(field.path, "onError");
    assert_eq!(field.after, Some(json!("continueRecord")));
}

#[test]
fn pointing_a_step_at_a_different_credential_is_a_change() {
    // The likeliest cause of "it worked in dev".
    let mut after = baseline();
    after.nodes[1]
        .credentials
        .insert("httpBearer".into(), "cred-prod".into());

    let field = &diff(&baseline(), &after).nodes_changed[0].fields[0];

    assert_eq!(field.path, "credentials");
    assert_eq!(field.after, Some(json!({ "httpBearer": "cred-prod" })));
}

#[test]
fn disabling_a_step_is_a_change_and_not_a_removal() {
    // A disabled node is still there. Reporting it as removed would send
    // somebody looking for a node that never left.
    let mut after = baseline();
    after.nodes[2].disabled = true;

    let changed = diff(&baseline(), &after);

    assert!(changed.nodes_removed.is_empty());
    assert_eq!(changed.nodes_changed[0].fields[0].path, "disabled");
}

// ============================================================ shape changes

#[test]
fn an_added_step_is_named_by_what_it_is() {
    let mut after = baseline();
    after
        .nodes
        .push(node("notify", "slack", json!({ "channel": "#ops" })));

    let changed = diff(&baseline(), &after);

    assert_eq!(changed.nodes_added.len(), 1);
    assert_eq!(changed.nodes_added[0].name, "notify");
    assert_eq!(changed.nodes_added[0].kind, "slack");
    assert!(changed.nodes_changed.is_empty());
}

#[test]
fn a_deleted_step_is_reported_with_the_connections_that_went_with_it() {
    // Somebody deleting the save step needs to see that the workflow no longer
    // writes anything, and that the edge feeding it is gone too.
    let mut after = baseline();
    after.nodes.retain(|node| node.id != "save");
    after.connections.retain(|edge| edge.to != "save");

    let changed = diff(&baseline(), &after);

    assert_eq!(changed.nodes_removed[0].id, "save");
    assert_eq!(changed.connections_removed.len(), 1);
    assert_eq!(changed.connections_removed[0].to, "save");
}

#[test]
fn rewiring_two_steps_shows_both_the_new_edge_and_the_old_one() {
    let mut after = baseline();
    after.connections = vec![edge("trigger", "save"), edge("save", "fetch")];

    let changed = diff(&baseline(), &after);

    assert_eq!(changed.connections_added.len(), 2);
    assert_eq!(changed.connections_removed.len(), 2);
    assert!(changed.nodes_changed.is_empty(), "no node itself changed");
}

#[test]
fn moving_an_edge_to_a_different_port_is_a_rewiring() {
    // Same two steps, different branch of an `if`. The workflow does something
    // else entirely, and comparing only endpoints would miss it.
    let before = workflow(
        vec![],
        vec![Connection {
            from: "check".into(),
            to: "notify".into(),
            port: "true".into(),
        }],
    );
    let after = workflow(
        vec![],
        vec![Connection {
            from: "check".into(),
            to: "notify".into(),
            port: "false".into(),
        }],
    );

    let changed = diff(&before, &after);

    assert_eq!(changed.connections_added[0].port, "false");
    assert_eq!(changed.connections_removed[0].port, "true");
}

#[test]
fn renaming_the_workflow_is_reported_with_both_names() {
    let mut after = baseline();
    after.name = "Nightly patient sync (disabled)".into();

    let renamed = diff(&baseline(), &after).renamed.expect("renamed");

    assert_eq!(renamed.0, "Nightly patient sync");
    assert_eq!(renamed.1, "Nightly patient sync (disabled)");
}

#[test]
fn a_workflow_setting_is_compared_like_any_other_field() {
    let mut after = baseline();
    after.settings = json!({ "timezone": "Asia/Kolkata" });

    let changed = diff(&baseline(), &after);

    assert_eq!(changed.settings_changed[0].path, "timezone");
    assert_eq!(
        changed.settings_changed[0].after,
        Some(json!("Asia/Kolkata"))
    );
}

// ================================================================== summary

#[test]
fn the_summary_counts_what_happened_in_words() {
    // This is the line a history list shows per version, so it has to read
    // like something a person wrote.
    let mut after = baseline();
    after.nodes.push(node("notify", "slack", json!({})));
    after.nodes[1].parameters = json!({ "url": "https://api/v2/patients", "timeoutMs": 30000 });
    after.connections.push(edge("save", "notify"));

    let summary = diff(&baseline(), &after).summary();

    assert_eq!(summary, "1 step added, 1 step edited, 1 connection changed");
}

#[test]
fn the_summary_pluralises() {
    let mut after = baseline();
    after.nodes.push(node("a", "noOp", json!({})));
    after.nodes.push(node("b", "noOp", json!({})));

    assert_eq!(diff(&baseline(), &after).summary(), "2 steps added");
}

#[test]
fn an_empty_workflow_compared_with_a_full_one_reports_every_step_as_added() {
    // The first save of a workflow: version 1 has everything in it.
    let empty = workflow(vec![], vec![]);
    let changed = diff(&empty, &baseline());

    assert_eq!(changed.nodes_added.len(), 3);
    assert_eq!(changed.connections_added.len(), 2);
}

#[test]
fn a_diff_survives_the_json_it_is_sent_to_the_editor_as() {
    let mut after = baseline();
    after.nodes[1].parameters = json!({ "url": "x" });

    let changed = diff(&baseline(), &after);
    let round_tripped: WorkflowDiff =
        serde_json::from_str(&serde_json::to_string(&changed).expect("encode")).expect("decode");

    assert_eq!(round_tripped, changed);
}
