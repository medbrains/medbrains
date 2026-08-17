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

use medbrains_authz::decision::{Outcome, any};

use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::{collapse, outcome_of};
use medbrains_server_core::state::AppState;

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
    let ctx = medbrains_server_core::middleware::authorization::authz_context(claims);
    let outcome = outcome_of(
        state
            .authz
            .check(&ctx, medbrains_authz::Relation::Viewer, object_type, object_id)
            .await,
        object_type,
    );
    collapse(outcome)
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

/// Which parent a child row hangs from, and how to find it.
///
/// Most PHI does not carry a patient id in its URL. `/opd/prescriptions/{id}`
/// names a prescription; the care relationship lives one hop away, on the
/// encounter it belongs to. Every such handler needs the same two steps —
/// resolve the parent, then authorize it — and writing them by hand produces a
/// different SQL string per module, each with its own chance of forgetting the
/// tenant predicate.
#[derive(Debug, Clone, Copy)]
pub struct ParentLink {
    /// Table holding the child row. A `&'static str` on purpose: this is
    /// interpolated into the statement, so it must never be caller-supplied.
    pub table: &'static str,
    /// Column on that table holding the parent id.
    pub column: &'static str,
    /// What the parent is, which decides the gate applied to it.
    pub parent: ParentKind,
}

/// The three things a clinical record can hang from.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ParentKind {
    Encounter,
    Admission,
    /// Clinical: a direct grant **or** reachability via a recent encounter.
    Patient,
    /// Administrative: a direct grant only.
    ///
    /// Financial records do not follow the care team. Treating a patient does
    /// not require their invoice, so `Patient` would be too permissive here —
    /// it would let anyone on a recent encounter's care team read the bill.
    /// Matches the rule already applied to `list_patient_invoices`.
    PatientDirect,
}

/// The links in use. Adding a row here is the whole cost of guarding a new
/// child resource.
pub mod links {
    use super::{ParentKind, ParentLink};

    pub const PRESCRIPTION: ParentLink = ParentLink {
        table: "prescriptions",
        column: "encounter_id",
        parent: ParentKind::Encounter,
    };
    pub const MEDICAL_CERTIFICATE: ParentLink = ParentLink {
        table: "medical_certificates",
        column: "patient_id",
        parent: ParentKind::Patient,
    };
    pub const PROCEDURE_ORDER: ParentLink = ParentLink {
        table: "procedure_orders",
        column: "patient_id",
        parent: ParentKind::Patient,
    };
    pub const MAR_ENTRY: ParentLink = ParentLink {
        table: "ipd_medication_administration",
        column: "admission_id",
        parent: ParentKind::Admission,
    };
    pub const LAB_ORDER: ParentLink = ParentLink {
        table: "lab_orders",
        column: "patient_id",
        parent: ParentKind::Patient,
    };
    pub const INVOICE: ParentLink = ParentLink {
        table: "invoices",
        column: "patient_id",
        parent: ParentKind::PatientDirect,
    };
}

/// Resolve a child row to its parent, then authorize the parent.
///
/// `NotFound` when the child does not exist. Every parent column in `links` is
/// `NOT NULL` today, so the null branch is unreachable — it is kept because the
/// constraint is a fact about the current schema, not a guarantee, and a column
/// that becomes nullable later should fail closed rather than compile into an
/// `unwrap`. A backend fault still surfaces as 503 via the gate below, because
/// that decision belongs to `collapse` and to exactly one place.
pub async fn require_access_via(
    state: &AppState,
    claims: &Claims,
    link: ParentLink,
    child_id: Uuid,
) -> Result<(), AppError> {
    // `table` and `column` are `&'static str` from `links` above — never from a
    // request — so this interpolation cannot carry caller input.
    let sql = format!(
        "SELECT {} FROM {} WHERE id = $1 AND tenant_id = $2",
        link.column, link.table
    );
    let parent_id: Option<Uuid> = sqlx::query_scalar(&sql)
        .bind(child_id)
        .bind(claims.tenant_id)
        .fetch_optional(&state.db)
        .await?
        .flatten();

    let Some(parent_id) = parent_id else {
        return Err(AppError::NotFound);
    };

    match link.parent {
        ParentKind::Encounter => require_encounter_access(state, claims, parent_id).await,
        ParentKind::Admission => require_admission_access(state, claims, parent_id).await,
        ParentKind::Patient => require_patient_access(state, claims, parent_id).await,
        ParentKind::PatientDirect => require_object_view(state, claims, "patient", parent_id).await,
    }
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
    let ctx = medbrains_server_core::middleware::authorization::authz_context(claims);

    // Fast path: a direct or implied grant on the patient itself
    // (owner/attending/viewer/dept_member/group_member). Common case, 0 SQL.
    //
    // Only a definite `Allow` short-circuits. An `Unknown` here must NOT become
    // a 503 on the spot — the fan-out below may still find a definite grant,
    // and `any([Unknown, Allow]) == Allow`. Bailing out early would turn a
    // partial outage into a refusal for a clinician who genuinely has access.
    let direct = outcome_of(
        state
            .authz
            .check(&ctx, medbrains_authz::Relation::Viewer, "patient", patient_id)
            .await,
        "patient",
    );
    if direct == Outcome::Allow {
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

    // No encounters and no admissions is a definite `Deny` for the hierarchy
    // edge — there is nothing to reach the patient through. Combined with the
    // direct check so a failed direct check still surfaces as an outage rather
    // than as "no such patient".
    if items.is_empty() {
        return collapse(any([direct, Outcome::Deny]));
    }

    let reachable = match state.authz.bulk_check(&ctx, &items).await {
        Ok(results) => any(results
            .values()
            .map(|&allowed| if allowed { Outcome::Allow } else { Outcome::Deny })),
        Err(err) => {
            tracing::error!(target: "authz", error = %err, check = "patient_fanout",
                objects = items.len(),
                "authorization backend unavailable — refusing as 503, not as absent");
            Outcome::Unknown
        }
    };

    collapse(any([direct, reachable]))
}

/// The set of patients this caller may see, for constraining a list query.
///
/// `None` means "no constraint" — a bypass role sees every row in the tenant,
/// and adding a filter for them would be both wrong and slow. `Some(ids)` is the
/// visible set, which callers apply as `patient_id = ANY($n::uuid[])`.
///
/// This exists because a per-record check cannot help a list endpoint: there is
/// no id in the request to check. Guarding lists is a different mechanism, and
/// it is the one that caps every module's conformance — `home_health` has 20 of
/// 30 handlers with no path parameter at all.
///
/// An unanswerable set is a 503, never an empty `Vec`. A list that renders an
/// outage as emptiness tells a nurse the ward is empty, and that is a statement
/// about the ward rather than about the system.
pub async fn visible_patient_ids(
    state: &AppState,
    claims: &Claims,
) -> Result<Option<Vec<Uuid>>, AppError> {
    let ctx = medbrains_server_core::middleware::authorization::authz_context(claims);
    if ctx.is_bypass {
        return Ok(None);
    }
    match state
        .authz
        .list_accessible(&ctx, "patient", medbrains_authz::Relation::Viewer)
        .await
    {
        Ok(ids) => Ok(Some(ids)),
        Err(err) => {
            tracing::error!(target: "authz", error = %err, user = %ctx.user_id,
                "list_accessible(patient) failed — refusing the list rather than \
                 returning an empty one");
            Err(AppError::ServiceUnavailable(
                "authorization backend unavailable".to_owned(),
            ))
        }
    }
}
