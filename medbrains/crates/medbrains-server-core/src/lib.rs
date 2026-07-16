//! Shared server foundation — framework glue every domain crate depends on.
//!
//! First slice of the RFC-SERVER-CRATE-SPLIT extraction: the zero-route-coupling
//! infra modules (error type, config, request validation, JWT signing, S3 presign,
//! OAuth). AppState, middleware and the auth layer follow in subsequent slices.

pub mod config;
pub mod error;
pub mod middleware;
pub mod nabh_evidence;
pub mod notifications;
pub mod notification_hub;
pub mod permissions;
pub mod queue_broadcast;
pub mod s3_presign;
pub mod state;
pub mod authz_patient;
pub mod tenant_config;
pub mod signing;
pub mod validation;
