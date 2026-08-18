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
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
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
    /// The parent is itself a child row — resolve one more hop.
    ///
    /// A newborn hangs off a labor record, which hangs off a maternity
    /// registration, which finally names the mother. Without this the choice is
    /// a hand-written two-statement lookup per handler, which is how each
    /// module ends up with its own subtly different version of the tenant
    /// predicate.
    Via(&'static ParentLink),
}

impl ParentLink {
    /// A table that carries `patient_id` itself — by far the commonest shape.
    ///
    /// Spelling out three fields for each of these buried the links that are
    /// actually worth reading, which are the ones whose column choice was a
    /// decision: `LABOR_RECORD` avoiding a nullable `admission_id`, `NEWBORN`
    /// avoiding a nullable `mother_id`, `PRESCRIPTION` hanging off an
    /// encounter rather than a patient.
    #[must_use]
    pub const fn on_patient(table: &'static str) -> Self {
        Self {
            table,
            column: "patient_id",
            parent: ParentKind::Patient,
        }
    }
}

/// How many links a chain may follow before it is treated as a bug.
///
/// The chain is built from `&'static` constants, so a cycle would have to be
/// written deliberately — but an unbounded loop over database round trips is
/// not something to leave to authorship discipline.
const MAX_HOPS: usize = 4;

/// The links in use. Adding a row here is the whole cost of guarding a new
/// child resource.
pub mod links {
    use super::{ParentKind, ParentLink};

    pub const PRESCRIPTION: ParentLink = ParentLink {
        table: "prescriptions",
        column: "encounter_id",
        parent: ParentKind::Encounter,
    };
    pub const MEDICAL_CERTIFICATE: ParentLink = ParentLink::on_patient("medical_certificates");
    pub const PROCEDURE_ORDER: ParentLink = ParentLink::on_patient("procedure_orders");
    pub const MAR_ENTRY: ParentLink = ParentLink {
        table: "ipd_medication_administration",
        column: "admission_id",
        parent: ParentKind::Admission,
    };
    pub const LAB_ORDER: ParentLink = ParentLink::on_patient("lab_orders");
    pub const INVOICE: ParentLink = ParentLink {
        table: "invoices",
        column: "patient_id",
        parent: ParentKind::PatientDirect,
    };
    /// Also guards `dental_chart_entries`, whose `exam_id` is this table's `id`
    /// — the tooth-wise chart hangs off the exam, so authorizing the exam
    /// authorizes its entries without a second hop.
    pub const DENTAL_EXAM: ParentLink = ParentLink::on_patient("dental_exams");
    pub const OPHTHO_EXAM: ParentLink = ParentLink::on_patient("ophtho_exams");

    /// The mother. Maternity's own records name a registration, never her.
    pub const MATERNITY_REGISTRATION: ParentLink =
        ParentLink::on_patient("maternity_registrations");
    /// A labor record carries `admission_id` too, but it is nullable — a birth
    /// that never became an admission would authorize as "no such record".
    /// The registration is always present, so the chain goes through it.
    pub const LABOR_RECORD: ParentLink = ParentLink {
        table: "labor_records",
        column: "registration_id",
        parent: ParentKind::Via(&MATERNITY_REGISTRATION),
    };
    /// Through `labor_id` rather than the denormalised `mother_id` beside it:
    /// `mother_id` is nullable, so a legacy row without one would authorize as
    /// "no such newborn". `labor_id` is NOT NULL and reaches the same mother.
    pub const NEWBORN: ParentLink = ParentLink {
        table: "newborn_records",
        column: "labor_id",
        parent: ParentKind::Via(&LABOR_RECORD),
    };
    /// Psychiatric records key on their own patient row, not the patient id.
    pub const PSYCH_PATIENT: ParentLink = ParentLink::on_patient("psych_patients");
    /// Restraint and seclusion episodes — reviewable events under the Mental
    /// Healthcare Act, addressed by their own id once created.
    pub const PSYCH_RESTRAINT: ParentLink = ParentLink {
        table: "psych_seclusion_restraint",
        column: "psych_patient_id",
        parent: ParentKind::Via(&PSYCH_PATIENT),
    };
    pub const PSYCH_MHRB_NOTIFICATION: ParentLink = ParentLink {
        table: "psych_mhrb_notifications",
        column: "psych_patient_id",
        parent: ParentKind::Via(&PSYCH_PATIENT),
    };

    /// Long-term care. Every one of these tables carries the resident's
    /// `patient_id` directly, so each is a one-liner.
    pub const LTC_MDS_ASSESSMENT: ParentLink = ParentLink::on_patient("mds_assessments");
    pub const LTC_MEDICATION: ParentLink = ParentLink::on_patient("long_term_medications");
    pub const LTC_FAMILY_MESSAGE: ParentLink = ParentLink::on_patient("family_messages");
    pub const LTC_HOME_CARE_REFERRAL: ParentLink = ParentLink::on_patient("home_care_referrals");
    pub const LTC_SNF_ADMISSION: ParentLink = ParentLink::on_patient("snf_admissions");

    /// Rehabilitation, palliative care, dialysis and oncology.
    pub const REHAB_PLAN: ParentLink = ParentLink::on_patient("rehab_plans");
    pub const REHAB_SESSION: ParentLink = ParentLink {
        table: "rehab_sessions",
        column: "plan_id",
        parent: ParentKind::Via(&REHAB_PLAN),
    };
    pub const DNR_ORDER: ParentLink = ParentLink::on_patient("dnr_orders");
    pub const DIALYSIS_SESSION: ParentLink = ParentLink::on_patient("dialysis_sessions");
    pub const CHEMO_PROTOCOL: ParentLink = ParentLink::on_patient("chemo_protocols");

    /// Interventional. The cath and endoscopy procedure rows carry the patient;
    /// everything recorded during a procedure hangs off the procedure.
    pub const CATH_PROCEDURE: ParentLink = ParentLink::on_patient("cath_procedures");
    pub const ENDOSCOPY_PROCEDURE: ParentLink = ParentLink::on_patient("endoscopy_procedures");

    /// Bedside portal — the tablet at the patient's bed.
    pub const BEDSIDE_SESSION: ParentLink = ParentLink::on_patient("bedside_sessions");
    pub const BEDSIDE_NURSE_REQUEST: ParentLink =
        ParentLink::on_patient("bedside_nurse_requests");

    /// Case management. Barriers and referrals carry no patient of their own —
    /// they hang off the case assignment, which is where the patient lives.
    pub const CASE_ASSIGNMENT: ParentLink = ParentLink::on_patient("case_assignments");
    pub const DISCHARGE_BARRIER: ParentLink = ParentLink {
        table: "discharge_barriers",
        column: "case_assignment_id",
        parent: ParentKind::Via(&CASE_ASSIGNMENT),
    };
    pub const CASE_REFERRAL: ParentLink = ParentLink {
        table: "case_referrals",
        column: "case_assignment_id",
        parent: ParentKind::Via(&CASE_ASSIGNMENT),
    };

    /// Chronic care. `adherence_records`, `patient_outcome_targets` and
    /// `polypharmacy_interaction_alerts` all carry `patient_id` NOT NULL
    /// alongside a nullable `enrollment_id`, so they resolve on the patient
    /// directly rather than through the enrollment.
    pub const CHRONIC_ENROLLMENT: ParentLink = ParentLink::on_patient("chronic_enrollments");
    pub const OUTCOME_TARGET: ParentLink = ParentLink::on_patient("patient_outcome_targets");
    pub const POLYPHARMACY_ALERT: ParentLink =
        ParentLink::on_patient("polypharmacy_interaction_alerts");
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
    let mut link = link;
    let mut id = child_id;

    // Iterative rather than recursive: `Via` would otherwise need a boxed
    // future, and the loop makes the hop bound something a reader can see.
    for _ in 0..MAX_HOPS {
        // `table` and `column` are `&'static str` from `links` above — never
        // from a request — so this interpolation cannot carry caller input.
        let sql = format!(
            "SELECT {} FROM {} WHERE id = $1 AND tenant_id = $2",
            link.column, link.table
        );
        let parent_id: Option<Uuid> = sqlx::query_scalar(&sql)
            .bind(id)
            .bind(claims.tenant_id)
            .fetch_optional(&state.db)
            .await?
            .flatten();

        let Some(parent_id) = parent_id else {
            return Err(AppError::NotFound);
        };

        match link.parent {
            ParentKind::Encounter => {
                return require_encounter_access(state, claims, parent_id).await;
            }
            ParentKind::Admission => {
                return require_admission_access(state, claims, parent_id).await;
            }
            ParentKind::Patient => {
                return require_patient_access(state, claims, parent_id).await;
            }
            ParentKind::PatientDirect => {
                return require_object_view(state, claims, "patient", parent_id).await;
            }
            ParentKind::Via(next) => {
                link = *next;
                id = parent_id;
            }
        }
    }

    // A chain longer than the bound is a mistake in `links`, not a refusal, and
    // must not be reported as one — the same reason an authorization fault
    // answers 503 rather than 404.
    Err(AppError::ServiceUnavailable(
        "authorization link chain exceeded its hop limit".to_owned(),
    ))
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

/// Resolve an *optional* patient filter into the set of ids a query may return.
///
/// Many list handlers are dual-mode:
///
/// ```sql
/// AND ($2::uuid IS NULL OR patient_id = $2)
/// ```
///
/// With `?patient_id=X` they return one patient's records; **without it they
/// return every patient's**. Guarding only the `Some` case makes the safe mode
/// safer and leaves the dangerous one open — while a coverage report counts the
/// handler fixed, because it now calls a check.
///
/// So both modes resolve to the same thing — a set of permitted ids:
///
/// - `Some(id)` → authorize that patient, then the set is just that one.
/// - `None` → the caller's whole visible set.
/// - bypass role → `None`, meaning no filter at all.
///
/// Callers replace the predicate with one that takes an array:
///
/// ```sql
/// AND ($2::uuid[] IS NULL OR patient_id = ANY($2))
/// ```
pub async fn patient_filter(
    state: &AppState,
    claims: &Claims,
    requested: Option<Uuid>,
) -> Result<Option<Vec<Uuid>>, AppError> {
    match requested {
        Some(id) => {
            require_patient_access(state, claims, id).await?;
            Ok(Some(vec![id]))
        }
        None => visible_patient_ids(state, claims).await,
    }
}
