//! Setting categories that only their own endpoint may write.
//!
//! Every generic writer of `tenant_settings` (the settings screen's
//! `PUT /api/setup/settings`, the config-bundle import) calls
//! [`refuse_own_endpoint_category`] before it writes, so a category with its
//! own endpoint cannot be set past that endpoint's checks by anyone who holds
//! the general settings permission.

use crate::error::AppError;

/// Categories with their own screen and endpoint: `abdm` holds secrets the
/// generic API would hand back verbatim; `dictation` says where doctors'
/// recordings are sent, and its endpoint validates, guards and audits that.
pub const OWN_ENDPOINT_CATEGORIES: &[&str] = &["abdm", "dictation"];

/// Refuse a generic write (or read) of a category that has its own endpoint.
///
/// # Errors
/// `BadRequest` naming the category.
pub fn refuse_own_endpoint_category(category: &str) -> Result<(), AppError> {
    if OWN_ENDPOINT_CATEGORIES.contains(&category.trim()) {
        return Err(AppError::BadRequest(format!(
            "'{}' settings are managed on their own screen, not here",
            category.trim()
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::refuse_own_endpoint_category;

    #[test]
    fn own_endpoint_categories_are_refused_however_they_are_spaced() {
        assert!(refuse_own_endpoint_category("dictation").is_err());
        assert!(refuse_own_endpoint_category(" abdm ").is_err());
        assert!(refuse_own_endpoint_category("general").is_ok());
    }
}
