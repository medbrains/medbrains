//! What r8r writes to the console.
//!
//! A workflow engine is only debuggable if you can see what it did, so every
//! execution — manual, webhook or scheduled — leaves a trail: one line when it
//! starts, one per node with its item count and duration, and one when it
//! finishes. The detail level is a setting rather than a rebuild.

use tracing_subscriber::EnvFilter;
use tracing_subscriber::fmt::time::UtcTime;

/// `R8R_LOG` follows the usual filter syntax: `info`, `debug`,
/// `r8r_core=debug,r8r_cli=info`, and so on.
const ENV_VAR: &str = "R8R_LOG";
const DEFAULT_FILTER: &str = "info";

/// How lines are rendered.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LogFormat {
    /// Readable in a terminal.
    Pretty,
    /// One JSON object per line, for shipping somewhere.
    Json,
}

impl LogFormat {
    #[must_use]
    pub fn from_env() -> Self {
        match std::env::var("R8R_LOG_FORMAT")
            .unwrap_or_default()
            .to_ascii_lowercase()
            .as_str()
        {
            "json" => LogFormat::Json,
            _ => LogFormat::Pretty,
        }
    }
}

/// Install the subscriber. Safe to call once at startup; later calls are
/// ignored rather than panicking, which keeps tests that build a server able
/// to run in the same process.
pub fn install(format: LogFormat) {
    let filter =
        EnvFilter::try_from_env(ENV_VAR).unwrap_or_else(|_| EnvFilter::new(DEFAULT_FILTER));

    // Colour only when somebody can see it, and never in JSON — a machine
    // reading these does not want escape codes inside a field, whatever
    // terminal the process happens to have been started from.
    let colour = format == LogFormat::Pretty && crate::http_log::terminal_supports_colour();
    crate::http_log::init_colour(colour);

    let builder = tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_timer(UtcTime::rfc_3339())
        .with_ansi(colour)
        .with_target(false);

    let installed = match format {
        LogFormat::Json => builder.json().with_current_span(false).try_init().is_ok(),
        LogFormat::Pretty => builder.compact().try_init().is_ok(),
    };

    if installed {
        tracing::debug!("logging ready; set {ENV_VAR}=debug for per-node detail");
    }
}
