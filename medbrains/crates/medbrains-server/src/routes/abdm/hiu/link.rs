//! Pushed entries that carry a `link` instead of inline `content` (ABDM's
//! large-file mode): the encrypted content is fetched from the HIP, then
//! decrypted and checked exactly as inline content is.
//!
//! The URL comes from another facility, so it is fetched as untrusted: http
//! or https only, every address the host resolves to must be public (never
//! private, loopback, link-local, CGNAT or otherwise reserved), the
//! connection is pinned to the address checked (no DNS rebinding), redirects
//! are not followed, and the body is bounded in size and time.
//!
//! *Inferred*: the linked resource's body is the same base64 ciphertext an
//! inline `content` carries — ABDM's specification names the `link` field
//! but not its body.

use std::{
    borrow::Cow,
    net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr},
    time::Duration,
};

use medbrains_abdm::AbdmEnvironment;
use serde_json::Value;
use uuid::Uuid;

use super::scope::Refusal;
use crate::{error::AppError, routes::abdm::abha::stored_abdm_config, state::AppState};

/// Secret-store key letting a stand-in HIP on loopback through the guard —
/// tests and rehearsals only. Ignored when the hospital's ABDM is production.
pub const ABDM_HIU_LINK_ALLOW_LOOPBACK: &str = "ABDM_HIU_LINK_ALLOW_LOOPBACK";
/// The longest one linked file may take to arrive.
const LINK_TIMEOUT: Duration = Duration::from_secs(15);
/// The largest linked file accepted (encrypted, base64).
const MAX_LINK_BYTES: usize = 16 * 1024 * 1024;
/// Linked entries fetched per pushed page; more are refused.
const MAX_LINKS_PER_PAGE: usize = 10;

/// Whether `ip` is an address on the public internet.
#[must_use]
pub fn is_public(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => is_public_v4(v4),
        IpAddr::V6(v6) => is_public_v6(v6),
    }
}

fn is_public_v4(ip: Ipv4Addr) -> bool {
    let [a, b, c, _] = ip.octets();
    let reserved = a == 0                          // "this network"
        || (a == 100 && (64..128).contains(&b))   // CGNAT 100.64/10
        || (a == 192 && b == 0 && c == 0)          // IETF 192.0.0/24
        || (a == 198 && (b == 18 || b == 19))      // benchmarking 198.18/15
        || a >= 240; // reserved 240/4 and broadcast
    !(reserved
        || ip.is_private()
        || ip.is_loopback()
        || ip.is_link_local()
        || ip.is_unspecified()
        || ip.is_broadcast()
        || ip.is_documentation()
        || ip.is_multicast())
}

fn is_public_v6(ip: Ipv6Addr) -> bool {
    if let Some(v4) = ip.to_ipv4_mapped() {
        return is_public_v4(v4);
    }
    let s = ip.segments();
    // NAT64 (64:ff9b::/96) reaches the IPv4 address in its last 32 bits.
    if s[..6] == [0x64, 0xff9b, 0, 0, 0, 0] {
        let [hi, lo] = [s[6].to_be_bytes(), s[7].to_be_bytes()];
        return is_public_v4(Ipv4Addr::new(hi[0], hi[1], lo[0], lo[1]));
    }
    !(ip.is_loopback()
        || ip.is_unspecified()
        || ip.is_multicast()
        || (s[0] & 0xfe00) == 0xfc00    // unique local fc00::/7
        || (s[0] & 0xffc0) == 0xfe80    // link-local fe80::/10
        || (s[0] & 0xffc0) == 0xfec0    // site-local fec0::/10
        || (s[0] == 0x2001 && s[1] == 0x0db8)) // documentation
}

/// Whether the guard lets `ip` through.
fn allowed(ip: IpAddr, allow_loopback: bool) -> bool {
    is_public(ip) || (allow_loopback && ip.is_loopback())
}

/// Whether this hospital lets a loopback HIP through: only with the
/// override set, and never when its ABDM is production.
///
/// # Errors
/// A database fault.
pub async fn loopback_allowed(
    state: &AppState,
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
) -> Result<bool, AppError> {
    let asked = crate::routes::abdm::abha::dev_override(
        state.secret_resolver.as_ref(),
        ABDM_HIU_LINK_ALLOW_LOOPBACK,
    )
    .await
    .is_some_and(|v| v == "true");
    if !asked {
        return Ok(false);
    }
    let stored = stored_abdm_config(tx, &tenant_id).await?;
    let production = stored.environment == Some(AbdmEnvironment::Production)
        || std::env::var("ABDM_ENVIRONMENT").as_deref() == Ok("production");
    Ok(!production)
}

/// Where to connect for `url`: its host, and one checked address.
async fn target(
    url: &reqwest::Url,
    allow_loopback: bool,
) -> Result<(String, SocketAddr), &'static str> {
    if !matches!(url.scheme(), "http" | "https") {
        return Err("The link is not an http(s) address");
    }
    let host = url.host_str().ok_or("The link has no host")?;
    let port = url.port_or_known_default().ok_or("The link has no port")?;
    let bare = host.trim_start_matches('[').trim_end_matches(']');
    let addrs: Vec<SocketAddr> = if let Ok(ip) = bare.parse::<IpAddr>() {
        vec![SocketAddr::new(ip, port)]
    } else {
        tokio::time::timeout(LINK_TIMEOUT, tokio::net::lookup_host((bare, port)))
            .await
            .map_err(|_| "The link's host did not resolve in time")?
            .map_err(|_| "The link's host does not resolve")?
            .collect()
    };
    let first = *addrs.first().ok_or("The link's host does not resolve")?;
    if !addrs.iter().all(|a| allowed(a.ip(), allow_loopback)) {
        return Err("The link points to a private or local address");
    }
    Ok((bare.to_owned(), first))
}

/// Fetch one linked file: bounded, pinned to the checked address.
async fn fetch(link: &str, allow_loopback: bool) -> Result<String, &'static str> {
    let url = reqwest::Url::parse(link).map_err(|_| "The link is not a valid address")?;
    let (host, addr) = target(&url, allow_loopback).await?;
    let client = reqwest::Client::builder()
        .timeout(LINK_TIMEOUT)
        .redirect(reqwest::redirect::Policy::none())
        .resolve(&host, addr)
        .build()
        .map_err(|_| "The link could not be fetched")?;
    let mut response = client
        .get(url)
        .send()
        .await
        .map_err(|_| "The link could not be fetched")?;
    if !response.status().is_success() {
        return Err("The link did not return the content");
    }
    let too_big = "The linked content is too large";
    if response
        .content_length()
        .and_then(|n| usize::try_from(n).ok())
        .is_some_and(|n| n > MAX_LINK_BYTES)
    {
        return Err(too_big);
    }
    let mut body = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "The link could not be fetched")?
    {
        if body.len() + chunk.len() > MAX_LINK_BYTES {
            return Err(too_big);
        }
        body.extend_from_slice(&chunk);
    }
    String::from_utf8(body).map_err(|_| "The linked content is not text")
}

/// Each entry with its content inline: a linked entry fetched, an inline
/// one as it is. An entry that cannot be fetched is refused with why.
pub async fn inline_all(
    entries: &[Value],
    allow_loopback: bool,
) -> Vec<Result<Cow<'_, Value>, Refusal>> {
    let mut links = 0;
    let mut out = Vec::with_capacity(entries.len());
    for entry in entries {
        let Some(link) = entry["link"]
            .as_str()
            .filter(|_| entry["content"].is_null())
        else {
            out.push(Ok(Cow::Borrowed(entry)));
            continue;
        };
        links += 1;
        let fetched = if links > MAX_LINKS_PER_PAGE {
            Err("Too many linked entries in one page")
        } else {
            fetch(link, allow_loopback).await
        };
        out.push(match fetched {
            Ok(content) => {
                let mut e = entry.clone();
                e["content"] = Value::String(content.trim().to_owned());
                Ok(Cow::Owned(e))
            }
            Err(reason) => Err(Refusal {
                reference: entry["careContextReference"]
                    .as_str()
                    .unwrap_or_default()
                    .to_owned(),
                reason,
            }),
        });
    }
    out
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use std::net::IpAddr;

    use super::{allowed, is_public};

    fn ip(s: &str) -> IpAddr {
        s.parse().unwrap()
    }

    #[test]
    fn only_public_addresses_pass() {
        for public in [
            "8.8.8.8",
            "103.21.244.1",
            "2606:4700::1111",
            "::ffff:8.8.8.8",
        ] {
            assert!(is_public(ip(public)), "{public}");
        }
        for inside in [
            "127.0.0.1",
            "10.1.2.3",
            "172.16.0.1",
            "192.168.1.1",
            "169.254.169.254",
            "100.64.0.1",
            "0.0.0.0",
            "255.255.255.255",
            "224.0.0.1",
            "198.18.0.1",
            "::1",
            "::",
            "fd00::1",
            "fe80::1",
            "::ffff:10.0.0.1",
            "::ffff:127.0.0.1",
            "64:ff9b::a9fe:a9fe",
        ] {
            assert!(!is_public(ip(inside)), "{inside}");
        }
    }

    #[test]
    fn the_override_admits_loopback_and_nothing_else() {
        assert!(allowed(ip("127.0.0.1"), true));
        assert!(allowed(ip("::1"), true));
        assert!(!allowed(ip("127.0.0.1"), false));
        assert!(!allowed(ip("10.0.0.1"), true));
        assert!(!allowed(ip("169.254.169.254"), true));
    }
}
