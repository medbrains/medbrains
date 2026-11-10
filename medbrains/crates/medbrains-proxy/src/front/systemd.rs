//! Tells systemd how the service is doing, over its plain datagram socket. No library: three
//! messages. Under `WatchdogSec`, a wedged runtime stops pinging and systemd restarts the service.

use crate::limits::ConnectionGate;
use std::os::unix::net::UnixDatagram;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::watch;

/// A third of the unit's `WatchdogSec`, as systemd recommends.
const PING: Duration = Duration::from_secs(10);

/// Sends a status line. Outside systemd there is no socket, and nothing to tell.
pub(crate) fn notify(state: &str) {
    let Some(path) = std::env::var_os("NOTIFY_SOCKET") else {
        return;
    };
    let sent = UnixDatagram::unbound().and_then(|socket| socket.send_to(state.as_bytes(), &path));
    if let Err(error) = sent {
        tracing::warn!(%error, "could not notify systemd");
    }
}

/// Pings the watchdog, and logs refused connections once a period rather than once each. This task
/// shares the runtime with every connection, so it stops running when they stop being served.
pub(crate) async fn watchdog_loop(
    gates: Vec<Arc<ConnectionGate>>,
    mut shutdown: watch::Receiver<bool>,
) {
    loop {
        notify("WATCHDOG=1");
        let refused: u64 = gates.iter().map(|gate| gate.take_refused()).sum();
        if refused > 0 {
            tracing::warn!(refused, "connections refused at a limit");
        }
        tokio::select! {
            () = tokio::time::sleep(PING) => {}
            _ = shutdown.changed() => {
                // Done pinging, but a finished task would read as a listener having stopped.
                std::future::pending::<()>().await;
            }
        }
    }
}
