//! Which apps are open and which one is on screen. Plain data with no widgets, so every rule
//! about closing, Home and switching is tested without a display.

/// The open apps, by index into the desktop's list, in the order they were opened.
#[derive(Debug, Default, PartialEq, Eq)]
pub(crate) struct Running {
    open: Vec<usize>,
    showing: Option<usize>,
}

impl Running {
    /// Opens an app, or switches back to it if it is already open.
    pub(crate) fn open(&mut self, app: usize) {
        if !self.open.contains(&app) {
            self.open.push(app);
        }
        self.showing = Some(app);
    }

    /// Goes to the desktop. Every app stays open, as it was.
    pub(crate) const fn home(&mut self) {
        self.showing = None;
    }

    /// Ends an app. If it was on screen, the desktop shows next.
    pub(crate) fn close(&mut self, app: usize) {
        self.open.retain(|open| *open != app);
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
    use super::Running;

    /// Home is minimise: the app must still be there to come back to.
    #[test]
    fn home_keeps_the_app_open_and_opening_it_again_switches_back() {
        let mut running = Running::default();
        running.open(3);
        running.home();
        assert_eq!(running.showing(), None);
        assert!(running.is_open(3));
        running.open(3);
        assert_eq!(running.showing(), Some(3));
        assert_eq!(running.next(), Some(3));
    }

    /// Close ends the app, so the next open is a new one, not the old one returning.
    #[test]
    fn closing_ends_the_app_and_returns_to_the_desktop() {
        let mut running = Running::default();
        running.open(1);
        running.close(1);
        assert!(!running.is_open(1));
        assert_eq!(running.showing(), None);
        assert_eq!(running.next(), None);
    }

    /// Closing one in the background must not move the person off the one they are using.
    #[test]
    fn closing_another_app_leaves_the_screen_alone() {
        let mut running = Running::default();
        running.open(1);
        running.open(2);
        running.close(1);
        assert_eq!(running.showing(), Some(2));
    }

    #[test]
    fn switching_walks_the_open_apps_and_wraps() {
        let mut running = Running::default();
        assert_eq!(running.next(), None);
        running.open(1);
        running.open(2);
        running.open(3);
        assert_eq!(running.next(), Some(1));
        running.open(1);
        assert_eq!(running.next(), Some(2));
        running.home();
        assert_eq!(running.next(), Some(1));
    }
}
