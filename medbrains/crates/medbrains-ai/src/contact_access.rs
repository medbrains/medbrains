//! Whether an answer may show the patient's own phone, email and address.
//!
//! The same check as the patient screen (`medbrains-patients::get_patient`):
//! `patients.view`, access to this patient (decided once per turn by the
//! grounding gate), and the user's field access on the contact fields. A
//! masked or hidden field stays held. A fault reading field access is
//! [`ContactAccess::Unknown`]: held, and the user is told.

// `pub` here would trip the workspace's denied `unreachable_pub`; `pub(super)`
// is the narrowest visibility the parent module can use.
#![expect(
    clippy::redundant_pub_crate,
    reason = "unreachable_pub is denied workspace-wide"
)]

use std::collections::HashMap;

use medbrains_core::ai_guard::ContactAccess;
use medbrains_core::ai_redact::{Kind, Redactor};
use medbrains_core::form::FieldAccessLevel;
use medbrains_core::permissions;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::middleware::field_access;
use medbrains_server_core::state::AppState;
use uuid::Uuid;

/// Each contact placeholder kind and the patient fields that gate it.
const GATES: &[(Kind, &[&str])] = &[
    (Kind::Phone, &["patients.phone", "patients.phone_secondary"]),
    (Kind::Email, &["patients.email"]),
    (Kind::Address, &["patients.address"]),
    (Kind::Pincode, &["patients.address"]),
];

/// The contact access for this turn. `patient` is the grounded patient:
/// `None` when there is none or the user may not see them.
pub(super) async fn for_turn(
    state: &AppState,
    claims: &Claims,
    patient: Option<Uuid>,
    redactor: &Redactor,
) -> ContactAccess {
    if patient.is_none() {
        return ContactAccess::Hidden;
    }
    if let Err(_denied) = require_permission(claims, permissions::patients::VIEW) {
        return ContactAccess::Hidden;
    }
    match field_access::resolve_restricted_fields(
        &state.db,
        claims.tenant_id,
        claims.sub,
        &claims.role,
    )
    .await
    {
        Ok(restricted) => shown(&restricted, redactor),
        Err(e) => {
            tracing::error!(target: "ai", error = %e, "contact field access unknown; held");
            ContactAccess::Unknown
        }
    }
}

/// The patient's own contact placeholders whose fields are fully visible.
fn shown(restricted: &HashMap<String, FieldAccessLevel>, redactor: &Redactor) -> ContactAccess {
    let kinds: Vec<Kind> = GATES
        .iter()
        .filter(|(_, fields)| fields.iter().all(|f| visible(restricted, f)))
        .map(|(kind, _)| *kind)
        .collect();
    ContactAccess::Shown(redactor.own_placeholders(&kinds))
}

/// Absent means `Edit`, as on the patient screen.
fn visible(restricted: &HashMap<String, FieldAccessLevel>, field: &str) -> bool {
    matches!(
        restricted.get(field),
        None | Some(FieldAccessLevel::Edit | FieldAccessLevel::View)
    )
}

#[cfg(test)]
mod tests {
    use chrono::NaiveDate;
    use medbrains_core::ai_redact::{KnownIdentifiers, PseudonymMap};

    use super::{ContactAccess, FieldAccessLevel, HashMap, Kind, Redactor, shown};

    fn redactor() -> Redactor {
        let mut k = KnownIdentifiers::default();
        k.add(Kind::Phone, Some("9840012345"));
        k.add(Kind::Email, Some("kavitha@example.in"));
        k.add(Kind::Aadhaar, Some("4991 1866 5246"));
        let today = NaiveDate::from_ymd_opt(2026, 10, 25).unwrap_or_default();
        Redactor::new(PseudonymMap::default(), &k, today)
    }

    #[test]
    fn full_field_access_shows_contacts_and_never_aadhaar() {
        let access = shown(&HashMap::new(), &redactor());
        let want = ["[PHONE_1]".to_owned(), "[EMAIL_1]".to_owned()].into();
        assert_eq!(access, ContactAccess::Shown(want));
    }

    #[test]
    fn a_masked_or_hidden_field_holds_its_kind() {
        let restricted = HashMap::from([
            (
                "patients.phone_secondary".to_owned(),
                FieldAccessLevel::Mask,
            ),
            ("patients.email".to_owned(), FieldAccessLevel::Hidden),
        ]);
        assert_eq!(
            shown(&restricted, &redactor()),
            ContactAccess::Shown(std::collections::HashSet::new())
        );
    }
}
