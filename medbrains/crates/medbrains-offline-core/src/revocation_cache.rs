//! Persistent revocation cache for offline JWT denial.
//!
//! When the cloud-side admin disables a user (compromised account,
//! employment ended, role permanently removed) every JWT issued
//! before that moment must stop being honored — even by devices
//! that haven't reached the cloud since.
//!
//! # Model
//!
//! Per-user revocation timestamp. A JWT for `user_id` with `iat <
//! revoked_at` is denied. Token-level (per-jti) deny lists are
//! out of scope — they don't cover the common case (admin disables
//! a person, all their devices stop) and they grow without bound.
//!
//! # Two-tier store
//!
//! Same shape as [`crate::authz_cache::AuthzCache`]:
//! - sled-persisted `user_id → revoked_at_unix` so a reboot doesn't
//!   clear it.
//! - In-memory LRU front for hot-path checks.
//!
//! # Sync flow
//!
//! Consumers (mobile shell, edge server) call
//! `record_revocation(user_id, revoked_at)` for every entry pulled
//! from the cloud's `/api/auth/revocations?since=<cursor>` endpoint.
//! The cursor advances based on `pull_window_max()` so the next
//! pull gets only newer rows.

use lru::LruCache;
use serde::{Deserialize, Serialize};
use std::num::NonZeroUsize;
use std::path::Path;
use std::sync::{Arc, RwLock};
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Error)]
pub enum RevocationCacheError {
    #[error("sled: {0}")]
    Sled(#[from] sled::Error),

    #[error("serde_json: {0}")]
    Serde(#[from] serde_json::Error),

    #[error("invalid cache capacity: must be > 0")]
    InvalidCapacity,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub struct RevocationEntry {
    pub user_id: Uuid,
    /// Unix seconds — when the user's tokens stopped being valid.
    pub revoked_at_unix: i64,
}

#[derive(Clone)]
pub struct RevocationCache {
    inner: Arc<RwLock<LruCache<Uuid, i64>>>,
    persist: sled::Db,
    /// Largest revoked_at_unix we've seen so far. Used as the
    /// `since` cursor on the next pull.
    pull_max: Arc<RwLock<i64>>,
}

impl std::fmt::Debug for RevocationCache {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("RevocationCache").finish_non_exhaustive()
    }
}

impl RevocationCache {
    pub fn new(persist_path: &Path, capacity: usize) -> Result<Self, RevocationCacheError> {
        let cap = NonZeroUsize::new(capacity).ok_or(RevocationCacheError::InvalidCapacity)?;
        let persist = sled::open(persist_path)?;
        let mut lru = LruCache::new(cap);
        let mut max_seen: i64 = 0;
        for kv in persist.iter() {
            let (k, v) = kv?;
            let Ok(uid) = Uuid::from_slice(&k) else {
                continue;
            };
            let Ok(revoked_at) = serde_json::from_slice::<i64>(&v) else {
                continue;
            };
            lru.put(uid, revoked_at);
            if revoked_at > max_seen {
                max_seen = revoked_at;
            }
        }
        Ok(Self {
            inner: Arc::new(RwLock::new(lru)),
            persist,
            pull_max: Arc::new(RwLock::new(max_seen)),
        })
    }

    /// Record that `user_id` is revoked from `revoked_at_unix`
    /// onward. Idempotent — repeated calls with the same inputs are
    /// a no-op. If a later revoked_at supersedes an earlier one we
    /// keep the later (more recent revocation wins).
    pub fn record_revocation(
        &self,
        user_id: Uuid,
        revoked_at_unix: i64,
    ) -> Result<(), RevocationCacheError> {
        let existing = self
            .inner
            .read()
            .ok()
            .and_then(|g| g.peek(&user_id).copied());

        if let Some(existing_ts) = existing {
            if existing_ts >= revoked_at_unix {
                return Ok(());
            }
        }

        let bytes = serde_json::to_vec(&revoked_at_unix)?;
        self.persist.insert(user_id.as_bytes(), bytes)?;
        if let Ok(mut guard) = self.inner.write() {
            guard.put(user_id, revoked_at_unix);
        }
        if let Ok(mut max_guard) = self.pull_max.write() {
            if revoked_at_unix > *max_guard {
                *max_guard = revoked_at_unix;
            }
        }
        Ok(())
    }

    /// True if `user_id` is revoked AND `jwt_iat_unix` is at or
    /// before the revocation timestamp. JWTs issued AFTER the
    /// revocation are NOT considered revoked — that handles the
    /// re-activation case (admin disables, then re-enables, then
    /// user logs in fresh; the new JWT's iat is after the old
    /// revoked_at and should be honored).
    pub fn is_revoked(&self, user_id: Uuid, jwt_iat_unix: i64) -> bool {
        let Ok(mut guard) = self.inner.write() else {
            return false;
        };
        match guard.get(&user_id) {
            Some(&revoked_at) => jwt_iat_unix < revoked_at,
            None => false,
        }
    }

    /// Highest revoked_at_unix seen so far. Use as the `since`
    /// cursor on the next pull from the cloud.
    pub fn pull_window_max(&self) -> i64 {
        self.pull_max.read().map(|g| *g).unwrap_or(0)
    }

    /// Drop a revocation (admin re-activates a user). The next JWT
    /// the user mints will be valid; we keep the in-memory record
    /// only briefly as the "denied past" window collapses.
    pub fn forget(&self, user_id: Uuid) -> Result<(), RevocationCacheError> {
        self.persist.remove(user_id.as_bytes())?;
        if let Ok(mut guard) = self.inner.write() {
            guard.pop(&user_id);
        }
        Ok(())
    }

    /// Number of revoked users currently cached.
    pub fn len(&self) -> usize {
        self.inner.read().map(|g| g.len()).unwrap_or(0)
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn make() -> (RevocationCache, TempDir) {
        let dir = TempDir::new().unwrap();
        let cache = RevocationCache::new(dir.path(), 1024).unwrap();
        (cache, dir)
    }

    #[test]
    fn record_then_check_revoked() {
        let (cache, _td) = make();
        let user = Uuid::new_v4();
        cache.record_revocation(user, 1_700_000_000).unwrap();
        // Token issued before revocation → revoked.
        assert!(cache.is_revoked(user, 1_700_000_000 - 60));
        // Token issued after revocation → not revoked (re-activation).
        assert!(!cache.is_revoked(user, 1_700_000_000 + 60));
    }

    #[test]
    fn unknown_user_not_revoked() {
        let (cache, _td) = make();
        let user = Uuid::new_v4();
        assert!(!cache.is_revoked(user, 1_700_000_000));
    }

    #[test]
    fn earlier_record_does_not_overwrite_later() {
        let (cache, _td) = make();
        let user = Uuid::new_v4();
        cache.record_revocation(user, 1_700_000_000).unwrap();
        // Stale entry (admin pulled an older row from the cursor) —
        // must not move the boundary backward.
        cache.record_revocation(user, 1_699_000_000).unwrap();
        // Boundary stays at 1_700_000_000: anything before is still
        // revoked, including the half-way mark.
        assert!(cache.is_revoked(user, 1_699_500_000));
        assert!(cache.is_revoked(user, 1_700_000_000 - 1));
        // Token issued AT or AFTER the boundary is not revoked.
        assert!(!cache.is_revoked(user, 1_700_000_000));
    }

    #[test]
    fn later_record_supersedes_earlier() {
        let (cache, _td) = make();
        let user = Uuid::new_v4();
        cache.record_revocation(user, 1_699_000_000).unwrap();
        cache.record_revocation(user, 1_700_000_000).unwrap();
        // Token at iat 1_699_500_000 was previously NOT revoked
        // (after first record) — now it IS, because the later
        // record extended the window.
        assert!(cache.is_revoked(user, 1_699_500_000));
    }

    #[test]
    fn pull_window_max_tracks_largest_seen() {
        let (cache, _td) = make();
        let u1 = Uuid::new_v4();
        let u2 = Uuid::new_v4();
        cache.record_revocation(u1, 1_700_000_000).unwrap();
        cache.record_revocation(u2, 1_700_500_000).unwrap();
        cache.record_revocation(u1, 1_700_300_000).unwrap();
        assert_eq!(cache.pull_window_max(), 1_700_500_000);
    }

    #[test]
    fn forget_clears_revocation() {
        let (cache, _td) = make();
        let user = Uuid::new_v4();
        cache.record_revocation(user, 1_700_000_000).unwrap();
        assert!(cache.is_revoked(user, 1_699_000_000));
        cache.forget(user).unwrap();
        assert!(!cache.is_revoked(user, 1_699_000_000));
    }

    #[test]
    fn replay_on_boot_restores_revocations() {
        let dir = TempDir::new().unwrap();
        let user = Uuid::new_v4();
        {
            let cache = RevocationCache::new(dir.path(), 1024).unwrap();
            cache.record_revocation(user, 1_700_000_000).unwrap();
        }
        // Drop the first cache (sled releases lock); reopen.
        let cache = RevocationCache::new(dir.path(), 1024).unwrap();
        assert!(cache.is_revoked(user, 1_699_000_000));
        assert_eq!(cache.pull_window_max(), 1_700_000_000);
    }

    #[test]
    fn rejects_zero_capacity() {
        let dir = TempDir::new().unwrap();
        let result = RevocationCache::new(dir.path(), 0);
        assert!(matches!(result, Err(RevocationCacheError::InvalidCapacity)));
    }
}
