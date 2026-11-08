//! The one guard every generic `tenant_settings` writer calls.
//!
//! Some categories have their own screen and endpoint, because they hold
//! secrets (or secret names) the generic settings API would hand back
//! verbatim, or because their own endpoint validates what is written — a
//! secret name in the hospital's namespace, an `https` mail host, a `DICOMweb`
//! URL. A generic writer (`PUT /api/setup/settings`, the config-bundle
//! import) that accepted those categories would walk round that validation,
//! so each of them asks here first. The config export leaves them out, so an
//! exported bundle always imports again.

use crate::error::AppError;

/// Categories managed only through their own endpoint.
///
/// - `abdm`: ABDM gateway settings (sealed client secret).
/// - `ai`: the AI provider and the name of its key secret.
/// - `email`: the SMTP host and the name of its password secret.
/// - `dictation`: where doctors' recordings are sent.
/// - `hrms`: the HRMS gateway's base URL and API key.
/// - `radiology`: the PACS / `DICOMweb` target and its sealed credentials.
/// - `device_integrations`: device keys kept by the secure-device endpoint.
pub const OWN_ENDPOINT_CATEGORIES: &[&str] = &[
    "abdm",
    "ai",
    "email",
    "dictation",
    "hrms",
    "radiology",
    "device_integrations",
];

/// Whether `category` may only be written through its own endpoint.
/// Surrounding whitespace does not hide one (` ai `).
#[must_use]
pub fn is_own_endpoint_category(category: &str) -> bool {
    OWN_ENDPOINT_CATEGORIES.contains(&category.trim())
}

/// Refuse a generic read or write of an own-endpoint category with a 400.
///
/// # Errors
/// [`AppError::BadRequest`] naming the category when it has its own screen.
pub fn refuse_own_endpoint_category(category: &str) -> Result<(), AppError> {
    if is_own_endpoint_category(category) {
        return Err(AppError::BadRequest(format!(
            "'{}' settings are managed on their own screen, not here",
            category.trim()
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn secret_bearing_categories_are_refused_and_ordinary_ones_pass() {
        for category in ["ai", "email", "abdm", "dictation", "radiology"] {
            assert!(
                refuse_own_endpoint_category(category).is_err(),
                "{category}"
            );
        }
        for category in [" dictation", "abdm ", "\tai\n"] {
            assert!(refuse_own_endpoint_category(category).is_err(), "{category:?}");
        }
        for category in ["units", "locale", "payments", "regression_test"] {
            assert!(refuse_own_endpoint_category(category).is_ok(), "{category}");
        }
    }
}
