//! The Anthropic provider: a federated access token (no API key exists) and
//! a rig client that sends it as `authorization: Bearer`.
//!
//! Production AI is Bedrock in ap-south-1; this provider is for dev/eval on
//! synthetic data, which is why preflight warns when it is the default.

use bytes::Bytes;
use medbrains_anthropic_auth::FederationConfig;
use medbrains_server_core::error::AppError;
use rig::http_client::{
    self, HeaderMap, HeaderValue, HttpClientExt, LazyBody, MultipartForm, Request, ReqwestClient,
    Response, StreamingResponse,
};
use rig::wasm_compat::WasmCompatSend;

/// rig's Anthropic client always adds an `x-api-key` header; this transport
/// removes it, so only the bearer token is sent.
#[derive(Debug, Clone, Default)]
pub struct BearerOnly(ReqwestClient);

fn without_key<T>(mut req: Request<T>) -> Request<T> {
    req.headers_mut().remove("x-api-key");
    req
}

impl HttpClientExt for BearerOnly {
    fn send<T, U>(
        &self,
        req: Request<T>,
    ) -> impl Future<Output = http_client::Result<Response<LazyBody<U>>>> + WasmCompatSend + 'static
    where
        T: Into<Bytes> + WasmCompatSend,
        U: From<Bytes> + WasmCompatSend + 'static,
    {
        self.0.send(without_key(req))
    }

    fn send_multipart<U>(
        &self,
        req: Request<MultipartForm>,
    ) -> impl Future<Output = http_client::Result<Response<LazyBody<U>>>> + WasmCompatSend + 'static
    where
        U: From<Bytes> + WasmCompatSend + 'static,
    {
        self.0.send_multipart(without_key(req))
    }

    fn send_streaming<T>(
        &self,
        req: Request<T>,
    ) -> impl Future<Output = http_client::Result<StreamingResponse>> + WasmCompatSend
    where
        T: Into<Bytes>,
    {
        self.0.send_streaming(without_key(req))
    }
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

/// A rig Anthropic client that authenticates with `token` as a bearer.
///
/// # Errors
/// `BadRequest` when the client cannot be built.
pub fn client(token: &str) -> Result<rig::providers::anthropic::Client<BearerOnly>, AppError> {
    let built = |e: http_client::Error| AppError::BadRequest(format!("AI client error: {e}"));
    let mut bearer = HeaderValue::from_str(&format!("Bearer {token}"))
        .map_err(|_| AppError::BadRequest("AI client error: unusable access token".to_owned()))?;
    bearer.set_sensitive(true);
    let mut headers = HeaderMap::new();
    headers.insert("authorization", bearer);
    rig::providers::anthropic::Client::builder()
        .http_client(BearerOnly::default())
        .api_key("")
        .http_headers(headers)
        .build()
        .map_err(built)
}

#[cfg(test)]
mod tests {
    use super::{Request, without_key};

    #[test]
    fn the_api_key_header_is_never_sent() {
        let req = Request::post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", "")
            .header("authorization", "Bearer t")
            .body(Vec::<u8>::new());
        let stripped = req.map(without_key);
        assert!(
            stripped
                .as_ref()
                .is_ok_and(|r| r.headers().get("x-api-key").is_none())
        );
        assert!(stripped.is_ok_and(|r| r.headers().contains_key("authorization")));
    }

    #[test]
    fn the_client_builds_with_a_bearer_and_its_debug_hides_it() {
        let client = super::client("sk-ant-oat01-SECRET");
        assert!(client.is_ok_and(|c| {
            let auth = c.headers().get("authorization");
            auth.is_some_and(|v| v.is_sensitive() && format!("{v:?}") == "Sensitive")
        }));
    }
}
