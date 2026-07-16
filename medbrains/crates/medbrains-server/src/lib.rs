//! # medbrains-server
//!
//! Axum HTTP server for the hospital management system.
//! Handles routing, authentication middleware, request validation,
//! and database seeding.
//!
//! ## Architecture
//!
//! - **Axum 0.8** with Tower middleware stack
//! - **Ed25519 JWT** authentication (dev keypair auto-generated)
//! - **argon2** password hashing
//! - **figment** layered configuration (defaults → TOML → env vars)
//! - Per-request tenant context via RLS middleware
//!
//! ## Modules
//!
//! - [`config`] — Application configuration (figment-based)
//! - [`routes`] — HTTP route handlers for all modules
//! - [`middleware`] — Auth extraction, tenant context, CORS
//! - [`state`] — Shared application state (`AppState`)
//! - [`seed`] — Database seeding (default tenant + admin user)
//! - [`error`] — Unified error types and responses
//! - [`validation`] — Request validation helpers


pub mod event_tokens;
pub mod routes;
pub mod secret_backend;
pub mod services;
pub mod storage_archive;

// Shared server foundation — moved to `medbrains-server-core` and re-exported here
// so `crate::error`, `crate::state`, `crate::middleware`, … keep resolving across
// the ~189 route modules.
pub use medbrains_workflow::{events, orchestration};
pub use medbrains_server_core::{
    clinical_credential,
    authz_patient, config, error, hospital_time, middleware, oauth, pagination, s3_presign,
    signing, state, tenant_config, validation,
};
