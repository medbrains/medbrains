//! Jittered exponential backoff schedule for outbox worker.
//!
//! Schedule per attempt:
//!   1   → 1s
//!   2   → 5s
//!   3   → 30s
//!   4   → 5m
//!   5   → 30m
//!   6   → 2h
//!   7   → 6h
//!   8+  → 6h (capped)
//!   10  → DLQ (decision in worker, not here)
//!
//! Each delay is multiplied by a uniform random factor in [0.8, 1.2]
//! to avoid retry-storms across parallel handlers hitting the same
//! degraded partner.

use chrono::{DateTime, Duration, Utc};
use rand::Rng;

/// Returns the next-retry timestamp for a given attempt count.
///
/// `attempts` is the count AFTER this latest failure (i.e. 1 for first
/// failure, 2 for second, ...). For attempts >= MAX_ATTEMPTS the worker
/// should DLQ instead of calling this.
pub fn next_retry_at(attempts: i32) -> DateTime<Utc> {
    let base_secs = base_delay_secs(attempts);
    let jitter = jitter_factor();
    let delay_secs = (base_secs as f64 * jitter) as i64;
    Utc::now() + Duration::seconds(delay_secs.max(1))
}

const fn base_delay_secs(attempts: i32) -> i64 {
    match attempts {
        ..=1 => 1,
        2 => 5,
        3 => 30,
        4 => 5 * 60,
        5 => 30 * 60,
        6 => 2 * 60 * 60,
        _ => 6 * 60 * 60, // attempt 7+ stays at 6h cap
    }
}

fn jitter_factor() -> f64 {
    let mut rng = rand::rng();
    rng.random_range(0.8..1.2)
}

/// Maximum attempts before DLQ. Sprint A spec: 10.
pub const MAX_ATTEMPTS: i32 = 10;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn schedule_progresses() {
        assert_eq!(base_delay_secs(1), 1);
        assert_eq!(base_delay_secs(2), 5);
        assert_eq!(base_delay_secs(3), 30);
        assert_eq!(base_delay_secs(4), 300);
        assert_eq!(base_delay_secs(5), 1800);
        assert_eq!(base_delay_secs(6), 7200);
        assert_eq!(base_delay_secs(7), 21600);
        assert_eq!(base_delay_secs(15), 21600); // capped
    }

    #[test]
    fn jitter_in_range() {
        for _ in 0..100 {
            let f = jitter_factor();
            assert!((0.8..1.2).contains(&f));
        }
    }

    #[test]
    fn next_retry_is_in_future() {
        let now = Utc::now();
        let next = next_retry_at(1);
        assert!(next > now);
    }
}
