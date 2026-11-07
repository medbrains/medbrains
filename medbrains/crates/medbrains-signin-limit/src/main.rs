//! Slows repeated sign-ins from one address, at the OS image's TLS front.
//!
//! Kanidm counts wrong passwords per account, whoever sends them, so one stranger can hold an account
//! shut. Debian's Caddy has no rate limit module, so its `forward_auth` asks this process before passing
//! a sign-in along. A 200 lets the request through; Caddy hands a 429 to the client. Caddy sets
//! `X-Forwarded-For` itself and trusts no proxy, so a client cannot choose its address. Loopback only,
//! one thread, no state on disk; a restart forgets the counts.
//!
//! The whole rule is one line, so it moves to another front unchanged: on the paths the front lists, 30
//! attempts at once per address, regaining 15 a minute, and this machine's own screen is not counted.

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::net::{IpAddr, Ipv6Addr, TcpListener, TcpStream};
use std::time::{Duration, Instant};

const LISTEN: &str = "127.0.0.1:3101";
/// A ward's shift change at once, then about seven sign-ins a minute: one takes two requests.
const ADDRESS_LIMIT: Limit = Limit {
    burst: 30.0,
    per_minute: 15.0,
};
/// Addresses kept before empty memory is reclaimed; one costs about 100 bytes.
const MAX_TRACKED: usize = 10_000;
const MAX_HEADER_LINES: usize = 64;
const MAX_LINE_BYTES: u64 = 8 * 1024;
const READ_TIMEOUT: Duration = Duration::from_secs(1);

/// How fast a bucket drains and refills.
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

/// Every address's bucket, and the limit they share.
struct Limiter {
    limit: Limit,
    addresses: HashMap<IpAddr, Bucket>,
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

impl Limiter {
    /// A limiter with this limit.
    fn new(limit: Limit) -> Self {
        Self {
            limit,
            addresses: HashMap::new(),
        }
    }

    /// Seconds the caller must wait, or `None` when the attempt may go ahead. A refused attempt
    /// costs nothing, so a client hammering a closed door does not push its own wait further out.
    fn check(&mut self, address: Option<IpAddr>, now: Instant) -> Option<u64> {
        // No address means Caddy did not send one, which only this machine could do. So does
        // loopback: the machine's own screen, and the server redeeming a sign-in code.
        let address = group_key(address.filter(|a| !is_loopback(*a))?);
        let limit = self.limit;
        if self.addresses.len() >= MAX_TRACKED && !self.addresses.contains_key(&address) {
            self.addresses
                .retain(|_, b| tokens_at(*b, limit, now) < limit.burst);
            // ponytail: past MAX_TRACKED live buckets everyone starts again; per-key expiry if a LAN gets there.
            if self.addresses.len() >= MAX_TRACKED {
                self.addresses.clear();
            }
        }
        let bucket = self.addresses.entry(address).or_insert(Bucket {
            tokens: limit.burst,
            refilled_at: now,
        });
        bucket.tokens = tokens_at(*bucket, limit, now);
        bucket.refilled_at = now;
        let wait = wait_seconds(bucket.tokens, limit);
        if wait > 0 {
            return Some(wait);
        }
        bucket.tokens -= 1.0;
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

/// Reads who is asking from the header lines Caddy sent. The last hop is the one Caddy itself saw.
fn parse_address<I: Iterator<Item = String>>(lines: I) -> Option<IpAddr> {
    lines
        .filter_map(|line| {
            let (name, value) = line.split_once(':')?;
            name.eq_ignore_ascii_case("x-forwarded-for").then(|| {
                value
                    .rsplit(',')
                    .next()
                    .and_then(|address| address.trim().parse().ok())
            })?
        })
        .next()
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
    match limiter.check(parse_address(lines.into_iter()), Instant::now()) {
        None => out.write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"),
        Some(wait) => {
            let body = format!("Too many sign-in attempts from here. Try again in {wait} seconds.");
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

/// The limit to use: the rule above, or for a test on a debug image the burst and rate it sets.
fn limit_from_environment() -> Limit {
    let read = |name: &str| {
        std::env::var(name)
            .ok()
            .and_then(|value| value.parse().ok())
    };
    Limit {
        burst: read("SIGNIN_LIMIT_BURST").unwrap_or(ADDRESS_LIMIT.burst),
        per_minute: read("SIGNIN_LIMIT_PER_MINUTE").unwrap_or(ADDRESS_LIMIT.per_minute),
    }
}

/// Answers Caddy one connection at a time, for ever.
fn main() -> std::io::Result<()> {
    let listener = TcpListener::bind(LISTEN)?;
    let mut limiter = Limiter::new(limit_from_environment());
    for stream in listener.incoming().flatten() {
        // A failed reply is that one request's problem, never the limiter's.
        drop(handle(&stream, &mut limiter));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::Ipv4Addr;

    /// One address on the LAN.
    fn address(last: u8) -> Option<IpAddr> {
        Some(IpAddr::V4(Ipv4Addr::new(10, 0, 0, last)))
    }

    /// The owner's rule: one address guessing runs out, and another address is not touched.
    #[test]
    fn one_address_stops_at_its_burst_and_nobody_else_notices() {
        let (mut limiter, now) = (Limiter::new(ADDRESS_LIMIT), Instant::now());
        for _ in 0..30 {
            assert_eq!(limiter.check(address(1), now), None);
        }
        assert_eq!(limiter.check(address(1), now), Some(4));
        assert_eq!(limiter.check(address(2), now), None);
    }

    #[test]
    fn the_wait_ends_and_refused_attempts_do_not_extend_it() {
        let (mut limiter, now) = (Limiter::new(ADDRESS_LIMIT), Instant::now());
        for _ in 0..30 {
            limiter.check(address(1), now);
        }
        for _ in 0..1000 {
            assert!(limiter.check(address(1), now).is_some());
        }
        assert_eq!(
            limiter.check(address(1), now + Duration::from_secs(4)),
            None
        );
    }

    #[test]
    fn loopback_is_this_machine_and_is_not_counted() {
        let (mut limiter, now) = (Limiter::new(ADDRESS_LIMIT), Instant::now());
        for _ in 0..1000 {
            assert_eq!(
                limiter.check(Some(IpAddr::V4(Ipv4Addr::LOCALHOST)), now),
                None
            );
        }
    }

    #[test]
    fn a_client_cannot_choose_its_address_or_count_it_by_host_in_a_64() {
        let lines = ["X-Forwarded-For: 1.2.3.4, 10.0.0.9"];
        let parsed = parse_address(lines.iter().map(|l| (*l).to_owned()));
        assert_eq!(parsed, address(9));
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
        let (mut limiter, now) = (Limiter::new(ADDRESS_LIMIT), Instant::now());
        for i in 0..MAX_TRACKED + 10 {
            limiter.check(Some(IpAddr::V4(Ipv4Addr::from(i as u32 + 1))), now);
        }
        assert!(limiter.addresses.len() <= MAX_TRACKED);
    }
}
