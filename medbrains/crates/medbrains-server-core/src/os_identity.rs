//! The OS's own identity provider (Kanidm), pinned on the server side.
//!
//! Its row in `identity_providers` is written by `kanidm-setup` and read for its id only: where the server reaches Kanidm, which issuer it trusts
//! and which client it is come from here, never from the row, so an edit to the row through the admin API cannot
//! point sign-in or the people directory somewhere else.

use std::net::{Ipv4Addr, SocketAddr};
use std::time::Duration;

/// The provider code `kanidm-setup` registers the OS's Kanidm under.
pub const KANIDM_CODE: &str = "kanidm";
/// Kanidm's own name. Every server call to it resolves to loopback, whatever DNS says.
const KANIDM_HOST: &str = "idm.medbrains.local";
/// Where the server reaches Kanidm: its own loopback listener, as `kanidm-lib.sh` does (`ORIGIN`).
pub const LOOPBACK_ORIGIN: &str = "https://idm.medbrains.local:8444";
/// Where browsers reach Kanidm, through the front: the `origin` in Kanidm's `server.toml`.
const PUBLIC_ORIGIN: &str = "https://idm.medbrains.local:9443";
/// The `OAuth` client `kanidm-setup` makes for `MedBrains` (`CLIENT`).
pub const CLIENT_ID: &str = "medbrains";
/// The client's `OpenID` path under either origin.
const CLIENT_PATH: &str = "/oauth2/openid/medbrains";

/// Where the server reads Kanidm's `OpenID` discovery document: on loopback.
#[must_use]
pub fn discovery_url() -> String {
    format!("{LOOPBACK_ORIGIN}{CLIENT_PATH}/.well-known/openid-configuration")
}

/// The issuer Kanidm's tokens must name: its public origin, which is what Kanidm signs.
#[must_use]
pub fn issuer() -> String {
    format!("{PUBLIC_ORIGIN}{CLIENT_PATH}")
}

/// A server-side endpoint from Kanidm's discovery document, moved onto loopback. `None` for any URL that is
/// not under Kanidm's own origins, so a document that names another host is refused, not followed.
#[must_use]
pub fn to_loopback(url: &str) -> Option<String> {
    [PUBLIC_ORIGIN, LOOPBACK_ORIGIN].iter().find_map(|origin| {
        url.strip_prefix(origin)
            .filter(|rest| rest.starts_with('/'))
            .map(|rest| format!("{LOOPBACK_ORIGIN}{rest}"))
    })
}

/// An HTTP client for Kanidm that resolves its name to 127.0.0.1, so no resolver can send it elsewhere.
///
/// # Errors
/// When the TLS backend cannot start.
pub fn kanidm_client(timeout: Duration) -> Result<reqwest::Client, reqwest::Error> {
    reqwest::Client::builder()
        .resolve(KANIDM_HOST, SocketAddr::from((Ipv4Addr::LOCALHOST, 0)))
        .timeout(timeout)
        .build()
}

/// SQL true when the `users` row aliased `u` is the hospital's setup administrator.
///
/// That is its first account, made by the seed from the password setup hashed (`start_main_machine`), and still a super administrator. That
/// one account keeps a local password beside its Kanidm link, as the named break-glass (`os/README.md`).
// ponytail: "first account of the tenant" — a hard delete of that row would pass it to the next super_admin;
// rows are soft-deleted, so that path does not exist today. Record its id at seed time if it ever does.
pub const SETUP_ADMIN_SQL: &str = "(u.role = 'super_admin' AND u.id = (SELECT f.id FROM users f \
     WHERE f.tenant_id = u.tenant_id ORDER BY f.created_at, f.id LIMIT 1))";

#[cfg(test)]
mod tests {
    use super::{CLIENT_ID, discovery_url, issuer, to_loopback};

    /// Discovery is read on loopback; the issuer is the public origin Kanidm signs with.
    #[test]
    fn kanidm_is_reached_on_loopback_and_trusted_by_its_public_issuer() {
        assert_eq!(
            discovery_url(),
            "https://idm.medbrains.local:8444/oauth2/openid/medbrains/.well-known/openid-configuration"
        );
        assert_eq!(
            issuer(),
            "https://idm.medbrains.local:9443/oauth2/openid/medbrains"
        );
        assert_eq!(CLIENT_ID, "medbrains");
    }

    /// Kanidm's own endpoints move to loopback; anything else is refused.
    #[test]
    fn only_kanidms_own_endpoints_are_followed() {
        assert_eq!(
            to_loopback("https://idm.medbrains.local:9443/oauth2/token").as_deref(),
            Some("https://idm.medbrains.local:8444/oauth2/token")
        );
        assert_eq!(
            to_loopback("https://idm.medbrains.local:8444/v1/person").as_deref(),
            Some("https://idm.medbrains.local:8444/v1/person")
        );
        assert_eq!(to_loopback("https://evil.example/oauth2/token"), None);
        assert_eq!(
            to_loopback("https://idm.medbrains.local:9443.evil.example/x"),
            None
        );
        assert_eq!(
            to_loopback("http://idm.medbrains.local:9443/oauth2/token"),
            None
        );
    }
}
