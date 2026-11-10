//! What a node implementation gets handed when it runs.
//! Mirrors `node-execute-functions.ts` in n8n core.

use crate::binary::{BinaryMeta, BinaryStore, Carried, carry};
use crate::credentials::CredentialProvider;
use crate::errors::{CoreError, Result};
use crate::state::StagedState;
use crate::sub_workflows::SubWorkflows;
use r8r_workflow::interfaces::{Items, MAIN_PORT, Node};
use r8r_workflow::node_helpers;
use r8r_workflow::{Expression, stringify};
use serde_json::{Map, Value};
use std::collections::HashMap;

/// Port name -> items emitted on it.
pub type NodeOutput = HashMap<String, Items>;

/// Build a single-port output, the shape almost every node returns.
pub fn main_output(items: Items) -> NodeOutput {
    HashMap::from([(MAIN_PORT.to_string(), items)])
}

#[derive(Debug)]
pub struct ExecuteContext<'a> {
    pub node: &'a Node,
    pub input: &'a Items,
    pub expression: &'a Expression,
    /// Shared connection-pooled client; nodes must not build their own.
    pub http: &'a reqwest::Client,
    /// Decrypted credentials, resolved on demand by the server.
    pub credentials: &'a dyn CredentialProvider,
    /// The ability to run another workflow.
    pub sub_workflows: &'a dyn SubWorkflows,
    /// The workflows already running, outermost first — so a call that would
    /// loop can be refused naming them.
    pub chain: &'a [String],
    /// Values this run has asked to remember. Written only if it succeeds.
    pub staged_state: &'a StagedState,
    /// Somewhere to put files too big to carry in an item.
    pub binaries: &'a dyn BinaryStore,
    /// Which run this is, so a stored file can be cleaned up with it.
    pub execution_id: &'a str,
}

impl ExecuteContext<'_> {
    /// Put a file into an item value — inline if small, in the store if not.
    pub async fn carry_file(
        &self,
        meta: &BinaryMeta,
        bytes: Vec<u8>,
    ) -> crate::Result<serde_json::Value> {
        carry(self.binaries, self.execution_id, meta, bytes).await
    }

    /// Read a file a previous node put in an item, wherever it ended up.
    ///
    /// Nodes that consume files call this rather than reaching for a base64
    /// string, so a small file passed inline and a large one in the store are
    /// the same thing to them.
    pub async fn read_file(&self, value: &serde_json::Value) -> Option<Vec<u8>> {
        Carried::read(value)?.bytes(self.binaries).await.ok()
    }

    /// Node parameters with every `{{ }}` template resolved against item `idx`.
    ///
    /// Resolution is per item, because expressions almost always reference the
    /// item currently being processed.
    pub fn params(&self, idx: usize) -> Result<Value> {
        let item = self
            .input
            .get(idx)
            .cloned()
            .unwrap_or_else(|| Value::Object(Map::new()));
        Ok(self
            .expression
            .resolve(&self.node.parameters, &item, idx, self.input)?)
    }

    /// Parameters resolved against an empty item — for nodes that are
    /// configured once per run rather than once per item.
    pub fn static_params(&self) -> Result<Value> {
        Ok(self.expression.resolve(
            &self.node.parameters,
            &Value::Object(Map::new()),
            0,
            self.input,
        )?)
    }

    pub fn item(&self, idx: usize) -> Value {
        self.input
            .get(idx)
            .cloned()
            .unwrap_or_else(|| Value::Object(Map::new()))
    }

    /// Evaluate a raw script parameter (not a `{{ }}` template) for one item.
    pub fn eval(&self, script: &str, idx: usize) -> Result<Value> {
        Ok(self
            .expression
            .eval(script, &self.item(idx), idx, self.input)?)
    }

    pub fn eval_bool(&self, script: &str, idx: usize) -> Result<bool> {
        Ok(self
            .expression
            .eval_bool(script, &self.item(idx), idx, self.input)?)
    }

    /// A required string parameter — errors rather than silently sending "".
    pub fn require_str(&self, params: &Value, key: &str) -> Result<String> {
        match params.get(key) {
            Some(Value::Null) | None => Err(CoreError::Node(format!("`{key}` is required"))),
            Some(Value::String(s)) if s.trim().is_empty() => {
                Err(CoreError::Node(format!("`{key}` is required")))
            }
            Some(v) => Ok(stringify(v)),
        }
    }

    pub fn str_param(&self, params: &Value, key: &str, default: &str) -> String {
        node_helpers::str_param(params, key, default)
    }
    pub fn bool_param(&self, params: &Value, key: &str, default: bool) -> bool {
        node_helpers::bool_param(params, key, default)
    }
    pub fn num_param(&self, params: &Value, key: &str, default: f64) -> f64 {
        node_helpers::num_param(params, key, default)
    }
    pub fn object_param(&self, params: &Value, key: &str) -> Map<String, Value> {
        node_helpers::object_param(params, key)
    }

    /// Ask for a value to be remembered after this run succeeds.
    ///
    /// Not written now: a run that advances a watermark and then fails would
    /// skip the records it never processed, and nobody would notice.
    pub fn remember(&self, key: &str, value: Value) {
        self.staged_state.stage(key, value);
    }
}
