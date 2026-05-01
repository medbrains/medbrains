//! Integration tests for the edge authz read cache.
//!
//! These tests pin the offline-policy contract: what we serve on
//! hits, deny on misses, fall back to the JWT for, and refuse
//! outright (`ONLINE_REQUIRED_ACTIONS`). They also exercise the
//! sled persistence path so a reboot doesn't lose warm state.

#![allow(clippy::unwrap_used, clippy::expect_used)]

use medbrains_edge::{AuthzCache, CacheKey, CacheSource, CheckOutcome, DenyReason, OfflinePolicy};
use std::time::{Duration, SystemTime};
use tempfile::TempDir;
use uuid::Uuid;

fn fresh_cache(dir: &TempDir, ttl: Duration) -> AuthzCache {
    AuthzCache::new(&dir.path().join("cache"), 256, ttl).unwrap()
}

fn vitals_key() -> CacheKey {
    CacheKey {
        tenant_id: Uuid::new_v4(),
        user_id: Uuid::new_v4(),
        object_type: "vitals".into(),
        object_id: "encounter-1".into(),
        action: "create".into(),
    }
}

#[test]
fn cache_hit_serves_locally() {
    let dir = TempDir::new().unwrap();
    let cache = fresh_cache(&dir, Duration::from_secs(300));
    let key = vitals_key();

    cache.record(key.clone(), true, CacheSource::CloudFresh);

    let outcome = cache.check_offline(&key, &[], OfflinePolicy::CacheOnly);
    assert_eq!(
        outcome,
        CheckOutcome::Allow {
            source: CacheSource::CloudCached
        }
    );
}

#[test]
fn cache_miss_strict_denies() {
    let dir = TempDir::new().unwrap();
    let cache = fresh_cache(&dir, Duration::from_secs(300));
    let key = vitals_key();

    let outcome = cache.check_offline(&key, &[], OfflinePolicy::CacheOnly);
    assert_eq!(
        outcome,
        CheckOutcome::Deny {
            reason: DenyReason::CacheMissStrict
        }
    );
}

#[test]
fn cache_miss_lenient_falls_back_to_jwt() {
    let dir = TempDir::new().unwrap();
    let cache = fresh_cache(&dir, Duration::from_secs(300));
    let key = vitals_key();

    let outcome = cache.check_offline(&key, &["vitals.create".into()], OfflinePolicy::CacheThenJwt);
    assert_eq!(
        outcome,
        CheckOutcome::Allow {
            source: CacheSource::JwtFallback
        }
    );
}

#[test]
fn cache_miss_lenient_jwt_lacks_perm_denies() {
    let dir = TempDir::new().unwrap();
    let cache = fresh_cache(&dir, Duration::from_secs(300));
    let key = vitals_key();

    let outcome = cache.check_offline(
        &key,
        &["something.else".into()],
        OfflinePolicy::CacheThenJwt,
    );
    assert_eq!(
        outcome,
        CheckOutcome::Deny {
            reason: DenyReason::JwtLacksPermission
        }
    );
}

#[test]
fn cache_miss_online_required_denies_regardless() {
    let dir = TempDir::new().unwrap();
    let cache = fresh_cache(&dir, Duration::from_secs(300));
    let key = CacheKey {
        tenant_id: Uuid::new_v4(),
        user_id: Uuid::new_v4(),
        object_type: "prescription".into(),
        object_id: "rx-9".into(),
        action: "sign".into(),
    };

    // Even with a JWT that lists prescription.sign and a cached
    // allow entry, we deny because the action is online-required.
    cache.record(key.clone(), true, CacheSource::CloudFresh);
    let outcome = cache.check_offline(
        &key,
        &["prescription.sign".into()],
        OfflinePolicy::CacheThenJwt,
    );
    assert_eq!(
        outcome,
        CheckOutcome::Deny {
            reason: DenyReason::OnlineRequired
        }
    );
}

#[test]
fn cache_invalidate_drops_entries() {
    let dir = TempDir::new().unwrap();
    let cache = fresh_cache(&dir, Duration::from_secs(300));
    let key = vitals_key();

    cache.record(key.clone(), true, CacheSource::CloudFresh);
    assert!(matches!(
        cache.check_offline(&key, &[], OfflinePolicy::CacheOnly),
        CheckOutcome::Allow { .. }
    ));

    cache.invalidate(std::slice::from_ref(&key));
    assert_eq!(
        cache.check_offline(&key, &[], OfflinePolicy::CacheOnly),
        CheckOutcome::Deny {
            reason: DenyReason::CacheMissStrict
        }
    );
}

#[test]
fn persistence_replay_on_boot() {
    let dir = TempDir::new().unwrap();
    let key = vitals_key();

    {
        let cache = fresh_cache(&dir, Duration::from_secs(300));
        cache.record(key.clone(), true, CacheSource::CloudFresh);
        // Drop here.
    }

    let reopened = fresh_cache(&dir, Duration::from_secs(300));
    let outcome = reopened.check_offline(&key, &[], OfflinePolicy::CacheOnly);
    assert!(
        matches!(outcome, CheckOutcome::Allow { .. }),
        "expected replay to restore hit, got {outcome:?}"
    );
}

#[test]
fn expired_entries_pruned_at_replay() {
    let dir = TempDir::new().unwrap();
    let key = vitals_key();

    {
        // 1ms TTL — guaranteed to expire by the time we reopen.
        let cache = fresh_cache(&dir, Duration::from_millis(1));
        cache.record(key.clone(), true, CacheSource::CloudFresh);
        std::thread::sleep(Duration::from_millis(10));
    }

    let reopened = fresh_cache(&dir, Duration::from_secs(300));
    let outcome = reopened.check_offline(&key, &[], OfflinePolicy::CacheOnly);
    assert_eq!(
        outcome,
        CheckOutcome::Deny {
            reason: DenyReason::CacheMissStrict
        }
    );
}

#[test]
fn record_overwrites_existing_entry() {
    let dir = TempDir::new().unwrap();
    let cache = fresh_cache(&dir, Duration::from_secs(300));
    let key = vitals_key();

    cache.record(key.clone(), false, CacheSource::CloudFresh);
    // First record was a deny; verify it denies.
    let first = cache.check_offline(&key, &[], OfflinePolicy::CacheOnly);
    assert!(matches!(first, CheckOutcome::Deny { .. }));

    // Overwrite with allow and the next check should pass.
    cache.record(key.clone(), true, CacheSource::CloudFresh);
    let second = cache.check_offline(&key, &[], OfflinePolicy::CacheOnly);
    assert_eq!(
        second,
        CheckOutcome::Allow {
            source: CacheSource::CloudCached
        }
    );
}

#[test]
fn metrics_increments_on_hit_miss_fallback() {
    let dir = TempDir::new().unwrap();
    let cache = fresh_cache(&dir, Duration::from_secs(300));

    let hit_key = vitals_key();
    cache.record(hit_key.clone(), true, CacheSource::CloudFresh);
    let _ = cache.check_offline(&hit_key, &[], OfflinePolicy::CacheOnly);

    let miss_key = CacheKey {
        object_id: "encounter-2".into(),
        ..vitals_key()
    };
    let _ = cache.check_offline(&miss_key, &[], OfflinePolicy::CacheOnly);

    let fallback_key = CacheKey {
        object_id: "encounter-3".into(),
        ..vitals_key()
    };
    let _ = cache.check_offline(
        &fallback_key,
        &["vitals.create".into()],
        OfflinePolicy::CacheThenJwt,
    );

    let online_key = CacheKey {
        tenant_id: Uuid::new_v4(),
        user_id: Uuid::new_v4(),
        object_type: "narcotic".into(),
        object_id: "n1".into(),
        action: "dispense".into(),
    };
    let _ = cache.check_offline(&online_key, &[], OfflinePolicy::CacheThenJwt);

    let m = cache.metrics();
    assert_eq!(m.hits, 1, "one cache-hit");
    assert_eq!(
        m.misses, 2,
        "two true misses (the fallback also misses first)"
    );
    assert_eq!(m.jwt_fallbacks, 1);
    assert_eq!(m.online_denies, 1);
}

#[test]
fn prune_older_than_drops_old_entries() {
    let dir = TempDir::new().unwrap();
    let cache = fresh_cache(&dir, Duration::from_secs(300));
    let key = vitals_key();

    cache.record(key.clone(), true, CacheSource::CloudFresh);
    // Cutoff in the future drops everything we just recorded.
    let cutoff = SystemTime::now() + Duration::from_secs(60);
    let dropped = cache.prune_older_than(cutoff);
    assert_eq!(dropped, 1);

    let outcome = cache.check_offline(&key, &[], OfflinePolicy::CacheOnly);
    assert_eq!(
        outcome,
        CheckOutcome::Deny {
            reason: DenyReason::CacheMissStrict
        }
    );
}
