//! React Native bridge for the Loro CRDT engine.
//!
//! Phase 12 of the hybrid roadmap. Same Rust core that powers the
//! `medbrains-edge` server now compiles for iOS (staticlib) and
//! Android (cdylib) so the mobile + TV apps run the *same* CRDT
//! conflict-resolution code as web — no JS-side reimplementation
//! that could drift.
//!
//! UniFFI generates Kotlin, Swift, and TypeScript bindings from
//! `edge_rn.udl`. The TS binding is consumed by React Native via
//! `uniffi-bindgen-react-native` (deferred to the mobile-app PR).
//!
//! Phase B (the current PR) extends the surface with offline auth +
//! permissions: `verify_jwt`, `is_action_offline_required`,
//! `AuthzCacheHandle`, `RevocationCacheHandle`. All of these route
//! into `medbrains-offline-core` so the same logic the edge server
//! uses now runs on every device.
//!
//! What this crate explicitly does NOT do:
//! - WebSocket transport (handled by the existing JS layer; the
//!   Rust core stays transport-free)
//! - Per-doc persistence to disk (the mobile app picks a storage
//!   location — defaults to RN's documents directory — and feeds
//!   bytes in/out via `apply_update` / `export_since`)

use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, UNIX_EPOCH};
use thiserror::Error;
use uuid::Uuid;

use medbrains_offline_core as offline;

uniffi::include_scaffolding!("edge_rn");

#[derive(Debug, Error)]
pub enum BridgeError {
    #[error("doc not found")]
    DocNotFound,

    #[error("invalid update")]
    InvalidUpdate,

    #[error("invalid version vector")]
    InvalidVersionVector,

    #[error("loro: {0}")]
    Loro(String),

    #[error("serde: {0}")]
    Serde(String),

    #[error("bad verifying key: {0}")]
    BadVerifyingKey(String),

    #[error("authz cache: {0}")]
    AuthzCache(String),

    #[error("revocation cache: {0}")]
    RevocationCache(String),

    #[error("invalid uuid: {0}")]
    InvalidUuid(String),
}

impl From<loro::LoroError> for BridgeError {
    fn from(value: loro::LoroError) -> Self {
        Self::Loro(value.to_string())
    }
}

impl From<loro::LoroEncodeError> for BridgeError {
    fn from(value: loro::LoroEncodeError) -> Self {
        Self::Loro(format!("encode: {value}"))
    }
}

impl From<serde_json::Error> for BridgeError {
    fn from(value: serde_json::Error) -> Self {
        Self::Serde(value.to_string())
    }
}

#[derive(Debug, Clone)]
pub struct AppendItem {
    pub json_value: String,
}

#[derive(Debug, Clone)]
pub struct TextSnapshot {
    pub text: String,
    pub version_vector: Vec<u8>,
}

/// Opaque handle the mobile/TV app holds for the lifetime of a
/// document mount. UniFFI requires interface impls to be `Send +
/// Sync`; `LoroDoc` itself is `Send` but not `Sync`, so we wrap in
/// `Mutex`. Doc updates are short — measured in microseconds at the
/// CRDT layer — so contention is fine.
pub struct DocHandle {
    inner: Arc<Mutex<loro::LoroDoc>>,
    doc_id: String,
}

impl DocHandle {
    pub fn new(doc_id: String) -> Result<Self, BridgeError> {
        Ok(Self {
            inner: Arc::new(Mutex::new(loro::LoroDoc::new())),
            doc_id,
        })
    }

    pub fn doc_id(&self) -> String {
        self.doc_id.clone()
    }

    pub fn apply_update(&self, update_bytes: Vec<u8>) -> Result<Vec<u8>, BridgeError> {
        let doc = self.inner.lock().map_err(|_| BridgeError::Loro("lock poisoned".into()))?;
        doc.import(&update_bytes)?;
        Ok(doc.oplog_vv().encode())
    }

    pub fn export_since(&self, their_vv: Vec<u8>) -> Result<Vec<u8>, BridgeError> {
        let vv = loro::VersionVector::decode(&their_vv)
            .map_err(|_| BridgeError::InvalidVersionVector)?;
        let doc = self.inner.lock().map_err(|_| BridgeError::Loro("lock poisoned".into()))?;
        Ok(doc.export(loro::ExportMode::updates(&vv))?)
    }

    pub fn version_vector(&self) -> Result<Vec<u8>, BridgeError> {
        let doc = self.inner.lock().map_err(|_| BridgeError::Loro("lock poisoned".into()))?;
        Ok(doc.oplog_vv().encode())
    }

    /// Append a JSON-encoded item to a Loro list container, matching
    /// the wire format the web hook expects.
    pub fn append_to_list(
        &self,
        container_name: String,
        item: AppendItem,
    ) -> Result<Vec<u8>, BridgeError> {
        let value: serde_json::Value = serde_json::from_str(&item.json_value)?;
        let doc = self.inner.lock().map_err(|_| BridgeError::Loro("lock poisoned".into()))?;
        let list = doc.get_list(container_name);
        list.push(loro::LoroValue::String(serde_json::to_string(&value)?.into()))?;
        let vv_before = doc.oplog_vv();
        Ok(doc.export(loro::ExportMode::updates(&vv_before))?)
    }

    pub fn list_entries(&self, container_name: String) -> Result<Vec<String>, BridgeError> {
        let doc = self.inner.lock().map_err(|_| BridgeError::Loro("lock poisoned".into()))?;
        let list = doc.get_list(container_name);
        let mut out = Vec::with_capacity(list.len());
        for i in 0..list.len() {
            if let Some(v) = list.get(i) {
                if let Some(s) = value_or_container_as_string(&v) {
                    out.push(s);
                }
            }
        }
        Ok(out)
    }

    /// Replace the text container's contents with `new_text`. Loro's
    /// text container handles diff/merge internally.
    pub fn set_text(
        &self,
        container_name: String,
        new_text: String,
    ) -> Result<Vec<u8>, BridgeError> {
        let doc = self.inner.lock().map_err(|_| BridgeError::Loro("lock poisoned".into()))?;
        let text = doc.get_text(container_name);
        text.update(&new_text, loro::UpdateOptions::default())
            .map_err(|e| BridgeError::Loro(format!("text update: {e}")))?;
        let vv_before = doc.oplog_vv();
        Ok(doc.export(loro::ExportMode::updates(&vv_before))?)
    }

    pub fn read_text(&self, container_name: String) -> Result<TextSnapshot, BridgeError> {
        let doc = self.inner.lock().map_err(|_| BridgeError::Loro("lock poisoned".into()))?;
        let text = doc.get_text(container_name);
        Ok(TextSnapshot {
            text: text.to_string(),
            version_vector: doc.oplog_vv().encode(),
        })
    }
}

fn value_or_container_as_string(v: &loro::ValueOrContainer) -> Option<String> {
    match v {
        loro::ValueOrContainer::Value(loro::LoroValue::String(s)) => Some(s.to_string()),
        _ => None,
    }
}

// ── Phase B: JWT verify ────────────────────────────────────────────

/// Wire-compatible mirror of `medbrains_offline_core::JwtClaims`.
/// UniFFI requires owned `String`s for UUIDs (no Uuid type bridge).
#[derive(Debug, Clone)]
pub struct JwtClaims {
    pub sub: String,
    pub tenant_id: String,
    pub iat: i64,
    pub exp: i64,
    pub department_ids: Vec<String>,
    pub permissions: Vec<String>,
    pub role: Option<String>,
}

impl From<offline::JwtClaims> for JwtClaims {
    fn from(c: offline::JwtClaims) -> Self {
        Self {
            sub: c.sub.to_string(),
            tenant_id: c.tenant_id.to_string(),
            iat: c.iat,
            exp: c.exp,
            department_ids: c.department_ids.into_iter().map(|u| u.to_string()).collect(),
            permissions: c.permissions,
            role: c.role,
        }
    }
}

/// UniFFI-friendly mirror of `medbrains_offline_core::JwtOutcome`.
/// We re-shape Valid(claims) → variant-with-data + the timing failure
/// modes as separate variants so callers can branch with Swift / Kotlin
/// pattern-match natively.
#[derive(Debug, Clone)]
pub enum JwtOutcome {
    Valid { claims: JwtClaims },
    Expired,
    NotYetValid,
    InvalidSignature,
    Malformed { reason: String },
}

impl From<offline::JwtOutcome> for JwtOutcome {
    fn from(o: offline::JwtOutcome) -> Self {
        match o {
            offline::JwtOutcome::Valid(c) => Self::Valid { claims: c.into() },
            offline::JwtOutcome::Expired => Self::Expired,
            offline::JwtOutcome::NotYetValid => Self::NotYetValid,
            offline::JwtOutcome::InvalidSignature => Self::InvalidSignature,
            offline::JwtOutcome::Malformed(r) => Self::Malformed { reason: r },
        }
    }
}

/// Top-level `namespace edge_rn` function. Delegates to
/// `medbrains_offline_core::verify_jwt`.
pub fn verify_jwt(
    token: String,
    public_key_bytes: Vec<u8>,
    now_unix: i64,
    clock_skew_secs: u64,
) -> JwtOutcome {
    let key_array = match <[u8; 32]>::try_from(public_key_bytes.as_slice()) {
        Ok(a) => a,
        Err(_) => {
            return JwtOutcome::Malformed {
                reason: format!("public key must be 32 bytes, got {}", public_key_bytes.len()),
            };
        }
    };
    let key = match offline::VerifyingKey::from_bytes(key_array) {
        Ok(k) => k,
        Err(e) => return JwtOutcome::Malformed { reason: format!("verifying key: {e}") },
    };
    let now = if now_unix < 0 {
        UNIX_EPOCH
    } else {
        UNIX_EPOCH + Duration::from_secs(now_unix as u64)
    };
    offline::verify_jwt(&token, &key, now, Duration::from_secs(clock_skew_secs)).into()
}

/// Top-level `namespace edge_rn` function. Cheap helper —
/// short-circuits AuthzCache check on the host side.
pub fn is_action_offline_required(object_type: String, action: String) -> bool {
    offline::ONLINE_REQUIRED_ACTIONS
        .iter()
        .any(|(t, a)| *t == object_type && *a == action)
}

// ── Phase B: AuthzCache handle ─────────────────────────────────────

#[derive(Debug, Clone)]
pub struct CacheKey {
    pub tenant_id: String,
    pub user_id: String,
    pub object_type: String,
    pub object_id: String,
    pub action: String,
}

impl CacheKey {
    fn try_into_offline(self) -> Result<offline::CacheKey, BridgeError> {
        Ok(offline::CacheKey {
            tenant_id: parse_uuid(&self.tenant_id, "tenant_id")?,
            user_id: parse_uuid(&self.user_id, "user_id")?,
            object_type: self.object_type,
            object_id: self.object_id,
            action: self.action,
        })
    }
}

#[derive(Debug, Clone)]
pub enum CacheSourceKind {
    CloudFresh,
    CloudCached,
    JwtFallback,
    OnlineRequiredDeny,
}

impl From<CacheSourceKind> for offline::CacheSource {
    fn from(s: CacheSourceKind) -> Self {
        match s {
            CacheSourceKind::CloudFresh => offline::CacheSource::CloudFresh,
            CacheSourceKind::CloudCached => offline::CacheSource::CloudCached,
            CacheSourceKind::JwtFallback => offline::CacheSource::JwtFallback,
            CacheSourceKind::OnlineRequiredDeny => offline::CacheSource::OnlineRequiredDeny,
        }
    }
}

impl From<offline::CacheSource> for CacheSourceKind {
    fn from(s: offline::CacheSource) -> Self {
        match s {
            offline::CacheSource::CloudFresh => Self::CloudFresh,
            offline::CacheSource::CloudCached => Self::CloudCached,
            offline::CacheSource::JwtFallback => Self::JwtFallback,
            offline::CacheSource::OnlineRequiredDeny => Self::OnlineRequiredDeny,
        }
    }
}

#[derive(Debug, Clone)]
pub enum DenyReasonKind {
    CacheMissStrict,
    JwtLacksPermission,
    OnlineRequired,
    Expired,
}

impl From<offline::DenyReason> for DenyReasonKind {
    fn from(r: offline::DenyReason) -> Self {
        match r {
            offline::DenyReason::CacheMissStrict => Self::CacheMissStrict,
            offline::DenyReason::JwtLacksPermission => Self::JwtLacksPermission,
            offline::DenyReason::OnlineRequired => Self::OnlineRequired,
            offline::DenyReason::Expired => Self::Expired,
        }
    }
}

#[derive(Debug, Clone)]
pub enum CheckOutcome {
    Allow { source: CacheSourceKind },
    Deny { reason: DenyReasonKind },
}

impl From<offline::CheckOutcome> for CheckOutcome {
    fn from(o: offline::CheckOutcome) -> Self {
        match o {
            offline::CheckOutcome::Allow { source } => Self::Allow { source: source.into() },
            offline::CheckOutcome::Deny { reason } => Self::Deny { reason: reason.into() },
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub enum OfflinePolicyKind {
    CacheOnly,
    CacheThenJwt,
    OnlineRequired,
}

impl From<OfflinePolicyKind> for offline::OfflinePolicy {
    fn from(p: OfflinePolicyKind) -> Self {
        match p {
            OfflinePolicyKind::CacheOnly => offline::OfflinePolicy::CacheOnly,
            OfflinePolicyKind::CacheThenJwt => offline::OfflinePolicy::CacheThenJwt,
            OfflinePolicyKind::OnlineRequired => offline::OfflinePolicy::OnlineRequired,
        }
    }
}

pub struct AuthzCacheHandle {
    inner: offline::AuthzCache,
}

impl AuthzCacheHandle {
    pub fn new(path: String, capacity: u32, default_ttl_secs: u64) -> Result<Self, BridgeError> {
        let p = PathBuf::from(path);
        let inner = offline::AuthzCache::new(
            &p,
            capacity as usize,
            Duration::from_secs(default_ttl_secs),
        )
        .map_err(|e| BridgeError::AuthzCache(e.to_string()))?;
        Ok(Self { inner })
    }

    pub fn check_offline(
        &self,
        key: CacheKey,
        jwt_permissions: Vec<String>,
        policy: OfflinePolicyKind,
    ) -> Result<CheckOutcome, BridgeError> {
        let k = key.try_into_offline()?;
        Ok(self
            .inner
            .check_offline(&k, &jwt_permissions, policy.into())
            .into())
    }

    pub fn record(
        &self,
        key: CacheKey,
        allowed: bool,
        source: CacheSourceKind,
    ) -> Result<(), BridgeError> {
        let k = key.try_into_offline()?;
        self.inner.record(k, allowed, source.into());
        Ok(())
    }

    pub fn invalidate(&self, keys: Vec<CacheKey>) -> Result<(), BridgeError> {
        let parsed: Result<Vec<_>, _> = keys.into_iter().map(CacheKey::try_into_offline).collect();
        self.inner.invalidate(&parsed?);
        Ok(())
    }
}

// ── Phase B: RevocationCache handle ────────────────────────────────

pub struct RevocationCacheHandle {
    inner: offline::RevocationCache,
}

impl RevocationCacheHandle {
    pub fn new(path: String, capacity: u32) -> Result<Self, BridgeError> {
        let p = PathBuf::from(path);
        let inner = offline::RevocationCache::new(&p, capacity as usize)
            .map_err(|e| BridgeError::RevocationCache(e.to_string()))?;
        Ok(Self { inner })
    }

    pub fn record_revocation(
        &self,
        user_id: String,
        revoked_at_unix: i64,
    ) -> Result<(), BridgeError> {
        let uid = parse_uuid(&user_id, "user_id")?;
        self.inner
            .record_revocation(uid, revoked_at_unix)
            .map_err(|e| BridgeError::RevocationCache(e.to_string()))
    }

    pub fn is_revoked(&self, user_id: String, jwt_iat_unix: i64) -> Result<bool, BridgeError> {
        let uid = parse_uuid(&user_id, "user_id")?;
        Ok(self.inner.is_revoked(uid, jwt_iat_unix))
    }

    pub fn pull_window_max(&self) -> i64 {
        self.inner.pull_window_max()
    }

    pub fn forget(&self, user_id: String) -> Result<(), BridgeError> {
        let uid = parse_uuid(&user_id, "user_id")?;
        self.inner
            .forget(uid)
            .map_err(|e| BridgeError::RevocationCache(e.to_string()))
    }

    pub fn len(&self) -> u32 {
        self.inner.len() as u32
    }
}

fn parse_uuid(s: &str, field: &str) -> Result<Uuid, BridgeError> {
    Uuid::parse_str(s).map_err(|e| BridgeError::InvalidUuid(format!("{field}: {e}")))
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use super::*;

    #[test]
    fn doc_handle_carries_id() {
        let h = DocHandle::new("vitals:abc".into()).unwrap();
        assert_eq!(h.doc_id(), "vitals:abc");
    }

    #[test]
    fn append_then_list_roundtrip() {
        let h = DocHandle::new("notes:xyz".into()).unwrap();
        h.append_to_list(
            "entries".into(),
            AppendItem { json_value: r#"{"note":"first"}"#.to_owned() },
        )
        .unwrap();
        h.append_to_list(
            "entries".into(),
            AppendItem { json_value: r#"{"note":"second"}"#.to_owned() },
        )
        .unwrap();
        let entries = h.list_entries("entries".into()).unwrap();
        assert_eq!(entries.len(), 2);
        assert!(entries[0].contains("first"));
        assert!(entries[1].contains("second"));
    }

    #[test]
    fn text_set_then_read() {
        let h = DocHandle::new("doc:1".into()).unwrap();
        h.set_text("body".into(), "hello".into()).unwrap();
        let snap = h.read_text("body".into()).unwrap();
        assert_eq!(snap.text, "hello");
        assert!(!snap.version_vector.is_empty());
    }

    #[test]
    fn export_apply_roundtrip_between_handles() {
        // Two devices simulated by two DocHandles. The update from
        // A applies cleanly into B and vice versa — the merge is
        // commutative which is the whole point of CRDTs.
        let a = DocHandle::new("shared".into()).unwrap();
        let b = DocHandle::new("shared".into()).unwrap();

        a.append_to_list(
            "log".into(),
            AppendItem { json_value: r#"{"v":1}"#.to_owned() },
        )
        .unwrap();
        let empty_vv = loro::VersionVector::default().encode();
        let a_to_b = a.export_since(empty_vv.clone()).unwrap();
        b.apply_update(a_to_b).unwrap();

        b.append_to_list(
            "log".into(),
            AppendItem { json_value: r#"{"v":2}"#.to_owned() },
        )
        .unwrap();
        let b_to_a = b.export_since(empty_vv).unwrap();
        a.apply_update(b_to_a).unwrap();

        let final_a = a.list_entries("log".into()).unwrap();
        let final_b = b.list_entries("log".into()).unwrap();
        assert_eq!(final_a.len(), 2);
        assert_eq!(final_b.len(), 2);
        // Same membership — order is implementation-defined for
        // append-only lists during merge but membership is invariant.
        let mut sorted_a = final_a.clone();
        sorted_a.sort();
        let mut sorted_b = final_b.clone();
        sorted_b.sort();
        assert_eq!(sorted_a, sorted_b);
    }

    #[test]
    fn version_vector_advances_on_write() {
        let h = DocHandle::new("doc".into()).unwrap();
        let vv0 = h.version_vector().unwrap();
        h.append_to_list(
            "log".into(),
            AppendItem { json_value: "true".into() },
        )
        .unwrap();
        let vv1 = h.version_vector().unwrap();
        assert_ne!(vv0, vv1, "VV must advance after a write");
    }

    #[test]
    fn invalid_version_vector_returns_typed_error() {
        let h = DocHandle::new("doc".into()).unwrap();
        let err = h.export_since(vec![0xff, 0xfe, 0xfd]).unwrap_err();
        assert!(matches!(err, BridgeError::InvalidVersionVector));
    }

    // ── Phase B tests ──────────────────────────────────────────────

    #[test]
    fn is_action_offline_required_matches_core_list() {
        // Anchor on the entries the offline-core crate maintains.
        // If the core list grows, this test still passes — it only
        // verifies the bridge call routes correctly.
        assert!(super::is_action_offline_required(
            "prescription".into(),
            "sign".into()
        ));
        assert!(super::is_action_offline_required(
            "narcotic".into(),
            "dispense".into()
        ));
        assert!(!super::is_action_offline_required("vitals".into(), "create".into()));
    }

    #[test]
    fn verify_jwt_short_key_returns_malformed() {
        let outcome = super::verify_jwt(
            "a.b.c".into(),
            vec![0u8; 10], // wrong length
            1_700_000_000,
            300,
        );
        match outcome {
            JwtOutcome::Malformed { reason } => assert!(reason.contains("32 bytes")),
            other => panic!("expected Malformed, got {other:?}"),
        }
    }

    #[test]
    fn verify_jwt_malformed_token() {
        let outcome = super::verify_jwt(
            "not-a-jwt".into(),
            vec![0xd7, 0x5a, 0x98, 0x01, 0x82, 0xb1, 0x0a, 0xb7,
                 0xd5, 0x4b, 0xfe, 0xd3, 0xc9, 0x64, 0x07, 0x3a,
                 0x0e, 0xe1, 0x72, 0xf3, 0xda, 0xa6, 0x23, 0x25,
                 0xaf, 0x02, 0x1a, 0x68, 0xf7, 0x07, 0x51, 0x1a],
            1_700_000_000,
            300,
        );
        assert!(matches!(outcome, JwtOutcome::Malformed { .. }));
    }

    #[test]
    fn revocation_cache_round_trip() {
        let dir = tempfile::TempDir::new().unwrap();
        let cache = RevocationCacheHandle::new(
            dir.path().to_string_lossy().into_owned(),
            64,
        )
        .unwrap();
        let user = Uuid::new_v4().to_string();
        cache.record_revocation(user.clone(), 1_700_000_000).unwrap();
        assert!(cache.is_revoked(user.clone(), 1_699_000_000).unwrap());
        assert!(!cache.is_revoked(user.clone(), 1_700_000_001).unwrap());
        assert_eq!(cache.pull_window_max(), 1_700_000_000);
        cache.forget(user.clone()).unwrap();
        assert!(!cache.is_revoked(user, 1_699_000_000).unwrap());
    }

    #[test]
    fn revocation_cache_rejects_bad_uuid() {
        let dir = tempfile::TempDir::new().unwrap();
        let cache = RevocationCacheHandle::new(
            dir.path().to_string_lossy().into_owned(),
            16,
        )
        .unwrap();
        let err = cache
            .record_revocation("not-a-uuid".into(), 1_700_000_000)
            .unwrap_err();
        assert!(matches!(err, BridgeError::InvalidUuid(_)));
    }

    #[test]
    fn authz_cache_check_returns_outcome() {
        let dir = tempfile::TempDir::new().unwrap();
        let cache = AuthzCacheHandle::new(
            dir.path().to_string_lossy().into_owned(),
            64,
            300,
        )
        .unwrap();
        let key = CacheKey {
            tenant_id: Uuid::new_v4().to_string(),
            user_id: Uuid::new_v4().to_string(),
            object_type: "vitals".into(),
            object_id: "abc".into(),
            action: "create".into(),
        };
        let outcome = cache
            .check_offline(key, vec![], OfflinePolicyKind::CacheOnly)
            .unwrap();
        // Empty cache, CacheOnly policy → Deny(CacheMissStrict)
        match outcome {
            CheckOutcome::Deny { reason: DenyReasonKind::CacheMissStrict } => {}
            other => panic!("expected Deny(CacheMissStrict), got {other:?}"),
        }
    }
}
