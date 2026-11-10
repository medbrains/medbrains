//! The `SpiceDB` backend of `medbrains-authz`: the gRPC client, the durable
//! outbox in front of it and the watcher that keeps user state fresh.
//!
//! A separate crate because it is the only part of the authorisation engine
//! that needs a gRPC stack. The `AuthzBackend` trait, the Postgres backend and
//! the three-valued `Outcome` stay in `medbrains-authz`, which the kernel and
//! every crate that only asks questions depend on (RFC-HOSPITAL-OS §3a).

pub mod backend_durable_spicedb;
pub mod backend_spicedb;
pub mod watch;
