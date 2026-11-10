use std::net::IpAddr;

use axum::{
    extract::{ConnectInfo, Request, State},
    middleware::Next,
    response::Response,
};

use crate::state::AppState;

#[path = "client_resolve.rs"]
mod client_resolve;
use client_resolve::resolve_client;

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

/// Works out the client's address and stores it as `ClientIp`.
///
/// The connecting address is the only fact here. Forwarded headers are believed only when that
/// address is a listed proxy, and only back to the first hop no listed proxy vouches for, because
/// anything further left was written by the client. With no proxies listed, none are believed.
/// `TRUSTED_PROXIES` is a comma-separated list of CIDRs.
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

/// The connecting address, or nothing if the server was started without connection info.
fn extract_client_ip(request: &Request, trusted_proxies: &[ipnet::IpNet]) -> Option<IpAddr> {
    let direct = request
        .extensions()
        .get::<ConnectInfo<std::net::SocketAddr>>()?
        .0
        .ip();
    let header = |name: &str| request.headers().get(name).and_then(|v| v.to_str().ok());
    Some(resolve_client(
        direct,
        header("x-forwarded-for"),
        header("x-real-ip"),
        trusted_proxies,
    ))
}

#[cfg(test)]
mod tests {
    use super::client_resolve::resolve_client;
    use std::net::IpAddr;

    const PROXY: &str = "127.0.0.1";
    const CLIENT: &str = "203.0.113.7";
    const FORGED: &str = "198.51.100.1";

    fn ip(raw: &str) -> IpAddr {
        raw.parse().expect("test address")
    }

    fn proxies() -> Vec<ipnet::IpNet> {
        vec![
            "127.0.0.1/32".parse().expect("test network"),
            "10.0.0.0/8".parse().expect("test network"),
        ]
    }

    #[test]
    fn a_direct_client_cannot_forge_its_address() {
        let got = resolve_client(ip(CLIENT), Some(FORGED), Some(FORGED), &proxies());
        assert_eq!(got, ip(CLIENT));
    }

    #[test]
    fn no_listed_proxies_means_no_header_is_believed() {
        assert_eq!(
            resolve_client(ip(PROXY), Some(FORGED), None, &[]),
            ip(PROXY)
        );
    }

    #[test]
    fn a_forged_entry_left_of_the_real_client_is_ignored() {
        let chain = format!("{FORGED}, {CLIENT}, 10.0.0.2");
        assert_eq!(
            resolve_client(ip(PROXY), Some(&chain), None, &proxies()),
            ip(CLIENT)
        );
    }

    #[test]
    fn garbage_in_the_chain_stops_the_walk() {
        let chain = format!("{FORGED}, not-an-ip, {CLIENT}");
        assert_eq!(
            resolve_client(ip(PROXY), Some(&chain), None, &proxies()),
            ip(CLIENT)
        );
    }

    #[test]
    fn a_chain_of_only_proxies_gives_the_furthest_one() {
        assert_eq!(
            resolve_client(ip(PROXY), Some("10.0.0.2, 10.0.0.3"), None, &proxies()),
            ip("10.0.0.2")
        );
    }

    #[test]
    fn socket_forms_reduce_to_the_address() {
        for (raw, want) in [
            ("[2001:db8::1]:443", "2001:db8::1"),
            ("203.0.113.7:53579", CLIENT),
        ] {
            assert_eq!(
                resolve_client(ip(PROXY), Some(raw), None, &proxies()),
                ip(want)
            );
        }
    }

    #[test]
    fn real_ip_is_used_only_from_a_proxy_and_without_a_chain() {
        assert_eq!(
            resolve_client(ip(PROXY), None, Some(CLIENT), &proxies()),
            ip(CLIENT)
        );
        assert_eq!(
            resolve_client(ip(PROXY), None, Some("junk"), &proxies()),
            ip(PROXY)
        );
    }
}
