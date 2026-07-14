use std::sync::Arc;

use jsonwebtoken::{DecodingKey, EncodingKey};
use medbrains_authz::AuthzBackend;
use medbrains_db_topology::TopologyDispatcher;
use medbrains_outbox::Registry as OutboxRegistry;
use sqlx::PgPool;

use crate::middleware::system_state::SystemStateCache;
use crate::routes::ws::QueueBroadcaster;
use crate::s3_presign::S3PresignClient;

/// Cookie configuration for `HttpOnly` cookie-based auth.
#[derive(Debug, Clone)]
pub struct CookieConfig {
    pub domain: Option<String>,
    pub secure: bool,
    pub cors_origin: String,
}

/// Shared application state — available to all route handlers via Axum's `State` extractor.
#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub jwt_encoding_key: EncodingKey,
    pub jwt_decoding_key: DecodingKey,
    pub cookie_config: CookieConfig,
    /// Broadcaster for real-time TV display updates
    pub queue_broadcaster: QueueBroadcaster,
    /// Real-time notification fan-out hub (RFC-NOTIFICATION-SYSTEM). Every
    /// notification is published here for live WS delivery to web/mobile/TV/kiosk.
    pub notifications: crate::services::notification_hub::NotificationHub,
    /// Trusted proxy CIDRs for X-Forwarded-For validation.
    /// Only trust forwarded headers if the direct connection is from one of these networks.
    pub trusted_proxies: Arc<Vec<ipnet::IpNet>>,
    /// Sprint A.6: per-tenant system_state cache (normal/degraded/read_only).
    pub system_state_cache: Arc<SystemStateCache>,
    /// Sprint A.8: outbox handler registry for the worker.
    pub outbox: Arc<OutboxRegistry>,
    /// Sprint B.4.4: per-tenant DB topology router (Aurora vs Patroni).
    /// Routes that need a tenant-specific pool call
    /// `state.topology.writer_pool(tenant_id).await?` instead of
    /// consuming `state.db` directly. Existing call sites are unchanged
    /// — Aurora-default tenants still use `state.db`.
    pub topology: Arc<dyn TopologyDispatcher>,
    /// ReBAC backend (SpiceDB or Postgres-native fallback). Per-resource
    /// access checks: `state.authz.check(&ctx, Relation::Viewer, "patient", id)`.
    /// See `crates/medbrains-authz` and `infra/spicedb/schema.zed`.
    pub authz: Arc<dyn AuthzBackend>,
    /// Per-tenant secrets resolver — used by webhook handlers
    /// (NHCX callback, ABDM consent CM webhooks) that arrive without
    /// a JWT and need to look up tenant crypto material.
    pub secret_resolver: Arc<dyn medbrains_core::secrets::SecretResolver>,
    /// S3-compatible presigned URL generator. None when S3_BUCKET is not configured
    /// (dev/on-prem deployments that use local file storage).
    pub s3: Option<Arc<S3PresignClient>>,
    /// Headless-Chrome PDF renderer (None = documents API disabled).
    pub gotenberg: Option<medbrains_print::gotenberg::GotenbergClient>,
    /// Object storage for generated documents (LocalFs by default —
    /// zero-cost and on-prem native; S3-compatible adapter is a
    /// follow-up). Downloads stream through the authenticated API.
    pub documents_store: Arc<dyn medbrains_core::object_store::ObjectStore>,
}

impl std::fmt::Debug for AppState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("AppState")
            .field("db", &"PgPool")
            .field("jwt_encoding_key", &"[redacted]")
            .field("jwt_decoding_key", &"[redacted]")
            .field("cookie_config", &self.cookie_config)
            .field("queue_broadcaster", &self.queue_broadcaster)
            .field("trusted_proxies", &self.trusted_proxies.len())
            .field("system_state_cache", &"Arc<SystemStateCache>")
            .field("outbox", &"Arc<OutboxRegistry>")
            .field("topology", &"Arc<dyn TopologyDispatcher>")
            .field("authz", &"Arc<dyn AuthzBackend>")
            .field("s3", &self.s3.is_some())
            .finish()
    }
}
