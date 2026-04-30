//! Edge-side authz read cache.
//!
//! The cloud is the authority for permission grants — SpiceDB ReBAC
//! lives there and only there. The edge node is **strictly
//! read-only**: it serves cached permission decisions during WAN
//! outages so clinical pages keep functioning, and it accepts cache
//! invalidation frames pushed from the cloud, but it MUST NOT mint
//! permission grants on its own.
//!
//! # Design
//!
//! - Two-tier store: an in-memory LRU (hot path) backed by an embedded
//!   sled KV store (cold path / replay-on-boot). Replay filters out
//!   already-expired entries so a flaky cache never resurrects on
//!   restart.
//! - A small fixed list of high-risk actions
//!   ([`ONLINE_REQUIRED_ACTIONS`]) — controlled-substance dispensing,
//!   blood crossmatch, invoice finalization — bypasses the cache
//!   entirely. These actions deny when offline regardless of policy.
//! - JWT fallback is opt-in via [`OfflinePolicy::CacheThenJwt`] and
//!   only consults the user's flat permission list, never SpiceDB
//!   relations. This is intentional: if you're offline and the cache
//!   missed, the strongest claim we have is the JWT the user logged
//!   in with.
//!
//! # Out of scope (next PR)
//!
//! - Wiring this into [`crate::sync::SyncServer::handle_push`] so
//!   incoming `Frame::CacheInvalidate` frames mutate the cache.
//! - Appending each check to [`crate::merkle::MerkleAudit`] — the
//!   audit hook point is marked `// AUDIT_HOOK` below; threading an
//!   `Arc<MerkleAudit>` here is deferred to the integration PR to
//!   keep this module reviewable.

use lru::LruCache;
use serde::{Deserialize, Serialize};
use std::num::NonZeroUsize;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, RwLock};
use std::time::{Duration, SystemTime};
use thiserror::Error;
use uuid::Uuid;

/// Actions that MUST go to cloud SpiceDB for evaluation. Even if a
/// cached `allow` exists, we deny offline. Each entry is
/// `(object_type, action)`.
///
/// Rationale:
/// - `prescription.sign` / `prescription.renew` — NDPS Act and
///   pharmacology safety: a stale grant could let a revoked
///   prescriber sign.
/// - `narcotic.dispense` — NDPS Act dual-lock register, must be
///   logged synchronously.
/// - `blood_bank.crossmatch` / `blood_bank.issue` — patient safety,
///   match decisions must reflect current blood-bank state.
/// - `billing_invoice.finalize` / `billing_invoice.void` —
///   financial integrity, can't be reissued from cache after a
///   grant revocation.
pub const ONLINE_REQUIRED_ACTIONS: &[(&str, &str)] = &[
    ("prescription", "sign"),
    ("prescription", "renew"),
    ("narcotic", "dispense"),
    ("blood_bank", "crossmatch"),
    ("blood_bank", "issue"),
    ("billing_invoice", "finalize"),
    ("billing_invoice", "void"),
];

/// A cache entry's identity. Mirrors the SpiceDB tuple shape:
/// `(object_type:object_id) action subject:user_id` scoped by tenant.
#[derive(Debug, Clone, Hash, Eq, PartialEq, Serialize, Deserialize)]
pub struct CacheKey {
    pub tenant_id: Uuid,
    pub user_id: Uuid,
    pub object_type: String,
    pub object_id: String,
    pub action: String,
}

/// Where a cache hit's verdict came from. Carried into audit log so
/// reviewers can distinguish "cloud said yes 30 seconds ago" from
/// "we fell back to the JWT".
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CacheSource {
    /// Returned to cloud, cloud answered, we cached it now.
    CloudFresh,
    /// Cache hit; the value originated from cloud at `fetched_at`.
    CloudCached,
    /// Cache miss but the JWT carried a flat permission that
    /// covers this check.
    JwtFallback,
    /// The action is on [`ONLINE_REQUIRED_ACTIONS`] — we refused.
    OnlineRequiredDeny,
}

/// Cached permission decision plus its TTL window. `expires_at`
/// is checked on every read — entries past it are treated as misses
/// rather than serving stale data.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheEntry {
    pub allowed: bool,
    pub fetched_at: SystemTime,
    pub expires_at: SystemTime,
    pub source: CacheSource,
}

/// What the caller wants to do when the cache misses. Per-route the
/// edge appliance can pick the policy it's comfortable with.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OfflinePolicy {
    /// Strict: only serve cached decisions. Misses deny.
    CacheOnly,
    /// Lenient: on miss, try the user's flat JWT permissions.
    CacheThenJwt,
    /// Refuse offline regardless of cache state. Used by callers
    /// that have already determined the action is high-risk.
    OnlineRequired,
}

/// Outcome of a check. Symmetric with HTTP-level allow/deny so the
/// caller can map directly to a 200/403.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CheckOutcome {
    Allow { source: CacheSource },
    Deny { reason: DenyReason },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DenyReason {
    /// Cache miss under [`OfflinePolicy::CacheOnly`].
    CacheMissStrict,
    /// JWT was tried and didn't include the required permission.
    JwtLacksPermission,
    /// Action is on [`ONLINE_REQUIRED_ACTIONS`] (or policy was
    /// [`OfflinePolicy::OnlineRequired`]).
    OnlineRequired,
    /// Entry was found but its TTL elapsed. Treated as a miss.
    Expired,
}

#[derive(Debug, Default)]
struct Counters {
    hits: AtomicU64,
    misses: AtomicU64,
    jwt_fallbacks: AtomicU64,
    online_denies: AtomicU64,
}

/// Snapshot of cache observability counters.
#[derive(Debug, Clone, Copy, Default)]
pub struct CacheMetrics {
    pub hits: u64,
    pub misses: u64,
    pub jwt_fallbacks: u64,
    pub online_denies: u64,
}

#[derive(Debug, Error)]
pub enum AuthzCacheError {
    #[error("sled: {0}")]
    Sled(#[from] sled::Error),

    #[error("serde_json: {0}")]
    Serde(#[from] serde_json::Error),

    #[error("invalid cache capacity: must be > 0")]
    InvalidCapacity,

    #[error("cache lock poisoned")]
    LockPoisoned,
}

/// Two-tier read-only authz cache. Cloned cheaply (`Arc` inside).
#[derive(Clone)]
pub struct AuthzCache {
    inner: Arc<RwLock<LruCache<CacheKey, CacheEntry>>>,
    persist: sled::Db,
    default_ttl: Duration,
    counters: Arc<Counters>,
}

impl std::fmt::Debug for AuthzCache {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("AuthzCache")
            .field("default_ttl", &self.default_ttl)
            .finish_non_exhaustive()
    }
}

impl AuthzCache {
    /// Open a cache backed by `persist_path` (sled DB). Replays
    /// non-expired entries into the LRU so post-reboot the cache
    /// is warm. Capacity bounds the LRU; sled is unbounded but
    /// pruned via [`Self::prune_older_than`].
    pub fn new(
        persist_path: &Path,
        capacity: usize,
        default_ttl: Duration,
    ) -> Result<Self, AuthzCacheError> {
        let cap = NonZeroUsize::new(capacity).ok_or(AuthzCacheError::InvalidCapacity)?;
        let persist = sled::open(persist_path)?;
        let mut lru = LruCache::new(cap);
        let now = SystemTime::now();
        Self::replay_into(&persist, &mut lru, now)?;
        Ok(Self {
            inner: Arc::new(RwLock::new(lru)),
            persist,
            default_ttl,
            counters: Arc::new(Counters::default()),
        })
    }

    fn replay_into(
        persist: &sled::Db,
        lru: &mut LruCache<CacheKey, CacheEntry>,
        now: SystemTime,
    ) -> Result<(), AuthzCacheError> {
        let mut to_drop: Vec<sled::IVec> = Vec::new();
        for kv in persist.iter() {
            let (k, v) = kv?;
            let Ok(key) = serde_json::from_slice::<CacheKey>(&k) else {
                to_drop.push(k);
                continue;
            };
            let Ok(entry) = serde_json::from_slice::<CacheEntry>(&v) else {
                to_drop.push(k);
                continue;
            };
            if entry.expires_at <= now {
                to_drop.push(k);
                continue;
            }
            lru.put(key, entry);
        }
        for k in to_drop {
            persist.remove(k)?;
        }
        Ok(())
    }

    /// Pure offline lookup. Never makes a network call. Honors
    /// [`ONLINE_REQUIRED_ACTIONS`] regardless of `policy`.
    pub fn check_offline(
        &self,
        key: &CacheKey,
        jwt_permissions: &[String],
        policy: OfflinePolicy,
    ) -> CheckOutcome {
        // AUDIT_HOOK: every outcome below should append to
        // MerkleAudit. Threading the chain is the next-PR concern.
        if is_online_required(&key.object_type, &key.action)
            || policy == OfflinePolicy::OnlineRequired
        {
            self.counters.online_denies.fetch_add(1, Ordering::Relaxed);
            return CheckOutcome::Deny {
                reason: DenyReason::OnlineRequired,
            };
        }
        match self.lookup_fresh(key) {
            Some(entry) if entry.allowed => {
                self.counters.hits.fetch_add(1, Ordering::Relaxed);
                CheckOutcome::Allow {
                    source: CacheSource::CloudCached,
                }
            }
            Some(_denied) => {
                // Cached deny: count as hit, surface as deny.
                self.counters.hits.fetch_add(1, Ordering::Relaxed);
                CheckOutcome::Deny {
                    reason: DenyReason::CacheMissStrict,
                }
            }
            None => self.miss_outcome(key, jwt_permissions, policy),
        }
    }

    fn miss_outcome(
        &self,
        key: &CacheKey,
        jwt_permissions: &[String],
        policy: OfflinePolicy,
    ) -> CheckOutcome {
        self.counters.misses.fetch_add(1, Ordering::Relaxed);
        match policy {
            OfflinePolicy::CacheOnly => CheckOutcome::Deny {
                reason: DenyReason::CacheMissStrict,
            },
            OfflinePolicy::OnlineRequired => CheckOutcome::Deny {
                reason: DenyReason::OnlineRequired,
            },
            OfflinePolicy::CacheThenJwt => {
                if fallback_to_jwt(jwt_permissions, key) {
                    self.counters.jwt_fallbacks.fetch_add(1, Ordering::Relaxed);
                    CheckOutcome::Allow {
                        source: CacheSource::JwtFallback,
                    }
                } else {
                    CheckOutcome::Deny {
                        reason: DenyReason::JwtLacksPermission,
                    }
                }
            }
        }
    }

    fn lookup_fresh(&self, key: &CacheKey) -> Option<CacheEntry> {
        let mut guard = self.inner.write().ok()?;
        let entry = guard.get(key)?.clone();
        if entry.expires_at <= SystemTime::now() {
            guard.pop(key);
            return None;
        }
        Some(entry)
    }

    /// Insert or overwrite a cache entry. Writes both the LRU and
    /// the sled persist layer so a reboot doesn't lose it.
    pub fn record(&self, key: CacheKey, allowed: bool, source: CacheSource) {
        let now = SystemTime::now();
        let entry = CacheEntry {
            allowed,
            fetched_at: now,
            expires_at: now + self.default_ttl,
            source,
        };
        if let Err(err) = self.persist_entry(&key, &entry) {
            tracing::warn!(?err, "authz cache persist failed; LRU only");
        }
        if let Ok(mut guard) = self.inner.write() {
            guard.put(key, entry);
        }
    }

    fn persist_entry(&self, key: &CacheKey, entry: &CacheEntry) -> Result<(), AuthzCacheError> {
        let k = serde_json::to_vec(key)?;
        let v = serde_json::to_vec(entry)?;
        self.persist.insert(k, v)?;
        Ok(())
    }

    /// Drop the given keys from both tiers. Used by cloud-pushed
    /// invalidation frames after a grant change.
    pub fn invalidate(&self, keys: &[CacheKey]) {
        if let Ok(mut guard) = self.inner.write() {
            for key in keys {
                guard.pop(key);
            }
        }
        for key in keys {
            if let Ok(k) = serde_json::to_vec(key) {
                if let Err(err) = self.persist.remove(k) {
                    tracing::warn!(?err, "authz cache invalidate persist failed");
                }
            }
        }
    }

    /// Drop entries with `fetched_at < cutoff`. Used by a periodic
    /// task to keep sled bounded. Returns the number dropped.
    pub fn prune_older_than(&self, cutoff: SystemTime) -> usize {
        let mut dropped = 0usize;
        let mut to_drop: Vec<(sled::IVec, CacheKey)> = Vec::new();
        for kv in self.persist.iter() {
            let Ok((k, v)) = kv else { continue };
            let Ok(entry) = serde_json::from_slice::<CacheEntry>(&v) else {
                continue;
            };
            if entry.fetched_at < cutoff {
                if let Ok(key) = serde_json::from_slice::<CacheKey>(&k) {
                    to_drop.push((k, key));
                }
            }
        }
        if let Ok(mut guard) = self.inner.write() {
            for (sled_key, lru_key) in &to_drop {
                guard.pop(lru_key);
                if self.persist.remove(sled_key).is_ok() {
                    dropped += 1;
                }
            }
        }
        dropped
    }

    pub fn metrics(&self) -> CacheMetrics {
        CacheMetrics {
            hits: self.counters.hits.load(Ordering::Relaxed),
            misses: self.counters.misses.load(Ordering::Relaxed),
            jwt_fallbacks: self.counters.jwt_fallbacks.load(Ordering::Relaxed),
            online_denies: self.counters.online_denies.load(Ordering::Relaxed),
        }
    }
}

fn is_online_required(object_type: &str, action: &str) -> bool {
    ONLINE_REQUIRED_ACTIONS
        .iter()
        .any(|(ot, ac)| *ot == object_type && *ac == action)
}

/// Map a SpiceDB-shaped check `(object_type, action)` to a flat dotted
/// permission code (`module.resource.action`) and test membership in
/// the JWT's claim list. We accept either a 2-segment match
/// (`object_type.action`) or a 3-segment match where the action itself
/// is dotted (e.g. `vitals.create` against object_type `opd`). This
/// matches the existing `P.MODULE.RESOURCE.ACTION` shape used app-wide.
fn fallback_to_jwt(jwt_permissions: &[String], key: &CacheKey) -> bool {
    let two_seg = format!("{}.{}", key.object_type, key.action);
    if jwt_permissions.iter().any(|p| p == &two_seg) {
        return true;
    }
    // Some object types in SpiceDB collapse module + resource (e.g.
    // `opd_visit` → permission `opd.visit.update`). Try a normalized
    // form by replacing the first `_` with `.`.
    if let Some(idx) = key.object_type.find('_') {
        let (module, resource) = key.object_type.split_at(idx);
        let resource = &resource[1..];
        let dotted = format!("{module}.{resource}.{}", key.action);
        if jwt_permissions.iter().any(|p| p == &dotted) {
            return true;
        }
    }
    false
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;

    #[test]
    fn jwt_fallback_two_segment_match() {
        let key = CacheKey {
            tenant_id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            object_type: "vitals".into(),
            object_id: "abc".into(),
            action: "create".into(),
        };
        assert!(fallback_to_jwt(&["vitals.create".into()], &key));
        assert!(!fallback_to_jwt(&["vitals.read".into()], &key));
    }

    #[test]
    fn jwt_fallback_three_segment_via_underscore() {
        let key = CacheKey {
            tenant_id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            object_type: "opd_visit".into(),
            object_id: "v1".into(),
            action: "update".into(),
        };
        assert!(fallback_to_jwt(&["opd.visit.update".into()], &key));
    }

    #[test]
    fn online_required_actions_listed() {
        assert!(is_online_required("prescription", "sign"));
        assert!(is_online_required("narcotic", "dispense"));
        assert!(!is_online_required("vitals", "create"));
    }
}
