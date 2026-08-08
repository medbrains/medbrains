//! OS-native secure credential storage exposed to the SPA.
//!
//! Backs onto the platform keyring — macOS Keychain, Windows Credential Manager,
//! Linux Secret Service (libsecret / D-Bus) — via the `keyring` crate, so the
//! desktop client holds its session / SSO token in the OS vault instead of
//! webview `localStorage` (which XSS can read). Keys are namespaced under the
//! app's service id; values are opaque strings (e.g. the access token).
//!
//! These take owned `String` rather than `&str`, which clippy objects to. They
//! are `#[tauri::command]` entry points: arguments are deserialized out of the
//! IPC message from the webview, and owned types are the shape that is
//! unambiguously supported there. Borrowing to save a few bytes per keyring
//! call is not worth a risk to the desktop client's IPC.

const SERVICE: &str = "com.medbrains.hms";

/// Store `value` under `key` in the OS keyring (overwrites any existing entry).
#[tauri::command]
#[allow(
    clippy::needless_pass_by_value,
    reason = "Tauri IPC deserializes command arguments; owned types are the supported shape"
)]
pub(crate) fn keyring_set(key: String, value: String) -> Result<(), String> {
    keyring::Entry::new(SERVICE, &key)
        .map_err(|e| e.to_string())?
        .set_password(&value)
        .map_err(|e| e.to_string())
}

/// Read `key` from the OS keyring, or `None` if there is no entry.
#[tauri::command]
#[allow(
    clippy::needless_pass_by_value,
    reason = "Tauri IPC deserializes command arguments; owned types are the supported shape"
)]
pub(crate) fn keyring_get(key: String) -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(SERVICE, &key).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Delete `key` from the OS keyring (no error if it does not exist).
#[tauri::command]
#[allow(
    clippy::needless_pass_by_value,
    reason = "Tauri IPC deserializes command arguments; owned types are the supported shape"
)]
pub(crate) fn keyring_delete(key: String) -> Result<(), String> {
    let entry = keyring::Entry::new(SERVICE, &key).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}
