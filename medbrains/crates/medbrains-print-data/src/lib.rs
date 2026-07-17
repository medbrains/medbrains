//! Print-data crate — read-only endpoints that assemble print/PDF payloads.
//! Foundation coupling (server-core + medbrains-core::print_data types); the
//! clinical module additionally uses authz_patient (server-core) + events
//! (workflow) + the signed_documents helper (server-core).

pub mod admin;
pub mod billing;
pub mod clinical;
pub mod mrd;
pub mod regulatory;
