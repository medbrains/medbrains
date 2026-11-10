use axum::routing::get;
use axum::{Json, Router};
use serde_json::json;

use super::{ErrorTrackingSummary, crash_free, summarise};
use crate::config::Settings;

type TestResult = Result<(), Box<dyn std::error::Error>>;

fn settings_for(addr: &str, token: Option<&str>) -> Result<Settings, Box<dyn std::error::Error>> {
    let dsn = format!("http://abc123@{addr}/7");
    let pairs = [
        ("SENTRY_DSN", dsn.as_str()),
        ("SENTRY_RELEASE", "4f2a9c1d0b3e"),
        ("SENTRY_ENVIRONMENT", "prod"),
        ("RUSTRAK_API_TOKEN", token.unwrap_or("")),
        ("RUSTRAK_PUBLIC_URL", "https://errors.hospital.example"),
    ];
    let lookup = |key: &str| {
        pairs
            .iter()
            .find(|(k, _)| *k == key)
            .map(|(_, v)| (*v).to_owned())
    };
    Settings::from_lookup(lookup)?.ok_or_else(|| "expected settings".into())
}

/// A stand-in Rustrak answering the three endpoints the summary reads.
async fn fake_rustrak() -> Result<String, Box<dyn std::error::Error>> {
    let app = Router::new()
        .route(
            "/api/projects/7/stats/summary",
            get(|| async {
                Json(json!({"period_hours": 24, "events": {"current": 12, "previous": 3},
                    "new_issues": {"current": 2, "previous": 0}, "open_issues": 5}))
            }),
        )
        .route(
            "/api/projects/7/sessions/stats",
            get(|| async {
                Json(json!({"items": [
                    {"release": "4f2a9c1d0b3e", "environment": "prod", "total": 200, "crashed": 3},
                    {"release": "4f2a9c1d0b3e", "environment": "dev", "total": 10, "crashed": 10}
                ], "total_count": 2, "page": 1, "per_page": 100, "total_pages": 1}))
            }),
        )
        .route(
            "/api/projects/7/issues",
            get(|| async {
                Json(json!({"items": [{"short_id": "MEDBRAINS-4", "title": "TypeError: x is undefined",
                    "level": "error", "event_count": 9, "last_seen": "2026-10-25T07:00:00Z",
                    "culprit": "app"}], "total_count": 1, "page": 1, "per_page": 5, "total_pages": 1}))
            }),
        );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await?;
    let addr = listener.local_addr()?.to_string();
    tokio::spawn(async move { axum::serve(listener, app).await });
    Ok(addr)
}

#[tokio::test]
async fn a_reachable_rustrak_gives_counts_and_this_releases_crash_free_rate() -> TestResult {
    let addr = fake_rustrak().await?;
    let settings = settings_for(&addr, Some("token"))?;
    let ErrorTrackingSummary::Available(snapshot) = summarise(Some(&settings)).await else {
        return Err("expected an available summary".into());
    };
    assert_eq!(snapshot.new_issues_24h, 2);
    assert_eq!(snapshot.open_issues, 5);
    assert_eq!(snapshot.sessions_24h, 200, "only the prod rows count");
    assert_eq!(snapshot.crash_free_rate, Some(0.985));
    assert_eq!(snapshot.recent_issues.len(), 1);
    Ok(())
}

#[tokio::test]
async fn an_unreachable_rustrak_is_unavailable_never_zero_errors() -> TestResult {
    // Bind and drop: the port is now closed.
    let addr = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await?
        .local_addr()?
        .to_string();
    let settings = settings_for(&addr, Some("token"))?;
    let summary = summarise(Some(&settings)).await;
    assert!(
        matches!(summary, ErrorTrackingSummary::Unavailable { .. }),
        "{summary:?}"
    );
    let body = serde_json::to_value(&summary)?;
    assert_eq!(body["status"], "unavailable");
    assert!(
        body.get("new_issues_24h").is_none(),
        "an outage carries no counts"
    );
    Ok(())
}

#[tokio::test]
async fn missing_settings_are_off_and_say_which() -> TestResult {
    assert!(matches!(
        summarise(None).await,
        ErrorTrackingSummary::Off { .. }
    ));
    let settings = settings_for("127.0.0.1:9", None)?;
    let ErrorTrackingSummary::Off { reason } = summarise(Some(&settings)).await else {
        return Err("expected off".into());
    };
    assert!(reason.contains("RUSTRAK_API_TOKEN"));
    Ok(())
}

#[test]
fn a_release_with_no_sessions_has_no_rate_rather_than_a_perfect_one() {
    assert_eq!(crash_free(&[], "prod"), (0, None));
}
