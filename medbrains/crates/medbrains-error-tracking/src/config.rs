//! Error tracking is off unless `SENTRY_DSN` names a Rustrak project.

use std::str::FromStr;
use std::sync::OnceLock;

use sentry::types::Dsn;

/// Error events are all kept; traces are sampled.
const DEFAULT_TRACES_SAMPLE_RATE: f32 = 0.05;

/// What this server reports, and where.
#[derive(Debug, Clone)]
pub struct Settings {
    pub dsn: Dsn,
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
    /// `Ok(None)` when `SENTRY_DSN` is unset or empty; an error for a DSN that
    /// does not parse, so a typo is reported rather than silently off.
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
        let dsn = Dsn::from_str(&raw).map_err(|e| format!("SENTRY_DSN does not parse: {e}"))?;
        let rate = value("SENTRY_TRACES_SAMPLE_RATE")
            .and_then(|r| r.parse::<f32>().ok())
            .filter(|r| (0.0..=1.0).contains(r))
            .unwrap_or(DEFAULT_TRACES_SAMPLE_RATE);
        Ok(Some(Self {
            dsn,
            environment: value("SENTRY_ENVIRONMENT")
                .unwrap_or_else(|| environment_for(value("MEDBRAINS_ENV").as_deref()).to_owned()),
            release: value("SENTRY_RELEASE").unwrap_or_else(|| BUILD_RELEASE.to_owned()),
            traces_sample_rate: rate,
            api_token: value("RUSTRAK_API_TOKEN"),
            public_url: value("RUSTRAK_PUBLIC_URL"),
        }))
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
    use super::Settings;

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
}
