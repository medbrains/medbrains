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

pub mod config;
pub mod error;
pub mod events;
pub mod middleware;
pub mod orchestration;
pub mod routes;
pub mod seed;
pub mod signing;
pub mod state;
pub mod validation;
