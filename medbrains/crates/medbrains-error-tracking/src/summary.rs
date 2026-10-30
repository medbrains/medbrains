//! The admin screen's summary, read server-side from Rustrak's REST API.
//!
//! Three answers, never two: `off` (not configured), `available` (Rustrak
//! answered), `unavailable` (it did not). A Rustrak outage must never read
//! as "no errors".

use std::time::Duration;

use serde::{Deserialize, Serialize};

use crate::config::Settings;
use crate::http_client;

const RUSTRAK_TIMEOUT: Duration = Duration::from_secs(4);
const RECENT_ISSUES: u8 = 5;

#[derive(Debug, Serialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum ErrorTrackingSummary {
    /// `SENTRY_DSN` or `RUSTRAK_API_TOKEN` is not set.
    Off {
        reason: String,
    },
    /// Rustrak did not answer, or answered something we could not read.
    Unavailable {
        reason: String,
        dashboard_url: Option<String>,
    },
    Available(Snapshot),
}

#[derive(Debug, Serialize)]
pub struct Snapshot {
    pub release: String,
    pub environment: String,
    pub new_issues_24h: i64,
    pub events_24h: i64,
    pub open_issues: i64,
    /// Sessions on this release in the last 24 hours.
    pub sessions_24h: i64,
    /// 0–1; `None` while the release has no sessions yet.
    pub crash_free_rate: Option<f64>,
    pub recent_issues: Vec<RecentIssue>,
    pub dashboard_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RecentIssue {
    pub short_id: String,
    pub title: String,
    pub level: Option<String>,
    pub event_count: i64,
    pub last_seen: String,
}

#[derive(Deserialize)]
struct Counter {
    current: i64,
}

#[derive(Deserialize)]
struct StatsSummary {
    events: Counter,
    new_issues: Counter,
    open_issues: i64,
}

#[derive(Deserialize)]
struct Page<T> {
    items: Vec<T>,
}

#[derive(Deserialize)]
struct ReleaseHealth {
    environment: String,
    total: i64,
    crashed: i64,
}

/// What the admin screen shows, for the settings this process booted with.
pub(crate) async fn summarise(settings: Option<&Settings>) -> ErrorTrackingSummary {
    let Some(settings) = settings else {
        return ErrorTrackingSummary::Off {
            reason: "SENTRY_DSN is not set".to_owned(),
        };
    };
    let Some(token) = settings.api_token.as_deref() else {
        return ErrorTrackingSummary::Off {
            reason: "RUSTRAK_API_TOKEN is not set".to_owned(),
        };
    };
    match fetch_snapshot(settings, token).await {
        Ok(snapshot) => ErrorTrackingSummary::Available(snapshot),
        Err(reason) => {
            tracing::warn!(%reason, "error tracker unavailable for the admin summary");
            ErrorTrackingSummary::Unavailable {
                reason,
                dashboard_url: settings.public_url.clone(),
            }
        }
    }
}

async fn fetch_snapshot(settings: &Settings, token: &str) -> Result<Snapshot, String> {
    let project = settings.dsn.project_id().to_string();
    let base = format!("{}/api/projects/{project}", settings.api_base());
    let release = settings.release.as_str();
    let environment = settings.environment.as_str();
    let per_page = RECENT_ISSUES.to_string();
    let (stats_url, health_url, issues_url) = (
        format!("{base}/stats/summary"),
        format!("{base}/sessions/stats"),
        format!("{base}/issues"),
    );
    let health_query = [("release", release), ("period", "24"), ("per_page", "100")];
    let issues_query = [
        ("filter", "open"),
        ("sort", "last_seen"),
        ("per_page", per_page.as_str()),
    ];
    let stats = get::<StatsSummary>(&stats_url, token, &[("period", "24h")]);
    let health = get::<Page<ReleaseHealth>>(&health_url, token, &health_query);
    let issues = get::<Page<RecentIssue>>(&issues_url, token, &issues_query);
    let (stats, health, issues) = tokio::try_join!(stats, health, issues)?;
    let (sessions, crash_free_rate) = crash_free(&health.items, environment);
    Ok(Snapshot {
        release: release.to_owned(),
        environment: environment.to_owned(),
        new_issues_24h: stats.new_issues.current,
        events_24h: stats.events.current,
        open_issues: stats.open_issues,
        sessions_24h: sessions,
        crash_free_rate,
        recent_issues: issues.items,
        dashboard_url: settings.public_url.clone(),
    })
}

/// Sessions and crash-free share for this environment's rows of the release.
fn crash_free(rows: &[ReleaseHealth], environment: &str) -> (i64, Option<f64>) {
    let (total, crashed) = rows
        .iter()
        .filter(|row| row.environment == environment)
        .fold((0i64, 0i64), |(t, c), row| (t + row.total, c + row.crashed));
    #[expect(
        clippy::cast_precision_loss,
        reason = "session counts are far below 2^52"
    )]
    let rate = (total > 0).then(|| 1.0 - crashed as f64 / total as f64);
    (total, rate)
}

async fn get<T: for<'de> Deserialize<'de>>(
    url: &str,
    token: &str,
    query: &[(&str, &str)],
) -> Result<T, String> {
    let response = http_client()?
        .get(url)
        .timeout(RUSTRAK_TIMEOUT)
        .bearer_auth(token)
        .query(query)
        .send()
        .await
        .map_err(|e| format!("Rustrak did not answer: {}", e.without_url()))?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("Rustrak answered {status}"));
    }
    response
        .json::<T>()
        .await
        .map_err(|_| "Rustrak's answer could not be read".to_owned())
}

#[cfg(test)]
#[path = "summary_tests.rs"]
mod tests;
