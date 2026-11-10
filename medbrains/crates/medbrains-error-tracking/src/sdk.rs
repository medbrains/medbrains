//! Starting the Sentry SDK, and tagging each request with who — opaquely —
//! it was for.

use std::net::IpAddr;
use std::sync::Arc;

use axum::body::Body;
use axum::extract::Request;
use axum::middleware::Next;
use axum::response::Response;
use medbrains_server_core::middleware::auth::Claims;
use sentry::integrations::tower::{NewSentryLayer, SentryHttpLayer};
use sentry::integrations::tracing::SentryLayer;
use sentry::protocol::User;
use sentry::{ClientInitGuard, ClientOptions, SessionMode, TransportFactory};
use sha2::{Digest, Sha256};
use tower::ServiceBuilder;
use tower::layer::util::{Identity, Stack};
use tracing_subscriber::registry::LookupSpan;

use crate::config::{Settings, remember};
use crate::envelope::ScrubbingHttp;

const MAX_BREADCRUMBS: usize = 30;

/// See [`http_layer`].
pub type HttpLayer = ServiceBuilder<
    Stack<SentryHttpLayer, Stack<NewSentryLayer<axum::http::Request<Body>>, Identity>>,
>;

/// The tower layers for the whole app: a hub per request (so one request's
/// scope never leaks into another's) and a transaction per sampled request,
/// named by its matched route rather than its URL.
pub fn http_layer() -> HttpLayer {
    ServiceBuilder::new()
        .layer(NewSentryLayer::new_from_top())
        .layer(SentryHttpLayer::new().enable_transaction())
}

/// ERROR log lines become error reports and lower ones breadcrumbs. A no-op
/// while error tracking is off.
pub fn tracing_layer<S>() -> SentryLayer<S>
where
    S: tracing::Subscriber + for<'a> LookupSpan<'a>,
{
    sentry::integrations::tracing::layer()
}

/// Start error tracking if `SENTRY_DSN` is set. Keep the guard for the life of
/// the process: dropping it flushes and stops the SDK.
pub fn init() -> Option<ClientInitGuard> {
    let settings = Settings::from_env().unwrap_or_else(|why| {
        tracing::warn!(%why, "error tracking is off");
        None
    });
    let guard = settings
        .as_ref()
        .map(|s| sentry::init(client_options(s, Arc::new(ScrubbingHttp))));
    if let Some(s) = &settings {
        tracing::info!(release = %s.release, environment = %s.environment, "error tracking on");
    }
    remember(settings);
    guard
}

/// Errors are all kept, traces sampled; no default PII; every envelope goes
/// through the scrubber on its way to `transport`.
pub(crate) fn client_options(
    settings: &Settings,
    transport: Arc<dyn TransportFactory>,
) -> ClientOptions {
    let mut options =
        ClientOptions::default().traces_sample_rate(settings.traces_sample_rate.clamp(0.0, 1.0));
    options.dsn = Some(settings.dsn.clone());
    options.release = Some(settings.release.clone().into());
    options.environment = Some(settings.environment.clone().into());
    options.send_default_pii = false;
    options.auto_session_tracking = true;
    options.session_mode = SessionMode::Request;
    options.max_breadcrumbs = MAX_BREADCRUMBS;
    options.transport = Some(transport);
    options
}

/// The id an error report carries for a user: never the account id itself.
/// The web computes the same hash, so one person's browser and server errors
/// line up.
#[must_use]
pub(crate) fn user_hash(user_id: &uuid::Uuid) -> String {
    let digest = Sha256::digest(user_id.to_string().as_bytes());
    hex::encode(digest).chars().take(32).collect()
}

/// Tag the request's error scope with the user hash, tenant and role. Sits
/// inside the auth middleware, where the claims are known.
pub async fn tag_scope(request: Request, next: Next) -> Response {
    if let Some(claims) = request.extensions().get::<Claims>() {
        let user = User {
            id: Some(user_hash(&claims.sub)),
            ..User::default()
        };
        let tenant = claims.tenant_id.to_string();
        sentry::configure_scope(|scope| {
            scope.set_user(Some(user));
            scope.set_tag("tenant_id", tenant);
            scope.set_tag("role", &claims.role);
        });
    }
    next.run(request).await
}

/// `true` when the DSN host is this machine or under this hospital's domain.
/// Anything else sends error reports — and whatever slipped past the
/// scrubber — off our own server.
#[must_use]
pub fn dsn_host_is_own(host: &str, own_domain: Option<&str>) -> bool {
    let host = host.trim_start_matches('[').trim_end_matches(']');
    let loopback = host.eq_ignore_ascii_case("localhost")
        || host.parse::<IpAddr>().is_ok_and(|ip| ip.is_loopback());
    let under_own = own_domain
        .map(str::trim)
        .filter(|d| !d.is_empty())
        .is_some_and(|d| host.eq_ignore_ascii_case(d) || host.ends_with(&format!(".{d}")));
    loopback || under_own
}

#[cfg(test)]
mod tests {
    use super::{dsn_host_is_own, user_hash};

    #[test]
    fn only_loopback_and_our_own_domain_count_as_our_host() {
        let own = Some("hims.example.in");
        assert!(dsn_host_is_own("127.0.0.1", own));
        assert!(dsn_host_is_own("[::1]", own));
        assert!(dsn_host_is_own("errors.hims.example.in", own));
        assert!(!dsn_host_is_own("o123.ingest.sentry.io", own));
        assert!(!dsn_host_is_own("evilhims.example.in", own));
        assert!(!dsn_host_is_own("errors.hims.example.in", None));
    }

    #[test]
    fn the_user_hash_is_opaque_and_stable() -> Result<(), uuid::Error> {
        let id = uuid::Uuid::parse_str("8f14e45f-ceea-467e-a2c2-0f6b4f5c1a01")?;
        let hash = user_hash(&id);
        assert_eq!(hash.len(), 32);
        assert_eq!(hash, user_hash(&id));
        assert!(!hash.contains("8f14e45f"));
        Ok(())
    }
}
