//! Dev-only: stamps the **uncompressed** response size into the
//! `x-mb-raw-bytes` header so the edge proxy can log before→after compression
//! on its own request line (where the operator is actually watching).
//!
//! The size comes from the body's `size_hint().exact()` — NOT the
//! `Content-Length` header, which axum/hyper only sets at transport time (so it
//! is absent at the middleware layer). This layer sits inside the
//! CompressionLayer, so the body here is the raw (pre-compression) payload; the
//! header survives compression (it only rewrites Content-Encoding/Length), the
//! proxy reads it, logs raw vs wire bytes. Streaming bodies (SSE) report no
//! exact size, so they are skipped.
//!
//! Opt-in via `MEDBRAINS_LOG_PAYLOAD_SIZES`; zero cost in production (the env
//! check is memoised and, when off, the middleware is a straight passthrough).

use std::sync::OnceLock;

use axum::{
    extract::Request,
    http::{HeaderValue, header::HeaderName},
    middleware::Next,
    response::Response,
};
use http_body::Body as _;

/// Header the edge proxy reads to report the pre-compression payload size.
pub const RAW_SIZE_HEADER: &str = "x-mb-raw-bytes";

fn enabled() -> bool {
    static ENABLED: OnceLock<bool> = OnceLock::new();
    *ENABLED.get_or_init(|| std::env::var("MEDBRAINS_LOG_PAYLOAD_SIZES").is_ok())
}

pub async fn payload_size_log(request: Request, next: Next) -> Response {
    if !enabled() {
        return next.run(request).await;
    }
    let mut response = next.run(request).await;
    // Exact size for buffered bodies (Json etc.); None for streaming → skip.
    if let Some(raw) = response.body().size_hint().exact()
        && let Ok(value) = HeaderValue::from_str(&raw.to_string())
    {
        response
            .headers_mut()
            .insert(HeaderName::from_static(RAW_SIZE_HEADER), value);
    }
    response
}
