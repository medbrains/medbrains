//! Error tracking is off unless `SENTRY_DSN` names a Rustrak project on this
//! host, or an outside service with `SENTRY_ALLOW_EXTERNAL=1` also set.

use std::str::FromStr;
use std::sync::OnceLock;

use sentry::types::Dsn;
use serde::Deserialize;

use crate::sdk::dsn_host_is_own;

/// The operator's opt-in to an error tracker off this host, such as sentry.io.
pub const ALLOW_EXTERNAL: &str = "SENTRY_ALLOW_EXTERNAL";

/// Error events are all kept; traces are sampled.
const DEFAULT_TRACES_SAMPLE_RATE: f32 = 0.05;

/// An app whose reports come through this server's tunnel.
///
/// Each may have a project of its own, `SENTRY_<APP>_DSN`; without one it
/// reports to the server's `SENTRY_DSN` (one Rustrak project serves a hospital install).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ClientApp {
    #[default]
    Web,
    Android,
    Ios,
    Desktop,
}

impl ClientApp {
    const ALL: [Self; 4] = [Self::Web, Self::Android, Self::Ios, Self::Desktop];

    /// The variable naming this app's own project.
    #[must_use]
    pub const fn dsn_key(self) -> &'static str {
        match self {
            Self::Web => "SENTRY_WEB_DSN",
            Self::Android => "SENTRY_ANDROID_DSN",
            Self::Ios => "SENTRY_IOS_DSN",
            Self::Desktop => "SENTRY_DESKTOP_DSN",
        }
    }

    /// The app's name in a tunnel path and a config request.
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Web => "web",
            Self::Android => "android",
            Self::Ios => "ios",
            Self::Desktop => "desktop",
        }
    }
}

/// What this server reports, and where.
#[derive(Debug, Clone)]
pub struct Settings {
    pub dsn: Dsn,
    /// Each [`ClientApp`]'s own project, in [`ClientApp::ALL`] order; `None`
    /// for an app that reports to `dsn`.
    pub app_dsns: [Option<Dsn>; 4],
    /// `prod`, `staging` or `dev`.
    pub environment: String,
    /// The commit the deploy built, the same string the web bundle carries.
    pub release: String,
    pub traces_sample_rate: f32,
    /// Rustrak API token for the admin summary. Without it the summary says so.
    pub api_token: Option<String>,
    /// Where an administrator opens Rustrak, e.g. `https://errors.<domain>`.
    pub public_url: Option<String>,
}

/// The commit `make ship-cold` builds, baked in at compile time; the crate
/// version when built by hand.
const BUILD_RELEASE: &str = match option_env!("MEDBRAINS_RELEASE") {
    Some(release) => release,
    None => env!("CARGO_PKG_VERSION"),
};

impl Settings {
    /// `Ok(None)` when `SENTRY_DSN` is unset or empty; an error (so off, and
    /// said) for a DSN that does not parse, or one off this host without
    /// `SENTRY_ALLOW_EXTERNAL=1`, so a hospital never reports outside by accident.
    pub fn from_env() -> Result<Option<Self>, String> {
        Self::from_lookup(|key| std::env::var(key).ok())
    }

    pub(crate) fn from_lookup(
        get: impl Fn(&str) -> Option<String>,
    ) -> Result<Option<Self>, String> {
        let value = |key: &str| {
            get(key)
                .map(|v| v.trim().to_owned())
                .filter(|v| !v.is_empty())
        };
        let Some(raw) = value("SENTRY_DSN") else {
            return Ok(None);
        };
        let own_domain = value("COOKIE_DOMAIN");
        let allow_external = value(ALLOW_EXTERNAL).as_deref() == Some("1");
        let parse =
            |key: &str, raw: &str| parse_dsn(key, raw, own_domain.as_deref(), allow_external);
        let dsn = parse("SENTRY_DSN", &raw)?;
        let mut app_dsns: [Option<Dsn>; 4] = Default::default();
        for (slot, app) in app_dsns.iter_mut().zip(ClientApp::ALL) {
            if let Some(raw) = value(app.dsn_key()) {
                *slot = Some(parse(app.dsn_key(), &raw)?);
            }
        }
        let rate = value("SENTRY_TRACES_SAMPLE_RATE")
            .and_then(|r| r.parse::<f32>().ok())
            .filter(|r| (0.0..=1.0).contains(r))
            .unwrap_or(DEFAULT_TRACES_SAMPLE_RATE);
        Ok(Some(Self {
            dsn,
            app_dsns,
            environment: value("SENTRY_ENVIRONMENT")
                .unwrap_or_else(|| environment_for(value("MEDBRAINS_ENV").as_deref()).to_owned()),
            release: value("SENTRY_RELEASE").unwrap_or_else(|| BUILD_RELEASE.to_owned()),
            traces_sample_rate: rate,
            api_token: value("RUSTRAK_API_TOKEN"),
            public_url: value("RUSTRAK_PUBLIC_URL"),
        }))
    }

    /// The project `app`'s reports are forwarded to.
    #[must_use]
    pub fn client_dsn(&self, app: ClientApp) -> &Dsn {
        ClientApp::ALL
            .iter()
            .position(|a| *a == app)
            .and_then(|i| self.app_dsns.get(i))
            .and_then(Option::as_ref)
            .unwrap_or(&self.dsn)
    }

    /// Rustrak's REST API base, from the DSN: same scheme, host and port.
    #[must_use]
    pub fn api_base(&self) -> String {
        format!(
            "{}://{}:{}",
            self.dsn.scheme(),
            self.dsn.host(),
            self.dsn.port()
        )
    }
}

/// A DSN that parses and stays on this host, or is opted out of it. An error
/// otherwise, which turns all error tracking off and says why.
fn parse_dsn(
    key: &str,
    raw: &str,
    own_domain: Option<&str>,
    allow_external: bool,
) -> Result<Dsn, String> {
    let dsn = Dsn::from_str(raw).map_err(|e| format!("{key} does not parse: {e}"))?;
    if !allow_external && !dsn_host_is_own(dsn.host(), own_domain) {
        return Err(format!(
            "{key} points at {}, outside this server; \
             set {ALLOW_EXTERNAL}=1 to send error reports there",
            dsn.host()
        ));
    }
    Ok(dsn)
}

/// `MEDBRAINS_ENV` in the three names release health groups by.
fn environment_for(medbrains_env: Option<&str>) -> &'static str {
    match medbrains_env {
        Some("production" | "prod") => "prod",
        Some("staging") => "staging",
        _ => "dev",
    }
}

static SETTINGS: OnceLock<Option<Settings>> = OnceLock::new();

/// This process's settings, read once at startup by [`crate::init`].
pub fn settings() -> Option<&'static Settings> {
    SETTINGS.get().and_then(Option::as_ref)
}

pub(crate) fn remember(settings: Option<Settings>) {
    let _ = SETTINGS.set(settings);
}

#[cfg(test)]
mod tests {
    use super::{ClientApp, Settings};

    fn lookup(pairs: &[(&str, &str)]) -> impl Fn(&str) -> Option<String> {
        let owned: Vec<(String, String)> = pairs
            .iter()
            .map(|(k, v)| ((*k).to_owned(), (*v).to_owned()))
            .collect();
        move |key| owned.iter().find(|(k, _)| k == key).map(|(_, v)| v.clone())
    }

    #[test]
    fn no_dsn_means_off() -> Result<(), String> {
        assert!(Settings::from_lookup(lookup(&[])).map(|s| s.is_none())?);
        assert!(Settings::from_lookup(lookup(&[("SENTRY_DSN", "  ")])).map(|s| s.is_none())?);
        Ok(())
    }

    #[test]
    fn a_bad_dsn_is_an_error_not_silence() {
        assert!(Settings::from_lookup(lookup(&[("SENTRY_DSN", "not a dsn")])).is_err());
    }

    #[test]
    fn production_reports_as_prod_and_samples_traces_conservatively() -> Result<(), String> {
        let settings = Settings::from_lookup(lookup(&[
            ("SENTRY_DSN", "http://abc123@127.0.0.1:8180/1"),
            ("MEDBRAINS_ENV", "production"),
            ("SENTRY_TRACES_SAMPLE_RATE", "7"),
        ]))?
        .ok_or("expected settings")?;
        assert_eq!(settings.environment, "prod");
        assert!((settings.traces_sample_rate - 0.05).abs() < f32::EPSILON);
        assert_eq!(settings.api_base(), "http://127.0.0.1:8180");
        Ok(())
    }

    const EXTERNAL: &str = "https://k@o1.ingest.sentry.io/1";

    #[test]
    fn an_external_dsn_without_the_flag_is_off() {
        assert!(Settings::from_lookup(lookup(&[("SENTRY_DSN", EXTERNAL)])).is_err());
        let wrong_flag = lookup(&[("SENTRY_DSN", EXTERNAL), ("SENTRY_ALLOW_EXTERNAL", "yes")]);
        assert!(Settings::from_lookup(wrong_flag).is_err());
    }

    #[test]
    fn an_external_dsn_with_the_flag_is_on() -> Result<(), String> {
        let on = lookup(&[("SENTRY_DSN", EXTERNAL), ("SENTRY_ALLOW_EXTERNAL", "1")]);
        assert!(Settings::from_lookup(on)?.is_some());
        Ok(())
    }

    #[test]
    fn loopback_and_own_domain_dsns_need_no_flag() -> Result<(), String> {
        let loopback = lookup(&[("SENTRY_DSN", "http://k@127.0.0.1:8180/1")]);
        assert!(Settings::from_lookup(loopback)?.is_some());
        let same_host = lookup(&[
            ("SENTRY_DSN", "https://k@errors.hims.example.in/1"),
            ("COOKIE_DOMAIN", "hims.example.in"),
        ]);
        assert!(Settings::from_lookup(same_host)?.is_some());
        Ok(())
    }

    const WEB: &str = "https://w@o1.ingest.sentry.io/2";

    #[test]
    fn the_web_gets_its_own_project_and_other_apps_the_servers() -> Result<(), String> {
        let settings = Settings::from_lookup(lookup(&[
            ("SENTRY_DSN", EXTERNAL),
            ("SENTRY_WEB_DSN", WEB),
            ("SENTRY_ALLOW_EXTERNAL", "1"),
        ]))?
        .ok_or("expected settings")?;
        assert_eq!(
            settings.client_dsn(ClientApp::Web).project_id().value(),
            "2"
        );
        assert_eq!(
            settings.client_dsn(ClientApp::Android).project_id().value(),
            "1"
        );
        assert_eq!(settings.dsn.public_key(), "k");
        Ok(())
    }

    #[test]
    fn without_a_web_dsn_the_web_reports_to_the_servers() -> Result<(), String> {
        let settings =
            Settings::from_lookup(lookup(&[("SENTRY_DSN", "http://k@127.0.0.1:8180/1")]))?
                .ok_or("expected settings")?;
        assert_eq!(settings.client_dsn(ClientApp::Web), &settings.dsn);
        Ok(())
    }

    #[test]
    fn an_external_web_dsn_needs_the_same_opt_in() {
        let refused = lookup(&[
            ("SENTRY_DSN", "http://k@127.0.0.1:8180/1"),
            ("SENTRY_WEB_DSN", WEB),
        ]);
        assert!(Settings::from_lookup(refused).is_err());
    }

    #[test]
    fn a_web_dsn_alone_does_not_turn_tracking_on() -> Result<(), String> {
        assert!(Settings::from_lookup(lookup(&[("SENTRY_WEB_DSN", WEB)]))?.is_none());
        Ok(())
    }
}
