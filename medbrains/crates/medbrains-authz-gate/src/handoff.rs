//! Handoff access: when work for a patient reaches a department, that
//! department's staff reach the patient for that work.
//!
//! A prescription reaching pharmacy, a lab order reaching the laboratory, a
//! visit reaching billing, a policy reaching the TPA desk. Each writes one
//! `dept_member@department` tuple — nobody gets hospital-wide access, and a
//! department that never received work for a patient still cannot open them.
//!
//! Departments are resolved by their seeded code.
// ponytail: seeded codes assumed; a per-tenant setting when a hospital names
// its pharmacy or billing department otherwise.

use uuid::Uuid;

use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::state::AppState;

pub const PATHOLOGY: &str = "PATHOLOGY";
pub const PHARMACY: &str = "PHARMACY";
/// Billing & Accounts. The TPA desk sits here too — no insurance department
/// is seeded.
pub const BILLING: &str = "BILLING-DEPT";

/// Which object the department reaches, and which department.
pub struct HandOff {
    /// `encounter` for clinical work (reached through the visit); `patient`
    /// for financial work, whose gate checks the patient directly.
    pub object_type: &'static str,
    pub object_id: Uuid,
    pub department_code: &'static str,
}

/// Give a department `dept_member` on the object. Idempotent: one tuple per
/// object and department, however much work arrives. A tenant without the
/// department is left as it was — nothing to hand to.
pub async fn hand_off(state: &AppState, claims: &Claims, to: HandOff) -> Result<(), AppError> {
    let department: Option<Uuid> = sqlx::query_scalar!(
        "SELECT id FROM departments \
          WHERE tenant_id = $1 AND code = $2 AND is_active AND deleted_at IS NULL \
          LIMIT 1",
        claims.tenant_id,
        to.department_code,
    )
    .fetch_optional(&state.db)
    .await?;
    let Some(department) = department else {
        return Ok(());
    };
    let linked: bool = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM relation_tuples \
          WHERE tenant_id = $1 AND object_type = $2 AND object_id = $3 \
            AND relation = 'dept_member' AND subject_type = 'department' AND subject_id = $4 \
            AND status = 'active') AS \"exists!\"",
        claims.tenant_id,
        to.object_type,
        to.object_id,
        department.to_string(),
    )
    .fetch_one(&state.db)
    .await?;
    if linked {
        return Ok(());
    }
    let ctx = medbrains_server_core::middleware::authorization::authz_context(claims);
    state
        .authz
        .grant_raw(
            &ctx,
            to.object_type,
            to.object_id,
            "dept_member",
            medbrains_authz::Subject::Department(department),
            None,
            Some(format!("handoff:{}", to.department_code)),
        )
        .await
        .map(|_| ())
        .map_err(|e| {
            AppError::Internal(format!("{} handoff grant failed: {e}", to.department_code))
        })
}

/// A visit reaches billing: every visit is billable, so the billing
/// department reaches its patient from the moment the visit starts.
// ponytail: standing access once visited; expire it when the RFC's on_shift
// / episode-close lands.
pub async fn hand_visit_to_billing(
    state: &AppState,
    claims: &Claims,
    encounter_id: Uuid,
) -> Result<(), AppError> {
    let patient_id: Option<Uuid> = sqlx::query_scalar!(
        "SELECT patient_id FROM encounters WHERE id = $1 AND tenant_id = $2",
        encounter_id,
        claims.tenant_id,
    )
    .fetch_optional(&state.db)
    .await?;
    let Some(patient_id) = patient_id else {
        return Ok(());
    };
    hand_off(
        state,
        claims,
        HandOff {
            object_type: "patient",
            object_id: patient_id,
            department_code: BILLING,
        },
    )
    .await
}
