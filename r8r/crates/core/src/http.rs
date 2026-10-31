//! One place where r8r talks HTTP.
//!
//! The generic HTTP Request node and every declarative integration go through
//! here, so timeout handling, response decoding and error text are identical
//! whichever route a request took.

use crate::errors::{CoreError, Result};
use r8r_workflow::routing::{BodyType, HttpMethod};
use reqwest::{Method, RequestBuilder, Response};
use serde_json::{Map, Value, json};
use std::time::Duration;

/// How much of a failing response body to quote back in the error.
pub const ERROR_EXCERPT_CHARS: usize = 400;
pub const MAX_TIMEOUT_MS: u64 = 300_000;
pub const DEFAULT_TIMEOUT_MS: f64 = 30_000.0;

/// A decoded response, in the shape items downstream will see.
#[derive(Debug, Clone)]
pub struct HttpResponse {
    pub status: u16,
    pub headers: Map<String, Value>,
    pub body: Value,
}

impl HttpResponse {
    #[must_use]
    pub fn is_success(&self) -> bool {
        (200..300).contains(&self.status)
    }

    /// The item shape the HTTP Request node emits.
    #[must_use]
    pub fn as_item(&self) -> Value {
        json!({ "statusCode": self.status, "headers": self.headers, "body": self.body })
    }
}

/// How the response body should be decoded.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ResponseFormat {
    /// Decide from the `Content-Type` header.
    Auto,
    Json,
    Text,
    /// Base64-encode the bytes. The only way a binary download — a PDF, an
    /// image, an Excel workbook — can travel through a JSON item.
    Base64,
}

impl ResponseFormat {
    #[must_use]
    pub fn parse(value: &str) -> Self {
        match value {
            "json" => ResponseFormat::Json,
            "text" => ResponseFormat::Text,
            "base64" | "binary" => ResponseFormat::Base64,
            _ => ResponseFormat::Auto,
        }
    }
}

#[must_use]
pub fn method_of(method: HttpMethod) -> Method {
    match method {
        HttpMethod::Get => Method::GET,
        HttpMethod::Post => Method::POST,
        HttpMethod::Put => Method::PUT,
        HttpMethod::Patch => Method::PATCH,
        HttpMethod::Delete => Method::DELETE,
        HttpMethod::Head => Method::HEAD,
    }
}

/// Parse a method supplied as free text, e.g. from the generic HTTP node.
pub fn method_from_str(value: &str) -> Result<Method> {
    Method::from_bytes(value.to_uppercase().as_bytes())
        .map_err(|_| CoreError::Node(format!("unsupported HTTP method `{value}`")))
}

pub fn timeout_from(ms: f64) -> Duration {
    Duration::from_millis(r8r_workflow::node_helpers::millis(ms, MAX_TIMEOUT_MS).max(1))
}

/// Attach a body of the requested encoding.
pub fn with_body(
    request: RequestBuilder,
    body_type: BodyType,
    body: Option<&Value>,
) -> Result<RequestBuilder> {
    Ok(match body_type {
        BodyType::None => request,
        BodyType::Json => {
            let payload = match body {
                Some(Value::String(raw)) => serde_json::from_str::<Value>(raw)
                    .map_err(|e| CoreError::Node(format!("invalid JSON body: {e}")))?,
                Some(other) => other.clone(),
                None => json!({}),
            };
            request.json(&payload)
        }
        BodyType::Form => {
            let pairs = match body {
                Some(Value::Object(map)) => map
                    .iter()
                    .map(|(key, value)| (key.clone(), stringify(value)))
                    .collect::<Vec<_>>(),
                _ => Vec::new(),
            };
            request.form(&pairs)
        }
        BodyType::Raw => request.body(body.map(stringify).unwrap_or_default()),
    })
}

/// Send the request and decode the answer.
///
/// Non-2xx statuses become errors unless `never_error` is set, because a
/// silent 500 downstream is far harder to debug than a failed node.
pub async fn send(
    request: RequestBuilder,
    url: &str,
    format: ResponseFormat,
    never_error: bool,
) -> Result<HttpResponse> {
    let response = request
        .send()
        .await
        .map_err(|e| CoreError::Node(format!("request to {url} failed: {e}")))?;

    let decoded = decode(response, url, format).await?;

    if !decoded.is_success() && !never_error {
        return Err(CoreError::Node(format!(
            "{url} responded {}: {}",
            decoded.status,
            truncate(&stringify(&decoded.body), ERROR_EXCERPT_CHARS)
        )));
    }
    Ok(decoded)
}

async fn decode(response: Response, url: &str, format: ResponseFormat) -> Result<HttpResponse> {
    if format == ResponseFormat::Base64 {
        return decode_binary(response, url).await;
    }
    let status = response.status().as_u16();
    let headers: Map<String, Value> = response
        .headers()
        .iter()
        .map(|(name, value)| (name.to_string(), json!(value.to_str().unwrap_or_default())))
        .collect();
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default()
        .to_owned();

    let text = response
        .text()
        .await
        .map_err(|e| CoreError::Node(format!("could not read response body from {url}: {e}")))?;

    let wants_json = match format {
        ResponseFormat::Json => true,
        // Handled above; listed so a new variant cannot be forgotten here.
        ResponseFormat::Text | ResponseFormat::Base64 => false,
        ResponseFormat::Auto => content_type.contains("json"),
    };

    // An API that claims JSON and sends something else must degrade to text
    // rather than fail the workflow.
    let body = if wants_json {
        serde_json::from_str::<Value>(&text).unwrap_or(Value::String(text))
    } else {
        Value::String(text)
    };

    Ok(HttpResponse {
        status,
        headers,
        body,
    })
}

/// Read the response as bytes and hand them over base64-encoded.
async fn decode_binary(response: Response, url: &str) -> Result<HttpResponse> {
    use base64::Engine as _;

    let status = response.status().as_u16();
    let headers: Map<String, Value> = response
        .headers()
        .iter()
        .map(|(name, value)| (name.to_string(), json!(value.to_str().unwrap_or_default())))
        .collect();

    let bytes = response
        .bytes()
        .await
        .map_err(|e| CoreError::Node(format!("could not read response body from {url}: {e}")))?;

    let encoded = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(HttpResponse {
        status,
        headers,
        body: Value::String(encoded),
    })
}

pub fn stringify(value: &Value) -> String {
    r8r_workflow::stringify(value)
}

/// Keep a failing response readable in the execution log without dumping a
/// whole HTML error page into it.
#[must_use]
pub fn truncate(text: &str, max: usize) -> String {
    if text.chars().count() <= max {
        return text.to_owned();
    }
    let cut: String = text.chars().take(max).collect();
    format!("{cut}…")
}

/// Join a base URL and a path without doubling or dropping the slash.
#[must_use]
pub fn join_url(base: &str, path: &str) -> String {
    if path.starts_with("http://") || path.starts_with("https://") {
        return path.to_owned();
    }
    if base.is_empty() {
        return path.to_owned();
    }
    format!(
        "{}/{}",
        base.trim_end_matches('/'),
        path.trim_start_matches('/')
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn join_url_normalises_slashes() {
        assert_eq!(
            join_url("https://api.x.com", "users"),
            "https://api.x.com/users"
        );
        assert_eq!(
            join_url("https://api.x.com/", "/users"),
            "https://api.x.com/users"
        );
        assert_eq!(
            join_url("https://api.x.com/v2/", "users"),
            "https://api.x.com/v2/users"
        );
    }

    #[test]
    fn an_absolute_path_ignores_the_base_url() {
        assert_eq!(
            join_url("https://api.x.com", "https://other.example/thing"),
            "https://other.example/thing"
        );
    }

    #[test]
    fn an_empty_base_leaves_the_path_alone() {
        assert_eq!(join_url("", "https://x.com/a"), "https://x.com/a");
        assert_eq!(join_url("", "/a"), "/a");
    }

    #[test]
    fn truncate_keeps_short_text_and_marks_long_text() {
        assert_eq!(truncate("short", 10), "short");
        assert_eq!(truncate("abcdefghij", 3), "abc…");
    }

    #[test]
    fn truncate_counts_characters_not_bytes() {
        // Cutting mid-codepoint would panic on a byte-based slice.
        assert_eq!(truncate("🚀🚀🚀", 2), "🚀🚀…");
    }

    #[test]
    fn response_format_falls_back_to_auto_for_anything_unknown() {
        assert_eq!(ResponseFormat::parse("json"), ResponseFormat::Json);
        assert_eq!(ResponseFormat::parse("text"), ResponseFormat::Text);
        assert_eq!(ResponseFormat::parse("whatever"), ResponseFormat::Auto);
    }

    #[test]
    fn timeouts_are_bounded_even_for_nonsense_input() {
        assert_eq!(timeout_from(-5.0), Duration::from_millis(1));
        assert_eq!(
            timeout_from(f64::INFINITY),
            Duration::from_millis(MAX_TIMEOUT_MS)
        );
        assert_eq!(timeout_from(1500.0), Duration::from_millis(1500));
    }

    #[test]
    fn a_malformed_method_is_rejected() {
        assert!(method_from_str("GET POST").is_err());
        assert_eq!(method_from_str("patch").expect("valid"), Method::PATCH);
    }
}
