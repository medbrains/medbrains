//! The ceiling on what automation may consume.
//!
//! Automation is the part of this system most likely to misbehave: it runs
//! code somebody wrote in a browser, on a schedule, against systems that go
//! slow. Embedded in the clinical server, an unbounded engine competes with
//! patient registration for the same connection pool — so a runaway workflow
//! would take the hospital down with it.
//!
//! The guard makes that impossible by construction. Automation gets a fixed
//! number of concurrent executions and no more; work beyond it waits. The
//! failure mode becomes "automation is slow", which is survivable, instead of
//! "the hospital is down", which is not.

use std::sync::Arc;
use tokio::sync::{OwnedSemaphorePermit, Semaphore};

/// How many workflows may run at once when nothing says otherwise.
///
/// Deliberately small for the embedded deployment: automation is a background
/// concern sharing a pool with clinical traffic.
pub const DEFAULT_CONCURRENCY: usize = 4;

/// The largest ceiling worth honouring. Above this the limit is not a limit.
const MAX_CONCURRENCY: usize = 256;

#[derive(Debug, Clone)]
pub struct Guard {
    slots: Arc<Semaphore>,
    limit: usize,
}

impl Guard {
    /// A guard admitting `concurrency` executions at once, clamped to
    /// something sane — a misconfigured `0` would stop automation entirely and
    /// look like a hang.
    #[must_use]
    pub fn new(concurrency: usize) -> Self {
        let limit = concurrency.clamp(1, MAX_CONCURRENCY);
        Guard { slots: Arc::new(Semaphore::new(limit)), limit }
    }

    #[must_use]
    pub fn limit(&self) -> usize {
        self.limit
    }

    /// How many executions could start right now.
    #[must_use]
    pub fn available(&self) -> usize {
        self.slots.available_permits()
    }

    /// Wait for a slot. The permit releases when dropped, so a panicking or
    /// cancelled execution cannot leak one.
    pub async fn admit(&self) -> Admission {
        // The semaphore is never closed, so this cannot fail; mapping it keeps
        // the caller from having to handle an impossible error.
        match Arc::clone(&self.slots).acquire_owned().await {
            Ok(permit) => Admission { _permit: Some(permit) },
            Err(_) => Admission { _permit: None },
        }
    }

    /// Take a slot only if one is free. Used where waiting is worse than
    /// skipping — a scheduler tick would rather drop this minute's run than
    /// queue every minute behind a slow one.
    #[must_use]
    pub fn try_admit(&self) -> Option<Admission> {
        Arc::clone(&self.slots)
            .try_acquire_owned()
            .ok()
            .map(|permit| Admission { _permit: Some(permit) })
    }
}

impl Default for Guard {
    fn default() -> Self {
        Guard::new(DEFAULT_CONCURRENCY)
    }
}

/// Permission to run, released on drop.
#[derive(Debug)]
pub struct Admission {
    _permit: Option<OwnedSemaphorePermit>,
}

#[cfg(test)]
mod tests {
    // Tests may state what must hold and stop if it does not; that is what a
    // test is. The denials exist for code the hospital runs.
    #![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic, clippy::indexing_slicing)]

    use super::*;

    #[test]
    fn a_nonsensical_limit_is_corrected_rather_than_honoured() {
        // Zero would stop automation dead and present as a hang.
        assert_eq!(Guard::new(0).limit(), 1);
        assert_eq!(Guard::new(usize::MAX).limit(), MAX_CONCURRENCY);
        assert_eq!(Guard::new(8).limit(), 8);
    }

    #[tokio::test]
    async fn only_the_permitted_number_run_at_once() {
        let guard = Guard::new(2);

        let first = guard.admit().await;
        let second = guard.admit().await;
        assert_eq!(guard.available(), 0);

        assert!(guard.try_admit().is_none(), "the third must wait");

        drop(first);
        assert!(guard.try_admit().is_some(), "a finished run frees its slot");
        drop(second);
    }

    #[tokio::test]
    async fn a_slot_is_released_even_when_the_work_unwinds() {
        let guard = Guard::new(1);

        {
            let _admission = guard.admit().await;
            assert_eq!(guard.available(), 0);
        }

        assert_eq!(guard.available(), 1, "the permit must not leak");
    }

    #[tokio::test]
    async fn waiting_for_a_slot_eventually_succeeds() {
        let guard = Guard::new(1);
        let held = guard.admit().await;

        let waiting = tokio::spawn({
            let guard = guard.clone();
            async move {
                let _admission = guard.admit().await;
                true
            }
        });

        drop(held);
        assert!(waiting.await.expect("the waiter should be admitted"));
    }

    #[test]
    fn the_default_is_conservative_because_it_shares_a_pool() {
        assert_eq!(Guard::default().limit(), DEFAULT_CONCURRENCY);
        const { assert!(DEFAULT_CONCURRENCY <= 8, "automation is a background concern") };
    }
}
