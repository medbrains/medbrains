//! What a password set during onboarding is checked against, beside the password itself.

use medbrains_server_core::validation::PasswordCheck;

use crate::{InitRequest, SetupUser};

impl<'a> From<&'a InitRequest> for PasswordCheck<'a> {
    /// The first administrator's password, with the username and the hospital's name and
    /// code, none of which it may hold.
    fn from(body: &'a InitRequest) -> Self {
        Self {
            password: &body.admin_password,
            username: &body.admin_username,
            hospital_name: &body.hospital_name,
            hospital_code: &body.hospital_code,
        }
    }
}

impl<'a> From<&'a SetupUser> for PasswordCheck<'a> {
    /// A staff member's password from the onboarding user list, with their username.
    fn from(user: &'a SetupUser) -> Self {
        (&user.password, &user.username).into()
    }
}
