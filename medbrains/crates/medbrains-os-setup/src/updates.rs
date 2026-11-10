//! The screen's door to OS updates. The work runs in its own unit, because it takes minutes and this
//! service answers one request at a time, and because this service's sandbox can't touch a disk.
//!
//! Plan O13: `go-back` and `apply` on a main machine are severe actions. When the screen has sign-in,
//! the check belongs in `run_action`, the only way in, and in `save_settings`.

use std::fs;
use std::path::Path;

use medbrains_os_update::boot::window_is_valid;
use medbrains_os_update::child::{self, USUAL_LIMIT};
use medbrains_os_update::paths;
use medbrains_os_update::source::Source;
use medbrains_os_update::state::write_atomically;

/// The unit for an action. A word that isn't listed never reaches systemctl.
fn action_unit(action: &str) -> Option<&'static str> {
    match action {
        "install" => Some("medbrains-os-update@install.service"),
        "install-retry" => Some("medbrains-os-update@install-retry.service"),
        "usb" => Some("medbrains-os-update@usb.service"),
        "usb-retry" => Some("medbrains-os-update@usb-retry.service"),
        "apply" => Some("medbrains-os-update@apply.service"),
        "go-back" => Some("medbrains-os-update@go-back.service"),
        _ => None,
    }
}

/// Starts an action and returns at once. The record says how it went.
pub(crate) fn run_action(action: &str) -> Result<(), String> {
    let unit = action_unit(action).ok_or_else(|| "Unknown action.".to_owned())?;
    let done = child::run("systemctl", &["start", "--no-block", unit], USUAL_LIMIT);
    if done.is_some_and(|done| done.success) {
        return Ok(());
    }
    Err("The machine did not start that. Try again in a moment.".to_owned())
}

/// Writes one setting in one step, or removes it if it is empty.
fn save_setting(path: &str, value: &str) -> Result<(), String> {
    let file = Path::new(path);
    if value.is_empty() {
        return match fs::remove_file(file) {
            Ok(()) => Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(e) => Err(e.to_string()),
        };
    }
    write_atomically(file, format!("{value}\n").as_bytes()).map_err(|e| e.to_string())
}

/// Saves where updates come from and the quiet window. Empty means don't look, and only a person applies.
pub(crate) fn save_settings(address: &str, window: &str) -> Result<(), String> {
    let (address, window) = (address.trim(), window.trim());
    if !address.is_empty() && !matches!(Source::parse(address, None), Ok(Source::Address(..))) {
        return Err("The update address must start with https://.".to_owned());
    }
    if !window.is_empty() && !window_is_valid(window) {
        return Err("Write the quiet window as 02:00-04:00.".to_owned());
    }
    save_setting(paths::URL_FILE, address)?;
    save_setting(paths::WINDOW_FILE, window)
}

#[cfg(test)]
mod tests {
    use super::{action_unit, save_settings};

    /// A wrong word must never reach systemctl as a command of its own.
    #[test]
    fn only_the_listed_actions_reach_systemctl() {
        assert!(action_unit("apply").is_some());
        assert!(action_unit("go-back").is_some());
        for bad in ["", "reboot", "apply; reboot", "../apply", "health"] {
            assert_eq!(action_unit(bad), None, "{bad}");
        }
    }

    /// Nothing is saved if either field is wrong, so a typo can't half-apply.
    #[test]
    fn a_wrong_address_or_window_is_refused_before_anything_is_saved() {
        assert!(save_settings("http://mirror", "").is_err());
        assert!(save_settings("/media/usb", "").is_err());
        assert!(save_settings("", "sometime").is_err());
    }
}
