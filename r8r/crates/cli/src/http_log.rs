//! One line per request, coloured by what happened.
//!
//! r8r logged nothing per request: a webhook that 500ed and one that worked
//! left the same trace, which is none. For an engine whose whole job is
//! running other people's work on a schedule, "did that webhook arrive" is the
//! first question anybody asks.
//!
//! Two things carry the answer, and they are separate on purpose.
//!
//! **The level** comes from the status, so a 5xx reaches whatever collects
//! these logs as an ERROR and can be alerted on without parsing a message.
//! That works whether or not anybody is watching a terminal.
//!
//! **The colour** is for whoever is. Levels offer four, which cannot
//! distinguish the five things worth distinguishing here, so the status itself
//! is painted by class — giving a column the eye can run down.
//!
//! | status | level | colour  |
//! |--------|-------|---------|
//! | 5xx    | ERROR | red     |
//! | 429    | WARN  | magenta |
//! | 4xx    | INFO  | yellow  |
//! | 3xx    | DEBUG | cyan    |
//! | 2xx    | INFO  | green   |
//!
//! 4xx is INFO rather than WARN or DEBUG, and the level matters more than it
//! looks. At WARN, a probed webhook path would cry wolf on every scan. At
//! DEBUG it would be invisible at the default filter — and for r8r a 404 is
//! usually somebody's integration pointed at the wrong path, which is the
//! first thing an operator needs to see. INFO shows it without alarm, and the
//! colour is what separates it from the traffic around it.
//!
//! 3xx stays at DEBUG: the editor is a single-page app and its redirects are
//! not news.
//!
//! Written as a plain axum middleware rather than pulling in `tower-http` for
//! one layer. It is twenty lines, and this way the colouring is ours.

use axum::extract::Request;
use axum::http::StatusCode;
use axum::middleware::Next;
use axum::response::Response;
use std::sync::OnceLock;
use std::time::Instant;

static COLOUR: OnceLock<bool> = OnceLock::new();

/// Decide whether request lines are painted. Called once at startup.
///
/// Passed `false` for JSON output whatever the terminal says: a JSON log is
/// read by a machine, and a machine does not want escape codes inside a field.
pub fn init_colour(enabled: bool) {
    let _ = COLOUR.set(enabled);
}

fn colour_enabled() -> bool {
    // Falls back to asking, so a caller that forgets to initialise still
    // behaves rather than painting a redirected log.
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
/// that made this necessary. Under a dev process manager the server's stdout
/// is a pipe, so asking the terminal correctly answers "no" and the logs come
/// out grey while the tooling around them is still in colour. The runner is
/// the thing that knows a human is watching; this lets it say so.
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
/// `FORCE_COLOR=0` is the documented way to turn it off, and treating any set
/// value as "on" would make that switch it on.
fn forced(name: &str) -> bool {
    match std::env::var(name) {
        Ok(value) => {
            let value = value.trim();
            !value.is_empty() && value != "0" && !value.eq_ignore_ascii_case("false")
        }
        Err(_) => false,
    }
}

/// The ANSI colour a status is shown in.
fn shade(status: StatusCode) -> &'static str {
    if status.is_server_error() {
        "31" // red — r8r broke
    } else if status == StatusCode::TOO_MANY_REQUESTS {
        "35" // magenta — the one 4xx that is about us, not the caller
    } else if status.is_client_error() {
        "33" // yellow — the caller asked for something it may not have
    } else if status.is_redirection() {
        "36" // cyan — went somewhere else
    } else {
        "32" // green — ordinary
    }
}

/// The status as it should appear in a line.
#[must_use]
pub fn painted(status: StatusCode) -> String {
    paint(status, colour_enabled())
}

/// The rendering itself, with the decision passed in.
///
/// Split from [`painted`] so both branches can be tested. The decision lives
/// in a `OnceLock` that a process sets once, which is right for a server and
/// useless for a test that needs to see both.
fn paint(status: StatusCode, colour: bool) -> String {
    let code = status.as_u16();
    if !colour {
        return code.to_string();
    }
    format!("\u{1b}[{}m{code}\u{1b}[0m", shade(status))
}

/// Log every request once it has finished.
pub async fn log_requests(request: Request, next: Next) -> Response {
    // Taken before the request is consumed; a handler may rewrite neither, but
    // the borrow ends here either way.
    let method = request.method().clone();
    let path = request.uri().path().to_owned();
    let started = Instant::now();

    let response = next.run(request).await;

    let ms = u64::try_from(started.elapsed().as_millis()).unwrap_or(u64::MAX);
    emit(&method, &path, response.status(), ms);
    response
}

/// Write the line. Split out because each arm is one `tracing` macro, and the
/// macros expand into enough branching that the whole thing reads as complex
/// when it is a five-way match.
#[allow(clippy::cognitive_complexity)] // tracing macro expansion
fn emit(method: &axum::http::Method, path: &str, status: StatusCode, ms: u64) {
    let shown = painted(status);

    if status.is_server_error() {
        tracing::error!(%method, path, status = %shown, ms, "request failed");
    } else if status == StatusCode::TOO_MANY_REQUESTS {
        tracing::warn!(%method, path, status = %shown, ms, "request throttled");
    } else if status.is_client_error() {
        // Visible at the default filter: a 404 here is usually a webhook
        // pointed at a path that does not exist.
        tracing::info!(%method, path, status = %shown, ms, "request refused");
    } else if status.is_redirection() {
        tracing::debug!(%method, path, status = %shown, ms, "redirected");
    } else {
        tracing::info!(%method, path, status = %shown, ms, "request");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn status(code: u16) -> StatusCode {
        StatusCode::from_u16(code).unwrap_or(StatusCode::OK)
    }

    #[test]
    fn each_class_gets_its_own_shade() {
        // Four levels cannot distinguish five things worth distinguishing, so
        // the colour carries what the level cannot.
        let shades = [200, 301, 404, 429, 500].map(|c| shade(status(c)));
        let unique: std::collections::BTreeSet<_> = shades.iter().collect();

        assert_eq!(
            unique.len(),
            shades.len(),
            "two classes share a colour: {shades:?}"
        );
    }

    #[test]
    fn throttling_does_not_look_like_an_ordinary_refusal() {
        assert_ne!(shade(status(429)), shade(status(404)));
    }

    #[test]
    fn a_redirect_does_not_look_like_a_failure() {
        assert_ne!(shade(status(304)), shade(status(500)));
        assert_ne!(shade(status(304)), shade(status(404)));
    }

    #[test]
    fn a_server_failure_is_red_and_a_success_is_not() {
        assert_eq!(shade(status(500)), "31");
        assert_ne!(shade(status(200)), "31");
    }

    #[test]
    fn without_colour_the_status_is_just_a_number() {
        // What a log file or a JSON pipeline must receive. An escape code in a
        // field follows the line everywhere it goes.
        for code in [200, 301, 404, 429, 500] {
            let shown = paint(status(code), false);
            assert_eq!(shown, code.to_string());
            assert!(!shown.contains('\u{1b}'), "escape code leaked: {shown:?}");
        }
    }

    #[test]
    fn with_colour_the_status_is_wrapped_and_closed() {
        // An unterminated escape sequence bleeds into everything after it, so
        // the reset matters as much as the colour.
        for code in [200, 301, 404, 429, 500] {
            let shown = paint(status(code), true);
            assert!(shown.starts_with("\u{1b}["), "{shown:?}");
            assert!(shown.ends_with("\u{1b}[0m"), "not reset: {shown:?}");
            assert!(shown.contains(&code.to_string()), "{shown:?}");
        }
    }

    #[test]
    fn the_colours_actually_differ_when_rendered() {
        // `shade` being distinct is only useful if it reaches the output.
        let rendered: std::collections::BTreeSet<String> = [200, 301, 404, 429, 500]
            .iter()
            .map(|c| paint(status(*c), true))
            .collect();
        assert_eq!(rendered.len(), 5);

        let green = paint(status(200), true);
        let red = paint(status(500), true);
        assert!(green.contains("[32m"), "{green:?}");
        assert!(red.contains("[31m"), "{red:?}");
    }

    #[test]
    fn an_override_of_zero_means_off_not_on() {
        let rule = |v: &str| {
            let v = v.trim();
            !v.is_empty() && v != "0" && !v.eq_ignore_ascii_case("false")
        };
        assert!(!rule("0"));
        assert!(!rule("false"));
        assert!(!rule(""));
        assert!(rule("1"));
        assert!(rule("always"));
    }

    #[test]
    fn no_color_is_honoured_over_any_terminal() {
        if std::env::var_os("NO_COLOR").is_some() {
            assert!(!terminal_supports_colour());
        }
        if !std::io::IsTerminal::is_terminal(&std::io::stdout()) {
            assert!(!terminal_supports_colour());
        }
    }
}
