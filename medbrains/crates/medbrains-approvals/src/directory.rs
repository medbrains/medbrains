//! Turning an approver rule into the people who may decide.
//!
//! Runs once, when a stage activates, and the answer is written to
//! `approval_step_assignees`. Two reasons, and the second is the important
//! one:
//!
//! * **speed** — the inbox is the screen every employee opens. Re-evaluating
//!   rules per candidate row would make it a rule engine run; against a stored
//!   assignee list it is an index scan.
//! * **stability** — a request already sitting in somebody's queue must not
//!   change hands because a role was edited this afternoon. The rule answered
//!   the question when the stage opened, and that answer is the one that
//!   counts.
//!
//! An empty result is an error, never an empty queue. A stage nobody can
//! decide is a request that waits forever with nothing to explain why, and
//! that is how paper chits come back.

use medbrains_approvals_core::ApproverRule;
use sqlx::Row;
use uuid::Uuid;

use crate::error::EngineError;
use crate::plug::Tx;

/// Everything needed to resolve a rule.
#[derive(Debug, Clone)]
pub struct ResolutionContext {
    pub tenant_id: Uuid,
    /// Whose chain this is — the manager and department rules start here.
    pub requester_id: Uuid,
    /// Excluded from every result. The requester and the subject can never
    /// decide, so offering them the request and refusing the click would be a
    /// worse version of the same rule.
    pub on_behalf_of_id: Option<Uuid>,
}

/// Resolve a rule to the users who may decide the stage.
///
/// # Errors
/// [`EngineError::Domain`] when a rule resolves to nobody, and database
/// errors otherwise.
pub async fn resolve(
    tx: &mut Tx<'_>,
    rule: &ApproverRule,
    ctx: &ResolutionContext,
) -> Result<Vec<Uuid>, EngineError> {
    let candidates = match rule {
        ApproverRule::Role { role } => by_role(tx, ctx.tenant_id, role).await?,
        ApproverRule::Permission { permission } => {
            by_permission(tx, ctx.tenant_id, permission).await?
        }
        ApproverRule::ReportingManager => reporting_manager(tx, ctx).await?,
        ApproverRule::DepartmentHead { department_id } => {
            department_head(tx, ctx, *department_id).await?
        }
        ApproverRule::DesignationLevelAtLeast { level } => {
            by_designation_level(tx, ctx.tenant_id, *level).await?
        }
        ApproverRule::NamedUser { user_id } => vec![*user_id],
        // Neither resolves to a person; the caller handles these stages
        // without an inbox rather than leaving them waiting for one.
        ApproverRule::External { .. } | ApproverRule::Automatic { .. } => Vec::new(),
    };

    Ok(exclude_conflicted(candidates, ctx))
}

/// Remove the people who could never legitimately decide.
///
/// The controls refuse them at decision time regardless. Removing them here as
/// well means the request never appears in their inbox, which is the
/// difference between a rule that is enforced and a rule that is enforced
/// *and* obvious.
fn exclude_conflicted(candidates: Vec<Uuid>, ctx: &ResolutionContext) -> Vec<Uuid> {
    let mut seen = std::collections::HashSet::new();
    candidates
        .into_iter()
        .filter(|id| *id != ctx.requester_id && Some(*id) != ctx.on_behalf_of_id)
        // A person reachable by two paths — head of the department *and* a
        // role holder — is still one approver, and must not count twice
        // towards a quorum of two.
        .filter(|id| seen.insert(*id))
        .collect()
}

async fn by_role(tx: &mut Tx<'_>, tenant_id: Uuid, role: &str) -> Result<Vec<Uuid>, EngineError> {
    let rows = sqlx::query(
        // `users.role` is the `user_role` enum, not text, so the comparison is
        // cast rather than bound directly — a text bind fails at runtime with
        // "invalid input value for enum user_role", and runtime SQL gets no
        // compile-time warning about it.
        "SELECT id FROM users \
         WHERE tenant_id = $1 AND role::text = $2 AND is_active = true AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(role)
    .fetch_all(&mut **tx)
    .await?;
    collect_ids(rows)
}

/// Users whose effective permissions include a code.
///
/// Mirrors the resolution the auth layer uses: the role's permission array,
/// widened by `users.access_matrix->'extra'` and narrowed by `'denied'`. A
/// denied permission must not make somebody an approver — that is the whole
/// point of a per-user denial.
///
/// The bypass roles are included unconditionally, because they hold every
/// permission by definition.
async fn by_permission(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    permission: &str,
) -> Result<Vec<Uuid>, EngineError> {
    let rows = sqlx::query(
        "SELECT u.id FROM users u \
         LEFT JOIN roles r ON r.tenant_id = u.tenant_id AND r.code = u.role::text \
         WHERE u.tenant_id = $1 AND u.is_active = true AND u.deleted_at IS NULL \
           AND NOT COALESCE(u.access_matrix->'denied' @> to_jsonb($2::text), false) \
           AND ( \
                 u.role::text IN ('super_admin', 'hospital_admin') \
              OR COALESCE(r.permissions @> to_jsonb($2::text), false) \
              OR COALESCE(u.access_matrix->'extra' @> to_jsonb($2::text), false) \
           )",
    )
    .bind(tenant_id)
    .bind(permission)
    .fetch_all(&mut **tx)
    .await?;
    collect_ids(rows)
}

/// The requester's line manager, as a user id.
async fn reporting_manager(
    tx: &mut Tx<'_>,
    ctx: &ResolutionContext,
) -> Result<Vec<Uuid>, EngineError> {
    let rows = sqlx::query(
        "SELECT manager.user_id AS id \
         FROM employees me \
         JOIN employees manager ON manager.id = me.reporting_to AND manager.tenant_id = me.tenant_id \
         WHERE me.tenant_id = $1 AND me.user_id = $2 AND manager.user_id IS NOT NULL",
    )
    .bind(ctx.tenant_id)
    .bind(ctx.requester_id)
    .fetch_all(&mut **tx)
    .await?;
    collect_ids(rows)
}

/// The head of a department — the requester's own unless one is named.
///
/// `departments.head_employee_id` was added with this platform. Before it,
/// nothing in the system recorded who ran a department, so the leave chain's
/// "HOD approval" stage had nobody to resolve and stamped whoever clicked.
async fn department_head(
    tx: &mut Tx<'_>,
    ctx: &ResolutionContext,
    department_id: Option<Uuid>,
) -> Result<Vec<Uuid>, EngineError> {
    let rows = sqlx::query(
        "SELECT head.user_id AS id \
         FROM departments d \
         JOIN employees head ON head.id = d.head_employee_id AND head.tenant_id = d.tenant_id \
         WHERE d.tenant_id = $1 \
           AND head.user_id IS NOT NULL \
           AND d.id = COALESCE( \
                 $2::uuid, \
                 (SELECT e.department_id FROM employees e \
                  WHERE e.tenant_id = $1 AND e.user_id = $3 LIMIT 1))",
    )
    .bind(ctx.tenant_id)
    .bind(department_id)
    .bind(ctx.requester_id)
    .fetch_all(&mut **tx)
    .await?;
    collect_ids(rows)
}

/// Everyone at or above a seniority rank. Also what escalation widens to.
async fn by_designation_level(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    level: i32,
) -> Result<Vec<Uuid>, EngineError> {
    let rows = sqlx::query(
        "SELECT e.user_id AS id \
         FROM employees e \
         JOIN designations d ON d.id = e.designation_id AND d.tenant_id = e.tenant_id \
         WHERE e.tenant_id = $1 AND e.user_id IS NOT NULL \
           AND d.is_active = true AND d.level >= $2",
    )
    .bind(tenant_id)
    .bind(level)
    .fetch_all(&mut **tx)
    .await?;
    collect_ids(rows)
}

fn collect_ids(rows: Vec<sqlx::postgres::PgRow>) -> Result<Vec<Uuid>, EngineError> {
    rows.into_iter()
        .map(|row| row.try_get::<Uuid, _>("id").map_err(EngineError::from))
        .collect()
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::{ResolutionContext, exclude_conflicted};
    use uuid::Uuid;

    fn ctx(requester: Uuid, subject: Option<Uuid>) -> ResolutionContext {
        ResolutionContext {
            tenant_id: Uuid::new_v4(),
            requester_id: requester,
            on_behalf_of_id: subject,
        }
    }

    #[test]
    fn the_requester_is_never_offered_their_own_request() {
        let requester = Uuid::new_v4();
        let other = Uuid::new_v4();
        let resolved = exclude_conflicted(vec![requester, other], &ctx(requester, None));
        assert_eq!(resolved, vec![other]);
    }

    #[test]
    fn the_subject_is_never_offered_their_own_case() {
        // A manager raising leave on behalf of their report: the report must
        // not be able to approve it, even though a role rule would catch them.
        let requester = Uuid::new_v4();
        let subject = Uuid::new_v4();
        let other = Uuid::new_v4();
        let resolved = exclude_conflicted(vec![subject, other], &ctx(requester, Some(subject)));
        assert_eq!(resolved, vec![other]);
    }

    #[test]
    fn one_person_reachable_twice_is_still_one_approver() {
        // Head of the department *and* a holder of the role. Counting them
        // twice would let a quorum of two be met by one person.
        let requester = Uuid::new_v4();
        let head = Uuid::new_v4();
        let resolved = exclude_conflicted(vec![head, head, head], &ctx(requester, None));
        assert_eq!(resolved, vec![head]);
    }

    #[test]
    fn order_is_preserved_so_the_first_named_approver_stays_first() {
        let requester = Uuid::new_v4();
        let (a, b, c) = (Uuid::new_v4(), Uuid::new_v4(), Uuid::new_v4());
        let resolved = exclude_conflicted(vec![a, b, c, a], &ctx(requester, None));
        assert_eq!(resolved, vec![a, b, c]);
    }

    #[test]
    fn a_rule_that_only_finds_conflicted_people_resolves_to_nobody() {
        // Which the caller must treat as a configuration error rather than as
        // a stage that is merely quiet: a one-person department where the
        // head is the person asking.
        let requester = Uuid::new_v4();
        let resolved = exclude_conflicted(vec![requester], &ctx(requester, None));
        assert!(resolved.is_empty());
    }
}
