//! Serving with a bounded drain.
//!
//! On a stop signal the server stops accepting and lets requests in flight
//! finish. Axum waits for every connection with no limit, and a response that
//! never ends (a live stream to an open browser tab) never lets go: a restart
//! then took the supervisor's whole stop timeout (90 seconds) instead of a few.
//! Here the wait has a deadline.

use std::future::{Future, IntoFuture};
use std::net::SocketAddr;
use std::time::Duration;

use axum::Router;
use tokio::net::TcpListener;

/// How long requests in flight get to finish after a stop signal.
///
/// Ordinary requests finish in well under a second and the slowest reports in
/// a few; ten seconds lets those end and keeps a restart short. The systemd
/// unit's `TimeoutStopSec` (15s) sits just above it as the backstop.
pub const DRAIN_DEADLINE: Duration = Duration::from_secs(10);

/// How a drain ended.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Drain {
    /// Every connection finished inside the deadline.
    Clean,
    /// The deadline passed with connections still open; they are cut when the
    /// process exits, and their clients reconnect.
    Forced,
}

/// Serve `app` until `signal` resolves, then stop accepting and wait at most
/// `deadline` for connections to finish.
///
/// Returns instead of waiting forever, so the caller can exit and the
/// supervisor never has to kill the process.
///
/// # Errors
/// The listener failed while serving.
pub async fn serve_until(
    listener: TcpListener,
    app: Router,
    signal: impl Future<Output = ()> + Send + 'static,
    deadline: Duration,
) -> std::io::Result<Drain> {
    let (draining_tx, draining_rx) = tokio::sync::oneshot::channel::<()>();
    // Not `axum::serve(listener, app)`: that form copies the whole route table for every
    // connection (DECISIONS, 2026-11-04), and gives handlers no connecting address, leaving them
    // only headers that a client can write.
    let serve = axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(async move {
        signal.await;
        let _ = draining_tx.send(());
    })
    .into_future();
    tokio::pin!(serve);

    tokio::select! {
        served = &mut serve => return served.map(|()| Drain::Clean),
        _ = draining_rx => {}
    }
    // ponytail: streams are not told to close; the exit closes their sockets.
    // Add a shutdown watch to the stream handlers if restarts should take the
    // drain of ordinary requests only, not the whole deadline.
    let Ok(served) = tokio::time::timeout(deadline, serve).await else {
        tracing::warn!(
            deadline_ms = deadline.as_millis(),
            "shutdown deadline passed with connections still open; closing them"
        );
        return Ok(Drain::Forced);
    };
    tracing::info!("shutdown complete — all in-flight requests drained");
    served.map(|()| Drain::Clean)
}

#[cfg(test)]
mod tests {
    #![allow(clippy::expect_used)]

    use std::convert::Infallible;
    use std::time::{Duration, Instant};

    use axum::Router;
    use axum::body::Body;
    use axum::routing::get;
    use futures::StreamExt;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    use super::{Drain, serve_until};

    /// A response that sends one chunk and then never ends, as a live stream does.
    async fn endless() -> Body {
        let first = futures::stream::once(async { Ok::<_, Infallible>("data: hello\n\n") });
        Body::from_stream(first.chain(futures::stream::pending()))
    }

    #[tokio::test]
    async fn a_held_stream_cannot_keep_the_server_up_past_the_deadline() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind");
        let addr = listener.local_addr().expect("addr");
        let (stop, stopped) = tokio::sync::oneshot::channel::<()>();
        let deadline = Duration::from_millis(300);
        let server = tokio::spawn(serve_until(
            listener,
            Router::new().route("/stream", get(endless)),
            async move {
                let _ = stopped.await;
            },
            deadline,
        ));

        // A client that opens the stream and keeps it open, like a browser tab.
        let mut tab = tokio::net::TcpStream::connect(addr).await.expect("connect");
        tab.write_all(b"GET /stream HTTP/1.1\r\nHost: test\r\n\r\n")
            .await
            .expect("request");
        let mut first = [0_u8; 16];
        tab.read_exact(&mut first).await.expect("response began");

        let asked = Instant::now();
        stop.send(()).expect("server is listening");
        let drain = tokio::time::timeout(Duration::from_secs(5), server)
            .await
            .expect("the server returned; without a deadline it waits on the stream forever")
            .expect("server task")
            .expect("serve");
        assert_eq!(drain, Drain::Forced);
        assert!(
            asked.elapsed() >= deadline,
            "in-flight work gets the whole deadline"
        );
        drop(tab);
    }
}
