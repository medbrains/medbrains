//! When a person last used the app, for the OS updater's quiet window (`OS-UPDATES.md`).
//!
//! A TCP connection cannot say whether someone is working: on the appliance the machine's own screen and
//! every node's users arrive through the tunnel at the loopback front, and an idle screen polls as much as
//! a busy one. So the server notes each authenticated request a person makes, and the updater reads that
//! time from a file. Not counted: API keys, display screens, and requests the web app marks as background
//! (`X-MedBrains-Background: 1`, sent when nobody has touched the page for a minute). A WebSocket's
//! keep-alive never passes through here. Unmarked clients, such as the native apps, count: wrongly busy
//! only delays an update, wrongly idle would restart a machine in use.
//!
//! Off unless `MEDBRAINS_ACTIVITY_FILE` names the file: only the appliance sets it.

use std::path::PathBuf;
use std::sync::OnceLock;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use axum::http::HeaderMap;

/// The header the web app sets on requests nobody asked for just now.
pub const BACKGROUND_HEADER: &str = "x-medbrains-background";
/// Writes at most once in this many seconds: the updater's threshold is minutes.
const WRITE_EVERY_SECONDS: u64 = 30;

/// When the file was last written, in seconds since 1970.
static LAST_WRITTEN: AtomicU64 = AtomicU64::new(0);

/// The file, if this server keeps one.
fn activity_file() -> Option<&'static PathBuf> {
    static FILE: OnceLock<Option<PathBuf>> = OnceLock::new();
    FILE.get_or_init(|| std::env::var_os("MEDBRAINS_ACTIVITY_FILE").map(PathBuf::from))
        .as_ref()
}

/// Seconds since 1970, or 0 before it.
fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |elapsed| elapsed.as_secs())
}

/// Replaces the file's contents with `seconds` in one step, so the updater never reads half a number.
fn write(path: &PathBuf, seconds: u64) {
    let temporary = path.with_extension("tmp");
    let written = std::fs::write(&temporary, seconds.to_string())
        .and_then(|()| std::fs::rename(&temporary, path));
    if let Err(error) = written {
        tracing::warn!(%error, path = %path.display(), "could not record the last person's request");
    }
}

/// At start: makes the file say "nobody yet" if it says nothing readable, and keeps a time a restart of
/// the server must not forget.
pub fn init() {
    let Some(path) = activity_file() else {
        return;
    };
    let kept = std::fs::read_to_string(path)
        .ok()
        .and_then(|text| text.trim().parse::<u64>().ok());
    match kept {
        Some(seconds) => LAST_WRITTEN.store(seconds, Ordering::Relaxed),
        None => write(path, 0),
    }
}

/// True if this request was made by a person just now: not marked background, and not from a display.
pub fn is_person_request(headers: &HeaderMap, device_variant: Option<&str>) -> bool {
    let background = headers
        .get(BACKGROUND_HEADER)
        .is_some_and(|value| value.as_bytes() == b"1");
    !background && !device_variant.is_some_and(super::auth::is_display_variant)
}

/// Notes a person's request, writing the file at most every `WRITE_EVERY_SECONDS`.
pub fn note(headers: &HeaderMap, device_variant: Option<&str>) {
    let Some(path) = activity_file() else {
        return;
    };
    if !is_person_request(headers, device_variant) {
        return;
    }
    let seconds = now();
    let last = LAST_WRITTEN.load(Ordering::Relaxed);
    if seconds.saturating_sub(last) < WRITE_EVERY_SECONDS {
        return;
    }
    // One writer wins the slot; the others had nothing new to say.
    if LAST_WRITTEN
        .compare_exchange(last, seconds, Ordering::Relaxed, Ordering::Relaxed)
        .is_ok()
    {
        // ponytail: a few bytes on tmpfs at most twice a minute, so written in place, not on a blocking thread.
        write(path, seconds);
    }
}

#[cfg(test)]
mod tests {
    use axum::http::{HeaderMap, HeaderValue};

    use super::{BACKGROUND_HEADER, is_person_request};

    /// A person's request counts; one the page marks as background, or a display's, does not.
    #[test]
    fn only_a_persons_own_request_counts() {
        let plain = HeaderMap::new();
        assert!(is_person_request(&plain, None));
        assert!(is_person_request(&plain, Some("staff")));
        assert!(!is_person_request(&plain, Some("display")));
        assert!(!is_person_request(&plain, Some("tv-opd")));
        let mut background = HeaderMap::new();
        background.insert(BACKGROUND_HEADER, HeaderValue::from_static("1"));
        assert!(!is_person_request(&background, None));
        let mut other = HeaderMap::new();
        other.insert(BACKGROUND_HEADER, HeaderValue::from_static("0"));
        assert!(is_person_request(&other, None));
    }
}
