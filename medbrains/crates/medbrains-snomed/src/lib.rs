//! SNOMED CT through a FHIR R4 terminology server.
//!
//! Built against FHIR terminology *operations* rather than any one server's
//! native API, so the same client works against Snowstorm, Snowstorm Lite,
//! Ontoserver or a national endpoint — and because it is the same FHIR R4
//! surface ABDM M2/M3 requires, the work is reused rather than repeated.
//!
//! ```text
//! GET  /CodeSystem/$lookup?system=http://snomed.info/sct&code=73211009
//! GET  /ValueSet/$expand?url=…?fhir_vs=ecl/<<73211009
//! GET  /CodeSystem/$validate-code?system=…&code=…
//! ```
//!
//! # No local cache
//!
//! Every call goes to the server; nothing is stored. That is a deliberate
//! choice and it has a cost worth stating plainly: **when the terminology
//! server is unreachable, SNOMED coding stops.** There is no degraded mode.
//!
//! For a hospital on a fixed line that is a fair trade for always-current
//! terminology. For a medical camp on an intermittent link it is not, and
//! `SnomedError::Unreachable` exists so that a caller can say so to the person
//! at the desk rather than showing an empty result list that looks like "no
//! such diagnosis".
//!
//! # Concept ids are strings
//!
//! Always. SNOMED identifiers exceed 2^53, so a JSON number would be silently
//! rounded by any JavaScript client — turning one concept into another.

pub mod error;
pub mod model;
pub mod parse;

use std::time::Duration;

/// Short on purpose: this sits in the path of a clinician typing a diagnosis,
/// and a slow answer is worse than a quick failure they can act on.
const DEFAULT_TIMEOUT: Duration = Duration::from_secs(5);

pub use error::SnomedError;
pub use model::{Concept, Relationship};
pub use parse::SNOMED_SYSTEM;

/// Where the terminology server is, and how to talk to it.
#[derive(Debug, Clone)]
pub struct SnomedConfig {
    /// FHIR base, e.g. `https://snowstorm.example/fhir`.
    pub base_url: String,
    /// Sent as `Authorization` when present. Servers behind a gateway
    /// typically need it; a self-hosted Snowstorm Lite typically does not.
    pub authorization: Option<String>,
    /// Kept short on purpose. This sits in the path of a clinician typing a
    /// diagnosis, and a slow answer is worse than a quick failure they can
    /// act on.
    pub timeout: Duration,
}

impl SnomedConfig {
    /// Build from explicit values.
    ///
    /// Separate from [`Self::from_env`] so the normalisation below — trimming,
    /// the trailing slash, the timeout default — is testable. Reading the
    /// environment is `unsafe` to *set* in Rust 2024 and forbidden by this
    /// workspace's lints, so a test that went through `from_env` could not
    /// exist, and the logic would go unchecked.
    ///
    /// Returns `None` when there is no base URL, which is how a deployment
    /// says it has no terminology server — deliberately distinct from one that
    /// is configured and unreachable.
    #[must_use]
    pub fn from_parts(
        base_url: Option<&str>,
        authorization: Option<&str>,
        timeout_ms: Option<u64>,
    ) -> Option<Self> {
        let base_url = base_url
            .map(|value| value.trim().trim_end_matches('/').to_owned())
            .filter(|value| !value.is_empty())?;
        Some(Self {
            base_url,
            authorization: authorization
                .map(str::to_owned)
                .filter(|value| !value.trim().is_empty()),
            timeout: timeout_ms.map_or(DEFAULT_TIMEOUT, Duration::from_millis),
        })
    }

    /// Read from the environment, mirroring the `WHO_ICD_*` convention already
    /// used for ICD.
    #[must_use]
    pub fn from_env() -> Option<Self> {
        Self::from_parts(
            std::env::var("SNOMED_FHIR_BASE_URL").ok().as_deref(),
            std::env::var("SNOMED_FHIR_AUTHORIZATION").ok().as_deref(),
            std::env::var("SNOMED_FHIR_TIMEOUT_MS")
                .ok()
                .and_then(|raw| raw.parse().ok()),
        )
    }
}

/// A client for one terminology server.
#[derive(Debug, Clone)]
pub struct SnomedClient {
    config: SnomedConfig,
    http: reqwest::Client,
}

impl SnomedClient {
    /// # Errors
    /// If the HTTP client cannot be built.
    pub fn new(config: SnomedConfig) -> Result<Self, reqwest::Error> {
        let http = reqwest::Client::builder().timeout(config.timeout).build()?;
        Ok(Self { config, http })
    }

    /// One concept, with its parents and children.
    ///
    /// # Errors
    /// [`SnomedError::Unreachable`] if the server does not answer.
    pub async fn lookup(&self, code: &str) -> Result<Concept, SnomedError> {
        let body = self
            .get(
                "/CodeSystem/$lookup",
                &[
                    ("system", SNOMED_SYSTEM),
                    ("code", code),
                    // Without this the server returns the display name alone
                    // and no hierarchy, which is the whole reason to ask.
                    ("property", "parent"),
                    ("property", "child"),
                ],
            )
            .await?;
        parse::concept_from_lookup(code, &body)
    }

    /// Text search, optionally narrowed to a semantic tag.
    ///
    /// # Errors
    /// [`SnomedError::Unreachable`] if the server does not answer.
    pub async fn search(&self, term: &str, limit: u32) -> Result<Vec<Concept>, SnomedError> {
        let limit = limit.clamp(1, 100).to_string();
        let body = self
            .get(
                "/ValueSet/$expand",
                &[
                    ("url", &format!("{SNOMED_SYSTEM}?fhir_vs")),
                    ("filter", term),
                    ("count", &limit),
                    // Retired concepts must not reach a diagnosis picker: a
                    // record coded to one is coded to something SNOMED has
                    // said should no longer be used.
                    ("activeOnly", "true"),
                ],
            )
            .await?;
        parse::concepts_from_expansion(&body)
    }

    /// Everything matching an Expression Constraint Language query.
    ///
    /// `<<73211009` is "diabetes mellitus and everything beneath it" — the
    /// question a flat code table cannot answer, and the reason for running a
    /// terminology server at all.
    ///
    /// # Errors
    /// [`SnomedError::Unreachable`] if the server does not answer.
    pub async fn expand_ecl(&self, ecl: &str, limit: u32) -> Result<Vec<Concept>, SnomedError> {
        let limit = limit.clamp(1, 1000).to_string();
        let body = self
            .get(
                "/ValueSet/$expand",
                &[
                    ("url", &format!("{SNOMED_SYSTEM}?fhir_vs=ecl/{ecl}")),
                    ("count", &limit),
                    ("activeOnly", "true"),
                ],
            )
            .await?;
        parse::concepts_from_expansion(&body)
    }

    /// Whether a code exists and is usable.
    ///
    /// # Errors
    /// [`SnomedError::Unreachable`] if the server does not answer. Note that
    /// this never resolves to `true` on a malformed response — see
    /// [`parse::validation_result`].
    pub async fn validate(&self, code: &str) -> Result<bool, SnomedError> {
        let body = self
            .get(
                "/CodeSystem/$validate-code",
                &[("url", SNOMED_SYSTEM), ("code", code)],
            )
            .await?;
        parse::validation_result(&body)
    }

    async fn get(
        &self,
        path: &str,
        query: &[(&str, &str)],
    ) -> Result<serde_json::Value, SnomedError> {
        let url = format!("{}{path}", self.config.base_url);
        let mut request = self.http.get(&url).query(query).header(
            "Accept",
            // Ask for FHIR JSON specifically; some servers default to XML.
            "application/fhir+json",
        );
        if let Some(authorization) = &self.config.authorization {
            request = request.header("Authorization", authorization);
        }

        let response = request.send().await.map_err(|source| {
            // The failure that matters operationally, given there is no cache.
            SnomedError::Unreachable {
                base_url: self.config.base_url.clone(),
                source,
            }
        })?;

        let status = response.status();
        // 4xx bodies are usually an OperationOutcome carrying a useful reason,
        // so they are parsed rather than discarded for their status code.
        let body: serde_json::Value = response.json().await.map_err(|_| SnomedError::Http {
            status: status.as_u16(),
        })?;
        if status.is_server_error() {
            return Err(SnomedError::Http {
                status: status.as_u16(),
            });
        }
        Ok(body)
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::{DEFAULT_TIMEOUT, SNOMED_SYSTEM, SnomedConfig};
    use std::time::Duration;

    #[test]
    fn a_trailing_slash_does_not_produce_a_double_slash() {
        // `https://host/fhir/` + `/CodeSystem/$lookup` would otherwise become
        // `//CodeSystem`, which some gateways reject and others redirect.
        let config = SnomedConfig::from_parts(Some("https://example.test/fhir/"), None, None);
        assert_eq!(
            config.map(|c| c.base_url).as_deref(),
            Some("https://example.test/fhir")
        );
    }

    #[test]
    fn no_base_url_means_no_terminology_server_configured() {
        // Distinct from one that is configured and unreachable — a caller has
        // to tell those apart to say anything useful to a clinician.
        assert!(SnomedConfig::from_parts(None, None, None).is_none());
        assert!(SnomedConfig::from_parts(Some("   "), None, None).is_none());
        assert!(SnomedConfig::from_parts(Some(""), None, None).is_none());
    }

    #[test]
    fn a_blank_authorization_header_is_not_sent() {
        // An empty `Authorization:` is worse than none — some gateways reject
        // the request outright rather than treating it as anonymous.
        let config = SnomedConfig::from_parts(Some("https://x.test"), Some("  "), None).unwrap();
        assert!(config.authorization.is_none());
        let with =
            SnomedConfig::from_parts(Some("https://x.test"), Some("Bearer t"), None).unwrap();
        assert_eq!(with.authorization.as_deref(), Some("Bearer t"));
    }

    #[test]
    fn the_timeout_defaults_short_because_a_clinician_is_waiting() {
        let config = SnomedConfig::from_parts(Some("https://x.test"), None, None).unwrap();
        assert_eq!(config.timeout, DEFAULT_TIMEOUT);
        let explicit = SnomedConfig::from_parts(Some("https://x.test"), None, Some(1500)).unwrap();
        assert_eq!(explicit.timeout, Duration::from_millis(1500));
    }

    #[test]
    fn the_system_uri_is_never_locally_invented() {
        assert_eq!(SNOMED_SYSTEM, "http://snomed.info/sct");
    }
}
