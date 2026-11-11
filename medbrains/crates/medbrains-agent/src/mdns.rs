//! Keeps mDNS working as the machine's addresses change.
//!
//! The discovery library joins its multicast group once, when it starts. A machine that gets its
//! address after the agent started, which is every machine on DHCP and any cable plugged in late,
//! would then never hear anything. So mDNS starts again whenever this machine's addresses change.

use std::collections::BTreeSet;
use std::net::SocketAddr;
use std::time::Duration;

use iroh::Endpoint;
use iroh_mdns_address_lookup::DiscoveryEvent;
use medbrains_edge::iroh_transport::start_mdns;
use n0_future::StreamExt;

use crate::wire::MDNS_SERVICE;

const CHECK_EVERY: Duration = Duration::from_secs(3);

/// This machine's addresses as iroh sees them.
fn addresses(endpoint: &Endpoint) -> BTreeSet<SocketAddr> {
    endpoint.addr().ip_addrs().copied().collect()
}

/// Runs mDNS for as long as the agent runs, handing each event to `heard`.
pub(crate) async fn follow(
    endpoint: Endpoint,
    advertise: bool,
    heard: impl Fn(DiscoveryEvent) + Send + Sync,
) {
    let mut check = tokio::time::interval(CHECK_EVERY);
    loop {
        let seen = addresses(&endpoint);
        let mdns = match start_mdns(&endpoint, advertise, MDNS_SERVICE) {
            Ok(mdns) => mdns,
            Err(error) => {
                tracing::warn!(%error, "could not start mDNS");
                check.tick().await;
                continue;
            }
        };
        let mut events = mdns.subscribe().await;
        loop {
            tokio::select! {
                event = events.next() => {
                    let Some(event) = event else { break };
                    heard(event);
                }
                _ = check.tick() => {
                    if addresses(&endpoint) != seen {
                        break;
                    }
                }
            }
        }
    }
}
