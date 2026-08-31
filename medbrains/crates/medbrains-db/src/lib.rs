//! # medbrains-db
//!
//! Database layer (Postgres) for the hospital management system.
//! Provides connection pooling, migrations, audit logging, and sequence generation.
//!
//! ## Design
//!
//! - **`sqlx`** compile-time checked macros for static SQL
//! - Runtime builders only for genuinely dynamic SQL
//! - **Transaction-scoped RLS** — every tenant-scoped query sets
//!   `app.tenant_id` via `SET LOCAL` inside the transaction
//! - Migrations live in `medbrains-db-migrations` — kept out of this crate so
//!   adding a `.sql` file does not rebuild everything that depends on it
//!
//! ## Modules
//!
//! - [`pool`] — Connection pool creation and configuration
//! - [`audit`] — SHA-256 chained audit log writes
//! - [`sequence`] — Atomic sequence generation (UHID, invoice numbers)
//! - [`stock`] — Batch-level stock movement between store locations

pub mod audit;
pub mod pool;
pub mod sequence;
pub mod stock;
