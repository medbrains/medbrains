//! Authz write guard — rejects sharing / role / permission mutations
//! when the request originated from a tenant whose bridge agent is
//! reporting offline.
//!
//! Phase 10 of the hybrid roadmap. The bridge agent sets the
//! `X-Medbrains-Tunnel-Origin` header to `offline-tenant-<uuid>` when
//! it forwards a request during a WAN outage. Authz mutations
//! offline are out of scope per product call (see `RFC-INFRA-2026-001`
//! §authz / §offline-mode) — they always require online consensus.
//!
//! The middleware is path-scoped at registration time: only attach it
//! to the routes that mutate authz state.

use axum::{
    extract::Request,
    http::{Method, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;

const OFFLINE_HEADER: &str = "x-medbrains-tunnel-origin";
const OFFLINE_PREFIX: &str = "offline-tenant-";

/// Path prefixes whose mutations require online consensus. We avoid
/// matching every admin route — only authz / sharing / role
/// surfaces. Anything else (clinical writes etc.) is fine offline
/// because it's the data the edge is built to handle.
const GUARDED_PREFIXES: &[&str] = &[
    "/api/setup/roles",
    "/api/setup/users",
    "/api/sharing",
    "/api/admin/roles",
    "/api/admin/users",
];

#[derive(Debug, Serialize)]
pub struct OfflineDeniedBody {
    pub error: &'static str,
    pub retry_when: &'static str,
    pub message: &'static str,
}

/// Apply via `axum::middleware::from_fn` globally on the API router.
/// The middleware self-scopes to authz-mutation paths via
/// `GUARDED_PREFIXES`, so it's safe to attach once at the top level.
///
/// GET requests pass through unconditionally — read-during-offline
/// is fine, only writes to authz state are blocked.
pub async fn authz_write_guard(req: Request, next: Next) -> Response {
    if !is_mutation(req.method()) {
        return next.run(req).await;
    }
    if !is_guarded_path(req.uri().path()) {
        return next.run(req).await;
    }
    if !is_offline_origin(&req) {
        return next.run(req).await;
    }
    deny_offline_mutation()
}

fn is_guarded_path(path: &str) -> bool {
    GUARDED_PREFIXES.iter().any(|p| path.starts_with(p))
}

fn is_mutation(method: &Method) -> bool {
    matches!(*method, Method::POST | Method::PUT | Method::PATCH | Method::DELETE)
}

fn is_offline_origin(req: &Request) -> bool {
    req.headers()
        .get(OFFLINE_HEADER)
        .and_then(|v| v.to_str().ok())
        .is_some_and(|s| s.starts_with(OFFLINE_PREFIX))
}

fn deny_offline_mutation() -> Response {
    let body = OfflineDeniedBody {
        error: "offline_authz_write_denied",
        retry_when: "online",
        message: "Authz / sharing changes can't be applied while the tenant tunnel is offline. Reconnect to apply.",
    };
    (StatusCode::SERVICE_UNAVAILABLE, Json(body)).into_response()
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::HeaderValue;
    use axum::http::Request as HttpRequest;
    use axum::middleware::from_fn;
    use axum::routing::{get, post};
    use axum::Router;
    use tower::ServiceExt;

    fn app() -> Router {
        Router::new()
            .route("/api/admin/roles", post(|| async { "ok" }).get(|| async { "list" }))
            .route("/api/admin/roles/{id}", axum::routing::put(|| async { "ok" }))
            .route("/api/clinical/patient-notes/{id}", axum::routing::put(|| async { "ok" }))
            .layer(from_fn(authz_write_guard))
    }

    fn req(method: Method, path: &str, offline: bool) -> HttpRequest<Body> {
        let mut builder = HttpRequest::builder().method(method).uri(path);
        if offline {
            builder = builder.header(
                OFFLINE_HEADER,
                HeaderValue::from_static("offline-tenant-abc"),
            );
        }
        builder.body(Body::empty()).unwrap()
    }

    #[tokio::test]
    async fn online_post_passes() {
        let resp = app()
            .oneshot(req(Method::POST, "/api/admin/roles", false))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn offline_post_denied() {
        let resp = app()
            .oneshot(req(Method::POST, "/api/admin/roles", true))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::SERVICE_UNAVAILABLE);
    }

    #[tokio::test]
    async fn offline_put_denied() {
        let resp = app()
            .oneshot(req(Method::PUT, "/api/admin/roles/abc", true))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::SERVICE_UNAVAILABLE);
    }

    #[tokio::test]
    async fn offline_get_passes() {
        let resp = app()
            .oneshot(req(Method::GET, "/api/admin/roles", true))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn offline_clinical_path_passes() {
        // Authz guard MUST NOT block clinical writes — the whole
        // point of offline mode is that those work locally.
        let resp = app()
            .oneshot(req(Method::PUT, "/api/clinical/patient-notes/p1", true))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn unrelated_header_value_passes() {
        // X-Medbrains-Tunnel-Origin can also carry "online-tenant-..."
        // for normal traffic — the prefix check ensures we only block
        // when it's the offline-marker.
        let mut r = req(Method::POST, "/api/admin/roles", false);
        r.headers_mut().insert(
            OFFLINE_HEADER,
            HeaderValue::from_static("online-tenant-abc"),
        );
        let resp = app().oneshot(r).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
    }
}
