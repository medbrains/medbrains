//! Setup and machine controls for the OS screen (OS-SETUP-AND-TRUST §5).
//!
//! Listens on a Unix socket only the screen's group can open, so nothing on the network or under
//! another local user can reach it, and no local user can stand in for it: a TCP port would let any
//! of them bind it while this restarts and receive what the screen sends. `peer` then checks who
//! connected, since WebKit's helpers share the screen's group. The server is
//! deliberately small: one connection at a time is plenty for one screen.

mod child;
mod machine;
mod node;
mod peer;
mod rules;
mod status;
mod wifi;
mod wifi_parse;

use std::fs;
use std::io::{self, Read, Write};
use std::os::unix::fs::PermissionsExt;
use std::os::unix::net::{UnixListener, UnixStream};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use zeroize::{Zeroize, Zeroizing};

use serde_json::{Value, json};

/// In a directory only root and the screen's group can enter; the socket's mode says the same.
const SOCKET: &str = "/run/medbrains-console/setup.sock";
const SCREEN_GROUP: &str = "kiosk";
const MAX_BODY: usize = 16 * 1024;
const MAX_HEADERS: usize = 64;
/// The most one request may send, headers included: read before anything else is checked.
const MAX_REQUEST: u64 = MAX_BODY as u64 + 8192;
/// How long one connection gets, in total, however slowly it sends.
const REQUEST_DEADLINE: Duration = Duration::from_secs(5);
/// A fixed address not confirmed in this time is undone, so a mistake cannot strand the machine.
const CONFIRM_WITHIN: Duration = Duration::from_secs(60);

/// Shared between the listener and the rollback timer.
#[derive(Debug)]
struct State {
    /// Bumped by each change and each confirmation; a rollback only runs if it still matches.
    network_change: AtomicU64,
    /// True while a new fixed address waits to be confirmed. Confirming anything else would say
    /// "kept" about an address that had already been undone.
    network_pending: AtomicBool,
    /// The latest Wi-Fi join, which runs on its own thread.
    wifi_attempt: Arc<Mutex<wifi::Attempt>>,
}

/// One parsed request.
#[derive(Debug)]
struct Request {
    method: String,
    path: String,
    body: Zeroizing<Vec<u8>>,
}

/// A connection that stops reading at a deadline for the whole request, not per read, so sending
/// one byte at a time can't hold the only thread.
#[derive(Debug)]
struct Deadlined<'a> {
    stream: &'a UnixStream,
    deadline: Instant,
}

impl Read for Deadlined<'_> {
    fn read(&mut self, buffer: &mut [u8]) -> io::Result<usize> {
        let left = self.deadline.saturating_duration_since(Instant::now());
        if left.is_zero() {
            return Err(io::ErrorKind::TimedOut.into());
        }
        self.stream.set_read_timeout(Some(left))?;
        let mut stream = self.stream;
        stream.read(buffer)
    }
}

/// One line of the request head, read a byte at a time so no buffer holds what follows it: the body may be a
/// password, and only its own wiped vector may hold it. The head is a few hundred bytes, so this costs nothing.
fn read_head_line(reader: &mut impl Read) -> Option<String> {
    let mut line = Vec::new();
    let mut byte = [0_u8; 1];
    while reader.read(&mut byte).ok()? == 1 {
        line.push(byte[0]);
        if byte[0] == b'\n' {
            break;
        }
    }
    String::from_utf8(line).ok()
}

/// Reads one request, refusing anything oversized. Everything is bounded by `MAX_REQUEST`.
fn read_request(stream: impl Read) -> Option<Request> {
    let mut reader = stream.take(MAX_REQUEST);
    let line = read_head_line(&mut reader)?;
    let mut parts = line.split_whitespace();
    let (method, path) = (parts.next()?.to_owned(), parts.next()?.to_owned());
    let mut length = 0_usize;
    for _ in 0..MAX_HEADERS {
        let header = read_head_line(&mut reader)?;
        if header.trim().is_empty() {
            let mut body = Zeroizing::new(vec![0; length]);
            reader.read_exact(&mut body).ok()?;
            return Some(Request { method, path, body });
        }
        let (name, value) = header.split_once(':')?;
        if name.trim().eq_ignore_ascii_case("content-length") {
            length = value.trim().parse().ok().filter(|n| *n <= MAX_BODY)?;
        }
    }
    None
}

/// Writes a JSON answer.
fn respond(mut stream: &UnixStream, status: u16, body: &Value) {
    let text = body.to_string();
    let head = format!(
        "HTTP/1.1 {status} X\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\
         Cache-Control: no-store\r\nConnection: close\r\n\r\n",
        text.len()
    );
    // The screen retries on its next poll if this fails.
    drop(
        stream
            .write_all(head.as_bytes())
            .and_then(|()| stream.write_all(text.as_bytes())),
    );
}

/// A text field of a JSON body, or empty.
fn field<'a>(body: &'a Value, key: &str) -> &'a str {
    body.get(key).and_then(Value::as_str).unwrap_or("")
}

/// The three fields' problems as a JSON answer, or `None` if there are none.
fn hospital_problems(body: &Value) -> Option<(u16, Value)> {
    let problems = rules::check_new_hospital(
        field(body, "hospital"),
        field(body, "username"),
        field(body, "password"),
    );
    if problems.is_empty() {
        return None;
    }
    let map: serde_json::Map<String, Value> = problems
        .into_iter()
        .map(|(k, v)| (k.to_owned(), json!(v)))
        .collect();
    Some((422, json!({ "problems": map })))
}

/// Handles `POST /hospital`: checks the three fields, then starts the main machine.
fn new_hospital(body: &Value) -> (u16, Value) {
    match machine::is_set_up() {
        Ok(false) => {}
        Ok(true) => return (409, json!({ "error": "This machine is already set up." })),
        // Not knowing is not "no": setting up twice would overwrite the machine's identity.
        Err(error) => return (500, json!({ "error": error })),
    }
    if let Some(problems) = hospital_problems(body) {
        return problems;
    }
    // Before anything else, and safe to repeat: until the marker below exists, setup can run again.
    match machine::make_first_admin(field(body, "username"), field(body, "password")) {
        machine::FirstAdmin::Made | machine::FirstAdmin::NoProviderOnThisDisk => {}
        machine::FirstAdmin::PasswordRefused => {
            return (
                422,
                json!({ "problems": { "password": rules::PASSWORD_RULE } }),
            );
        }
        machine::FirstAdmin::Failed(error) => return (500, json!({ "error": error })),
    }
    let started = machine::start_main_machine(
        field(body, "hospital"),
        field(body, "username"),
        field(body, "password"),
    );
    answer(500, started)
}

/// Handles `POST /node/finish`: this machine has been approved, so it becomes a node.
fn finish_node() -> (u16, Value) {
    match machine::is_set_up() {
        Ok(false) => answer(500, node::finish_node()),
        Ok(true) => (409, json!({ "error": "This machine is already set up." })),
        // Not knowing is not "no".
        Err(error) => (500, json!({ "error": error })),
    }
}

/// Turns the result of a machine action into an answer.
fn answer(failed_status: u16, result: Result<(), String>) -> (u16, Value) {
    match result {
        Ok(()) => (200, json!({ "ok": true })),
        Err(error) => (failed_status, json!({ "error": error })),
    }
}

/// Handles `POST /network/fixed`, and arranges the rollback if it is never confirmed.
fn fixed_address(state: &Arc<State>, body: &Value) -> (u16, Value) {
    let applied = machine::apply_fixed_address(
        field(body, "interface"),
        field(body, "address"),
        field(body, "gateway"),
        field(body, "dns"),
    );
    if let Err(error) = applied {
        return (422, json!({ "error": error }));
    }
    let change = state.network_change.fetch_add(1, Ordering::SeqCst) + 1;
    state.network_pending.store(true, Ordering::SeqCst);
    let timer = Arc::clone(state);
    std::thread::spawn(move || {
        std::thread::sleep(CONFIRM_WITHIN);
        if timer.network_change.load(Ordering::SeqCst) == change {
            timer.network_pending.store(false, Ordering::SeqCst);
            machine::log_if_failed(
                "undoing an unconfirmed address",
                machine::undo_fixed_address(),
            );
        }
    });
    (
        200,
        json!({ "confirm_within_seconds": CONFIRM_WITHIN.as_secs() }),
    )
}

/// Answers Keep or Undo, which only mean something while a new address is waiting. After the
/// timer, Keep would save whatever is in effect by then and report it as the new address.
fn settle_pending(state: &State, action: fn() -> Result<(), String>) -> (u16, Value) {
    if !state.network_pending.swap(false, Ordering::SeqCst) {
        let words = "No address is waiting. If one was, it has already been undone.";
        return (409, json!({ "error": words }));
    }
    state.network_change.fetch_add(1, Ordering::SeqCst);
    answer(409, action())
}

/// Forgets any fixed address, cancelling a waiting rollback.
fn use_automatic(state: &State) -> (u16, Value) {
    state.network_pending.store(false, Ordering::SeqCst);
    state.network_change.fetch_add(1, Ordering::SeqCst);
    answer(409, machine::use_automatic_address())
}

/// Handles `POST /wifi/power`. It must say on or off: a damaged request mustn't turn the radio off.
fn wifi_power(body: &Value) -> (u16, Value) {
    match body.get("on").and_then(Value::as_bool) {
        Some(on) => answer(422, wifi::set_power(on)),
        None => (
            422,
            json!({ "error": "Say whether Wi-Fi should be on or off." }),
        ),
    }
}

/// The machine's state, or a fault if whether it is set up can't be read.
fn state_answer() -> (u16, Value) {
    status::state().map_or_else(
        |error| (500, json!({ "error": error })),
        |state| (200, state),
    )
}

/// Routes one request, then wipes every string the body held: passwords are among them.
fn route(state: &Arc<State>, request: &Request) -> (u16, Value) {
    let mut body: Value = serde_json::from_slice(&request.body).unwrap_or(Value::Null);
    let answer = route_body(state, request, &body);
    scrub(&mut body);
    answer
}

/// Overwrites every string in a parsed body before it is dropped.
fn scrub(value: &mut Value) {
    match value {
        Value::String(text) => text.zeroize(),
        Value::Array(items) => items.iter_mut().for_each(scrub),
        Value::Object(fields) => fields.values_mut().for_each(scrub),
        _ => {}
    }
}

/// Answers one request from its parsed body.
fn route_body(state: &Arc<State>, request: &Request, body: &Value) -> (u16, Value) {
    match (request.method.as_str(), request.path.as_str()) {
        ("GET", "/state") => state_answer(),
        ("GET", "/timezones") => (200, json!(status::timezones())),
        ("POST", "/timezone") => answer(422, status::set_timezone(field(body, "zone"))),
        ("GET", "/network") => (200, machine::network_check()),
        ("POST", "/hospital/check") => {
            hospital_problems(body).unwrap_or_else(|| (200, json!({ "ok": true })))
        }
        ("POST", "/hospital") => new_hospital(body),
        ("POST", "/node/finish") => finish_node(),
        ("POST", "/network/fixed") => fixed_address(state, body),
        ("POST", "/network/confirm") => settle_pending(state, machine::confirm_fixed_address),
        ("POST", "/network/undo") => settle_pending(state, machine::undo_fixed_address),
        ("POST", "/network/automatic") => use_automatic(state),
        ("POST", "/network/prefer") => answer(422, machine::prefer_link(field(body, "interface"))),
        ("GET", "/wifi") => (200, wifi::status(&state.wifi_attempt)),
        ("POST", "/wifi/power") => wifi_power(body),
        ("POST", "/wifi/scan") => answer(422, wifi::scan()),
        ("POST", "/wifi/connect") => answer(
            409,
            wifi::connect(
                &state.wifi_attempt,
                field(body, "ssid"),
                field(body, "password"),
            ),
        ),
        ("POST", "/wifi/forget") => {
            answer(422, wifi::forget(&state.wifi_attempt, field(body, "ssid")))
        }
        ("POST", "/power") => answer(422, machine::power(field(body, "action"))),
        _ => (404, json!({ "error": "not found" })),
    }
}

/// Serves one connection, within its deadline.
fn handle(state: &Arc<State>, stream: &UnixStream) {
    drop(stream.set_write_timeout(Some(REQUEST_DEADLINE)));
    if !peer::is_screen(stream) {
        return respond(
            stream,
            403,
            &json!({ "error": "Only the screen may ask this." }),
        );
    }
    let deadline = Instant::now() + REQUEST_DEADLINE;
    let Some(request) = read_request(Deadlined { stream, deadline }) else {
        return;
    };
    let (status, body) = route(state, &request);
    respond(stream, status, &body);
}

/// Opens the socket: only root and the screen's group may connect. A socket left by the last run
/// is removed first, and the directory above keeps everyone else out until the mode is set.
fn listen() -> io::Result<UnixListener> {
    if let Err(error) = fs::remove_file(SOCKET)
        && error.kind() != io::ErrorKind::NotFound
    {
        return Err(error);
    }
    let listener = UnixListener::bind(SOCKET)?;
    let group = child::run("chgrp", &[SCREEN_GROUP, SOCKET], child::USUAL_LIMIT);
    if !group.is_some_and(|done| done.success) {
        return Err(io::Error::other(
            "could not give the socket to the screen's group",
        ));
    }
    fs::set_permissions(SOCKET, fs::Permissions::from_mode(0o660))?;
    Ok(listener)
}

/// Puts things right, then serves the screen forever.
fn main() -> io::Result<()> {
    machine::log_if_failed(
        "undoing an address left unconfirmed",
        machine::reconcile_fixed_address(),
    );
    machine::log_if_failed(
        "removing an abandoned setup",
        machine::remove_abandoned_seed(),
    );
    machine::start_identity_for_setup();
    let state = Arc::new(State {
        network_change: AtomicU64::new(0),
        network_pending: AtomicBool::new(false),
        wifi_attempt: Arc::default(),
    });
    let listener = listen()?;
    // Meant to run forever: systemd restarts it if it ends.
    for stream in listener.incoming().flatten() {
        handle(&state, &stream);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{MAX_REQUEST, State, read_request, settle_pending, wifi_power};
    use serde_json::json;
    use std::io::Read;
    use std::sync::Arc;
    use std::sync::atomic::{AtomicBool, AtomicU64};

    #[test]
    fn a_request_is_parsed_and_an_oversized_one_refused() {
        let good = "POST /power HTTP/1.1\r\nHost: h\r\nContent-Length: 2\r\n\r\n{}";
        let parsed = read_request(good.as_bytes());
        assert!(parsed.is_some_and(|r| r.path == "/power" && *r.body == b"{}"));
        let huge = "POST / HTTP/1.1\r\nContent-Length: 99999999\r\n\r\n";
        assert!(read_request(huge.as_bytes()).is_none());
    }

    /// The finding: a request line with no end must not be read into memory without limit.
    #[test]
    fn an_endless_line_stops_at_the_limit() {
        let endless = std::io::repeat(b'a');
        assert!(read_request(endless).is_none());
        let mut bounded = std::io::repeat(b'a').take(MAX_REQUEST * 2);
        let mut seen = Vec::new();
        assert!(
            (&mut bounded)
                .take(MAX_REQUEST)
                .read_to_end(&mut seen)
                .is_ok()
        );
        assert_eq!(seen.len() as u64, MAX_REQUEST);
    }

    /// The finding: after the timer, Keep would have reported the wrong address as kept.
    #[test]
    fn keep_with_nothing_waiting_is_refused_and_does_nothing() {
        let state = State {
            network_change: AtomicU64::new(0),
            network_pending: AtomicBool::new(false),
            wifi_attempt: Arc::default(),
        };
        let (status, _) = settle_pending(&state, panic_free_failure);
        assert_eq!(status, 409);
    }

    /// Stands in for an action that must not be reached.
    fn panic_free_failure() -> Result<(), String> {
        Err("reached".to_owned())
    }

    /// A damaged request must not turn the radio off.
    #[test]
    fn a_radio_request_without_on_or_off_is_refused() {
        for body in [json!({}), json!({ "on": "yes" }), serde_json::Value::Null] {
            assert_eq!(wifi_power(&body).0, 422);
        }
    }

    /// A parsed body's strings, the password among them, are wiped, however deep they sit.
    #[test]
    fn every_string_in_a_body_is_wiped() {
        let mut body = json!({ "password": "Blue-River-Walks-At-7!", "list": [{ "inner": "secret" }], "n": 3 });
        super::scrub(&mut body);
        assert_eq!(body["password"], "");
        assert_eq!(body["list"][0]["inner"], "");
        assert_eq!(body["n"], 3);
    }
}
