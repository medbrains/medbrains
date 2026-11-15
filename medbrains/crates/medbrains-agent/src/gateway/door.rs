//! The door: what a connection meets before any handshake work, and the count of handshakes given up.

use std::net::IpAddr;
use std::sync::Arc;
use std::time::Instant;

use tokio::sync::OwnedSemaphorePermit;

use super::{GIVEN_UP_REPORT_EVERY, GIVEN_UP_WINDOW, Gateway, MAX_GIVEN_UP, source_address};
use crate::limits::Place;

/// Handshakes given up on before revealing a nonce, which is what guessing a code looks like.
#[derive(Debug)]
pub(super) struct GivenUp {
    window_began: Instant,
    pub(super) in_window: u32,
    unreported: u32,
    last_report: Instant,
}

impl GivenUp {
    /// None yet.
    pub(super) const fn new(now: Instant) -> Self {
        Self {
            window_began: now,
            in_window: 0,
            unreported: 0,
            last_report: now,
        }
    }

    /// Starts a new window if the last has passed.
    fn roll(&mut self, now: Instant) {
        if now.duration_since(self.window_began) >= GIVEN_UP_WINDOW {
            self.window_began = now;
            self.in_window = 0;
        }
    }

    /// Whether joining must wait for the window to pass.
    pub(super) fn paused(&mut self, now: Instant) -> bool {
        self.roll(now);
        self.in_window >= MAX_GIVEN_UP
    }

    /// Counts one.
    pub(super) fn count(&mut self, now: Instant) {
        self.roll(now);
        self.in_window = self.in_window.saturating_add(1);
        self.unreported = self.unreported.saturating_add(1);
    }

    /// What is due to be reported now, at most every so often.
    pub(super) fn due(&mut self, now: Instant) -> u32 {
        if self.unreported == 0 || now.duration_since(self.last_report) < GIVEN_UP_REPORT_EVERY {
            return 0;
        }
        self.last_report = now;
        std::mem::take(&mut self.unreported)
    }
}

/// What holds a connection's place between arriving and being admitted or filed.
#[derive(Debug)]
pub(super) struct Arrival {
    _place: Place,
    _permit: OwnedSemaphorePermit,
}

impl Gateway {
    /// Accepts connections for as long as the agent runs: the one loop meant never to end. Everything
    /// here happens before any handshake work: a stranger is sent to prove its address, then counted,
    /// then refused or given a place. So a flood costs a bounded amount, and machines already connected
    /// keep their service.
    pub(crate) async fn accept_forever(self: Arc<Self>) {
        while let Some(incoming) = self.endpoint.accept().await {
            if !incoming.remote_addr_validated() {
                // Costs us one packet, and the sender must really receive at this address to go on.
                drop(incoming.retry());
                continue;
            }
            let Some(arrival) = self.arrival(source_address(&incoming)) else {
                incoming.refuse();
                continue;
            };
            let this = Arc::clone(&self);
            tokio::spawn(async move {
                if let Err(error) = this.serve(incoming, arrival).await {
                    tracing::info!(%error, "connection ended");
                }
            });
        }
    }

    /// A place for a new connection from `address`, or `None` if there is no room for it.
    pub(super) fn arrival(&self, address: IpAddr) -> Option<Arrival> {
        let place = self.arrivals.enter(address, Instant::now())?;
        let permit = Arc::clone(&self.arriving).try_acquire_owned().ok()?;
        Some(Arrival {
            _place: place,
            _permit: permit,
        })
    }
}
