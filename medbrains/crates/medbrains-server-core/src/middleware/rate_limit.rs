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
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};

use super::client_ip::ClientIp;

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

    if let Some(ip) = ip
        && !limiter.check_and_record(ip)
    {
        return (
            StatusCode::TOO_MANY_REQUESTS,
            axum::Json(serde_json::json!({
                "error": "too_many_requests",
                "detail": "Too many login attempts. Please try again later.",
            })),
        )
            .into_response();
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
    } else if path.starts_with("/api/radiology/pacs/") {
        // The image viewer fetches every frame of a study: one CT is hundreds
        // of requests, and a department shares one hospital IP. Each request
        // is still authorised per study.
        ("imaging", 12_000, 60)
    } else {
        ("api", 600, 60)
    };

    if let Some(ip) = extract_client_ip(&request)
        && !limiter.check_and_record_class(ip, class, max, window)
    {
        return (
            StatusCode::TOO_MANY_REQUESTS,
            axum::Json(serde_json::json!({
                "error": "too_many_requests",
                "detail": "Request rate limit exceeded. Please slow down.",
            })),
        )
            .into_response();
    }

    next.run(request).await
}

/// Browsing the public storefront, per IP per minute: generous for a person,
/// tight for a scraper. Inferred, not from a spec.
const STORE_BROWSE_PER_MINUTE: usize = 120;
/// Sign-in codes asked for or tried, per IP per minute — each one may send
/// an SMS.
const STORE_SIGN_IN_PER_MINUTE: usize = 5;

/// The public storefront: browsing is bounded, and asking for or trying a
/// sign-in code far more so.
pub async fn storefront_rate_limit_middleware(
    State(limiter): State<RateLimiter>,
    request: Request,
    next: Next,
) -> Response {
    let path = request.uri().path();
    let (class, max) = if path.ends_with("/otp") || path.ends_with("/sign-in") {
        ("store_sign_in", STORE_SIGN_IN_PER_MINUTE)
    } else {
        ("store_browse", STORE_BROWSE_PER_MINUTE)
    };
    if let Some(ip) = extract_client_ip(&request)
        && !limiter.check_and_record_class(ip, class, max, WINDOW_SECS)
    {
        return (
            StatusCode::TOO_MANY_REQUESTS,
            axum::Json(serde_json::json!({
                "error": "too_many_requests",
                "detail": "Too many requests. Please wait a minute and try again.",
            })),
        )
            .into_response();
    }
    next.run(request).await
}

/// Public verify checks (the QR on a prescription or a signed document), per
/// IP per minute. A counter scanning a pile of papers stays well under it; a
/// script trying tokens does not. Inferred, not from a spec.
const PUBLIC_VERIFY_PER_MINUTE: usize = 30;

/// The public verify pages: anybody may ask, nobody may ask fast. The tokens
/// are 256 random bits, so this bounds the cost of guessing rather than being
/// what stops it.
pub async fn public_verify_rate_limit_middleware(
    State(limiter): State<RateLimiter>,
    request: Request,
    next: Next,
) -> Response {
    if let Some(ip) = extract_client_ip(&request)
        && !limiter.check_and_record_class(
            ip,
            "public_verify",
            PUBLIC_VERIFY_PER_MINUTE,
            WINDOW_SECS,
        )
    {
        return (
            StatusCode::TOO_MANY_REQUESTS,
            axum::Json(serde_json::json!({
                "error": "too_many_requests",
                "detail": "Too many checks. Please wait a minute and try again.",
            })),
        )
            .into_response();
    }
    next.run(request).await
}

/// Pairing codes a screen may ask for, per IP per minute. A screen asks once
/// every 15 minutes while it waits; a hospital switching on a new floor of
/// screens behind one address stays under it. Inferred, not from a spec.
const PAIRING_CODES_PER_MINUTE: usize = 20;
/// Other pre-credential pairing calls (polls, token and QR redemption), per IP
/// per minute. A waiting screen polls every 5 seconds, 12 a minute, so this
/// is twenty screens pairing at once from one address.
const PAIRING_CALLS_PER_MINUTE: usize = 240;

/// The budget a pre-credential pairing call is counted against: asking for a
/// new code is tight, polling and redeeming are not.
fn pairing_budget(path: &str) -> (&'static str, usize) {
    if path.ends_with("/device-code") {
        ("pairing_code", PAIRING_CODES_PER_MINUTE)
    } else {
        ("pairing", PAIRING_CALLS_PER_MINUTE)
    }
}

/// The device pairing routes a device reaches before it has credentials:
/// anybody may ask, nobody may ask fast.
pub async fn device_pairing_rate_limit_middleware(
    State(limiter): State<RateLimiter>,
    request: Request,
    next: Next,
) -> Response {
    let (class, max) = pairing_budget(request.uri().path());
    if let Some(ip) = extract_client_ip(&request)
        && !limiter.check_and_record_class(ip, class, max, WINDOW_SECS)
    {
        return (
            StatusCode::TOO_MANY_REQUESTS,
            axum::Json(serde_json::json!({
                "error": "too_many_requests",
                "detail": "Too many pairing requests. Please wait a minute and try again.",
            })),
        )
            .into_response();
    }
    next.run(request).await
}

/// The address worked out by `client_ip_middleware`, never read from headers here.
fn extract_client_ip(request: &Request) -> Option<IpAddr> {
    request.extensions().get::<ClientIp>().map(|ip| ip.0)
}

#[cfg(test)]
mod tests {
    use super::{PAIRING_CALLS_PER_MINUTE, PAIRING_CODES_PER_MINUTE, pairing_budget};

    #[test]
    fn asking_for_a_pairing_code_is_counted_apart_and_tighter() {
        assert_eq!(
            pairing_budget("/api/device-pairing/device-code"),
            ("pairing_code", PAIRING_CODES_PER_MINUTE)
        );
        for path in [
            "/api/device-pairing/device-token",
            "/api/device-pairing/pair",
        ] {
            assert_eq!(pairing_budget(path), ("pairing", PAIRING_CALLS_PER_MINUTE));
        }
        assert!(PAIRING_CODES_PER_MINUTE < PAIRING_CALLS_PER_MINUTE);
    }
}
