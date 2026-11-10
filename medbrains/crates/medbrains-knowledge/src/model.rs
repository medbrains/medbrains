//! The shapes a change set is made of, as stored and as served.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// The knowledge areas phase 1 covers. Each has one adapter.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Area {
    DrugInteractions,
    CriticalValueRules,
    /// A hospital's switch settings on a library SOP flow (RFC-SOP-FLOWS).
    FlowSwitches,
}

impl Area {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::DrugInteractions => "drug_interactions",
            Self::CriticalValueRules => "critical_value_rules",
            Self::FlowSwitches => "flow_switches",
        }
    }

    #[must_use]
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "drug_interactions" => Some(Self::DrugInteractions),
            "critical_value_rules" => Some(Self::CriticalValueRules),
            "flow_switches" => Some(Self::FlowSwitches),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Op {
    Create,
    Update,
    Delete,
}

impl Op {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Create => "create",
            Self::Update => "update",
            Self::Delete => "delete",
        }
    }

    #[must_use]
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "create" => Some(Self::Create),
            "update" => Some(Self::Update),
            "delete" => Some(Self::Delete),
            _ => None,
        }
    }
}

/// Who or what a change affects. Ordered most serious first.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Severity {
    /// A warning or block stops firing (or weakens).
    Safety,
    /// Someone gains or loses access.
    Access,
    /// A price changes on open bills.
    Money,
    Info,
}

/// One record an impact entry points at.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct KnowledgeImpactExample {
    pub label: String,
    /// The screen that shows the record.
    pub href: Option<String>,
}

/// One measured effect: a count, and at most [`MAX_EXAMPLES`] of the records.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct KnowledgeImpactEntry {
    pub severity: Severity,
    pub relation: String,
    pub summary: String,
    pub count: i64,
    pub examples: Vec<KnowledgeImpactExample>,
    /// The query hit its row bound, so `count` is a floor, not a total.
    pub truncated: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct KnowledgeImpactReport {
    pub entries: Vec<KnowledgeImpactEntry>,
    pub computed_at: DateTime<Utc>,
}

/// Most examples one impact entry carries.
pub const MAX_EXAMPLES: usize = 20;
/// Most items one change set may hold.
pub const MAX_ITEMS: usize = 50;

/// One proposed edit, as the editor sends it.
#[derive(Debug, Clone, Deserialize)]
pub struct NewKnowledgeChangeItem {
    pub op: Op,
    /// The live row, for update and delete.
    pub target_id: Option<Uuid>,
    /// The row's new fields, for create and update.
    pub after: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NewKnowledgeChangeSet {
    pub area: Area,
    pub title: String,
    pub reason: String,
    pub items: Vec<NewKnowledgeChangeItem>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct DecisionBody {
    pub note: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RollbackBody {
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct KnowledgeChangeSet {
    pub id: Uuid,
    pub area: String,
    pub title: String,
    pub reason: String,
    pub status: String,
    pub author_id: Uuid,
    pub author_name: Option<String>,
    pub approver_id: Option<Uuid>,
    pub approver_name: Option<String>,
    /// The office the first approver signed for, when the area names offices.
    pub approver_role: Option<String>,
    /// Clinical flow changes need a second office's approval too.
    pub second_approver_id: Option<Uuid>,
    pub second_approver_name: Option<String>,
    pub second_approver_role: Option<String>,
    pub second_approved_at: Option<DateTime<Utc>>,
    pub decision_note: Option<String>,
    pub rejected_by: Option<Uuid>,
    pub rejected_at: Option<DateTime<Utc>>,
    pub applied_by: Option<Uuid>,
    pub rollback_of_set_id: Option<Uuid>,
    pub rolled_back_by_set_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub previewed_at: Option<DateTime<Utc>>,
    pub approved_at: Option<DateTime<Utc>>,
    pub applied_at: Option<DateTime<Utc>>,
    pub base_hash: Option<String>,
    pub proof_hash: Option<String>,
    pub impact: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct KnowledgeChangeItem {
    pub id: Uuid,
    pub target_kind: String,
    pub target_key: Option<String>,
    pub op: String,
    pub before: Option<serde_json::Value>,
    pub after: Option<serde_json::Value>,
    pub seq: i32,
}

#[derive(Debug, Clone, Serialize)]
pub struct KnowledgeChangeSetDetail {
    #[serde(flatten)]
    pub set: KnowledgeChangeSet,
    pub items: Vec<KnowledgeChangeItem>,
}

/// A live row as the editor shows it.
#[derive(Debug, Clone, Serialize)]
pub struct KnowledgeLiveRow {
    pub id: Uuid,
    pub fields: serde_json::Value,
}

/// One audit row the proof points at, with what an auditor needs to re-hash it.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct KnowledgeProofAuditRow {
    pub id: Uuid,
    pub action: String,
    pub hash: String,
    pub prev_hash: Option<String>,
    pub hash_input_canonical: Option<String>,
}

/// The downloadable proof: what was hashed, the hash, and the audit rows.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeProof {
    pub change_set_id: Uuid,
    /// The exact text `proof_hash` is the sha256 of.
    pub canonical: String,
    pub input: serde_json::Value,
    pub proof_hash: String,
    pub audit_rows: Vec<KnowledgeProofAuditRow>,
    pub how_to_verify: String,
}
