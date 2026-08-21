//! Who is asking, on whose behalf, at which facility, and why.
//!
//! `AuthzContext` answers the first of those and nothing else. That is enough
//! for "does this user hold a relation", and not enough for an audit row a
//! privacy officer can act on, which has to say *why* the record was opened.
//!
//! ## What each field is for
//!
//! - **subject** — four classes, not one. A staff member, a patient reading
//!   their own chart, a guardian acting for a minor, and an HL7 feed are
//!   different kinds of caller, and flattening them into "user with a role"
//!   is how a service account ends up with a clinician's authority.
//! - **facility** — the *active* one, not every one the user belongs to. A
//!   consultant working across two hospitals otherwise has every check
//!   silently span both, and the audit log cannot say which hat they wore.
//! - **purpose** — treatment, payment, operations, research, break-glass. The
//!   same read is legitimate under one and a breach under another, and only
//!   the caller knows which.
//! - **consistency** — how fresh the answer must be. Every check is currently
//!   `FullyConsistent`, which is safe and slow; carrying it here is what lets
//!   a cosmetic menu check stop paying for a datastore round trip.
//! - **request_id** — so an audit row joins to the request that produced it.
//!
//! ## What is deliberately not here yet
//!
//! `facility` is the tenant today. This deployment is one hospital per tenant,
//! so the two coincide — but they are named apart because a hospital group
//! makes them diverge, and retrofitting the distinction later means auditing
//! every check again.

use uuid::Uuid;

use crate::AuthzContext;

/// The kind of caller, which decides what it may ever be granted.
///
/// A separate type rather than a role string: `role == "service"` is a value
/// somebody can typo, and a subject class is a decision the schema should
/// enforce.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Subject {
    /// A member of staff, established by the identity feed.
    Staff { user_id: Uuid, role: String },
    /// A patient reading their own record through the portal. Narrower than
    /// staff access, never broader.
    Patient { patient_id: Uuid },
    /// A guardian, power of attorney, or caregiver acting for a patient.
    ///
    /// Per-person and individually revocable — never "the guardians of this
    /// patient", because one of two guardians can be removed by court order
    /// and the other must keep access.
    Proxy { user_id: Uuid, for_patient: Uuid },
    /// A machine: an HL7 feed, a scheduled job, an integration holding an API
    /// key. Has no interactive session, and bulk export is a separate grant it
    /// never inherits from read access.
    Service {
        service_user_id: Uuid,
        api_key_id: Uuid,
    },
}

impl Subject {
    /// The `users` row this subject acts as, for `created_by` attribution.
    ///
    /// A patient has none — portal writes are attributed differently — which
    /// is why this is an `Option` rather than a `Uuid` with a nil sentinel.
    pub const fn acting_user(&self) -> Option<Uuid> {
        match self {
            Self::Staff { user_id, .. } | Self::Proxy { user_id, .. } => Some(*user_id),
            Self::Service {
                service_user_id, ..
            } => Some(*service_user_id),
            Self::Patient { .. } => None,
        }
    }

    /// A stable label for audit rows and SpiceDB subject references.
    pub fn reference(&self) -> String {
        match self {
            Self::Staff { user_id, .. } => format!("user:{user_id}"),
            Self::Patient { patient_id } => format!("patient:{patient_id}"),
            Self::Proxy {
                user_id,
                for_patient,
            } => format!("proxy:{user_id}/{for_patient}"),
            Self::Service { api_key_id, .. } => format!("service:{api_key_id}"),
        }
    }

    /// Whether bulk export may ever be granted to this class.
    ///
    /// Export is the main exfiltration path, so it is refused outright for
    /// proxies and patients rather than left to a permission somebody might
    /// grant by accident.
    pub const fn may_ever_export(&self) -> bool {
        matches!(self, Self::Staff { .. } | Self::Service { .. })
    }
}

/// Why the record is being opened.
///
/// Required rather than defaulted: the same read is treatment in one context
/// and a breach in another, and a default would record the innocent answer for
/// both.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PurposeOfUse {
    Treatment,
    Payment,
    Operations,
    Research,
    /// Emergency access. Always paired with a break-glass grant and a reason.
    BreakGlass,
}

impl PurposeOfUse {
    /// Whether this purpose is allowed to reach identified patient data.
    ///
    /// Research is the one that usually should not: it wants a de-identified
    /// cohort, and a research session reading named charts is the finding an
    /// audit is looking for.
    pub const fn permits_identified_phi(self) -> bool {
        !matches!(self, Self::Research)
    }
}

/// How fresh an authorization answer must be.
///
/// Every check is `Strong` today. That is safe and slow — a menu render pays
/// the same round trip as a chart open. Naming the levels is what lets the
/// cosmetic cases become cheap without anyone deciding that a PHI read may be
/// stale.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Freshness {
    /// Writes, revocation, discharge, consent change. Never cached.
    Strong,
    /// PHI reads — at least as fresh as the token stored on the record, so a
    /// clinician removed from a care team cannot read the chart from cache.
    AtLeastAsFresh,
    /// Menus and module visibility. Cosmetic, and the server re-checks.
    MinimizeLatency,
}

/// The full question: who, where, why, how fresh, and which request.
#[derive(Debug, Clone)]
pub struct AccessContext {
    pub subject: Subject,
    pub tenant_id: Uuid,
    /// The active facility. Equal to `tenant_id` while one tenant is one
    /// hospital; separate so a group deployment does not require re-auditing
    /// every check.
    pub facility_id: Uuid,
    pub purpose: PurposeOfUse,
    pub freshness: Freshness,
    pub request_id: Uuid,
    /// Departments the subject belongs to, for department-scoped visibility.
    pub department_ids: Vec<Uuid>,
    /// Bypass short-circuits every check. Carried here rather than inferred
    /// from the role string so the scoped-admin model has one place to change.
    pub is_bypass: bool,
}

impl AccessContext {
    /// The ordinary case: a staff member treating a patient.
    pub fn treatment(ctx: &AuthzContext, request_id: Uuid) -> Self {
        Self {
            subject: Subject::Staff {
                user_id: ctx.user_id,
                role: ctx.role.clone(),
            },
            tenant_id: ctx.tenant_id,
            facility_id: ctx.tenant_id,
            purpose: PurposeOfUse::Treatment,
            freshness: Freshness::AtLeastAsFresh,
            request_id,
            department_ids: ctx.department_ids.clone(),
            is_bypass: ctx.is_bypass,
        }
    }

    /// Narrow to the older shape, for backends that have not been widened yet.
    pub fn to_authz_context(&self) -> AuthzContext {
        AuthzContext {
            tenant_id: self.tenant_id,
            user_id: self.subject.acting_user().unwrap_or_default(),
            role: match &self.subject {
                Subject::Staff { role, .. } => role.clone(),
                Subject::Patient { .. } => "patient".to_owned(),
                Subject::Proxy { .. } => "proxy".to_owned(),
                Subject::Service { .. } => "service_account".to_owned(),
            },
            department_ids: self.department_ids.clone(),
            is_bypass: self.is_bypass,
        }
    }

    /// Whether this context may be used to export in bulk.
    ///
    /// Two conditions, both required: the subject class must be one that may
    /// ever export, and the purpose must not be break-glass. Emergency access
    /// is for opening one chart in a crisis, never for taking a copy.
    pub const fn may_export(&self) -> bool {
        self.subject.may_ever_export() && !matches!(self.purpose, PurposeOfUse::BreakGlass)
    }
}

#[cfg(test)]
mod tests {
    use super::{AccessContext, Freshness, PurposeOfUse, Subject};
    use crate::AuthzContext;
    use uuid::Uuid;

    fn staff_ctx() -> AuthzContext {
        AuthzContext {
            tenant_id: Uuid::from_u128(1),
            user_id: Uuid::from_u128(2),
            role: "nurse".to_owned(),
            department_ids: vec![Uuid::from_u128(3)],
            is_bypass: false,
        }
    }

    #[test]
    fn treatment_context_carries_the_caller_and_its_purpose() {
        let ctx = AccessContext::treatment(&staff_ctx(), Uuid::from_u128(9));
        assert_eq!(ctx.purpose, PurposeOfUse::Treatment);
        assert_eq!(ctx.freshness, Freshness::AtLeastAsFresh);
        assert_eq!(ctx.subject.acting_user(), Some(Uuid::from_u128(2)));
        assert_eq!(
            ctx.facility_id, ctx.tenant_id,
            "one hospital per tenant, for now"
        );
    }

    /// Export is the main exfiltration path, so two different things have to
    /// be true — and break-glass being one of them is the point: emergency
    /// access opens a chart, it does not authorise taking a copy.
    #[test]
    fn break_glass_never_permits_bulk_export() {
        let mut ctx = AccessContext::treatment(&staff_ctx(), Uuid::nil());
        assert!(ctx.may_export(), "staff on treatment may export");
        ctx.purpose = PurposeOfUse::BreakGlass;
        assert!(
            !ctx.may_export(),
            "emergency access is not an export licence"
        );
    }

    #[test]
    fn patients_and_proxies_can_never_bulk_export() {
        assert!(
            !Subject::Patient {
                patient_id: Uuid::nil()
            }
            .may_ever_export()
        );
        assert!(
            !Subject::Proxy {
                user_id: Uuid::nil(),
                for_patient: Uuid::nil()
            }
            .may_ever_export()
        );
        assert!(
            Subject::Service {
                service_user_id: Uuid::nil(),
                api_key_id: Uuid::nil()
            }
            .may_ever_export()
        );
    }

    /// A patient has no `users` row to attribute writes to, and returning a
    /// nil uuid instead of `None` would attribute them to whoever holds it.
    #[test]
    fn a_patient_subject_has_no_acting_user() {
        assert_eq!(
            Subject::Patient {
                patient_id: Uuid::from_u128(7)
            }
            .acting_user(),
            None
        );
    }

    #[test]
    fn research_does_not_reach_identified_phi() {
        assert!(!PurposeOfUse::Research.permits_identified_phi());
        assert!(PurposeOfUse::Treatment.permits_identified_phi());
    }

    /// The narrowing must not silently change who the caller is.
    #[test]
    fn narrowing_preserves_identity_and_scope() {
        let wide = AccessContext::treatment(&staff_ctx(), Uuid::nil());
        let narrow = wide.to_authz_context();
        assert_eq!(narrow.user_id, Uuid::from_u128(2));
        assert_eq!(narrow.role, "nurse");
        assert_eq!(narrow.department_ids, vec![Uuid::from_u128(3)]);
        assert!(!narrow.is_bypass);
    }
}
