//! The security and compliance floor (RFC-WORLD-READY §1a).
//!
//! Code, not pack data: a pack may only add to it. [`check`] runs on every
//! pack the loader reads, and a pack that is not a superset of the floor
//! fails to load.

use crate::pack::{Gate, Rules};

/// Gates every controlled medicine carries, in every country.
pub const CONTROLLED_GATES: [Gate; 3] = [Gate::RxRequired, Gate::DualSign, Gate::RegisterEntry];

/// Minimum retention in years per record class; a pack may only lengthen.
pub const RETENTION_MIN_YEARS: [(&str, u16); 2] = [("medical_record", 3), ("audit_log", 3)];

/// One way a pack falls below the floor, in words a reviewer can act on.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
#[error("{0}")]
pub struct Violation(pub String);

/// Every way `rules` falls below the floor; empty means it is a superset.
#[must_use]
pub fn check(rules: &Rules) -> Vec<Violation> {
    let mut out = Vec::new();
    let flags = [
        (
            rules.audit_append_only,
            "the audit log must stay append-only",
        ),
        (
            rules.audit_phi_reads,
            "reads of patient data must stay audited",
        ),
        (
            rules.consent_required,
            "consent capture cannot be switched off",
        ),
        (rules.encryption_at_rest, "data at rest must stay encrypted"),
        (
            rules.encryption_in_transit,
            "data in transit must stay encrypted",
        ),
        (
            rules.ai_per_item_accept,
            "AI text needs a person to accept each item",
        ),
    ];
    out.extend(
        flags
            .iter()
            .filter(|(held, _)| !held)
            .map(|(_, why)| Violation((*why).to_owned())),
    );
    for (class, min) in RETENTION_MIN_YEARS {
        match rules.retention_years.get(class) {
            Some(&years) if years >= min => {}
            Some(&years) => out.push(Violation(format!(
                "{class} is kept {years} years; the floor is {min}"
            ))),
            None => out.push(Violation(format!("{class} has no retention period"))),
        }
    }
    if !rules.controlled_schedules.iter().any(|s| s.controlled) {
        out.push(Violation(
            "no schedule marks controlled medicines".to_owned(),
        ));
    }
    for schedule in rules.controlled_schedules.iter().filter(|s| s.controlled) {
        for gate in CONTROLLED_GATES {
            if !schedule.gates.contains(&gate) {
                out.push(Violation(format!(
                    "controlled schedule {} drops the {} gate",
                    schedule.code,
                    gate.as_str()
                )));
            }
        }
    }
    out
}
