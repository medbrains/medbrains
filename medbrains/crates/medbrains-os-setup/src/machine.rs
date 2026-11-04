//! What setup does to the machine: read the network and its health, write settings,
//! start services. Every command has a bound, because the screen waits on the answer.

use std::fs;
use std::io::Write;
use std::os::unix::fs::{MetadataExt, PermissionsExt, chown};
use std::path::Path;
use std::process::Command;

use serde_json::{Value, json};

use crate::rules;

/// Set once the main-machine role is chosen; nothing later asks again.
const ROLE_MAIN: &str = "/var/lib/medbrains/config/role-main";
const ROLE_NODE: &str = "/var/lib/medbrains/config/role-node";
/// What the agent recorded when a person approved this machine.
const JOINED_FILE: &str = "/var/lib/medbrains-agent/joined.json";
/// The screen's one trusted certificate, bound into its unit. Written in place, so the running
/// screen sees it: a new file under this name would stay hidden behind the bind mount.
const SCREEN_CERTIFICATE: &str = "/var/lib/kiosk/local-front.pem";
/// The main machine's health, as a node's screen would reach it, through the agent.
const FRONT_HEALTH: &str = "https://127.0.0.1:8443/api/health";
const ENV_FILE: &str = "/var/lib/medbrains/config/env";
/// Where a fixed address takes effect. On tmpfs, so a power cut before it is confirmed undoes it.
const LIVE_NETWORK: &str = "/run/systemd/network/10-medbrains-fixed.network";
/// Where a confirmed address is kept: the data partition, since the root becomes read-only.
/// `medbrains-network-settings.service` copies it to `LIVE_NETWORK` at boot.
const SAVED_NETWORK: &str = "/var/lib/medbrains/network/10-medbrains-fixed.network";
const SERVER_HEALTH: &str = "http://127.0.0.1:3000/api/health";
const DATA_MOUNT: &str = "/var";

/// Runs a command and returns its output if it succeeded.
fn output(program: &str, args: &[&str]) -> Option<Vec<u8>> {
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
    Path::new(ROLE_MAIN).exists() || Path::new(ROLE_NODE).exists()
}

/// Whether the app answers: the server on a main machine, the main machine through the agent on
/// a node. So a removed or cut-off node says so on its desktop.
fn app_answers() -> bool {
    if Path::new(ROLE_NODE).exists() {
        let args = ["-fsS", "-m", "3", "--cacert", SCREEN_CERTIFICATE, "-o", "/dev/null", FRONT_HEALTH];
        return output("curl", &args).is_some();
    }
    is_set_up() && output("curl", &["-fsS", "-m", "2", "-o", "/dev/null", SERVER_HEALTH]).is_some()
}

/// Everything the desktop shows. Asks only this machine, so polling it sends nothing out.
pub(crate) fn state() -> Value {
    let set_up = is_set_up();
    json!({
        "set_up": set_up,
        "main_ready": app_answers(),
        "clock_synced": clock_synced(),
        "machine": machine_health(),
        "network": network_links(),
    })
}

/// Whether chrony has a time source it believes.
fn clock_synced() -> bool {
    output("chronyc", &["-n", "tracking"])
        .is_some_and(|raw| is_clock_trusted(&String::from_utf8_lossy(&raw)))
}

/// Reads `chronyc tracking`. "Normal" alone is not enough: chrony also serves the LAN from
/// its own clock when cut off (`local orphan`), and then names itself, 127.127.1.1, as source.
fn is_clock_trusted(tracking: &str) -> bool {
    let value = |wanted: &str| {
        tracking.lines().find_map(|line| {
            let (key, value) = line.split_once(':')?;
            (key.trim() == wanted).then(|| value.trim())
        })
    };
    value("Leap status") == Some("Normal")
        && !value("Reference ID").is_some_and(|id| id.starts_with("7F7F0101"))
}

/// Memory, load, uptime, disk and the overall state of the services.
fn machine_health() -> Value {
    let meminfo = fs::read_to_string("/proc/meminfo").unwrap_or_default();
    let uptime = fs::read_to_string("/proc/uptime").unwrap_or_default();
    let load = fs::read_to_string("/proc/loadavg").unwrap_or_default();
    let df = output("df", &["-B1", "--output=size,used", DATA_MOUNT]).unwrap_or_default();
    let (disk_total, disk_used) = parse_df(&String::from_utf8_lossy(&df)).unwrap_or((0, 0));
    // `is-system-running` exits non-zero when degraded, and that is the answer we want.
    let system = Command::new("systemctl")
        .arg("is-system-running")
        .output()
        .map_or_else(
            |_| String::new(),
            |o| String::from_utf8_lossy(&o.stdout).trim().to_owned(),
        );
    json!({
        "system": system,
        "memory_total_kb": meminfo_kb(&meminfo, "MemTotal"),
        "memory_available_kb": meminfo_kb(&meminfo, "MemAvailable"),
        "load": load.split_whitespace().next().unwrap_or(""),
        "uptime_seconds": first_number(&uptime),
        "disk_total": disk_total,
        "disk_used": disk_used,
    })
}

/// One value from `/proc/meminfo`, in kB.
fn meminfo_kb(meminfo: &str, key: &str) -> u64 {
    meminfo
        .lines()
        .find_map(|line| {
            line.strip_prefix(key)?
                .strip_prefix(':')?
                .split_whitespace()
                .next()
        })
        .and_then(|value| value.parse().ok())
        .unwrap_or(0)
}

/// The first whole number in a text such as `/proc/uptime`.
fn first_number(text: &str) -> u64 {
    text.split(['.', ' '])
        .next()
        .and_then(|n| n.parse().ok())
        .unwrap_or(0)
}

/// Size and used bytes from `df --output=size,used`.
fn parse_df(df: &str) -> Option<(u64, u64)> {
    let mut fields = df.lines().nth(1)?.split_whitespace();
    Some((fields.next()?.parse().ok()?, fields.next()?.parse().ok()?))
}

/// Links, addresses and the gateway. Nothing here leaves the machine.
fn network_links() -> Value {
    let addresses = json_output("ip", &["-j", "addr", "show"]);
    let routes = json_output("ip", &["-j", "-4", "route", "show", "default"]);
    let wifi = fs::read_dir("/sys/class/net").is_ok_and(|dir| {
        dir.flatten()
            .any(|entry| entry.path().join("wireless").exists())
    });
    json!({
        "links": summarise_links(&addresses),
        "gateway": routes.get(0).and_then(|route| route.get("gateway")),
        "wifi": wifi,
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
        Some(json!({ "name": name, "cable": has_flag("LOWER_UP"), "addresses": addresses }))
    };
    links
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(summarise)
        .collect()
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
    // Only now: a machine that becomes a node never holds a database or these secrets.
    output("systemctl", &["start", "medbrains-firstboot.service"])
        .ok_or_else(|| "The machine could not prepare its database.".to_owned())?;
    let env = fs::read_to_string(ENV_FILE).map_err(|e| e.to_string())?;
    write_env(&rules::env_with_seed(&env, hospital, username, password))?;
    fs::File::create(ROLE_MAIN)
        .and_then(|marker| marker.sync_all())
        .map_err(|e| e.to_string())?;
    // The agent looks for a main machine until now; this machine is one.
    output("systemctl", &["stop", "medbrains-agent.service"]);
    output(
        "systemctl",
        &["start", "--no-block", "medbrains-main.target"],
    )
    .map(|_| ())
    .ok_or_else(|| "The services could not start.".to_owned())
}

/// Makes this machine a node, once the agent says a person approved it. The role goes down last,
/// so a power cut before it leaves a machine that simply asks again.
pub(crate) fn finish_node() -> Result<(), String> {
    let joined = fs::read_to_string(JOINED_FILE)
        .map_err(|_| "A person has not approved this machine yet.".to_owned())?;
    let certificate = rules::joined_certificate(&joined)
        .ok_or_else(|| "The main machine's answer could not be used. Ask to join again.".to_owned())?;
    fs::write(SCREEN_CERTIFICATE, certificate).map_err(|e| e.to_string())?;
    fs::File::create(ROLE_NODE)
        .and_then(|marker| marker.sync_all())
        .map_err(|e| e.to_string())?;
    output("systemctl", &["start", "--no-block", "medbrains-node.target"])
        .map(|_| ())
        .ok_or_else(|| "The services could not start.".to_owned())
}

/// Turns the machine off or restarts it.
pub(crate) fn power(action: &str) -> Result<(), String> {
    let verb = match action {
        "off" => "poweroff",
        "restart" => "reboot",
        _ => return Err("Unknown action.".to_owned()),
    };
    output("systemctl", &[verb])
        .map(|_| ())
        .ok_or_else(|| "The machine could not do that.".to_owned())
}

#[cfg(test)]
mod tests {
    use super::{first_number, is_clock_trusted, meminfo_kb, parse_df, summarise_links};
    use serde_json::json;

    #[test]
    fn the_clock_is_trusted_only_with_a_real_time_source() {
        let tracking = |id, leap| format!("Reference ID    : {id}\nLeap status     : {leap}\n");
        assert!(is_clock_trusted(&tracking(
            "A29FC801 (162.159.200.1)",
            "Normal"
        )));
        assert!(!is_clock_trusted(&tracking(
            "00000000 ()",
            "Not synchronised"
        )));
        assert!(!is_clock_trusted(&tracking("7F7F0101 ()", "Normal")));
        assert!(!is_clock_trusted(""));
    }

    #[test]
    fn health_figures_are_read_from_the_kernels_own_format() {
        let meminfo = "MemTotal:        4015024 kB\nMemAvailable:    3000000 kB\n";
        assert_eq!(meminfo_kb(meminfo, "MemAvailable"), 3_000_000);
        assert_eq!(meminfo_kb(meminfo, "Mem"), 0);
        assert_eq!(first_number("86.13 300.2\n"), 86);
        assert_eq!(parse_df("1B-blocks Used\n 1000 200\n"), Some((1000, 200)));
        assert_eq!(parse_df(""), None);
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
        assert_eq!(
            summary[0],
            json!({ "name": "en0", "cable": true, "addresses": ["10.0.2.15"] })
        );
        assert_eq!(summary[1]["cable"], json!(false));
    }
}
