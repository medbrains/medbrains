//! What setup does to the machine: read the network, write settings, start services.

use std::fs::{self, OpenOptions};
use std::io::Write;
use std::process::Command;

use serde_json::{Value, json};

use crate::rules;

/// Set once the main-machine role is chosen; nothing later asks again.
pub const ROLE_MAIN: &str = "/var/lib/medbrains/config/role-main";
const ENV_FILE: &str = "/var/lib/medbrains/config/env";
const FIXED_NETWORK: &str = "/etc/systemd/network/10-medbrains-fixed.network";

/// Runs a command and returns its output if it succeeded.
fn output(program: &str, args: &[&str]) -> Option<Vec<u8>> {
    let done = Command::new(program).args(args).output().ok()?;
    done.status.success().then_some(done.stdout)
}

/// Whether this machine has finished setup.
pub fn is_set_up() -> bool {
    fs::exists(ROLE_MAIN).unwrap_or(false)
}

/// Links, addresses and what can be reached, for the network screen.
pub fn network_state() -> Value {
    let links: Value = output("ip", &["-j", "-4", "addr", "show", "scope", "global"])
        .and_then(|raw| serde_json::from_slice(&raw).ok())
        .unwrap_or_else(|| json!([]));
    let wired = output("ip", &["-j", "link", "show"])
        .and_then(|raw| serde_json::from_slice::<Value>(&raw).ok())
        .unwrap_or_else(|| json!([]));
    let gateway = output("ip", &["-4", "route", "show", "default"]).is_some_and(|o| !o.is_empty());
    let internet = output("curl", &["-sS", "-m", "3", "-o", "/dev/null", "https://deb.debian.org/"]).is_some();
    let wifi = fs::read_dir("/sys/class/net").is_ok_and(|dir| {
        dir.flatten().any(|entry| entry.path().join("wireless").exists())
    });
    json!({ "addresses": summarise(&links), "interfaces": interfaces(&wired), "local": gateway, "internet": internet, "wifi": wifi })
}

/// `name` and `address` of each configured link, from `ip -j addr`.
fn summarise(links: &Value) -> Vec<Value> {
    links.as_array().into_iter().flatten().filter_map(|link| {
        let name = link.get("ifname")?.as_str()?;
        let address = link.get("addr_info")?.get(0)?.get("local")?.as_str()?;
        Some(json!({ "name": name, "address": address }))
    }).collect()
}

/// Names of the physical-looking interfaces, from `ip -j link`.
fn interfaces(links: &Value) -> Vec<String> {
    links.as_array().into_iter().flatten()
        .filter_map(|link| link.get("ifname")?.as_str())
        .filter(|name| *name != "lo")
        .map(str::to_owned)
        .collect()
}

/// Applies a fixed address. The caller rolls it back unless it is confirmed.
pub fn apply_fixed_address(interface: &str, address: &str, gateway: &str, dns: &str) -> Result<(), String> {
    let valid = rules::is_interface(interface) && rules::is_ipv4_prefix(address) && rules::is_ipv4(gateway) && rules::is_ipv4(dns);
    if !valid {
        return Err("Check the address, gateway and DNS. An address looks like 192.168.1.20/24.".to_owned());
    }
    fs::write(FIXED_NETWORK, rules::fixed_network(interface, address, gateway, dns)).map_err(|e| e.to_string())?;
    reload_network()
}

/// Removes a fixed address, returning the machine to automatic addressing.
pub fn remove_fixed_address() -> Result<(), String> {
    match fs::remove_file(FIXED_NETWORK) {
        Ok(()) => reload_network(),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

/// Asks networkd to read its files again.
fn reload_network() -> Result<(), String> {
    output("networkctl", &["reload"]).map(|_| ()).ok_or_else(|| "The network could not be changed.".to_owned())
}

/// Records a new hospital and starts the main machine's services. The role marker is
/// written last, so a failure before it leaves the machine still in setup.
pub fn start_main_machine(hospital: &str, username: &str, password: &str) -> Result<(), String> {
    let mut env = OpenOptions::new().append(true).open(ENV_FILE).map_err(|e| e.to_string())?;
    env.write_all(rules::seed_env(hospital, username, password).as_bytes()).map_err(|e| e.to_string())?;
    env.sync_all().map_err(|e| e.to_string())?;
    fs::write(ROLE_MAIN, "").map_err(|e| e.to_string())?;
    output("systemctl", &["start", "--no-block", "medbrains-main.target"])
        .map(|_| ())
        .ok_or_else(|| "The services could not start.".to_owned())
}

/// Turns the machine off or restarts it.
pub fn power(action: &str) -> Result<(), String> {
    let verb = match action {
        "off" => "poweroff",
        "restart" => "reboot",
        _ => return Err("Unknown action.".to_owned()),
    };
    output("systemctl", &[verb]).map(|_| ()).ok_or_else(|| "The machine could not do that.".to_owned())
}
