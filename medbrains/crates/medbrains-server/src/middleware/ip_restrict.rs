//! IP-based access restriction middleware — the optional network access layer
//! (LAN / VPN). Checks the request IP against the tenant's `allowed_ips` and
//! `blocked_ips` CIDR lists: DENY wins, then the allowlist (empty allowlist = no
//! restriction). Both empty = fully open (opt-in; most on-LAN hospitals set
//! neither). Runs after auth (needs Claims for the tenant); bypass roles skip.
//! Tailscale/corporate-VPN CIDRs go in `allowed_ips`.

use std::net::IpAddr;

use axum::{
    extract::{ConnectInfo, Request, State},
    middleware::Next,
    response::Response,
};
use sqlx::PgPool;

use crate::{error::AppError, middleware::auth::Claims, state::AppState};

/// Check whether an IP address matches a CIDR range string.
///
/// Supports both IPv4 (`10.0.0.0/8`) and IPv6 (`::1/128`).
fn ip_in_cidr(ip: IpAddr, cidr: &str) -> bool {
    let Some((network_str, prefix_str)) = cidr.split_once('/') else {
        // No prefix — exact match
        return cidr.parse::<IpAddr>().is_ok_and(|a| a == ip);
    };

    let Ok(network) = network_str.parse::<IpAddr>() else {
        return false;
    };

    let Ok(prefix_len) = prefix_str.parse::<u32>() else {
        return false;
    };

    match (ip, network) {
        (IpAddr::V4(ip4), IpAddr::V4(net4)) => {
            if prefix_len > 32 {
                return false;
            }
            if prefix_len == 0 {
                return true;
            }
            let mask = u32::MAX << (32 - prefix_len);
            (u32::from(ip4) & mask) == (u32::from(net4) & mask)
        }
        (IpAddr::V6(ip6), IpAddr::V6(net6)) => {
            if prefix_len > 128 {
                return false;
            }
            if prefix_len == 0 {
                return true;
            }
            let mask = u128::MAX << (128 - prefix_len);
            (u128::from(ip6) & mask) == (u128::from(net6) & mask)
        }
        _ => false, // mismatched IP versions
    }
}

/// A tenant's optional network rules: an allowlist and a denylist of CIDRs.
struct IpRules {
    allowed: Vec<String>,
    blocked: Vec<String>,
}

fn json_to_cidrs(v: &serde_json::Value) -> Vec<String> {
    v.as_array()
        .map(|a| {
            a.iter()
                .filter_map(serde_json::Value::as_str)
                .map(String::from)
                .collect()
        })
        .unwrap_or_default()
}

/// Load a tenant's allow + deny CIDR lists in one query.
async fn load_ip_rules(db: &PgPool, tenant_id: uuid::Uuid) -> Result<IpRules, AppError> {
    let row: Option<(serde_json::Value, serde_json::Value)> =
        sqlx::query_as("SELECT allowed_ips, blocked_ips FROM tenants WHERE id = $1")
            .bind(tenant_id)
            .fetch_optional(db)
            .await?;

    let Some((allowed, blocked)) = row else {
        return Ok(IpRules { allowed: Vec::new(), blocked: Vec::new() });
    };
    Ok(IpRules {
        allowed: json_to_cidrs(&allowed),
        blocked: json_to_cidrs(&blocked),
    })
}

/// Access decision: DENY wins (a blocked CIDR is rejected even if also allowed);
/// then the allowlist (an empty allowlist imposes no restriction). Pure + tested.
fn ip_allowed(ip: IpAddr, rules: &IpRules) -> bool {
    if rules.blocked.iter().any(|cidr| ip_in_cidr(ip, cidr)) {
        return false;
    }
    rules.allowed.is_empty() || rules.allowed.iter().any(|cidr| ip_in_cidr(ip, cidr))
}

/// Middleware that enforces tenant IP restrictions.
///
/// Must run after auth middleware (requires Claims in extensions).
/// Bypass roles (`super_admin`) are not restricted.
pub async fn ip_restrict_middleware(
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Result<Response, AppError> {
    // Only check if we have authenticated claims
    let Some(claims) = request.extensions().get::<Claims>().cloned() else {
        return Ok(next.run(request).await);
    };

    // Bypass roles skip IP checks
    if super::authorization::is_bypass_role(&claims) {
        return Ok(next.run(request).await);
    }

    let client_ip = extract_ip(&request);

    let Some(ip) = client_ip else {
        return Ok(next.run(request).await);
    };

    let rules = load_ip_rules(&state.db, claims.tenant_id).await?;

    // No lists configured = no restriction (opt-in).
    if rules.allowed.is_empty() && rules.blocked.is_empty() {
        return Ok(next.run(request).await);
    }

    if ip_allowed(ip, &rules) {
        Ok(next.run(request).await)
    } else {
        tracing::warn!(tenant = %claims.tenant_id, %ip, "request rejected by tenant IP rules");
        Err(AppError::Forbidden)
    }
}

/// Extract client IP from request headers/extensions.
fn extract_ip(request: &Request) -> Option<IpAddr> {
    if let Some(ci) = request
        .extensions()
        .get::<ConnectInfo<std::net::SocketAddr>>()
    {
        return Some(ci.0.ip());
    }

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

#[cfg(test)]
mod tests {
    use super::{ip_allowed, ip_in_cidr, IpRules};

    fn ip(s: &str) -> std::net::IpAddr {
        s.parse()
            .unwrap_or(std::net::IpAddr::V4(std::net::Ipv4Addr::UNSPECIFIED))
    }
    fn rules(allowed: &[&str], blocked: &[&str]) -> IpRules {
        IpRules {
            allowed: allowed.iter().map(|s| (*s).to_owned()).collect(),
            blocked: blocked.iter().map(|s| (*s).to_owned()).collect(),
        }
    }

    #[test]
    fn cidr_matching() {
        assert!(ip_in_cidr(ip("10.5.5.5"), "10.0.0.0/8"));
        assert!(!ip_in_cidr(ip("11.0.0.1"), "10.0.0.0/8"));
        assert!(ip_in_cidr(ip("192.168.1.7"), "192.168.1.7")); // exact, no prefix
    }

    #[test]
    fn empty_rules_allow_everything() {
        assert!(ip_allowed(ip("1.2.3.4"), &rules(&[], &[])));
    }

    #[test]
    fn deny_wins_over_allow() {
        let r = rules(&["10.0.0.0/8"], &["10.1.2.3/32"]);
        assert!(ip_allowed(ip("10.5.5.5"), &r)); // in allowlist, not blocked
        assert!(!ip_allowed(ip("10.1.2.3"), &r)); // blocked wins even though in allow range
        assert!(!ip_allowed(ip("192.168.1.1"), &r)); // not in allowlist
    }

    #[test]
    fn denylist_only_blocks_listed() {
        let r = rules(&[], &["1.2.3.0/24"]);
        assert!(!ip_allowed(ip("1.2.3.9"), &r)); // blocked
        assert!(ip_allowed(ip("9.9.9.9"), &r)); // not blocked, empty allow = allowed
    }
}
