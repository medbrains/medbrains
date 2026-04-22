use std::net::IpAddr;

use axum::{
    extract::{ConnectInfo, Request, State},
    middleware::Next,
    response::Response,
};

use crate::state::AppState;

/// Newtype wrapper for client IP address stored in request extensions.
///
/// Routes can extract this via `Extension<ClientIp>` to get the client's IP
/// for audit logging, rate limiting, or other purposes.
#[derive(Debug, Clone, Copy)]
pub struct ClientIp(pub IpAddr);

impl ClientIp {
    /// Get the IP address as a string for database storage.
    #[must_use]
    pub fn as_str(&self) -> String {
        self.0.to_string()
    }
}

/// Middleware that extracts the client IP from the request and stores it
/// in request extensions as `ClientIp`.
///
/// # Security Model
///
/// This middleware implements a secure proxy trust model:
///
/// 1. Get direct connection IP from `ConnectInfo<SocketAddr>`
/// 2. Check if direct IP is from a trusted proxy (configured via `TRUSTED_PROXIES`)
/// 3. If from trusted proxy, parse `X-Forwarded-For` or `X-Real-IP` header
/// 4. If NOT from trusted proxy, use direct connection IP (ignore headers)
///
/// This prevents IP spoofing attacks where a malicious client sets fake
/// `X-Forwarded-For` headers to bypass rate limiting or IP allowlisting.
///
/// # Configuration
///
/// Set `TRUSTED_PROXIES` env var to a comma-separated list of CIDRs:
/// ```text
/// TRUSTED_PROXIES=10.0.0.0/8,172.16.0.0/12,192.168.0.0/16
/// ```
///
/// Common trusted proxy ranges:
/// - Docker: `172.17.0.0/16`
/// - Kubernetes: `10.0.0.0/8`
/// - AWS ALB/ELB: Varies by region, consult AWS documentation
/// - Cloudflare: See https://www.cloudflare.com/ips/
pub async fn client_ip_middleware(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Response {
    if let Some(ip) = extract_client_ip(&request, &state.trusted_proxies) {
        request.extensions_mut().insert(ClientIp(ip));
    }
    next.run(request).await
}

/// Extract client IP from request with trusted proxy validation.
fn extract_client_ip(request: &Request, trusted_proxies: &[ipnet::IpNet]) -> Option<IpAddr> {
    // Get direct connection IP
    let direct_ip = request
        .extensions()
        .get::<ConnectInfo<std::net::SocketAddr>>()
        .map(|ci| ci.0.ip());

    let Some(direct) = direct_ip else {
        // No direct connection info available (shouldn't happen in production)
        // Fall back to header parsing (less secure)
        return parse_forwarded_headers(request);
    };

    // Check if direct connection is from a trusted proxy
    let is_trusted = trusted_proxies.is_empty() || // Empty = trust all (legacy mode)
        trusted_proxies.iter().any(|net| net.contains(&direct));

    if is_trusted {
        // Trusted proxy: parse X-Forwarded-For to get real client IP
        parse_forwarded_headers(request).or(Some(direct))
    } else {
        // Untrusted source: use direct connection IP, ignore headers
        Some(direct)
    }
}

/// Parse X-Forwarded-For or X-Real-IP headers.
fn parse_forwarded_headers(request: &Request) -> Option<IpAddr> {
    // Try X-Forwarded-For header
    // Format: "client, proxy1, proxy2" - take the first (original client)
    if let Some(fwd) = request
        .headers()
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
    {
        if let Some(first) = fwd.split(',').next() {
            if let Ok(ip) = first.trim().parse::<IpAddr>() {
                return Some(ip);
            }
        }
    }

    // Try X-Real-IP header (nginx default)
    if let Some(real) = request
        .headers()
        .get("x-real-ip")
        .and_then(|v| v.to_str().ok())
    {
        if let Ok(ip) = real.trim().parse::<IpAddr>() {
            return Some(ip);
        }
    }

    None
}
