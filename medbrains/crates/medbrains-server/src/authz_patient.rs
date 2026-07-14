//! Graph-based patient access resolution — "who can see this patient's record".
//!
//! Implements `can_view_patient` from `RFCs/RFC-ACCESS-RESOLUTION-GRAPH.md`:
//! a caller may view a patient if they hold a direct/implied ReBAC grant on the
//! `patient`, OR they reach the patient through **any** of its recent encounters
//! or admissions (the object-hierarchy edge — the care team is linked to the
//! encounter/admission, not the patient directly).
//!
//! DSA/DP discipline (CLAUDE.md "DSA + dynamic programming everywhere"): the
//! cheap direct check short-circuits first (0 SQL on the common path); the
//! object fan-out is **bounded** (`MAX_FANOUT`) and **batched** into a single
//! `bulk_check` (N→1) rather than a per-object loop.

use uuid::Uuid;

use crate::error::AppError;
use crate::middleware::auth::Claims;
use crate::state::AppState;

/// Upper bound on encounters/admissions fanned out per patient when resolving
/// reachability. Bounds the traversal cost regardless of a patient's history
/// length (Power of Ten). Recent-first, so an active care relationship is found
/// well within the window.
const MAX_FANOUT: i64 = 50;

/// Shared helper: gate on ReBAC `Viewer` of a single object type (encounter,
/// admission, …). `NotFound` on deny (not an existence oracle). Used for
/// encounter-/admission-keyed reads where the care team is linked directly to
/// that object (created with `dept_member`/`attending`/`ward_member`).
async fn require_object_view(
    state: &AppState,
    claims: &Claims,
    object_type: &str,
    object_id: Uuid,
) -> Result<(), AppError> {
    let ctx = crate::middleware::authorization::authz_context(claims);
    let allowed = state
        .authz
        .check(&ctx, medbrains_authz::Relation::Viewer, object_type, object_id)
        .await
        .unwrap_or(false);
    if allowed {
        Ok(())
    } else {
        Err(AppError::NotFound)
    }
}

/// Gate on access to a specific encounter (its treating department / attending
/// / explicit grant). See `RFC-ACCESS-RESOLUTION-GRAPH`.
pub async fn require_encounter_access(
    state: &AppState,
    claims: &Claims,
    encounter_id: Uuid,
) -> Result<(), AppError> {
    require_object_view(state, claims, "encounter", encounter_id).await
}

/// Gate on access to a specific admission (its ward/treating department /
/// attending / explicit grant).
pub async fn require_admission_access(
    state: &AppState,
    claims: &Claims,
    admission_id: Uuid,
) -> Result<(), AppError> {
    require_object_view(state, claims, "admission", admission_id).await
}

/// Gate a per-patient read/write on graph reachability. Returns `NotFound`
/// (not `Forbidden`) so the endpoint is not an existence oracle. `super_admin`/
/// `hospital_admin` short-circuit inside `check`. Composes on top of
/// `require_permission` (role authority) + tenant RLS.
pub async fn require_patient_access(
    state: &AppState,
    claims: &Claims,
    patient_id: Uuid,
) -> Result<(), AppError> {
    let ctx = crate::middleware::authorization::authz_context(claims);

    // Fast path: a direct or implied grant on the patient itself
    // (owner/attending/viewer/dept_member/group_member). Common case, 0 SQL.
    if state
        .authz
        .check(&ctx, medbrains_authz::Relation::Viewer, "patient", patient_id)
        .await
        .unwrap_or(false)
    {
        return Ok(());
    }

    // Object-hierarchy traversal: reachable via any recent encounter/admission.
    // Two bounded queries gather the candidate objects; one bulk_check resolves
    // them all (batched — the PG backend fan-out is replaced by a real bulk call
    // on SpiceDB, and by the recursive-CTE check in a later phase).
    let mut items: Vec<(String, medbrains_authz::Relation, Uuid)> = Vec::new();

    let encounter_ids: Vec<Uuid> = sqlx::query_scalar(
        "SELECT id FROM encounters WHERE patient_id = $1 AND tenant_id = $2 \
         ORDER BY encounter_date DESC LIMIT $3",
    )
    .bind(patient_id)
    .bind(claims.tenant_id)
    .bind(MAX_FANOUT)
    .fetch_all(&state.db)
    .await?;
    for eid in encounter_ids {
        items.push(("encounter".to_owned(), medbrains_authz::Relation::Viewer, eid));
    }

    let admission_ids: Vec<Uuid> = sqlx::query_scalar(
        "SELECT id FROM admissions WHERE patient_id = $1 AND tenant_id = $2 \
         ORDER BY admitted_at DESC LIMIT $3",
    )
    .bind(patient_id)
    .bind(claims.tenant_id)
    .bind(MAX_FANOUT)
    .fetch_all(&state.db)
    .await?;
    for aid in admission_ids {
        items.push(("admission".to_owned(), medbrains_authz::Relation::Viewer, aid));
    }

    if items.is_empty() {
        return Err(AppError::NotFound);
    }

    let results = state
        .authz
        .bulk_check(&ctx, &items)
        .await
        .unwrap_or_default();
    if results.values().any(|&allowed| allowed) {
        Ok(())
    } else {
        Err(AppError::NotFound)
    }
}
