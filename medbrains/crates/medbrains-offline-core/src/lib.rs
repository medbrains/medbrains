//! Shared offline auth + permissions for the hospital edge stack.
//!
//! Same Rust runs on:
//! - the edge server (`medbrains-edge`, native compile)
//! - mobile + TV apps (via `medbrains-edge-rn`'s UniFFI bridge,
//!   compiled to `staticlib` for iOS and `cdylib` for Android)
//! - any future device class (kiosks, ambulance tablets, vendor apps)
//!
//! Phase A of the mobile/TV/edge expansion roadmap. Pure logic — no
//! tokio, no transport, no platform-specific I/O. Storage uses sled
//! (embedded KV); the host picks the path.
//!
//! # What lives here
//!
//! - [`AuthzCache`] — two-tier ReBAC decision cache (LRU + sled).
//!   Originally in `medbrains-edge::authz_cache` (PR #9).
//! - [`ONLINE_REQUIRED_ACTIONS`] — fixed list of high-risk actions
//!   that always deny offline regardless of cached state.
//! - [`verify_jwt`] — Ed25519 JWT signature + expiry check (Phase A.1).
//! - [`RevocationCache`] — sled-backed user-id → revoked-at, used by
//!   devices that pull `/api/auth/revocations` periodically (Phase A.1).
//!
//! # What does NOT live here
//!
//! - JWT issuance — that's a server-side concern (`medbrains-server`)
//! - SpiceDB connection — `medbrains-authz` owns the gRPC client
//! - Transport — every consumer brings its own (HTTP, WSS, UniFFI)

pub mod authz_cache;
pub mod jwt_verify;
pub mod revocation_cache;

pub use authz_cache::{
    AuthzCache, AuthzCacheError, CacheEntry, CacheKey, CacheMetrics, CacheSource, CheckOutcome,
    DenyReason, ONLINE_REQUIRED_ACTIONS, OfflinePolicy,
};
pub use jwt_verify::{
    DEFAULT_CLOCK_SKEW, JwtClaims, JwtOutcome, VerifyError, VerifyingKey, verify_jwt,
};
pub use revocation_cache::{RevocationCache, RevocationCacheError, RevocationEntry};
