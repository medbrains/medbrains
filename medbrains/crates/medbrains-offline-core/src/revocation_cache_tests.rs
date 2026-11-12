//! Tests for the revocation cache.
#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
use super::*;
use tempfile::TempDir;

/// A cache in its own temporary directory; the directory lives as long as the handle returned.
fn make() -> (RevocationCache, TempDir) {
    let dir = TempDir::new().unwrap();
    let cache = RevocationCache::new(dir.path(), 1024).unwrap();
    (cache, dir)
}

#[test]
fn a_fresh_store_refuses_offline_sign_in_until_its_first_sync() {
    // A store with no sync marker is what every device has right after the upgrade
    // from sled: the old revocations were not carried over.
    let (cache, dir) = make();
    let user = Uuid::new_v4();
    assert_eq!(
        cache.offline_sign_in(user, 1_700_000_000),
        OfflineSignIn::NeedsSync
    );

    cache.record_revocation(user, 1_700_000_000).unwrap();
    assert_eq!(
        cache.offline_sign_in(user, 1_699_000_000),
        OfflineSignIn::NeedsSync
    );

    cache.mark_synced().unwrap();
    assert_eq!(
        cache.offline_sign_in(user, 1_699_000_000),
        OfflineSignIn::Revoked
    );
    assert_eq!(
        cache.offline_sign_in(Uuid::new_v4(), 1_699_000_000),
        OfflineSignIn::Allowed
    );

    // The marker is durable and is not mistaken for a revoked user on reopen.
    drop(cache);
    let reopened = RevocationCache::new(dir.path(), 1024).unwrap();
    assert!(reopened.has_synced());
    assert_eq!(reopened.len(), 1);
    assert_eq!(
        reopened.offline_sign_in(user, 1_699_000_000),
        OfflineSignIn::Revoked
    );
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
    // Fail closed at the boundary: a token minted in the revocation's own second is refused.
    assert!(cache.is_revoked(user, 1_700_000_000));
    // Only a token issued after it is honoured.
    assert!(!cache.is_revoked(user, 1_700_000_001));
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
    // Drop the first cache (the store releases its lock); reopen.
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

#[test]
fn a_revocation_evicted_from_memory_still_refuses_offline_sign_in() {
    // More revocations than the LRU holds: the oldest fall out of memory but not out of the
    // store, and must still refuse. 5,000 rows in one transaction, as one pulled page.
    let dir = TempDir::new().unwrap();
    let cache = RevocationCache::new(dir.path(), 4096).unwrap();
    let users: Vec<Uuid> = (0..5_000).map(|_| Uuid::new_v4()).collect();
    let rows: Vec<(Uuid, i64)> = users.iter().map(|u| (*u, 1_700_000_000)).collect();
    cache.record_revocations(&rows).unwrap();
    cache.mark_synced().unwrap();
    assert_eq!(cache.len(), 4096, "the LRU is full and has evicted");
    for user in &users {
        assert_eq!(
            cache.offline_sign_in(*user, 1_699_000_000),
            OfflineSignIn::Revoked
        );
    }
    assert_eq!(
        cache.offline_sign_in(Uuid::new_v4(), 1_699_000_000),
        OfflineSignIn::Allowed
    );
}

#[test]
fn an_older_row_cannot_roll_back_a_revocation_evicted_from_memory() {
    let dir = TempDir::new().unwrap();
    let cache = RevocationCache::new(dir.path(), 1).unwrap();
    let (first, second) = (Uuid::new_v4(), Uuid::new_v4());
    cache.record_revocation(first, 1_700_000_000).unwrap();
    cache.record_revocation(second, 1_700_000_000).unwrap(); // evicts `first` from the LRU
    cache.record_revocation(first, 1_600_000_000).unwrap(); // a stale row from an old page
    assert!(cache.is_revoked(first, 1_699_999_999));
}

#[test]
fn a_page_with_two_rows_for_one_user_keeps_the_later_revocation() {
    let (cache, _td) = make();
    let user = Uuid::new_v4();
    cache
        .record_revocations(&[(user, 200), (user, 100)])
        .unwrap();
    assert!(
        cache.is_revoked(user, 150),
        "the later revocation (200) must win"
    );
}
