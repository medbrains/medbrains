//! Reading the OS's Kanidm directory to link an account. The reader itself lives in `os_identity`, shared with
//! sign-in: always on Kanidm's loopback listener, never at an address taken from the provider row or the
//! request.

use medbrains_server_core::{
    error::AppError,
    os_identity::{HIGH_PRIVILEGE_GROUP, is_high_privilege_person},
};

pub(super) use medbrains_server_core::os_identity::read_directory;

/// Refuses linking an administrator's account to a Kanidm person outside [`HIGH_PRIVILEGE_GROUP`], as Kanidm
/// itself says. An answer that cannot be read refuses too.
pub(super) async fn require_high_privilege_person(subject: &str) -> Result<(), AppError> {
    if is_high_privilege_person(subject, &[]).await? {
        return Ok(());
    }
    Err(AppError::ForbiddenReason(format!(
        "An administrator's account links only to a Kanidm person in {HIGH_PRIVILEGE_GROUP}, \
         which needs a second step. Add the person to that group in Kanidm first."
    )))
}
