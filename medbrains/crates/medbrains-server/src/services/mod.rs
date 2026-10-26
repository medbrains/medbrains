//! Background services that run alongside the HTTP server.
//!
//! Each service exposes a constructor + a `spawn()` method that
//! returns a shutdown handle. `main.rs` drives them all on startup
//! and joins them on graceful shutdown.

pub mod appointment_reminders;
pub mod access_alert_scan;
pub mod prescription_expiry;
pub mod pacs_sync;
pub mod breach_deadline_escalation;
pub mod bridge_pusher;
pub mod calibration_lock;
pub mod critical_alert_escalation;
pub mod enquiry_sla_escalation;
pub mod ews_escalation;
pub mod marketing_message_status;
// Moved to medbrains-server-core; re-exported so crate::services::notification_hub still resolves.
pub use medbrains_server_core::notification_hub;
pub mod notification_listener;
pub mod nurse_call_escalation;
pub mod on_call;
pub mod queue_rollover;
pub mod restraint_observation_escalation;
pub mod retention;
pub mod room_rent;
pub mod simulator;
pub mod spicedb_watch;
pub mod verbal_order_escalation;
