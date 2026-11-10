//! `GET /api/admin/kernel` — kernel health for operators (RFC-HOSPITAL-OS K1).

use axum::{Extension, Json, extract::State};
use medbrains_core::permissions;
use medbrains_kernel::health::KernelHealth;
use medbrains_kernel::{Actor, Claims, require_permission};
use medbrains_server_core::{error::AppError, state::AppState};

/// The baseline `scripts/check_kernel_boundary.py` holds CI to, so the page shows
/// exactly what CI enforces. Embedded here, the only reader, so that recording a
/// change to it rebuilds this crate rather than everything above the kernel.
const BOUNDARY: &str = include_str!("../../medbrains-kernel/boundary.txt");

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
        async |tx: &mut medbrains_kernel::Tx| {
            medbrains_kernel::health::report(tx, authz, BOUNDARY).await
        },
    )
    .await?;
    Ok(Json(health))
}

#[cfg(test)]
mod tests {
    use super::BOUNDARY;

    /// The page's list is only read at request time, so a baseline the parser
    /// refuses has to fail here rather than as a 500 on Admin → Kernel.
    #[test]
    fn the_embedded_baseline_parses_and_is_not_empty() {
        let crates = medbrains_kernel::health::facade_crates(BOUNDARY);
        assert!(crates.is_ok_and(|c| !c.is_empty()));
    }
}
