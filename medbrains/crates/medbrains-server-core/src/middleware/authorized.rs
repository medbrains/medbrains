//! Permission as a type, checked before the handler runs.
//!
//! ## What this replaces
//!
//! Every guarded handler currently spells the same two things:
//!
//! ```ignore
//! Extension(claims): Extension<Claims>,
//! // ...
//! require_permission(&claims, permissions::admin::users::LIST)?;
//! ```
//!
//! There are 1,738 of that second line. It is easy to omit — 154 routes had
//! omitted it — and nothing in the type system notices, because a handler that
//! takes `Claims` and never checks them compiles perfectly.
//!
//! ```ignore
//! auth: Authorized<AdminUsersList>,
//! ```
//!
//! The permission moves into the signature, where it cannot be forgotten
//! without also losing access to the claims. `Authorized<P>` derefs to
//! `Claims`, so bodies that use `claims.tenant_id` or `claims.sub` are
//! unchanged — which matters, because 1,609 of the 1,656 guarded handlers need
//! the claims for something other than the check.
//!
//! ## Why this and not a route layer
//!
//! `.route_layer(require(PERM))` reads well and puts the permission next to the
//! path. It removes the same 1,738 statements — and adds 1,738 route-site calls,
//! so it is a wash on volume. It also cannot remove `Extension<Claims>`, since
//! only 47 handlers take the claims *solely* to check them.
//!
//! A route layer is also still forgettable: a route added without one compiles
//! and serves. This does not.
//!
//! ## Why this is where admin scope belongs
//!
//! [`authorize`] is the single place a permission decision is made, so a scoped
//! admin model — platform, hospital group, tenant, or one module — is a change
//! here rather than at 1,738 call sites. The module is simply the first segment
//! of the code, which is why this is only now practical: as of this week every
//! route carries a permission, so that prefix is a complete taxonomy.

use std::marker::PhantomData;

use axum::extract::FromRequestParts;
use axum::http::request::Parts;

use crate::error::AppError;
use crate::middleware::auth::Claims;
use crate::middleware::authorization::require_permission;
use medbrains_authz::decision::{self, Outcome};

/// A permission code, lifted into the type system.
///
/// Implemented by generated marker types — one per constant in
/// `medbrains_core::permissions` — so the compiler carries the code that a
/// handler requires.
pub trait Permission {
    /// The dotted code, e.g. `"admin.users.list"`.
    const CODE: &'static str;
}


/// A requirement an endpoint places on the caller.
///
/// Deliberately flat rather than a general algebra. The API needs exactly two
/// shapes and one level: 1,447 routes want a single permission, 87 accept any
/// of a set, 58 require two or more. Only 7 mix both, and those keep an inline
/// check — a nestable `All<Any<..>>` would be machinery built for seven cases.
pub trait Requirement {
    /// Every code this requirement mentions — also what the manifest reports.
    fn codes() -> Vec<&'static str>;

    /// Whether the caller must hold all of them or any one.
    fn check(claims: &Claims) -> Result<(), AppError>;
}

impl<P: Permission> Requirement for P {
    fn codes() -> Vec<&'static str> {
        vec![P::CODE]
    }

    fn check(claims: &Claims) -> Result<(), AppError> {
        enforce(authorize(claims, P::CODE), &[P::CODE])
    }
}

/// The caller must hold every one.
pub struct AllOf<T>(PhantomData<T>);

/// The caller must hold at least one.
///
/// Refuses with the whole set named, because "you need one of these three" is
/// actionable and "forbidden" is not.
pub struct AnyOf<T>(PhantomData<T>);

macro_rules! all_of {
    ($($name:ident),+) => {
        impl<$($name: Permission),+> Requirement for AllOf<($($name,)+)> {
            fn codes() -> Vec<&'static str> { vec![$($name::CODE),+] }
            fn check(claims: &Claims) -> Result<(), AppError> {
                let codes = [$($name::CODE),+];
                enforce(decision::all(codes.iter().map(|c| authorize(claims, c))), &codes)
            }
        }
    };
}

macro_rules! any_of {
    ($($name:ident),+) => {
        impl<$($name: Permission),+> Requirement for AnyOf<($($name,)+)> {
            fn codes() -> Vec<&'static str> { vec![$($name::CODE),+] }
            fn check(claims: &Claims) -> Result<(), AppError> {
                let codes = [$($name::CODE),+];
                enforce(decision::any(codes.iter().map(|c| authorize(claims, c))), &codes)
            }
        }
    };
}

all_of!(A, B);
all_of!(A, B, C);
all_of!(A, B, C, D);
any_of!(A, B);
any_of!(A, B, C);
any_of!(A, B, C, D);

/// Claims that have already been checked against `P`.
///
/// Holding one is proof the check ran: there is no way to construct it except
/// through the extractor, and the extractor calls [`authorize`].
#[derive(Debug, Clone)]
pub struct Authorized<R: Requirement> {
    claims: Claims,
    _requirement: PhantomData<R>,
}

impl<R: Requirement> Authorized<R> {
    /// The underlying claims.
    pub const fn claims(&self) -> &Claims {
        &self.claims
    }

    /// Consume the wrapper, e.g. to pass claims to a helper that takes them by
    /// value.
    pub fn into_claims(self) -> Claims {
        self.claims
    }
}

// So `auth.tenant_id` and `auth.sub` keep working and 1,609 handler bodies
// need no edit at all.
impl<R: Requirement> std::ops::Deref for Authorized<R> {
    type Target = Claims;

    fn deref(&self) -> &Self::Target {
        &self.claims
    }
}

/// The single point at which a permission decision is made.
///
/// Returns three values, not two. Today only `Allow` and `Deny` can occur —
/// `require_permission` reads a `Vec<String>` and cannot fail — but the moment
/// a ReBAC backend is in this path, an outage becomes `Unknown`, and the
/// combinators below must already be carrying it rather than flattening it.
///
/// That flattening was a real defect here: `AnyOf` used `.is_ok()`, which
/// turns an outage into "not allowed" and, under any negation upstream, into
/// "allowed".
///
/// Bypass roles still short-circuit, deliberately: behaviour is unchanged, so
/// a migration cannot alter who can do what. A scoped admin model replaces the
/// body of this function and nothing else.
pub fn authorize(claims: &Claims, code: &str) -> Outcome {
    if require_permission(claims, code).is_ok() {
        Outcome::Allow
    } else {
        Outcome::Deny
    }
}

/// Collapse at the boundary — and only here.
fn enforce(outcome: Outcome, codes: &[&'static str]) -> Result<(), AppError> {
    if outcome.is_allow() {
        return Ok(());
    }
    Err(AppError::ForbiddenReason(if codes.len() == 1 {
        format!("Requires the {} permission.", codes[0])
    } else {
        format!("Requires one of: {}.", codes.join(", "))
    }))
}

impl<R, S> FromRequestParts<S> for Authorized<R>
where
    R: Requirement,
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        // The auth middleware inserted these. Absent means the route was
        // mounted on the public router, which for a permission-bearing handler
        // is a mistake worth failing loudly — six onboarding endpoints returned
        // 500 for months because of exactly that.
        let claims = parts
            .extensions
            .get::<Claims>()
            .cloned()
            .ok_or(AppError::Unauthorized)?;

        R::check(&claims)?;

        Ok(Self {
            claims,
            _requirement: PhantomData,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::{Authorized, Permission};
    use crate::middleware::auth::Claims;
    use uuid::Uuid;

    struct PatientsList;
    impl Permission for PatientsList {
        const CODE: &'static str = "patients.list";
    }

    fn claims(role: &str, permissions: &[&str]) -> Claims {
        Claims {
            sub: Uuid::nil(),
            tenant_id: Uuid::nil(),
            role: role.to_owned(),
            permissions: permissions.iter().map(|p| (*p).to_owned()).collect(),
            department_ids: Vec::new(),
            perm_version: 0,
            paired_device_id: None,
            exp: 0,
        }
    }

    #[test]
    fn the_code_travels_in_the_type() {
        assert_eq!(<PatientsList as Permission>::CODE, "patients.list");
    }

    /// The whole point: reaching the claims requires passing the check, so a
    /// handler cannot hold identity it was not authorised for.
    #[test]
    fn authorize_gates_construction() {
        use medbrains_authz::decision::Outcome;
        assert_eq!(
            super::authorize(&claims("nurse", &["patients.list"]), PatientsList::CODE),
            Outcome::Allow
        );
        assert_eq!(
            super::authorize(&claims("nurse", &["patients.view"]), PatientsList::CODE),
            Outcome::Deny,
            "a definite refusal, not an outage"
        );
    }

    struct PatientsView;
    impl Permission for PatientsView {
        const CODE: &'static str = "patients.view";
    }
    struct BillingList;
    impl Permission for BillingList {
        const CODE: &'static str = "billing.invoices.list";
    }

    /// 58 routes require two or more. Holding one of them is not enough.
    #[test]
    fn all_of_needs_every_one() {
        use super::{AllOf, Requirement};
        let both = claims("nurse", &["patients.list", "patients.view"]);
        let one = claims("nurse", &["patients.list"]);
        assert!(AllOf::<(PatientsList, PatientsView)>::check(&both).is_ok());
        assert!(AllOf::<(PatientsList, PatientsView)>::check(&one).is_err());
    }

    /// 87 routes accept any of a set — billing lists open to either the
    /// invoice permission or the advance-adjust one.
    #[test]
    fn any_of_needs_only_one() {
        use super::{AnyOf, Requirement};
        let one = claims("clerk", &["billing.invoices.list"]);
        let none = claims("clerk", &["patients.list"]);
        assert!(AnyOf::<(BillingList, PatientsView)>::check(&one).is_ok());
        assert!(AnyOf::<(BillingList, PatientsView)>::check(&none).is_err());
    }

    /// A refusal that names the alternatives, because "forbidden" tells the
    /// caller nothing they can act on.
    #[test]
    fn any_of_says_what_would_have_worked() {
        use super::{AnyOf, Requirement};
        let error = AnyOf::<(BillingList, PatientsView)>::check(&claims("clerk", &[]))
            .expect_err("no permissions held");
        let text = error.to_string();
        assert!(text.contains("billing.invoices.list"), "{text}");
        assert!(text.contains("patients.view"), "{text}");
    }

    #[test]
    fn deref_exposes_the_claims_unchanged() {
        let auth = Authorized::<PatientsList> {
            claims: claims("nurse", &["patients.list"]),
            _requirement: std::marker::PhantomData,
        };
        assert_eq!(auth.role, "nurse");
        assert_eq!(auth.claims().role, "nurse");
    }
}
