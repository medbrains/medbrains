//! Crash reports from the desktop shell's own Rust code, through the hospital
//! server's tunnel.
//!
//! Off unless the chosen server says error tracking is on. The SDK never sends
//! to the error tracker itself: it is given a DSN on the hospital server, whose
//! tunnel runs every report through the server's patient-data scrubber and
//! forwards it to the desktop project. The pages in the window are the server's
//! web app and report through its own module (`apps/web/src/lib/error-tracking.ts`).

use std::sync::{Arc, OnceLock};
use std::time::Duration;

use sentry::protocol::Event;
use sentry::{ClientInitGuard, ClientOptions};
use serde::Deserialize;
use url::Url;

/// Which project the server forwards this app's reports to.
const CONFIG_PATH: &str = "/api/public/error-tracking/config?app=desktop";
const CONFIG_TIMEOUT: Duration = Duration::from_secs(5);
/// The user name in the tunnel DSN; the server ignores the envelope's auth.
const TUNNEL_KEY: &str = "medbrains";

/// The fields of the server's answer this shell reads.
#[derive(Debug, Deserialize)]
struct ClientConfig {
    enabled: bool,
    dsn: Option<String>,
    environment: Option<String>,
    tunnel_dsn_path: Option<String>,
}

/// Kept for the life of the process, so the SDK is never stopped early.
static GUARD: OnceLock<ClientInitGuard> = OnceLock::new();

/// Ask `origin` whether to report and, if so, start the SDK. Any failure
/// leaves error tracking off: a crash report is never worth a failed launch.
pub(crate) async fn start(origin: Url) {
    let Some(config) = fetch_config(&origin).await else {
        return;
    };
    let Some(options) =
        tunnel_dsn(&origin, &config).and_then(|dsn| options(&dsn, config.environment))
    else {
        return;
    };
    if GUARD.set(sentry::init(options)).is_ok() {
        tracing::info!("error tracking on");
    }
}

/// The server's config, or `None` when it cannot be read.
async fn fetch_config(origin: &Url) -> Option<ClientConfig> {
    let url = origin.join(CONFIG_PATH).ok()?;
    let client = reqwest::Client::builder()
        .timeout(CONFIG_TIMEOUT)
        .build()
        .ok()?;
    let response = client.get(url).send().await.ok()?;
    response.error_for_status().ok()?.json().await.ok()
}

/// The DSN on the hospital server, or `None` while error tracking is off.
fn tunnel_dsn(origin: &Url, config: &ClientConfig) -> Option<String> {
    if !config.enabled || config.dsn.is_none() {
        return None;
    }
    // Set as a path on the chosen origin, never joined: `join` would follow a
    // `//other-host/…` answer off the hospital server.
    let path = config.tunnel_dsn_path.as_deref()?;
    if !path.starts_with('/') {
        return None;
    }
    let mut dsn = origin.clone();
    dsn.set_path(path);
    dsn.set_username(TUNNEL_KEY).ok()?;
    Some(dsn.to_string())
}

/// Every error, no default PII, no sessions or traces, and [`scrub`] on
/// each event before it leaves.
fn options(dsn: &str, environment: Option<String>) -> Option<ClientOptions> {
    let mut options = ClientOptions::default();
    options.dsn = Some(dsn.parse().ok()?);
    options.release = Some(env!("CARGO_PKG_VERSION").into());
    options.environment = environment.map(Into::into);
    options.send_default_pii = false;
    options.auto_session_tracking = false;
    options.server_name = None;
    options.before_send = Some(Arc::new(scrub));
    Some(options)
}

/// What leaves this computer: the failure's type, message, stack, level,
/// release and machine kind. Who used it, the machine's name, request details,
/// extras, tags and breadcrumbs stay. The server then scrubs the text.
#[allow(
    clippy::unnecessary_wraps,
    reason = "before_send returns an Option; None would drop the event"
)]
fn scrub(mut event: Event<'static>) -> Option<Event<'static>> {
    event.user = None;
    event.request = None;
    event.server_name = None;
    event.extra.clear();
    event.tags.clear();
    event.modules.clear();
    event.breadcrumbs.values.clear();
    Some(event)
}

#[cfg(test)]
mod tests {
    use sentry::protocol::{Breadcrumb, Event, Exception, Request, User, Value};

    use super::{ClientConfig, options, scrub, tunnel_dsn};

    const NAME: &str = "Ramesh Kumar Iyer";
    const UHID: &str = "MB-2026-000123";
    const PHONE: &str = "9876543210";

    fn config(enabled: bool, dsn: Option<&str>, path: Option<&str>) -> ClientConfig {
        ClientConfig {
            enabled,
            dsn: dsn.map(str::to_owned),
            environment: Some("prod".to_owned()),
            tunnel_dsn_path: path.map(str::to_owned),
        }
    }

    fn origin() -> Result<url::Url, url::ParseError> {
        url::Url::parse("https://hims.example.in")
    }

    #[test]
    fn off_unless_the_server_says_on_and_gives_a_dsn() -> Result<(), url::ParseError> {
        let path = Some("/api/public/error-tracking/desktop/1");
        let dsn = Some("https://k@o1.ingest.sentry.io/5");
        assert!(tunnel_dsn(&origin()?, &config(false, dsn, path)).is_none());
        assert!(tunnel_dsn(&origin()?, &config(true, None, path)).is_none());
        assert!(tunnel_dsn(&origin()?, &config(true, dsn, None)).is_none());
        Ok(())
    }

    #[test]
    fn the_sdk_reports_to_the_hospital_server_never_the_tracker() -> Result<(), String> {
        let on = config(
            true,
            Some("https://k@o1.ingest.sentry.io/5"),
            Some("/api/public/error-tracking/desktop/1"),
        );
        let dsn = tunnel_dsn(&origin().map_err(|e| e.to_string())?, &on).ok_or("expected a DSN")?;
        assert_eq!(
            dsn,
            "https://medbrains@hims.example.in/api/public/error-tracking/desktop/1"
        );
        let options = options(&dsn, None).ok_or("DSN must parse")?;
        assert!(!options.send_default_pii);
        assert_eq!(
            options.dsn.ok_or("no DSN")?.envelope_api_url().as_str(),
            "https://hims.example.in/api/public/error-tracking/desktop/api/1/envelope/"
        );
        Ok(())
    }

    #[test]
    fn a_path_naming_another_host_stays_on_the_hospital_server() -> Result<(), url::ParseError> {
        let dsn = Some("https://k@o1.ingest.sentry.io/5");
        let hostile = config(true, dsn, Some("//evil.example/api/1"));
        let built = tunnel_dsn(&origin()?, &hostile).unwrap_or_default();
        assert_eq!(url::Url::parse(&built)?.host_str(), Some("hims.example.in"));
        assert!(
            tunnel_dsn(
                &origin()?,
                &config(true, dsn, Some("https://evil.example/1"))
            )
            .is_none()
        );
        Ok(())
    }

    #[test]
    fn a_report_leaves_without_the_patient_or_the_person() -> Result<(), serde_json::Error> {
        let mut event = Event {
            server_name: Some(format!("{NAME}-PC").into()),
            user: Some(User {
                username: Some(NAME.to_owned()),
                ..User::default()
            }),
            request: Some(Request {
                url: url::Url::parse(&format!("https://h.example/patients/{UHID}?phone={PHONE}"))
                    .ok(),
                ..Request::default()
            }),
            ..Event::default()
        };
        event.exception.values.push(Exception {
            ty: "PrintFailed".to_owned(),
            ..Exception::default()
        });
        event.extra.insert("phone".to_owned(), Value::from(PHONE));
        event.tags.insert("patient".to_owned(), NAME.to_owned());
        event.breadcrumbs.values.push(Breadcrumb {
            message: Some(format!("opened {UHID}")),
            ..Breadcrumb::default()
        });

        let sent = serde_json::to_string(&scrub(event))?;
        assert!(sent.contains("PrintFailed"), "the failure itself is kept");
        for needle in ["Ramesh", "Iyer", UHID, "000123", PHONE] {
            assert!(!sent.contains(needle), "`{needle}` leaked into {sent}");
        }
        Ok(())
    }
}
