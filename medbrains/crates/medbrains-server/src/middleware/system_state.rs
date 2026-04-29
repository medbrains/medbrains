//! System state middleware — surfaces tenant operating mode (normal /
//! degraded / read_only) and short-circuits non-GET requests when the
//! mode is read_only or when degraded + path not in the allowlist.
//!
//! Sprint A spec: `RFCs/sprints/SPRINT-A-outbox.md` §7.

use axum::{
    extract::{Request, State},
    http::{Method, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::{Duration, Instant};
use uuid::Uuid;

use crate::{middleware::auth::Claims, state::AppState};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum SystemMode {
    Normal,
    Degraded,
    ReadOnly,
}

impl SystemMode {
    fn parse(s: &str) -> Self {
        match s {
            "degraded" => Self::Degraded,
            "read_only" => Self::ReadOnly,
            _ => Self::Normal,
        }
    }
}

#[derive(Debug, Clone)]
struct CachedState {
    mode: SystemMode,
    since: chrono::DateTime<chrono::Utc>,
    reason: Option<String>,
    fetched_at: Instant,
}

/// Per-process cache of tenant → system_state. Refresh window is 30s.
/// Admin updates broadcast via `state.queue_broadcaster` so all in-flight
/// middleware refreshes within ~1s of an admin flip.
#[derive(Debug, Default)]
pub struct SystemStateCache {
    inner: RwLock<HashMap<Uuid, CachedState>>,
}

impl SystemStateCache {
    pub fn new() -> Arc<Self> {
        Arc::new(Self::default())
    }

    /// Force-evict the cache entry for a tenant (called by admin endpoint
    /// on flip; broadcast over queue_broadcaster so every replica picks it up).
    pub fn invalidate(&self, tenant_id: Uuid) {
        if let Ok(mut map) = self.inner.write() {
            map.remove(&tenant_id);
        }
    }

    fn read_cached(&self, tenant_id: Uuid) -> Option<CachedState> {
        let map = self.inner.read().ok()?;
        let cached = map.get(&tenant_id)?.clone();
        if cached.fetched_at.elapsed() > Duration::from_secs(30) {
            return None;
        }
        Some(cached)
    }

    fn write(&self, tenant_id: Uuid, state: CachedState) {
        if let Ok(mut map) = self.inner.write() {
            map.insert(tenant_id, state);
        }
    }
}

/// Allowlist of routes still permitted in `degraded` mode. Patient-care
/// flows continue; financial / admin / non-critical writes 503.
const DEGRADED_ALLOWLIST: &[&str] = &[
    // Patient registration — always allowed
    "/api/patients",
    // Vitals + nursing — clinical safety
    "/api/vitals",
    "/api/nursing-notes",
    // Drug administration MAR — patient safety
    "/api/mar",
    // Auth — staff must be able to log in even degraded
    "/api/auth/refresh",
    "/api/auth/logout",
    // System-state itself — admin must be able to flip mode back
    "/api/admin/system_state",
];

/// Mounted as `axum::middleware::from_fn_with_state` after auth so claims
/// are available. Must be inner to auth in the layer stack.
pub async fn system_state_layer(
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Response {
    // GETs always pass — read_only blocks WRITES, not READS
    if *request.method() == Method::GET {
        return next.run(request).await;
    }

    let Some(claims) = request.extensions().get::<Claims>().cloned() else {
        // No claims → upstream auth failed; just pass through, auth_middleware
        // will have already returned 401
        return next.run(request).await;
    };

    let path = request.uri().path().to_owned();
    let mode = resolve_mode(&state, &claims).await;

    let block = match mode.mode {
        SystemMode::Normal => false,
        SystemMode::ReadOnly => true,
        SystemMode::Degraded => !is_allowlisted(&path),
    };

    if block {
        let body = SystemStateBlocked {
            error: match mode.mode {
                SystemMode::ReadOnly => "system_read_only",
                SystemMode::Degraded => "system_degraded",
                _ => "system_unavailable",
            },
            mode: mode.mode,
            since: mode.since,
            reason: mode.reason.clone(),
        };
        return (StatusCode::SERVICE_UNAVAILABLE, Json(body)).into_response();
    }

    next.run(request).await
}

#[derive(Debug, Serialize)]
struct SystemStateBlocked {
    error: &'static str,
    mode: SystemMode,
    since: chrono::DateTime<chrono::Utc>,
    reason: Option<String>,
}

async fn resolve_mode(state: &AppState, claims: &Claims) -> CachedState {
    let cache = state.system_state_cache.clone();
    if let Some(c) = cache.read_cached(claims.tenant_id) {
        return c;
    }
    let fetched = fetch_mode(state, claims.tenant_id).await;
    cache.write(claims.tenant_id, fetched.clone());
    fetched
}

async fn fetch_mode(state: &AppState, tenant_id: Uuid) -> CachedState {
    // allow-raw-sql: middleware-level read of per-tenant operating mode.
    // Cannot use a typed db helper here without circular dep; this is one
    // narrow query. RLS unaffected — system_state is per-tenant.
    let mut tx = match state.db.begin().await {
        Ok(t) => t,
        Err(e) => {
            tracing::error!(error = %e, "system_state fetch begin failed; defaulting to normal");
            return CachedState {
                mode: SystemMode::Normal,
                since: chrono::Utc::now(),
                reason: None,
                fetched_at: Instant::now(),
            };
        }
    };
    let _ = sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
        .bind(tenant_id.to_string())
        .execute(&mut *tx)
        .await;

    let row: Option<(String, chrono::DateTime<chrono::Utc>, Option<String>)> = sqlx::query_as(
        "SELECT mode, since, reason FROM system_state WHERE tenant_id = $1 LIMIT 1",
    )
    .bind(tenant_id)
    .fetch_optional(&mut *tx)
    .await
    .unwrap_or(None);

    let _ = tx.commit().await;

    match row {
        Some((mode, since, reason)) => CachedState {
            mode: SystemMode::parse(&mode),
            since,
            reason,
            fetched_at: Instant::now(),
        },
        None => CachedState {
            mode: SystemMode::Normal,
            since: chrono::Utc::now(),
            reason: None,
            fetched_at: Instant::now(),
        },
    }
}

fn is_allowlisted(path: &str) -> bool {
    DEGRADED_ALLOWLIST
        .iter()
        .any(|prefix| path == *prefix || path.starts_with(&format!("{prefix}/")))
}
