//! SpiceDB's gRPC API, generated from the official `authzed/api` protos.
//!
//! Replaces the third-party `spicedb-rs-proto` / `spicedb-rs-client`, which a
//! single maintainer publishes, on the authorization path. Nothing here is
//! hand-written: `src/gen` is prost/tonic output from `proto/`, and
//! `regenerate.sh` reproduces it. See `proto/README.md` for the pinned sources.
// Generated code (never hand-edited, see `regenerate.sh`) inherits the
// workspace lints like every crate, with this one exception at the module:
// prost/tonic output emits fully-qualified paths, no docs, and its own idioms,
// and fixing that means editing output the next regeneration overwrites. The
// hand-written code here and in `tests/` stays under the full workspace rules.
#[allow(
    clippy::all,
    clippy::pedantic,
    clippy::nursery,
    clippy::restriction,
    missing_docs,
    missing_debug_implementations,
    rustdoc::all,
    unreachable_pub,
    unused_qualifications
)]
pub mod authzed {
    pub mod api {
        pub mod v1 {
            include!("gen/authzed.api.v1.rs");
        }
    }
}

// Generated, same exception as `authzed` above.
#[allow(
    clippy::all,
    clippy::pedantic,
    clippy::nursery,
    clippy::restriction,
    missing_docs,
    missing_debug_implementations,
    rustdoc::all,
    unreachable_pub,
    unused_qualifications
)]
pub mod google {
    pub mod rpc {
        include!("gen/google.rpc.rs");
    }
}
