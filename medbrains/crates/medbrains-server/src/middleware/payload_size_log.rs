//! Dev-only: stamps the **uncompressed** response size into the
//! `x-mb-raw-bytes` header so the edge proxy can log before→after compression
//! on its own request line (where the operator is actually watching).
//!
//! This layer sits inside the CompressionLayer, so the response's
//! `Content-Length` here is the raw (pre-compression) size. The header survives
//! compression (the CompressionLayer only rewrites Content-Encoding/Length), and
//! the proxy reads it, logs raw vs wire bytes, then strips it.
//!
//! Opt-in via `MEDBRAINS_LOG_PAYLOAD_SIZES`; zero cost in production (the env
//! check is memoised and, when off, the middleware is a straight passthrough).

use std::sync::OnceLock;

use axum::{
    extract::Request,
    http::header::{CONTENT_LENGTH, HeaderName},
    middleware::Next,
    response::Response,
};

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
    // Copy the raw Content-Length into x-mb-raw-bytes for the proxy to log.
    if let Some(len) = response.headers().get(CONTENT_LENGTH).cloned() {
        response
            .headers_mut()
            .insert(HeaderName::from_static(RAW_SIZE_HEADER), len);
    }
    response
}
