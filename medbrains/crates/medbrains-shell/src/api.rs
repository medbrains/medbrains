//! The shell's one door to the machine: the setup service on loopback. Calls run on a
//! worker thread, so the screen never waits on the network.

use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::time::Duration;

use gtk4::{gio, glib};
use serde::Deserialize;
use serde::de::DeserializeOwned;
use serde_json::Value;

const SERVICE: &str = "127.0.0.1:3100";
const TOKEN_FILE: &str = "/run/medbrains-console/setup-token";
/// Long enough for a new main machine to create its database while the screen waits.
const TIMEOUT: Duration = Duration::from_secs(60);
/// Said when the service cannot be asked at all. A fault, so never shown as "no network".
const NOT_ANSWERING: &str = "The machine's setup service is not answering. Try again in a moment.";

/// One network link.
#[derive(Debug, Clone, Default, Deserialize)]
pub(crate) struct Link {
    pub(crate) name: String,
    pub(crate) cable: bool,
    pub(crate) addresses: Vec<String>,
}

/// The network as the service sees it. `local` and `internet` are `None` until checked.
#[derive(Debug, Clone, Default, Deserialize)]
pub(crate) struct Network {
    pub(crate) links: Vec<Link>,
    pub(crate) gateway: Option<String>,
    pub(crate) wifi: bool,
    pub(crate) fixed: bool,
    pub(crate) local: Option<bool>,
    pub(crate) internet: Option<bool>,
}

/// The machine's health figures.
#[derive(Debug, Clone, Default, Deserialize)]
pub(crate) struct Machine {
    pub(crate) system: String,
    pub(crate) memory_total_kb: u64,
    pub(crate) memory_available_kb: u64,
    pub(crate) load: String,
    pub(crate) uptime_seconds: u64,
    pub(crate) disk_total: u64,
    pub(crate) disk_used: u64,
}

/// One poll of the machine: everything the desktop shows.
#[derive(Debug, Clone, Default, Deserialize)]
pub(crate) struct State {
    pub(crate) set_up: bool,
    pub(crate) main_ready: bool,
    pub(crate) clock_synced: bool,
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
    let token = std::fs::read_to_string(TOKEN_FILE).ok()?;
    let address: SocketAddr = SERVICE.parse().ok()?;
    let mut stream = TcpStream::connect_timeout(&address, TIMEOUT).ok()?;
    stream.set_read_timeout(Some(TIMEOUT)).ok()?;
    stream.set_write_timeout(Some(TIMEOUT)).ok()?;
    let length = body.len();
    let request = format!(
        "{method} {path} HTTP/1.1\r\nHost: {SERVICE}\r\nX-Setup-Token: {}\r\n\
         Content-Length: {length}\r\n\r\n{body}",
        token.trim()
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
    use super::{Failure, State, outcome, parse_answer};
    use serde_json::json;

    #[test]
    fn an_answer_is_split_into_status_and_body() {
        let raw = "HTTP/1.1 422 X\r\nContent-Length: 2\r\n\r\n{}";
        assert_eq!(parse_answer(raw), Some((422, json!({}))));
        assert_eq!(parse_answer("garbage"), None);
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

    /// This is the service's real answer; a renamed field would otherwise show as blank.
    #[test]
    fn the_shell_understands_the_services_state() {
        let state: Result<State, _> = serde_json::from_value(json!({
            "set_up": true, "main_ready": false, "clock_synced": false,
            "machine": { "system": "running", "memory_total_kb": 10, "memory_available_kb": 5,
                         "load": "0.1", "uptime_seconds": 9, "disk_total": 8, "disk_used": 2 },
            "network": { "links": [{ "name": "en0", "cable": true, "addresses": ["10.0.2.15"] }],
                         "gateway": null, "wifi": false, "fixed": false },
        }));
        assert!(
            state.is_ok_and(|s| s.set_up && s.network.links[0].cable && s.network.local.is_none())
        );
    }
}
