//! OS-native secure credential storage exposed to the SPA.
//!
//! Backs onto the platform keyring — macOS Keychain, Windows Credential Manager,
//! Linux Secret Service (libsecret / D-Bus) — via the `keyring` crate, so the
//! desktop client holds its session / SSO token in the OS vault instead of
//! webview `localStorage` (which XSS can read). Keys are namespaced under the
//! app's service id; values are opaque strings (e.g. the access token).

const SERVICE: &str = "com.medbrains.hms";

/// Store `value` under `key` in the OS keyring (overwrites any existing entry).
#[tauri::command]
pub(crate) fn keyring_set(key: String, value: String) -> Result<(), String> {
    keyring::Entry::new(SERVICE, &key)
        .map_err(|e| e.to_string())?
        .set_password(&value)
        .map_err(|e| e.to_string())
}

/// Read `key` from the OS keyring, or `None` if there is no entry.
#[tauri::command]
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
pub(crate) fn keyring_delete(key: String) -> Result<(), String> {
    let entry = keyring::Entry::new(SERVICE, &key).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}
