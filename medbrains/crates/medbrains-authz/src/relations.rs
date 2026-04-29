//! Relation vocabulary — the closed set of relation kinds the engine
//! understands. Per-entity `allowed_relations` is declared in the
//! `medbrains-core` sharing registry (Phase 3.2 deliverable).

use serde::{Deserialize, Serialize};

/// Relation kinds. Closed enum so registry can do compile-time exhaustiveness.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Relation {
    // Universal
    Owner,
    Editor,
    Viewer,
    // Clinical
    Consultant,
    AttendingPhysician,
    Phlebotomist,
    Nurse,
    // Workflow
    ReferredTo,
    FollowupAssignee,
    // Governance
    Approver,
    Auditor,
    // Financial
    BillingViewer,
    BillingEditor,
}

impl Relation {
    /// Stable string code stored in the `relation_tuples.relation` column.
    pub const fn as_code(self) -> &'static str {
        match self {
            Self::Owner => "owner",
            Self::Editor => "editor",
            Self::Viewer => "viewer",
            Self::Consultant => "consultant",
            Self::AttendingPhysician => "attending_physician",
            Self::Phlebotomist => "phlebotomist",
            Self::Nurse => "nurse",
            Self::ReferredTo => "referred_to",
            Self::FollowupAssignee => "followup_assignee",
            Self::Approver => "approver",
            Self::Auditor => "auditor",
            Self::BillingViewer => "billing_viewer",
            Self::BillingEditor => "billing_editor",
        }
    }

    /// Parse from the DB column value. Returns None on unknown codes — the
    /// engine logs and skips rather than panicking.
    pub fn from_code(s: &str) -> Option<Self> {
        Some(match s {
            "owner" => Self::Owner,
            "editor" => Self::Editor,
            "viewer" => Self::Viewer,
            "consultant" => Self::Consultant,
            "attending_physician" => Self::AttendingPhysician,
            "phlebotomist" => Self::Phlebotomist,
            "nurse" => Self::Nurse,
            "referred_to" => Self::ReferredTo,
            "followup_assignee" => Self::FollowupAssignee,
            "approver" => Self::Approver,
            "auditor" => Self::Auditor,
            "billing_viewer" => Self::BillingViewer,
            "billing_editor" => Self::BillingEditor,
            _ => return None,
        })
    }

    /// Implication: holding `Owner` implies `Editor` and `Viewer`. Holding
    /// `Editor` implies `Viewer`. Used by `check()` so callers don't need to
    /// chain explicit grants.
    pub fn implies(self) -> &'static [Self] {
        match self {
            Self::Owner => &[Self::Owner, Self::Editor, Self::Viewer],
            Self::Editor => &[Self::Editor, Self::Viewer],
            Self::AttendingPhysician => &[Self::AttendingPhysician, Self::Editor, Self::Viewer],
            Self::Consultant => &[Self::Consultant, Self::Viewer],
            Self::BillingEditor => &[Self::BillingEditor, Self::BillingViewer],
            // All other relations are leaf — they imply only themselves.
            Self::Viewer => &[Self::Viewer],
            Self::Phlebotomist => &[Self::Phlebotomist],
            Self::Nurse => &[Self::Nurse],
            Self::ReferredTo => &[Self::ReferredTo],
            Self::FollowupAssignee => &[Self::FollowupAssignee],
            Self::Approver => &[Self::Approver],
            Self::Auditor => &[Self::Auditor],
            Self::BillingViewer => &[Self::BillingViewer],
        }
    }

    /// Inverse of `implies()`: relations whose holders also satisfy `self`.
    /// E.g. `Viewer.implied_by()` = [Owner, Editor, Viewer, AttendingPhysician,
    /// Consultant]. Used by `check()` to find tuples that satisfy the asked
    /// relation via stronger grants.
    pub fn implied_by(self) -> Vec<Self> {
        const ALL: &[Relation] = &[
            Relation::Owner,
            Relation::Editor,
            Relation::Viewer,
            Relation::Consultant,
            Relation::AttendingPhysician,
            Relation::Phlebotomist,
            Relation::Nurse,
            Relation::ReferredTo,
            Relation::FollowupAssignee,
            Relation::Approver,
            Relation::Auditor,
            Relation::BillingViewer,
            Relation::BillingEditor,
        ];
        ALL.iter()
            .copied()
            .filter(|r| r.implies().contains(&self))
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip_codes() {
        for r in [
            Relation::Owner,
            Relation::Editor,
            Relation::Viewer,
            Relation::Consultant,
            Relation::AttendingPhysician,
            Relation::Phlebotomist,
            Relation::Nurse,
            Relation::ReferredTo,
            Relation::FollowupAssignee,
            Relation::Approver,
            Relation::Auditor,
            Relation::BillingViewer,
            Relation::BillingEditor,
        ] {
            assert_eq!(Relation::from_code(r.as_code()), Some(r));
        }
    }

    #[test]
    fn owner_implies_editor_and_viewer() {
        let i = Relation::Owner.implies();
        assert!(i.contains(&Relation::Editor));
        assert!(i.contains(&Relation::Viewer));
    }
}
