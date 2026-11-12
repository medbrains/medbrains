#![allow(unreachable_pub)]

//! Counts the database statements one HTTP request runs (#5462).
//!
//! sqlx emits one `tracing` event (target `sqlx::query`) per statement it
//! executes, from inside the future that awaits it — the handler's own task.
//! A middleware opens a task-local counter around each request, a tracing
//! layer bumps it on every such event, and the total goes back to the test in
//! the `x-query-count` response header.
//!
//! Work a handler hands to `tokio::spawn` runs in another task and is not
//! counted: the budget is for the round trips a user waits on.

use std::cell::Cell;
use std::sync::OnceLock;

use tracing::subscriber::Interest;
use tracing::{Event, Metadata, Subscriber};
use tracing_subscriber::layer::{Context, Layer, SubscriberExt};

/// The response header carrying the request's statement count.
pub const HEADER: &str = "x-query-count";

/// sqlx's statement-log target.
const SQLX_TARGET: &str = "sqlx::query";

tokio::task_local! {
    static QUERIES: Cell<u32>;
}

/// A tracing layer interested only in sqlx statements, counting each one
/// against the request whose task executed it.
#[derive(Debug)]
struct CountStatements;

impl<S: Subscriber> Layer<S> for CountStatements {
    /// Subscribe to sqlx's statement events and nothing else, so installing
    /// this costs other tests no logging.
    fn register_callsite(&self, meta: &'static Metadata<'static>) -> Interest {
        if meta.target() == SQLX_TARGET {
            Interest::always()
        } else {
            Interest::never()
        }
    }

    /// Bump the current request's counter; events outside a request (the
    /// test's own seeding) have no counter and are ignored.
    fn on_event(&self, event: &Event<'_>, _ctx: Context<'_, S>) {
        if event.metadata().target() == SQLX_TARGET {
            // `try_with` fails only outside a counted request: nothing to count.
            let _outside_a_request = QUERIES.try_with(|n| n.set(n.get().saturating_add(1)));
        }
    }
}

/// Install the counting layer as the process's tracing subscriber, once.
///
/// The middleware sets the header on every response, counted or not. If
/// something else installed a global subscriber first, or sqlx's statement
/// events are filtered out, every request reports 0, and `0 <= 0` would pass a
/// budget. The budget tests therefore also require a non-zero count: every
/// list read runs at least its own `SELECT`.
pub fn install() {
    static INSTALLED: OnceLock<bool> = OnceLock::new();
    INSTALLED.get_or_init(|| {
        let subscriber = tracing_subscriber::registry().with(CountStatements);
        tracing::subscriber::set_global_default(subscriber).is_ok()
    });
}

/// Middleware: run the request inside a fresh counter and report the total.
pub async fn count_queries(
    request: axum::extract::Request,
    next: axum::middleware::Next,
) -> axum::response::Response {
    QUERIES
        .scope(Cell::new(0), async move {
            let mut response = next.run(request).await;
            let total = QUERIES.with(Cell::get);
            response.headers_mut().insert(HEADER, total.into());
            response
        })
        .await
}

/// The statement count a response reports, or `None` without the header.
pub fn of(response: &reqwest::Response) -> Option<u32> {
    response.headers().get(HEADER)?.to_str().ok()?.parse().ok()
}
