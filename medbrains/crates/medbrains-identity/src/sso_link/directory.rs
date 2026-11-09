//! Reading the OS's Kanidm directory with the server's read-only token: always on Kanidm's loopback listener,
//! never at an address taken from the provider row or the request.

use medbrains_server_core::{error::AppError, os_identity};

/// The Kanidm group whose members may hold an administrator's account: `EXTRA_STEP_GROUP` in `kanidm-setup`,
/// the one group that must use a second step.
const HIGH_PRIVILEGE_GROUP: &str = "mb_it_admins";
/// A read-only Kanidm token, made by kanidm-setup for a service account that may read names, UUIDs and mail.
const DIRECTORY_TOKEN_ENV: &str = "MEDBRAINS_IDP_DIRECTORY_TOKEN_FILE";
const DIRECTORY_TOKEN_FILE: &str = "/var/lib/medbrains/config/idp-directory-token";
/// How long the directory may take before the screen says it is not answering.
const DIRECTORY_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(10);

/// A directory URL: always Kanidm's loopback origin, whatever the provider row says.
fn directory_url(path: &str) -> String {
    format!("{}{path}", os_identity::LOOPBACK_ORIGIN)
}

/// Reads one directory path with the read-only directory token. Kanidm not answering is
/// `ServiceUnavailable`, never an empty answer.
pub(super) async fn read_directory(path: &str) -> Result<serde_json::Value, AppError> {
    let token_file =
        std::env::var(DIRECTORY_TOKEN_ENV).unwrap_or_else(|_| DIRECTORY_TOKEN_FILE.to_owned());
    let token = std::fs::read_to_string(&token_file)
        .map_err(|_| AppError::Internal("the Kanidm directory token is not readable".to_owned()))?;
    let unavailable = |e: reqwest::Error| {
        AppError::ServiceUnavailable(format!("Kanidm's directory did not answer: {e}"))
    };
    os_identity::kanidm_client(DIRECTORY_TIMEOUT)
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

/// True when Kanidm's `memberof` answer holds `group`, by name or by its `name@domain` form.
fn holds_group(memberof: &serde_json::Value, group: &str) -> bool {
    let spn = format!("{group}@");
    memberof
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(serde_json::Value::as_str)
        .any(|value| value == group || value.starts_with(&spn))
}

/// Refuses linking an administrator's account to a Kanidm person outside [`HIGH_PRIVILEGE_GROUP`], as Kanidm
/// itself says. An answer that cannot be read refuses too.
pub(super) async fn require_high_privilege_person(subject: &str) -> Result<(), AppError> {
    let memberof = read_directory(&format!("/v1/person/{subject}/_attr/memberof")).await?;
    if holds_group(&memberof, HIGH_PRIVILEGE_GROUP) {
        return Ok(());
    }
    Err(AppError::ForbiddenReason(format!(
        "An administrator's account links only to a Kanidm person in {HIGH_PRIVILEGE_GROUP}, \
         which needs a second step. Add the person to that group in Kanidm first."
    )))
}

#[cfg(test)]
mod tests {
    use super::{HIGH_PRIVILEGE_GROUP, directory_url, holds_group};

    /// The directory is always Kanidm on loopback: nothing in the provider row or the request picks the host.
    #[test]
    fn the_directory_is_always_kanidm_on_loopback() {
        assert_eq!(
            directory_url("/v1/person"),
            "https://idm.medbrains.local:8444/v1/person"
        );
    }

    /// Only membership of the high-privilege group, by name or SPN, lets an administrator's account be linked.
    #[test]
    fn only_the_high_privilege_group_counts() {
        let member = serde_json::json!([
            "idm_all_persons@idm.medbrains.local",
            "mb_it_admins@idm.medbrains.local"
        ]);
        assert!(holds_group(&member, HIGH_PRIVILEGE_GROUP));
        assert!(holds_group(
            &serde_json::json!(["mb_it_admins"]),
            HIGH_PRIVILEGE_GROUP
        ));
        assert!(!holds_group(
            &serde_json::json!(["mb_it_admins_old@idm.medbrains.local"]),
            HIGH_PRIVILEGE_GROUP
        ));
        assert!(!holds_group(
            &serde_json::json!(["idm_service_desk@idm.medbrains.local"]),
            HIGH_PRIVILEGE_GROUP
        ));
        assert!(!holds_group(&serde_json::Value::Null, HIGH_PRIVILEGE_GROUP));
    }
}
