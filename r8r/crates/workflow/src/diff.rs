//! What changed between two versions of a workflow.
//!
//! A JSON diff would answer this too, and answer it uselessly: a reordered
//! node array reads as every node changing, and a moved node reads the same as
//! a rewritten one. What somebody looking at a broken workflow needs to know
//! is which *step* changed and which *setting* inside it — so this compares
//! nodes by identity and reports parameters by name.
//!
//! Moving a node around the canvas is deliberately not a change. It is the
//! most common edit and never the cause of anything.

use crate::interfaces::{Connection, Node};
use crate::workflow::Workflow;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::BTreeMap;

/// Everything that differs between two workflows.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowDiff {
    /// The workflow was renamed. `(before, after)`.
    pub renamed: Option<(String, String)>,
    pub nodes_added: Vec<NodeSummary>,
    pub nodes_removed: Vec<NodeSummary>,
    pub nodes_changed: Vec<NodeChange>,
    pub connections_added: Vec<Connection>,
    pub connections_removed: Vec<Connection>,
    /// Workflow-level settings, compared field by field.
    pub settings_changed: Vec<FieldChange>,
}

/// Enough to name a node in a list without loading the whole thing.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeSummary {
    pub id: String,
    pub name: String,
    pub kind: String,
}

/// What changed inside one node that exists in both versions.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeChange {
    pub id: String,
    pub name: String,
    pub kind: String,
    /// Parameters and settings that differ, by dot path.
    pub fields: Vec<FieldChange>,
}

/// One setting, before and after. `None` means it was not set.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldChange {
    pub path: String,
    pub before: Option<Value>,
    pub after: Option<Value>,
}

impl WorkflowDiff {
    /// Whether anything at all changed.
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.renamed.is_none()
            && self.nodes_added.is_empty()
            && self.nodes_removed.is_empty()
            && self.nodes_changed.is_empty()
            && self.connections_added.is_empty()
            && self.connections_removed.is_empty()
            && self.settings_changed.is_empty()
    }

    /// A one-line summary, for a history list where the full diff would not fit.
    #[must_use]
    pub fn summary(&self) -> String {
        if self.is_empty() {
            return "No changes".to_owned();
        }

        let mut parts = Vec::new();
        push_count(
            &mut parts,
            self.nodes_added.len(),
            "step added",
            "steps added",
        );
        push_count(
            &mut parts,
            self.nodes_removed.len(),
            "step removed",
            "steps removed",
        );
        push_count(
            &mut parts,
            self.nodes_changed.len(),
            "step edited",
            "steps edited",
        );
        let rewired = self.connections_added.len() + self.connections_removed.len();
        push_count(
            &mut parts,
            rewired,
            "connection changed",
            "connections changed",
        );
        push_count(
            &mut parts,
            self.settings_changed.len(),
            "setting changed",
            "settings changed",
        );
        if self.renamed.is_some() {
            parts.push("renamed".to_owned());
        }

        parts.join(", ")
    }
}

fn push_count(parts: &mut Vec<String>, count: usize, one: &str, many: &str) {
    match count {
        0 => {}
        1 => parts.push(format!("1 {one}")),
        n => parts.push(format!("{n} {many}")),
    }
}

/// Compare two versions of a workflow.
#[must_use]
pub fn diff(before: &Workflow, after: &Workflow) -> WorkflowDiff {
    let old: BTreeMap<&str, &Node> = before.nodes.iter().map(|n| (n.id.as_str(), n)).collect();
    let new: BTreeMap<&str, &Node> = after.nodes.iter().map(|n| (n.id.as_str(), n)).collect();

    let nodes_added = new
        .iter()
        .filter(|(id, _)| !old.contains_key(*id))
        .map(|(_, node)| summarise(node))
        .collect();
    let nodes_removed = old
        .iter()
        .filter(|(id, _)| !new.contains_key(*id))
        .map(|(_, node)| summarise(node))
        .collect();

    let nodes_changed = old
        .iter()
        .filter_map(|(id, was)| new.get(id).map(|is| (was, is)))
        .filter_map(|(was, is)| node_change(was, is))
        .collect();

    let (connections_added, connections_removed) = connection_changes(before, after);

    WorkflowDiff {
        renamed: (before.name != after.name).then(|| (before.name.clone(), after.name.clone())),
        nodes_added,
        nodes_removed,
        nodes_changed,
        connections_added,
        connections_removed,
        settings_changed: field_changes(&before.settings, &after.settings, ""),
    }
}

fn summarise(node: &Node) -> NodeSummary {
    NodeSummary {
        id: node.id.clone(),
        name: node.label().to_owned(),
        kind: node.kind.clone(),
    }
}

/// What differs inside one node, or `None` if only its position moved.
fn node_change(was: &Node, is: &Node) -> Option<NodeChange> {
    let mut fields = field_changes(&was.parameters, &is.parameters, "");

    // Node settings live outside `parameters` but are just as much a change:
    // switching a step to "keep going on failure" changes what the workflow
    // does, and would be invisible if only parameters were compared.
    compare(&mut fields, "name", &was.name, &is.name);
    compare(&mut fields, "type", &was.kind, &is.kind);
    compare(&mut fields, "disabled", &was.disabled, &is.disabled);
    compare(&mut fields, "onError", &was.on_error, &is.on_error);
    compare(
        &mut fields,
        "retryOnFail",
        &was.retry_on_fail,
        &is.retry_on_fail,
    );
    compare(&mut fields, "maxTries", &was.max_tries, &is.max_tries);
    compare(
        &mut fields,
        "waitBetweenTriesMs",
        &was.wait_between_tries_ms,
        &is.wait_between_tries_ms,
    );
    compare(&mut fields, "notes", &was.notes, &is.notes);
    compare(
        &mut fields,
        "credentials",
        &was.credentials,
        &is.credentials,
    );

    if fields.is_empty() {
        return None;
    }
    fields.sort_by(|a, b| a.path.cmp(&b.path));

    Some(NodeChange {
        id: is.id.clone(),
        name: is.label().to_owned(),
        kind: is.kind.clone(),
        fields,
    })
}

fn compare<T: Serialize + PartialEq>(fields: &mut Vec<FieldChange>, path: &str, was: &T, is: &T) {
    if was == is {
        return;
    }
    fields.push(FieldChange {
        path: path.to_owned(),
        before: serde_json::to_value(was).ok(),
        after: serde_json::to_value(is).ok(),
    });
}

/// Compare two JSON objects field by field, descending into nested objects.
///
/// Descending matters because a node's parameters are nested: reporting that
/// `options` changed says nothing, while reporting that `options.timeoutMs`
/// went from 30000 to 1 says exactly what broke.
fn field_changes(before: &Value, after: &Value, prefix: &str) -> Vec<FieldChange> {
    let (Some(old), Some(new)) = (before.as_object(), after.as_object()) else {
        // Not both objects: either it is a scalar, or the shape itself changed.
        if before == after {
            return Vec::new();
        }
        return vec![FieldChange {
            path: prefix.to_owned(),
            before: Some(before.clone()),
            after: Some(after.clone()),
        }];
    };

    let mut changes = Vec::new();
    for key in keys_of(old, new) {
        let path = if prefix.is_empty() {
            key.clone()
        } else {
            format!("{prefix}.{key}")
        };
        match (old.get(&key), new.get(&key)) {
            (Some(was), Some(is)) if was == is => {}
            (Some(was), Some(is)) if was.is_object() && is.is_object() => {
                changes.extend(field_changes(was, is, &path));
            }
            (was, is) => changes.push(FieldChange {
                path,
                before: was.cloned(),
                after: is.cloned(),
            }),
        }
    }
    changes
}

/// Every key in either object, in a stable order so two runs agree.
fn keys_of(old: &Map<String, Value>, new: &Map<String, Value>) -> Vec<String> {
    let mut keys: Vec<String> = old.keys().chain(new.keys()).cloned().collect();
    keys.sort();
    keys.dedup();
    keys
}

fn connection_changes(before: &Workflow, after: &Workflow) -> (Vec<Connection>, Vec<Connection>) {
    let key = |c: &Connection| (c.from.clone(), c.port.clone(), c.to.clone());
    let old: std::collections::BTreeSet<_> = before.connections.iter().map(key).collect();
    let new: std::collections::BTreeSet<_> = after.connections.iter().map(key).collect();

    let added = after
        .connections
        .iter()
        .filter(|c| !old.contains(&key(c)))
        .cloned()
        .collect();
    let removed = before
        .connections
        .iter()
        .filter(|c| !new.contains(&key(c)))
        .cloned()
        .collect();
    (added, removed)
}
