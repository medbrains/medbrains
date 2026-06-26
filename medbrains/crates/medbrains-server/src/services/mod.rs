//! Background services that run alongside the HTTP server.
//!
//! Each service exposes a constructor + a `spawn()` method that
//! returns a shutdown handle. `main.rs` drives them all on startup
//! and joins them on graceful shutdown.

pub mod appointment_reminders;
pub mod bridge_pusher;
pub mod critical_alert_escalation;
pub mod on_call;
pub mod retention;
pub mod room_rent;
pub mod simulator;
pub mod spicedb_watch;
pub mod verbal_order_escalation;
