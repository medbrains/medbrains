//! Simple in-memory rate limiter for login attempts.
//!
//! Uses a sliding window counter per IP address. Limits to
//! `MAX_ATTEMPTS` requests per `WINDOW_SECS` seconds.
//! Returns 429 Too Many Requests when exceeded.

use std::{
    collections::HashMap,
    net::IpAddr,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

use axum::{
    extract::{ConnectInfo, Request, State},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};

/// Maximum login attempts per IP within the window.
const MAX_ATTEMPTS: usize = 5;

/// Sliding window duration in seconds.
const WINDOW_SECS: u64 = 60;

/// Cleanup interval — remove stale entries after this many seconds.
const CLEANUP_AFTER_SECS: u64 = 300;

/// Shared rate limiter state.
#[derive(Clone, Debug)]
pub struct RateLimiter {
    attempts: Arc<Mutex<HashMap<IpAddr, Vec<Instant>>>>,
    last_cleanup: Arc<Mutex<Instant>>,
}

impl RateLimiter {
    pub fn new() -> Self {
        Self {
            attempts: Arc::new(Mutex::new(HashMap::new())),
            last_cleanup: Arc::new(Mutex::new(Instant::now())),
        }
    }

    /// Record an attempt and return whether the request is allowed.
    #[allow(clippy::significant_drop_tightening)]
    pub fn check_and_record(&self, ip: IpAddr) -> bool {
        let now = Instant::now();
        let window = Duration::from_secs(WINDOW_SECS);
        let mut map = self
            .attempts
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);

        // Periodic cleanup of stale entries
        let should_cleanup = {
            let last = self
                .last_cleanup
                .lock()
                .unwrap_or_else(std::sync::PoisonError::into_inner);
            now.duration_since(*last) > Duration::from_secs(CLEANUP_AFTER_SECS)
        };
        if should_cleanup {
            map.retain(|_, timestamps| {
                timestamps
                    .last()
                    .is_some_and(|t| now.duration_since(*t) < window)
            });
            let mut last = self
                .last_cleanup
                .lock()
                .unwrap_or_else(std::sync::PoisonError::into_inner);
            *last = now;
        }

        let timestamps = map.entry(ip).or_default();
        timestamps.retain(|t| now.duration_since(*t) < window);

        if timestamps.len() >= MAX_ATTEMPTS {
            return false;
        }

        timestamps.push(now);
        true
    }
}

impl Default for RateLimiter {
    fn default() -> Self {
        Self::new()
    }
}

/// Axum middleware that rate-limits based on client IP.
pub async fn rate_limit_middleware(
    State(limiter): State<RateLimiter>,
    request: Request,
    next: Next,
) -> Response {
    let ip = extract_client_ip(&request);

    if let Some(ip) = ip {
        if !limiter.check_and_record(ip) {
            return (
                StatusCode::TOO_MANY_REQUESTS,
                axum::Json(serde_json::json!({
                    "error": "too_many_requests",
                    "detail": "Too many login attempts. Please try again later.",
                })),
            )
                .into_response();
        }
    }

    next.run(request).await
}

/// Extract client IP — tries `ConnectInfo`, `X-Forwarded-For`, `X-Real-IP`.
fn extract_client_ip(request: &Request) -> Option<IpAddr> {
    // Try ConnectInfo (direct connection)
    if let Some(connect_info) = request
        .extensions()
        .get::<ConnectInfo<std::net::SocketAddr>>()
    {
        return Some(connect_info.0.ip());
    }

    // Try X-Forwarded-For header (first IP in chain)
    if let Some(forwarded) = request
        .headers()
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
    {
        if let Some(first_ip) = forwarded.split(',').next() {
            if let Ok(ip) = first_ip.trim().parse::<IpAddr>() {
                return Some(ip);
            }
        }
    }

    // Try X-Real-IP header
    if let Some(real_ip) = request
        .headers()
        .get("x-real-ip")
        .and_then(|v| v.to_str().ok())
    {
        if let Ok(ip) = real_ip.trim().parse::<IpAddr>() {
            return Some(ip);
        }
    }

    None
}
