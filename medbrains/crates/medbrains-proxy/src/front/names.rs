//! What a client may call this machine, and every decision that follows from it: where a redirect
//! points, and which Host the server gets to believe. Pure functions.

use std::collections::HashSet;
use std::net::{IpAddr, Ipv6Addr};

/// The set of names and addresses this machine answers to, the same set its certificate covers.
#[derive(Debug, Clone)]
pub(crate) struct Names {
    /// Lowercase, addresses in their canonical text, IPv6 without brackets.
    known: HashSet<String>,
    /// Stands in for a Host outside the set; the first name in the file.
    fallback: String,
}

impl Names {
    /// Reads names, one per line. Returns `None` when no valid name is left.
    pub(crate) fn parse(text: &str) -> Option<Self> {
        let mut known = HashSet::new();
        let mut fallback = None;
        for line in text.lines().map(str::trim).filter(|line| !line.is_empty()) {
            let Some(name) = parse_host(line) else {
                continue;
            };
            let name = name.to_ascii_lowercase();
            fallback.get_or_insert_with(|| name.clone());
            known.insert(name);
        }
        Some(Self {
            known,
            fallback: fallback?,
        })
    }

    /// True if `host`, with no port, belongs to this machine.
    fn contains(&self, host: &str) -> bool {
        self.known.contains(&host.to_ascii_lowercase())
    }

    /// The Host value the server may believe: the client's when it is ours, otherwise our own.
    ///
    /// The server builds links from it, so a forged Host must not reach an emailed reset link.
    pub(crate) fn trusted_host<'a>(&'a self, header: Option<&'a str>) -> &'a str {
        match header {
            Some(value) if parse_host(value).is_some_and(|host| self.contains(host)) => value,
            _ => &self.fallback,
        }
    }

    /// Where a plain HTTP request is sent. Only ever a name of ours or the address it arrived on,
    /// so the Host header cannot aim the redirect at another site.
    pub(crate) fn redirect_location(
        &self,
        header: Option<&str>,
        local: Option<IpAddr>,
        target: &str,
    ) -> String {
        let path = if target.starts_with('/') { target } else { "/" };
        let host = header
            .and_then(parse_host)
            .filter(|host| self.contains(host));
        match (host, local) {
            (Some(host), _) => format!("https://{}{path}", bracketed(host)),
            (None, Some(local)) => format!("https://{}{path}", bracketed(&local.to_string())),
            (None, None) => format!("https://{}{path}", bracketed(&self.fallback)),
        }
    }
}

/// An IPv6 literal in a URL needs brackets; nothing else does.
fn bracketed(host: &str) -> String {
    if host.contains(':') {
        format!("[{host}]")
    } else {
        host.to_owned()
    }
}

/// The host part of a Host header, or of a line of the names file: a DNS name, an IPv4 address or
/// a bracketed IPv6 address, with an optional valid port. `None` for anything else.
pub(crate) fn parse_host(value: &str) -> Option<&str> {
    if let Some(rest) = value.strip_prefix('[') {
        let (inner, after) = rest.split_once(']')?;
        inner.parse::<Ipv6Addr>().ok()?;
        return port_is_valid(after.strip_prefix(':'), after.is_empty()).then_some(inner);
    }
    if value.parse::<Ipv6Addr>().is_ok() {
        return Some(value);
    }
    let (host, port) = match value.split_once(':') {
        Some((host, port)) => (host, Some(port)),
        None => (value, None),
    };
    let valid = is_dns_name(host) && port_is_valid(port, port.is_none());
    valid.then_some(host)
}

/// `parse_host` for raw header bytes.
pub(crate) fn parse_host_bytes(value: &[u8]) -> Option<&str> {
    parse_host(std::str::from_utf8(value).ok()?)
}

/// True if a port is absent where allowed, or is a number that fits.
fn port_is_valid(port: Option<&str>, absent_allowed: bool) -> bool {
    port.map_or(absent_allowed, |port| {
        !port.starts_with('+') && port.parse::<u16>().is_ok()
    })
}

/// True for dot-separated labels of letters, digits and hyphens, 253 bytes at most.
fn is_dns_name(host: &str) -> bool {
    const MAX_NAME: usize = 253;
    let is_label = |label: &str| {
        !label.is_empty()
            && !label.starts_with('-')
            && label
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
    };
    host.len() <= MAX_NAME && host.split('.').all(is_label)
}

/// The path a rule is matched on: decoded, with `.`, `..`, empty segments and backslashes resolved
/// and lower-cased, so `/%73CIM/x` and `//a/../scim/x` cannot walk past a block on `/scim/`.
///
/// Decodes up to three times, then treats whatever is still encoded as suspect: `None`.
pub(crate) fn normalize_path(path: &str) -> Option<String> {
    const MAX_DECODES: usize = 3;
    let mut decoded = path.as_bytes().to_vec();
    for _ in 0..MAX_DECODES {
        if !decoded.contains(&b'%') {
            break;
        }
        let next = percent_decode(&decoded);
        if next == decoded {
            break;
        }
        decoded = next;
    }
    if has_percent_escape(&decoded) || decoded.contains(&0) {
        return None;
    }
    let text = String::from_utf8_lossy(&decoded).replace('\\', "/");
    let mut segments: Vec<&str> = Vec::new();
    for segment in text.split('/') {
        match segment {
            "" | "." => {}
            ".." => {
                segments.pop();
            }
            other => segments.push(other),
        }
    }
    let mut normal = format!("/{}", segments.join("/"));
    if text.ends_with('/') && normal.len() > 1 {
        normal.push('/');
    }
    Some(normal.to_ascii_lowercase())
}

/// The value of one hex digit.
fn hex_value(byte: Option<&u8>) -> Option<u8> {
    let digit = (*byte? as char).to_digit(16)?;
    u8::try_from(digit).ok()
}

/// True if a `%` followed by two hex digits remains.
fn has_percent_escape(input: &[u8]) -> bool {
    input.windows(3).any(|window| {
        window.first() == Some(&b'%')
            && hex_value(window.get(1)).is_some()
            && hex_value(window.get(2)).is_some()
    })
}

/// One pass of percent-decoding; a `%` with no two hex digits stays as it is.
fn percent_decode(input: &[u8]) -> Vec<u8> {
    let mut output = Vec::with_capacity(input.len());
    let mut index = 0;
    while let Some(byte) = input.get(index) {
        let pair = (
            hex_value(input.get(index + 1)),
            hex_value(input.get(index + 2)),
        );
        if let (b'%', (Some(high), Some(low))) = (*byte, pair) {
            output.push(high * 16 + low);
            index += 3;
        } else {
            output.push(*byte);
            index += 1;
        }
    }
    output
}

/// A client address in one form: an IPv4 client on a dual-stack socket arrives as `::ffff:a.b.c.d`,
/// and the server stores what it gets, so the same machine must not become two addresses.
pub(crate) const fn canonical_ip(ip: IpAddr) -> IpAddr {
    ip.to_canonical()
}

#[cfg(test)]
#[path = "names_tests.rs"]
mod tests;
