//! The actions the bricks publish (RFC-AI-NATIVE-OS §7.2): one row each, run by
//! `medbrains_kernel::action::act`. See `docs/architecture/ACTIONS.md`.
//!
//! Here, not in the kernel, because a row names a brick and a permission: the
//! kernel stays domain-free (RFC-HOSPITAL-OS §3a). Not in `medbrains-core` next
//! to `bricks.rs`, because `ActionDef` is a kernel type and core sits below the
//! kernel. `scripts/check_actions.py` and the test below hold every row to a
//! brick in `BRICKS`, a permission constant in `permissions.rs` and a unique id.

use medbrains_core::permissions;
use medbrains_kernel::action::{ActionDef, DataClass, EffectClass};

/// Every action. Each one wraps the service function its screen already uses.
pub const ACTIONS: &[ActionDef] = &[
    ActionDef {
        id: "patients.find",
        module: "registration",
        effect: EffectClass::Read,
        permission: permissions::patients::FIND,
        data_classes: &[DataClass::Identifying],
        summary: "Find patients by name, phone, UHID or Aadhaar, as the desk lookup does.",
        input: r#"{"type":"object","properties":{"query":{"type":"string","description":"Name, phone, UHID or Aadhaar"}},"required":["query"]}"#,
    },
    ActionDef {
        id: "patients.summary",
        module: "registration",
        effect: EffectClass::Read,
        permission: permissions::patients::VIEW,
        data_classes: &[DataClass::Identifying],
        summary: "One patient's demographics and last visit, masked as the chart masks them.",
        input: r#"{"type":"object","properties":{"patient_id":{"type":"string","format":"uuid"}},"required":["patient_id"]}"#,
    },
    ActionDef {
        id: "opd.queue.today",
        module: "opd",
        effect: EffectClass::Read,
        permission: permissions::opd::queue::LIST,
        data_classes: &[DataClass::Identifying, DataClass::Routine],
        summary: "Today's OPD queue, for one department or all of them.",
        input: r#"{"type":"object","properties":{"department_id":{"type":"string","format":"uuid","description":"Leave out for every department"}}}"#,
    },
];

/// The action with this id.
#[must_use]
pub fn find_action(id: &str) -> Option<&'static ActionDef> {
    ACTIONS.iter().find(|action| action.id == id)
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use medbrains_core::bricks;

    use super::{ACTIONS, find_action};

    #[test]
    fn every_action_names_a_brick_and_has_its_own_id() {
        let mut ids = HashSet::new();
        for action in ACTIONS {
            assert!(
                bricks::find(action.module).is_some(),
                "{}: no brick {}",
                action.id,
                action.module
            );
            assert!(ids.insert(action.id), "{} is declared twice", action.id);
            assert!(
                !action.summary.is_empty() && !action.permission.is_empty(),
                "{}",
                action.id
            );
            assert_eq!(find_action(action.id).map(|a| a.id), Some(action.id));
            let input: serde_json::Value = serde_json::from_str(action.input).unwrap_or_default();
            assert_eq!(
                input["type"], "object",
                "{}: input is not an object schema",
                action.id
            );
        }
        assert!(find_action("patients.nothing").is_none());
    }
}
