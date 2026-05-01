//! Orchestration Engine — enterprise-grade event lifecycle system.
//!
//! Provides:
//! - [`registry`] — Event registry and service catalog queries
//! - [`lifecycle`] — Before/after event emission with gate blocking
//! - [`connectors`] — External connector CRUD, health checks, execution
//! - [`jobs`] — Background job queue worker (tokio task)
//! - [`scheduler`] — Cron-based scheduled job runner (tokio task)

pub mod code_executor;
pub mod connectors;
pub mod default_pipelines;
pub mod jobs;
pub mod lifecycle;
pub mod registry;
pub mod scheduler;
