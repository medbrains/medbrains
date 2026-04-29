//! Caveat evaluator — the closed enum of contextual constraints we
//! evaluate at check time. Stored as JSONB on `relation_tuples.caveat`.
//!
//! Closed-enum design (NOT Cedar / NOT free-form expressions) because:
//!   1. Healthcare authz cannot afford eval-bypass surprise.
//!   2. Caveat semantics must be inspectable at row-policy level (RLS).
//!   3. We add new caveat kinds via Rust code review, not data writes.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::AuthzContext;

/// One caveat — closed enum. Add variants via PR.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Caveat {
    /// Grant valid only while the linked encounter is open
    /// (i.e. `encounters.discharge_date IS NULL`). Evaluator joins to
    /// `encounters` at check time.
    UntilEncounterDischarge { encounter_id: Uuid },

    /// Grant valid only when caller's IP falls in the listed CIDRs.
    IpInRange { cidrs: Vec<String> },

    /// Grant valid only during these clock hours (UTC, 24h).
    /// Inclusive `from`, exclusive `until`.
    InTimeWindow { from_utc: u8, until_utc: u8 },

    /// Grant valid only if the caller's role is in this allow-list.
    /// (Useful when a tuple grants `role:nurse` access but only specific
    /// nurse sub-roles should resolve.)
    RoleIn { roles: Vec<String> },
}

/// Evaluator outcome.
#[derive(Debug, Clone)]
pub enum CaveatVerdict {
    Allow,
    Deny(String),
}

impl Caveat {
    /// Evaluate against a request context. Some variants (e.g.
    /// UntilEncounterDischarge) require a DB lookup; those return
    /// `Allow` here and are also gated at the SQL layer in `check()`.
    pub fn evaluate(&self, ctx: &AuthzContext) -> CaveatVerdict {
        match self {
            Self::UntilEncounterDischarge { .. } => {
                // Evaluated at SQL layer (joined to encounters); not here.
                CaveatVerdict::Allow
            }
            Self::IpInRange { .. } => {
                // Caller IP is request-scoped; evaluator at the route
                // layer wraps this. Engine-level returns Allow.
                CaveatVerdict::Allow
            }
            Self::InTimeWindow { from_utc, until_utc } => {
                let now = chrono::Utc::now();
                let h = now.format("%H").to_string().parse::<u8>().unwrap_or(0);
                let in_window = if from_utc < until_utc {
                    h >= *from_utc && h < *until_utc
                } else {
                    // wraps midnight (e.g. 22 → 6)
                    h >= *from_utc || h < *until_utc
                };
                if in_window {
                    CaveatVerdict::Allow
                } else {
                    CaveatVerdict::Deny(format!(
                        "outside time window {from_utc:02}-{until_utc:02} UTC"
                    ))
                }
            }
            Self::RoleIn { roles } => {
                if roles.iter().any(|r| r == &ctx.role) {
                    CaveatVerdict::Allow
                } else {
                    CaveatVerdict::Deny(format!("role '{}' not in caveat allow-list", ctx.role))
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ctx(role: &str) -> AuthzContext {
        AuthzContext {
            tenant_id: Uuid::nil(),
            user_id: Uuid::nil(),
            role: role.to_string(),
            department_ids: vec![],
            is_bypass: false,
        }
    }

    #[test]
    fn role_in_allow() {
        let c = Caveat::RoleIn { roles: vec!["doctor".to_string()] };
        assert!(matches!(c.evaluate(&ctx("doctor")), CaveatVerdict::Allow));
    }

    #[test]
    fn role_in_deny() {
        let c = Caveat::RoleIn { roles: vec!["doctor".to_string()] };
        assert!(matches!(c.evaluate(&ctx("nurse")), CaveatVerdict::Deny(_)));
    }
}
