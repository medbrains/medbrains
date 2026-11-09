//! What a grant's scope lets a vendor account do — an allowlist, not a
//! denylist.
//!
//! A grant carries **read** codes of the chosen modules, and for configuration
//! only, a short list of master-data edits. Nothing else: no code that makes a
//! credential (keys, devices, display tokens, signing credentials), opens an
//! outbound channel (webhooks, integrations, messages, campaigns) or sets up
//! something the system runs later (automations, flows, pipelines, retries,
//! restores, system state). Those outlive the grant — a webhook made in a
//! masked four-hour session keeps sending unmasked events for ever — so a new
//! code is excluded until someone adds it here on purpose.

use medbrains_core::access::catalogue::{all_codes, module_of};

/// The scope entry meaning configuration only.
pub const CONFIG_SCOPE: &str = "config";

/// Actions that only read. A code ending in one of these is a read.
const READ_ACTIONS: &[&str] = &["list", "view", "read", "search", "view_own"];

/// Configuration edits a support session may make, all master data the
/// hospital can see and undo on its own screens: no credential, no outbound
/// channel, nothing scheduled. Deletes are left out on purpose, as are
/// general settings (they hold provider keys and callback addresses), module
/// switches, numbering sequences and regulatory settings.
const CONFIG_EDITS: &[&str] = &[
    "admin.settings.bed_types.manage",
    "admin.settings.billing_tax.manage",
    "admin.settings.branding.manage",
    "admin.settings.clinical_masters.create",
    "admin.settings.clinical_masters.update",
    "admin.settings.departments.create",
    "admin.settings.departments.update",
    "admin.settings.facilities.create",
    "admin.settings.facilities.update",
    "admin.settings.locations.create",
    "admin.settings.locations.update",
    "admin.settings.services.create",
    "admin.settings.services.update",
];

/// Prefixes no grant reaches even to read: who may sign in and how, keys and
/// secrets, outbound endpoints, raw event payloads and audit records, and
/// granting vendor access itself.
const NEVER_UNDER_A_GRANT: &[&str] = &[
    "security.vendor_access",
    "security.access",
    "admin.users",
    "admin.roles",
    "admin.api_keys",
    "admin.access_requests",
    "admin.connected_apps",
    "admin.signature_credentials",
    "admin.sharing",
    "admin.security",
    "admin.backup",
    "admin.webhooks",
    "admin.db_topology",
    "admin.system_state",
    "admin.tv_displays",
    "admin.outbox",
    "admin.history_import",
    "admin.migration",
    "admin.error_tracking",
    "audit.break_glass",
    "audit.log",
    "audit.access",
    "devices.machines",
    "devices.pairing",
    "integration",
    "storage",
    "vpn",
];

/// Whether `code` is `prefix` or below it.
fn under(code: &str, prefix: &str) -> bool {
    code == prefix
        || code
            .strip_prefix(prefix)
            .is_some_and(|rest| rest.starts_with('.'))
}

/// Whether a code only reads.
fn is_read(code: &str) -> bool {
    code.rsplit('.')
        .next()
        .is_some_and(|action| READ_ACTIONS.contains(&action))
}

/// Whether one scope entry carries `code`.
fn carries(code: &str, entry: &str) -> bool {
    if NEVER_UNDER_A_GRANT.iter().any(|p| under(code, p)) {
        return false;
    }
    if entry == CONFIG_SCOPE {
        return module_of(code) == "admin" && (is_read(code) || CONFIG_EDITS.contains(&code));
    }
    module_of(code) == entry && is_read(code)
}

/// The permission codes a grant of `scope` carries — the whole of what a
/// vendor account may do under it.
#[must_use]
pub fn permissions_for_scope(scope: &[String]) -> Vec<String> {
    all_codes()
        .iter()
        .filter(|code| scope.iter().any(|e| carries(code, e)))
        .map(|code| (*code).to_owned())
        .collect()
}

/// Whether each scope entry opens something.
///
/// An entry that carries no code is refused rather than ignored, so a typo
/// never reads as a grant that works.
#[must_use]
pub fn is_valid_scope(scope: &[String]) -> bool {
    !scope.is_empty()
        && scope
            .iter()
            .all(|e| !permissions_for_scope(std::slice::from_ref(e)).is_empty())
}

/// Whether `code` is one of the configuration edits a grant may carry. For
/// tests that check every carried code is a read or one of these.
#[must_use]
pub fn is_config_edit(code: &str) -> bool {
    CONFIG_EDITS.contains(&code)
}
