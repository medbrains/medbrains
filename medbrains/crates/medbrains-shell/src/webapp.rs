//! MedBrains in an embedded WebKitGTK view: this machine's own front end and nothing else.

use std::cell::RefCell;
use std::rc::Rc;

use gtk4 as gtk;
use gtk4::prelude::{BoxExt, WidgetExt};
use gtk4::{gio, glib};
use webkit6::prelude::{PolicyDecisionExt, WebViewExt};
use webkit6::{HardwareAccelerationPolicy, NetworkSession, UserContentFilterStore, WebView};

use crate::ui;

const APP_URL: &str = "https://127.0.0.1:8443/";
/// Default deny: blocks everything except the origin above, `blob:` and `data:`.
const CONTENT_FILTER: &str = include_str!("../content-filter.json");
/// WebKit compiles the filter into a file here, inside the screen's own writable directory.
const FILTER_STORE: &str = "/var/lib/kiosk/content-filter";

/// The app's page in the desktop: a sentence until the view exists, then the view.
#[derive(Clone)]
pub(crate) struct WebApp {
    /// What the desktop puts in its stack.
    pub(crate) root: gtk::Box,
    words: gtk::Label,
    view: Rc<RefCell<Option<WebView>>>,
}

/// Builds the view. Sessions are ephemeral, so nothing a page stores reaches the disk, and
/// downloads, printing and uploads are refused: the appliance has no safe way to do them yet.
fn new_view(filter: &webkit6::UserContentFilter) -> WebView {
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
    // A crashed page must not leave a blank screen, because a blank screen reads as a fact.
    view.connect_web_process_terminated(|view, _| view.reload());
    // A new window would have no way back in a one-window shell, so links stay here.
    view.connect_decide_policy(|_, decision, kind| {
        if kind == webkit6::PolicyDecisionType::NewWindowAction {
            decision.ignore();
            return true;
        }
        false
    });
    view.set_vexpand(true);
    view.set_hexpand(true);
    view
}

impl WebApp {
    /// An empty page. The view costs memory, so it is made only when first opened.
    pub(crate) fn new() -> Self {
        let root = ui::column(0);
        let words = ui::label("MedBrains is starting. It opens here by itself.", "title");
        words.set_halign(gtk::Align::Center);
        words.set_valign(gtk::Align::Center);
        words.set_vexpand(true);
        root.append(&words);
        Self {
            root,
            words,
            view: Rc::default(),
        }
    }

    /// True once the view exists.
    fn is_open(&self) -> bool {
        self.view.borrow().is_some()
    }

    /// Shows the sentence for when the app cannot be opened.
    pub(crate) fn show_starting(&self) {
        if !self.is_open() {
            self.words.set_visible(true);
        }
    }

    /// Makes the view on first use. The filter is compiled first: if it cannot be, the app
    /// does not open at all, because without it the view has no navigation limit.
    pub(crate) fn open(&self) {
        if self.is_open() {
            return;
        }
        let store = UserContentFilterStore::new(FILTER_STORE);
        let source = glib::Bytes::from_static(CONTENT_FILTER.as_bytes());
        let app = self.clone();
        store.save(
            "medbrains",
            &source,
            None::<&gio::Cancellable>,
            move |result| match result {
                Ok(filter) => {
                    let view = new_view(&filter);
                    app.words.set_visible(false);
                    app.root.append(&view);
                    view.load_uri(APP_URL);
                    view.grab_focus();
                    *app.view.borrow_mut() = Some(view);
                }
                Err(_) => app
                    .words
                    .set_label("MedBrains could not open safely here. Restart the machine."),
            },
        );
    }

    /// Gives the view the keyboard, on returning to it.
    pub(crate) fn focus(&self) {
        if let Some(view) = self.view.borrow().as_ref() {
            view.grab_focus();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::CONTENT_FILTER;
    use serde_json::Value;

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
