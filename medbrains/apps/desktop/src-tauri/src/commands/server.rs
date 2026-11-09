//! Which hospital server this desktop opens.
//!
//! The desktop ships no hospital's address. At first launch it shows the setup
//! screen (bundled with the app); the person types the server address or scans
//! the appliance's hospital QR, and the choice is kept in the Tauri store. From
//! then on the window opens that server's own web app, so the page, its API and
//! its CSP all come from the one server, at the version that server runs.
//!
//! The chosen server is the only remote origin the window may navigate to and
//! the only one granted IPC (keyring, printing, notifications), through a
//! capability added at runtime, because a static `tauri.conf.json` cannot name
//! a server chosen after install.

use std::sync::Mutex;
use std::time::Duration;

use serde_json::Value;
use tauri::ipc::CapabilityBuilder;
use tauri::{AppHandle, Manager, Runtime, Url};
use tauri_plugin_store::StoreExt;

use super::binding::{self, BindingInfo};

/// The store file the choice is kept in, under the app's data directory.
const STORE_FILE: &str = "desktop.json";
/// The store key holding the server's origin.
const SERVER_KEY: &str = "server";
/// Debug builds only: open this server instead of the stored one.
const DEV_SERVER_ENV: &str = "MEDBRAINS_DESKTOP_SERVER";
/// Debug builds only: open this route of the server, e.g. `/reports`.
const START_ROUTE_ENV: &str = "MEDBRAINS_DESKTOP_START_ROUTE";
/// The health endpoint every hospital server answers without a session.
const HEALTH_PATH: &str = "/api/health";
/// How long a candidate server has to answer before the person is told.
const HEALTH_TIMEOUT: Duration = Duration::from_secs(8);
/// The runtime capability that grants the chosen server its IPC.
const CAPABILITY_ID: &str = "hospital-server";
/// The label of the one window.
pub(crate) const MAIN_WINDOW: &str = "main";
/// The bundled setup screen (`apps/web` renders it for this query).
pub(crate) const SETUP_PAGE: &str = "index.html?desktopSetup=1";

/// What the chosen server's pages may call. Nothing that reads or writes files
/// or opens other programs: the server's web app needs only these.
const REMOTE_PERMISSIONS: &[&str] = &[
    "allow-keyring-get",
    "allow-keyring-set",
    "allow-keyring-delete",
    "allow-list-printers",
    "allow-print-pdf",
    "allow-system-info",
    "allow-desktop-server-forget",
    "notification:default",
];

/// The server this window may open, once one is chosen.
#[derive(Debug, Default)]
pub(crate) struct ChosenServer(Mutex<Option<Url>>);

/// Why a server address was refused, in words the person can act on.
#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub(crate) enum ServerError {
    #[error("Enter the hospital server's address, such as https://hims.example.org.")]
    Invalid,
    #[error("Use an https:// address. Plain http is allowed only for this computer (localhost).")]
    Insecure,
    #[error("The server at {0} did not answer as a MedBrains server.")]
    Unreachable(String),
    #[error("The choice could not be saved on this computer: {0}")]
    Storage(String),
}

/// Reduce an address to the server's origin: https, or http on this computer.
/// A bare host gets `https://`; any path, query or credentials are dropped.
pub(crate) fn parse_server(input: &str) -> Result<Url, ServerError> {
    let input = input.trim();
    let with_scheme = if input.contains("://") {
        input.to_owned()
    } else {
        format!("https://{input}")
    };
    let url = Url::parse(&with_scheme).map_err(|_| ServerError::Invalid)?;
    let host = url
        .host_str()
        .filter(|h| !h.is_empty())
        .ok_or(ServerError::Invalid)?;
    match url.scheme() {
        "https" => {}
        "http" if is_this_computer(host) => {}
        "http" => return Err(ServerError::Insecure),
        _ => return Err(ServerError::Invalid),
    }
    Url::parse(&url.origin().ascii_serialization()).map_err(|_| ServerError::Invalid)
}

/// The origin as the person reads it, without the trailing slash.
pub(crate) fn display(origin: &Url) -> String {
    origin.origin().ascii_serialization()
}

/// Loopback and `*.localhost` names, the only ones allowed plain http.
fn is_this_computer(host: &str) -> bool {
    matches!(host, "localhost" | "127.0.0.1" | "[::1]") || host.ends_with(".localhost")
}

/// The server to open at launch: the debug override, else the stored choice.
/// A stored value that no longer validates is ignored, so setup runs again.
pub(crate) fn configured<R: Runtime>(app: &AppHandle<R>) -> Option<Url> {
    if cfg!(debug_assertions)
        && let Ok(dev) = std::env::var(DEV_SERVER_ENV)
    {
        return parse_server(&dev).ok();
    }
    let store = app.store(STORE_FILE).ok()?;
    let stored = store.get(SERVER_KEY)?;
    parse_server(stored.as_str()?).ok()
}

/// Allow `origin` to navigate and call IPC, and return the URL to open.
pub(crate) fn admit<R: Runtime>(app: &AppHandle<R>, origin: &Url) -> tauri::Result<Url> {
    let capability = REMOTE_PERMISSIONS.iter().fold(
        CapabilityBuilder::new(CAPABILITY_ID)
            .local(false)
            .window(MAIN_WINDOW)
            .remote(format!("{}/*", display(origin))),
        |capability, permission| capability.permission(*permission),
    );
    app.add_capability(capability)?;
    if let Ok(mut chosen) = app.state::<ChosenServer>().0.lock() {
        *chosen = Some(origin.clone());
    }
    let route = std::env::var(START_ROUTE_ENV)
        .ok()
        .filter(|_| cfg!(debug_assertions));
    let route = route.and_then(|route| origin.join(&route).ok());
    Ok(route.unwrap_or_else(|| origin.clone()))
}

/// The navigation lock: the bundled setup screen and the chosen server only.
/// `about:` and `blob:` pages a server opens for printing stay allowed; a
/// `blob:` URL carries its creator's origin, which is checked.
pub(crate) fn may_navigate<R: Runtime>(app: &AppHandle<R>, url: &Url) -> bool {
    if url.scheme() == "about" || is_bundled(app, url) {
        return true;
    }
    app.state::<ChosenServer>()
        .0
        .lock()
        .ok()
        .and_then(|chosen| {
            chosen
                .as_ref()
                .map(|origin| origin.origin() == url.origin())
        })
        .unwrap_or(false)
}

/// The app's own assets: `tauri://localhost` (macOS, Linux), the
/// `tauri.localhost` host (Windows), and the dev server in debug builds.
fn is_bundled<R: Runtime>(app: &AppHandle<R>, url: &Url) -> bool {
    let dev = cfg!(debug_assertions)
        .then(|| app.config().build.dev_url.as_ref())
        .flatten()
        .is_some_and(|dev| dev.origin() == url.origin());
    dev || url.scheme() == "tauri" || url.host_str() == Some("tauri.localhost")
}

/// Ask the server's health endpoint, so a typo is caught on the setup screen
/// rather than leaving a blank window.
async fn check_health(origin: &Url) -> Result<(), ServerError> {
    let unreachable = || ServerError::Unreachable(display(origin));
    let health = origin.join(HEALTH_PATH).map_err(|_| ServerError::Invalid)?;
    let client = reqwest::Client::builder()
        .timeout(HEALTH_TIMEOUT)
        .build()
        .map_err(|_| unreachable())?;
    let response = client.get(health).send().await.map_err(|_| unreachable())?;
    if response.status().is_success() {
        Ok(())
    } else {
        Err(unreachable())
    }
}

#[allow(
    clippy::needless_pass_by_value,
    reason = "Tauri IPC needs owned arguments"
)]
/// Read a scanned or pasted hospital QR, for the person to confirm.
#[tauri::command]
pub(crate) fn desktop_server_read_code(code: String) -> Result<BindingInfo, String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |d| i64::try_from(d.as_secs()).unwrap_or(i64::MAX));
    binding::read_binding(&code, now).map_err(|e| e.to_string())
}

/// Check, remember and open the hospital server the person chose.
#[tauri::command]
pub(crate) async fn desktop_server_connect<R: Runtime>(
    app: AppHandle<R>,
    address: String,
) -> Result<(), String> {
    let origin = parse_server(&address).map_err(|e| e.to_string())?;
    check_health(&origin).await.map_err(|e| e.to_string())?;
    let store = app
        .store(STORE_FILE)
        .map_err(|e| ServerError::Storage(e.to_string()).to_string())?;
    store.set(SERVER_KEY, Value::String(display(&origin)));
    store
        .save()
        .map_err(|e| ServerError::Storage(e.to_string()).to_string())?;
    let url = admit(&app, &origin).map_err(|e| e.to_string())?;
    let window = app
        .get_webview_window(MAIN_WINDOW)
        .ok_or("The main window is gone.")?;
    window.navigate(url).map_err(|e| e.to_string())
}

#[allow(
    clippy::needless_pass_by_value,
    reason = "Tauri injects the AppHandle by value"
)]
/// Forget the server and restart into the setup screen. A restart, not a
/// navigation, so the old server's runtime capability goes with the process.
#[tauri::command]
pub(crate) fn desktop_server_forget<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    forget(&app)
}

/// Shared by the command and the "Change hospital server" menu item.
pub(crate) fn forget<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let store = app
        .store(STORE_FILE)
        .map_err(|e| ServerError::Storage(e.to_string()).to_string())?;
    store.delete(SERVER_KEY);
    store
        .save()
        .map_err(|e| ServerError::Storage(e.to_string()).to_string())?;
    app.request_restart();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{ServerError, display, parse_server};

    fn origin(input: &str) -> Result<String, ServerError> {
        parse_server(input).map(|url| display(&url))
    }

    #[test]
    fn an_address_becomes_an_https_origin() {
        assert_eq!(
            origin("hims.example.org"),
            Ok("https://hims.example.org".into())
        );
        assert_eq!(
            origin(" https://user:pw@hims.example.org:8443/login?x=1 "),
            Ok("https://hims.example.org:8443".into())
        );
    }

    #[test]
    fn plain_http_is_only_for_this_computer() {
        assert_eq!(
            origin("http://localhost:3000/api"),
            Ok("http://localhost:3000".into())
        );
        assert_eq!(
            origin("http://medbrains.localhost"),
            Ok("http://medbrains.localhost".into())
        );
        assert_eq!(
            origin("http://127.0.0.1:5173"),
            Ok("http://127.0.0.1:5173".into())
        );
        assert_eq!(
            origin("http://hims.example.org"),
            Err(ServerError::Insecure)
        );
        assert_eq!(
            origin("http://localhost.example.org"),
            Err(ServerError::Insecure)
        );
        assert_eq!(origin("ftp://hims.example.org"), Err(ServerError::Invalid));
        assert_eq!(origin(""), Err(ServerError::Invalid));
        assert_eq!(origin("javascript:alert(1)"), Err(ServerError::Invalid));
    }
}
