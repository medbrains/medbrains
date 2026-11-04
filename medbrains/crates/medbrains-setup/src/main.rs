//! Setup and machine controls for the OS screen (OS-SETUP-AND-TRUST §5).
//!
//! Listens only on the machine itself. Every change needs a token that is written where
//! only the screen can read it, so nobody on the network can finish setup or power the
//! machine off, and the Host check stops a web page reaching this through DNS rebinding.
//! The server is deliberately small: one connection at a time is plenty for one screen.

mod machine;
mod rules;

use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

use serde_json::{Value, json};

const LISTEN: &str = "127.0.0.1:3100";
const TOKEN_FILE: &str = "/run/medbrains-console/setup-token.js";
const MAX_BODY: usize = 16 * 1024;
const MAX_HEADERS: usize = 64;
const IO_TIMEOUT: Duration = Duration::from_secs(5);
/// A fixed address not confirmed in this time is undone, so a mistake cannot strand the machine.
const CONFIRM_WITHIN: Duration = Duration::from_secs(60);

/// Shared between the listener and the rollback timer.
struct State {
    token: String,
    /// Bumped by each change and each confirmation; a rollback only runs if it still matches.
    network_change: AtomicU64,
}

/// One parsed request.
struct Request {
    method: String,
    path: String,
    host: String,
    token: String,
    body: Vec<u8>,
}

/// Reads one request, refusing anything oversized.
fn read_request(stream: &TcpStream) -> Option<Request> {
    let mut reader = BufReader::new(stream.try_clone().ok()?);
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
            return Some(Request { method, path, host, token, body });
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

/// Writes a JSON answer. The screen's pages load from `file://`, whose origin is `null`.
fn respond(mut stream: &TcpStream, status: u16, body: &Value) {
    let text = body.to_string();
    let head = format!(
        "HTTP/1.1 {status} X\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\
         Access-Control-Allow-Origin: null\r\nAccess-Control-Allow-Headers: x-setup-token, content-type\r\n\
         Access-Control-Allow-Methods: GET, POST\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n",
        text.len()
    );
    // The screen retries on its next poll if this fails.
    drop(stream.write_all(head.as_bytes()).and_then(|()| stream.write_all(text.as_bytes())));
}

/// A text field of a JSON body, or empty.
fn field<'a>(body: &'a Value, key: &str) -> &'a str {
    body.get(key).and_then(Value::as_str).unwrap_or("")
}

/// Handles `POST /hospital`: checks the three fields, then starts the main machine.
fn new_hospital(body: &Value) -> (u16, Value) {
    if machine::is_set_up() {
        return (409, json!({ "error": "This machine is already set up." }));
    }
    let (hospital, username, password) = (field(body, "hospital"), field(body, "username"), field(body, "password"));
    let problems = rules::check_new_hospital(hospital, username, password);
    if !problems.is_empty() {
        let map: serde_json::Map<String, Value> = problems.into_iter().map(|(k, v)| (k.to_owned(), json!(v))).collect();
        return (422, json!({ "problems": map }));
    }
    match machine::start_main_machine(hospital, username, password) {
        Ok(()) => (200, json!({ "ok": true })),
        Err(error) => (500, json!({ "error": error })),
    }
}

/// Handles `POST /network/fixed`, and arranges the rollback if it is never confirmed.
fn fixed_address(state: &Arc<State>, body: &Value) -> (u16, Value) {
    let applied = machine::apply_fixed_address(field(body, "interface"), field(body, "address"), field(body, "gateway"), field(body, "dns"));
    if let Err(error) = applied {
        return (422, json!({ "error": error }));
    }
    let change = state.network_change.fetch_add(1, Ordering::SeqCst) + 1;
    let timer = Arc::clone(state);
    std::thread::spawn(move || {
        std::thread::sleep(CONFIRM_WITHIN);
        if timer.network_change.load(Ordering::SeqCst) == change {
            drop(machine::remove_fixed_address());
        }
    });
    (200, json!({ "confirm_within_seconds": CONFIRM_WITHIN.as_secs() }))
}

/// Routes a request that has already passed the Host and token checks.
fn route(state: &Arc<State>, request: &Request) -> (u16, Value) {
    let body: Value = serde_json::from_slice(&request.body).unwrap_or(Value::Null);
    match (request.method.as_str(), request.path.as_str()) {
        ("GET", "/state") => (200, json!({ "set_up": machine::is_set_up(), "network": machine::network_state() })),
        ("POST", "/hospital") => new_hospital(&body),
        ("POST", "/network/fixed") => fixed_address(state, &body),
        ("POST", "/network/confirm") => {
            state.network_change.fetch_add(1, Ordering::SeqCst);
            (200, json!({ "ok": true }))
        }
        ("POST", "/network/automatic") => match machine::remove_fixed_address() {
            Ok(()) => (200, json!({ "ok": true })),
            Err(error) => (500, json!({ "error": error })),
        },
        ("POST", "/power") => match machine::power(field(&body, "action")) {
            Ok(()) => (200, json!({ "ok": true })),
            Err(error) => (422, json!({ "error": error })),
        },
        _ => (404, json!({ "error": "not found" })),
    }
}

/// Serves one connection.
fn handle(state: &Arc<State>, stream: &TcpStream) {
    drop(stream.set_read_timeout(Some(IO_TIMEOUT)));
    drop(stream.set_write_timeout(Some(IO_TIMEOUT)));
    let Some(request) = read_request(stream) else { return };
    if request.host != LISTEN {
        return respond(stream, 403, &json!({ "error": "wrong host" }));
    }
    if request.method == "OPTIONS" {
        return respond(stream, 200, &json!({}));
    }
    if !constant_time_eq(&request.token, &state.token) {
        return respond(stream, 403, &json!({ "error": "wrong token" }));
    }
    let (status, body) = route(state, &request);
    respond(stream, status, &body);
}

/// Compares without stopping at the first difference.
fn constant_time_eq(a: &str, b: &str) -> bool {
    a.len() == b.len() && a.bytes().zip(b.bytes()).fold(0_u8, |diff, (x, y)| diff | (x ^ y)) == 0
}

/// A fresh token from the OS, written where only the screen's group can read it.
fn new_token() -> std::io::Result<String> {
    let mut bytes = [0_u8; 32];
    std::fs::File::open("/dev/urandom")?.read_exact(&mut bytes)?;
    let token: String = bytes.iter().map(|b| format!("{b:02x}")).collect();
    let temporary = format!("{TOKEN_FILE}.new");
    std::fs::write(&temporary, format!("window.MB_SETUP_TOKEN=\"{token}\";\n"))?;
    let chgrp = std::process::Command::new("chgrp").args(["kiosk", &temporary]).status()?;
    let chmod = std::process::Command::new("chmod").args(["0640", &temporary]).status()?;
    if !chgrp.success() || !chmod.success() {
        return Err(std::io::Error::other("could not protect the token"));
    }
    std::fs::rename(&temporary, TOKEN_FILE)?;
    Ok(token)
}

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
    use super::constant_time_eq;

    #[test]
    fn a_token_must_match_exactly() {
        assert!(constant_time_eq("abc", "abc"));
        assert!(!constant_time_eq("abc", "abd"));
        assert!(!constant_time_eq("abc", "abcd"));
        assert!(!constant_time_eq("", "abc"));
    }
}
