//! Which apps are open and which one is on screen. Plain data with no widgets, so every rule
//! about closing, Home and switching is tested without a display.

use std::time::{Duration, Instant};

/// The open apps, by index into the desktop's list, in the order they were opened.
#[derive(Debug, Default, PartialEq, Eq)]
pub(crate) struct Running {
    open: Vec<usize>,
    showing: Option<usize>,
    /// When each open app in the background last left the screen.
    left: Vec<(usize, Instant)>,
}

impl Running {
    /// Opens an app, or switches back to it if it is already open.
    pub(crate) fn open(&mut self, app: usize, now: Instant) {
        if self.showing != Some(app) {
            self.leave(now);
        }
        if !self.open.contains(&app) {
            self.open.push(app);
        }
        self.left.retain(|(left, _)| *left != app);
        self.showing = Some(app);
    }

    /// Goes to the desktop. Every app stays open, as it was.
    pub(crate) fn home(&mut self, now: Instant) {
        self.leave(now);
        self.showing = None;
    }

    /// Notes that the app on screen, if any, is going to the background now.
    fn leave(&mut self, now: Instant) {
        if let Some(app) = self.showing {
            self.left.push((app, now));
        }
    }

    /// The background apps that have been off screen for at least `limit`. Their views can be
    /// closed to give the memory back; opening one again loads it fresh.
    pub(crate) fn idle(&self, now: Instant, limit: Duration) -> Vec<usize> {
        self.left
            .iter()
            .filter(|(_, since)| now.saturating_duration_since(*since) >= limit)
            .map(|(app, _)| *app)
            .collect()
    }

    /// Ends an app. If it was on screen, the desktop shows next.
    pub(crate) fn close(&mut self, app: usize) {
        self.open.retain(|open| *open != app);
        self.left.retain(|(left, _)| *left != app);
        if self.showing == Some(app) {
            self.showing = None;
        }
    }

    /// True while an app is open, on screen or not.
    pub(crate) fn is_open(&self, app: usize) -> bool {
        self.open.contains(&app)
    }

    /// The app on screen, if any.
    pub(crate) const fn showing(&self) -> Option<usize> {
        self.showing
    }

    /// The app to switch to: the one after the current, wrapping, or the first from the desktop.
    pub(crate) fn next(&self) -> Option<usize> {
        let current = self
            .showing
            .and_then(|app| self.open.iter().position(|o| *o == app));
        let at = current.map_or(0, |at| at + 1);
        self.open.get(at).or_else(|| self.open.first()).copied()
    }
}

#[cfg(test)]
mod tests {
    use std::time::{Duration, Instant};

    use super::Running;

    /// Home is minimise: the app must still be there to come back to.
    #[test]
    fn home_keeps_the_app_open_and_opening_it_again_switches_back() {
        let mut running = Running::default();
        running.open(3, Instant::now());
        running.home(Instant::now());
        assert_eq!(running.showing(), None);
        assert!(running.is_open(3));
        running.open(3, Instant::now());
        assert_eq!(running.showing(), Some(3));
        assert_eq!(running.next(), Some(3));
    }

    /// Close ends the app, so the next open is a new one, not the old one returning.
    #[test]
    fn closing_ends_the_app_and_returns_to_the_desktop() {
        let mut running = Running::default();
        running.open(1, Instant::now());
        running.close(1);
        assert!(!running.is_open(1));
        assert_eq!(running.showing(), None);
        assert_eq!(running.next(), None);
    }

    /// Closing one in the background must not move the person off the one they are using.
    #[test]
    fn closing_another_app_leaves_the_screen_alone() {
        let mut running = Running::default();
        running.open(1, Instant::now());
        running.open(2, Instant::now());
        running.close(1);
        assert_eq!(running.showing(), Some(2));
    }

    #[test]
    fn switching_walks_the_open_apps_and_wraps() {
        let mut running = Running::default();
        assert_eq!(running.next(), None);
        running.open(1, Instant::now());
        running.open(2, Instant::now());
        running.open(3, Instant::now());
        assert_eq!(running.next(), Some(1));
        running.open(1, Instant::now());
        assert_eq!(running.next(), Some(2));
        running.home(Instant::now());
        assert_eq!(running.next(), Some(1));
    }

    /// Only apps left in the background past the limit are idle, never the one on screen, and an
    /// app that comes back starts its clock again.
    #[test]
    fn idle_lists_background_apps_past_the_limit_only() {
        let limit = Duration::from_secs(600);
        let start = Instant::now();
        let mut running = Running::default();
        running.open(1, start);
        running.open(2, start);
        assert_eq!(running.idle(start + limit, limit), vec![1]);
        running.home(start + limit);
        assert_eq!(running.idle(start + limit, limit), vec![1]);
        running.open(1, start + limit);
        assert_eq!(running.idle(start + limit * 2, limit), vec![2]);
        running.close(2);
        assert!(running.idle(start + limit * 3, limit).is_empty());
    }
}
