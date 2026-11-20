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
use crate::middleware::auth::Claims;
use crate::middleware::authorization::is_bypass_role;

/// Categories managed only through their own endpoint.
///
/// - `abdm`: ABDM gateway settings (sealed client secret).
/// - `ai`: the AI provider and the name of its key secret.
/// - `email`: the SMTP host and the name of its password secret.
/// - `dictation`: where doctors' recordings are sent.
/// - `hrms`: the HRMS gateway's base URL and API key.
/// - `radiology`: the PACS / `DICOMweb` target and its sealed credentials.
/// - `device_integrations`: device keys kept by the secure-device endpoint.
/// - `payments`: online provider keys (`/api/payments/online-settings`) and
///   the billing screen's UPI ID and link terms (`/api/billing/payment-settings`).
/// - `preauth_alerts`: the share of a pre-auth's approval that warns the
///   insurance desk (`/api/billing/preauth-alert-settings`, 1 to 100 only).
pub const OWN_ENDPOINT_CATEGORIES: &[&str] = &[
    "abdm",
    "ai",
    "email",
    "dictation",
    "hrms",
    "radiology",
    "device_integrations",
    "payments",
    "preauth_alerts",
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

/// Categories a generic writer accepts only from a bypass administrator.
///
/// - `auth`: the sign-in policy — whether passwords are switched off and
///   which account is the break-glass login. Whoever writes it decides who
///   can sign in at all, so it is a trust decision, not a preference.
pub const ADMIN_ONLY_CATEGORIES: &[&str] = &["auth"];

/// Refuse a non-bypass caller writing an [`ADMIN_ONLY_CATEGORIES`] category.
///
/// `admin.settings.general.manage` is handed to people who set units and
/// locale; it must not also let them switch off password sign-in or name
/// their own account as the break-glass login.
///
/// # Errors
/// [`AppError::ForbiddenReason`] when the caller is not a bypass role.
pub fn refuse_admin_only_category(claims: &Claims, category: &str) -> Result<(), AppError> {
    if is_bypass_role(claims) || !ADMIN_ONLY_CATEGORIES.contains(&category.trim()) {
        return Ok(());
    }
    Err(AppError::ForbiddenReason(format!(
        "Only a hospital administrator can change the '{}' settings.",
        category.trim()
    )))
}

/// Refuse a generic write of a locale-profile key with a 400 naming the screen.
///
/// Those values change only through a change set a second person approves;
/// the database refuses the rest too, this says so before it tries.
///
/// # Errors
/// [`AppError::BadRequest`] for `locale/<profile key>`.
pub fn refuse_locale_profile_key(category: &str, key: &str) -> Result<(), AppError> {
    // The profile's own field list (the database guard's
    // `locale_profile_keys()` is checked against it in the change-set tests);
    // `locale/date_format` is not a profile field.
    if category.trim() == medbrains_country::profile::CATEGORY
        && medbrains_country::Field::from_key(key.trim()).is_some()
    {
        return Err(AppError::BadRequest(format!(
            "'locale/{}' is part of the locale profile; change it in Settings, Locale profile",
            key.trim()
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn locale_profile_keys_are_refused_but_date_format_is_not() {
        assert!(refuse_locale_profile_key("locale", "currency").is_err());
        assert!(refuse_locale_profile_key(" locale ", "timezone ").is_err());
        assert!(refuse_locale_profile_key("locale", "date_format").is_ok());
        assert!(refuse_locale_profile_key("units", "currency").is_ok());
    }

    #[test]
    fn secret_bearing_categories_are_refused_and_ordinary_ones_pass() {
        for category in [
            "ai",
            "email",
            "abdm",
            "dictation",
            "radiology",
            "payments",
            "preauth_alerts",
        ] {
            assert!(
                refuse_own_endpoint_category(category).is_err(),
                "{category}"
            );
        }
        for category in [" dictation", "abdm ", "\tai\n"] {
            assert!(
                refuse_own_endpoint_category(category).is_err(),
                "{category:?}"
            );
        }
        for category in ["units", "locale", "billing", "regression_test"] {
            assert!(refuse_own_endpoint_category(category).is_ok(), "{category}");
        }
    }
}
