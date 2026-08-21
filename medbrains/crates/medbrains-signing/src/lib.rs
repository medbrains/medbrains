//! Document signing: Ed25519 primitives and the signed-document projection.
//!
//! Lifted out of `medbrains-server-core`, which 102 of 127 crates depend on, so
//! that changes here stop recompiling the hub for all of them.
pub mod signed_documents;
pub mod signing;
