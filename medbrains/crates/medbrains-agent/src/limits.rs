//! How much one address on the network may ask of the main machine. Without this, a stranger with
//! one machine could hold every join conversation open and no real machine could get a word in.

use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::{Arc, Mutex, PoisonError};
use std::time::{Duration, Instant};

const WINDOW: Duration = Duration::from_secs(60);
/// Addresses remembered at once, so the table has a ceiling however many a network shows.
const MAX_TRACKED: usize = 1024;

#[derive(Debug)]
struct Seen {
    live: u32,
    started: u32,
    window_began: Instant,
}

/// Counts conversations per address, up to `max_live` at once and `max_started` a window.
#[derive(Debug)]
pub(crate) struct AddressLimits {
    max_live: u32,
    max_started: u32,
    seen: Mutex<HashMap<IpAddr, Seen>>,
}

/// Holds one address's place in a conversation, and gives it back when dropped.
#[derive(Debug)]
pub(crate) struct Place {
    limits: Arc<AddressLimits>,
    address: IpAddr,
}

impl Drop for Place {
    fn drop(&mut self) {
        let mut seen = self.limits.seen.lock().unwrap_or_else(PoisonError::into_inner);
        if let Some(entry) = seen.get_mut(&self.address) {
            entry.live = entry.live.saturating_sub(1);
        }
    }
}

impl AddressLimits {
    /// Limits for one kind of conversation.
    pub(crate) fn new(max_live: u32, max_started: u32) -> Arc<Self> {
        Arc::new(Self { max_live, max_started, seen: Mutex::default() })
    }

    /// A place for a new conversation from `address`, or `None` if it has had its share.
    pub(crate) fn enter(self: &Arc<Self>, address: IpAddr, now: Instant) -> Option<Place> {
        let mut seen = self.seen.lock().unwrap_or_else(PoisonError::into_inner);
        if seen.len() >= MAX_TRACKED && !seen.contains_key(&address) {
            seen.retain(|_, entry| entry.live > 0 || now - entry.window_began < WINDOW);
            if seen.len() >= MAX_TRACKED {
                return None;
            }
        }
        let entry = seen.entry(address).or_insert(Seen { live: 0, started: 0, window_began: now });
        if now - entry.window_began >= WINDOW {
            entry.started = 0;
            entry.window_began = now;
        }
        if entry.live >= self.max_live || entry.started >= self.max_started {
            return None;
        }
        entry.live += 1;
        entry.started += 1;
        Some(Place { limits: Arc::clone(self), address })
    }
}

/// First pause after a failed accept or receive; it doubles with each failure in a row.
const ERROR_PAUSE_START: Duration = Duration::from_millis(100);
/// Longest pause, so a lasting error (too many open files) costs one try per this long, not a
/// core spinning.
const ERROR_PAUSE_MAX: Duration = Duration::from_secs(5);

/// The pause a socket loop takes after errors in a row: doubling, capped, back to the start on a
/// success.
#[derive(Debug)]
pub(crate) struct ErrorPause(Duration);

impl ErrorPause {
    /// A pause that has seen no errors yet.
    pub(crate) const fn new() -> Self {
        Self(ERROR_PAUSE_START)
    }

    /// Waits out the current pause, then doubles it up to the cap.
    pub(crate) async fn after_error(&mut self) {
        tokio::time::sleep(self.0).await;
        self.0 = self.0.saturating_mul(2).min(ERROR_PAUSE_MAX);
    }

    /// A success: the next error starts again from the shortest pause.
    pub(crate) const fn reset(&mut self) {
        self.0 = ERROR_PAUSE_START;
    }
}

#[cfg(test)]
mod tests {
    use std::net::IpAddr;
    use std::time::{Duration, Instant};

    use super::{
        AddressLimits, ERROR_PAUSE_MAX, ERROR_PAUSE_START, ErrorPause, MAX_TRACKED, WINDOW,
    };

    #[tokio::test(start_paused = true)]
    async fn error_pause_doubles_to_the_cap_and_resets() {
        let mut pause = ErrorPause::new();
        for _ in 0..10 {
            pause.after_error().await;
        }
        assert_eq!(pause.0, ERROR_PAUSE_MAX);
        pause.reset();
        assert_eq!(pause.0, ERROR_PAUSE_START);
        pause.after_error().await;
        assert_eq!(pause.0, ERROR_PAUSE_START * 2);
    }

    const MAX_LIVE: u32 = 3;
    const MAX_STARTED: u32 = 10;

    const STRANGER: IpAddr = IpAddr::V4(std::net::Ipv4Addr::new(10, 0, 0, 66));
    const REAL_MACHINE: IpAddr = IpAddr::V4(std::net::Ipv4Addr::new(10, 0, 0, 7));

    /// The whole point: a stranger holding every place it may have leaves room for a real machine.
    #[test]
    fn one_address_cannot_take_the_places_of_others() {
        let limits = AddressLimits::new(MAX_LIVE, MAX_STARTED);
        let now = Instant::now();
        let held: Vec<_> = (0..MAX_LIVE).filter_map(|_| limits.enter(STRANGER, now)).collect();
        assert_eq!(held.len(), MAX_LIVE as usize);
        assert!(limits.enter(STRANGER, now).is_none(), "the stranger has had its share");
        assert!(limits.enter(REAL_MACHINE, now).is_some(), "a real machine still gets in");
    }

    #[test]
    fn a_finished_conversation_gives_its_place_back() {
        let limits = AddressLimits::new(MAX_LIVE, MAX_STARTED);
        let now = Instant::now();
        for _ in 0..MAX_LIVE {
            assert!(limits.enter(STRANGER, now).is_some(), "each is dropped straight away");
        }
    }

    /// Opening and closing fast must not get round the limit on holding many.
    #[test]
    fn starting_too_often_is_refused_until_the_window_passes() {
        let limits = AddressLimits::new(MAX_LIVE, MAX_STARTED);
        let now = Instant::now();
        for _ in 0..MAX_STARTED {
            assert!(limits.enter(STRANGER, now).is_some());
        }
        assert!(limits.enter(STRANGER, now).is_none());
        assert!(limits.enter(STRANGER, now + WINDOW + Duration::from_secs(1)).is_some());
    }

    /// The table has a ceiling, and old entries make way when it is reached.
    #[test]
    fn the_table_stays_bounded() {
        let limits = AddressLimits::new(MAX_LIVE, MAX_STARTED);
        let now = Instant::now();
        for i in 0..MAX_TRACKED {
            let octets = u32::try_from(i).unwrap_or(0).to_be_bytes();
            assert!(limits.enter(IpAddr::from(octets), now).is_some());
        }
        let later = now + WINDOW + Duration::from_secs(1);
        assert!(limits.enter(REAL_MACHINE, later).is_some(), "aged entries made way");
        assert!(limits.seen.lock().map(|seen| seen.len() <= MAX_TRACKED).unwrap_or(false));
    }
}
