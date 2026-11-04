//! What setup does to the machine: read the network and its health, write settings,
//! start services. Every command has a bound, because the screen waits on the answer.

use std::fs;
use std::io::Write;
use std::os::unix::fs::{MetadataExt, PermissionsExt, chown};
use std::path::Path;
use std::process::Command;

use serde_json::{Value, json};

use crate::{rules, status};

/// Set once the main-machine role is chosen; nothing later asks again.
const ROLE_MAIN: &str = "/var/lib/medbrains/config/role-main";
const ENV_FILE: &str = "/var/lib/medbrains/config/env";
/// Where a fixed address takes effect. On tmpfs, so a power cut before it is confirmed undoes it.
const LIVE_NETWORK: &str = "/run/systemd/network/10-medbrains-fixed.network";
/// Which link is tried first, here and on the data partition. A setting of its own, because a link
/// with a fixed address already has its own file.
const LIVE_PREFERRED: &str = "/run/systemd/network/50-medbrains-preferred.network";
const SAVED_PREFERRED: &str = "/var/lib/medbrains/network/50-medbrains-preferred.network";
/// Where a confirmed address is kept: the data partition, since the root becomes read-only.
/// `medbrains-network-settings.service` copies it to `LIVE_NETWORK` at boot.
const SAVED_NETWORK: &str = "/var/lib/medbrains/network/10-medbrains-fixed.network";

/// Runs a command and returns its output if it succeeded.
pub(crate) fn output(program: &str, args: &[&str]) -> Option<Vec<u8>> {
    let done = Command::new(program).args(args).output().ok()?;
    done.status.success().then_some(done.stdout)
}

/// Runs a command that prints JSON, and parses it.
fn json_output(program: &str, args: &[&str]) -> Value {
    output(program, args)
        .and_then(|raw| serde_json::from_slice(&raw).ok())
        .unwrap_or_else(|| json!([]))
}

/// Whether this machine has finished setup.
pub(crate) fn is_set_up() -> bool {
    Path::new(ROLE_MAIN).exists()
}

/// Links, addresses and the gateway. Nothing here leaves the machine.
pub(crate) fn network_links() -> Value {
    let addresses = json_output("ip", &["-j", "addr", "show"]);
    let routes = json_output("ip", &["-j", "-4", "route", "show", "default"]);
    let first_route = routes.get(0);
    json!({
        "links": summarise_links(&addresses),
        "gateway": first_route.and_then(|route| route.get("gateway")),
        "default_link": first_route.and_then(|route| route.get("dev")),
        "preferred": preferred_link(),
        "fixed": Path::new(LIVE_NETWORK).exists(),
    })
}

/// Each real link from `ip -j addr`: its name, whether a cable is in, its IPv4 addresses.
fn summarise_links(links: &Value) -> Vec<Value> {
    let summarise = |link: &Value| {
        let name = link.get("ifname")?.as_str()?;
        if link.get("link_type")?.as_str()? == "loopback" {
            return None;
        }
        let has_flag = |flag: &str| {
            link.get("flags")
                .and_then(Value::as_array)
                .is_some_and(|flags| flags.iter().any(|f| f.as_str() == Some(flag)))
        };
        let addresses: Vec<&str> = link
            .get("addr_info")?
            .as_array()?
            .iter()
            .filter(|info| info.get("family").and_then(Value::as_str) == Some("inet"))
            .filter_map(|info| info.get("local")?.as_str())
            .collect();
        Some(json!({
            "name": name,
            "kind": if link_is_wireless(name) { "wifi" } else { "ethernet" },
            "cable": has_flag("LOWER_UP"),
            "addresses": addresses,
            "speed_mbps": link_speed(name),
        }))
    };
    links
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(summarise)
        .collect()
}

/// True if the kernel lists this link as Wi-Fi.
fn link_is_wireless(name: &str) -> bool {
    Path::new("/sys/class/net")
        .join(name)
        .join("wireless")
        .exists()
}

/// A link's speed in Mb/s, if it has one: a link without a cable reports none, or -1.
fn link_speed(name: &str) -> Option<u64> {
    let path = Path::new("/sys/class/net").join(name).join("speed");
    fs::read_to_string(path).ok()?.trim().parse().ok()
}

/// Makes a link the one tried first, or with an empty name, any. Takes effect at once and survives
/// a restart. The other links stay up, so this can't cut the machine off.
pub(crate) fn prefer_link(interface: &str) -> Result<(), String> {
    if interface.is_empty() {
        remove_if_present(SAVED_PREFERRED)?;
        remove_if_present(LIVE_PREFERRED)?;
        return reload_network();
    }
    let file = rules::preferred_network(interface)
        .ok_or_else(|| "That isn't a network card on this machine.".to_owned())?;
    fs::write(LIVE_PREFERRED, &file).map_err(|e| e.to_string())?;
    fs::write(SAVED_PREFERRED, &file).map_err(|e| e.to_string())?;
    reload_network()
}

/// The link tried first, if one was chosen.
fn preferred_link() -> Option<String> {
    let file = fs::read_to_string(LIVE_PREFERRED).ok()?;
    file.lines()
        .find_map(|line| line.strip_prefix("Name=").map(str::to_owned))
}

/// The network with what can be reached, for the network screen only: this one sends a
/// ping to the gateway and one request to the internet, so it never runs in the background.
pub(crate) fn network_check() -> Value {
    let mut network = network_links();
    let local = network
        .get("gateway")
        .and_then(Value::as_str)
        .map(answers_ping);
    let internet = output(
        "curl",
        &[
            "-sS",
            "-I",
            "-m",
            "3",
            "-o",
            "/dev/null",
            "https://deb.debian.org/",
        ],
    )
    .is_some();
    network["local"] = json!(local);
    network["internet"] = json!(internet);
    network
}

/// Whether an address answers one ping within a second.
fn answers_ping(address: &str) -> bool {
    output("ping", &["-c", "1", "-W", "1", address]).is_some()
}

/// Applies a fixed address, for now only. The caller undoes it unless it is confirmed.
pub(crate) fn apply_fixed_address(
    interface: &str,
    address: &str,
    gateway: &str,
    dns: &str,
) -> Result<(), String> {
    let file = rules::fixed_network(interface, address, gateway, dns).ok_or_else(|| {
        "Check the address, gateway and DNS. An address looks like 192.168.1.20/24.".to_owned()
    })?;
    fs::write(LIVE_NETWORK, file).map_err(|e| e.to_string())?;
    reload_network()
}

/// Keeps the address now in effect across restarts. Refused if it has already been undone.
pub(crate) fn confirm_fixed_address() -> Result<(), String> {
    fs::copy(LIVE_NETWORK, SAVED_NETWORK)
        .map(|_| ())
        .map_err(|_| "The address was already undone. Enter it again.".to_owned())
}

/// Removes a file; one already gone is what was wanted.
fn remove_if_present(path: &str) -> Result<(), String> {
    match fs::remove_file(path) {
        Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(e.to_string()),
        _ => Ok(()),
    }
}

/// Goes back to the last confirmed setting.
pub(crate) fn undo_fixed_address() -> Result<(), String> {
    if Path::new(SAVED_NETWORK).exists() {
        fs::copy(SAVED_NETWORK, LIVE_NETWORK).map_err(|e| e.to_string())?;
    } else {
        remove_if_present(LIVE_NETWORK)?;
    }
    reload_network()
}

/// Forgets any fixed address, returning the machine to automatic addressing.
pub(crate) fn use_automatic_address() -> Result<(), String> {
    remove_if_present(SAVED_NETWORK)?;
    remove_if_present(LIVE_NETWORK)?;
    reload_network()
}

/// Asks networkd to read its files again and apply them.
fn reload_network() -> Result<(), String> {
    output("networkctl", &["reload"])
        .map(|_| ())
        .ok_or_else(|| "The network could not be changed.".to_owned())
}

/// Replaces the env file in one step, so a power cut leaves the old or the new one, whole.
fn write_env(contents: &str) -> Result<(), String> {
    let group = fs::metadata(ENV_FILE).map_err(|e| e.to_string())?.gid();
    let temporary = format!("{ENV_FILE}.new");
    let mut file = fs::File::create(&temporary).map_err(|e| e.to_string())?;
    file.set_permissions(fs::Permissions::from_mode(0o640))
        .map_err(|e| e.to_string())?;
    chown(&temporary, Some(0), Some(group)).map_err(|e| e.to_string())?;
    file.write_all(contents.as_bytes())
        .map_err(|e| e.to_string())?;
    file.sync_all().map_err(|e| e.to_string())?;
    fs::rename(&temporary, ENV_FILE).map_err(|e| e.to_string())
}

/// Records a new hospital and starts the main machine's services. The role marker is
/// written last, so a failure before it leaves the machine still in setup.
pub(crate) fn start_main_machine(
    hospital: &str,
    username: &str,
    password: &str,
) -> Result<(), String> {
    let env = fs::read_to_string(ENV_FILE).map_err(|e| e.to_string())?;
    write_env(&rules::env_with_seed(&env, hospital, username, password))?;
    fs::write(status::HOSPITAL_NAME, hospital.trim()).map_err(|e| e.to_string())?;
    fs::File::create(ROLE_MAIN)
        .and_then(|marker| marker.sync_all())
        .map_err(|e| e.to_string())?;
    output(
        "systemctl",
        &["start", "--no-block", "medbrains-main.target"],
    )
    .map(|_| ())
    .ok_or_else(|| "The services could not start.".to_owned())
}

/// Turns the machine off or restarts it.
pub(crate) fn power(action: &str) -> Result<(), String> {
    let verb = power_verb(action).ok_or_else(|| "Unknown action.".to_owned())?;
    let done = Command::new("systemctl")
        .arg(verb)
        .output()
        .map_err(|e| e.to_string())?;
    if done.status.success() {
        return Ok(());
    }
    // The real reason goes to the journal, the plain next step to the screen.
    log_refusal(verb, &done.stderr);
    Err("The machine refused. Try again, or use its power button.".to_owned())
}

/// Records why systemd refused, for whoever reads the journal.
fn log_refusal(verb: &str, reason: &[u8]) {
    let line = format!(
        "systemctl {verb} failed: {}\n",
        String::from_utf8_lossy(reason).trim()
    );
    // Nothing more can be done if the log itself is unavailable.
    drop(std::io::stderr().write_all(line.as_bytes()));
}

/// The systemctl verb for a power action.
fn power_verb(action: &str) -> Option<&'static str> {
    match action {
        "off" => Some("poweroff"),
        "restart" => Some("reboot"),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::{power_verb, summarise_links};
    use serde_json::json;

    /// A wrong word must never reach systemctl as a command of its own.
    #[test]
    fn only_the_two_power_actions_reach_systemctl() {
        assert_eq!(power_verb("restart"), Some("reboot"));
        assert_eq!(power_verb("off"), Some("poweroff"));
        assert_eq!(power_verb("halt"), None);
        assert_eq!(power_verb(""), None);
    }

    /// The network screen must tell a pulled cable from a working link.
    #[test]
    fn a_link_reports_its_cable_and_only_real_links_are_listed() {
        let links = json!([
            { "ifname": "lo", "link_type": "loopback", "flags": ["LOOPBACK", "UP", "LOWER_UP"], "addr_info": [] },
            { "ifname": "en0", "link_type": "ether", "flags": ["BROADCAST", "UP", "LOWER_UP"],
              "addr_info": [{ "family": "inet", "local": "10.0.2.15" }, { "family": "inet6", "local": "fe80::1" }] },
            { "ifname": "en1", "link_type": "ether", "flags": ["NO-CARRIER", "UP"], "addr_info": [] },
        ]);
        let summary = summarise_links(&links);
        assert_eq!(summary.len(), 2);
        assert_eq!(summary[0]["name"], "en0");
        assert_eq!(summary[0]["kind"], "ethernet");
        assert_eq!(summary[0]["cable"], true);
        assert_eq!(summary[0]["addresses"], json!(["10.0.2.15"]));
        assert_eq!(summary[1]["cable"], json!(false));
    }
}
