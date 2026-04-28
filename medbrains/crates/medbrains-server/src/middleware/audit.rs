//! HTTP-level audit emission middleware.
//!
//! Wraps every state-changing request (POST/PUT/PATCH/DELETE) and emits
//! an `audit_log` row on 2xx response. Carries a `correlation_id` UUID
//! so DB-trigger emissions for the same operation are deduplicated.
//!
//! The middleware does NOT block the response — emission is spawned on
//! a tokio task. If the database is briefly unavailable the audit is
//! lost (logged at error level). For critical flows (NDPS dispense,
//! consent change, etc.) handlers should ALSO call `AuditLogger::log`
//! inside their main tx for guaranteed coupling.

use axum::{
    extract::{Request, State},
    http::Method,
    middleware::Next,
    response::Response,
};
use medbrains_db::audit::{AuditLogger, HttpAuditEntry};
use uuid::Uuid;

use crate::{
    middleware::{auth::Claims, client_ip::ClientIp},
    state::AppState,
};

/// AuditLayer — axum function-style middleware. Mount via
/// `axum::middleware::from_fn_with_state(state.clone(), audit_layer)`.
///
/// Behaviour:
///   1. On state-changing methods (POST/PUT/PATCH/DELETE), generate a
///      `correlation_id` UUID.
///   2. Inject the correlation_id into request extensions so handlers
///      that open their own tx can `set_config('app.correlation_id', ...)`
///      to dedupe with the trigger-side emission.
///   3. After the handler returns, if status is 2xx, spawn a task to
///      insert an `audit_log` row via `AuditLogger::log_http`.
pub async fn audit_layer(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Response {
    let method = request.method().clone();
    let is_state_change = matches!(
        method,
        Method::POST | Method::PUT | Method::PATCH | Method::DELETE,
    );

    if !is_state_change {
        return next.run(request).await;
    }

    let correlation_id = Uuid::new_v4();
    request.extensions_mut().insert(CorrelationId(correlation_id));

    // Snapshot context BEFORE handler runs (extensions may move)
    let claims_opt = request.extensions().get::<Claims>().cloned();
    let ip_opt = request
        .extensions()
        .get::<ClientIp>()
        .map(ClientIp::as_str);
    let user_agent = request
        .headers()
        .get(axum::http::header::USER_AGENT)
        .and_then(|v| v.to_str().ok())
        .map(str::to_owned);
    let path = request.uri().path().to_owned();
    let method_str = method.as_str().to_owned();

    let response = next.run(request).await;
    let status = response.status();

    // Only audit successful state changes. 4xx/5xx are noise; auth
    // emits its own entries for failed-login etc.
    if !status.is_success() {
        return response;
    }

    // Need claims to write audit (audit_log.tenant_id is NOT NULL)
    let Some(claims) = claims_opt else {
        return response;
    };

    let entry = HttpAuditEntry {
        tenant_id: claims.tenant_id,
        user_id: Some(claims.sub),
        correlation_id,
        action: derive_action(&method_str, &path),
        entity_type: derive_entity_type(&path),
        entity_id: derive_entity_id(&path),
        ip_address: ip_opt,
        user_agent,
        session_id: None, // populated when session middleware lands
        module: derive_module(&path),
        status_code: status.as_u16(),
        method: method_str,
    };

    let pool = state.db.clone();
    tokio::spawn(async move {
        if let Err(e) = AuditLogger::log_http(&pool, &entry).await {
            tracing::error!(
                error = %e,
                tenant_id = %entry.tenant_id,
                action = %entry.action,
                "audit_layer: failed to emit audit_log row"
            );
        }
    });

    response
}

/// Wraps the per-request correlation ID. Stored in request extensions so
/// handlers that emit their own `audit_log` rows (in their main tx) can
/// fetch this via `Extension<CorrelationId>` and dedupe with the
/// middleware emission and DB trigger emission.
#[derive(Debug, Clone, Copy)]
pub struct CorrelationId(pub Uuid);

/// Derive a coarse action verb from method + path.
/// Examples:
///   POST   /api/patients      → "create_patients"
///   PUT    /api/patients/:id  → "update_patients"
///   DELETE /api/patients/:id  → "delete_patients"
///   PATCH  /api/labs/:id/finalize → "finalize_labs"
fn derive_action(method: &str, path: &str) -> String {
    let segments: Vec<&str> = path.trim_start_matches("/api/").split('/').collect();
    let resource = segments.first().copied().unwrap_or("unknown");
    // Detect terminal verb segment (e.g., "/finalize", "/approve") for PATCH/POST sub-routes
    let terminal_verb = segments
        .last()
        .filter(|s| !s.is_empty() && !is_uuid_like(s))
        .filter(|_| segments.len() > 2)
        .copied();
    match method {
        "POST" => terminal_verb
            .map(|v| format!("{v}_{resource}"))
            .unwrap_or_else(|| format!("create_{resource}")),
        "PUT" => format!("update_{resource}"),
        "PATCH" => terminal_verb
            .map(|v| format!("{v}_{resource}"))
            .unwrap_or_else(|| format!("patch_{resource}")),
        "DELETE" => format!("delete_{resource}"),
        _ => format!("{}_{resource}", method.to_lowercase()),
    }
}

/// First path segment after `/api/` is the entity type.
fn derive_entity_type(path: &str) -> String {
    path.trim_start_matches("/api/")
        .split('/')
        .next()
        .unwrap_or("unknown")
        .to_owned()
}

/// If the second path segment looks like a UUID, treat it as the entity id.
fn derive_entity_id(path: &str) -> Option<Uuid> {
    let segments: Vec<&str> = path.trim_start_matches("/api/").split('/').collect();
    segments.get(1).and_then(|s| Uuid::parse_str(s).ok())
}

/// Module name = first path segment after `/api/`. Mirrors `entity_type`
/// today but kept separate so we can override per-route later.
fn derive_module(path: &str) -> Option<String> {
    let m = derive_entity_type(path);
    if m == "unknown" { None } else { Some(m) }
}

fn is_uuid_like(s: &str) -> bool {
    s.len() == 36 && s.chars().filter(|c| *c == '-').count() == 4
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_action_default() {
        assert_eq!(derive_action("POST", "/api/patients"), "create_patients");
    }

    #[test]
    fn update_action_default() {
        assert_eq!(derive_action("PUT", "/api/patients/abc"), "update_patients");
    }

    #[test]
    fn delete_action_default() {
        assert_eq!(derive_action("DELETE", "/api/patients/abc"), "delete_patients");
    }

    #[test]
    fn terminal_verb_action() {
        assert_eq!(
            derive_action(
                "POST",
                "/api/lab/orders/550e8400-e29b-41d4-a716-446655440000/finalize"
            ),
            "finalize_lab"
        );
    }

    #[test]
    fn entity_type_first_segment() {
        assert_eq!(derive_entity_type("/api/patients/abc"), "patients");
    }

    #[test]
    fn entity_id_uuid_segment() {
        let p = "/api/patients/550e8400-e29b-41d4-a716-446655440000";
        assert!(derive_entity_id(p).is_some());
    }

    #[test]
    fn entity_id_non_uuid_none() {
        assert!(derive_entity_id("/api/patients/list").is_none());
    }
}
