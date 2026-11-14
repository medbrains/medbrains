//! Shared server foundation — framework glue every domain crate depends on.
//!
//! First slice of the RFC-SERVER-CRATE-SPLIT extraction: the zero-route-coupling
//! infra modules (error type, config, request validation, JWT signing, S3 presign,
//! OAuth). AppState, middleware and the auth layer follow in subsequent slices.

pub mod clinical_credential;
pub mod config;
pub mod error;
pub mod form_friction;
pub mod hospital_time;
pub mod http_trace;
pub mod lockout;
pub mod middleware;
pub mod notification_hub;
pub mod os_identity;
pub mod pagination;
pub mod payload_log;
pub mod permissions;
pub mod queue_broadcast;
pub mod report_runner;
pub mod s3_presign;
pub mod scrub;
pub mod search;
pub mod settings_guard;
pub mod state;
pub mod step_up;
pub mod tenant_config;
pub mod validation;
