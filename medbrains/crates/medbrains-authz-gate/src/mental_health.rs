//! Mental-health confidentiality — Mental Healthcare Act 2017 s.23.
//!
//! One rule, held in SQL (`mental_health_withheld`, migration 1198) so a list
//! filters in the same query that reads it. This module supplies the two
//! inputs Rust owns — who is asking, and whether their role may see every
//! restricted record — and the per-record gate for psychiatric records.
//!
//! The *presentation* of a refusal is not chosen here or at any call site: it
//! is [`DataClass::Sensitive`] → [`DenialMode::Tombstone`], declared once in
//! `medbrains-authz/src/field_class.rs` against [`MENTAL_HEALTH_FIELD`]. A
//! timeline row, a diagnosis list, a print and the assistant all render the
//! same tombstone: the entry exists, its content does not leave the server.

use medbrains_authz::classification::DenialMode;
use medbrains_core::permissions;
use uuid::Uuid;

use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::is_bypass_role;
use medbrains_server_core::state::AppState;

use crate::require_access_via;

/// The class key for mental-health content wherever it appears.
pub const MENTAL_HEALTH_FIELD: &str = "psychiatry.mental_health";

/// What a tombstoned mental-health entry says in place of its content.
pub const TOMBSTONE_LABEL: &str = "Restricted entry";

/// The two values every mental-health-aware query binds.
#[derive(Debug, Clone, Copy)]
pub struct MentalHealthViewer {
    pub user_id: Uuid,
    /// Bypass role, or holds `specialty.psychiatry.restricted.view`.
    pub can_all: bool,
}

impl MentalHealthViewer {
    #[must_use]
    pub fn of(claims: &Claims) -> Self {
        let code = permissions::specialty::psychiatry::restricted::VIEW;
        Self {
            user_id: claims.sub,
            can_all: is_bypass_role(claims) || claims.permissions.iter().any(|p| p == code),
        }
    }
}

/// How withheld mental-health content is presented, from its declared class.
#[must_use]
pub fn denial_mode() -> DenialMode {
    medbrains_authz::field_class::class_of(MENTAL_HEALTH_FIELD).denial_mode()
}

/// Whether a withheld row is still shown (as a tombstone) rather than dropped.
#[must_use]
pub fn withheld_rows_are_shown() -> bool {
    matches!(
        denial_mode(),
        DenialMode::Tombstone | DenialMode::Redacted | DenialMode::Masked | DenialMode::Disabled
    )
}

/// Apply the class's denial mode to a list: withheld rows are tombstoned in
/// place (or dropped, if the class ever says so). One pass, no lookups.
pub fn withhold<T>(
    rows: Vec<T>,
    is_withheld: impl Fn(&T) -> bool,
    mut tombstone: impl FnMut(&mut T),
) -> Vec<T> {
    let shown = withheld_rows_are_shown();
    rows.into_iter()
        .filter(|row| shown || !is_withheld(row))
        .map(|mut row| {
            if is_withheld(&row) {
                tombstone(&mut row);
            }
            row
        })
        .collect()
}

/// Which grant let the caller in — written to `access_log.action` so a
/// break-glass read is a review item rather than a routine one.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PsychGrant {
    Routine,
    BreakGlass,
}

impl PsychGrant {
    const fn action(self) -> &'static str {
        match self {
            Self::Routine => "view",
            Self::BreakGlass => "break_glass_view",
        }
    }
}

/// Gate a psychiatric record: the patient must be reachable (care team), and
/// a restricted record must pass the mental-health rule.
///
/// Three outcomes, as everywhere: allowed → `Ok`; refused → `NotFound` (the
/// same answer as a record that does not exist — enrolment in psychiatric
/// care is itself the confidential fact); a fault → the database or authz
/// error, never a refusal.
pub async fn require_psych_record_access(
    state: &AppState,
    claims: &Claims,
    psych_patient_id: Uuid,
) -> Result<PsychGrant, AppError> {
    require_access_via(state, claims, crate::links::PSYCH_PATIENT, psych_patient_id).await?;
    let viewer = MentalHealthViewer::of(claims);
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query!(
        r#"SELECT pp.patient_id,
                  (pp.is_restricted AND public.mental_health_withheld(pp.patient_id, $3, $4))
                    AS "withheld!",
                  (pp.is_restricted AND NOT $4
                     AND pp.treating_psychiatrist_id IS DISTINCT FROM $3
                     AND public.mental_health_break_glass_active(pp.patient_id, $3))
                    AS "via_break_glass!"
             FROM psych_patients pp
            WHERE pp.id = $1 AND pp.tenant_id = $2 AND pp.deleted_at IS NULL"#,
        psych_patient_id,
        claims.tenant_id,
        viewer.user_id,
        viewer.can_all,
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    if row.withheld {
        tracing::info!(target: "authz", user = %claims.sub, record = %psych_patient_id,
            "restricted psychiatric record refused");
        return Err(AppError::NotFound);
    }
    let grant = if row.via_break_glass {
        PsychGrant::BreakGlass
    } else {
        PsychGrant::Routine
    };
    // Specialty paths are not in the access-log middleware's PHI prefixes, so
    // the read is recorded here — and a break-glass read says so, which is
    // what puts "psychiatry" into the session's review rollup.
    sqlx::query!(
        "INSERT INTO access_log (tenant_id, user_id, entity_type, entity_id, patient_id, \
                                 action, module) \
         VALUES ($1, $2, 'psych_patients', $3, $4, $5, 'psychiatry')",
        claims.tenant_id,
        claims.sub,
        psych_patient_id,
        row.patient_id,
        grant.action(),
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(grant)
}

/// A row that hangs off a psychiatric record.
#[derive(Debug, Clone, Copy)]
pub enum PsychChild {
    Restraint,
    MhrbNotification,
}

/// The same gate for a child row: find its psychiatric record, then gate it.
pub async fn require_psych_child_access(
    state: &AppState,
    claims: &Claims,
    child: PsychChild,
    child_id: Uuid,
) -> Result<PsychGrant, AppError> {
    let parent = match child {
        PsychChild::Restraint => {
            sqlx::query_scalar!(
                "SELECT psych_patient_id FROM psych_seclusion_restraint \
                  WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
                child_id,
                claims.tenant_id,
            )
            .fetch_optional(&state.db)
            .await?
        }
        PsychChild::MhrbNotification => {
            sqlx::query_scalar!(
                "SELECT psych_patient_id FROM psych_mhrb_notifications \
                  WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
                child_id,
                claims.tenant_id,
            )
            .fetch_optional(&state.db)
            .await?
        }
    };
    let psych_patient_id = parent.ok_or(AppError::NotFound)?;
    require_psych_record_access(state, claims, psych_patient_id).await
}

#[cfg(test)]
mod tests {
    use super::{DenialMode, denial_mode, withheld_rows_are_shown, withhold};

    /// A withheld row keeps its place and loses its content.
    #[test]
    fn withhold_tombstones_in_place() {
        let rows = vec![("F20.0 Schizophrenia", true), ("E11 Diabetes", false)];
        let out = withhold(rows, |r| r.1, |r| r.0 = "Restricted entry");
        assert_eq!(
            out,
            vec![("Restricted entry", true), ("E11 Diabetes", false)]
        );
    }

    /// Psychiatric content is tombstoned: the entry's existence may show, its
    /// content may not — and the mode comes from the class, nowhere else.
    #[test]
    fn mental_health_content_is_tombstoned() {
        assert_eq!(denial_mode(), DenialMode::Tombstone);
        assert!(withheld_rows_are_shown());
    }
}
