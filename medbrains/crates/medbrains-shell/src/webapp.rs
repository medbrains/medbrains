//! MedBrains in an embedded WebKitGTK view: this machine's own front end and nothing else.
//! Opening it goes through named stages, each with words on the screen, a log line and a limit,
//! so it can never sit on one sentence forever.

use std::cell::{Cell, RefCell};
use std::rc::Rc;
use std::time::{Duration, Instant};

use gtk4 as gtk;
use gtk4::prelude::{BoxExt, ButtonExt, Cast, WidgetExt};
use gtk4::{gio, glib};
use webkit6::prelude::{PolicyDecisionExt, WebViewExt};
use webkit6::{
    HardwareAccelerationPolicy, LoadEvent, NavigationPolicyDecision, NetworkSession,
    UserContentFilterStore, WebView,
};

use crate::{api, ui};

const APP_URL: &str = "https://127.0.0.1:8443/";
/// Default deny: blocks everything except the origin above, `blob:` and `data:`.
const CONTENT_FILTER: &str = include_str!("../content-filter.json");
/// WebKit compiles the filter into a file here, inside the screen's own writable directory.
const FILTER_STORE: &str = "/var/lib/kiosk/content-filter";
const LOG: &str = "medbrains-shell";
/// How often to ask the server while waiting for it.
const SERVER_POLL: Duration = Duration::from_secs(1);
/// A first start migrates and seeds; after this long the wait is a fault, not patience.
const SERVER_PATIENCE: Duration = Duration::from_secs(300);
/// Compiling the filter takes under a second, so this means it is stuck.
const FILTER_PATIENCE: Duration = Duration::from_secs(30);
/// How long the first page may take. Generous, for a loaded machine with software rendering.
const PAGE_PATIENCE: Duration = Duration::from_secs(120);
/// A page crashing this many times in a row stops the automatic reloads.
const MAX_CRASHES: u32 = 3;

/// True for a page the view may show: the app itself, or what the app made in memory.
fn is_local_page(uri: &str) -> bool {
    uri.starts_with(APP_URL)
        || uri.starts_with("blob:")
        || uri.starts_with("data:")
        || uri == "about:blank"
}

/// True for a navigation away from this machine's app. The content filter would block it too,
/// but on a dead-end page; refusing it here leaves the person where they were.
fn leaves_this_machine(decision: &NavigationPolicyDecision) -> bool {
    let target = decision
        .navigation_action()
        .and_then(|mut action| action.request())
        .and_then(|request| request.uri());
    !target.is_some_and(|uri| is_local_page(&uri))
}

/// The sentence while waiting for the server.
fn waiting_words(waited: Duration) -> String {
    match waited.as_secs() {
        0..=1 => "Connecting to the MedBrains server.".to_owned(),
        seconds => format!("Waiting for the MedBrains server to start. {seconds} seconds so far."),
    }
}

/// The app's page in the desktop. Stages: wait for the server, prepare the filter, load the
/// page, then show it. Any stage can end in a stated failure with Try again.
#[derive(Clone)]
pub(crate) struct WebApp {
    /// What the desktop puts in its stack.
    pub(crate) root: gtk::Stack,
    words: gtk::Label,
    progress: gtk::ProgressBar,
    retry: gtk::Button,
    view: Rc<RefCell<Option<WebView>>>,
    /// Bumped by each attempt, so a timer or answer from an older attempt does nothing.
    attempt: Rc<Cell<u64>>,
    crashes: Rc<Cell<u32>>,
    /// True from the first request until the view is showing or a failure stops it.
    busy: Rc<Cell<bool>>,
}

impl WebApp {
    /// An empty page. The view costs memory, so it is made only when first opened.
    pub(crate) fn new() -> Self {
        let status = ui::column(ui::GAP);
        status.add_css_class("app-status");
        status.set_halign(gtk::Align::Center);
        status.set_valign(gtk::Align::Center);
        let words = ui::label("", "title");
        let progress = gtk::ProgressBar::new();
        let retry = ui::button("Try again", "suggested-action");
        retry.set_halign(gtk::Align::Start);
        retry.set_visible(false);
        status.append(&words);
        status.append(&progress);
        status.append(&retry);
        let root = ui::stack();
        root.add_named(&status, Some("status"));
        let app = Self {
            root,
            words,
            progress,
            retry,
            view: Rc::default(),
            attempt: Rc::default(),
            crashes: Rc::default(),
            busy: Rc::default(),
        };
        let target = app.clone();
        app.retry.connect_clicked(move |_| target.start());
        app
    }

    /// Opens the app, or returns to it. Does nothing new while an attempt is running.
    pub(crate) fn open(&self) {
        if self.is_showing() {
            if let Some(view) = self.view.borrow().as_ref() {
                view.grab_focus();
            }
        } else if !self.busy.get() && !self.retry.is_visible() {
            self.start();
        }
    }

    /// True once the view is the page on screen.
    fn is_showing(&self) -> bool {
        self.root.visible_child_name().as_deref() == Some("view")
    }

    /// Starts a new attempt from the first stage.
    fn start(&self) {
        self.attempt.set(self.attempt.get() + 1);
        self.busy.set(true);
        self.retry.set_visible(false);
        self.progress.set_visible(true);
        self.progress.set_fraction(0.0);
        self.root.set_visible_child_name("status");
        self.wait_for_server(Instant::now());
    }

    /// True if `attempt` is still the current one.
    fn is_current(&self, attempt: u64) -> bool {
        self.attempt.get() == attempt
    }

    /// Stops with a sentence and Try again.
    fn fail(&self, stage: &str, words: &str) {
        glib::g_warning!(LOG, "opening MedBrains failed at {stage}: {words}");
        self.attempt.set(self.attempt.get() + 1);
        self.busy.set(false);
        self.words.set_label(words);
        self.progress.set_visible(false);
        self.retry.set_visible(true);
        self.root.set_visible_child_name("status");
        self.retry.grab_focus();
    }

    /// Stage one: asks the server itself, every second, within a limit.
    fn wait_for_server(&self, since: Instant) {
        let (app, attempt) = (self.clone(), self.attempt.get());
        let waited = since.elapsed();
        self.words.set_label(&waiting_words(waited));
        self.progress.pulse();
        api::server_answers(move |answers| {
            if !app.is_current(attempt) {
                return;
            }
            if answers {
                glib::g_message!(LOG, "server answered after {} s", waited.as_secs());
                app.prepare();
            } else if waited > SERVER_PATIENCE {
                app.fail(
                    "server",
                    "The MedBrains server has not started after 5 minutes. The desktop's status names any service that failed.",
                );
            } else {
                glib::timeout_add_local_once(SERVER_POLL, move || {
                    if app.is_current(attempt) {
                        app.wait_for_server(since);
                    }
                });
            }
        });
    }

    /// Stage two: compiles the filter. If it cannot be, or takes too long, the app doesn't open,
    /// because without it the view has no navigation limit.
    fn prepare(&self) {
        if self.view.borrow().is_some() {
            self.load();
            return;
        }
        let (app, attempt) = (self.clone(), self.attempt.get());
        self.words.set_label("Opening MedBrains.");
        self.progress.set_fraction(0.1);
        glib::g_message!(LOG, "compiling the content filter in {FILTER_STORE}");
        let store = UserContentFilterStore::new(FILTER_STORE);
        let source = glib::Bytes::from_static(CONTENT_FILTER.as_bytes());
        let timed_out = self.clone();
        glib::timeout_add_local_once(FILTER_PATIENCE, move || {
            if timed_out.is_current(attempt) && timed_out.view.borrow().is_none() {
                timed_out.fail("filter", "MedBrains could not open safely: its navigation limit took too long to prepare.");
            }
        });
        store.save("medbrains", &source, None::<&gio::Cancellable>, move |result| {
            if !app.is_current(attempt) {
                return;
            }
            match result {
                Ok(filter) => {
                    glib::g_message!(LOG, "content filter ready");
                    app.make_view(&filter);
                    app.load();
                }
                Err(error) => {
                    glib::g_warning!(LOG, "content filter: {error}");
                    app.fail("filter", "MedBrains could not open safely: its navigation limit could not be prepared.");
                }
            }
        });
    }

    /// Stage three: loads the page and shows the view when it has arrived.
    fn load(&self) {
        let attempt = self.attempt.get();
        self.words.set_label("Loading MedBrains.");
        self.progress.set_fraction(0.2);
        if let Some(view) = self.view.borrow().as_ref() {
            glib::g_message!(LOG, "loading {APP_URL}");
            view.load_uri(APP_URL);
        }
        let app = self.clone();
        glib::timeout_add_local_once(PAGE_PATIENCE, move || {
            if app.is_current(attempt) && app.busy.get() {
                app.fail("page", "MedBrains did not load in 2 minutes. Check the machine's status, then try again.");
            }
        });
    }

    /// Builds the view. Sessions are ephemeral, so nothing a page stores reaches the disk, and
    /// downloads, printing and uploads are refused: the appliance has no safe way to do them yet.
    fn make_view(&self, filter: &webkit6::UserContentFilter) {
        let session = NetworkSession::new_ephemeral();
        session.connect_download_started(|_, download| download.cancel());
        let content = webkit6::UserContentManager::new();
        content.add_filter(filter);
        let view = WebView::builder()
            .network_session(&session)
            .user_content_manager(&content)
            .build();
        if let Some(settings) = WebViewExt::settings(&view) {
            settings.set_hardware_acceleration_policy(HardwareAccelerationPolicy::Never);
            settings.set_enable_developer_extras(false);
        }
        view.connect_print(|_, _| true);
        // A file chooser is a second window, and `cage` did not show ours: its modal grab would
        // block all input. Uploads stay off here, as they were under WPE.
        view.connect_run_file_chooser(|_, request| {
            request.cancel();
            true
        });
        view.connect_decide_policy(|_, decision, kind| {
            let leaves = match kind {
                // A new window would have no way back in a one-window shell.
                webkit6::PolicyDecisionType::NewWindowAction => true,
                webkit6::PolicyDecisionType::NavigationAction => decision
                    .downcast_ref::<NavigationPolicyDecision>()
                    .is_some_and(leaves_this_machine),
                _ => false,
            };
            if leaves {
                decision.ignore();
            }
            leaves
        });
        self.connect_view_signals(&view);
        view.set_vexpand(true);
        view.set_hexpand(true);
        self.root.add_named(&view, Some("view"));
        *self.view.borrow_mut() = Some(view);
    }

    /// Follows the page's progress and failures.
    fn connect_view_signals(&self, view: &WebView) {
        let app = self.clone();
        view.connect_estimated_load_progress_notify(move |view| {
            if app.busy.get() {
                app.progress
                    .set_fraction(0.2 + 0.8 * view.estimated_load_progress());
            }
        });
        let app = self.clone();
        view.connect_load_changed(move |view, event| {
            if event == LoadEvent::Finished && app.busy.get() {
                glib::g_message!(LOG, "page loaded");
                app.busy.set(false);
                app.crashes.set(0);
                app.attempt.set(app.attempt.get() + 1);
                app.root.set_visible_child_name("view");
                view.grab_focus();
            }
        });
        let app = self.clone();
        view.connect_load_failed(move |_, _, uri, error| {
            glib::g_warning!(LOG, "load of {uri} failed: {error}");
            if app.busy.get() {
                app.fail(
                    "page",
                    "MedBrains could not be loaded from this machine's own front end.",
                );
            }
            app.busy.get()
        });
        let app = self.clone();
        // A crashed page must not leave a blank screen, because a blank screen reads as a fact.
        view.connect_web_process_terminated(move |view, reason| {
            glib::g_warning!(LOG, "the page's process ended: {reason:?}");
            app.crashes.set(app.crashes.get() + 1);
            if app.crashes.get() > MAX_CRASHES {
                app.fail(
                    "page",
                    "MedBrains keeps stopping on this machine. It may be out of memory.",
                );
            } else {
                view.reload();
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::{CONTENT_FILTER, Duration, is_local_page, waiting_words};
    use serde_json::Value;

    /// A look-alike host must not pass as this machine, or a link could leave it.
    #[test]
    fn only_this_machines_own_pages_count_as_local() {
        assert!(is_local_page("https://127.0.0.1:8443/patients"));
        assert!(is_local_page("blob:https://127.0.0.1:8443/abc"));
        assert!(!is_local_page("https://deb.debian.org/"));
        assert!(!is_local_page("https://127.0.0.1:8443.evil.example/"));
        assert!(!is_local_page("http://127.0.0.1:8443/"));
        assert!(!is_local_page("file:///etc/passwd"));
    }

    /// The owner saw a sentence that never changed: waiting must say how long it has been.
    #[test]
    fn waiting_says_how_long_it_has_been() {
        assert!(waiting_words(Duration::from_secs(0)).starts_with("Connecting"));
        assert!(waiting_words(Duration::from_secs(42)).contains("42 seconds"));
    }

    /// The rules run in order, so the block must come first and allow only this machine.
    #[test]
    fn navigation_is_default_deny_and_allows_only_the_local_app() {
        let rules: Value = serde_json::from_str(CONTENT_FILTER).unwrap_or(Value::Null);
        let rules = rules.as_array().map_or(&[][..], Vec::as_slice);
        let filter = |rule: &Value| {
            rule["trigger"]["url-filter"]
                .as_str()
                .unwrap_or("")
                .to_owned()
        };
        assert_eq!(filter(&rules[0]), ".*");
        assert_eq!(rules[0]["action"]["type"], "block");
        let allowed: Vec<String> = rules[1..].iter().map(filter).collect();
        assert_eq!(
            allowed,
            ["^https://127\\.0\\.0\\.1:8443/", "^blob:", "^data:"]
        );
    }
}
