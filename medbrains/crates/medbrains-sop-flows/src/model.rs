//! What a flow is made of, as code defines it and as the API serves it.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use uuid::Uuid;

/// The hospital's switch settings: switch key → its value.
pub type Switches = Map<String, Value>;

/// What a station does (RFC §4.1; phase 1 needs these five).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum StationKind {
    /// Calls a registered domain action, which keeps its own checks.
    Action {
        action: String,
    },
    /// Someone does something on a screen; a registered task says how it clears.
    Task {
        task: String,
    },
    /// Chooses the lane by a registered fact about the patient.
    Switch {
        fact: String,
    },
    /// Holds the patient until a registered signal clears.
    Signal {
        signal: String,
    },
    End,
}

/// One station on a track. Stored as the template's `steps` snapshot.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Station {
    pub key: String,
    pub name: String,
    /// The stage the switchboard groups it under, e.g. "Before billing".
    pub stage: String,
    pub kind: StationKind,
    /// The branch it sits on; `None` is the main line.
    pub lane: Option<String>,
    /// Clause over the switches (`conditions::matches`); null = always.
    pub switch_when: Value,
    /// Clause over the patient's facts; null = every patient.
    pub fact_when: Value,
    /// Expected minutes at the station (the timetable).
    pub sla_minutes: Option<i64>,
    /// A safety signal no switch can remove (RFC §3.1).
    pub locked: bool,
    /// Who holds the train here, in plain words.
    pub holder: String,
    /// The tenant role that holds it (`roles.code`); `None` takes the
    /// building block's default role.
    #[serde(default)]
    pub holder_role: Option<String>,
    /// Why a locked signal is required, shown as "Always on: …".
    pub required_by: Option<String>,
    /// Readable address, e.g. "Hospital › IPD discharge › Billing › Billing cleared".
    #[serde(default)]
    pub path: String,
}

/// The kind of choice a switch offers.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SwitchKind {
    OnOff {
        default: bool,
    },
    Choice {
        options: Vec<SwitchOption>,
        default: String,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SwitchOption {
    pub value: String,
    pub label: String,
}

/// A plain-language switch a hospital flips.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SwitchDef {
    pub key: String,
    pub stage: String,
    /// The sentence the switchboard shows, e.g. "Insurance patients need …".
    pub sentence: String,
    /// The SOP line it implements.
    pub sop: String,
    pub kind: SwitchKind,
    /// What it does to the route when on/chosen, in one short line per value.
    pub effects: Vec<SwitchOption>,
    /// Readable address, e.g. "Hospital › IPD discharge › Before billing › …".
    pub path: String,
}

impl SwitchDef {
    #[must_use]
    pub fn default_value(&self) -> Value {
        match &self.kind {
            SwitchKind::OnOff { default } => Value::Bool(*default),
            SwitchKind::Choice { default, .. } => Value::String(default.clone()),
        }
    }
}

/// A library flow: built and reviewed in code, never by hospital staff.
#[derive(Debug, Clone, Serialize)]
pub struct FlowDef {
    pub code: String,
    pub name: String,
    pub module: String,
    /// What a journey is about (`admission` for discharge).
    pub subject_type: String,
    /// Clinical flows need the medical superintendent's approval too.
    pub clinical: bool,
    pub stations: Vec<Station>,
    pub switches: Vec<SwitchDef>,
}

/// The published version a tenant runs, with its switch settings.
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Template {
    pub id: Uuid,
    pub code: String,
    pub version: i32,
    pub status: String,
    pub steps: Value,
    pub switches: Value,
    pub published_at: Option<DateTime<Utc>>,
}

/// A switch change waiting in a knowledge change set.
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct PendingChange {
    pub id: Uuid,
    pub status: String,
    pub title: String,
    pub approvals: i32,
    pub after: Option<Value>,
}

/// `GET /api/flows/{code}`: everything the switchboard and map draw.
#[derive(Debug, Clone, Serialize)]
pub struct FlowDetail {
    pub code: String,
    pub name: String,
    pub clinical: bool,
    pub template_id: Uuid,
    pub version: i32,
    pub status: String,
    pub published_at: Option<DateTime<Utc>>,
    pub switches: Value,
    pub switch_defs: Vec<SwitchDef>,
    pub stations: Vec<Station>,
    /// Patients on the flow now, by the version they are pinned to.
    pub in_flight: Vec<VersionCount>,
    pub pending_change: Option<PendingChange>,
    /// Applied switch changes, newest first, with who approved them.
    pub history: Vec<HistoryEntry>,
    /// The flow's own address, e.g. "Hospital › IPD discharge".
    pub path: String,
}

/// One applied switch change: what changed and who approved it.
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct HistoryEntry {
    pub change_set_id: Uuid,
    pub title: String,
    pub applied_at: Option<DateTime<Utc>>,
    pub author_name: Option<String>,
    pub approver_name: Option<String>,
    pub second_approver_name: Option<String>,
    pub before: Option<Value>,
    pub after: Option<Value>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct VersionCount {
    pub version: i32,
    pub patients: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct FlowSummary {
    pub code: String,
    pub name: String,
    pub module: String,
    pub version: Option<i32>,
    pub in_flight: i64,
}

/// `POST /api/flows/{code}/impact` body.
#[derive(Debug, Clone, Deserialize)]
pub struct ImpactRequest {
    pub switches: Switches,
}

/// One measured effect of a switch change.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ImpactLine {
    /// `safety`, `money` or `info`, as knowledge change sets grade it.
    pub severity: String,
    pub relation: String,
    pub summary: String,
    pub count: i64,
    pub examples: Vec<ImpactExample>,
    pub truncated: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ImpactExample {
    pub label: String,
    pub href: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ImpactReport {
    /// Plain sentences: "Route now stops at TPA clearance for insurance patients".
    pub route_changes: Vec<String>,
    pub entries: Vec<ImpactLine>,
}

/// `POST …/run` body: run the action at the patient's current station.
#[derive(Debug, Clone, Deserialize)]
pub struct RunRequest {
    pub station: String,
    #[serde(default)]
    pub input: Value,
}

/// Where a patient is on their journey (the "ticket", RFC §5.2 #3).
#[derive(Debug, Clone, Serialize)]
pub struct Ticket {
    pub instance_id: Uuid,
    pub flow_code: String,
    pub subject_id: Uuid,
    pub version: i32,
    pub status: String,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub current: Option<TicketStation>,
    pub stops: Vec<TicketStop>,
    /// The last domain refusal at a station, with its reason.
    pub last_error: Option<Value>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TicketStation {
    pub key: String,
    pub name: String,
    pub path: String,
    /// `action`, `task`, `signal`, `switch` or `end`.
    pub kind: String,
    /// Who holds the signal or does the task.
    pub holder: String,
    /// What it waits for, in plain words.
    pub outstanding: Vec<String>,
    pub since: DateTime<Utc>,
    pub minutes: i64,
    pub sla_minutes: Option<i64>,
    pub overdue: bool,
    /// The switch sentence that put the patient on this branch, if any.
    pub routed_by: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TicketStop {
    pub key: String,
    pub name: String,
    pub lane: Option<String>,
    /// `done`, `current`, `ahead` or `skipped`.
    pub state: String,
    pub cleared_at: Option<DateTime<Utc>>,
}
