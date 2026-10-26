//! On-call roster resolution lives in `medbrains-notifications` so that
//! domain crates (nursing's early-warning escalation) reach the duty doctor
//! the same way these background passes do.

pub use medbrains_notifications::on_call::{OnCallContact, current_on_call};
