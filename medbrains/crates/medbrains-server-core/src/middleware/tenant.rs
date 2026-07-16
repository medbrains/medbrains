use axum::{middleware::Next, response::Response};

use crate::middleware::auth::Claims;

/// Tenant middleware — extracts `tenant_id` from JWT claims and stores it
/// in request extensions. RLS is now set per-transaction in handlers (not here).
pub async fn tenant_middleware(request: axum::extract::Request, next: Next) -> Response {
    // Claims are already injected by auth_middleware.
    // Handlers use claims.tenant_id to set RLS within their transactions.
    // This middleware exists as a hook point for future tenant-level logic
    // (rate limiting, feature flags, etc.).
    if let Some(claims) = request.extensions().get::<Claims>() {
        tracing::debug!(tenant_id = %claims.tenant_id, "tenant context");
    }

    next.run(request).await
}
