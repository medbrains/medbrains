//! Three-valued authorization: allow, deny, and *unknown*.
//!
//! A check has three outcomes, not two. The third is an outage — `SpiceDB`
//! unreachable, a timeout, a schema miss — and collapsing it into `false` is
//! the shortest path from a dependency being down to disclosing a record.
//!
//! ```ignore
//! // the bug this module exists to prevent
//! if !can_view_restricted(&claims).unwrap_or(false) {
//!     show_the_data();          // the check errored, so we showed it
//! }
//! ```
//!
//! `unwrap_or(false)` reads as "deny on error", which is right until somebody
//! negates it. Then "not permitted to see restricted data" becomes "show it".
//!
//! So combinators here are **Kleene**, not boolean, and they carry `Unknown`
//! through to a single collapse at the boundary — `require()`, or the degraded
//! mode policy. One invariant holds across all four:
//!
//! > **No combinator ever produces `Allow` from `Unknown` alone.**
//!
//! An outage must not manufacture a positive out of a negative.
//!
//! ## Why `none` and `not_all` both exist
//!
//! Under boolean logic they collapse into each other. Under Kleene they do not:
//! `none` is the negation of `any`, `not_all` the negation of `all`, and the
//! two disagree whenever some inputs are `Unknown`. Naming only one of them
//! means somebody eventually writes the other by hand, with `!` and a boolean.

use std::fmt;

/// The outcome of one authorization check.
///
/// `Unknown` is not a failure to decide — it is a decision that could not be
/// made, which is a different thing and must stay distinguishable all the way
/// to the boundary.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Outcome {
    /// The subject holds the permission.
    Allow,
    /// The subject does not hold it. A real answer.
    Deny,
    /// The question could not be answered — outage, timeout, schema miss.
    Unknown,
}

impl Outcome {
    /// Whether this is a definite allow. Deliberately not `From<Outcome> for
    /// bool`: an implicit conversion is exactly how `Unknown` gets flattened.
    pub const fn is_allow(self) -> bool {
        matches!(self, Self::Allow)
    }

    /// Collapse to a decision at the boundary, and only there.
    ///
    /// `Unknown` becomes `Deny` — fail closed. Callers that want the bounded
    /// exception (degraded mode) must ask for it explicitly rather than
    /// receive it by default.
    pub const fn resolve(self) -> bool {
        matches!(self, Self::Allow)
    }
}

impl fmt::Display for Outcome {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::Allow => "allow",
            Self::Deny => "deny",
            Self::Unknown => "unknown",
        })
    }
}

/// Every input must allow.
///
/// `Deny` wins over `Unknown`, because one definite refusal settles the
/// question however many other branches are unreachable.
pub fn all(outcomes: impl IntoIterator<Item = Outcome>) -> Outcome {
    let mut saw_unknown = false;
    for outcome in outcomes {
        match outcome {
            Outcome::Deny => return Outcome::Deny,
            Outcome::Unknown => saw_unknown = true,
            Outcome::Allow => {}
        }
    }
    if saw_unknown {
        Outcome::Unknown
    } else {
        Outcome::Allow
    }
}

/// At least one input must allow.
///
/// `Allow` wins over `Unknown` — one definite grant is enough, and the
/// unreachable branches cannot take it away.
pub fn any(outcomes: impl IntoIterator<Item = Outcome>) -> Outcome {
    let mut saw_unknown = false;
    for outcome in outcomes {
        match outcome {
            Outcome::Allow => return Outcome::Allow,
            Outcome::Unknown => saw_unknown = true,
            Outcome::Deny => {}
        }
    }
    if saw_unknown {
        Outcome::Unknown
    } else {
        Outcome::Deny
    }
}

/// No input may allow — the negation of [`any`].
///
/// **Gate a denial path with this, never a disclosure path.** It is a negative
/// check returning a positive result, so it tends to sit in front of a reveal,
/// which is where an outage turning into `Allow` would be a disclosure. The
/// implementation cannot do that — `Unknown` propagates — but the call site can
/// still misuse the answer.
///
/// Legitimate: showing a request-access panel, routing to break-glass, hiding a
/// shortcut. Illegitimate: rendering data, enabling a write.
pub fn none(outcomes: impl IntoIterator<Item = Outcome>) -> Outcome {
    match any(outcomes) {
        Outcome::Allow => Outcome::Deny,
        Outcome::Deny => Outcome::Allow,
        Outcome::Unknown => Outcome::Unknown,
    }
}

/// Not every input allows — the negation of [`all`].
///
/// Distinct from [`none`] exactly when some input is `Unknown`, which is why
/// both are named here rather than left to a `!`.
pub fn not_all(outcomes: impl IntoIterator<Item = Outcome>) -> Outcome {
    match all(outcomes) {
        Outcome::Allow => Outcome::Deny,
        Outcome::Deny => Outcome::Allow,
        Outcome::Unknown => Outcome::Unknown,
    }
}

/// One authorization answer, with everything an audit row needs.
///
/// A bare `bool` cannot say *why* access was granted, and "Dr Rao viewed this
/// chart" is not actionable while "Dr Rao viewed this chart via break-glass"
/// is a review item. The grant is the difference between a log and an audit.
#[derive(Debug, Clone)]
pub struct Decision {
    pub outcome: Outcome,
    /// Which relation, permission or exception allowed it. `None` when denied
    /// or unknown — there is nothing to attribute.
    pub grant: Option<crate::classification::Grant>,
    /// What kind of data this is, which decides how a refusal is shown.
    pub class: crate::classification::DataClass,
    /// The revision the answer was computed at, for `at_least_as_fresh` reads.
    pub checked_at: Option<String>,
}

impl Decision {
    /// A refusal on data of this class.
    pub const fn denied(class: crate::classification::DataClass) -> Self {
        Self {
            outcome: Outcome::Deny,
            grant: None,
            class,
            checked_at: None,
        }
    }

    /// The backend could not answer. Distinct from a refusal, and it must stay
    /// distinct internally even though the wire response is identical.
    pub const fn unavailable(class: crate::classification::DataClass) -> Self {
        Self {
            outcome: Outcome::Unknown,
            grant: None,
            class,
            checked_at: None,
        }
    }

    /// Allowed, and by what.
    pub const fn allowed(
        class: crate::classification::DataClass,
        grant: crate::classification::Grant,
    ) -> Self {
        Self {
            outcome: Outcome::Allow,
            grant: Some(grant),
            class,
            checked_at: None,
        }
    }

    /// The status a refusal should carry.
    ///
    /// 404 where existence is the secret, 403 everywhere else — a caller who
    /// merely lacks a permission is better served by being told so.
    pub const fn refusal_status(&self) -> u16 {
        if self.class.refuse_as_not_found() {
            404
        } else {
            403
        }
    }

    /// Whether this decision belongs in the review queue.
    pub const fn needs_review(&self) -> bool {
        match &self.grant {
            Some(grant) => grant.needs_review(),
            // A refusal on classified data is itself worth seeing.
            None => self.class.audit_the_refusal(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{Outcome::*, all, any, none, not_all};

    #[test]
    fn all_denies_on_one_deny_even_beside_unknown() {
        assert_eq!(all([Allow, Deny]), Deny);
        assert_eq!(all([Unknown, Deny]), Deny, "a definite refusal settles it");
        assert_eq!(all([Allow, Unknown]), Unknown);
        assert_eq!(all([Allow, Allow]), Allow);
        assert_eq!(all([]), Allow, "vacuous truth");
    }

    #[test]
    fn any_allows_on_one_allow_even_beside_unknown() {
        assert_eq!(any([Deny, Allow]), Allow);
        assert_eq!(any([Unknown, Allow]), Allow, "a definite grant settles it");
        assert_eq!(any([Deny, Unknown]), Unknown);
        assert_eq!(any([Deny, Deny]), Deny);
        assert_eq!(any([]), Deny, "vacuously nobody granted it");
    }

    /// The reason both exist. Under boolean logic these would agree.
    #[test]
    fn none_and_not_all_diverge_on_unknown() {
        let inputs = [Allow, Unknown];
        assert_eq!(none(inputs), Deny, "something allowed, so 'none' is false");
        assert_eq!(not_all(inputs), Unknown, "cannot tell whether all allow");
        assert_ne!(none(inputs), not_all(inputs));
    }

    /// The invariant the whole module exists to hold.
    #[test]
    fn no_combinator_manufactures_allow_from_unknown_alone() {
        let only_unknown = [Unknown, Unknown];
        for (name, result) in [
            ("all", all(only_unknown)),
            ("any", any(only_unknown)),
            ("none", none(only_unknown)),
            ("not_all", not_all(only_unknown)),
        ] {
            assert_eq!(result, Unknown, "{name} produced {result} from unknowns");
        }
    }

    /// A refusal on a sealed record must be indistinguishable from one that
    /// was never there — a 403 confirms existence.
    #[test]
    fn refusal_status_hides_existence_only_where_it_is_the_secret() {
        use crate::classification::DataClass;
        assert_eq!(
            super::Decision::denied(DataClass::Sealed).refusal_status(),
            404
        );
        assert_eq!(
            super::Decision::denied(DataClass::Confidential).refusal_status(),
            404
        );
        assert_eq!(
            super::Decision::denied(DataClass::Routine).refusal_status(),
            403
        );
        assert_eq!(
            super::Decision::denied(DataClass::Restricted).refusal_status(),
            403
        );
    }

    /// An outage and a refusal answer the same on the wire and must not be the
    /// same internally — one is a decision, the other is a broken dependency.
    #[test]
    fn unavailable_is_not_a_denial() {
        use crate::classification::DataClass;
        let denied = super::Decision::denied(DataClass::Routine);
        let outage = super::Decision::unavailable(DataClass::Routine);
        assert_eq!(denied.outcome, Deny);
        assert_eq!(outage.outcome, Unknown);
        assert_ne!(denied.outcome, outage.outcome);
        assert!(!outage.outcome.resolve(), "an outage still fails closed");
    }

    /// Emergency access carries its grant into the review queue.
    #[test]
    fn a_break_glass_decision_is_reviewable() {
        use crate::classification::{DataClass, Grant};
        let normal =
            super::Decision::allowed(DataClass::Routine, Grant::Relation("attending".into()));
        let emergency = super::Decision::allowed(
            DataClass::Routine,
            Grant::BreakGlass {
                reason: "arrest".into(),
            },
        );
        assert!(!normal.needs_review());
        assert!(emergency.needs_review());
    }

    /// An outage must never become a grant, however it is combined.
    #[test]
    fn unknown_never_resolves_to_permission() {
        assert!(!Unknown.resolve(), "unknown must fail closed");
        assert!(!Unknown.is_allow());
        assert!(!Deny.resolve());
        assert!(Allow.resolve());
    }
}
