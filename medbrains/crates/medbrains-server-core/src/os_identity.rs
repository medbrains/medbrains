//! The OS's own identity provider (Kanidm), pinned on the server side.
//!
//! Its row in `identity_providers` is written by `kanidm-setup` and read for its id only: where the server reaches Kanidm, which issuer it trusts
//! and which client it is come from here, never from the row, so an edit to the row through the admin API cannot
//! point sign-in or the people directory somewhere else.

use std::net::{Ipv4Addr, SocketAddr};
use std::time::Duration;

use crate::{error::AppError, middleware::authorization::BYPASS_ROLES};

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
        .redirect(reqwest::redirect::Policy::none())
        .timeout(timeout)
        .build()
}

/// The Kanidm group whose members may hold an administrator's account: `EXTRA_STEP_GROUP` in `kanidm-setup`,
/// the one group that must use a second step.
pub const HIGH_PRIVILEGE_GROUP: &str = "mb_it_admins";
/// A read-only Kanidm token, made by kanidm-setup for a service account that may read names, UUIDs and mail.
const DIRECTORY_TOKEN_ENV: &str = "MEDBRAINS_IDP_DIRECTORY_TOKEN_FILE";
const DIRECTORY_TOKEN_FILE: &str = "/var/lib/medbrains/config/idp-directory-token";
/// How long the directory may take before the screen says it is not answering.
const DIRECTORY_TIMEOUT: Duration = Duration::from_secs(10);

/// A directory URL: always Kanidm's loopback origin, whatever the provider row says.
fn directory_url(path: &str) -> String {
    format!("{LOOPBACK_ORIGIN}{path}")
}

/// Reads one Kanidm directory path with the read-only directory token. Kanidm not answering is
/// `ServiceUnavailable`, never an empty answer.
///
/// # Errors
/// `Internal` when the token cannot be read, `ServiceUnavailable` when Kanidm does not answer.
pub async fn read_directory(path: &str) -> Result<serde_json::Value, AppError> {
    let token_file =
        std::env::var(DIRECTORY_TOKEN_ENV).unwrap_or_else(|_| DIRECTORY_TOKEN_FILE.to_owned());
    let token = tokio::fs::read_to_string(&token_file)
        .await
        .map_err(|_| AppError::Internal("the Kanidm directory token is not readable".to_owned()))?;
    let unavailable = |e: reqwest::Error| {
        AppError::ServiceUnavailable(format!("Kanidm's directory did not answer: {e}"))
    };
    kanidm_client(DIRECTORY_TIMEOUT)
        .map_err(|e| AppError::Internal(format!("http client: {e}")))?
        .get(directory_url(path))
        .bearer_auth(token.trim())
        .send()
        .await
        .and_then(reqwest::Response::error_for_status)
        .map_err(unavailable)?
        .json::<serde_json::Value>()
        .await
        .map_err(unavailable)
}

/// True when a list of Kanidm group names (a `memberof` answer, or a token's groups) holds `group`, by name
/// or by its `name@domain` form.
pub fn holds_group<'a>(groups: impl IntoIterator<Item = &'a str>, group: &str) -> bool {
    let spn = format!("{group}@");
    groups
        .into_iter()
        .any(|value| value == group || value.starts_with(&spn))
}

/// Whether this Kanidm person is in [`HIGH_PRIVILEGE_GROUP`]: the token's groups first, then the directory,
/// as Kanidm itself says. A directory that cannot be read is an error, never a no.
///
/// # Errors
/// As [`read_directory`].
pub async fn is_high_privilege_person(
    subject: &str,
    token_groups: &[String],
) -> Result<bool, AppError> {
    if holds_group(
        token_groups.iter().map(String::as_str),
        HIGH_PRIVILEGE_GROUP,
    ) {
        return Ok(true);
    }
    let memberof = read_directory(&format!("/v1/person/{subject}/_attr/memberof")).await?;
    let names = memberof.as_array().into_iter().flatten();
    Ok(holds_group(
        names.filter_map(serde_json::Value::as_str),
        HIGH_PRIVILEGE_GROUP,
    ))
}

/// True for an `admin.*` code that changes something.
///
/// Read-only ones (`.read`, `.list`, `.view`) are not powers: every clinical role holds `admin.settings.read`, so counting them would put every member of staff
/// behind the high-privilege group.
#[must_use]
pub fn is_admin_power(code: &str) -> bool {
    code.starts_with("admin.")
        && ![".read", ".list", ".view"]
            .iter()
            .any(|read| code.ends_with(read))
}

/// True for an administrator's account (a bypass role, or any `admin.*` power): one whose Kanidm person must
/// be in [`HIGH_PRIVILEGE_GROUP`], to be linked and to sign in.
#[must_use]
pub fn needs_high_privilege(role: &str, permissions: &[String]) -> bool {
    BYPASS_ROLES.contains(&role) || permissions.iter().any(|code| is_admin_power(code))
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
    use super::{
        CLIENT_ID, HIGH_PRIVILEGE_GROUP, directory_url, discovery_url, holds_group, issuer,
        needs_high_privilege, to_loopback,
    };

    /// The directory is always Kanidm on loopback: nothing in the provider row or the request picks the host.
    #[test]
    fn the_directory_is_always_kanidm_on_loopback() {
        assert_eq!(
            directory_url("/v1/person"),
            "https://idm.medbrains.local:8444/v1/person"
        );
    }

    /// Only membership of the high-privilege group, by name or SPN, counts.
    #[test]
    fn only_the_high_privilege_group_counts() {
        let held = |groups: &[&str]| holds_group(groups.iter().copied(), HIGH_PRIVILEGE_GROUP);
        assert!(held(&[
            "idm_all_persons@idm.medbrains.local",
            "mb_it_admins@idm.medbrains.local"
        ]));
        assert!(held(&["mb_it_admins"]));
        assert!(!held(&["mb_it_admins_old@idm.medbrains.local"]));
        assert!(!held(&["idm_service_desk@idm.medbrains.local"]));
        assert!(!held(&[]));
    }

    /// A bypass role or a write `admin.*` code needs the group; read-only admin codes every role holds do not.
    #[test]
    fn administrators_need_the_high_privilege_group() {
        let codes = |list: &[&str]| list.iter().map(|&c| c.to_owned()).collect::<Vec<_>>();
        assert!(needs_high_privilege("super_admin", &[]));
        assert!(needs_high_privilege("hospital_admin", &[]));
        assert!(needs_high_privilege(
            "nurse",
            &codes(&["admin.users.create"])
        ));
        assert!(!needs_high_privilege(
            "nurse",
            &codes(&["admin.settings.read", "admin.users.list", "opd.visit.view"])
        ));
    }

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
