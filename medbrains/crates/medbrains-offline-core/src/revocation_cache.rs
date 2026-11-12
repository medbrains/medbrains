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
//! - redb-persisted `user_id → revoked_at_unix` so a reboot doesn't
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

use crate::store::{Store, StoreError};

#[derive(Debug, Error)]
pub enum RevocationCacheError {
    #[error("store: {0}")]
    Store(#[from] StoreError),

    #[error("serde_json: {0}")]
    Serde(#[from] serde_json::Error),

    #[error("invalid cache capacity: must be > 0")]
    InvalidCapacity,

    #[error("revocation cache lock poisoned")]
    LockPoisoned,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub struct RevocationEntry {
    pub user_id: Uuid,
    /// Unix seconds — when the user's tokens stopped being valid.
    pub revoked_at_unix: i64,
}

/// The store key that says this device has finished a revocation pull since the store was
/// created. Not 16 bytes, so the replay of user ids skips it.
const SYNCED_KEY: &[u8] = b"synced";

/// What a device may conclude, offline, about signing a user in on a token.
///
/// Three outcomes, never two: a device that has not finished a revocation pull since its store
/// was created (a fresh install, or the move from sled to redb, which starts empty) cannot know
/// who was revoked, and must not answer "not revoked".
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OfflineSignIn {
    /// Synced at least once and the token is not revoked.
    Allowed,
    /// The token was issued before the user's revocation.
    Revoked,
    /// No revocation pull has finished on this store yet: sign-in needs one online sync first.
    NeedsSync,
}

#[derive(Clone)]
pub struct RevocationCache {
    inner: Arc<RwLock<LruCache<Uuid, i64>>>,
    persist: Store,
    /// Largest `revoked_at_unix` we've seen so far. Used as the
    /// `since` cursor on the next pull.
    pull_max: Arc<RwLock<i64>>,
    /// Whether a revocation pull has finished since this store was created.
    synced: Arc<std::sync::atomic::AtomicBool>,
}

impl std::fmt::Debug for RevocationCache {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("RevocationCache").finish_non_exhaustive()
    }
}

impl RevocationCache {
    pub fn new(persist_path: &Path, capacity: usize) -> Result<Self, RevocationCacheError> {
        let cap = NonZeroUsize::new(capacity).ok_or(RevocationCacheError::InvalidCapacity)?;
        let persist = Store::open(persist_path)?;
        let mut lru = LruCache::new(cap);
        let mut max_seen: i64 = 0;
        let mut synced = false;
        for (k, v) in persist.entries()? {
            if k == SYNCED_KEY {
                synced = true;
                continue;
            }
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
            synced: Arc::new(std::sync::atomic::AtomicBool::new(synced)),
        })
    }

    /// Record that a revocation pull finished. Call after every successful pull: the first
    /// one lifts [`OfflineSignIn::NeedsSync`] for good, durably, before it is reported.
    pub fn mark_synced(&self) -> Result<(), RevocationCacheError> {
        self.persist.insert(SYNCED_KEY, b"1")?;
        self.synced
            .store(true, std::sync::atomic::Ordering::Release);
        Ok(())
    }

    /// Whether a revocation pull has finished since this store was created.
    pub fn has_synced(&self) -> bool {
        self.synced.load(std::sync::atomic::Ordering::Acquire)
    }

    /// May `user_id` be signed in offline on a token issued at `jwt_iat_unix`?
    ///
    /// Fails safe: before the first sync, and if the cache cannot be read, the answer is
    /// [`OfflineSignIn::NeedsSync`], never "allowed".
    pub fn offline_sign_in(&self, user_id: Uuid, jwt_iat_unix: i64) -> OfflineSignIn {
        if !self.has_synced() {
            return OfflineSignIn::NeedsSync;
        }
        match self.revoked_at(user_id) {
            Ok(Some(revoked_at)) if jwt_iat_unix <= revoked_at => OfflineSignIn::Revoked,
            Ok(_) => OfflineSignIn::Allowed,
            Err(_) => OfflineSignIn::NeedsSync,
        }
    }

    /// When `user_id` was revoked, if ever: the LRU first, then the store.
    ///
    /// The LRU holds only `capacity` users and the store holds them all, so a miss in memory is
    /// not an answer: a revocation evicted from the LRU still revokes. A read fault is an error,
    /// never `None`, so no caller can mistake it for "not revoked".
    fn revoked_at(&self, user_id: Uuid) -> Result<Option<i64>, RevocationCacheError> {
        if let Some(&at) = self
            .inner
            .write()
            .map_err(|_| RevocationCacheError::LockPoisoned)?
            .get(&user_id)
        {
            return Ok(Some(at));
        }
        let Some(bytes) = self.persist.get(user_id.as_bytes())? else {
            return Ok(None);
        };
        let at: i64 = serde_json::from_slice(&bytes)?;
        if let Ok(mut guard) = self.inner.write() {
            guard.put(user_id, at);
        }
        Ok(Some(at))
    }

    /// Record that `user_id` is revoked from `revoked_at_unix`
    /// onward. Idempotent — repeated calls with the same inputs are
    /// a no-op. If a later `revoked_at` supersedes an earlier one we
    /// keep the later (more recent revocation wins).
    pub fn record_revocation(
        &self,
        user_id: Uuid,
        revoked_at_unix: i64,
    ) -> Result<(), RevocationCacheError> {
        self.record_revocations(&[(user_id, revoked_at_unix)])
    }

    /// Record a pulled page of revocations in one durable transaction. Monotonic per user: an
    /// earlier timestamp never overwrites a later one, checked against the store as well as the
    /// LRU, so an evicted user cannot be rolled back.
    pub fn record_revocations(&self, rows: &[(Uuid, i64)]) -> Result<(), RevocationCacheError> {
        let mut newer: Vec<(Uuid, i64)> = Vec::with_capacity(rows.len());
        for &(user_id, at) in rows {
            if self
                .revoked_at(user_id)?
                .is_none_or(|existing| existing < at)
            {
                newer.push((user_id, at));
            }
        }
        let encoded: Vec<([u8; 16], Vec<u8>)> = newer
            .iter()
            .map(|(uid, at)| Ok((*uid.as_bytes(), serde_json::to_vec(at)?)))
            .collect::<Result<_, serde_json::Error>>()?;
        self.persist.insert_all(&encoded)?;
        if let Ok(mut guard) = self.inner.write() {
            for &(uid, at) in &newer {
                guard.put(uid, at);
            }
        }
        if let Some(max) = newer.iter().map(|r| r.1).max()
            && let Ok(mut max_guard) = self.pull_max.write()
            && max > *max_guard
        {
            *max_guard = max;
        }
        Ok(())
    }

    /// True if `user_id` is revoked and `jwt_iat_unix` is at or before the revocation time
    /// (a token minted in the revocation's own second is refused). Tokens issued after it are
    /// honoured: that is re-activation. Fails closed: a fault reads as revoked.
    pub fn is_revoked(&self, user_id: Uuid, jwt_iat_unix: i64) -> bool {
        match self.revoked_at(user_id) {
            Ok(Some(revoked_at)) => jwt_iat_unix <= revoked_at,
            Ok(None) => false,
            Err(_) => true,
        }
    }

    /// Highest `revoked_at_unix` seen so far. Use as the `since`
    /// cursor on the next pull from the cloud.
    pub fn pull_window_max(&self) -> i64 {
        self.pull_max.read().map(|g| *g).unwrap_or(0)
    }

    /// Drop a revocation (admin re-activates a user). The next JWT
    /// the user mints will be valid; we keep the in-memory record
    /// only briefly as the "denied past" window collapses.
    pub fn forget(&self, user_id: Uuid) -> Result<(), RevocationCacheError> {
        self.persist.remove_all(&[user_id.as_bytes()])?;
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
#[path = "revocation_cache_tests.rs"]
mod tests;
