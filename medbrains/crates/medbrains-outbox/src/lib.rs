//! `medbrains-outbox` — durable async queue for external integrations.
//!
//! Sprint A foundation per `RFCs/sprints/SPRINT-A-outbox.md`. Every external
//! HTTP call (Razorpay, Twilio, ABDM, TPA, HL7, SMTP) writes to
//! `outbox_events` inside the caller's transaction, then a background worker
//! drains the queue with jittered backoff. After 10 attempts the event moves
//! to `outbox_dlq`.
//!
//! Public API for callers (write side):
//! ```ignore
//! outbox::queue_in_tx(tx, OutboxRow {
//!     tenant_id, aggregate_type: "payment_gateway_transaction",
//!     aggregate_id: txn.id, event_type: "payment.create_order",
//!     payload: json!({...}),
//!     idempotency_key: Some(txn.id.to_string()),
//! }).await?;
//! ```
//!
//! Worker side: `Worker::spawn(pool, registry)` — see `worker.rs`.
//! Handler trait + Registry: see `handler.rs`.

pub mod backoff;
pub mod handler;
pub mod handlers;
pub mod metrics;
pub mod queue;
pub mod worker;

pub use handler::{Handler, HandlerCtx, HandlerError, Registry};
pub use queue::{queue_in_tx, OutboxRow};
pub use worker::{Worker, WorkerConfig};

use thiserror::Error;

#[derive(Debug, Error)]
pub enum OutboxError {
    #[error("queue write failed: {0}")]
    QueueWrite(#[from] sqlx::Error),

    #[error("handler not registered for event_type {0}")]
    HandlerNotFound(String),

    #[error("worker shutdown")]
    Shutdown,

    #[error("outbox: {0}")]
    Other(String),
}
