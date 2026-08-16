//! Who decides a stage, as a value.
//!
//! The rule is stored as JSONB so an administrator can change a chain without
//! a deployment. Parsing it is here, in the pure core, so that every shape —
//! including every malformed one — is settled by a test rather than by a
//! surprise in production.
//!
//! # Failing closed
//!
//! A rule this build cannot parse is an **error**, not an empty approver list
//! and not a fallback to "anyone". Both alternatives are worse than refusing:
//!
//! * resolving to nobody produces a request that can never be decided and no
//!   explanation of why — it simply sits in a queue forever;
//! * resolving to anyone hands a controlled-drug approval to the whole
//!   hospital because somebody mistyped a role name.
//!
//! So a bad rule stops the request being raised at all, at the desk, where
//! somebody is present to read the message.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use thiserror::Error;
use uuid::Uuid;

/// How the approvers for one stage are chosen.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ApproverRule {
    /// Anyone holding this role.
    Role { role: String },

    /// Anyone whose effective permissions include this code. Broader than a
    /// role and usually the better choice for clinical co-signature, where
    /// the qualification matters rather than the job title.
    Permission { permission: String },

    /// The requester's line manager, from `employees.reporting_to`.
    ReportingManager,

    /// The head of a department — the requester's own unless one is named.
    ///
    /// This is the rule the leave chain needed and never had: `departments`
    /// had no head column, so its "HOD approval" stage stamped whoever
    /// happened to click.
    DepartmentHead {
        #[serde(default)]
        department_id: Option<Uuid>,
    },

    /// Anyone at or above a seniority rank. Also what escalation climbs.
    DesignationLevelAtLeast { level: i32 },

    /// One specific person. Narrow by design — used for statutory sign-offs
    /// where the individual, not the post, is named.
    NamedUser { user_id: Uuid },

    /// Decided outside the system: an insurer, a registry.
    External { provider: String },

    /// Approved by policy rather than by a person.
    ///
    /// Still records a decision, with this reason attached. It is a rule about
    /// *who* decides, not permission to skip the record — a threshold that
    /// leaves no trail is how a control disappears without anyone choosing to
    /// remove it.
    Automatic { reason: String },
}

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum RuleError {
    #[error("approver rule is missing its 'kind'")]
    MissingKind,

    #[error("approver rule kind '{0}' is not one this server understands")]
    UnknownKind(String),

    #[error("approver rule '{kind}' is missing required field '{field}'")]
    MissingField { kind: String, field: String },

    #[error("approver rule '{kind}' has an invalid '{field}': {detail}")]
    InvalidField {
        kind: String,
        field: String,
        detail: String,
    },
}

impl ApproverRule {
    /// Read a stored rule.
    ///
    /// # Errors
    /// [`RuleError`] for anything unrecognised or incomplete. Never a silent
    /// default — see the module comment.
    pub fn parse(value: &Value) -> Result<Self, RuleError> {
        let kind = value
            .get("kind")
            .and_then(Value::as_str)
            .ok_or(RuleError::MissingKind)?;

        match kind {
            "role" => Ok(Self::Role {
                role: non_empty(value, kind, "role")?,
            }),
            "permission" => Ok(Self::Permission {
                permission: non_empty(value, kind, "permission")?,
            }),
            "reporting_manager" => Ok(Self::ReportingManager),
            "department_head" => Ok(Self::DepartmentHead {
                department_id: optional_uuid(value, kind, "department_id")?,
            }),
            "designation_level_at_least" => {
                let level = value.get("level").and_then(Value::as_i64).ok_or_else(|| {
                    RuleError::MissingField {
                        kind: kind.to_owned(),
                        field: "level".to_owned(),
                    }
                })?;
                i32::try_from(level)
                    .map(|level| Self::DesignationLevelAtLeast { level })
                    .map_err(|_| RuleError::InvalidField {
                        kind: kind.to_owned(),
                        field: "level".to_owned(),
                        detail: format!("{level} is out of range"),
                    })
            }
            "named_user" => {
                let raw = non_empty(value, kind, "user_id")?;
                Uuid::parse_str(&raw)
                    .map(|user_id| Self::NamedUser { user_id })
                    .map_err(|error| RuleError::InvalidField {
                        kind: kind.to_owned(),
                        field: "user_id".to_owned(),
                        detail: error.to_string(),
                    })
            }
            "external" => Ok(Self::External {
                provider: non_empty(value, kind, "provider")?,
            }),
            "automatic" => Ok(Self::Automatic {
                // A reason is mandatory. An automatic approval with no stated
                // basis is indistinguishable from a control that was quietly
                // switched off.
                reason: non_empty(value, kind, "reason")?,
            }),
            other => Err(RuleError::UnknownKind(other.to_owned())),
        }
    }

    /// Whether a person decides this stage.
    ///
    /// `external` and `automatic` do not resolve to assignees, so a stage
    /// using them must never be left waiting for somebody to open an inbox.
    #[must_use]
    pub const fn is_human(&self) -> bool {
        !matches!(self, Self::External { .. } | Self::Automatic { .. })
    }
}

fn non_empty(value: &Value, kind: &str, field: &str) -> Result<String, RuleError> {
    let raw = value
        .get(field)
        .and_then(Value::as_str)
        .ok_or_else(|| RuleError::MissingField {
            kind: kind.to_owned(),
            field: field.to_owned(),
        })?;
    if raw.trim().is_empty() {
        return Err(RuleError::InvalidField {
            kind: kind.to_owned(),
            field: field.to_owned(),
            detail: "must not be blank".to_owned(),
        });
    }
    Ok(raw.to_owned())
}

fn optional_uuid(value: &Value, kind: &str, field: &str) -> Result<Option<Uuid>, RuleError> {
    match value.get(field) {
        None | Some(Value::Null) => Ok(None),
        Some(Value::String(raw)) => {
            Uuid::parse_str(raw)
                .map(Some)
                .map_err(|error| RuleError::InvalidField {
                    kind: kind.to_owned(),
                    field: field.to_owned(),
                    detail: error.to_string(),
                })
        }
        Some(other) => Err(RuleError::InvalidField {
            kind: kind.to_owned(),
            field: field.to_owned(),
            detail: format!("expected a uuid string, got {other}"),
        }),
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::{ApproverRule, RuleError};
    use serde_json::json;
    use uuid::Uuid;

    #[test]
    fn every_rule_kind_parses() {
        let user = Uuid::new_v4();
        let dept = Uuid::new_v4();
        let cases = vec![
            (
                json!({"kind": "role", "role": "hod"}),
                ApproverRule::Role { role: "hod".into() },
            ),
            (
                json!({"kind": "permission", "permission": "pharmacy.ndps.witness"}),
                ApproverRule::Permission {
                    permission: "pharmacy.ndps.witness".into(),
                },
            ),
            (
                json!({"kind": "reporting_manager"}),
                ApproverRule::ReportingManager,
            ),
            (
                json!({"kind": "department_head"}),
                ApproverRule::DepartmentHead {
                    department_id: None,
                },
            ),
            (
                json!({"kind": "department_head", "department_id": dept}),
                ApproverRule::DepartmentHead {
                    department_id: Some(dept),
                },
            ),
            (
                json!({"kind": "designation_level_at_least", "level": 5}),
                ApproverRule::DesignationLevelAtLeast { level: 5 },
            ),
            (
                json!({"kind": "named_user", "user_id": user}),
                ApproverRule::NamedUser { user_id: user },
            ),
            (
                json!({"kind": "external", "provider": "nhcx"}),
                ApproverRule::External {
                    provider: "nhcx".into(),
                },
            ),
            (
                json!({"kind": "automatic", "reason": "under the 500 rupee threshold"}),
                ApproverRule::Automatic {
                    reason: "under the 500 rupee threshold".into(),
                },
            ),
        ];
        for (raw, expected) in cases {
            assert_eq!(ApproverRule::parse(&raw), Ok(expected), "parsing {raw}");
        }
    }

    #[test]
    fn an_unknown_kind_is_refused_rather_than_defaulted() {
        // The rule that matters most. Defaulting to "anyone" would hand a
        // controlled-drug approval to the whole hospital over a typo;
        // defaulting to "nobody" would park the request forever with no
        // explanation. Refusing means somebody reads a message at the desk.
        assert_eq!(
            ApproverRule::parse(&json!({"kind": "everyone"})),
            Err(RuleError::UnknownKind("everyone".into()))
        );
        assert_eq!(ApproverRule::parse(&json!({})), Err(RuleError::MissingKind));
    }

    #[test]
    fn a_rule_missing_its_target_is_refused() {
        assert_eq!(
            ApproverRule::parse(&json!({"kind": "role"})),
            Err(RuleError::MissingField {
                kind: "role".into(),
                field: "role".into()
            })
        );
        assert_eq!(
            ApproverRule::parse(&json!({"kind": "named_user"})),
            Err(RuleError::MissingField {
                kind: "named_user".into(),
                field: "user_id".into()
            })
        );
    }

    #[test]
    fn a_blank_target_is_not_a_target() {
        // `{"kind":"role","role":"  "}` would otherwise resolve to the set of
        // users holding a role named "  " — which is empty, and looks exactly
        // like a correctly configured stage nobody can decide.
        assert!(matches!(
            ApproverRule::parse(&json!({"kind": "role", "role": "   "})),
            Err(RuleError::InvalidField { .. })
        ));
    }

    #[test]
    fn an_automatic_rule_must_say_why() {
        // An automatic approval with no stated basis is indistinguishable
        // from a control somebody switched off.
        assert!(matches!(
            ApproverRule::parse(&json!({"kind": "automatic"})),
            Err(RuleError::MissingField { .. })
        ));
    }

    #[test]
    fn a_malformed_uuid_is_refused_not_ignored() {
        assert!(matches!(
            ApproverRule::parse(&json!({"kind": "named_user", "user_id": "not-a-uuid"})),
            Err(RuleError::InvalidField { .. })
        ));
        // An optional field that is present but wrong must not fall back to
        // "unspecified" — that would silently retarget the stage at the
        // requester's own department.
        assert!(matches!(
            ApproverRule::parse(&json!({"kind": "department_head", "department_id": "nope"})),
            Err(RuleError::InvalidField { .. })
        ));
    }

    #[test]
    fn non_human_stages_are_identified() {
        // A stage nobody can open an inbox for must not be left waiting for
        // somebody to do exactly that.
        assert!(
            !ApproverRule::External {
                provider: "nhcx".into()
            }
            .is_human()
        );
        assert!(
            !ApproverRule::Automatic {
                reason: "policy".into()
            }
            .is_human()
        );
        assert!(ApproverRule::ReportingManager.is_human());
        assert!(ApproverRule::Role { role: "hod".into() }.is_human());
    }
}
