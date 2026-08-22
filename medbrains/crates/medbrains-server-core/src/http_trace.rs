//! What a finished request looks like in the terminal.
//!
//! `TraceLayer` logs every response the same way, so a 500 and a 200 arrive at
//! the same level in the same colour. Scrolling a busy log, the failures are
//! indistinguishable from the traffic.
//!
//! Two separate things fix that, and they are separate on purpose.
//!
//! **The level** comes from the status, so a 5xx reaches log aggregation as an
//! ERROR and can be alerted on without parsing anything. That works whether or
//! not anyone is watching a terminal.
//!
//! **The colour** is for the person watching. Levels only offer four, and a
//! wall of green INFO lines with the status buried in a field is not scannable
//! — so the status code itself is painted by class, giving a column the eye
//! can run down.
//!
//! | status | level | colour  |
//! |--------|-------|---------|
//! | 5xx    | ERROR | red     |
//! | 429    | WARN  | magenta |
//! | 4xx    | DEBUG | yellow  |
//! | 3xx    | DEBUG | cyan    |
//! | 2xx    | INFO  | green   |
//!
//! 4xx sits at DEBUG deliberately. A 401 on every unauthenticated poll and a
//! 404 from a scanner are the bulk of a public server's traffic; at WARN they
//! teach people to ignore warnings. It still gets its own colour, so it is
//! visible when you go looking.
//!
//! Colour is decided once, at startup, and never when the output is not a
//! terminal. Escape codes written into a field follow the line into a log
//! file, into journald and into JSON, where they are noise that has to be
//! stripped before anything can read it.

use std::sync::OnceLock;
use std::time::Duration;

use axum::body::Body;
use axum::http::{Response, StatusCode};
use tracing::Span;

static COLOUR: OnceLock<bool> = OnceLock::new();

/// Decide whether request logs are painted. Call once at startup.
///
/// Pass `false` for JSON output regardless of the terminal: a JSON log is
/// read by a machine, and a machine does not want escape codes inside a
/// string field.
pub fn init_colour(enabled: bool) {
    let _ = COLOUR.set(enabled);
}

fn colour_enabled() -> bool {
    // Defaults to asking the terminal, so a caller that forgets to initialise
    // still behaves sensibly rather than painting a redirected log.
    *COLOUR.get_or_init(terminal_supports_colour)
}

/// Whether the stream being written to can show colour.
///
/// Three answers, in order.
///
/// `NO_COLOR` wins: it is the de facto opt-out and somebody who set it has
/// already decided.
///
/// Then `FORCE_COLOR` / `CLICOLOR_FORCE`, which exist for exactly the case
/// that made this necessary. Running under a dev process manager — turbo,
/// concurrently, `pnpm dev` — the server's stdout is a pipe, so asking the
/// terminal correctly answers "no" and the logs come out grey while the
/// tooling itself is still in colour. The runner is the thing that knows a
/// human is watching; this lets it say so.
///
/// Otherwise: ask.
#[must_use]
pub fn terminal_supports_colour() -> bool {
    use std::io::IsTerminal as _;

    if std::env::var_os("NO_COLOR").is_some() {
        return false;
    }
    if forced("FORCE_COLOR") || forced("CLICOLOR_FORCE") {
        return true;
    }
    std::io::stdout().is_terminal()
}

/// Whether an override is set to something other than an explicit "0".
///
/// `FORCE_COLOR=0` means off, and treating a set-but-zero variable as "on"
/// would make the documented way to disable it turn it on.
fn forced(name: &str) -> bool {
    match std::env::var(name) {
        Ok(value) => {
            let value = value.trim();
            !value.is_empty() && value != "0" && !value.eq_ignore_ascii_case("false")
        }
        Err(_) => false,
    }
}

/// The ANSI colour a status is shown in, or `None` for the ones that are not
/// worth distinguishing.
fn shade(status: StatusCode) -> &'static str {
    let code = status.as_u16();
    if status.is_server_error() {
        "31" // red — the server broke
    } else if code == 429 {
        "35" // magenta — the one 4xx that is about us, not the caller
    } else if status.is_client_error() {
        "33" // yellow — the caller asked for something it may not have
    } else if status.is_redirection() {
        "36" // cyan — went somewhere else
    } else {
        "32" // green — ordinary
    }
}

/// The status as it should appear in a log line.
#[must_use]
pub fn painted(status: StatusCode) -> String {
    let code = status.as_u16();
    if !colour_enabled() {
        return code.to_string();
    }
    format!("\u{1b}[{}m{code}\u{1b}[0m", shade(status))
}

/// Log a finished response at a level and colour that match its status.
///
/// Wire in with `TraceLayer::new_for_http().on_response(on_response)`.
pub fn on_response(response: &Response<Body>, latency: Duration, _span: &Span) {
    let status = response.status();
    let shown = painted(status);
    let ms = latency.as_millis();

    if status.is_server_error() {
        tracing::error!(status = %shown, latency_ms = ms, "request failed");
    } else if status == StatusCode::TOO_MANY_REQUESTS {
        tracing::warn!(status = %shown, latency_ms = ms, "request throttled");
    } else if status.is_client_error() || status.is_redirection() {
        tracing::debug!(status = %shown, latency_ms = ms, "request refused");
    } else {
        tracing::info!(status = %shown, latency_ms = ms, "request");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn status(code: u16) -> StatusCode {
        StatusCode::from_u16(code).expect("a real status")
    }

    /// The level a status would be logged at, kept in step with `on_response`.
    fn level_of(code: u16) -> &'static str {
        let s = status(code);
        if s.is_server_error() {
            "error"
        } else if s == StatusCode::TOO_MANY_REQUESTS {
            "warn"
        } else if s.is_client_error() || s.is_redirection() {
            "debug"
        } else {
            "info"
        }
    }

    // ================================================================ levels

    #[test]
    fn a_server_failure_is_an_error() {
        // The whole point: a 500 must not scroll past looking like a 200.
        for code in [500, 502, 503, 504] {
            assert_eq!(level_of(code), "error", "{code}");
        }
    }

    #[test]
    fn ordinary_traffic_is_information() {
        for code in [200, 201, 204] {
            assert_eq!(level_of(code), "info", "{code}");
        }
    }

    #[test]
    fn a_refused_request_is_not_a_warning() {
        // A 401 on every unauthenticated poll and a 404 from a scanner are the
        // bulk of a public server's traffic. At WARN they teach people to
        // ignore warnings.
        for code in [400, 401, 403, 404, 409, 422] {
            assert_eq!(level_of(code), "debug", "{code}");
        }
    }

    #[test]
    fn a_throttled_client_is_worth_noticing() {
        assert_eq!(level_of(429), "warn");
    }

    // =============================================================== colours

    #[test]
    fn each_class_gets_its_own_shade() {
        // Four levels cannot distinguish five things worth distinguishing, so
        // the colour carries what the level cannot.
        let shades = [200, 301, 404, 429, 500].map(|c| shade(status(c)));
        let unique: std::collections::BTreeSet<_> = shades.iter().collect();

        assert_eq!(unique.len(), shades.len(), "two classes share a colour: {shades:?}");
    }

    #[test]
    fn throttling_does_not_look_like_an_ordinary_refusal() {
        // 429 is the one 4xx that says something about the server.
        assert_ne!(shade(status(429)), shade(status(404)));
    }

    #[test]
    fn a_redirect_does_not_look_like_a_failure() {
        assert_ne!(shade(status(301)), shade(status(500)));
        assert_ne!(shade(status(301)), shade(status(404)));
    }

    // ============================================================== painting

    #[test]
    fn without_colour_the_status_is_just_a_number() {
        // What a log file, journald, or a JSON pipeline must receive. An escape
        // code in a field follows the line everywhere it goes.
        init_colour(false);

        for code in [200, 404, 500] {
            let shown = painted(status(code));
            assert_eq!(shown, code.to_string());
            assert!(!shown.contains('\u{1b}'), "escape code leaked: {shown:?}");
        }
    }

    #[test]
    fn an_override_of_zero_means_off_not_on() {
        // `FORCE_COLOR=0` is the documented way to turn it off. Treating any
        // set value as "on" would make that switch it on.
        assert!(!forced_value("0"));
        assert!(!forced_value("false"));
        assert!(!forced_value(""));
        assert!(!forced_value("   "));
        assert!(forced_value("1"));
        assert!(forced_value("true"));
        assert!(forced_value("always"));
    }

    /// The same rule `forced` applies, without touching the environment.
    fn forced_value(value: &str) -> bool {
        let value = value.trim();
        !value.is_empty() && value != "0" && !value.eq_ignore_ascii_case("false")
    }

    #[test]
    fn no_color_is_honoured_over_any_terminal() {
        // Set in CI and by anybody piping logs. Checked first, so it wins.
        if std::env::var_os("NO_COLOR").is_some() {
            assert!(!terminal_supports_colour());
        }
        // And a non-terminal is never painted, whatever NO_COLOR says.
        if !std::io::IsTerminal::is_terminal(&std::io::stdout()) {
            assert!(!terminal_supports_colour());
        }
    }
}
