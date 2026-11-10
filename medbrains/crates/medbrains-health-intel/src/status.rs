//! Watch the watchers: every job and feed reports a heartbeat, and one that
//! has not succeeded for more than two of its intervals is *stopped* — shown
//! as an alert, never as "nothing new" (RFC-OSINT §3a).

use chrono::{DateTime, Utc};
use serde::Serialize;

/// Heartbeat names the server writes; feeds are written by the news ingest
/// as `feed:<url>`.
pub const JOB_CONDITIONS: &str = "job:health_conditions";
pub const JOB_ENVIRONMENT: &str = "job:health_environment";
pub const JOB_TAGGING: &str = "job:news_tagging";
/// Jobs the screen expects to exist; a missing one is reported as never run.
pub const EXPECTED_JOBS: [(&str, &str); 3] = [
    (JOB_CONDITIONS, "Condition counts (hourly)"),
    (JOB_ENVIRONMENT, "Weather and air quality (hourly)"),
    (JOB_TAGGING, "Tagging public notices (hourly)"),
];
/// Intervals a heartbeat may miss before it counts as stopped.
const MISSED_INTERVALS: i64 = 2;

#[derive(Debug, Clone)]
pub struct Heartbeat {
    pub name: String,
    pub kind: String,
    pub label: String,
    pub interval_secs: i32,
    pub last_attempt_at: Option<DateTime<Utc>>,
    pub last_ok_at: Option<DateTime<Utc>>,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CheckStatus {
    pub name: String,
    /// `job` or `feed`.
    pub kind: String,
    pub label: String,
    /// `running`, `failing` (last attempt failed, still within its window),
    /// `stopped` (no success for over two intervals) or `never_run`.
    pub state: &'static str,
    pub last_ok_at: Option<DateTime<Utc>>,
    pub last_attempt_at: Option<DateTime<Utc>>,
    pub last_error: Option<String>,
}

/// The state of one heartbeat at `now`.
pub fn state_of(h: &Heartbeat, now: DateTime<Utc>) -> &'static str {
    let window = i64::from(h.interval_secs) * MISSED_INTERVALS;
    let Some(ok) = h.last_ok_at else {
        return match h.last_attempt_at {
            Some(first) if (now - first).num_seconds() > window => "stopped",
            Some(_) => "failing",
            None => "never_run",
        };
    };
    if (now - ok).num_seconds() > window {
        "stopped"
    } else if h.last_attempt_at.is_some_and(|a| a > ok) {
        "failing"
    } else {
        "running"
    }
}

/// Every expected job (present or not) and every feed, worst first.
pub fn statuses(beats: &[Heartbeat], now: DateTime<Utc>) -> Vec<CheckStatus> {
    let mut out: Vec<CheckStatus> = beats
        .iter()
        .map(|h| CheckStatus {
            name: h.name.clone(),
            kind: h.kind.clone(),
            label: h.label.clone(),
            state: state_of(h, now),
            last_ok_at: h.last_ok_at,
            last_attempt_at: h.last_attempt_at,
            last_error: h.last_error.clone(),
        })
        .collect();
    for (name, label) in EXPECTED_JOBS {
        if !beats.iter().any(|h| h.name == name) {
            out.push(CheckStatus {
                name: name.to_owned(),
                kind: "job".to_owned(),
                label: label.to_owned(),
                state: "never_run",
                last_ok_at: None,
                last_attempt_at: None,
                last_error: None,
            });
        }
    }
    if !beats.iter().any(|h| h.kind == "feed") {
        out.push(CheckStatus {
            name: "feed:*".to_owned(),
            kind: "feed".to_owned(),
            label: "Public notice feeds".to_owned(),
            state: "never_run",
            last_ok_at: None,
            last_attempt_at: None,
            last_error: Some("The news ingest has never reported".to_owned()),
        });
    }
    let rank = |s: &str| match s {
        "stopped" => 0,
        "never_run" => 1,
        "failing" => 2,
        _ => 3,
    };
    out.sort_by(|a, b| {
        rank(a.state)
            .cmp(&rank(b.state))
            .then(a.label.cmp(&b.label))
    });
    out
}

#[cfg(test)]
mod tests {
    use chrono::{Duration, Utc};

    use super::{Heartbeat, state_of, statuses};

    fn feed(ok_mins_ago: Option<i64>, attempt_mins_ago: Option<i64>) -> Heartbeat {
        let now = Utc::now();
        Heartbeat {
            name: "feed:https://www.who.int/x".to_owned(),
            kind: "feed".to_owned(),
            label: "WHO".to_owned(),
            interval_secs: 1800,
            last_attempt_at: attempt_mins_ago.map(|m| now - Duration::minutes(m)),
            last_ok_at: ok_mins_ago.map(|m| now - Duration::minutes(m)),
            last_error: None,
        }
    }

    #[test]
    fn a_feed_silent_for_more_than_two_intervals_is_stopped() {
        assert_eq!(state_of(&feed(Some(61), Some(61)), Utc::now()), "stopped");
        assert_eq!(state_of(&feed(Some(59), Some(59)), Utc::now()), "running");
    }

    #[test]
    fn a_feed_that_keeps_trying_and_failing_is_still_stopped() {
        assert_eq!(state_of(&feed(Some(90), Some(1)), Utc::now()), "stopped");
        assert_eq!(state_of(&feed(Some(20), Some(1)), Utc::now()), "failing");
        assert_eq!(state_of(&feed(None, Some(70)), Utc::now()), "stopped");
    }

    #[test]
    fn missing_jobs_and_feeds_are_reported_as_never_run() {
        let all = statuses(&[], Utc::now());
        assert_eq!(all.len(), 4);
        assert!(all.iter().all(|s| s.state == "never_run"));
    }
}
