//! Module-entitlement enforcement — makes the deployment edition (`hospital_type`) a REAL boundary
//! rather than a cosmetic one.
//!
//! Each tenant's edition seeds a `module_config` row per module with a `status`
//! (`available` / `enabled` / `disabled`); the onboarding wizard and the admin Modules screen let an
//! operator toggle it. Until now the edition only drove which modules the **frontend** shows in the
//! nav — the API for a disabled module still answered if called directly. That makes tiered editions
//! unenforceable: a "Small Clinic" deployment could still reach the eye-hospital, OT or research
//! endpoints. This guard closes that: a module route calls `require_module_enabled` and a request to
//! a module the tenant has switched off is refused.
//!
//! This is a **per-tenant licensing** gate, not a per-user permission — so bypass roles
//! (`super_admin` / `hospital_admin`) do NOT bypass it. A small-clinic admin still did not license
//! the specialty module. It composes on top of `require_permission` (which handles user authority)
//! and RLS (which handles tenancy).
//!
//! Three outcomes, not two (#4891). A database fault is `Unknown` and answers 503 — it never
//! grants a module (the old fail-open) and never refuses one as if unlicensed. Edition modules
//! treat an absent row as on; licensed add-ons (`medbrains_core::onboarding::ADD_ON_MODULES`)
//! need an explicit `enabled`.
//!
//! A brick counts as on only when it **and every brick it needs** (`bricks::with_dependencies`)
//! is on: Pharmacy with Registration switched off answers 403, as the Modules screen would make
//! it. Statuses are read once per tenant into [`CACHE`] for [`TTL`]; a fault is never cached.

use std::collections::HashMap;
use std::hash::BuildHasher;
use std::sync::{Mutex, PoisonError};
use std::time::{Duration, Instant};

use axum::Router;
use axum::extract::{Request, State};
use axum::middleware::{Next, from_fn_with_state};
use axum::response::{IntoResponse, Response};
use medbrains_authz::decision::Outcome;
use medbrains_core::bricks;
use medbrains_core::onboarding::is_add_on_module;
use medbrains_db::pool::DbError;
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;
use crate::middleware::auth::Claims;
use crate::state::AppState;

/// How long a tenant's module statuses are trusted before they are read again. Another server
/// sees a Modules-screen change within this long; the server that made it sees it at once.
const TTL: Duration = Duration::from_secs(30);
/// Tenants held at most. Past it, expired entries go first, then everything.
const MAX_TENANTS: usize = 4096;

/// One tenant's `module_config` statuses, as read at `read_at`.
struct Statuses {
    read_at: Instant,
    by_code: HashMap<String, String>,
}

/// Per-tenant module statuses. A `std` mutex: it is never held across an `.await`.
static CACHE: Mutex<Option<HashMap<Uuid, Statuses>>> = Mutex::new(None);

/// Pure decision from the stored module status (if any).
///
/// `disabled` always refuses and `enabled` always allows. Anything else — no row, `available`,
/// `coming_soon` — allows an edition module (the auth `disabled_modules` contract: absent = on)
/// and refuses a licensed add-on, which nobody has bought until an operator enables it.
fn module_outcome(code: &str, status: Option<&str>) -> Outcome {
    match status {
        Some("disabled") => Outcome::Deny,
        Some("enabled") => Outcome::Allow,
        _ if is_add_on_module(code) => Outcome::Deny,
        _ => Outcome::Allow,
    }
}

/// Whether `code` is on given every status of the tenant: it and every brick it needs.
/// A code that is not a brick is judged on its own row.
pub fn effective_outcome<S: BuildHasher>(
    code: &str,
    by_code: &HashMap<String, String, S>,
) -> Outcome {
    let mut needed = bricks::with_dependencies(&[code]);
    if needed.is_empty() {
        return module_outcome(code, by_code.get(code).map(String::as_str));
    }
    needed.retain(|id| module_outcome(id, by_code.get(*id).map(String::as_str)) == Outcome::Deny);
    if needed.is_empty() {
        Outcome::Allow
    } else {
        Outcome::Deny
    }
}

/// What stops `code` being switched on (`turning_on`) or off.
///
/// Switching off, the bricks that are on and need it; switching on, the bricks it needs that are
/// off. Empty means the switch may go ahead. Names come back as brick names, in table order.
pub fn switch_blockers<S: BuildHasher>(
    code: &str,
    turning_on: bool,
    by_code: &HashMap<String, String, S>,
) -> Vec<&'static str> {
    let ids: Vec<&'static str> = if turning_on {
        bricks::with_dependencies(&[code])
            .into_iter()
            .filter(|id| *id != code)
            .filter(|id| module_outcome(id, by_code.get(*id).map(String::as_str)) == Outcome::Deny)
            .collect()
    } else {
        bricks::dependents(code)
            .into_iter()
            .filter(|id| effective_outcome(id, by_code) == Outcome::Allow)
            .collect()
    };
    ids.into_iter()
        .filter_map(bricks::find)
        .map(|b| b.name)
        .collect()
}

/// Every live `module_config` status of a tenant. Bounded by the module table (one row per
/// module).
pub async fn read_statuses(
    db: &PgPool,
    tenant_id: Uuid,
) -> Result<HashMap<String, String>, DbError> {
    let mut conn = medbrains_db::pool::tenant_conn(db, &tenant_id).await?;
    let rows: Vec<(String, String)> = sqlx::query_as(
        "SELECT code, status::text FROM module_config \
         WHERE tenant_id = $1 AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .fetch_all(&mut *conn)
    .await?;
    Ok(rows.into_iter().collect())
}

/// The cached outcome for `code`, when the tenant's statuses are fresh.
fn cached_outcome(tenant_id: Uuid, code: &str) -> Option<Outcome> {
    CACHE
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .as_ref()?
        .get(&tenant_id)
        .filter(|entry| entry.read_at.elapsed() < TTL)
        .map(|entry| effective_outcome(code, &entry.by_code))
}

/// Stores a successful read, keeping the cache within [`MAX_TENANTS`].
fn remember(tenant_id: Uuid, by_code: HashMap<String, String>) {
    let mut guard = CACHE.lock().unwrap_or_else(PoisonError::into_inner);
    let map = guard.get_or_insert_with(HashMap::new);
    if map.len() >= MAX_TENANTS {
        map.retain(|_, entry| entry.read_at.elapsed() < TTL);
    }
    if map.len() >= MAX_TENANTS {
        // ponytail: drop everything when full of live entries; an LRU if 4096 busy tenants
        // on one server ever happens.
        map.clear();
    }
    map.insert(
        tenant_id,
        Statuses {
            read_at: Instant::now(),
            by_code,
        },
    );
    drop(guard);
}

/// Forgets a tenant's cached statuses. Call after any write to its `module_config`.
pub fn invalidate_modules(tenant_id: Uuid) {
    if let Some(map) = CACHE
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .as_mut()
    {
        map.remove(&tenant_id);
    }
}

/// Whether the tenant has module `code`. A database fault is `Unknown` — never on, never off —
/// and is not cached, so the next request reads again.
pub async fn module_entitlement(db: &PgPool, tenant_id: Uuid, code: &str) -> Outcome {
    if let Some(outcome) = cached_outcome(tenant_id, code) {
        return outcome;
    }
    match read_statuses(db, tenant_id).await {
        Ok(by_code) => {
            let outcome = effective_outcome(code, &by_code);
            remember(tenant_id, by_code);
            outcome
        }
        Err(err) => {
            tracing::error!(target: "authz", error = %err, module = code,
                "module entitlement unreadable — refusing as 503, not as unlicensed");
            Outcome::Unknown
        }
    }
}

/// Require the tenant to have module `code`. `403` when it is disabled (or an add-on not
/// enabled), `503` when the licence could not be read. Call it after `require_permission`.
pub async fn require_module_enabled(
    db: &PgPool,
    tenant_id: Uuid,
    code: &str,
) -> Result<(), AppError> {
    match module_entitlement(db, tenant_id, code).await {
        Outcome::Allow => Ok(()),
        Outcome::Deny => Err(AppError::Forbidden),
        Outcome::Unknown => Err(AppError::ServiceUnavailable(format!(
            "could not check whether the {code} module is licensed — try again shortly"
        ))),
    }
}

/// Puts a whole brick's router behind its module switch.
///
/// Every route answers 403 while the brick is off and 503 while its status cannot be read. A
/// request without `Claims` (a public route) passes untouched — its handler decides. Bypass roles do not bypass it: it is
/// licensing, not authority. A route layer, so it runs after the auth layer has set `Claims`.
pub fn gated(code: &'static str, router: Router<AppState>, state: &AppState) -> Router<AppState> {
    router.route_layer(from_fn_with_state((state.clone(), code), brick_gate))
}

/// The middleware behind [`gated`].
async fn brick_gate(
    State((state, code)): State<(AppState, &'static str)>,
    request: Request,
    next: Next,
) -> Response {
    let Some(tenant_id) = request.extensions().get::<Claims>().map(|c| c.tenant_id) else {
        return next.run(request).await;
    };
    match require_module_enabled(&state.db, tenant_id, code).await {
        Ok(()) => next.run(request).await,
        Err(err) => err.into_response(),
    }
}

#[cfg(test)]
mod tests {
    use medbrains_authz::decision::Outcome;

    use std::collections::HashMap;

    use super::{effective_outcome, module_outcome, switch_blockers};

    fn statuses(rows: &[(&str, &str)]) -> HashMap<String, String> {
        rows.iter()
            .map(|(c, s)| ((*c).to_owned(), (*s).to_owned()))
            .collect()
    }

    /// Decision recorded in docs/DECISIONS.md: a brick is on only with everything it needs.
    #[test]
    fn a_brick_is_off_when_a_brick_it_needs_is_off() {
        let off = statuses(&[("registration", "disabled"), ("pharmacy", "enabled")]);
        assert_eq!(effective_outcome("pharmacy", &off), Outcome::Deny);
        assert_eq!(effective_outcome("hr", &off), Outcome::Allow);
        let on = statuses(&[("pharmacy", "enabled")]);
        assert_eq!(effective_outcome("pharmacy", &on), Outcome::Allow);
        assert_eq!(effective_outcome("not_a_brick", &off), Outcome::Allow);
    }

    #[test]
    fn registration_cannot_go_off_while_pharmacy_is_on() {
        let on = statuses(&[("registration", "enabled"), ("pharmacy", "enabled")]);
        assert!(switch_blockers("registration", false, &on).contains(&"Pharmacy"));
        let alone = statuses(&[("pharmacy", "enabled"), ("registration", "disabled")]);
        assert_eq!(
            switch_blockers("pharmacy", true, &alone),
            vec!["Patient Registration"]
        );
        assert!(switch_blockers("pharmacy", false, &on).is_empty());
    }

    #[test]
    fn explicit_disabled_blocks_core_and_add_on() {
        assert_eq!(module_outcome("ot", Some("disabled")), Outcome::Deny);
        assert_eq!(module_outcome("companion", Some("disabled")), Outcome::Deny);
    }

    #[test]
    fn explicit_enabled_allows_core_and_add_on() {
        assert_eq!(module_outcome("ot", Some("enabled")), Outcome::Allow);
        assert_eq!(module_outcome("companion", Some("enabled")), Outcome::Allow);
    }

    #[test]
    fn core_module_absent_or_available_is_on() {
        assert_eq!(module_outcome("ot", None), Outcome::Allow);
        assert_eq!(module_outcome("ot", Some("available")), Outcome::Allow);
    }

    #[test]
    fn add_on_absent_available_or_coming_soon_is_refused() {
        assert_eq!(module_outcome("companion", None), Outcome::Deny);
        assert_eq!(
            module_outcome("companion", Some("available")),
            Outcome::Deny
        );
        assert_eq!(
            module_outcome("companion", Some("coming_soon")),
            Outcome::Deny
        );
    }
}
