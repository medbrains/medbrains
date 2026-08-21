//! Failures talking to a terminology server.

use thiserror::Error;

#[derive(Debug, Error)]
pub enum SnomedError {
    /// The server answered, and said no.
    #[error("terminology server: {0}")]
    Server(String),

    /// The server answered with something this client cannot read. Never
    /// interpreted optimistically — see `validation_result`.
    #[error("unexpected response from the terminology server: {0}")]
    UnexpectedResponse(String),

    /// No answer at all.
    ///
    /// Worth its own variant because it is the failure mode that matters
    /// operationally: SNOMED is served over the network with no local cache,
    /// so an unreachable server means a clinician cannot code a diagnosis.
    #[error(
        "could not reach the terminology server at {base_url}: {source}; SNOMED coding is \
         unavailable until it responds"
    )]
    Unreachable {
        base_url: String,
        #[source]
        source: reqwest::Error,
    },

    #[error("terminology server returned HTTP {status}")]
    Http { status: u16 },
}
