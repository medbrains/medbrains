//! The two network calls: AWS STS signs an identity token, Anthropic
//! exchanges it. Only [`access_token`] is public.

use std::time::{Duration, Instant};

use aws_config::{BehaviorVersion, Region};

use crate::{
    AUDIENCE, AccessToken, AuthError, FederationConfig, TOKEN_URL, TokenCache,
    parse_token_response, scrub,
};

/// The identity token is spent at once; five minutes covers a slow exchange.
const IDENTITY_TOKEN_SECONDS: i32 = 300;
const EXCHANGE_TIMEOUT: Duration = Duration::from_secs(30);

// ponytail: one process-wide token for one federation config; key by config
// if a process ever talks to two Anthropic workspaces.
static CACHE: TokenCache = TokenCache::new();

/// A usable Anthropic access token: the cached one, or a fresh exchange.
///
/// # Errors
/// AWS could not sign an identity token, or Anthropic refused the exchange.
pub async fn access_token(cfg: &FederationConfig) -> Result<AccessToken, AuthError> {
    if let Some(token) = CACHE.get(Instant::now()) {
        return Ok(token);
    }
    // A fresh identity token per exchange: its `jti` is single use.
    let assertion = identity_token(cfg).await?;
    let (token, lifetime) = exchange(cfg, &assertion).await?;
    CACHE.put(token.clone(), lifetime, Instant::now());
    Ok(token)
}

/// STS `GetWebIdentityToken` on the regional endpoint.
async fn identity_token(cfg: &FederationConfig) -> Result<String, AuthError> {
    let mut loader =
        aws_config::defaults(BehaviorVersion::latest()).region(Region::new(cfg.aws_region.clone()));
    if let Some(profile) = &cfg.aws_profile {
        loader = loader.profile_name(profile);
    }
    let sts = aws_sdk_sts::Client::new(&loader.load().await);
    let out = sts
        .get_web_identity_token()
        .audience(AUDIENCE)
        .signing_algorithm("RS256")
        .duration_seconds(IDENTITY_TOKEN_SECONDS)
        .send()
        .await
        .map_err(|e| {
            AuthError::Aws(scrub(
                &aws_sdk_sts::error::DisplayErrorContext(&e).to_string(),
            ))
        })?;
    out.web_identity_token()
        .filter(|t| !t.is_empty())
        .map(str::to_owned)
        .ok_or_else(|| AuthError::Aws("STS returned no identity token".to_owned()))
}

/// POST the identity token to Anthropic's token endpoint.
async fn exchange(
    cfg: &FederationConfig,
    assertion: &str,
) -> Result<(AccessToken, Duration), AuthError> {
    let fail = |e: reqwest::Error| AuthError::Exchange(scrub(&e.without_url().to_string()));
    let response = reqwest::Client::builder()
        .timeout(EXCHANGE_TIMEOUT)
        .build()
        .map_err(fail)?
        .post(TOKEN_URL)
        .json(&cfg.token_request(assertion))
        .send()
        .await
        .map_err(fail)?;
    let status = response.status().as_u16();
    let body = response.text().await.map_err(fail)?;
    parse_token_response(status, &body)
}
