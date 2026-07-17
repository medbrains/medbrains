//! Print-data crate — read-only endpoints that assemble print/PDF payloads.
//! Foundation coupling (server-core + medbrains-core::print_data types); clinical
//! adds authz_patient + events (workflow); several use the signed_documents helper.

pub mod academic;
pub mod admin;
pub mod billing;
pub mod bme;
pub mod clinical;
pub mod consent;
pub mod general;
pub mod hr;
pub mod medicolegal;
pub mod mrd;
pub mod quality;
pub mod regulatory;
pub mod surgical;
