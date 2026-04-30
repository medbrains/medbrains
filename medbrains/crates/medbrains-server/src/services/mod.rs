//! Background services that run alongside the HTTP server.
//!
//! Each service exposes a constructor + a `spawn()` method that
//! returns a shutdown handle. `main.rs` drives them all on startup
//! and joins them on graceful shutdown.

pub mod bridge_pusher;
pub mod spicedb_watch;
