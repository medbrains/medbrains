//! Shared server foundation — framework glue every domain crate depends on.
//!
//! First slice of the RFC-SERVER-CRATE-SPLIT extraction: the zero-route-coupling
//! infra modules (error type, config, request validation, JWT signing, S3 presign,
//! OAuth). AppState, middleware and the auth layer follow in subsequent slices.

pub mod config;
pub mod error;
pub mod s3_presign;
pub mod signing;
pub mod validation;
