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
    let mut domains: Vec<String> = configured
        .split(',')
        .map(|d| {
            d.trim()
                .trim_start_matches('@')
                .trim_end_matches('.')
                .to_lowercase()
        })
        .filter(|d| !d.is_empty())
        .collect();
    if hosted && !domains.iter().any(|d| d == SEED_ADMIN_DOMAIN) {
        domains.push(SEED_ADMIN_DOMAIN.to_owned());
    }
    domains
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
    use super::domains_from;

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
