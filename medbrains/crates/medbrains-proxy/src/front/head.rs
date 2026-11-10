//! The strict gate every request head passes before Pingora parses it.
//!
//! Smuggling needs two parsers that disagree about where a request ends. So anything a parser could
//! read two ways is refused here, on the raw bytes, and the connection is closed. A browser sends
//! none of it. Pure functions: no I/O, bounded by the head size limit `listen.rs` enforces.

/// Header lines allowed in one head. Pingora allows 256; no browser comes near this.
const MAX_HEADERS: usize = 128;

/// Why a head was refused, which decides the status it gets.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Refusal {
    /// 400: framing or syntax a second parser could read differently.
    Malformed,
    /// 405: TRACE echoes headers, and CONNECT is never proxied here.
    Method,
}

/// What is known so far about the bytes read from a connection.
#[derive(Debug, PartialEq, Eq)]
pub(crate) enum Scan {
    /// No end of head yet; continue scanning at this offset once more bytes arrive.
    Partial(usize),
    /// The head ends just before this offset.
    Complete(usize),
    /// A line feed with no carriage return before it.
    BareLineFeed,
}

/// Looks for the end of a head from `from`, refusing a bare LF as soon as it appears.
///
/// Scanning resumes where it stopped, so a client sending one byte at a time costs linear work.
pub(crate) fn scan_head(buf: &[u8], from: usize) -> Scan {
    let mut index = from;
    while let Some(byte) = buf.get(index) {
        if *byte == b'\n' {
            if index == 0 || buf.get(index - 1) != Some(&b'\r') {
                return Scan::BareLineFeed;
            }
            if index >= 3 && buf.get(index - 3..index - 1) == Some(b"\r\n") {
                return Scan::Complete(index + 1);
            }
        }
        index += 1;
    }
    Scan::Partial(index)
}

/// What the rest of the head is judged against.
struct RequestLine {
    is_get: bool,
    is_http10: bool,
}

/// The request line: method, target and version, separated by exactly one space each.
fn check_request_line(line: &[u8]) -> Result<RequestLine, Refusal> {
    let mut parts = line.split(|byte| *byte == b' ');
    let (Some(method), Some(target), Some(version), None) =
        (parts.next(), parts.next(), parts.next(), parts.next())
    else {
        return Err(Refusal::Malformed);
    };
    if method.is_empty() || !method.iter().all(u8::is_ascii_alphabetic) {
        return Err(Refusal::Malformed);
    }
    if method.eq_ignore_ascii_case(b"TRACE") || method.eq_ignore_ascii_case(b"CONNECT") {
        return Err(Refusal::Method);
    }
    let origin_form = target.first() == Some(&b'/') || target == b"*";
    if !origin_form || !target.iter().all(u8::is_ascii_graphic) {
        return Err(Refusal::Malformed);
    }
    let is_http10 = match version {
        b"HTTP/1.1" => false,
        b"HTTP/1.0" => true,
        _ => return Err(Refusal::Malformed),
    };
    Ok(RequestLine {
        is_get: method == b"GET",
        is_http10,
    })
}

/// True for the bytes of a header name: an RFC 9110 token.
fn is_token(name: &[u8]) -> bool {
    !name.is_empty()
        && name
            .iter()
            .all(|byte| byte.is_ascii_alphanumeric() || b"!#$%&'*+-.^_`|~".contains(byte))
}

/// True for the bytes of a header value: no control character but a tab.
fn is_field_value(value: &[u8]) -> bool {
    value
        .iter()
        .all(|byte| *byte == b'\t' || (*byte >= 0x20 && *byte != 0x7f))
}

/// Removes optional whitespace from both ends of a header value.
const fn trim_value(mut value: &[u8]) -> &[u8] {
    while let [b' ' | b'\t', rest @ ..] = value {
        value = rest;
    }
    while let [rest @ .., b' ' | b'\t'] = value {
        value = rest;
    }
    value
}

/// What the headers that decide framing have said so far.
#[derive(Default)]
struct Framing {
    hosts: u32,
    content_lengths: u32,
    transfer_encodings: u32,
    upgrades: u32,
}

impl Framing {
    /// Records one header, refusing any value a second parser could read differently.
    fn see(&mut self, name: &[u8], value: &[u8]) -> Result<(), Refusal> {
        if name.eq_ignore_ascii_case(b"host") {
            self.hosts += 1;
            if crate::names::parse_host_bytes(value).is_none() {
                return Err(Refusal::Malformed);
            }
        } else if name.eq_ignore_ascii_case(b"content-length") {
            self.content_lengths += 1;
            if value.is_empty() || !value.iter().all(u8::is_ascii_digit) {
                return Err(Refusal::Malformed);
            }
        } else if name.eq_ignore_ascii_case(b"transfer-encoding") {
            self.transfer_encodings += 1;
            if !value.eq_ignore_ascii_case(b"chunked") {
                return Err(Refusal::Malformed);
            }
        } else if name.eq_ignore_ascii_case(b"upgrade") {
            self.upgrades += 1;
            // An h2c upgrade through a proxy opens a tunnel past every rule here.
            if !value.eq_ignore_ascii_case(b"websocket") {
                return Err(Refusal::Malformed);
            }
        }
        Ok(())
    }

    /// Exactly one Host, at most one way of saying where the body ends, and an upgrade only as a
    /// WebSocket opens: one GET with no body on HTTP/1.1.
    const fn check(&self, line: &RequestLine) -> Result<(), Refusal> {
        let body_headers = self.content_lengths + self.transfer_encodings;
        let chunked_on_old = line.is_http10 && self.transfer_encodings > 0;
        let bad_upgrade = self.upgrades > 0
            && (self.upgrades > 1 || !line.is_get || line.is_http10 || body_headers > 0);
        if self.hosts != 1 || body_headers > 1 || chunked_on_old || bad_upgrade {
            return Err(Refusal::Malformed);
        }
        Ok(())
    }
}

/// Checks a complete head, from the request line to the blank line.
pub(crate) fn check_head(head: &[u8]) -> Result<(), Refusal> {
    let body = head.strip_suffix(b"\r\n\r\n").ok_or(Refusal::Malformed)?;
    // Every LF has a CR before it (`scan_head`), except on the last line, which has neither.
    let mut lines = body
        .split(|byte| *byte == b'\n')
        .map(|line| line.strip_suffix(b"\r").unwrap_or(line));
    let request_line = check_request_line(lines.next().ok_or(Refusal::Malformed)?)?;
    let mut framing = Framing::default();
    for (count, line) in lines.enumerate() {
        if count >= MAX_HEADERS || line.contains(&b'\r') {
            return Err(Refusal::Malformed);
        }
        // An obsolete folded line starts with whitespace, so it has no valid name either.
        let colon = line.iter().position(|byte| *byte == b':');
        let (name, value) = line.split_at(colon.ok_or(Refusal::Malformed)?);
        let value = value.get(1..).unwrap_or_default();
        if !is_token(name) || !is_field_value(value) {
            return Err(Refusal::Malformed);
        }
        framing.see(name, trim_value(value))?;
    }
    framing.check(&request_line)
}

#[cfg(test)]
#[path = "head_tests.rs"]
mod tests;
