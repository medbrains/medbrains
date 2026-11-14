//! Startup check for where error reports go. They are scrubbed of patient data
//! before they leave, and on a hospital install they belong on its own server.

use medbrains_error_tracking::{ALLOW_EXTERNAL, Settings, dsn_host_is_own};
use medbrains_infra_settings::preflight::Finding;

const CHECK: &str = "error_tracking.dsn_host";
const FIX: &str = "Point SENTRY_DSN at the Rustrak on this host (install-rustrak.sh writes it), \
     or unset it; only the project's own servers set SENTRY_ALLOW_EXTERNAL=1";

/// Off, on our own host, or — opted in with `SENTRY_ALLOW_EXTERNAL=1` and
/// warned in production — an outside service.
#[must_use]
pub fn checks(production: bool) -> Vec<Finding> {
    let own_domain = std::env::var("COOKIE_DOMAIN").ok();
    vec![dsn_check(
        Settings::from_env(),
        own_domain.as_deref(),
        production,
    )]
}

fn dsn_check(
    settings: Result<Option<Settings>, String>,
    own_domain: Option<&str>,
    production: bool,
) -> Finding {
    match settings {
        Err(why) => Finding::warn(CHECK, format!("error tracking is off: {why}"), FIX),
        Ok(None) => Finding::ok(CHECK, "error tracking is off (SENTRY_DSN not set)"),
        Ok(Some(s)) if dsn_host_is_own(s.dsn.host(), own_domain) => Finding::ok(
            CHECK,
            format!("error reports go to {} on this host", s.dsn.host()),
        ),
        Ok(Some(s)) => {
            let detail = format!(
                "error reports go to an outside service, {}, not this server ({ALLOW_EXTERNAL}=1)",
                s.dsn.host()
            );
            if production {
                Finding::warn(CHECK, detail, FIX)
            } else {
                Finding::ok(CHECK, detail)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::dsn_check;
    use medbrains_error_tracking::Settings;
    use medbrains_infra_settings::preflight::Level;
    use std::str::FromStr;

    fn settings(dsn: &str) -> Result<Option<Settings>, String> {
        Ok(Some(Settings {
            dsn: sentry_dsn(dsn)?,
            environment: "prod".to_owned(),
            release: "test".to_owned(),
            traces_sample_rate: 0.05,
            api_token: None,
            public_url: None,
            app_dsns: Default::default(),
        }))
    }

    fn sentry_dsn(dsn: &str) -> Result<medbrains_error_tracking::Dsn, String> {
        medbrains_error_tracking::Dsn::from_str(dsn).map_err(|e| e.to_string())
    }

    #[test]
    fn a_dsn_off_our_host_warns_in_production_only() {
        let away = || settings("https://k@o1.ingest.sentry.io/1");
        assert_eq!(
            dsn_check(away(), Some("hims.example.in"), true).level,
            Level::Warn
        );
        assert_eq!(
            dsn_check(away(), Some("hims.example.in"), false).level,
            Level::Ok
        );
        let home = settings("http://k@127.0.0.1:8180/1");
        assert_eq!(
            dsn_check(home, Some("hims.example.in"), true).level,
            Level::Ok
        );
        assert_eq!(dsn_check(Ok(None), None, true).level, Level::Ok);
    }

    #[test]
    fn a_refused_external_dsn_warns_that_tracking_is_off() {
        let finding = dsn_check(Err("outside".to_owned()), None, false);
        assert_eq!(finding.level, Level::Warn);
        assert!(finding.detail.contains("off"));
    }
}
