//! Per-tenant edge-node fan-out for cloud-originated frames.
//!
//! The bridge_pusher holds a registry of `tenant_id → BridgeSink` and
//! exposes a single `push_invalidate()` entrypoint that
//! [`spicedb_watch`] (and any future cloud-side producer) call when
//! something needs to reach an edge node. The actual transport — a
//! WebSocket inside the Headscale tailnet — is hidden behind the
//! [`BridgeSink`] trait so the unit tests below can drive the
//! invalidation logic without standing up a tunnel.
//!
//! Phase 9 of the hybrid roadmap. The edge already accepts
//! `Frame::CacheInvalidate` (Phase 1, PR #9 commit 96389f4); this
//! module is the cloud half of that pair.

use async_trait::async_trait;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Arc;
use thiserror::Error;
use tokio::sync::RwLock;
use uuid::Uuid;

/// SpiceDB tuple identity. Mirrors `medbrains_edge::CacheKey` so we
/// can serialize once and have the edge recognize it on the wire
/// without further translation.
///
/// We deliberately do NOT depend on the edge crate here — the cloud
/// shouldn't pull `sled` + `lru` for what is fundamentally a small
/// serializable struct.
#[derive(Debug, Clone, Hash, Eq, PartialEq, Serialize)]
pub struct InvalidationKey {
    pub tenant_id: Uuid,
    pub user_id: Uuid,
    pub object_type: String,
    pub object_id: String,
    pub action: String,
}

/// Wire frame the edge consumes. Match `medbrains_edge::sync::Frame`
/// `CacheInvalidate` variant exactly.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum BridgeFrame {
    CacheInvalidate { keys: Vec<InvalidationKey> },
}

/// Sink for a single tenant's edge tunnel. Real implementation wraps
/// a `tokio_tungstenite::WebSocketStream`; tests use an in-memory
/// channel. The trait keeps the pusher's logic transport-agnostic.
#[async_trait]
pub trait BridgeSink: Send + Sync + 'static {
    async fn send(&self, frame: BridgeFrame) -> Result<(), BridgeError>;
}

#[derive(Debug, Error)]
pub enum BridgeError {
    #[error("tunnel offline")]
    TunnelOffline,

    #[error("tenant {0} has no registered sink")]
    UnknownTenant(Uuid),

    #[error("transport: {0}")]
    Transport(String),
}

/// Cloud → edge fan-out. Cheap to clone — `Arc` inside.
#[derive(Clone, Default)]
pub struct BridgePusher {
    sinks: Arc<RwLock<HashMap<Uuid, Arc<dyn BridgeSink>>>>,
}

impl std::fmt::Debug for BridgePusher {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("BridgePusher").finish_non_exhaustive()
    }
}

impl BridgePusher {
    pub fn new() -> Self {
        Self::default()
    }

    /// Register a sink for a tenant. Replaces any existing entry —
    /// callers that need reconnection semantics should drop the old
    /// sink first.
    pub async fn register(&self, tenant_id: Uuid, sink: Arc<dyn BridgeSink>) {
        let mut guard = self.sinks.write().await;
        guard.insert(tenant_id, sink);
    }

    pub async fn unregister(&self, tenant_id: Uuid) {
        let mut guard = self.sinks.write().await;
        guard.remove(&tenant_id);
    }

    pub async fn registered_count(&self) -> usize {
        self.sinks.read().await.len()
    }

    /// Group keys by `tenant_id` and forward each tenant's slice to
    /// its sink. Errors per-tenant are logged and counted but don't
    /// abort the broadcast — a flaky tenant must not stop other
    /// tenants from being told about their own changes.
    pub async fn push_invalidate(
        &self,
        keys: Vec<InvalidationKey>,
    ) -> PushOutcome {
        let mut by_tenant: HashMap<Uuid, Vec<InvalidationKey>> = HashMap::new();
        for k in keys {
            by_tenant.entry(k.tenant_id).or_default().push(k);
        }

        let sinks = self.sinks.read().await;
        let mut outcome = PushOutcome::default();
        for (tenant_id, tenant_keys) in by_tenant {
            let count = tenant_keys.len();
            let Some(sink) = sinks.get(&tenant_id) else {
                outcome.unknown_tenants += 1;
                tracing::debug!(
                    %tenant_id,
                    keys = count,
                    "bridge_pusher: no sink registered, dropping invalidation"
                );
                continue;
            };
            match sink.send(BridgeFrame::CacheInvalidate { keys: tenant_keys }).await {
                Ok(()) => {
                    outcome.delivered_tenants += 1;
                    outcome.delivered_keys += count;
                }
                Err(err) => {
                    outcome.failed_tenants += 1;
                    tracing::warn!(
                        %tenant_id,
                        keys = count,
                        ?err,
                        "bridge_pusher: invalidation send failed"
                    );
                }
            }
        }
        outcome
    }
}

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub struct PushOutcome {
    pub delivered_tenants: usize,
    pub delivered_keys: usize,
    pub failed_tenants: usize,
    pub unknown_tenants: usize,
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use tokio::sync::Mutex;

    #[derive(Default)]
    struct CapturingSink {
        sent: Mutex<Vec<BridgeFrame>>,
    }

    #[async_trait]
    impl BridgeSink for CapturingSink {
        async fn send(&self, frame: BridgeFrame) -> Result<(), BridgeError> {
            self.sent.lock().await.push(frame);
            Ok(())
        }
    }

    struct FailingSink {
        attempts: AtomicUsize,
    }
    #[async_trait]
    impl BridgeSink for FailingSink {
        async fn send(&self, _frame: BridgeFrame) -> Result<(), BridgeError> {
            self.attempts.fetch_add(1, Ordering::SeqCst);
            Err(BridgeError::TunnelOffline)
        }
    }

    fn key(tenant_id: Uuid, action: &str) -> InvalidationKey {
        InvalidationKey {
            tenant_id,
            user_id: Uuid::new_v4(),
            object_type: "patient".into(),
            object_id: "p1".into(),
            action: action.into(),
        }
    }

    #[tokio::test]
    async fn push_groups_keys_by_tenant() {
        let pusher = BridgePusher::new();
        let t1 = Uuid::new_v4();
        let t2 = Uuid::new_v4();
        let s1 = Arc::new(CapturingSink::default());
        let s2 = Arc::new(CapturingSink::default());
        pusher.register(t1, s1.clone()).await;
        pusher.register(t2, s2.clone()).await;

        let outcome = pusher
            .push_invalidate(vec![
                key(t1, "read"),
                key(t1, "write"),
                key(t2, "read"),
            ])
            .await;

        assert_eq!(outcome.delivered_tenants, 2);
        assert_eq!(outcome.delivered_keys, 3);
        assert_eq!(outcome.failed_tenants, 0);
        assert_eq!(outcome.unknown_tenants, 0);

        let s1_frames = s1.sent.lock().await;
        let s2_frames = s2.sent.lock().await;
        assert_eq!(s1_frames.len(), 1);
        let BridgeFrame::CacheInvalidate { keys } = &s1_frames[0];
        assert_eq!(keys.len(), 2);
        let BridgeFrame::CacheInvalidate { keys: keys2 } = &s2_frames[0];
        assert_eq!(keys2.len(), 1);
    }

    #[tokio::test]
    async fn unknown_tenant_is_counted_not_fatal() {
        let pusher = BridgePusher::new();
        let known = Uuid::new_v4();
        let unknown = Uuid::new_v4();
        let sink = Arc::new(CapturingSink::default());
        pusher.register(known, sink.clone()).await;

        let outcome = pusher
            .push_invalidate(vec![key(known, "read"), key(unknown, "read")])
            .await;

        assert_eq!(outcome.delivered_tenants, 1);
        assert_eq!(outcome.unknown_tenants, 1);
        assert_eq!(outcome.failed_tenants, 0);
        assert_eq!(sink.sent.lock().await.len(), 1);
    }

    #[tokio::test]
    async fn failing_sink_does_not_block_others() {
        let pusher = BridgePusher::new();
        let healthy_id = Uuid::new_v4();
        let broken_id = Uuid::new_v4();
        let healthy = Arc::new(CapturingSink::default());
        let broken = Arc::new(FailingSink { attempts: AtomicUsize::new(0) });
        pusher.register(healthy_id, healthy.clone()).await;
        pusher.register(broken_id, broken.clone()).await;

        let outcome = pusher
            .push_invalidate(vec![key(healthy_id, "read"), key(broken_id, "read")])
            .await;

        assert_eq!(outcome.delivered_tenants, 1);
        assert_eq!(outcome.failed_tenants, 1);
        assert_eq!(broken.attempts.load(Ordering::SeqCst), 1);
        assert_eq!(healthy.sent.lock().await.len(), 1);
    }

    #[tokio::test]
    async fn unregister_drops_tenant() {
        let pusher = BridgePusher::new();
        let t = Uuid::new_v4();
        let sink = Arc::new(CapturingSink::default());
        pusher.register(t, sink.clone()).await;
        assert_eq!(pusher.registered_count().await, 1);
        pusher.unregister(t).await;
        assert_eq!(pusher.registered_count().await, 0);

        let outcome = pusher.push_invalidate(vec![key(t, "read")]).await;
        assert_eq!(outcome.unknown_tenants, 1);
        assert_eq!(outcome.delivered_tenants, 0);
    }
}
