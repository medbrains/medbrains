//! The rule for who a client is, given the connecting address and forwarded headers. Standard library
//! and `ipnet` only, because `medbrains-front`'s tests compile this very file: what the proxy sends is
//! checked against what the server does, not against a copy of it.

use std::net::IpAddr;

/// The client's address, from the connecting address and any forwarded headers.
pub(super) fn resolve_client(
    direct: IpAddr,
    forwarded_for: Option<&str>,
    real_ip: Option<&str>,
    trusted: &[ipnet::IpNet],
) -> IpAddr {
    let vouched = |ip: &IpAddr| trusted.iter().any(|net| net.contains(ip));
    if !vouched(&direct) {
        return direct;
    }
    let Some(chain) = forwarded_for else {
        return real_ip.and_then(parse_hop).unwrap_or(direct);
    };
    let mut client = direct;
    for hop in chain.rsplit(',') {
        let Some(ip) = parse_hop(hop) else { break };
        client = ip;
        if !vouched(&ip) {
            break;
        }
    }
    client
}

/// One forwarded address. Some proxies send `1.2.3.4:5678` or `[::1]:5678`.
fn parse_hop(raw: &str) -> Option<IpAddr> {
    let raw = raw.trim();
    raw.parse::<std::net::SocketAddr>()
        .map(|socket| socket.ip())
        .or_else(|_| raw.parse())
        .ok()
}
