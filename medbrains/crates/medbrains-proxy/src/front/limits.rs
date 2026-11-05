//! Bounds that stop one client taking the machine: connections held, and sign-in attempts made.

use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};
use std::time::Instant;

/// Who a limit counts: an IPv4 address, or an IPv6 /64. One machine on a LAN can hold a whole /64, so
/// counting single IPv6 addresses would limit nothing.
pub(crate) fn limit_key(address: IpAddr) -> IpAddr {
    const SUBNET_MASK: u128 = !0 << 64;
    match address {
        IpAddr::V4(_) => address,
        IpAddr::V6(v6) => IpAddr::V6((u128::from(v6) & SUBNET_MASK).into()),
    }
}

/// Open connections on one listener, in total and per address.
#[derive(Debug, Default)]
struct Counts {
    total: usize,
    by_address: HashMap<IpAddr, usize>,
}

/// Decides whether a listener takes another connection. Each listener has its own, so a flood on
/// the LAN port leaves the screen's loopback port free.
#[derive(Debug)]
pub(crate) struct ConnectionGate {
    max_total: usize,
    /// Zero means no limit per address: loopback, where every node's tunnel arrives.
    max_per_address: usize,
    counts: Mutex<Counts>,
    refused: AtomicU64,
}

/// Holds one connection's place. Dropping it frees the place, however the connection ended.
#[derive(Debug)]
pub(crate) struct Permit {
    gate: Arc<ConnectionGate>,
    address: IpAddr,
}

impl ConnectionGate {
    /// A gate with these limits.
    pub(crate) fn new(max_total: usize, max_per_address: usize) -> Arc<Self> {
        Arc::new(Self {
            max_total,
            max_per_address,
            counts: Mutex::default(),
            refused: AtomicU64::new(0),
        })
    }

    /// The counts, surviving a panic elsewhere: they stay correct, as `Permit` only adds and takes.
    fn lock(&self) -> MutexGuard<'_, Counts> {
        self.counts.lock().unwrap_or_else(PoisonError::into_inner)
    }

    /// A place for a connection from `address`, or `None` if a limit is reached. The map holds at
    /// most `max_total` addresses, so it cannot grow without bound.
    pub(crate) fn admit(self: &Arc<Self>, address: IpAddr) -> Option<Permit> {
        let address = limit_key(address);
        let mut counts = self.lock();
        let held = counts.by_address.get(&address).copied().unwrap_or(0);
        let over_address = self.max_per_address != 0 && held >= self.max_per_address;
        if counts.total >= self.max_total || over_address {
            self.refused.fetch_add(1, Ordering::Relaxed);
            return None;
        }
        counts.total += 1;
        counts.by_address.insert(address, held + 1);
        Some(Permit {
            gate: Arc::clone(self),
            address,
        })
    }

    /// Connections open now.
    pub(crate) fn open(&self) -> usize {
        self.lock().total
    }

    /// Connections refused since the last call. One log line a period, however big the flood.
    pub(crate) fn take_refused(&self) -> u64 {
        self.refused.swap(0, Ordering::Relaxed)
    }
}

impl Drop for Permit {
    /// Gives the place back.
    fn drop(&mut self) {
        let mut counts = self.gate.lock();
        counts.total = counts.total.saturating_sub(1);
        match counts.by_address.get(&self.address).copied() {
            Some(held) if held > 1 => {
                counts.by_address.insert(self.address, held - 1);
            }
            _ => {
                counts.by_address.remove(&self.address);
            }
        }
    }
}

/// Addresses tracked by one limiter. Far more than a hospital LAN holds; an address needs a real
/// TCP connection to appear, so it cannot be forged to fill this.
const MAX_TRACKED: usize = 16_384;

/// A token bucket per address: `burst` attempts at once, regaining `per_minute`.
#[derive(Debug)]
pub(crate) struct RateLimiter {
    burst: f64,
    per_second: f64,
    buckets: Mutex<HashMap<IpAddr, (f64, Instant)>>,
}

impl RateLimiter {
    /// A limiter with these rates, both above zero (`config.rs` checks).
    pub(crate) fn new(burst: u32, per_minute: u32) -> Self {
        Self {
            burst: f64::from(burst),
            per_second: f64::from(per_minute) / 60.0,
            buckets: Mutex::default(),
        }
    }

    /// Takes a token for `address` at time `now`. False means wait. When the table is full of
    /// addresses still spending tokens, a new address is refused: a limit that fails open stops
    /// nothing during exactly the attack it exists for.
    pub(crate) fn allow(&self, address: IpAddr, now: Instant) -> bool {
        let address = limit_key(address);
        let mut buckets = self.buckets.lock().unwrap_or_else(PoisonError::into_inner);
        if buckets.len() >= MAX_TRACKED && !buckets.contains_key(&address) {
            let (burst, rate) = (self.burst, self.per_second);
            buckets.retain(|_, (tokens, at)| {
                *tokens + now.duration_since(*at).as_secs_f64() * rate < burst
            });
            if buckets.len() >= MAX_TRACKED {
                return false;
            }
        }
        let (tokens, at) = buckets.entry(address).or_insert((self.burst, now));
        let refilled = now.duration_since(*at).as_secs_f64() * self.per_second;
        *tokens = (*tokens + refilled).min(self.burst);
        *at = now;
        if *tokens < 1.0 {
            return false;
        }
        *tokens -= 1.0;
        true
    }

    /// Whole seconds until a refused address has a token again, for `Retry-After`.
    pub(crate) fn retry_after_secs(&self) -> u64 {
        let seconds = (1.0 / self.per_second).ceil();
        format!("{seconds:.0}").parse().unwrap_or(60)
    }
}

#[cfg(test)]
mod tests {
    use super::{ConnectionGate, MAX_TRACKED, RateLimiter};
    use std::net::{IpAddr, Ipv4Addr};
    use std::time::{Duration, Instant};

    const A: IpAddr = IpAddr::V4(Ipv4Addr::new(10, 0, 0, 1));
    const B: IpAddr = IpAddr::V4(Ipv4Addr::new(10, 0, 0, 2));

    #[test]
    fn one_address_cannot_take_every_place() {
        let gate = ConnectionGate::new(10, 2);
        let held = [gate.admit(A), gate.admit(A)];
        assert!(held.iter().all(Option::is_some));
        assert!(gate.admit(A).is_none(), "third from the same address");
        assert!(gate.admit(B).is_some(), "another address still gets in");
        assert_eq!(gate.take_refused(), 1);
        assert_eq!(gate.take_refused(), 0);
    }

    #[test]
    fn one_ipv6_subnet_counts_as_one_address() -> anyhow::Result<()> {
        let gate = ConnectionGate::new(10, 2);
        let held = [
            gate.admit("2001:db8:1:1::1".parse()?),
            gate.admit("2001:db8:1:1:ffff::9".parse()?),
        ];
        assert!(held.iter().all(Option::is_some));
        assert!(gate.admit("2001:db8:1:1::3".parse()?).is_none(), "same /64");
        assert!(
            gate.admit("2001:db8:1:2::1".parse()?).is_some(),
            "another /64"
        );
        let limiter = RateLimiter::new(1, 1);
        let now = Instant::now();
        assert!(limiter.allow("2001:db8:1:1::1".parse()?, now));
        assert!(!limiter.allow("2001:db8:1:1::2".parse()?, now), "same /64");
        Ok(())
    }

    #[test]
    fn a_closed_connection_frees_its_place_and_its_memory() {
        let gate = ConnectionGate::new(1, 0);
        let permit = gate.admit(A);
        assert!(permit.is_some());
        assert!(gate.admit(B).is_none(), "total limit");
        drop(permit);
        assert_eq!(gate.open(), 0);
        assert!(gate.lock().by_address.is_empty());
        assert!(gate.admit(B).is_some());
    }

    #[test]
    fn property_counts_never_drift_over_a_long_random_run() {
        let gate = ConnectionGate::new(50, 5);
        let mut held = Vec::new();
        let mut rng = crate::test_rng::Rng(7);
        for _ in 0..20_000 {
            let roll = rng.next();
            let last = u8::try_from(roll % 20).unwrap_or(0);
            let address = IpAddr::V4(Ipv4Addr::new(10, 0, 0, last));
            if roll & 0x100 == 0 {
                held.extend(gate.admit(address));
            } else if !held.is_empty() {
                let index = usize::try_from(roll >> 16).unwrap_or(0) % held.len();
                held.swap_remove(index);
            }
            assert_eq!(gate.open(), held.len());
            assert!(held.len() <= 50);
            assert!(gate.lock().by_address.values().all(|count| *count <= 5));
        }
        held.clear();
        assert!(gate.lock().by_address.is_empty());
    }

    #[test]
    fn the_limit_allows_the_burst_then_refills_slowly() {
        let limiter = RateLimiter::new(2, 60);
        let start = Instant::now();
        assert!(limiter.allow(A, start));
        assert!(limiter.allow(A, start));
        assert!(!limiter.allow(A, start), "burst spent");
        assert!(limiter.allow(B, start), "another address is untouched");
        assert!(
            limiter.allow(A, start + Duration::from_secs(1)),
            "one regained"
        );
        assert!(!limiter.allow(A, start + Duration::from_secs(1)));
        assert_eq!(limiter.retry_after_secs(), 1);
    }

    #[test]
    fn a_full_table_refuses_new_addresses_until_old_ones_refill() {
        let limiter = RateLimiter::new(1, 60);
        let start = Instant::now();
        for index in 0..MAX_TRACKED {
            let bytes = u32::try_from(index).unwrap_or(0).to_be_bytes();
            assert!(limiter.allow(IpAddr::V4(Ipv4Addr::from(bytes)), start));
        }
        let new = IpAddr::V4(Ipv4Addr::new(192, 0, 2, 1));
        assert!(!limiter.allow(new, start), "table full of spent buckets");
        assert!(
            limiter.allow(new, start + Duration::from_secs(5)),
            "they refilled"
        );
    }
}
