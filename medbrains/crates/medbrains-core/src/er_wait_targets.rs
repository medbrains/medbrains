//! How long an ER patient may wait for a doctor at each triage level before a
//! board calls the wait overdue. One table for the TV board and the ER list.
//!
//! The numbers are the ones the TV board already used. No clinician has signed
//! them off, and they are not the bands in the emergency SOP; until they are a
//! hospital setting, change them here and nowhere else.

use serde::Serialize;

/// Target door-to-doctor wait in minutes for each triage level that has one.
/// Expectant and not-yet-triaged patients have no target.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct ErWaitTargets {
    pub immediate: i32,
    pub emergent: i32,
    pub urgent: i32,
    pub less_urgent: i32,
    pub non_urgent: i32,
}

pub const ER_WAIT_TARGETS: ErWaitTargets = ErWaitTargets {
    immediate: 0,
    emergent: 10,
    urgent: 60,
    less_urgent: 120,
    non_urgent: 240,
};
