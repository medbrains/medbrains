//! How an app's view is set up: what it may reach, store and do. Everything here is the safety
//! boundary around a page, so it is kept apart from the steps of opening one.

use gtk4::prelude::{Cast, WidgetExt};
use webkit6::prelude::{PolicyDecisionExt, WebViewExt};
use webkit6::{
    CacheModel, HardwareAccelerationPolicy, MemoryPressureSettings, NavigationPolicyDecision,
    NetworkSession, WebContext, WebView,
};

use crate::timezone;

/// True for a page the view may show: the app's own origin, or what it made in memory.
fn is_local_page(uri: &str, origin: &str) -> bool {
    uri.strip_prefix(origin)
        .is_some_and(|rest| rest.starts_with('/'))
        || uri.starts_with("blob:")
        || uri.starts_with("data:")
        || uri == "about:blank"
}

/// True for a navigation away from this app. The content filter would block it too, but on a
/// dead-end page; refusing it here leaves the person where they were.
fn leaves_this_app(decision: &NavigationPolicyDecision, origin: &str) -> bool {
    let target = decision
        .navigation_action()
        .and_then(|mut action| action.request())
        .and_then(|request| request.uri());
    !target.is_some_and(|uri| is_local_page(&uri, origin))
}

/// Memory WebKit may use before it starts giving memory back, in MB. At half of it the page
/// process drops its caches; at two thirds it also drops compiled JavaScript. Nothing is killed:
/// a clinician's page is never ended to save memory. Tune from measurements (OS-BUILD-PLAN D4.11).
const WEB_PROCESS_LIMIT_MB: u32 = 512;
/// The same for WebKit's network process, which holds connections and the HTTP cache.
const NETWORK_PROCESS_LIMIT_MB: u32 = 128;
/// Share of the limit at which caches are dropped, then compiled code too.
const CONSERVATIVE_SHARE: f64 = 0.5;
const STRICT_SHARE: f64 = 0.65;

/// The memory pressure thresholds for one WebKit process.
fn pressure(limit_mb: u32) -> MemoryPressureSettings {
    let mut settings = MemoryPressureSettings::new();
    settings.set_memory_limit(limit_mb);
    settings.set_conservative_threshold(CONSERVATIVE_SHARE);
    settings.set_strict_threshold(STRICT_SHARE);
    settings
}

thread_local! {
    /// One WebKit context for every app view, made on first use. "Document viewer" is WebKit's
    /// smallest cache model: no large memory cache and no back-forward page cache, which an app
    /// that reloads from its own server does not need.
    static CONTEXT: WebContext = {
        NetworkSession::set_memory_pressure_settings(&mut pressure(NETWORK_PROCESS_LIMIT_MB));
        let context = WebContext::builder()
            .memory_pressure_settings(&pressure(WEB_PROCESS_LIMIT_MB))
            .build();
        context.set_cache_model(CacheModel::DocumentViewer);
        context
    };
}

/// Builds a view with a session of its own, so apps can't read each other's storage. Sessions are
/// ephemeral, so nothing a page stores reaches the disk, and downloads, printing and uploads are
/// refused: the appliance has no safe way to do them yet.
pub(crate) fn new_view(filter: &webkit6::UserContentFilter, origin: &str) -> WebView {
    timezone::export_for_children();
    let session = NetworkSession::new_ephemeral();
    session.connect_download_started(|_, download| download.cancel());
    let content = webkit6::UserContentManager::new();
    content.add_filter(filter);
    let view = CONTEXT.with(|context| {
        WebView::builder()
            .web_context(context)
            .network_session(&session)
            .user_content_manager(&content)
            .build()
    });
    if let Some(settings) = WebViewExt::settings(&view) {
        settings.set_hardware_acceleration_policy(HardwareAccelerationPolicy::Never);
        settings.set_enable_developer_extras(false);
        // Back-forward pages kept in memory and animated scrolling cost memory and CPU on a
        // shared screen for no clinical gain. WebGL stays on: the 3D body-site picker needs it.
        settings.set_enable_page_cache(false);
        settings.set_enable_smooth_scrolling(false);
    }
    view.connect_print(|_, _| true);
    // A file chooser is a second window, and `cage` did not show ours: its modal grab would
    // block all input. Uploads stay off here, as they were under WPE.
    view.connect_run_file_chooser(|_, request| {
        request.cancel();
        true
    });
    let origin = origin.to_owned();
    view.connect_decide_policy(move |_, decision, kind| {
        let leaves = match kind {
            // A new window would have no way back in a one-window shell.
            webkit6::PolicyDecisionType::NewWindowAction => true,
            webkit6::PolicyDecisionType::NavigationAction => decision
                .downcast_ref::<NavigationPolicyDecision>()
                .is_some_and(|navigation| leaves_this_app(navigation, &origin)),
            _ => false,
        };
        if leaves {
            decision.ignore();
        }
        leaves
    });
    view.set_vexpand(true);
    view.set_hexpand(true);
    view
}

#[cfg(test)]
mod tests {
    use super::{CONSERVATIVE_SHARE, STRICT_SHARE, is_local_page};

    /// Caches go before compiled code, and both well before the limit, so the page slows a
    /// little rather than running out.
    #[test]
    fn memory_is_given_back_in_order_before_the_limit() {
        assert!(CONSERVATIVE_SHARE < STRICT_SHARE);
        assert!(STRICT_SHARE < 1.0);
    }

    const ORIGIN: &str = "https://127.0.0.1:8443";

    /// A look-alike host must not pass as this app, or a link could leave it.
    #[test]
    fn only_an_apps_own_pages_count_as_local() {
        assert!(is_local_page("https://127.0.0.1:8443/patients", ORIGIN));
        assert!(is_local_page("blob:https://127.0.0.1:8443/abc", ORIGIN));
        assert!(!is_local_page("https://deb.debian.org/", ORIGIN));
        assert!(!is_local_page(
            "https://127.0.0.1:8443.evil.example/",
            ORIGIN
        ));
        assert!(!is_local_page("https://127.0.0.1:84430/", ORIGIN));
        assert!(!is_local_page("http://127.0.0.1:8443/", ORIGIN));
        assert!(!is_local_page("https://127.0.0.1:9000/", ORIGIN));
        assert!(!is_local_page("file:///etc/passwd", ORIGIN));
    }
}
