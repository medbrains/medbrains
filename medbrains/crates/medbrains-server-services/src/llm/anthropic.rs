//! The Anthropic provider: a federated access token (no API key exists) sent
//! as `authorization: Bearer`, through a transport middleware that also
//! refuses any host but Anthropic's.
//!
//! Production AI is Bedrock in ap-south-1; this provider is for dev/eval on
//! synthetic data, which is why preflight warns when it is the default.

use medbrains_anthropic_auth::FederationConfig;
use medbrains_server_core::error::AppError;
use rig::Model;
use rig::http_client::{self, Exchange, HeaderMap, HeaderValue, HttpMiddleware};
use rig::providers::anthropic::completion::CacheTtl;
use rig::providers::anthropic::{AnthropicConfig, Messages};
use rig::wasm_compat::WasmBoxedFuture;

/// The only host an Anthropic request may go to.
const HOST: &str = "api.anthropic.com";

/// Replaces rig's `x-api-key` with the bearer token, and refuses a request
/// to any other host before it is sent.
#[derive(Debug)]
struct Bearer(HeaderValue);

impl HttpMiddleware for Bearer {
    fn before_request_headers<'a>(
        &'a self,
        exchange: Exchange<'a>,
        headers: &'a mut HeaderMap,
    ) -> WasmBoxedFuture<'a, http_client::Result<()>> {
        Box::pin(async move { authorize(exchange.uri.host(), &self.0, headers) })
    }
}

fn authorize(
    host: Option<&str>,
    token: &HeaderValue,
    headers: &mut HeaderMap,
) -> http_client::Result<()> {
    if host != Some(HOST) {
        return Err(http_client::Error::instance(std::io::Error::other(
            "AI request refused: not the Anthropic API host",
        )));
    }
    headers.remove("x-api-key");
    headers.insert("authorization", token.clone());
    Ok(())
}

/// A usable access token (cached in-process until two minutes before expiry).
///
/// # Errors
/// `ServiceUnavailable` when federation is not configured or the exchange
/// failed. The message never holds a token.
pub async fn access_token() -> Result<String, AppError> {
    let unavailable = |e: medbrains_anthropic_auth::AuthError| {
        AppError::ServiceUnavailable(format!("AI provider sign-in failed: {e}"))
    };
    let cfg = FederationConfig::from_env().map_err(unavailable)?;
    let token = medbrains_anthropic_auth::access_token(&cfg)
        .await
        .map_err(unavailable)?;
    Ok(token.expose().to_owned())
}

/// The Messages model `model`, authenticated with `token` as a bearer. The
/// fixed prefix (tools + system) is cached for an hour; the moving history
/// breakpoint for five minutes.
///
/// # Errors
/// `BadRequest` when the token cannot be a header value.
pub fn model(token: &str, model: &str) -> Result<Model<Messages>, AppError> {
    let mut bearer = HeaderValue::from_str(&format!("Bearer {token}"))
        .map_err(|_| AppError::BadRequest("AI client error: unusable access token".to_owned()))?;
    bearer.set_sensitive(true);
    let http = rig_reqwest::shared().with_middleware(Bearer(bearer));
    // rig sends the key it is given as x-api-key; the middleware removes it.
    let config = AnthropicConfig::new(String::new()).with_base_url(format!("https://{HOST}"));
    let wire = config
        .completion(model)
        .with_default_max_tokens(u64::from(medbrains_core::ai_guard::MAX_ANSWER_TOKENS))
        .with_prompt_caching()
        .with_static_prefix_cache_ttl(CacheTtl::OneHour);
    Ok(Model::new(wire, http))
}

#[cfg(test)]
mod tests {
    use super::{HOST, HeaderMap, HeaderValue, authorize};

    fn token() -> HeaderValue {
        let mut v = HeaderValue::from_static("Bearer t");
        v.set_sensitive(true);
        v
    }

    #[test]
    fn the_api_key_header_is_replaced_by_the_bearer() {
        let mut headers = HeaderMap::new();
        headers.insert("x-api-key", HeaderValue::from_static(""));
        assert!(authorize(Some(HOST), &token(), &mut headers).is_ok());
        assert!(headers.get("x-api-key").is_none());
        assert!(
            headers
                .get("authorization")
                .is_some_and(|v| v.is_sensitive() && format!("{v:?}") == "Sensitive")
        );
    }

    #[test]
    fn a_request_to_any_other_host_is_refused_before_it_is_sent() {
        let mut headers = HeaderMap::new();
        assert!(authorize(Some("evil.example"), &token(), &mut headers).is_err());
        assert!(authorize(None, &token(), &mut headers).is_err());
        assert!(headers.get("authorization").is_none());
    }
}
