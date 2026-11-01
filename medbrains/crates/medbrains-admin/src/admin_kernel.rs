//! `GET /api/admin/kernel` — kernel health for operators (RFC-HOSPITAL-OS K1).

use axum::{Extension, Json, extract::State};
use medbrains_core::permissions;
use medbrains_kernel::health::KernelHealth;
use medbrains_kernel::{Actor, AppError, Claims, require_permission};
use medbrains_server_core::state::AppState;

/// Audit chain verdict, RLS mode, authz backend, config scopes and which
/// crates are on the kernel facade.
pub async fn get_kernel_health(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<KernelHealth>, AppError> {
    require_permission(&claims, permissions::admin::kernel::VIEW)?;
    let authz = &*state.authz;
    let health = medbrains_kernel::work(
        &state.db,
        Actor::from_claims(&claims),
        async |tx: &mut medbrains_kernel::Tx| medbrains_kernel::health::report(tx, authz).await,
    )
    .await?;
    Ok(Json(health))
}
