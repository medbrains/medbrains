//! SpiceDB's gRPC API, generated from the official `authzed/api` protos.
//!
//! Replaces the third-party `spicedb-rs-proto` / `spicedb-rs-client`, which a
//! single maintainer publishes, on the authorization path. Nothing here is
//! hand-written: `src/gen` is prost/tonic output from `proto/`, and
//! `regenerate.sh` reproduces it. See `proto/README.md` for the pinned sources.
#![allow(
    clippy::all,
    clippy::pedantic,
    clippy::nursery,
    missing_docs,
    rustdoc::all,
    unreachable_pub
)]

pub mod authzed {
    pub mod api {
        pub mod v1 {
            include!("gen/authzed.api.v1.rs");
        }
    }
}

pub mod google {
    pub mod rpc {
        include!("gen/google.rpc.rs");
    }
}
