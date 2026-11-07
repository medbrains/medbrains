//! What setup does to the machine: read the network and its health, write settings,
//! start services. Every command has a limit, because the screen waits on the answer.

use std::fs;
use std::io::Write;
use std::os::unix::fs::{MetadataExt, OpenOptionsExt, PermissionsExt, chown};
use std::path::Path;
use std::time::Duration;

use argon2::{Argon2, PasswordHasher};
use serde_json::{Value, json};

use crate::child::{self, USUAL_LIMIT};
use crate::{rules, status};

/// Set once the main-machine role is chosen; nothing later asks again.
/// While this exists, Kanidm may start before setup has finished.
const IDENTITY_FOR_SETUP: &str = "/run/medbrains-console/kanidm-for-setup";
const ENCRYPTION_GUARD: &str = "/usr/lib/medbrains/require-encrypted-data";
const FIRST_ADMIN: &str = "/usr/lib/medbrains/kanidm-first-admin";
/// This service's sandbox can't switch users or write Kanidm's folder, and should not. So these helpers run
/// as transient units, and `--pipe` connects them to this process's pipes: the password still only crosses stdin.
const TRANSIENT: &str = "systemd-run";
const TRANSIENT_WAIT: &str = "--wait";
const TRANSIENT_PIPE: &str = "--pipe";
const TRANSIENT_QUIET: &str = "--quiet";
const TRANSIENT_COLLECT: &str = "--collect";
/// Kanidm's first start, with room for a slow machine, and well inside what the screen will wait.
const FIRST_ADMIN_LIMIT: Duration = Duration::from_secs(120);

const ROLE_MAIN: &str = "/var/lib/medbrains/config/role-main";
const ENV_FILE: &str = "/var/lib/medbrains/config/env";
/// Set once a person has approved this machine, so it uses a main machine rather than being one.
pub(crate) const ROLE_NODE: &str = "/var/lib/medbrains/config/role-node";
/// Making the database and secrets takes seconds, and many on slow storage.
const FIRST_START_LIMIT: std::time::Duration = std::time::Duration::from_secs(50);
/// Where a fixed address takes effect. On tmpfs, so a power cut before it is confirmed undoes it.
const LIVE_NETWORK: &str = "/run/systemd/network/10-medbrains-fixed.network";
/// Which link is tried first, here and on the data partition. A setting of its own, because a link
/// with a fixed address already has its own file.
const LIVE_PREFERRED: &str = "/run/systemd/network/50-medbrains-preferred.network";
const SAVED_PREFERRED: &str = "/var/lib/medbrains/network/50-medbrains-preferred.network";
/// systemd-networkd runs as its own user, so it must be able to read these.
const NETWORK_FILE_MODE: u32 = 0o644;
pub(crate) const PUBLIC_FILE_MODE: u32 = 0o644;
/// Where a confirmed address is kept: the data partition, since the root becomes read-only.
/// `medbrains-network-settings.service` copies it to `LIVE_NETWORK` at boot.
const SAVED_NETWORK: &str = "/var/lib/medbrains/network/10-medbrains-fixed.network";

/// Runs a helper, within the usual limit, and returns its output if it succeeded.
pub(crate) fn output(program: &str, args: &[&str]) -> Option<Vec<u8>> {
    let done = child::run(program, args, USUAL_LIMIT)?;
    done.success.then_some(done.stdout)
}

/// Runs a helper that prints JSON, and parses it. `None` means no answer, not an empty one.
fn json_output(program: &str, args: &[&str]) -> Option<Value> {
    serde_json::from_slice(&output(program, args)?).ok()
}

/// Whether this machine has finished setup, or the words for why that can't be read.
pub(crate) fn is_set_up() -> Result<bool, String> {
    let exists = |marker| {
        Path::new(marker).try_exists().map_err(|error| {
            log(&format!("reading the role marker: {error}"));
            "This machine can't read its own setting. Restart it.".to_owned()
        })
    };
    Ok(exists(ROLE_MAIN)? || exists(ROLE_NODE)?)
}

/// True if this machine uses a main machine. Unreadable counts as not: the caller has already asked
/// `is_set_up`, which reports that fault.
pub(crate) fn is_node() -> bool {
    Path::new(ROLE_NODE).exists()
}

/// Records something for whoever reads the journal.
fn log(line: &str) {
    // Nothing more can be done if the log itself is unavailable.
    drop(std::io::stderr().write_all(format!("{line}\n").as_bytes()));
}

/// Records a failure of something nobody is waiting on.
pub(crate) fn log_if_failed(doing: &str, result: Result<(), String>) {
    if let Err(error) = result {
        log(&format!("{doing} failed: {error}"));
    }
}

/// Replaces a file in one step: written aside, flushed, then renamed. A power cut leaves the old file
/// or the new one, whole, which is what networkd and iwd need to find on the next boot.
pub(crate) fn write_atomically(path: &str, contents: &[u8], mode: u32) -> Result<(), String> {
    let temporary = format!("{path}.new");
    let written = fs::OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .mode(mode)
        .open(&temporary)
        .and_then(|mut file| {
            file.write_all(contents)?;
            file.sync_all()
        })
        .and_then(|()| fs::rename(&temporary, path))
        .and_then(|()| sync_parent(path));
    written.map_err(|error| {
        drop(fs::remove_file(&temporary));
        error.to_string()
    })
}

/// Flushes a directory, so a rename in it survives a power cut too.
pub(crate) fn sync_parent(path: &str) -> std::io::Result<()> {
    let parent = Path::new(path).parent().unwrap_or_else(|| Path::new("/"));
    fs::File::open(parent)?.sync_all()
}

/// Links, addresses and the gateway. Nothing here leaves the machine. If `ip` doesn't answer that
/// says so, because "no links" would read as a machine with no network card.
pub(crate) fn network_links() -> Value {
    let addresses = json_output("ip", &["-j", "addr", "show"]);
    let routes = json_output("ip", &["-j", "-4", "route", "show", "default"]);
    let first_route = routes.as_ref().and_then(|routes| routes.get(0));
    json!({
        "fault": addresses.is_none() || routes.is_none(),
        "links": addresses.as_ref().map_or_else(Vec::new, summarise_links),
        "gateway": first_route.and_then(|route| route.get("gateway")),
        "default_link": first_route.and_then(|route| route.get("dev")),
        "preferred": preferred_link(),
        "fixed": Path::new(LIVE_NETWORK).exists(),
        "unconfirmed": is_unconfirmed(),
    })
}

/// Each real link from `ip -j addr`: its name, whether a cable is in, its IPv4 addresses.
fn summarise_links(links: &Value) -> Vec<Value> {
    let summarise = |link: &Value| {
        let name = link.get("ifname")?.as_str()?;
        // Only real network cards: not loopback, nor a radio's monitor link such as hwsim0.
        if link.get("link_type")?.as_str()? != "ether" {
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
    write_atomically(LIVE_PREFERRED, file.as_bytes(), NETWORK_FILE_MODE)?;
    write_atomically(SAVED_PREFERRED, file.as_bytes(), NETWORK_FILE_MODE)?;
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
    write_atomically(LIVE_NETWORK, file.as_bytes(), NETWORK_FILE_MODE)?;
    let reloaded = reload_network();
    if reloaded.is_err() {
        log_if_failed(
            "undoing an address that wouldn't apply",
            undo_fixed_address(),
        );
    }
    reloaded
}

/// True if the address in effect isn't the saved one: a new one nobody has confirmed.
fn is_unconfirmed() -> bool {
    match fs::read(LIVE_NETWORK) {
        Ok(live) => fs::read(SAVED_NETWORK).ok().as_deref() != Some(live.as_slice()),
        Err(_) => false,
    }
}

/// At startup: an unconfirmed address can only be left over from a run that ended before its timer
/// did, and nothing would ever undo it now.
pub(crate) fn reconcile_fixed_address() -> Result<(), String> {
    if is_unconfirmed() {
        log("undoing a fixed address left unconfirmed by the last run");
        return undo_fixed_address();
    }
    Ok(())
}

/// Keeps the address now in effect across restarts.
pub(crate) fn confirm_fixed_address() -> Result<(), String> {
    let live = fs::read(LIVE_NETWORK)
        .map_err(|_| "The address was already undone. Enter it again.".to_owned())?;
    write_atomically(SAVED_NETWORK, &live, NETWORK_FILE_MODE)
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
        let saved = fs::read(SAVED_NETWORK).map_err(|e| e.to_string())?;
        write_atomically(LIVE_NETWORK, &saved, NETWORK_FILE_MODE)?;
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

/// At startup: seed lines on a machine with no role marker are left over from a setup a power cut
/// interrupted. Setup will ask again, so nothing needs them.
pub(crate) fn remove_abandoned_seed() -> Result<(), String> {
    if is_set_up()? {
        return Ok(());
    }
    let env = fs::read_to_string(ENV_FILE).map_err(|e| e.to_string())?;
    let cleaned = rules::env_without_seed(&env);
    if cleaned.len() == env.len() {
        return Ok(());
    }
    log("removing first-administrator details left by an interrupted setup");
    write_env(&cleaned)
}

/// Records a new hospital and starts the main machine's services. The role marker is
/// written last, so a failure before it leaves the machine still in setup. If the services can't
/// even be asked to start, all of it is taken back: otherwise the screen would be stuck on "already
/// set up", with the password waiting in the env for a server that never reads it.
pub(crate) fn start_main_machine(
    hospital: &str,
    username: &str,
    password: &str,
) -> Result<(), String> {
    let hash = Argon2::default()
        .hash_password(password.as_bytes())
        .map_err(|e| e.to_string())?
        .to_string();
    // Only now: a machine that becomes a node never holds a database or these secrets.
    child::run("systemctl", &["start", "medbrains-firstboot.service"], FIRST_START_LIMIT)
        .filter(|done| done.success)
        .ok_or_else(|| "The machine could not prepare its database. Try again.".to_owned())?;
    let env = fs::read_to_string(ENV_FILE).map_err(|e| e.to_string())?;
    write_env(&rules::env_with_seed(&env, hospital, username, &hash))?;
    let started = mark_and_start(hospital);
    if started.is_err() {
        log_if_failed(
            "removing the first administrator's details",
            write_env(&env),
        );
        log_if_failed("removing the role marker", remove_if_present(ROLE_MAIN));
    }
    started
}

/// What became of the first administrator's Kanidm login.
pub(crate) enum FirstAdmin {
    Made,
    /// Kanidm's own check said no. Nothing is left behind.
    PasswordRefused,
    /// A release image won't run Kanidm on an unencrypted disk, so there is only local sign-in.
    NoProviderOnThisDisk,
    /// In plain words. Nothing is left behind, and setup can be tried again.
    Failed(String),
}

/// Starts Kanidm early while setup is showing, on loopback, so that making the admin doesn't wait for it.
/// A machine already set up starts it from its target instead.
pub(crate) fn start_identity_for_setup() {
    if !matches!(is_set_up(), Ok(false)) {
        return;
    }
    log_if_failed(
        "allowing the identity provider to start for setup",
        fs::write(IDENTITY_FOR_SETUP, b"").map_err(|e| e.to_string()),
    );
    drop(child::run(
        "systemctl",
        &["start", "--no-block", "kanidmd"],
        USUAL_LIMIT,
    ));
}

/// Makes the Kanidm login, with this username and password, on a helper's stdin. Never in its arguments, a
/// file or a log. The helper removes what it made if it fails, so this can be tried again.
pub(crate) fn make_first_admin(username: &str, password: &str) -> FirstAdmin {
    let may_run = child::run(
        TRANSIENT,
        &[
            TRANSIENT_WAIT,
            TRANSIENT_PIPE,
            TRANSIENT_QUIET,
            TRANSIENT_COLLECT,
            ENCRYPTION_GUARD,
        ],
        USUAL_LIMIT,
    )
    .is_some_and(|done| done.success);
    if !may_run {
        log_line("the identity provider is off: this disk is not encrypted");
        return FirstAdmin::NoProviderOnThisDisk;
    }
    let input = format!("{username}\n{password}\n");
    let done = child::run_with_input(
        TRANSIENT,
        &[
            TRANSIENT_WAIT,
            TRANSIENT_PIPE,
            TRANSIENT_QUIET,
            TRANSIENT_COLLECT,
            FIRST_ADMIN,
        ],
        input.as_bytes(),
        FIRST_ADMIN_LIMIT,
    );
    match done {
        Some(done) if done.success => FirstAdmin::Made,
        Some(done) if String::from_utf8_lossy(&done.stderr).contains("refused the password") => {
            FirstAdmin::PasswordRefused
        }
        other => {
            let reason = other.map_or_else(
                || "it took too long".to_owned(),
                |done| String::from_utf8_lossy(&done.stderr).trim().to_owned(),
            );
            log_line(&format!(
                "the first administrator's login was not made: {reason}"
            ));
            FirstAdmin::Failed(
                "The sign-in service could not make your login, so nothing was saved. Try again."
                    .to_owned(),
            )
        }
    }
}

/// One line for the journal. This service has no logging crate.
fn log_line(line: &str) {
    drop(writeln!(std::io::stderr(), "{line}"));
}

/// Writes the name and role marker, then starts the services.
fn mark_and_start(hospital: &str) -> Result<(), String> {
    write_atomically(
        status::HOSPITAL_NAME,
        hospital.trim().as_bytes(),
        PUBLIC_FILE_MODE,
    )?;
    write_atomically(ROLE_MAIN, b"", PUBLIC_FILE_MODE)?;
    // The agent looks for a main machine until now; this machine is one.
    output("systemctl", &["stop", "medbrains-agent.service"]);
    output(
        "systemctl",
        &["start", "--no-block", "medbrains-main.target"],
    )
    .map(|_| ())
    .ok_or_else(|| "The services could not start. Try again.".to_owned())
}

/// Turns the machine off or restarts it. Who may ask is decided above this, in one place.
pub(crate) fn power(action: &str) -> Result<(), String> {
    let verb = power_verb(action).ok_or_else(|| "Unknown action.".to_owned())?;
    let done = child::run("systemctl", &[verb], USUAL_LIMIT);
    if done.as_ref().is_some_and(|done| done.success) {
        return Ok(());
    }
    // The real reason goes to the journal, the plain next step to the screen.
    let reason = done.map_or_else(
        || "no answer in time".to_owned(),
        |done| String::from_utf8_lossy(&done.stderr).trim().to_owned(),
    );
    log(&format!("systemctl {verb} failed: {reason}"));
    Err("The machine refused. Try again, or use its power button.".to_owned())
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
