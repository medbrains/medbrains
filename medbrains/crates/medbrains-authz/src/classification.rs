//! How a refusal is shown, decided by the data — never by the call site.
//!
//! The same HIV result must not be masked in one panel and hidden in another.
//! That happens when each developer picks a presentation at the point of use,
//! so the choice is taken away: a field or record type is *classified* once,
//! and the mode follows from the class.
//!
//! ## Why masking is the dangerous one
//!
//! "Test: HIV — result restricted" discloses that the test was ordered, which
//! is usually the disclosure. Masking suits identifiers, where the field's
//! existence is already public (everyone has a date of birth); it rarely suits
//! clinical values, where ordering the test is itself the sensitive fact.
//!
//! ## Why 404 and not 403
//!
//! "You may not view patient 456" confirms patient 456 exists. For the two
//! classes where existence is the secret, the answer has to be indistinguishable
//! from a record that was never there.

use std::fmt;

/// What kind of thing this is, declared once per field or record type.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum DataClass {
    /// Ordinary clinical or operational data.
    Routine,
    /// Clinically sensitive — psych notes, substance use. Existence may be
    /// shown; content may not.
    Sensitive,
    /// Identifiers: date of birth, government ID, phone.
    Identifying,
    /// Restricted results — the value never leaves the server.
    Restricted,
    /// Existence is not advertised, but may be inferable from gaps or totals.
    Confidential,
    /// Existence is the secret. Absent from lists, counts, search and exports.
    Sealed,
}

/// How the refusal is presented. Derived from [`DataClass`], never chosen.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DenialMode {
    /// Control visible and inert, with a reason. Leaks that the action exists.
    Disabled,
    /// "Restricted — 3 notes", with a request button. Leaks count and timing.
    Tombstone,
    /// `DOB 19**`. Leaks the schema, and sometimes the answer by elimination.
    Masked,
    /// Field absent from the payload; a lock placeholder in its position.
    Redacted,
    /// Not rendered at all.
    Hidden,
    /// Absent everywhere — lists, counts, search, exports. Direct access 404s.
    Cloaked,
}

impl DataClass {
    /// The one place a presentation is chosen.
    pub const fn denial_mode(self) -> DenialMode {
        match self {
            Self::Routine => DenialMode::Disabled,
            Self::Sensitive => DenialMode::Tombstone,
            Self::Identifying => DenialMode::Masked,
            Self::Restricted => DenialMode::Redacted,
            Self::Confidential => DenialMode::Hidden,
            Self::Sealed => DenialMode::Cloaked,
        }
    }

    /// Whether a refusal must be indistinguishable from "no such record".
    ///
    /// True only where existence itself is the secret. Everything else gets a
    /// 403 with a reason, because a caller who may not do something is better
    /// served by being told so.
    pub const fn refuse_as_not_found(self) -> bool {
        matches!(self, Self::Confidential | Self::Sealed)
    }

    /// Whether the value may reach the client at all.
    ///
    /// Sending a restricted value and hiding it in CSS is a breach waiting for
    /// a devtools screenshot.
    pub const fn value_may_leave_the_server(self) -> bool {
        matches!(self, Self::Routine | Self::Identifying)
    }

    /// Whether this must be filtered out of lists, counts, search and exports.
    ///
    /// Cloaking is systemic or it is nothing: a sealed record that still moves
    /// a census total is not sealed. This cannot be honoured by a component —
    /// it is a query-layer obligation.
    pub const fn requires_cloaking(self) -> bool {
        matches!(self, Self::Sealed)
    }

    /// Whether a refusal here is itself worth recording.
    ///
    /// Repeated tombstone hits on one chart is the cheapest early warning of
    /// inappropriate access there is.
    pub const fn audit_the_refusal(self) -> bool {
        !matches!(self, Self::Routine)
    }
}

impl fmt::Display for DataClass {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::Routine => "routine",
            Self::Sensitive => "sensitive",
            Self::Identifying => "identifying",
            Self::Restricted => "restricted",
            Self::Confidential => "confidential",
            Self::Sealed => "sealed",
        })
    }
}

impl fmt::Display for DenialMode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::Disabled => "disabled",
            Self::Tombstone => "tombstone",
            Self::Masked => "masked",
            Self::Redacted => "redacted",
            Self::Hidden => "hidden",
            Self::Cloaked => "cloaked",
        })
    }
}

/// Which relation granted access — the part of an audit row somebody acts on.
///
/// "Dr Rao viewed this chart" is not actionable. "Dr Rao viewed this chart via
/// break-glass" is a review item; "via `care_team`" is routine. Without the
/// grant, an audit log records that something happened and not whether it
/// should have.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Grant {
    /// A named relation in the schema — `attending`, `dept_member`, `viewer`.
    Relation(String),
    /// An RBAC permission code.
    Permission(String),
    /// Emergency access. Always reviewable.
    BreakGlass { reason: String },
    /// A bypass role short-circuited the check.
    Bypass { role: String },
    /// Granted from cache during a backend outage — see degraded mode.
    Degraded,
}

impl Grant {
    /// Whether this grant belongs in the review queue.
    ///
    /// Break-glass and degraded-mode grants are the two that were made without
    /// the usual evidence, so both are reviewed. An unreviewed queue turns
    /// break-glass into an unlogged bypass within a month.
    pub const fn needs_review(&self) -> bool {
        matches!(self, Self::BreakGlass { .. } | Self::Degraded)
    }
}

impl fmt::Display for Grant {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Relation(name) => write!(f, "relation:{name}"),
            Self::Permission(code) => write!(f, "permission:{code}"),
            Self::BreakGlass { .. } => f.write_str("break_glass"),
            Self::Bypass { role } => write!(f, "bypass:{role}"),
            Self::Degraded => f.write_str("degraded_mode"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{DataClass, DenialMode, Grant};

    /// The rule the whole module exists for: the class decides, not the caller.
    #[test]
    fn every_class_has_exactly_one_mode() {
        let pairs = [
            (DataClass::Routine, DenialMode::Disabled),
            (DataClass::Sensitive, DenialMode::Tombstone),
            (DataClass::Identifying, DenialMode::Masked),
            (DataClass::Restricted, DenialMode::Redacted),
            (DataClass::Confidential, DenialMode::Hidden),
            (DataClass::Sealed, DenialMode::Cloaked),
        ];
        for (class, mode) in pairs {
            assert_eq!(
                class.denial_mode(),
                mode,
                "{class} must always render as {mode}"
            );
        }
    }

    /// A 403 on a sealed record confirms it exists, which is the one thing
    /// sealing is meant to prevent.
    #[test]
    fn only_existence_secrets_refuse_as_not_found() {
        assert!(DataClass::Sealed.refuse_as_not_found());
        assert!(DataClass::Confidential.refuse_as_not_found());
        for open in [
            DataClass::Routine,
            DataClass::Sensitive,
            DataClass::Restricted,
        ] {
            assert!(
                !open.refuse_as_not_found(),
                "{open} should say why it refused"
            );
        }
    }

    /// Restricted and sensitive values must never reach the client — hiding
    /// them client-side leaves them in the response.
    #[test]
    fn restricted_values_never_leave_the_server() {
        assert!(!DataClass::Restricted.value_may_leave_the_server());
        assert!(!DataClass::Sensitive.value_may_leave_the_server());
        assert!(!DataClass::Sealed.value_may_leave_the_server());
        assert!(
            DataClass::Identifying.value_may_leave_the_server(),
            "masking happens client-side"
        );
    }

    /// Cloaking is systemic: exactly one class demands list/count/export
    /// filtering, and it is not something a component can honour.
    #[test]
    fn only_sealed_demands_cloaking() {
        assert!(DataClass::Sealed.requires_cloaking());
        for other in [
            DataClass::Routine,
            DataClass::Sensitive,
            DataClass::Identifying,
            DataClass::Restricted,
            DataClass::Confidential,
        ] {
            assert!(!other.requires_cloaking());
        }
    }

    /// Denials on anything but routine data are the interesting events.
    #[test]
    fn refusals_are_audited_except_on_routine_data() {
        assert!(!DataClass::Routine.audit_the_refusal());
        assert!(DataClass::Sensitive.audit_the_refusal());
        assert!(DataClass::Sealed.audit_the_refusal());
    }

    /// The two grants made without the usual evidence both get reviewed.
    #[test]
    fn break_glass_and_degraded_grants_go_to_review() {
        assert!(
            Grant::BreakGlass {
                reason: "arrest in resus".into()
            }
            .needs_review()
        );
        assert!(Grant::Degraded.needs_review());
        assert!(!Grant::Relation("attending".into()).needs_review());
        assert!(!Grant::Permission("patients.view".into()).needs_review());
        assert!(
            !Grant::Bypass {
                role: "hospital_admin".into()
            }
            .needs_review(),
            "bypass is logged, but it is not an exception to the rules — it is the rules",
        );
    }

    /// A break-glass reason is free text and may name a patient; the audit
    /// label must not carry it into every log line.
    #[test]
    fn the_grant_label_does_not_leak_the_break_glass_reason() {
        let grant = Grant::BreakGlass {
            reason: "Mrs Iyer, bed 4, arrest".into(),
        };
        assert_eq!(grant.to_string(), "break_glass");
        assert!(!grant.to_string().contains("Iyer"));
    }
}
