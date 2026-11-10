//! Anthropic API access with no Anthropic API key anywhere.
//!
//! Workload identity federation: AWS STS signs an identity token for this
//! machine's AWS identity (the instance role on EC2, an AWS CLI profile on a
//! laptop), and Anthropic's token endpoint exchanges it — under a federation
//! rule set up in the Anthropic console — for an access token that lives ten
//! minutes. The API is then called with `authorization: Bearer`.
//!
//! The exchange carries only the identity token and four configuration IDs:
//! never patient data, never a prompt. Tokens are never logged, formatted or
//! put in an error ([`AccessToken`] has no readable `Debug`, and every error
//! text is [`scrub`]bed).

use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde_json::{Value, json};

mod exchange;
pub use exchange::access_token;

/// Anthropic's token endpoint. The only Anthropic URL this crate calls.
pub const TOKEN_URL: &str = "https://api.anthropic.com/v1/oauth/token";
/// The audience the AWS identity token is signed for.
pub const AUDIENCE: &str = "https://api.anthropic.com";
/// Where the AWS identity token is signed unless `ANTHROPIC_AWS_REGION` says otherwise.
pub const DEFAULT_REGION: &str = "ap-south-1";
const GRANT_TYPE: &str = "urn:ietf:params:oauth:grant-type:jwt-bearer";
/// A cached token is replaced this long before it expires.
const REFRESH_MARGIN: Duration = Duration::from_secs(120);

/// The four IDs Anthropic's federation needs — the names Anthropic's SDKs read.
pub const REQUIRED_VARS: [&str; 4] = [
    "ANTHROPIC_FEDERATION_RULE_ID",
    "ANTHROPIC_ORGANIZATION_ID",
    "ANTHROPIC_SERVICE_ACCOUNT_ID",
    "ANTHROPIC_WORKSPACE_ID",
];

/// Why no access token could be had. The text never holds a token.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum AuthError {
    #[error("Anthropic federation is not configured: set {0}")]
    Missing(String),
    #[error("could not get an AWS identity token: {0}")]
    Aws(String),
    #[error("Anthropic token exchange failed: {0}")]
    Exchange(String),
}

/// Federation settings, read from the environment.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FederationConfig {
    pub federation_rule_id: String,
    pub organization_id: String,
    pub service_account_id: String,
    pub workspace_id: String,
    /// `ANTHROPIC_AWS_PROFILE`; unset means the ambient AWS credentials.
    pub aws_profile: Option<String>,
    /// `ANTHROPIC_AWS_REGION`, default [`DEFAULT_REGION`].
    pub aws_region: String,
}

impl FederationConfig {
    /// From the process environment.
    ///
    /// # Errors
    /// [`AuthError::Missing`] naming every unset ID.
    pub fn from_env() -> Result<Self, AuthError> {
        Self::from_lookup(|k| std::env::var(k).ok())
    }

    /// From any key lookup (tests, preflight).
    ///
    /// # Errors
    /// [`AuthError::Missing`] naming every unset ID.
    pub fn from_lookup(get: impl Fn(&str) -> Option<String>) -> Result<Self, AuthError> {
        let val = |k: &str| {
            get(k)
                .map(|v| v.trim().to_owned())
                .filter(|v| !v.is_empty())
        };
        let missing: Vec<&str> = REQUIRED_VARS
            .into_iter()
            .filter(|k| val(k).is_none())
            .collect();
        if !missing.is_empty() {
            return Err(AuthError::Missing(missing.join(", ")));
        }
        let [rule, org, account, workspace] = REQUIRED_VARS.map(|k| val(k).unwrap_or_default());
        Ok(Self {
            federation_rule_id: rule,
            organization_id: org,
            service_account_id: account,
            workspace_id: workspace,
            aws_profile: val("ANTHROPIC_AWS_PROFILE"),
            aws_region: val("ANTHROPIC_AWS_REGION").unwrap_or_else(|| DEFAULT_REGION.to_owned()),
        })
    }

    /// The token-endpoint body for one identity token (single use: its `jti`
    /// is spent by the exchange).
    #[must_use]
    pub fn token_request(&self, assertion: &str) -> Value {
        json!({
            "grant_type": GRANT_TYPE,
            "assertion": assertion,
            "federation_rule_id": self.federation_rule_id,
            "organization_id": self.organization_id,
            "service_account_id": self.service_account_id,
            "workspace_id": self.workspace_id,
        })
    }
}

/// A short-lived Anthropic access token. Its `Debug` never shows the value.
#[derive(Clone, PartialEq, Eq)]
pub struct AccessToken(String);

impl AccessToken {
    /// The value, for the `authorization` header only.
    #[must_use]
    pub fn expose(&self) -> &str {
        &self.0
    }
}

impl std::fmt::Debug for AccessToken {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("AccessToken(…)")
    }
}

/// Read the token endpoint's answer: the token and how long it lives.
///
/// # Errors
/// [`AuthError::Exchange`] with the status and Anthropic's error type and
/// message — never the body, which may hold a token.
pub fn parse_token_response(status: u16, body: &str) -> Result<(AccessToken, Duration), AuthError> {
    let fail = |why: String| AuthError::Exchange(scrub(&why));
    let v: Value = serde_json::from_str(body)
        .map_err(|_| fail(format!("HTTP {status}, unreadable response")))?;
    if !(200..300).contains(&status) {
        let kind = v["error"]["type"]
            .as_str()
            .or_else(|| v["error"].as_str())
            .unwrap_or("error");
        let message = v["error"]["message"]
            .as_str()
            .or_else(|| v["error_description"].as_str())
            .unwrap_or_default();
        return Err(fail(
            format!("HTTP {status}: {kind} {message}").trim().to_owned(),
        ));
    }
    let token = v["access_token"]
        .as_str()
        .filter(|t| !t.is_empty())
        .ok_or_else(|| fail("no access_token in the response".to_owned()))?;
    let lifetime = v["expires_in"]
        .as_u64()
        .ok_or_else(|| fail("no expires_in in the response".to_owned()))?;
    Ok((AccessToken(token.to_owned()), Duration::from_secs(lifetime)))
}

/// Blank out anything shaped like a credential: a JWT (`eyJ…`), an Anthropic
/// key or token (`sk-ant-…`). Applied to every error text from AWS or Anthropic.
#[must_use]
pub fn scrub(text: &str) -> String {
    text.split_inclusive(|c: char| c.is_whitespace() || "\"',;:()[]{}".contains(c))
        .map(|word| {
            // A trailing full stop is punctuation: tokens never end in one.
            let bare =
                word.trim_end_matches(|c: char| c.is_whitespace() || ".\"',;:()[]{}".contains(c));
            if bare.starts_with("eyJ") || bare.starts_with("sk-ant-") {
                word.replacen(bare, "[redacted]", 1)
            } else {
                word.to_owned()
            }
        })
        .collect()
}

/// One access token, kept until [`REFRESH_MARGIN`] before it expires.
#[derive(Debug, Default)]
pub struct TokenCache(Mutex<Option<(AccessToken, Instant)>>);

impl TokenCache {
    #[must_use]
    pub const fn new() -> Self {
        Self(Mutex::new(None))
    }

    /// The cached token if it is still good at `now`.
    #[must_use]
    pub fn get(&self, now: Instant) -> Option<AccessToken> {
        // ponytail: a poisoned lock reads as empty; the caller just exchanges again.
        let guard = self.0.lock().ok()?;
        guard
            .as_ref()
            .filter(|(_, expires)| now + REFRESH_MARGIN < *expires)
            .map(|(token, _)| token.clone())
    }

    /// Keep `token`, issued at `now` for `lifetime`.
    pub fn put(&self, token: AccessToken, lifetime: Duration, now: Instant) {
        if let Ok(mut guard) = self.0.lock() {
            *guard = Some((token, now + lifetime));
        }
    }
}

#[cfg(test)]
mod tests;
