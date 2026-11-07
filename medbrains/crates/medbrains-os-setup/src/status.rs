//! What the desktop shows, read from the machine. Every figure is a real check, and this
//! module sends nothing off the machine, so polling it is safe.

use std::fs;
use std::path::Path;

use serde_json::{Value, json};

use crate::child::{self, USUAL_LIMIT};
use crate::machine::{self, output};

/// The current time zone setting: a link into `ZONEINFO`, on the data partition. World
/// readable, because `/etc/localtime` points here and every user needs the answer.
const LOCALTIME: &str = "/var/lib/medbrains-settings/localtime";
const ZONEINFO: &str = "/usr/share/zoneinfo/";
const ZONE_LIST: &str = "/usr/share/zoneinfo/zone1970.tab";
/// How long a boot may look for a time server before "checking" becomes a warning. First
/// contact over NTS takes several seconds, and a slow network longer.
const CLOCK_PATIENCE_SECONDS: u64 = 300;
const SERVER_HEALTH: &str = "http://127.0.0.1:3000/api/health";
/// The main machine's health, as this machine's screen reaches it, through the agent.
const FRONT_HEALTH: &str = "https://127.0.0.1:8443/api/health";
const DATA_MOUNT: &str = "/var";
/// How setup protected the data disk, written by `disk-setup`.
const DISK_PROTECTION: &str = "/var/lib/medbrains/config/disk-protection";
/// `local stratum 10` in `chrony.conf`: the clock of a machine with nothing to set it by.
const UNCONFIRMED_STRATUM: u32 = 10;
const FIREWALL_TABLE: [&str; 5] = ["-n", "list", "table", "inet", "medbrains"];
/// Where setup keeps the hospital's name for the screen.
pub(crate) const HOSPITAL_NAME: &str = "/var/lib/medbrains-settings/hospital-name";

/// Everything the desktop shows in one poll, or a fault if the machine can't read what it is.
pub(crate) fn state() -> Result<Value, String> {
    let set_up = machine::is_set_up()?;
    let uptime = fs::read_to_string("/proc/uptime").unwrap_or_default();
    let uptime_seconds = first_number(&uptime);
    let node = machine::is_node();
    Ok(json!({
        "set_up": set_up,
        "role": role_word(set_up, node),
        "hospital": fs::read_to_string(HOSPITAL_NAME).unwrap_or_default().trim(),
        "main_ready": set_up && app_answers(node),
        "clock": clock_state(uptime_seconds, node),
        "timezone": timezone(),
        "firewall": output("nft", &FIREWALL_TABLE).is_some(),
        "disk": disk_protection(),
        "machine": machine_health(),
        "network": machine::network_links(),
    }))
}

/// How the data disk is protected, or `unknown` if the record cannot be read: a fault must not
/// read as a disk that is fine.
fn disk_protection() -> String {
    fs::read_to_string(DISK_PROTECTION)
        .map_or_else(|_| "unknown".to_owned(), |text| text.trim().to_owned())
}

/// What this machine is, for the screen.
const fn role_word(set_up: bool, node: bool) -> &'static str {
    match (set_up, node) {
        (true, true) => "node",
        (true, false) => "main",
        (false, _) => "",
    }
}

/// Whether the app answers: the server here on a main machine, the main machine through the agent
/// on a node. So a removed or cut-off node says so.
fn app_answers(node: bool) -> bool {
    if node {
        let certificate = crate::node::SCREEN_CERTIFICATE;
        let args = ["-fsS", "-m", "3", "--cacert", certificate, "-o", "/dev/null", FRONT_HEALTH];
        return output("curl", &args).is_some();
    }
    output("curl", &["-fsS", "-m", "2", "-o", "/dev/null", SERVER_HEALTH]).is_some()
}

/// The zone setting's name, or `UTC` if it was never set.
pub(crate) fn timezone() -> String {
    fs::read_link(LOCALTIME)
        .ok()
        .and_then(|target| target.to_str()?.strip_prefix(ZONEINFO).map(str::to_owned))
        .unwrap_or_else(|| "UTC".to_owned())
}

/// Sets the time zone by replacing the link in one step.
pub(crate) fn set_timezone(zone: &str) -> Result<(), String> {
    if !is_zone_name(zone) || !Path::new(ZONEINFO).join(zone).is_file() {
        return Err("Choose a time zone from the list.".to_owned());
    }
    let temporary = format!("{LOCALTIME}.new");
    drop(fs::remove_file(&temporary));
    std::os::unix::fs::symlink(format!("{ZONEINFO}{zone}"), &temporary)
        .and_then(|()| fs::rename(&temporary, LOCALTIME))
        .and_then(|()| machine::sync_parent(LOCALTIME))
        .map_err(|e| e.to_string())
}

/// True for a zone name that cannot climb out of the zone directory.
fn is_zone_name(zone: &str) -> bool {
    !zone.is_empty()
        && !zone.starts_with('/')
        && !zone
            .split('/')
            .any(|part| part.is_empty() || part.starts_with('.'))
        && zone
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || "/_+-".contains(c))
}

/// Every zone people choose from, sorted, for the time zone list.
pub(crate) fn timezones() -> Vec<String> {
    let mut zones = parse_zone_list(&fs::read_to_string(ZONE_LIST).unwrap_or_default());
    zones.push("UTC".to_owned());
    zones.sort_unstable();
    zones
}

/// The zone names from `zone1970.tab`: the third column of each line that isn't a comment.
fn parse_zone_list(tab: &str) -> Vec<String> {
    tab.lines()
        .filter(|line| !line.starts_with('#'))
        .filter_map(|line| line.split('\t').nth(2).map(str::to_owned))
        .collect()
}

/// "verified", "checking" or "unconfirmed". Verified needs a synced source using NTS.
fn clock_state(uptime_seconds: u64, node: bool) -> &'static str {
    let read = |args: &[&str]| {
        output("chronyc", args).map(|raw| String::from_utf8_lossy(&raw).into_owned())
    };
    let (sources, authdata) = (
        read(&["-n", "-c", "sources"]),
        read(&["-n", "-c", "authdata"]),
    );
    let chrony_answers = sources.is_some();
    let verified = if node {
        sources.is_some_and(|sources| has_synced_main_source(&sources))
    } else {
        sources
            .zip(authdata)
            .is_some_and(|(sources, authdata)| has_synced_nts_source(&sources, &authdata))
    };
    clock_word(verified, chrony_answers, uptime_seconds)
}

/// Decides the word. Waiting is neutral until there has been time to do better; a chrony
/// that doesn't answer at all is a real failure at once.
const fn clock_word(verified: bool, chrony_answers: bool, uptime_seconds: u64) -> &'static str {
    if verified {
        "verified"
    } else if chrony_answers && uptime_seconds < CLOCK_PATIENCE_SECONDS {
        "checking"
    } else {
        "unconfirmed"
    }
}

/// True if a node's chrony has selected the main machine, on loopback through the agent, and that
/// clock is set by something real. The key authenticates it. A main machine serving only its own
/// `local` clock answers stratum 10, and neither it nor its nodes can vouch for the time.
fn has_synced_main_source(sources: &str) -> bool {
    sources.lines().any(|line| {
        let mut fields = line.split(',');
        let (_, state, address) = (fields.next(), fields.next(), fields.next());
        let stratum = fields.next().and_then(|s| s.parse::<u32>().ok());
        state == Some("*")
            && address == Some("127.0.0.1")
            && stratum.is_some_and(|s| s < UNCONFIRMED_STRATUM)
    })
}

/// True if the source chrony selected (`^,*,address,…`) is listed as NTS in `authdata`.
fn has_synced_nts_source(sources: &str, authdata: &str) -> bool {
    let selected = sources.lines().find_map(|line| {
        let mut fields = line.split(',');
        let (_, state, address) = (fields.next()?, fields.next()?, fields.next()?);
        (state == "*").then_some(address)
    });
    selected.is_some_and(|address| {
        authdata.lines().any(|line| {
            let mut fields = line.split(',');
            fields.next() == Some(address) && fields.next() == Some("NTS")
        })
    })
}

/// Memory, disk, the services' overall state and which of them failed.
fn machine_health() -> Value {
    let meminfo = fs::read_to_string("/proc/meminfo").unwrap_or_default();
    let df = output("df", &["-B1", "--output=size,used", DATA_MOUNT]).unwrap_or_default();
    let (disk_total, disk_used) = parse_df(&String::from_utf8_lossy(&df)).unwrap_or((0, 0));
    // `is-system-running` exits non-zero when degraded, and that is the answer we want.
    let system = child::run("systemctl", &["is-system-running"], USUAL_LIMIT)
        .map_or_else(String::new, |done| {
            String::from_utf8_lossy(&done.stdout).trim().to_owned()
        });
    let failed = output(
        "systemctl",
        &["--failed", "--plain", "--no-legend", "--no-pager"],
    )
    .map_or_else(Vec::new, |raw| parse_failed(&String::from_utf8_lossy(&raw)));
    json!({
        "system": system,
        "failed": failed,
        "memory_total_kb": meminfo_kb(&meminfo, "MemTotal"),
        "memory_available_kb": meminfo_kb(&meminfo, "MemAvailable"),
        "disk_total": disk_total,
        "disk_used": disk_used,
    })
}

/// The unit names from `systemctl --failed --plain`: the first word of each line.
fn parse_failed(text: &str) -> Vec<String> {
    text.lines()
        .filter_map(|line| line.split_whitespace().next().map(str::to_owned))
        .collect()
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

#[cfg(test)]
mod tests {
    use super::{
        clock_word, first_number, has_synced_nts_source, is_zone_name, meminfo_kb, parse_df,
        parse_failed, parse_zone_list,
    };

    const NTS: &str = "162.159.200.1,NTS,1,15,256,33d,0,0,8,100\n";

    /// "Verified" is a promise about the record's clock, so a plain NTP source never earns it.
    #[test]
    fn only_a_selected_nts_source_counts_as_verified() {
        let selected = "^,*,162.159.200.1,3,6,377,1,0.1,0.1,0.1\n^,-,10.0.0.1,2,6,377,1,0,0,0\n";
        assert!(has_synced_nts_source(selected, NTS));
        let other_selected = "^,*,10.0.0.1,2,6,377,1,0,0,0\n^,-,162.159.200.1,3,6,377,1,0,0,0\n";
        assert!(!has_synced_nts_source(other_selected, NTS));
        let none_selected = "^,?,162.159.200.1,0,6,0,1,0,0,0\n";
        assert!(!has_synced_nts_source(none_selected, NTS));
        assert!(!has_synced_nts_source(
            selected,
            "162.159.200.1,-,0,0,0,0,0,0,0,0\n"
        ));
    }

    /// Seconds after boot must not read as a fault, nor must a long failure read as waiting.
    #[test]
    fn a_node_trusts_its_main_machines_clock_only_if_that_is_set_by_something() {
        use super::has_synced_main_source as synced;
        assert!(synced("^,*,127.0.0.1,3,4,377,5,0.1,0.1,0.1,0.1\n"));
        assert!(!synced("^,*,127.0.0.1,11,4,377,5,0.1,0.1,0.1,0.1\n"), "its own clock, stratum 10");
        assert!(!synced("^,?,127.0.0.1,3,4,0,5,0.1,0.1,0.1,0.1\n"), "not selected");
        assert!(!synced("^,*,192.0.2.1,3,4,377,5,0.1,0.1,0.1,0.1\n"), "not through the agent");
        assert!(!synced(""));
    }

    #[test]
    fn the_role_is_said_only_once_set_up() {
        assert_eq!(super::role_word(false, false), "");
        assert_eq!(super::role_word(true, false), "main");
        assert_eq!(super::role_word(true, true), "node");
    }

    #[test]
    fn the_clock_waits_neutrally_then_warns() {
        assert_eq!(clock_word(true, true, 5), "verified");
        assert_eq!(clock_word(false, true, 5), "checking");
        assert_eq!(clock_word(false, true, 299), "checking");
        assert_eq!(clock_word(false, true, 300), "unconfirmed");
        assert_eq!(clock_word(false, false, 5), "unconfirmed");
    }

    #[test]
    fn a_zone_name_cannot_leave_the_zone_directory() {
        assert!(is_zone_name("Asia/Kolkata"));
        assert!(is_zone_name("America/Argentina/Buenos_Aires"));
        assert!(is_zone_name("UTC"));
        assert!(!is_zone_name("../../etc/passwd"));
        assert!(!is_zone_name("/etc/passwd"));
        assert!(!is_zone_name("Asia/.."));
        assert!(!is_zone_name(""));
        assert!(!is_zone_name("Asia/Kolkata\nx"));
    }

    #[test]
    fn health_figures_are_read_from_their_own_formats() {
        let meminfo = "MemTotal:        4015024 kB\nMemAvailable:    3000000 kB\n";
        assert_eq!(meminfo_kb(meminfo, "MemAvailable"), 3_000_000);
        assert_eq!(meminfo_kb(meminfo, "Mem"), 0);
        assert_eq!(first_number("86.13 300.2\n"), 86);
        assert_eq!(parse_df("1B-blocks Used\n 1000 200\n"), Some((1000, 200)));
        assert_eq!(parse_df(""), None);
        let failed = "caddy.service loaded failed failed Caddy\nx.mount loaded failed failed X\n";
        assert_eq!(parse_failed(failed), ["caddy.service", "x.mount"]);
        let zones = "# comment\nIN\t+2232+08822\tAsia/Kolkata\nAQ\t-6617\tAntarctica/Casey\tNote\n";
        assert_eq!(parse_zone_list(zones), ["Asia/Kolkata", "Antarctica/Casey"]);
    }
}
