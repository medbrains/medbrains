//! Slows repeated sign-ins at the OS image's TLS front.
//!
//! Debian's Caddy has no rate limit module, so its `forward_auth` asks this process before passing
//! a sign-in to the identity provider. A 200 lets the request through; Caddy hands a 429 to the
//! client. Caddy sets `X-Forwarded-For` itself and trusts no proxy, so a client cannot choose its
//! address. Loopback only, one thread, no state on disk; a restart forgets the counts.
//!
//! Two buckets, and a request needs a token from both. The session bucket stops guessing inside
//! one sign-in without touching anyone else. The address bucket stops a client that opens a new
//! session for each guess; it is large because a ward can share one address. A client that keeps
//! it empty does slow the others behind that address, as any limit by address must. The `MedBrains`
//! server's own password limit is far stricter: 5 attempts a minute per address.

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::net::{IpAddr, Ipv6Addr, TcpListener, TcpStream};
use std::time::{Duration, Instant};

const LISTEN: &str = "127.0.0.1:3101";
const SESSION_COOKIE: &str = "FERRISKEY_SESSION=";
/// Attempts one sign-in session may make at once, and how many it regains a minute.
const SESSION_LIMIT: Limit = Limit {
    burst: 5.0,
    per_minute: 5.0,
};
/// The same for one address: a ward's shift change at once, then one attempt every two seconds.
const ADDRESS_LIMIT: Limit = Limit {
    burst: 60.0,
    per_minute: 30.0,
};
/// Buckets kept before empty memory is reclaimed; an address or session costs about 100 bytes.
const MAX_TRACKED: usize = 10_000;
const MAX_HEADER_LINES: usize = 64;
const MAX_LINE_BYTES: u64 = 8 * 1024;
const READ_TIMEOUT: Duration = Duration::from_secs(1);

/// How fast one kind of bucket drains and refills.
#[derive(Clone, Copy)]
struct Limit {
    burst: f64,
    per_minute: f64,
}

/// Tokens left, as of the last time they were counted.
#[derive(Clone, Copy)]
struct Bucket {
    tokens: f64,
    refilled_at: Instant,
}

/// Who a request came from, as Caddy reported it.
#[derive(Debug, PartialEq)]
struct Caller {
    address: Option<IpAddr>,
    session: Option<String>,
}

/// Every bucket, by address and by sign-in session.
#[derive(Default)]
struct Limiter {
    addresses: HashMap<IpAddr, Bucket>,
    sessions: HashMap<String, Bucket>,
}

/// The tokens a bucket holds at `now`.
fn tokens_at(bucket: Bucket, limit: Limit, now: Instant) -> f64 {
    let regained = now.duration_since(bucket.refilled_at).as_secs_f64() * limit.per_minute / 60.0;
    (bucket.tokens + regained).min(limit.burst)
}

/// Seconds until a bucket holds one token; zero when it already does.
fn wait_seconds(tokens: f64, limit: Limit) -> u64 {
    if tokens >= 1.0 {
        0
    } else {
        ((1.0 - tokens) * 60.0 / limit.per_minute).ceil() as u64
    }
}

/// The bucket for `key`, refilled to `now`, reclaiming full ones when the map is at its bound.
fn refreshed<K: std::hash::Hash + Eq + Clone>(
    map: &mut HashMap<K, Bucket>,
    key: &K,
    limit: Limit,
    now: Instant,
) -> f64 {
    if map.len() >= MAX_TRACKED && !map.contains_key(key) {
        map.retain(|_, b| tokens_at(*b, limit, now) < limit.burst);
        // ponytail: past MAX_TRACKED live buckets everyone starts again; per-key expiry if a LAN gets there.
        if map.len() >= MAX_TRACKED {
            map.clear();
        }
    }
    let bucket = map.entry(key.clone()).or_insert(Bucket {
        tokens: limit.burst,
        refilled_at: now,
    });
    bucket.tokens = tokens_at(*bucket, limit, now);
    bucket.refilled_at = now;
    bucket.tokens
}

impl Limiter {
    /// Seconds the caller must wait, or `None` when the attempt may go ahead. A refused attempt
    /// costs nothing, so a client hammering a closed door does not push its own wait further out.
    fn check(&mut self, caller: &Caller, now: Instant) -> Option<u64> {
        // No address means Caddy did not send one, which only this machine could do. So does
        // loopback: it is the MedBrains server redeeming a sign-in code at the token endpoint.
        let address = caller.address.filter(|a| !is_loopback(*a))?;
        let address = group_key(address);
        let from_address = refreshed(&mut self.addresses, &address, ADDRESS_LIMIT, now);
        let from_session = caller
            .session
            .as_ref()
            .map(|s| refreshed(&mut self.sessions, s, SESSION_LIMIT, now));
        let wait = wait_seconds(from_address, ADDRESS_LIMIT)
            .max(from_session.map_or(0, |t| wait_seconds(t, SESSION_LIMIT)));
        if wait > 0 {
            return Some(wait);
        }
        if let Some(bucket) = self.addresses.get_mut(&address) {
            bucket.tokens -= 1.0;
        }
        if let Some(bucket) = caller
            .session
            .as_ref()
            .and_then(|s| self.sessions.get_mut(s))
        {
            bucket.tokens -= 1.0;
        }
        None
    }
}

/// True for this machine itself, in either address family.
fn is_loopback(address: IpAddr) -> bool {
    match address {
        IpAddr::V4(v4) => v4.is_loopback(),
        IpAddr::V6(v6) => {
            v6.is_loopback() || v6.to_ipv4_mapped().is_some_and(|v4| v4.is_loopback())
        }
    }
}

/// One machine holds a whole IPv6 /64, so that is the unit it is counted by.
fn group_key(address: IpAddr) -> IpAddr {
    match address {
        IpAddr::V4(_) => address,
        IpAddr::V6(v6) => {
            let mut octets = v6.octets();
            octets[8..].fill(0);
            IpAddr::V6(Ipv6Addr::from(octets))
        }
    }
}

/// Reads who is asking from the header lines Caddy sent.
fn parse_caller<I: Iterator<Item = String>>(lines: I) -> Caller {
    let mut caller = Caller {
        address: None,
        session: None,
    };
    for line in lines {
        let Some((name, value)) = line.split_once(':') else {
            continue;
        };
        if name.eq_ignore_ascii_case("x-forwarded-for") {
            // The last hop is the one Caddy itself saw.
            caller.address = value.rsplit(',').next().and_then(|a| a.trim().parse().ok());
        } else if name.eq_ignore_ascii_case("cookie") {
            caller.session = value
                .split(';')
                .find_map(|c| c.trim().strip_prefix(SESSION_COOKIE))
                .map(str::to_owned);
        }
    }
    caller
}

/// Answers one request. Errors mean Caddy went away, so there is nobody left to tell.
fn handle(stream: &TcpStream, limiter: &mut Limiter) -> std::io::Result<()> {
    stream.set_read_timeout(Some(READ_TIMEOUT))?;
    let mut reader = BufReader::new(std::io::Read::take(
        stream,
        MAX_LINE_BYTES * MAX_HEADER_LINES as u64,
    ));
    let mut lines = Vec::new();
    let mut line = String::new();
    while lines.len() < MAX_HEADER_LINES && reader.read_line(&mut line)? > 0 {
        let trimmed = line.trim_end();
        if trimmed.is_empty() {
            break;
        }
        lines.push(trimmed.to_owned());
        line.clear();
    }
    let mut out = stream;
    match limiter.check(&parse_caller(lines.into_iter()), Instant::now()) {
        None => out.write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"),
        Some(wait) => {
            let body = format!("Too many sign-in attempts. Try again in {wait} seconds.");
            out.write_all(
                format!(
                    "HTTP/1.1 429 Too Many Requests\r\nRetry-After: {wait}\r\nContent-Type: text/plain\r\n\
                     Content-Length: {}\r\nConnection: close\r\n\r\n{body}",
                    body.len()
                )
                .as_bytes(),
            )
        }
    }
}

/// Answers Caddy one connection at a time, for ever.
fn main() -> std::io::Result<()> {
    let listener = TcpListener::bind(LISTEN)?;
    let mut limiter = Limiter::default();
    for stream in listener.incoming().flatten() {
        // A failed reply is that one request's problem, never the limiter's.
        let _ = handle(&stream, &mut limiter);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::Ipv4Addr;

    fn caller(last: u8, session: Option<&str>) -> Caller {
        Caller {
            address: Some(IpAddr::V4(Ipv4Addr::new(10, 0, 0, last))),
            session: session.map(str::to_owned),
        }
    }

    #[test]
    fn guessing_in_one_session_stops_at_its_burst_and_nobody_else_notices() {
        let (mut limiter, now) = (Limiter::default(), Instant::now());
        for _ in 0..5 {
            assert_eq!(limiter.check(&caller(1, Some("a")), now), None);
        }
        assert_eq!(limiter.check(&caller(1, Some("a")), now), Some(12));
        // Same address, another person's session.
        assert_eq!(limiter.check(&caller(1, Some("b")), now), None);
    }

    #[test]
    fn a_new_session_for_each_guess_runs_into_the_address_limit_only() {
        let (mut limiter, now) = (Limiter::default(), Instant::now());
        for i in 0..60 {
            assert_eq!(limiter.check(&caller(1, Some(&format!("s{i}"))), now), None);
        }
        assert_eq!(limiter.check(&caller(1, Some("next")), now), Some(2));
        assert_eq!(limiter.check(&caller(2, Some("elsewhere")), now), None);
    }

    #[test]
    fn the_wait_ends_and_refused_attempts_do_not_extend_it() {
        let (mut limiter, now) = (Limiter::default(), Instant::now());
        for _ in 0..5 {
            limiter.check(&caller(1, Some("a")), now);
        }
        for _ in 0..1000 {
            assert!(limiter.check(&caller(1, Some("a")), now).is_some());
        }
        assert_eq!(
            limiter.check(&caller(1, Some("a")), now + Duration::from_secs(12)),
            None
        );
    }

    #[test]
    fn loopback_is_the_server_itself_and_is_not_counted() {
        let (mut limiter, now) = (Limiter::default(), Instant::now());
        let server = Caller {
            address: Some(IpAddr::V4(Ipv4Addr::LOCALHOST)),
            session: None,
        };
        for _ in 0..1000 {
            assert_eq!(limiter.check(&server, now), None);
        }
    }

    #[test]
    fn a_client_cannot_choose_its_address_or_count_it_by_host_in_a_64() {
        let lines = [
            "X-Forwarded-For: 1.2.3.4, 10.0.0.9",
            "Cookie: x=1; FERRISKEY_SESSION=abc; y=2",
        ];
        let parsed = parse_caller(lines.iter().map(|l| (*l).to_owned()));
        assert_eq!(parsed.address, Some(IpAddr::V4(Ipv4Addr::new(10, 0, 0, 9))));
        assert_eq!(parsed.session.as_deref(), Some("abc"));
        let a: IpAddr = "2001:db8:1:2::1"
            .parse()
            .unwrap_or(IpAddr::V4(Ipv4Addr::UNSPECIFIED));
        let b: IpAddr = "2001:db8:1:2::ffff"
            .parse()
            .unwrap_or(IpAddr::V4(Ipv4Addr::UNSPECIFIED));
        assert_eq!(group_key(a), group_key(b));
    }

    #[test]
    fn the_map_stays_within_its_bound() {
        let (mut limiter, now) = (Limiter::default(), Instant::now());
        for i in 0..MAX_TRACKED + 10 {
            limiter.check(
                &Caller {
                    address: Some(IpAddr::V4(Ipv4Addr::from(i as u32 + 1))),
                    session: None,
                },
                now,
            );
        }
        assert!(limiter.addresses.len() <= MAX_TRACKED);
    }
}
