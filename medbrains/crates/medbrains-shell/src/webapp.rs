//! An app in its own embedded WebKitGTK view: its own storage, its own origin and nothing else.
//! Opening it goes through named stages, each with words on the screen, a log line and a limit,
//! so it can never sit on one sentence forever.

use std::cell::{Cell, RefCell};
use std::rc::Rc;
use std::time::{Duration, Instant};

use gtk4 as gtk;
use gtk4::prelude::{BoxExt, ButtonExt, ObjectExt, WidgetExt};
use gtk4::{gio, glib};
use webkit6::prelude::WebViewExt;
use webkit6::{LoadEvent, UserContentFilterStore, WebView};

use crate::apps::{self, App};
use crate::{api, ui, webview};

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
/// How long a page gets to finish closing before it is ended.
const CLOSE_PATIENCE: Duration = Duration::from_secs(5);

/// What runs once an app's view has gone.
type ClosedAction = Rc<dyn Fn()>;

/// The sentence while waiting for an app's service.
fn waiting_words(name: &str, waited: Duration) -> String {
    match waited.as_secs() {
        0..=1 => format!("Connecting to {name}."),
        seconds => format!("Waiting for {name} to start. {seconds} seconds so far."),
    }
}

/// The app's page in the desktop. Stages: wait for the server, prepare the filter, load the
/// page, then show it. Any stage can end in a stated failure with Try again.
#[derive(Clone)]
pub(crate) struct WebApp {
    /// What the desktop puts in its stack.
    pub(crate) root: gtk::Stack,
    app: Rc<App>,
    url: Rc<str>,
    origin: Rc<str>,
    words: gtk::Label,
    progress: gtk::ProgressBar,
    retry: gtk::Button,
    view: Rc<RefCell<Option<WebView>>>,
    /// Bumped by each attempt, so a timer or answer from an older attempt does nothing.
    attempt: Rc<Cell<u64>>,
    crashes: Rc<Cell<u32>>,
    /// True from the first request until the view is showing or a failure stops it.
    busy: Rc<Cell<bool>>,
    /// Runs once the view has really gone, after any question the page asks.
    closed: Rc<RefCell<Option<ClosedAction>>>,
    /// True once the page has asked about unsaved changes, so nothing forces it shut.
    asking: Rc<Cell<bool>>,
    /// True while an idle close is under way, so a question about unsaved changes is answered
    /// "stay" at once instead of waiting, unseen, in a hidden view.
    idle_closing: Rc<Cell<bool>>,
    /// True once the page refused an idle close, so it is not asked again until it is shown.
    keeps_view: Rc<Cell<bool>>,
}

impl WebApp {
    /// An empty page for an app with a URL. The view costs memory, so it is made only when first
    /// opened. `None` for an app without a local URL, which `apps` has already refused.
    pub(crate) fn new(app: &App) -> Option<Self> {
        let url = app.url.as_deref()?;
        let origin = apps::local_origin(url)?;
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
        let web = Self {
            root,
            app: Rc::new(app.clone()),
            url: Rc::from(url),
            origin: Rc::from(origin),
            words,
            progress,
            retry,
            view: Rc::default(),
            attempt: Rc::default(),
            crashes: Rc::default(),
            busy: Rc::default(),
            closed: Rc::default(),
            asking: Rc::default(),
            idle_closing: Rc::default(),
            keeps_view: Rc::default(),
        };
        let target = web.clone();
        web.retry.connect_clicked(move |_| target.start());
        Some(web)
    }

    /// Opens the app, or returns to it. Does nothing new while an attempt is running.
    pub(crate) fn open(&self) {
        self.keeps_view.set(false);
        if self.is_showing() {
            if let Some(view) = self.view.borrow().as_ref() {
                view.grab_focus();
            }
        } else if !self.busy.get() && !self.retry.is_visible() {
            self.start();
        }
    }

    /// Sets what happens once a close has finished.
    pub(crate) fn on_closed(&self, action: impl Fn() + 'static) {
        *self.closed.borrow_mut() = Some(Rc::new(action));
    }

    /// Asks the app to close. The page may ask about unsaved changes first, in its own view; a
    /// page that never answers is ended after a limit, unless it is asking a person.
    pub(crate) fn close(&self) {
        let Some(view) = self.view.borrow().clone() else {
            self.finish_close();
            return;
        };
        self.asking.set(false);
        self.idle_closing.set(false);
        view.try_close();
        let (app, closing) = (self.clone(), view.downgrade());
        glib::timeout_add_local_once(CLOSE_PATIENCE, move || {
            let still_open = closing.upgrade().is_some();
            if still_open && !app.asking.get() {
                glib::g_warning!(LOG, "{} did not close in time, ending it", app.app.id);
                app.finish_close();
            }
        });
    }

    /// Closes the view of an app left in the background, to give its memory back. Unlike `close`
    /// it never forces: a page with unsaved changes, or one that does not answer, keeps its view.
    pub(crate) fn close_if_idle(&self) {
        let Some(view) = self.view.borrow().clone() else {
            return;
        };
        if self.busy.get() || self.keeps_view.get() || self.idle_closing.get() {
            return;
        }
        self.idle_closing.set(true);
        view.try_close();
        let app = self.clone();
        glib::timeout_add_local_once(CLOSE_PATIENCE, move || {
            if app.idle_closing.replace(false) {
                app.keeps_view.set(true);
            }
        });
    }

    /// Destroys the view and everything it holds, and returns the page to its starting state.
    fn finish_close(&self) {
        if self.idle_closing.replace(false) {
            glib::g_message!(LOG, "{}: idle view closed to free memory", self.app.id);
        }
        self.attempt.set(self.attempt.get() + 1);
        self.busy.set(false);
        self.retry.set_visible(false);
        self.crashes.set(0);
        self.root.set_visible_child_name("status");
        let view = self.view.borrow_mut().take();
        if let Some(view) = view {
            self.root.remove(&view);
            glib::g_message!(LOG, "{}: view closed", self.app.id);
        }
        let action = self.closed.borrow().clone();
        if let Some(action) = action {
            action();
        }
    }

    /// Loads the page again, or tries again if it isn't showing.
    pub(crate) fn reload(&self) {
        if self.is_showing() {
            if let Some(view) = self.view.borrow().as_ref() {
                view.reload();
            }
        } else if !self.busy.get() {
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
        self.words.set_label(&waiting_words(&self.app.name, waited));
        self.progress.pulse();
        api::app_answers(
            self.app.health.clone(),
            self.app.unit.clone(),
            move |answers| {
                if !app.is_current(attempt) {
                    return;
                }
                if answers {
                    glib::g_message!(LOG, "{} answered after {} s", app.app.id, waited.as_secs());
                    app.prepare();
                } else if waited > SERVER_PATIENCE {
                    let words = format!(
                        "{} has not started after 5 minutes. The desktop names any service that failed.",
                        app.app.name
                    );
                    app.fail("service", &words);
                } else {
                    glib::timeout_add_local_once(SERVER_POLL, move || {
                        if app.is_current(attempt) {
                            app.wait_for_server(since);
                        }
                    });
                }
            },
        );
    }

    /// Stage two: compiles the filter. If it cannot be, or takes too long, the app doesn't open,
    /// because without it the view has no navigation limit.
    fn prepare(&self) {
        if self.view.borrow().is_some() {
            self.load();
            return;
        }
        let (app, attempt) = (self.clone(), self.attempt.get());
        self.words.set_label(&format!("Opening {}.", self.app.name));
        self.progress.set_fraction(0.1);
        glib::g_message!(LOG, "{}: compiling its navigation limit", self.app.id);
        let store = UserContentFilterStore::new(FILTER_STORE);
        let source = glib::Bytes::from_owned(apps::content_filter(&self.origin).into_bytes());
        let timed_out = self.clone();
        glib::timeout_add_local_once(FILTER_PATIENCE, move || {
            if timed_out.is_current(attempt) && timed_out.view.borrow().is_none() {
                let words = format!(
                    "{} could not open safely: its navigation limit took too long to prepare.",
                    timed_out.app.name
                );
                timed_out.fail("filter", &words);
            }
        });
        store.save(
            &self.app.id,
            &source,
            None::<&gio::Cancellable>,
            move |result| {
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
                        let words = format!(
                            "{} could not open safely: its navigation limit could not be prepared.",
                            app.app.name
                        );
                        app.fail("filter", &words);
                    }
                }
            },
        );
    }

    /// Stage three: loads the page and shows the view when it has arrived.
    fn load(&self) {
        let attempt = self.attempt.get();
        self.words.set_label(&format!("Loading {}.", self.app.name));
        self.progress.set_fraction(0.2);
        if let Some(view) = self.view.borrow().as_ref() {
            glib::g_message!(LOG, "{}: loading {}", self.app.id, self.url);
            view.load_uri(&self.url);
        }
        let app = self.clone();
        glib::timeout_add_local_once(PAGE_PATIENCE, move || {
            if app.is_current(attempt) && app.busy.get() {
                let words = format!(
                    "{} did not load in 2 minutes. Check the machine's status, then try again.",
                    app.app.name
                );
                app.fail("page", &words);
            }
        });
    }

    /// Builds the view and follows it.
    fn make_view(&self, filter: &webkit6::UserContentFilter) {
        let view = webview::new_view(filter, &self.origin);
        self.connect_view_signals(&view);
        self.root.add_named(&view, Some("view"));
        *self.view.borrow_mut() = Some(view);
    }

    /// Follows the page's progress, failures and closing.
    fn connect_view_signals(&self, view: &WebView) {
        let app = self.clone();
        view.connect_close(move |_| app.finish_close());
        let app = self.clone();
        // WebKit draws this question inside the view, so it works under `cage`.
        view.connect_script_dialog(move |_, dialog| {
            if dialog.dialog_type() != webkit6::ScriptDialogType::BeforeUnloadConfirm {
                return false;
            }
            if app.idle_closing.replace(false) {
                // Unsaved changes: stay, keep the view, and do not ask again while hidden.
                dialog.confirm_set_confirmed(false);
                app.keeps_view.set(true);
                return true;
            }
            app.asking.set(true);
            false
        });
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
    use super::{Duration, waiting_words};

    /// The owner saw a sentence that never changed: waiting must say how long it has been.
    #[test]
    fn waiting_says_how_long_it_has_been() {
        assert!(waiting_words("Mail", Duration::from_secs(0)).starts_with("Connecting to Mail"));
        assert!(waiting_words("Mail", Duration::from_secs(42)).contains("42 seconds"));
    }
}
