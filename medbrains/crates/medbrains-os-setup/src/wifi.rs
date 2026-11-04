//! Wi-Fi through iwd: read its state, scan, join and forget, over its D-Bus interface with `busctl`,
//! so no password ever appears on a command line. A saved password is a root-only file in iwd's
//! own directory on the data partition. Nothing here logs a password.

use std::fs;
use std::io::Write;
use std::os::unix::fs::OpenOptionsExt;
use std::process::Command;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde_json::{Value, json};

use crate::wifi_parse::{Snapshot, network_list, parse_objects, parse_ordered};

const IWD: &str = "net.connman.iwd";
const IWD_DIR: &str = "/var/lib/iwd";
/// How long a read or a command may take.
const BUS_SECONDS: &str = "--timeout=5";
/// How long joining may take: association, then the key exchange.
const CONNECT_SECONDS: &str = "--timeout=40";
/// iwd notices a new password file by watching its directory, so give it a moment.
const KNOWN_WAIT: Duration = Duration::from_millis(500);
const KNOWN_TRIES: u32 = 10;
/// WPA's own limits on a passphrase.
const PASSWORD_BYTES: std::ops::RangeInclusive<usize> = 8..=63;

/// The latest join and how it went: the state and any words for the screen.
#[derive(Debug, Default)]
pub(crate) struct Attempt {
    ssid: String,
    state: &'static str,
    words: String,
}

/// Runs `busctl` and returns its JSON, or the words it failed with.
fn busctl(timeout: &str, args: &[&str]) -> Result<Value, String> {
    let done = Command::new("busctl")
        .args(["--json=short", "--no-pager", timeout])
        .args(args)
        .output()
        .map_err(|e| e.to_string())?;
    if !done.status.success() {
        return Err(String::from_utf8_lossy(&done.stderr).trim().to_owned());
    }
    Ok(serde_json::from_slice(&done.stdout).unwrap_or(Value::Null))
}

/// Reads iwd's whole object tree.
fn snapshot() -> Result<Snapshot, String> {
    let reply = busctl(
        BUS_SECONDS,
        &[
            "call",
            IWD,
            "/",
            "org.freedesktop.DBus.ObjectManager",
            "GetManagedObjects",
        ],
    )?;
    Ok(parse_objects(&reply))
}

/// True if the kernel has a Wi-Fi interface, whatever iwd says.
fn has_card() -> bool {
    fs::read_dir("/sys/class/net").is_ok_and(|dir| {
        dir.flatten()
            .any(|entry| entry.path().join("wireless").exists())
    })
}

/// Everything the Wi-Fi panel shows. Three different truths: no card, a card with software that
/// doesn't answer, and a working card with its list, so a fault can't read as an empty list.
pub(crate) fn status(attempt: &Arc<Mutex<Attempt>>) -> Value {
    let attempt = attempt.lock().map_or_else(
        |_| json!({}),
        |a| json!({ "ssid": a.ssid, "state": a.state, "words": a.words }),
    );
    if !has_card() {
        return json!({ "hardware": false, "attempt": attempt });
    }
    let snapshot = match snapshot() {
        Ok(snapshot) if snapshot.device.is_some() => snapshot,
        Ok(_) | Err(_) => return json!({ "hardware": true, "fault": true, "attempt": attempt }),
    };
    let ordered = snapshot.device.as_deref().map_or_else(Vec::new, |device| {
        busctl(
            BUS_SECONDS,
            &[
                "call",
                IWD,
                device,
                "net.connman.iwd.Station",
                "GetOrderedNetworks",
            ],
        )
        .map_or_else(|_| Vec::new(), |reply| parse_ordered(&reply))
    });
    json!({
        "hardware": true,
        "interface": snapshot.interface,
        "powered": snapshot.powered,
        "scanning": snapshot.scanning,
        "networks": network_list(&snapshot, &ordered),
        "attempt": attempt,
    })
}

/// The card's object path, or the words for why there isn't one. The card is checked first: asking
/// iwd would start it through D-Bus, on a machine with no use for it.
fn device() -> Result<String, String> {
    if !has_card() {
        return Err("This machine has no Wi-Fi card.".to_owned());
    }
    snapshot()?
        .device
        .ok_or_else(|| "The Wi-Fi software isn't answering.".to_owned())
}

/// Turns the radio on or off.
pub(crate) fn set_power(on: bool) -> Result<(), String> {
    let device = device()?;
    let value = if on { "true" } else { "false" };
    busctl(
        BUS_SECONDS,
        &[
            "set-property",
            IWD,
            &device,
            "net.connman.iwd.Device",
            "Powered",
            "b",
            value,
        ],
    )
    .map(|_| ())
    .map_err(|_| "The Wi-Fi radio could not be changed.".to_owned())
}

/// Starts a scan. A scan already running is what was wanted.
pub(crate) fn scan() -> Result<(), String> {
    let device = device()?;
    match busctl(
        BUS_SECONDS,
        &["call", IWD, &device, "net.connman.iwd.Station", "Scan"],
    ) {
        Err(words) if !words.contains("Busy") => Err("The scan could not start.".to_owned()),
        _ => Ok(()),
    }
}

/// iwd's file name for a network's saved password: the name itself if it is simple, else hex.
fn password_file(ssid: &str) -> String {
    let simple = ssid
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || "-_".contains(c));
    if simple {
        format!("{IWD_DIR}/{ssid}.psk")
    } else {
        let hex: String = ssid.bytes().map(|b| format!("{b:02x}")).collect();
        format!("{IWD_DIR}/={hex}.psk")
    }
}

/// True for a passphrase WPA accepts and this file format can hold on one line.
fn is_password(password: &str) -> bool {
    PASSWORD_BYTES.contains(&password.len()) && !password.chars().any(char::is_control)
}

/// The file's contents for a passphrase, with a backslash escaped as the format asks.
fn password_contents(password: &str) -> String {
    format!(
        "[Security]\nPassphrase={}\n",
        password.replace('\\', "\\\\")
    )
}

/// Writes a password where only root can read it, in one step: iwd reads the file as soon as it
/// appears, and refused one caught half written.
fn save_password(ssid: &str, password: &str) -> Result<(), String> {
    let target = password_file(ssid);
    let temporary = format!("{target}.new");
    let written = fs::OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .mode(0o600)
        .open(&temporary)
        .and_then(|mut file| file.write_all(password_contents(password).as_bytes()))
        .and_then(|()| fs::rename(&temporary, &target));
    written.map_err(|_| {
        drop(fs::remove_file(&temporary));
        "The password could not be saved.".to_owned()
    })
}

/// Waits, within a limit, for iwd to have read a new password. Joining sooner fails with no agent.
fn wait_for_known(ssid: &str) {
    for _ in 0..KNOWN_TRIES {
        std::thread::sleep(KNOWN_WAIT);
        let known = snapshot().is_ok_and(|now| now.known.iter().any(|(name, _)| name == ssid));
        if known {
            return;
        }
    }
}

/// The words for a failed join, from iwd's error.
fn join_failure_words(error: &str) -> &'static str {
    if error.contains("Agent") {
        "This machine didn't take the password in time. Try again."
    } else if error.contains("Aborted") {
        "The attempt was cancelled."
    } else if error.contains("NotSupported") {
        "This machine can't join that kind of network."
    } else if error.contains("Timeout") || error.contains("timed out") {
        "The network didn't answer. It may be out of range."
    } else {
        "The password may be wrong, or the network may be out of range."
    }
}

/// Joins a network, on this thread. A new password is kept only if it worked.
fn join(ssid: &str, password: &str) -> Result<(), String> {
    let snapshot = snapshot()?;
    let network = snapshot
        .networks
        .iter()
        .find(|network| network.name == ssid);
    let network = network.ok_or_else(|| "That network is no longer in range.".to_owned())?;
    if network.kind == "8021x" {
        return Err(
            "This network needs an enterprise login, which isn't available yet.".to_owned(),
        );
    }
    let new_password = network.kind == "psk" && !password.is_empty();
    if network.kind == "psk" && !network.known && !new_password {
        return Err("Enter the network's password.".to_owned());
    }
    if new_password {
        if !is_password(password) {
            return Err("A Wi-Fi password has 8 to 63 characters.".to_owned());
        }
        save_password(ssid, password)?;
        wait_for_known(ssid);
    }
    let joined = busctl(
        CONNECT_SECONDS,
        &[
            "call",
            IWD,
            &network.path,
            "net.connman.iwd.Network",
            "Connect",
        ],
    );
    joined.map(|_| ()).map_err(|error| {
        if new_password {
            drop(fs::remove_file(password_file(ssid)));
        }
        join_failure_words(&error).to_owned()
    })
}

/// Starts joining a network, on its own thread because it can take half a minute and the service
/// answers one request at a time. The screen reads the result from `status`.
pub(crate) fn connect(
    attempt: &Arc<Mutex<Attempt>>,
    ssid: &str,
    password: &str,
) -> Result<(), String> {
    {
        let mut current = attempt.lock().map_err(|_| "Try again.".to_owned())?;
        if current.state == "connecting" {
            return Err("Already joining a network.".to_owned());
        }
        *current = Attempt {
            ssid: ssid.to_owned(),
            state: "connecting",
            words: String::new(),
        };
    }
    let (attempt, ssid, password) = (Arc::clone(attempt), ssid.to_owned(), password.to_owned());
    std::thread::spawn(move || {
        let result = join(&ssid, &password);
        if let Ok(mut current) = attempt.lock() {
            (current.state, current.words) = match result {
                Ok(()) => ("connected", String::new()),
                Err(words) => ("failed", words),
            };
        }
    });
    Ok(())
}

/// Forgets a saved network and its password, along with any old result about it.
pub(crate) fn forget(attempt: &Arc<Mutex<Attempt>>, ssid: &str) -> Result<(), String> {
    if let Ok(mut current) = attempt.lock() {
        if current.ssid == ssid && current.state != "connecting" {
            *current = Attempt::default();
        }
    }
    let snapshot = snapshot()?;
    let known = snapshot.known.iter().find(|(name, _)| name == ssid);
    let (_, path) = known.ok_or_else(|| "That network isn't saved.".to_owned())?;
    busctl(
        BUS_SECONDS,
        &["call", IWD, path, "net.connman.iwd.KnownNetwork", "Forget"],
    )
    .map(|_| ())
    .map_err(|_| "That network could not be forgotten.".to_owned())
}

#[cfg(test)]
mod tests {
    use super::{is_password, join_failure_words, password_contents, password_file};

    /// A network's name comes from the air, so it must not be able to choose a file path.
    #[test]
    fn a_network_name_cannot_escape_the_password_directory() {
        assert_eq!(password_file("Ward-7"), "/var/lib/iwd/Ward-7.psk");
        assert_eq!(password_file("../x"), "/var/lib/iwd/=2e2e2f78.psk");
        assert_eq!(password_file("a b"), "/var/lib/iwd/=612062.psk");
    }

    #[test]
    fn a_password_cannot_add_a_line_to_its_file() {
        assert!(is_password("Ward-Seven7"));
        assert!(!is_password("short"));
        assert!(!is_password("Ward-Seven7\nEvil=1"));
        assert!(!is_password(&"x".repeat(64)));
        assert_eq!(password_contents("a\\b"), "[Security]\nPassphrase=a\\\\b\n");
    }

    #[test]
    fn a_failure_is_said_in_plain_words() {
        assert!(join_failure_words("net.connman.iwd.Failed").contains("password"));
        assert!(join_failure_words("net.connman.iwd.Aborted").contains("cancelled"));
    }
}
