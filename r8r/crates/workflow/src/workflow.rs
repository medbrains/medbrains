//! The `Workflow` aggregate — nodes plus connections, and the queries the
//! engine and server ask of them. Mirrors `packages/workflow/src/workflow.ts`.

use crate::interfaces::{Connection, Node};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Workflow {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub active: bool,
    #[serde(default)]
    pub nodes: Vec<Node>,
    #[serde(default)]
    pub connections: Vec<Connection>,
    #[serde(default)]
    pub settings: serde_json::Value,
}

impl Workflow {
    pub fn node(&self, id: &str) -> Option<&Node> {
        self.nodes.iter().find(|n| n.id == id)
    }

    pub fn node_by_name(&self, name: &str) -> Option<&Node> {
        self.nodes.iter().find(|n| n.name == name)
    }

    pub fn connections_from(&self, id: &str) -> impl Iterator<Item = &Connection> {
        self.connections.iter().filter(move |c| c.from == id)
    }

    pub fn connections_to(&self, id: &str) -> impl Iterator<Item = &Connection> {
        self.connections.iter().filter(move |c| c.to == id)
    }

    /// Nodes with no incoming connection that are of a trigger type.
    ///
    /// `is_trigger` is injected because knowing which types are triggers lives
    /// in the node registry, which this crate deliberately does not depend on.
    pub fn trigger_nodes(&self, is_trigger: impl Fn(&str) -> bool) -> Vec<&Node> {
        self.nodes
            .iter()
            .filter(|n| !n.disabled && is_trigger(&n.kind))
            .collect()
    }

    /// Structural problems worth blocking a save over.
    pub fn validate(&self) -> Vec<String> {
        let mut errs = Vec::new();
        let mut ids = std::collections::HashSet::new();
        for n in &self.nodes {
            if n.id.is_empty() {
                errs.push("a node has an empty id".into());
            } else if !ids.insert(&n.id) {
                errs.push(format!("duplicate node id `{}`", n.id));
            }
        }
        for c in &self.connections {
            if self.node(&c.from).is_none() {
                errs.push(format!("connection from unknown node `{}`", c.from));
            }
            if self.node(&c.to).is_none() {
                errs.push(format!("connection to unknown node `{}`", c.to));
            }
        }
        errs
    }
}
