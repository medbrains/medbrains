//! Setup and machine controls for the OS screen (OS-SETUP-AND-TRUST §5).
//!
//! Listens only on the machine itself. Every call needs a token that is written where only
//! the screen can read it, so nobody on the network can finish setup or power the machine
//! off, and the Host check stops a web page reaching this through DNS rebinding. The server
//! is deliberately small: one connection at a time is plenty for one screen.

mod machine;
mod rules;

use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

use serde_json::{Value, json};

const LISTEN: &str = "127.0.0.1:3100";
const TOKEN_FILE: &str = "/run/medbrains-console/setup-token";
const MAX_BODY: usize = 16 * 1024;
const MAX_HEADERS: usize = 64;
const IO_TIMEOUT: Duration = Duration::from_secs(5);
/// A fixed address not confirmed in this time is undone, so a mistake cannot strand the machine.
const CONFIRM_WITHIN: Duration = Duration::from_secs(60);

/// Shared between the listener and the rollback timer.
#[derive(Debug)]
struct State {
    token: String,
    /// Bumped by each change and each confirmation; a rollback only runs if it still matches.
    network_change: AtomicU64,
}

/// One parsed request.
#[derive(Debug)]
struct Request {
    method: String,
    path: String,
    host: String,
    token: String,
    body: Vec<u8>,
}

/// Reads one request, refusing anything oversized.
fn read_request(stream: impl Read) -> Option<Request> {
    let mut reader = BufReader::new(stream);
    let mut line = String::new();
    reader.read_line(&mut line).ok()?;
    let mut parts = line.split_whitespace();
    let (method, path) = (parts.next()?.to_owned(), parts.next()?.to_owned());
    let (mut host, mut token, mut length) = (String::new(), String::new(), 0_usize);
    for _ in 0..MAX_HEADERS {
        let mut header = String::new();
        reader.read_line(&mut header).ok()?;
        if header.trim().is_empty() {
            let mut body = vec![0; length];
            reader.read_exact(&mut body).ok()?;
            return Some(Request {
                method,
                path,
                host,
                token,
                body,
            });
        }
        let (name, value) = header.split_once(':')?;
        match name.trim().to_ascii_lowercase().as_str() {
            "host" => value.trim().clone_into(&mut host),
            "x-setup-token" => value.trim().clone_into(&mut token),
            "content-length" => length = value.trim().parse().ok().filter(|n| *n <= MAX_BODY)?,
            _ => {}
        }
    }
    None
}

/// Writes a JSON answer. No CORS headers: only the native screen may read these.
fn respond(mut stream: &TcpStream, status: u16, body: &Value) {
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
    if machine::is_set_up() {
        return (409, json!({ "error": "This machine is already set up." }));
    }
    if let Some(problems) = hospital_problems(body) {
        return problems;
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
    if machine::is_set_up() {
        return (409, json!({ "error": "This machine is already set up." }));
    }
    answer(500, machine::finish_node())
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
    let timer = Arc::clone(state);
    std::thread::spawn(move || {
        std::thread::sleep(CONFIRM_WITHIN);
        if timer.network_change.load(Ordering::SeqCst) == change {
            drop(machine::undo_fixed_address());
        }
    });
    (
        200,
        json!({ "confirm_within_seconds": CONFIRM_WITHIN.as_secs() }),
    )
}

/// Cancels a waiting rollback, then does a network action in its place.
fn settle_network(state: &State, action: fn() -> Result<(), String>) -> (u16, Value) {
    state.network_change.fetch_add(1, Ordering::SeqCst);
    answer(409, action())
}

/// Routes a request that has already passed the Host and token checks.
fn route(state: &Arc<State>, request: &Request) -> (u16, Value) {
    let body: Value = serde_json::from_slice(&request.body).unwrap_or(Value::Null);
    match (request.method.as_str(), request.path.as_str()) {
        ("GET", "/state") => (200, machine::state()),
        ("GET", "/network") => (200, machine::network_check()),
        ("POST", "/hospital/check") => {
            hospital_problems(&body).unwrap_or_else(|| (200, json!({ "ok": true })))
        }
        ("POST", "/hospital") => new_hospital(&body),
        ("POST", "/node/finish") => finish_node(),
        ("POST", "/network/fixed") => fixed_address(state, &body),
        ("POST", "/network/confirm") => settle_network(state, machine::confirm_fixed_address),
        ("POST", "/network/undo") => settle_network(state, machine::undo_fixed_address),
        ("POST", "/network/automatic") => settle_network(state, machine::use_automatic_address),
        ("POST", "/power") => answer(422, machine::power(field(&body, "action"))),
        _ => (404, json!({ "error": "not found" })),
    }
}

/// The refusal for a request that must not reach `route`, if any.
fn refusal(request: &Request, token: &str) -> Option<(u16, Value)> {
    if request.host != LISTEN {
        return Some((403, json!({ "error": "wrong host" })));
    }
    if !constant_time_eq(&request.token, token) {
        return Some((403, json!({ "error": "wrong token" })));
    }
    None
}

/// Serves one connection.
fn handle(state: &Arc<State>, stream: &TcpStream) {
    drop(stream.set_read_timeout(Some(IO_TIMEOUT)));
    drop(stream.set_write_timeout(Some(IO_TIMEOUT)));
    let Some(request) = read_request(stream) else {
        return;
    };
    let (status, body) = refusal(&request, &state.token).unwrap_or_else(|| route(state, &request));
    respond(stream, status, &body);
}

/// Compares without stopping at the first difference.
fn constant_time_eq(a: &str, b: &str) -> bool {
    a.len() == b.len()
        && a.bytes()
            .zip(b.bytes())
            .fold(0_u8, |diff, (x, y)| diff | (x ^ y))
            == 0
}

/// A fresh token from the OS, written where only the screen's group can read it.
fn new_token() -> std::io::Result<String> {
    let mut bytes = [0_u8; 32];
    std::fs::File::open("/dev/urandom")?.read_exact(&mut bytes)?;
    let token: String = bytes.iter().map(|b| format!("{b:02x}")).collect();
    let temporary = format!("{TOKEN_FILE}.new");
    std::fs::write(&temporary, &token)?;
    let chgrp = std::process::Command::new("chgrp")
        .args(["kiosk", &temporary])
        .status()?;
    let chmod = std::process::Command::new("chmod")
        .args(["0640", &temporary])
        .status()?;
    if !chgrp.success() || !chmod.success() {
        return Err(std::io::Error::other("could not protect the token"));
    }
    std::fs::rename(&temporary, TOKEN_FILE)?;
    Ok(token)
}

/// Writes the token, then serves the screen forever.
fn main() -> std::io::Result<()> {
    let state = Arc::new(State {
        token: new_token()?,
        network_change: AtomicU64::new(0),
    });
    let listener = TcpListener::bind(LISTEN)?;
    for stream in listener.incoming().flatten() {
        handle(&state, &stream);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{LISTEN, Request, constant_time_eq, read_request, refusal};

    /// A request as the screen sends it, which `refusal` should let through.
    fn request(host: &str, token: &str) -> Request {
        Request {
            method: "POST".to_owned(),
            path: "/power".to_owned(),
            host: host.to_owned(),
            token: token.to_owned(),
            body: Vec::new(),
        }
    }

    #[test]
    fn a_token_must_match_exactly() {
        assert!(constant_time_eq("abc", "abc"));
        assert!(!constant_time_eq("abc", "abd"));
        assert!(!constant_time_eq("abc", "abcd"));
        assert!(!constant_time_eq("", "abc"));
    }

    /// Powering a hospital machine off must need the token, and must not work through a
    /// page that rebinds its own domain to this address.
    #[test]
    fn only_the_right_host_with_the_right_token_gets_through() {
        assert!(refusal(&request(LISTEN, "secret"), "secret").is_none());
        assert_eq!(
            refusal(&request(LISTEN, "wrong"), "secret").map(|r| r.0),
            Some(403)
        );
        assert_eq!(
            refusal(&request(LISTEN, ""), "secret").map(|r| r.0),
            Some(403)
        );
        assert_eq!(
            refusal(&request("evil.example", "secret"), "secret").map(|r| r.0),
            Some(403)
        );
    }

    #[test]
    fn a_request_is_parsed_and_an_oversized_one_refused() {
        let good =
            "POST /power HTTP/1.1\r\nHost: h\r\nX-Setup-Token: t\r\nContent-Length: 2\r\n\r\n{}";
        let parsed = read_request(good.as_bytes());
        assert!(parsed.is_some_and(|r| r.host == "h" && r.token == "t" && r.body == b"{}"));
        let huge = "POST / HTTP/1.1\r\nContent-Length: 99999999\r\n\r\n";
        assert!(read_request(huge.as_bytes()).is_none());
    }
}
