//! How an app's view is set up: what it may reach, store and do. Everything here is the safety
//! boundary around a page, so it is kept apart from the steps of opening one.

use gtk4::prelude::{Cast, ObjectExt, WidgetExt};
use webkit6::prelude::{PolicyDecisionExt, WebViewExt};
use webkit6::{
    CacheModel, HardwareAccelerationPolicy, MemoryPressureSettings, NavigationPolicyDecision,
    NetworkSession, WebContext, WebView, WebsiteDataTypes,
};

use crate::timezone;

/// This screen's browser has no WebAuthn, so a key can neither be added nor used here. The owner keeps
/// Kanidm's key buttons in view on the credentials page, because keys are core, with a line saying where to use
/// one; on the sign-in page the Passkey choices are hidden, with the same line, because they could only stall.
const NO_KEYS_HERE: &str = ":has(> [hx-post='/ui/reset/add_passkey'])::after { display: block; margin-top: 0.5rem; \
    content: 'This screen has no key reader. To add a key, open this page in a browser on a computer or phone.'; }\n\
    li:has(> form > input[name='mech'][value='passkey']), \
    li:has(> form > input[name='mech'][value='passwordsecuritykey']) { display: none !important; }\n\
    ul:has(input[name='mech'][value='passkey'])::after, ul:has(input[name='mech'][value='passwordsecuritykey'])::after { \
    display: block; content: 'A passkey needs a phone or computer: this screen has no key reader.'; }";

/// The app's sign-in page: arriving there means its user signed out, or never signed in.
const SIGN_IN_PATH: &str = "/login";

/// True when the view has come to the app's own sign-in page.
fn is_sign_in_page(uri: &str, origin: &str) -> bool {
    uri.strip_prefix(origin)
        .and_then(|rest| rest.strip_prefix(SIGN_IN_PATH))
        .is_some_and(|rest| rest.is_empty() || rest.starts_with(['?', '/', '#']))
}

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
fn leaves_this_app(
    decision: &NavigationPolicyDecision,
    origin: &str,
    sign_in: Option<&str>,
) -> bool {
    let target = decision
        .navigation_action()
        .and_then(|mut action| action.request())
        .and_then(|request| request.uri());
    !target.is_some_and(|uri| {
        is_local_page(&uri, origin) || sign_in.is_some_and(|other| is_local_page(&uri, other))
    })
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
// Caches go before compiled code, and both well before the limit, so the page slows a little rather
// than running out. Checked when the shell is compiled.
const _: () = assert!(CONSERVATIVE_SHARE < STRICT_SHARE && STRICT_SHARE < 1.0);

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
pub(crate) fn new_view(
    filter: &webkit6::UserContentFilter,
    origin: &str,
    sign_in: Option<&str>,
) -> WebView {
    timezone::export_for_children();
    let session = NetworkSession::new_ephemeral();
    session.connect_download_started(|_, download| download.cancel());
    let content = webkit6::UserContentManager::new();
    content.add_filter(filter);
    content.add_style_sheet(&webkit6::UserStyleSheet::new(
        NO_KEYS_HERE,
        webkit6::UserContentInjectedFrames::AllFrames,
        webkit6::UserStyleLevel::User,
        &[],
        &[],
    ));
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
    if sign_in.is_some() {
        forget_sign_in_on_sign_out(&view, &session, origin);
    }
    let (origin, sign_in) = (origin.to_owned(), sign_in.map(str::to_owned));
    view.connect_decide_policy(move |_, decision, kind| {
        let leaves = match kind {
            // A new window would have no way back in a one-window shell.
            webkit6::PolicyDecisionType::NewWindowAction => true,
            webkit6::PolicyDecisionType::NavigationAction => decision
                .downcast_ref::<NavigationPolicyDecision>()
                .is_some_and(|navigation| leaves_this_app(navigation, &origin, sign_in.as_deref())),
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

/// When an app that signs in elsewhere comes back to its own sign-in page, its view forgets every cookie,
/// the identity provider's session among them, so the next person at the screen is asked to sign in rather
/// than handed the last person's session. The app's own session is already gone by then.
fn forget_sign_in_on_sign_out(view: &WebView, session: &NetworkSession, origin: &str) {
    let (session, origin) = (session.clone(), origin.to_owned());
    view.connect_notify_local(Some("uri"), move |view, _| {
        if view.uri().is_some_and(|uri| is_sign_in_page(&uri, &origin)) {
            if let Some(data) = session.website_data_manager() {
                data.clear(
                    WebsiteDataTypes::COOKIES,
                    gtk4::glib::TimeSpan::from_seconds(0),
                    gtk4::gio::Cancellable::NONE,
                    |_| {},
                );
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::{is_local_page, is_sign_in_page};

    /// Only the app's own sign-in page clears the view's cookies, not a page that merely looks like it.
    #[test]
    fn only_the_apps_own_sign_in_page_counts() {
        assert!(is_sign_in_page(
            "https://screen.medbrains.local:8443/login",
            "https://screen.medbrains.local:8443"
        ));
        assert!(is_sign_in_page(
            "https://screen.medbrains.local:8443/login?sso_error=unavailable",
            "https://screen.medbrains.local:8443"
        ));
        assert!(!is_sign_in_page(
            "https://screen.medbrains.local:8443/loginhelp",
            "https://screen.medbrains.local:8443"
        ));
        assert!(!is_sign_in_page(
            "https://screen.medbrains.local:8443/dashboard",
            "https://screen.medbrains.local:8443"
        ));
        assert!(!is_sign_in_page(
            "https://idm.medbrains.local:9443/login",
            "https://screen.medbrains.local:8443"
        ));
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
