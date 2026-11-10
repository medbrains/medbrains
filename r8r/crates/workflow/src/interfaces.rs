//! Core data shapes shared by every crate — the Rust answer to
//! `packages/workflow/src/interfaces.ts`.

use crate::display_options::DisplayOptions;
use crate::routing::Routing;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::HashMap;

/// One unit of data flowing between nodes. n8n calls this `INodeExecutionData`.
pub type NodeExecutionData = Value;
pub type Items = Vec<NodeExecutionData>;

pub const MAIN_PORT: &str = "main";
/// Where records that failed go when a node isolates them.
pub const ERROR_PORT: &str = "error";

pub fn main_port() -> String {
    MAIN_PORT.to_string()
}

// ------------------------------------------------------------------ the graph

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Node {
    pub id: String,
    /// Node type name, e.g. `httpRequest`. Matches a `NodeTypeDescription.name`.
    #[serde(rename = "type")]
    pub kind: String,
    #[serde(default)]
    pub name: String,
    #[serde(default = "empty_object")]
    pub parameters: Value,
    #[serde(default)]
    pub position: [f64; 2],
    #[serde(default)]
    pub disabled: bool,
    /// What to do when this node fails. `None` means [`OnError::Stop`].
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub on_error: Option<OnError>,
    /// Optional per-node retry, applied by the execution engine.
    #[serde(default)]
    pub retry_on_fail: bool,
    #[serde(default)]
    pub max_tries: Option<u32>,
    #[serde(default)]
    pub wait_between_tries_ms: Option<u64>,
    #[serde(default)]
    pub notes: Option<String>,
    /// Credential type name -> stored credential id.
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub credentials: HashMap<String, String>,
}

/// How the engine reacts when a node returns an error.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum OnError {
    /// Abort the execution. The default, so a broken step is never silent.
    #[default]
    Stop,
    /// Emit `{ error, node }` downstream and keep going.
    Continue,
    /// Isolate each record: process the items one at a time, pass the ones
    /// that worked downstream, and send the ones that failed to the `error`
    /// port with the record that caused it.
    ///
    /// The alternative — what [`OnError::Continue`] does — is to lose the
    /// whole batch because one record in it was bad. Importing 250 patients
    /// and discarding 249 of them because one had a malformed date is not a
    /// tradeoff anybody would choose if asked.
    ContinueRecord,
}

fn empty_object() -> Value {
    Value::Object(Map::default())
}

impl Node {
    /// Human label used in errors, expressions and the UI.
    pub fn label(&self) -> &str {
        if self.name.is_empty() {
            &self.kind
        } else {
            &self.name
        }
    }
    pub fn continues_on_fail(&self) -> bool {
        matches!(
            self.on_error.unwrap_or_default(),
            OnError::Continue | OnError::ContinueRecord
        )
    }

    /// Whether a failing record should take the rest of the batch down with it.
    pub fn isolates_records(&self) -> bool {
        self.on_error.unwrap_or_default() == OnError::ContinueRecord
    }
    pub fn param(&self, key: &str) -> Option<&Value> {
        self.parameters.get(key)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Connection {
    pub from: String,
    pub to: String,
    /// Output port on `from`. Most nodes only expose `main`; `if` adds `false`.
    #[serde(default = "main_port")]
    pub port: String,
}

// ------------------------------------------------------------ node type descr

/// Palette grouping, used by the editor to bucket the node list.
#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum NodeGroup {
    Trigger,
    Input,
    Output,
    #[default]
    Transform,
    Flow,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum NodePropertyKind {
    String,
    MultilineString,
    Number,
    Boolean,
    Options,
    Json,
    Code,
    KeyValue,
    Collection,
    /// Source-to-destination field mapping, rendered as two columns with
    /// automatic matching.
    FieldMapper,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PropertyOption {
    pub name: String,
    pub value: Value,
    /// Short sentence describing what choosing this option does.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub action: Option<String>,
    /// For an `operation` option: the request this operation makes. Present
    /// only on declarative integration nodes.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub routing: Option<Routing>,
}

impl PropertyOption {
    pub fn new(name: &str, value: &str) -> Self {
        PropertyOption {
            name: name.into(),
            value: Value::String(value.into()),
            action: None,
            routing: None,
        }
    }

    /// Attach the request this option performs — how a declarative node turns
    /// "Send Message" into `POST /chat.postMessage`.
    #[must_use]
    pub fn routes(mut self, routing: Routing) -> Self {
        self.routing = Some(routing);
        self
    }

    #[must_use]
    pub fn describes(mut self, action: &str) -> Self {
        self.action = Some(action.into());
        self
    }
}

/// A single configurable field. The editor renders its parameter panel straight
/// from this list, so adding a node never means touching the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeProperty {
    pub name: String,
    pub display_name: String,
    #[serde(rename = "type")]
    pub kind: NodePropertyKind,
    #[serde(default)]
    pub default: Value,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub options: Vec<PropertyOption>,
    #[serde(default)]
    pub required: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub placeholder: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// Secret: the editor masks it and the API never returns it.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub password: bool,
    /// When this field is visible, given the node's other parameters.
    #[serde(default, skip_serializing_if = "DisplayOptions::is_empty")]
    pub display_options: DisplayOptions,
}

impl NodeProperty {
    pub fn new(name: &str, display_name: &str, kind: NodePropertyKind, default: Value) -> Self {
        NodeProperty {
            name: name.into(),
            display_name: display_name.into(),
            kind,
            default,
            options: vec![],
            required: false,
            placeholder: None,
            description: None,
            password: false,
            display_options: DisplayOptions::default(),
        }
    }
    #[must_use]
    pub fn with_options(mut self, options: Vec<PropertyOption>) -> Self {
        self.options = options;
        self
    }
    #[must_use]
    pub fn required(mut self) -> Self {
        self.required = true;
        self
    }
    #[must_use]
    pub fn placeholder(mut self, p: &str) -> Self {
        self.placeholder = Some(p.into());
        self
    }
    #[must_use]
    pub fn describe(mut self, d: &str) -> Self {
        self.description = Some(d.into());
        self
    }
    /// Reveal this field only when `field` holds one of `values`. Chain calls
    /// to require several conditions at once (resource *and* operation).
    #[must_use]
    pub fn show_when(mut self, field: &str, values: &[&str]) -> Self {
        self.display_options = std::mem::take(&mut self.display_options).show_when(field, values);
        self
    }

    #[must_use]
    pub fn hide_when(mut self, field: &str, values: &[&str]) -> Self {
        self.display_options = std::mem::take(&mut self.display_options).hide_when(field, values);
        self
    }

    /// Mark the field as a secret.
    #[must_use]
    pub fn secret(mut self) -> Self {
        self.password = true;
        self
    }

    /// Is this field visible for the given parameter values?
    #[must_use]
    pub fn is_visible(&self, parameters: &Value) -> bool {
        self.display_options.is_visible(parameters)
    }
}

/// A credential type a node can use, and whether it must have one.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CredentialRequirement {
    /// Matches a `CredentialTypeDescription::name`.
    pub name: String,
    #[serde(default)]
    pub required: bool,
}

impl CredentialRequirement {
    #[must_use]
    pub fn required(name: &str) -> Self {
        CredentialRequirement {
            name: name.to_owned(),
            required: true,
        }
    }

    #[must_use]
    pub fn optional(name: &str) -> Self {
        CredentialRequirement {
            name: name.to_owned(),
            required: false,
        }
    }
}

/// Everything the engine and the editor need to know about a node type.
///
/// `Default` is implemented so that adding a field here does not break every
/// existing node and integration manifest — they end with `..Default::default()`
/// and pick the new field up automatically.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeTypeDescription {
    pub name: String,
    pub display_name: String,
    pub group: NodeGroup,
    pub description: String,
    /// Emoji or short glyph; the editor draws it on the node.
    pub icon: String,
    pub color: String,
    #[serde(default)]
    pub properties: Vec<NodeProperty>,
    /// Named output ports in display order.
    #[serde(default)]
    pub outputs: Vec<String>,
    #[serde(default)]
    pub inputs: Vec<String>,
    /// Credential types this node can authenticate with.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub credentials: Vec<CredentialRequirement>,
    /// Base URL shared by every operation of a declarative integration node.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
}

impl NodeTypeDescription {
    /// Defaults for every declared property, used when the editor adds a node.
    pub fn default_parameters(&self) -> Value {
        let mut map = serde_json::Map::new();
        for p in &self.properties {
            map.insert(p.name.clone(), p.default.clone());
        }
        Value::Object(map)
    }
    pub fn is_trigger(&self) -> bool {
        self.group == NodeGroup::Trigger
    }
}

// ------------------------------------------------------------------ execution

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ExecutionMode {
    Manual,
    Trigger,
    Webhook,
    Schedule,
    Retry,
}

impl ExecutionMode {
    pub fn as_str(&self) -> &'static str {
        match self {
            ExecutionMode::Manual => "manual",
            ExecutionMode::Trigger => "trigger",
            ExecutionMode::Webhook => "webhook",
            ExecutionMode::Schedule => "schedule",
            ExecutionMode::Retry => "retry",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ExecutionStatus {
    Running,
    Success,
    Error,
    Canceled,
    /// Stopped part-way, waiting for a person or for a moment to arrive.
    Waiting,
}

impl ExecutionStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            ExecutionStatus::Running => "running",
            ExecutionStatus::Success => "success",
            ExecutionStatus::Error => "error",
            ExecutionStatus::Canceled => "canceled",
            ExecutionStatus::Waiting => "waiting",
        }
    }
}

/// What one node produced during one run.
/// Outcome of one node within one execution.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum NodeRunStatus {
    Ok,
    Error,
    /// Never ran: disabled, or every upstream branch produced nothing.
    Skipped,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeRunData {
    pub node_id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub status: NodeRunStatus,
    pub ms: u64,
    pub tries: u32,
    pub output: HashMap<String, Items>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunResult {
    pub status: ExecutionStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub runs: Vec<NodeRunData>,
    /// Items from the last node that produced any — what a webhook replies with.
    pub last: Items,
    /// Where the run stopped, when it is waiting rather than finished.
    ///
    /// Untyped here because the shape belongs to the engine; `r8r-core` reads
    /// it back as a `SuspendedAt`. Keeping the domain crate free of it is what
    /// lets the workflow model stay independent of how a run is executed.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub suspended: Option<Value>,
    /// Values the run asked to remember.
    ///
    /// Present only when the run succeeded. The engine, not the caller, decides
    /// that — so there is no path by which a failed run's watermark is written
    /// and the records it never processed are skipped.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub remembered: Option<Map<String, Value>>,
}
