//! Where update state, settings and keys live.

/// What only the updater reads and writes, on the data disk.
pub const STATE_DIR: &str = "/var/lib/medbrains/update";
/// The record of updates.
pub const STATE_FILE: &str = "/var/lib/medbrains/update/state.json";
/// A bundle being fetched and checked.
pub const STAGING_DIR: &str = "/var/lib/medbrains/update/staging";
/// The inactive slot, mounted to give it this machine's identity. In memory, gone at restart.
pub const SLOT_MOUNT: &str = "/run/medbrains-update/slot";
/// A USB stick, mounted to read a bundle from it.
pub const USB_MOUNT: &str = "/run/medbrains-update/usb";
/// Public keys in the image, one `<id>.pub` per key.
pub const KEYS_DIR: &str = "/usr/share/medbrains/update-keys";
/// The address updates come from; no file means this machine never looks.
pub const URL_FILE: &str = "/var/lib/medbrains-settings/update-url";
/// A private certificate authority for a hospital's own mirror.
pub const CA_FILE: &str = "/var/lib/medbrains-settings/update-ca.pem";
/// The quiet window, as `02:00-04:00` in local time; no file means only a person applies.
pub const WINDOW_FILE: &str = "/var/lib/medbrains-settings/update-window";
/// How long a new version gets to pass its checks, in seconds, for slower hardware.
pub const HEALTH_SECONDS_FILE: &str = "/var/lib/medbrains-settings/update-health-seconds";
/// How long nobody must have used the app before a quiet window may restart the machine, in minutes.
pub const IDLE_MINUTES_FILE: &str = "/var/lib/medbrains-settings/update-idle-minutes";
/// When a person last used the app, in seconds since 1970, written by the server on this machine. Every
/// person's request reaches it, from this screen or from a node through the tunnel.
pub const ACTIVITY_FILE: &str = "/run/medbrains-server/last-person-request";
/// Left on the boot partition by a seal check at start, before the data disk is open, for the next step
/// that can write the record. Small, and flushed.
pub const SEAL_MARKER: &str = "/boot/medbrains-seal-failed.json";
