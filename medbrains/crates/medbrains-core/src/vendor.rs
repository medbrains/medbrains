//! Which email domains belong to the vendor's own staff.
//!
//! An account whose address is on one of these domains (or a subdomain) is a
//! vendor account: the auth gate refuses it without the hospital's grant, and
//! nothing it set up — a webhook, a pipeline, a connector — may send or run
//! (`docs/compliance/vendor-access.md`). The list lives here, at the bottom of
//! the crate graph, because the outbox worker and the kernel's event gate
//! check it too, and they sit below the web layer.
//!
//! The SQL half of the rule is `public.app_email_is_vendor(email, domains)`.

use std::sync::{LazyLock, RwLock};

/// The address domain the seeded first administrator is created with.
pub const SEED_ADMIN_DOMAIN: &str = "medbrains.localhost";

/// Suffixes no vendor owns.
///
/// A list entry equal to one of these would make
/// every account under it a vendor account — on the next boot, permanently,
/// with everything those accounts set up revoked — so it is refused.
pub const PUBLIC_SUFFIXES: &[&str] = &[
    "in", "com", "org", "net", "co.in", "org.in", "gov.in", "nic.in", "ac.in", "edu", "io",
];

/// How many accounts the start-up back-fill may flag in one run unless
/// `MEDBRAINS_VENDOR_BACKFILL_MAX` says otherwise. More means the domain list
/// is wrong, and the boot stops instead.
pub const DEFAULT_BACKFILL_MAX: i32 = 20;

/// The live list, read from the environment once and replaceable at runtime.
static DOMAINS: LazyLock<RwLock<Vec<String>>> = LazyLock::new(|| {
    let hosted = std::env::var("MEDBRAINS_HOSTED").is_ok_and(|v| v == "true");
    let configured = std::env::var("MEDBRAINS_VENDOR_EMAIL_DOMAINS")
        .unwrap_or_else(|_| "medbrains.in".to_owned());
    RwLock::new(domains_from(&configured, hosted))
});

/// Parse a comma-separated domain list, adding the seeded admin's domain when
/// the installation is one the vendor hosts for a hospital.
///
/// `MEDBRAINS_VENDOR_EMAIL_DOMAINS` defaults to `medbrains.in`; an empty
/// string turns the rule off on a tenant the vendor runs for itself. With
/// `MEDBRAINS_HOSTED=true` the seeded `admin@medbrains.localhost` is gated too;
/// on a hospital's own server that login is the hospital's and is left alone.
#[must_use]
pub fn domains_from(configured: &str, hosted: bool) -> Vec<String> {
    let mut domains = parse_domains(configured).0;
    if hosted && !domains.iter().any(|d| d == SEED_ADMIN_DOMAIN) {
        domains.push(SEED_ADMIN_DOMAIN.to_owned());
    }
    domains
}

/// Split a configured list into the domains accepted and the entries
/// refused: a single label (`in`, `localhost`), a public suffix
/// (`co.in`), or anything that is not a host name.
#[must_use]
pub fn parse_domains(configured: &str) -> (Vec<String>, Vec<String>) {
    let mut accepted = Vec::new();
    let mut refused = Vec::new();
    for entry in configured.split(',') {
        let domain = entry
            .trim()
            .trim_start_matches('@')
            .trim_end_matches('.')
            .to_lowercase();
        if domain.is_empty() {
            continue;
        }
        if is_ownable_domain(&domain) {
            accepted.push(domain);
        } else {
            refused.push(domain);
        }
    }
    (accepted, refused)
}

/// A domain someone can own: at least two labels, host-name characters
/// only, and not a public suffix.
fn is_ownable_domain(domain: &str) -> bool {
    domain.contains('.')
        && !PUBLIC_SUFFIXES.contains(&domain)
        && domain.split('.').all(|label| {
            !label.is_empty()
                && !label.starts_with('-')
                && label.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
        })
}

/// The entries of `MEDBRAINS_VENDOR_EMAIL_DOMAINS` that were refused, so the
/// server can stop at boot and say which, instead of running on a list that
/// silently lost an entry.
#[must_use]
pub fn configured_refusals() -> Vec<String> {
    std::env::var("MEDBRAINS_VENDOR_EMAIL_DOMAINS")
        .map(|v| parse_domains(&v).1)
        .unwrap_or_default()
}

/// The back-fill ceiling: `MEDBRAINS_VENDOR_BACKFILL_MAX`, else 20.
#[must_use]
pub fn backfill_max() -> i32 {
    std::env::var("MEDBRAINS_VENDOR_BACKFILL_MAX")
        .ok()
        .and_then(|v| v.trim().parse().ok())
        .unwrap_or(DEFAULT_BACKFILL_MAX)
}

/// The vendor email domains in force, for binding into `app_email_is_vendor`.
#[must_use]
pub fn vendor_domains() -> Vec<String> {
    DOMAINS
        .read()
        .map_or_else(|p| p.into_inner().clone(), |d| d.clone())
}

/// Replace the domain list in force (a configuration reload, and the tests
/// that need a non-default domain without restarting the process).
pub fn set_vendor_domains(domains: Vec<String>) {
    match DOMAINS.write() {
        Ok(mut current) => *current = domains,
        Err(poisoned) => *poisoned.into_inner() = domains,
    }
}

#[cfg(test)]
mod tests {
    use super::{domains_from, parse_domains};

    /// A single label or a public suffix would flag every account under it,
    /// so neither is accepted; a real domain is.
    #[test]
    fn single_labels_and_public_suffixes_are_refused() {
        let (accepted, refused) =
            parse_domains("in, co.in, gov.in, com, localhost, medbrains.in, x..y");
        assert_eq!(accepted, vec!["medbrains.in"]);
        assert_eq!(
            refused,
            vec!["in", "co.in", "gov.in", "com", "localhost", "x..y"]
        );
        assert!(domains_from("in,io", true) == vec!["medbrains.localhost"]);
    }

    /// Trimmed, lower-cased, without `@` or a trailing dot; empty entries
    /// dropped; the seeded admin's domain added only when hosted.
    #[test]
    fn the_domain_list_is_normalised_and_hosted_adds_the_seed_admin() {
        assert_eq!(
            domains_from(" @MedBrains.in. , ", false),
            vec!["medbrains.in"]
        );
        assert!(domains_from("", false).is_empty());
        assert_eq!(
            domains_from("medbrains.in", true),
            vec!["medbrains.in", "medbrains.localhost"]
        );
    }
}
