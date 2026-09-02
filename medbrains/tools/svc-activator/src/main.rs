//! On-demand activation for services that are idle most of the day.
//!
//! Listens where the service used to listen. The first connection starts the
//! unit and waits for it to accept; after `--idle-secs` with nothing connected,
//! the unit is stopped again and its memory goes back to the machine.
//!
//! This exists because `systemd-socket-proxyd` can start a unit but cannot
//! stop one that has gone quiet — and stopping it is the entire point. On the
//! shared Alagappa box, Superset holds ~870 MB to serve about fifteen requests
//! a day.
//!
//! NOT for anything clinical. The first request after an idle period pays the
//! service's whole cold start — tens of seconds for a Django or Superset boot.
//! That is fine for a dashboard and unacceptable for a clinician mid-consult.

use std::io;
use std::net::SocketAddr;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

use tokio::io::copy_bidirectional;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::Mutex;
use tokio::time::{Instant, sleep, timeout};

/// How a backing service is started and stopped. A trait so the proxy logic
/// can be tested without systemd — the tests drive a fake.
trait Unit: Send + Sync {
    fn start(&self) -> impl Future<Output = io::Result<()>> + Send;
    fn stop(&self) -> impl Future<Output = io::Result<()>> + Send;
}

/// Two commands. Not hardcoded to systemd, because the services worth putting
/// to sleep are not all systemd units — Frappe runs its web tier under
/// supervisord, and a tool that only speaks `systemctl` cannot touch it.
struct Exec {
    start: Vec<String>,
    stop: Vec<String>,
}

impl Exec {
    fn systemd(unit: &str) -> Self {
        Self {
            start: vec!["systemctl".into(), "start".into(), unit.into()],
            stop: vec!["systemctl".into(), "stop".into(), unit.into()],
        }
    }
}

impl Unit for Exec {
    async fn start(&self) -> io::Result<()> {
        run(&self.start).await
    }
    async fn stop(&self) -> io::Result<()> {
        run(&self.stop).await
    }
}

async fn run(argv: &[String]) -> io::Result<()> {
    let (bin, rest) = argv
        .split_first()
        .ok_or_else(|| io::Error::other("empty command"))?;
    let status = tokio::process::Command::new(bin)
        .args(rest)
        .status()
        .await?;
    if status.success() {
        Ok(())
    } else {
        Err(io::Error::other(format!("{} failed", argv.join(" "))))
    }
}

struct Config {
    listen: SocketAddr,
    backend: SocketAddr,
    idle: Duration,
    start_timeout: Duration,
}

/// Live counts. `in_flight` gates the reaper: a unit is never stopped while a
/// connection is open, however long that connection has been quiet.
struct State {
    in_flight: AtomicU64,
    last_seen: Mutex<Instant>,
    starting: Mutex<()>,
}

impl State {
    fn new() -> Self {
        Self {
            in_flight: AtomicU64::new(0),
            last_seen: Mutex::new(Instant::now()),
            starting: Mutex::new(()),
        }
    }

    async fn touch(&self) {
        *self.last_seen.lock().await = Instant::now();
    }
}

/// Connect, starting the unit first if nothing is listening yet.
///
/// The `starting` lock matters: a cold service hit by ten simultaneous
/// requests must run `systemctl start` once, not ten times.
async fn connect_or_start<U: Unit>(
    cfg: &Config,
    state: &State,
    unit: &U,
) -> io::Result<TcpStream> {
    if let Ok(Ok(s)) = timeout(Duration::from_millis(250), TcpStream::connect(cfg.backend)).await {
        return Ok(s);
    }

    let _guard = state.starting.lock().await;
    // Someone may have started it while we waited for the lock.
    if let Ok(Ok(s)) = timeout(Duration::from_millis(250), TcpStream::connect(cfg.backend)).await {
        return Ok(s);
    }

    eprintln!("activator: backend is down, starting it");
    unit.start().await?;

    let deadline = Instant::now() + cfg.start_timeout;
    let mut wait = Duration::from_millis(100);
    while Instant::now() < deadline {
        if let Ok(s) = TcpStream::connect(cfg.backend).await {
            eprintln!("activator: backend accepted after start");
            return Ok(s);
        }
        sleep(wait).await;
        // Back off rather than hammer a service that is still importing Django.
        wait = (wait * 2).min(Duration::from_secs(2));
    }
    Err(io::Error::new(
        io::ErrorKind::TimedOut,
        "backend did not accept within the start timeout",
    ))
}

/// Stop the unit once nothing has been connected for `idle`.
async fn reaper<U: Unit>(cfg: Arc<Config>, state: Arc<State>, unit: Arc<U>) {
    // Clamped, not floored: a 5s floor makes the idle window untestable, and
    // an unbounded quarter of a 30-minute window would check only every 7.5
    // minutes, so the memory comes back long after the service went quiet.
    let tick = (cfg.idle / 4).clamp(Duration::from_millis(50), Duration::from_secs(60));
    loop {
        sleep(tick).await;
        if state.in_flight.load(Ordering::Acquire) > 0 {
            continue;
        }
        let idle_for = state.last_seen.lock().await.elapsed();
        if idle_for < cfg.idle {
            continue;
        }
        // Only stop something that is actually up, so we do not run
        // `systemctl stop` every tick against an already-stopped unit.
        if timeout(Duration::from_millis(250), TcpStream::connect(cfg.backend))
            .await
            .is_err()
        {
            continue;
        }
        eprintln!("activator: idle for {}s, stopping backend", idle_for.as_secs());
        if let Err(e) = unit.stop().await {
            eprintln!("activator: stop failed: {e}");
        }
        state.touch().await;
    }
}

async fn serve<U: Unit + 'static>(cfg: Arc<Config>, unit: Arc<U>) -> io::Result<()> {
    let listener = TcpListener::bind(cfg.listen).await?;
    eprintln!(
        "activator: {} -> {} (idle stop after {}s)",
        cfg.listen,
        cfg.backend,
        cfg.idle.as_secs()
    );

    let state = Arc::new(State::new());
    tokio::spawn(reaper(
        Arc::clone(&cfg),
        Arc::clone(&state),
        Arc::clone(&unit),
    ));

    loop {
        let (mut client, peer) = listener.accept().await?;
        let cfg = Arc::clone(&cfg);
        let state = Arc::clone(&state);
        let unit = Arc::clone(&unit);
        tokio::spawn(async move {
            state.in_flight.fetch_add(1, Ordering::AcqRel);
            state.touch().await;
            match connect_or_start(&cfg, &state, unit.as_ref()).await {
                Ok(mut upstream) => {
                    // Errors here are ordinary: browsers close connections.
                    let _ = copy_bidirectional(&mut client, &mut upstream).await;
                }
                Err(e) => eprintln!("activator: {peer} could not be served: {e}"),
            }
            state.in_flight.fetch_sub(1, Ordering::AcqRel);
            state.touch().await;
        });
    }
}

fn arg(args: &[String], flag: &str) -> Option<String> {
    args.iter()
        .position(|a| a == flag)
        .and_then(|i| args.get(i + 1))
        .cloned()
}

fn usage() -> String {
    "usage: svc-activator --listen ADDR --backend ADDR \
     (--unit NAME | --start-cmd CMD --stop-cmd CMD) \
     [--idle-secs N] [--start-timeout-secs N]"
        .to_owned()
}

#[tokio::main]
async fn main() -> io::Result<()> {
    let args: Vec<String> = std::env::args().collect();
    let parse = |flag: &str| -> io::Result<SocketAddr> {
        arg(&args, flag)
            .ok_or_else(|| io::Error::other(usage()))?
            .parse()
            .map_err(|_| io::Error::other(format!("{flag} must be host:port")))
    };
    let secs = |flag: &str, default: u64| -> u64 {
        arg(&args, flag).and_then(|v| v.parse().ok()).unwrap_or(default)
    };

    let cfg = Arc::new(Config {
        listen: parse("--listen")?,
        backend: parse("--backend")?,
        idle: Duration::from_secs(secs("--idle-secs", 900)),
        start_timeout: Duration::from_secs(secs("--start-timeout-secs", 90)),
    });
    let unit = Arc::new(match (arg(&args, "--start-cmd"), arg(&args, "--stop-cmd")) {
        (Some(s), Some(t)) => Exec {
            start: s.split_whitespace().map(str::to_owned).collect(),
            stop: t.split_whitespace().map(str::to_owned).collect(),
        },
        _ => Exec::systemd(&arg(&args, "--unit").ok_or_else(|| io::Error::other(usage()))?),
    });

    serve(cfg, unit).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::AtomicUsize;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    /// A unit that records how often it was started, and only "listens" once
    /// started — the whole behaviour under test.
    struct Fake {
        starts: AtomicUsize,
        stops: AtomicUsize,
        addr: SocketAddr,
        listener: Mutex<Option<TcpListener>>,
    }

    impl Unit for Fake {
        async fn start(&self) -> io::Result<()> {
            self.starts.fetch_add(1, Ordering::AcqRel);
            let l = TcpListener::bind(self.addr).await?;
            let mut slot = self.listener.lock().await;
            *slot = Some(l);
            Ok(())
        }
        async fn stop(&self) -> io::Result<()> {
            self.stops.fetch_add(1, Ordering::AcqRel);
            *self.listener.lock().await = None;
            Ok(())
        }
    }

    async fn free_addr() -> SocketAddr {
        let l = TcpListener::bind("127.0.0.1:0").await.expect("bind");
        let a = l.local_addr().expect("addr");
        drop(l);
        a
    }

    #[tokio::test]
    async fn a_cold_backend_is_started_once_for_concurrent_callers() {
        // Ten simultaneous first requests must produce one `systemctl start`,
        // not ten. Ten Django boots on a 2-vCPU box is an outage.
        let backend = free_addr().await;
        let cfg = Config {
            listen: free_addr().await,
            backend,
            idle: Duration::from_secs(60),
            start_timeout: Duration::from_secs(5),
        };
        let fake = Arc::new(Fake {
            starts: AtomicUsize::new(0),
            stops: AtomicUsize::new(0),
            addr: backend,
            listener: Mutex::new(None),
        });
        let state = Arc::new(State::new());
        let cfg = Arc::new(cfg);

        // Spawned, not awaited in sequence: awaiting one at a time lets the
        // first caller finish starting before the second even runs, so the
        // lock is never contended and the test passes with the lock deleted.
        let mut handles = Vec::new();
        for _ in 0..10 {
            let (c, s, f) = (Arc::clone(&cfg), Arc::clone(&state), Arc::clone(&fake));
            handles.push(tokio::spawn(async move {
                connect_or_start(&c, &s, f.as_ref()).await.map(|_| ())
            }));
        }
        for h in handles {
            h.await.expect("task").expect("should connect after start");
        }

        assert_eq!(
            fake.starts.load(Ordering::Acquire),
            1,
            "concurrent cold requests must start the unit exactly once",
        );
    }

    #[tokio::test]
    async fn an_already_running_backend_is_never_started() {
        let backend = free_addr().await;
        let _live = TcpListener::bind(backend).await.expect("bind backend");
        let cfg = Config {
            listen: free_addr().await,
            backend,
            idle: Duration::from_secs(60),
            start_timeout: Duration::from_secs(5),
        };
        let fake = Fake {
            starts: AtomicUsize::new(0),
            stops: AtomicUsize::new(0),
            addr: backend,
            listener: Mutex::new(None),
        };

        connect_or_start(&cfg, &State::new(), &fake)
            .await
            .expect("connect");

        assert_eq!(
            fake.starts.load(Ordering::Acquire),
            0,
            "a healthy backend must not be restarted underneath its users",
        );
    }

    #[tokio::test]
    async fn an_idle_backend_is_stopped() {
        // The reaper is the entire justification for this tool: without it
        // this is just a proxy, and the 871 MB never comes back.
        let backend = free_addr().await;
        let cfg = Arc::new(Config {
            listen: free_addr().await,
            backend,
            idle: Duration::from_millis(200),
            start_timeout: Duration::from_secs(5),
        });
        let fake = Arc::new(Fake {
            starts: AtomicUsize::new(0),
            stops: AtomicUsize::new(0),
            addr: backend,
            listener: Mutex::new(None),
        });
        fake.start().await.expect("bring the backend up");
        let state = Arc::new(State::new());

        tokio::spawn(reaper(
            Arc::clone(&cfg),
            Arc::clone(&state),
            Arc::clone(&fake),
        ));
        sleep(Duration::from_millis(700)).await;

        assert!(
            fake.stops.load(Ordering::Acquire) >= 1,
            "a backend with no connections past the idle window must be stopped",
        );
    }

    #[tokio::test]
    async fn a_backend_with_an_open_connection_is_never_stopped() {
        // Stopping a unit out from under a live request is worse than never
        // reclaiming the memory at all — a long report download would die.
        let backend = free_addr().await;
        let cfg = Arc::new(Config {
            listen: free_addr().await,
            backend,
            idle: Duration::from_millis(200),
            start_timeout: Duration::from_secs(5),
        });
        let fake = Arc::new(Fake {
            starts: AtomicUsize::new(0),
            stops: AtomicUsize::new(0),
            addr: backend,
            listener: Mutex::new(None),
        });
        fake.start().await.expect("bring the backend up");
        let state = Arc::new(State::new());
        // One request in flight, and it has been quiet far longer than `idle`.
        state.in_flight.fetch_add(1, Ordering::AcqRel);

        tokio::spawn(reaper(
            Arc::clone(&cfg),
            Arc::clone(&state),
            Arc::clone(&fake),
        ));
        sleep(Duration::from_millis(700)).await;

        assert_eq!(
            fake.stops.load(Ordering::Acquire),
            0,
            "a connection still being served must hold the backend open",
        );
    }

    #[tokio::test]
    async fn traffic_reaches_the_backend_it_just_started() {
        let backend = free_addr().await;
        let listen = free_addr().await;
        let cfg = Arc::new(Config {
            listen,
            backend,
            idle: Duration::from_secs(60),
            start_timeout: Duration::from_secs(5),
        });
        let fake = Arc::new(Fake {
            starts: AtomicUsize::new(0),
            stops: AtomicUsize::new(0),
            addr: backend,
            listener: Mutex::new(None),
        });

        let echo = Arc::clone(&fake);
        tokio::spawn(async move {
            loop {
                let maybe = { echo.listener.lock().await.is_some() };
                if maybe {
                    let guard = echo.listener.lock().await;
                    if let Some(l) = guard.as_ref()
                        && let Ok((mut s, _)) = l.accept().await
                    {
                        let mut buf = [0u8; 5];
                        let _ = s.read_exact(&mut buf).await;
                        let _ = s.write_all(&buf).await;
                    }
                }
                sleep(Duration::from_millis(20)).await;
            }
        });

        tokio::spawn(serve(Arc::clone(&cfg), Arc::clone(&fake)));
        sleep(Duration::from_millis(150)).await;

        let mut c = TcpStream::connect(listen).await.expect("connect proxy");
        c.write_all(b"hello").await.expect("write");
        let mut out = [0u8; 5];
        c.read_exact(&mut out).await.expect("read echo");

        assert_eq!(&out, b"hello", "the proxy must carry bytes end to end");
        assert_eq!(fake.starts.load(Ordering::Acquire), 1);
    }
}
