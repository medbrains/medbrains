//! The shell's one door to the machine: the setup service on loopback. Calls run on a
//! worker thread, so the screen never waits on the network.

use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::os::unix::net::UnixStream;
use std::time::Duration;

use gtk4::{gio, glib};
use serde::Deserialize;
use serde::de::DeserializeOwned;
use serde_json::Value;

use crate::apps;

/// The setup service. A Unix socket, so nobody else on this machine can pretend to be it: the
/// screen sends it the first administrator's password and Wi-Fi passwords.
const SERVICE: &str = "/run/medbrains-console/setup.sock";
const HEALTH_TIMEOUT: Duration = Duration::from_secs(2);
const TIMEOUT: Duration = Duration::from_secs(10);
/// Said when the service cannot be asked at all. A fault, so never shown as "no network".
const NOT_ANSWERING: &str = "The machine's setup service is not answering. Try again in a moment.";

/// One network link.
#[derive(Debug, Clone, Default, Deserialize)]
pub(crate) struct Link {
    pub(crate) name: String,
    /// "ethernet" or "wifi".
    pub(crate) kind: String,
    pub(crate) cable: bool,
    pub(crate) addresses: Vec<String>,
    pub(crate) speed_mbps: Option<u64>,
}

/// The network as the service sees it. `local` and `internet` are `None` until checked.
#[derive(Debug, Clone, Default, Deserialize)]
pub(crate) struct Network {
    /// True if the machine couldn't read its links: unknown, not "no links".
    #[serde(default)]
    pub(crate) fault: bool,
    /// True while a fixed address is in effect that nobody has confirmed.
    #[serde(default)]
    pub(crate) unconfirmed: bool,
    pub(crate) links: Vec<Link>,
    pub(crate) gateway: Option<String>,
    /// The link the default route uses.
    pub(crate) default_link: Option<String>,
    /// The link chosen to be tried first, if any.
    pub(crate) preferred: Option<String>,
    pub(crate) fixed: bool,
    pub(crate) local: Option<bool>,
    pub(crate) internet: Option<bool>,
}

/// One Wi-Fi network in range.
#[derive(Debug, Clone, Default, Deserialize, PartialEq, Eq)]
pub(crate) struct WifiNetwork {
    pub(crate) ssid: String,
    pub(crate) secured: bool,
    pub(crate) enterprise: bool,
    pub(crate) saved: bool,
    pub(crate) connected: bool,
    /// 0 to 100.
    pub(crate) signal: u8,
}

/// The latest attempt to join a network.
#[derive(Debug, Clone, Default, Deserialize, PartialEq, Eq)]
#[serde(default)]
pub(crate) struct WifiAttempt {
    pub(crate) ssid: String,
    /// "connecting", "connected", "failed", or empty if none has been made.
    pub(crate) state: String,
    pub(crate) words: String,
}

/// Wi-Fi as the service sees it. No card, a card whose software doesn't answer, and a working card
/// are three different truths, so none of them can read as an empty list.
#[derive(Debug, Clone, Default, Deserialize, PartialEq, Eq)]
#[serde(default)]
pub(crate) struct Wifi {
    pub(crate) hardware: bool,
    pub(crate) fault: bool,
    pub(crate) powered: bool,
    pub(crate) scanning: bool,
    pub(crate) networks: Vec<WifiNetwork>,
    pub(crate) attempt: WifiAttempt,
}

/// The machine's health figures.
#[derive(Debug, Clone, Default, Deserialize)]
pub(crate) struct Machine {
    pub(crate) system: String,
    /// Names of the units that failed, shown on the screen.
    pub(crate) failed: Vec<String>,
    pub(crate) memory_total_kb: u64,
    pub(crate) memory_available_kb: u64,
    pub(crate) disk_total: u64,
    pub(crate) disk_used: u64,
}

/// One poll of the machine: everything the desktop shows.
#[derive(Debug, Clone, Default, Deserialize)]
pub(crate) struct State {
    pub(crate) set_up: bool,
    /// What this machine is: "main" once set up.
    pub(crate) role: String,
    /// The hospital's name, once setup has written it.
    pub(crate) hospital: String,
    pub(crate) main_ready: bool,
    /// "verified", "checking" or "unconfirmed".
    pub(crate) clock: String,
    pub(crate) timezone: String,
    pub(crate) firewall: bool,
    /// How the data disk is protected: "encrypted-tpm2", "encrypted-tpm2-pin",
    /// "unencrypted-chosen" or "unknown".
    pub(crate) disk: String,
    pub(crate) machine: Machine,
    pub(crate) network: Network,
}

/// Why a call did not succeed.
#[derive(Debug, Clone)]
pub(crate) enum Failure {
    /// A sentence for the screen.
    Message(String),
    /// Field name to problem, for a form.
    Problems(Vec<(String, String)>),
}

impl Failure {
    /// All of it as one sentence.
    pub(crate) fn text(&self) -> String {
        match self {
            Self::Message(text) => text.clone(),
            Self::Problems(list) => list
                .iter()
                .map(|(_, problem)| problem.as_str())
                .collect::<Vec<_>>()
                .join(" "),
        }
    }
}

/// Splits a raw HTTP answer into its status and JSON body.
fn parse_answer(raw: &str) -> Option<(u16, Value)> {
    let (head, body) = raw.split_once("\r\n\r\n")?;
    let status = head.split_whitespace().nth(1)?.parse().ok()?;
    Some((status, serde_json::from_str(body).ok()?))
}

/// Turns a status and body into the answer or the reason it failed.
fn outcome(status: u16, body: Value) -> Result<Value, Failure> {
    if (200..300).contains(&status) {
        return Ok(body);
    }
    if let Some(problems) = body.get("problems").and_then(Value::as_object) {
        let text = |value: &Value| value.as_str().unwrap_or_default().to_owned();
        return Err(Failure::Problems(
            problems.iter().map(|(k, v)| (k.clone(), text(v))).collect(),
        ));
    }
    let message = body
        .get("error")
        .and_then(Value::as_str)
        .unwrap_or(NOT_ANSWERING);
    Err(Failure::Message(message.to_owned()))
}

/// One blocking exchange with the service.
fn exchange(method: &str, path: &str, body: &str) -> Option<(u16, Value)> {
    let mut stream = UnixStream::connect(SERVICE).ok()?;
    stream.set_read_timeout(Some(TIMEOUT)).ok()?;
    stream.set_write_timeout(Some(TIMEOUT)).ok()?;
    let length = body.len();
    let request = format!(
        "{method} {path} HTTP/1.1\r\nHost: screen\r\nContent-Length: {length}\r\n\r\n{body}"
    );
    stream.write_all(request.as_bytes()).ok()?;
    let mut raw = String::new();
    stream.read_to_string(&mut raw).ok()?;
    parse_answer(&raw)
}

/// Makes a call on a worker thread and hands the result to the screen's thread.
fn call(
    method: &'static str,
    path: &'static str,
    body: String,
    done: impl FnOnce(Result<Value, Failure>) + 'static,
) {
    glib::spawn_future_local(async move {
        let answer = gio::spawn_blocking(move || exchange(method, path, &body)).await;
        let result = match answer {
            Ok(Some((status, value))) => outcome(status, value),
            Ok(None) | Err(_) => Err(Failure::Message(NOT_ANSWERING.to_owned())),
        };
        done(result);
    });
}

/// A GET whose answer is parsed into `T`.
fn get<T: DeserializeOwned + 'static>(
    path: &'static str,
    done: impl FnOnce(Result<T, Failure>) + 'static,
) {
    call("GET", path, String::new(), move |result| {
        done(result.and_then(|value| {
            serde_json::from_value(value).map_err(|_| Failure::Message(NOT_ANSWERING.to_owned()))
        }));
    });
}

/// Polls the machine. Sends nothing off the machine.
pub(crate) fn fetch_state(done: impl FnOnce(Result<State, Failure>) + 'static) {
    get("/state", done);
}

/// Checks the network, including one request to the internet. For the network screen only.
pub(crate) fn check_network(done: impl FnOnce(Result<Network, Failure>) + 'static) {
    get("/network", done);
}

/// The state of these units, in order, read without blocking the screen.
pub(crate) fn fetch_unit_states(units: Vec<String>, done: impl FnOnce(Vec<String>) + 'static) {
    glib::spawn_future_local(async move {
        let states = gio::spawn_blocking(move || apps::unit_states(&units)).await;
        done(states.unwrap_or_default());
    });
}

/// Reads Wi-Fi's state.
pub(crate) fn fetch_wifi(done: impl FnOnce(Result<Wifi, Failure>) + 'static) {
    get("/wifi", done);
}

/// The time zones people choose from.
pub(crate) fn fetch_timezones(done: impl FnOnce(Result<Vec<String>, Failure>) + 'static) {
    get("/timezones", done);
}

/// Whether an app is ready to open: its health address answers if it has one, otherwise its unit
/// is active, and with neither there is nothing to wait for. Asked directly, so the setup
/// service can't delay it.
pub(crate) fn app_answers(
    health: Option<String>,
    unit: Option<String>,
    done: impl FnOnce(bool) + 'static,
) {
    glib::spawn_future_local(async move {
        let answer = gio::spawn_blocking(move || match (health, unit) {
            (Some(health), _) => health_is_ok(&health),
            (None, Some(unit)) => apps::unit_states(std::slice::from_ref(&unit))
                .first()
                .is_some_and(|s| s == "active"),
            (None, None) => true,
        })
        .await;
        done(answer.unwrap_or(false));
    });
}

/// One blocking health request.
fn health_is_ok(health: &str) -> bool {
    let probe = || -> Option<bool> {
        let (host, path) = apps::health_target(health)?;
        let address: SocketAddr = host.parse().ok()?;
        let mut stream = TcpStream::connect_timeout(&address, HEALTH_TIMEOUT).ok()?;
        stream.set_read_timeout(Some(HEALTH_TIMEOUT)).ok()?;
        let request = format!("GET {path} HTTP/1.1\r\nHost: {host}\r\nConnection: close\r\n\r\n");
        stream.write_all(request.as_bytes()).ok()?;
        let mut head = [0_u8; 16];
        let read = stream.read(&mut head).ok()?;
        Some(is_ok_status(&head[..read]))
    };
    probe().unwrap_or(false)
}

/// True for an answer that begins with a 2xx status line.
fn is_ok_status(head: &[u8]) -> bool {
    String::from_utf8_lossy(head)
        .split_whitespace()
        .nth(1)
        .is_some_and(|code| code.starts_with('2'))
}

/// Sends a change to the machine.
pub(crate) fn post(
    path: &'static str,
    body: &Value,
    done: impl FnOnce(Result<Value, Failure>) + 'static,
) {
    call("POST", path, body.to_string(), done);
}

#[cfg(test)]
mod tests {
    use super::{Failure, State, Wifi, is_ok_status, outcome, parse_answer};
    use serde_json::json;

    #[test]
    fn an_answer_is_split_into_status_and_body() {
        let raw = "HTTP/1.1 422 X\r\nContent-Length: 2\r\n\r\n{}";
        assert_eq!(parse_answer(raw), Some((422, json!({}))));
        assert_eq!(parse_answer("garbage"), None);
    }

    #[test]
    fn only_a_2xx_answer_counts_as_healthy() {
        assert!(is_ok_status(b"HTTP/1.1 200 OK\r\n"));
        assert!(!is_ok_status(b"HTTP/1.1 503 Ser"));
        assert!(!is_ok_status(b""));
    }

    /// The form shows each problem beside its own field, so the mapping must survive.
    #[test]
    fn field_problems_stay_attached_to_their_fields() {
        let body = json!({ "problems": { "password": "Too short." } });
        match outcome(422, body) {
            Err(Failure::Problems(list)) => {
                assert_eq!(list, vec![("password".to_owned(), "Too short.".to_owned())]);
            }
            other => assert!(matches!(other, Err(Failure::Problems(_))), "{other:?}"),
        }
        let refused = outcome(409, json!({ "error": "Already set up." }));
        assert!(refused.is_err_and(|f| f.text() == "Already set up."));
        assert!(outcome(200, json!({ "ok": true })).is_ok());
    }

    /// These are the three answers the service gives; "no card" must not read as "no networks".
    #[test]
    fn the_three_wifi_truths_stay_apart() {
        let read = |body| serde_json::from_value::<Wifi>(body).unwrap_or_default();
        let none = read(json!({ "hardware": false, "attempt": {} }));
        assert!(!none.hardware);
        let broken = read(json!({ "hardware": true, "fault": true, "attempt": {} }));
        assert!(broken.hardware && broken.fault);
        let working = read(
            json!({ "hardware": true, "powered": true, "scanning": false,
            "networks": [{ "ssid": "Ward", "secured": true, "enterprise": false, "saved": false,
                           "connected": false, "signal": 60 }],
            "attempt": { "ssid": "", "state": "", "words": "" } }),
        );
        assert_eq!(working.networks[0].ssid, "Ward");
    }

    /// This is the service's real answer; a renamed field would otherwise show as blank.
    #[test]
    fn the_shell_understands_the_services_state() {
        let state: Result<State, _> = serde_json::from_value(json!({
            "set_up": true, "role": "main", "hospital": "City", "main_ready": false, "clock": "checking",
            "timezone": "Asia/Kolkata", "firewall": true, "disk": "encrypted-tpm2",
            "machine": { "system": "running", "failed": [], "memory_total_kb": 10, "memory_available_kb": 5,  "disk_total": 8, "disk_used": 2 },
            "network": { "links": [{ "name": "en0", "kind": "ethernet", "cable": true, "addresses": ["10.0.2.15"], "speed_mbps": 1000 }],
                         "gateway": null, "default_link": null, "preferred": null, "fixed": false },
        }));
        assert!(
            state.is_ok_and(|s| s.set_up && s.network.links[0].cable && s.network.local.is_none())
        );
    }
}
