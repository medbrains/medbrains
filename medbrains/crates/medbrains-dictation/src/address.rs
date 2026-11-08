//! Which addresses the "local" services may name. The speech server and the
//! model are on the hospital's own machine or its own network, so their
//! addresses must be loopback or private (RFC 1918 / IPv6 unique-local),
//! written as an IP literal or `localhost`. A host name is refused: what it
//! resolves to can change after it was checked. Link-local addresses are
//! refused altogether: that is where cloud metadata and credential services
//! live (169.254.169.254, 169.254.170.2), and the AWS IPv6 metadata address
//! (`fd00:ec2::254`) is refused although it is unique-local.

use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};

/// The AWS instance metadata service's IPv6 address (inside `fc00::/7`).
const METADATA_V6: Ipv6Addr = Ipv6Addr::new(0xfd00, 0x0ec2, 0, 0, 0, 0, 0, 0x0254);

/// Whether `url` is an `http(s)://` address on this machine or the
/// hospital's own network.
#[must_use]
pub fn is_local_url(url: &str) -> bool {
    host_of(url).is_some_and(|host| host == "localhost" || host.parse().is_ok_and(is_local_ip))
}

/// The host of an `http(s)://host[:port][/path]` address, or `None` when the
/// address is malformed or carries user info (`user@host` hides the real host).
fn host_of(url: &str) -> Option<&str> {
    let rest = url
        .strip_prefix("http://")
        .or_else(|| url.strip_prefix("https://"))?;
    let authority = rest.split(['/', '?', '#']).next()?;
    if authority.is_empty() || authority.contains('@') {
        return None;
    }
    let (host, port) = match authority.strip_prefix('[') {
        Some(v6) => {
            let (host, after) = v6.split_once(']')?;
            (host, after.strip_prefix(':'))
        }
        None => match authority.split_once(':') {
            Some((host, port)) => (host, Some(port)),
            None => (authority, None),
        },
    };
    let port_ok =
        port.is_none_or(|p| !p.is_empty() && p.len() <= 5 && p.bytes().all(|b| b.is_ascii_digit()));
    (!host.is_empty() && port_ok).then_some(host)
}

/// Loopback or private, never unspecified, link-local or a metadata service.
fn is_local_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => is_local_v4(v4),
        IpAddr::V6(v6) => v6
            .to_ipv4_mapped()
            .map_or_else(|| is_local_v6(v6), is_local_v4),
    }
}

/// 127/8, 10/8, 172.16/12, 192.168/16.
const fn is_local_v4(ip: Ipv4Addr) -> bool {
    ip.is_loopback() || ip.is_private()
}

/// `::1` and unique-local `fc00::/7`, except the AWS metadata address.
fn is_local_v6(ip: Ipv6Addr) -> bool {
    ip != METADATA_V6 && (ip.is_loopback() || (ip.segments()[0] & 0xfe00) == 0xfc00)
}

#[cfg(test)]
mod tests {
    use super::is_local_url;

    #[test]
    fn the_hospitals_own_addresses_are_local() {
        for url in [
            "http://127.0.0.1:8178",
            "http://localhost:11434",
            "http://10.2.3.4:8080/x",
            "http://172.16.0.9",
            "http://192.168.1.20:8178",
            "http://[::1]:8178",
            "http://[fd12::1]",
        ] {
            assert!(is_local_url(url), "{url}");
        }
    }

    #[test]
    fn anywhere_else_is_refused() {
        for url in [
            "http://169.254.169.254/latest/meta-data",
            "http://169.254.170.2/v2/credentials",
            "http://169.254.10.1",
            "http://[fd00:ec2::254]",
            "http://[fe80::1]",
            "http://8.8.8.8",
            "http://stt.example.com",
            "http://127.0.0.1.nip.io",
            "http://evil.example@127.0.0.1",
            "http://0.0.0.0:8178",
            "http://[::ffff:169.254.169.254]",
            "http://172.32.0.1",
            "ftp://127.0.0.1",
            "http://",
            "http://127.0.0.1:port",
        ] {
            assert!(!is_local_url(url), "{url}");
        }
    }
}
