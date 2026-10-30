//! A browser envelope, made safe item by item.
//!
//! The browser SDK moves faster than the Rust protocol types: it sends session
//! statuses (`unhandled`) and shorthand shapes (breadcrumbs as a bare array)
//! that `sentry-types` refuses, and one refused item would lose the whole
//! envelope. So the envelope is split here, and each item is kept only if it
//! is a kind we can make safe:
//!
//! - `event` — normalised, read into the protocol type and put through the
//!   same [`scrub_event`] as the server's own reports;
//! - `session` — counts only: an id, timestamps, status, error count, release
//!   and environment. No user, IP address or user agent;
//!
//! and everything else (spans, replays, attachments, feedback, client
//! reports) is dropped.

use serde_json::{Map, Value, json};

use crate::scrub::{is_opaque_user_id, scrub_event};

/// What the envelope became: `None` when it is not an envelope at all, an empty
/// `Some` when it was one but nothing in it could be kept.
pub(crate) fn scrub_browser_envelope(body: &[u8]) -> Option<Vec<u8>> {
    let mut lines = Lines(body);
    let header: Value = serde_json::from_slice(lines.next_line()?).ok()?;
    let mut out = header.get("event_id").and_then(Value::as_str).map_or_else(
        || b"{}".to_vec(),
        |id| json!({ "event_id": id }).to_string().into_bytes(),
    );
    let mut kept = 0usize;
    while let Some(item_header) = lines.next_line() {
        if item_header.is_empty() {
            continue;
        }
        let item_header: Value = serde_json::from_slice(item_header).ok()?;
        let length = item_header.get("length").and_then(Value::as_u64);
        let payload = lines.payload(length)?;
        let kind = item_header
            .get("type")
            .and_then(Value::as_str)
            .unwrap_or_default();
        if let Some(clean) = scrub_item(kind, payload) {
            out.push(b'\n');
            out.extend(
                json!({ "type": kind, "length": clean.len() })
                    .to_string()
                    .into_bytes(),
            );
            out.push(b'\n');
            out.extend(clean);
            kept += 1;
        }
    }
    out.push(b'\n');
    Some(if kept == 0 { Vec::new() } else { out })
}

fn scrub_item(kind: &str, payload: &[u8]) -> Option<Vec<u8>> {
    let value: Value = serde_json::from_slice(payload).ok()?;
    match kind {
        "event" => scrub_event_json(value),
        "session" => scrub_session_json(&value),
        _ => None,
    }
}

fn scrub_event_json(mut value: Value) -> Option<Vec<u8>> {
    // The SDK's shorthand: a bare array where the protocol has `{ values }`.
    for key in ["breadcrumbs", "exception", "threads"] {
        if let Some(list) = value.get_mut(key).filter(|v| v.is_array()) {
            *list = json!({ "values": list.take() });
        }
    }
    let mut event: sentry::protocol::Event<'static> = serde_json::from_value(value).ok()?;
    scrub_event(&mut event);
    serde_json::to_vec(&event).ok()
}

/// The fields release health counts with, and nothing else.
fn scrub_session_json(value: &Value) -> Option<Vec<u8>> {
    let source = value.as_object()?;
    let mut session: Map<String, Value> = [
        "sid",
        "init",
        "started",
        "timestamp",
        "status",
        "errors",
        "duration",
        "seq",
    ]
    .into_iter()
    .filter_map(|key| source.get(key).map(|v| (key.to_owned(), v.clone())))
    .collect();
    if let Some(did) = source
        .get("did")
        .and_then(Value::as_str)
        .filter(|d| is_opaque_user_id(d))
    {
        session.insert("did".to_owned(), Value::String(did.to_owned()));
    }
    let attrs = source.get("attrs").and_then(Value::as_object);
    let kept_attrs: Map<String, Value> = ["release", "environment"]
        .into_iter()
        .filter_map(|key| attrs?.get(key).map(|v| (key.to_owned(), v.clone())))
        .collect();
    session.insert("attrs".to_owned(), Value::Object(kept_attrs));
    serde_json::to_vec(&session).ok()
}

/// Newline-delimited envelope lines, with length-prefixed payloads.
struct Lines<'a>(&'a [u8]);

impl<'a> Lines<'a> {
    fn next_line(&mut self) -> Option<&'a [u8]> {
        if self.0.is_empty() {
            return None;
        }
        let end = self
            .0
            .iter()
            .position(|b| *b == b'\n')
            .unwrap_or(self.0.len());
        let (line, rest) = self.0.split_at(end);
        self.0 = rest.get(1..).unwrap_or_default();
        Some(line)
    }

    fn payload(&mut self, length: Option<u64>) -> Option<&'a [u8]> {
        let Some(length) = length else {
            return self.next_line();
        };
        let length = usize::try_from(length).ok()?;
        let payload = self.0.get(..length)?;
        let rest = self.0.get(length..)?;
        self.0 = rest.strip_prefix(b"\n").unwrap_or(rest);
        Some(payload)
    }
}
