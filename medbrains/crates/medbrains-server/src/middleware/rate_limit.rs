//! In-memory sliding-window rate limiting.
//!
//! Two uses: the strict per-IP login/OTP limiter (`MAX_ATTEMPTS` per
//! `WINDOW_SECS`) and the tiered API limiter that protects expensive
//! read paths (exports, analytics, print-data) from a single client
//! saturating the server. Returns 429 when exceeded.

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
type AttemptLog = HashMap<(IpAddr, &'static str), Vec<Instant>>;

#[derive(Clone, Debug)]
pub struct RateLimiter {
    attempts: Arc<Mutex<AttemptLog>>,
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
    pub fn check_and_record(&self, ip: IpAddr) -> bool {
        self.check_and_record_class(ip, "default", MAX_ATTEMPTS, WINDOW_SECS)
    }

    /// Class-scoped variant — distinct sliding windows per (ip, class).
    #[allow(clippy::significant_drop_tightening)]
    pub fn check_and_record_class(
        &self,
        ip: IpAddr,
        class: &'static str,
        max_attempts: usize,
        window_secs: u64,
    ) -> bool {
        let now = Instant::now();
        let window = Duration::from_secs(window_secs);
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

        let timestamps = map.entry((ip, class)).or_default();
        timestamps.retain(|t| now.duration_since(*t) < window);

        if timestamps.len() >= max_attempts {
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

/// Tiered limiter for the authenticated API: heavy read paths
/// (exports, analytics, reports, print-data) get a tight budget; the
/// rest get a generous safety net that only trips on runaway clients.
pub async fn tiered_rate_limit_middleware(
    State(limiter): State<RateLimiter>,
    request: Request,
    next: Next,
) -> Response {
    let path = request.uri().path();
    let (class, max, window) = if path.starts_with("/api/reports")
        || path.starts_with("/api/analytics")
        || path.starts_with("/api/print-data")
        || path.contains("/export")
    {
        ("heavy", 30, 60)
    } else {
        ("api", 600, 60)
    };

    if let Some(ip) = extract_client_ip(&request) {
        if !limiter.check_and_record_class(ip, class, max, window) {
            return (
                StatusCode::TOO_MANY_REQUESTS,
                axum::Json(serde_json::json!({
                    "error": "too_many_requests",
                    "detail": "Request rate limit exceeded. Please slow down.",
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
