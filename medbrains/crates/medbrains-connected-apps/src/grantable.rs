//! Which permission codes a connected app may hold at all.
//!
//! Approval checks that the approver holds each code (`refuse_escalation_now`),
//! and bypass roles skip that check because they hold everything. That leaves
//! two holes this module closes for every caller, bypass roles included: a
//! code that does not exist (shown on the consent screen as if it meant
//! something), and a code that changes who may do what. An app holding
//! `admin.users.create` or `admin.roles.update` can mint people and roles
//! wider than its own grant, so the manifest's grant would bound nothing.
//!
//! The rule takes no caller on purpose: no role can be let past it.

use medbrains_core::access::catalogue::all_codes;
use medbrains_core::permissions;

/// Whole modules no app may hold: administration (users, roles, API keys,
/// connected apps, SSO, settings) and security (access grants, vendor
/// access), plus remote-access enrolment.
const NEVER_PREFIXES: &[&str] = &["admin.", "security.", "vpn."];

/// Single codes outside those modules that still hand out access: starting
/// break-glass, and issuing credentials to new machines or devices.
const NEVER_CODES: &[&str] = &[
    permissions::audit::START,
    permissions::devices::pairing::TOKEN_CREATE,
    permissions::devices::machines::APPROVE,
    permissions::devices::binding::ISSUE,
];

/// Why `code` may not be granted to an app, or `None` when it may.
///
/// Used by manifest validation at register, by approval, and at token issue,
/// so one rule decides all three.
#[must_use]
pub(crate) fn refusal(code: &str) -> Option<String> {
    if all_codes().binary_search(&code).is_err() {
        return Some(format!("'{code}' is not a MedBrains permission code"));
    }
    let never = NEVER_PREFIXES.iter().any(|p| code.starts_with(p)) || NEVER_CODES.contains(&code);
    never.then(|| format!("'{code}' changes who may do what, so no app may hold it"))
}

/// Every refusal for `codes`, in order, so one answer names them all.
#[must_use]
pub(crate) fn refusals(codes: &[String]) -> Vec<String> {
    codes.iter().filter_map(|c| refusal(c)).collect()
}

#[cfg(test)]
mod tests {
    use super::{refusal, refusals};
    use medbrains_core::permissions;

    #[test]
    fn an_unknown_code_is_refused_by_name() {
        let why = refusal("patients.teleport").unwrap_or_default();
        assert!(why.contains("'patients.teleport' is not a MedBrains permission code"));
    }

    /// The rule has no caller argument, so a hospital administrator, whose
    /// escalation check is skipped, still cannot approve this.
    #[test]
    fn access_changing_codes_are_refused_for_everyone() {
        for code in [
            permissions::admin::users::CREATE,
            permissions::admin::roles::UPDATE,
            permissions::admin::api_keys::CREATE,
            permissions::admin::connected_apps::MANAGE,
            permissions::security::vendor_access::GRANT,
            permissions::audit::START,
            permissions::devices::binding::ISSUE,
        ] {
            assert!(
                refusal(code).is_some_and(|w| w.contains("no app may hold")),
                "{code}"
            );
        }
    }

    #[test]
    fn clinical_reads_stay_grantable() {
        let codes = [permissions::patients::VIEW, permissions::lab::orders::VIEW];
        let codes: Vec<String> = codes.iter().map(|c| (*c).to_owned()).collect();
        assert_eq!(refusals(&codes), Vec::<String>::new());
    }

    /// Every hard-coded never-code is a real code: a typo would refuse nothing.
    #[test]
    fn the_never_list_names_real_codes() {
        for code in super::NEVER_CODES {
            assert!(
                medbrains_core::access::catalogue::all_codes().contains(code),
                "{code}"
            );
        }
    }
}
