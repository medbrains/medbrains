//! HL7 v2 messages: delimiters, segments in order, repetitions, components,
//! escape sequences, MLLP framing and ACKs.
//!
//! Hand-written rather than a crate: the grammar is small, this SDK also
//! builds for WASM, and the Rust HL7 crates evaluated in Oct 2026
//! (`hl7-parser` 0.3, `rust-hl7` 0.5) are single-maintainer 0.x libraries.
//! The previous parser here keyed fields by name (`OBX.5`), so every repeated
//! segment overwrote the one before -- a CBC arrived as one result.

pub mod oru;
#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests;

/// The five delimiters a message declares in MSH-1 and MSH-2.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Delimiters {
    pub field: char,
    pub component: char,
    pub repetition: char,
    pub escape: char,
    pub subcomponent: char,
}

impl Default for Delimiters {
    fn default() -> Self {
        Self {
            field: '|',
            component: '^',
            repetition: '~',
            escape: '\\',
            subcomponent: '&',
        }
    }
}

/// One segment. `fields[n]` is HL7 field `n`; `fields[0]` is the segment name.
/// For MSH, `fields[1]` is the field separator and `fields[2]` the encoding
/// characters, so MSH-9 is `fields[9]` as the standard numbers it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Segment {
    pub name: String,
    fields: Vec<String>,
}

/// A parsed message: its delimiters and every segment, in order, repeats kept.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Message {
    pub delimiters: Delimiters,
    pub segments: Vec<Segment>,
}

/// Parse a message. `None` when it does not begin with an MSH segment.
/// Segments may end in CR, LF or CRLF; blank lines are ignored.
pub fn parse(raw: &str) -> Option<Message> {
    let raw = raw.trim_start_matches(|c: char| c.is_whitespace() || c == '\u{feff}');
    let mut chars = raw.strip_prefix("MSH")?.chars();
    let field = chars.next()?;
    let encoding: Vec<char> = chars
        .take_while(|&c| c != field && c != '\r' && c != '\n')
        .collect();
    let d = Delimiters::default();
    let delimiters = Delimiters {
        field,
        component: encoding.first().copied().unwrap_or(d.component),
        repetition: encoding.get(1).copied().unwrap_or(d.repetition),
        escape: encoding.get(2).copied().unwrap_or(d.escape),
        subcomponent: encoding.get(3).copied().unwrap_or(d.subcomponent),
    };
    let segments = raw
        .split(['\r', '\n'])
        .filter(|line| !line.trim().is_empty())
        .map(|line| split_segment(line, field))
        .collect();
    Some(Message {
        delimiters,
        segments,
    })
}

fn split_segment(line: &str, field: char) -> Segment {
    let mut parts: Vec<String> = line.split(field).map(str::to_owned).collect();
    let name = parts.first().cloned().unwrap_or_default();
    if name == "MSH" {
        // MSH-1 is the separator itself, so every later field shifts by one.
        parts.insert(1, field.to_string());
    }
    Segment {
        name,
        fields: parts,
    }
}

impl Segment {
    /// Field `n` as sent, delimiters and escapes intact; empty when absent.
    pub fn raw(&self, n: usize) -> &str {
        self.fields.get(n).map_or("", String::as_str)
    }
}

impl Message {
    /// Every segment called `name`, in order.
    pub fn all<'a>(&'a self, name: &'a str) -> impl Iterator<Item = &'a Segment> + 'a {
        self.segments.iter().filter(move |s| s.name == name)
    }

    /// The first segment called `name`.
    pub fn first(&self, name: &str) -> Option<&Segment> {
        self.segments.iter().find(|s| s.name == name)
    }

    /// The repetitions of field `n`, as sent. MSH-1 and MSH-2 never split.
    pub fn repetitions<'a>(&self, seg: &'a Segment, n: usize) -> Vec<&'a str> {
        let raw = seg.raw(n);
        if seg.name == "MSH" && n <= 2 {
            return vec![raw];
        }
        raw.split(self.delimiters.repetition).collect()
    }

    /// Component `c` (1-based) of the first repetition of field `n`, unescaped.
    pub fn component(&self, seg: &Segment, n: usize, c: usize) -> String {
        let rep = self
            .repetitions(seg, n)
            .first()
            .copied()
            .unwrap_or_default();
        self.component_of(rep, c)
    }

    /// Component `c` (1-based) of one repetition's text, unescaped.
    pub fn component_of(&self, repetition: &str, c: usize) -> String {
        let part = repetition
            .split(self.delimiters.component)
            .nth(c.saturating_sub(1));
        self.unescape(part.unwrap_or_default())
    }

    /// The whole first repetition of field `n`, unescaped, components joined
    /// back with the component separator.
    pub fn text(&self, seg: &Segment, n: usize) -> String {
        let rep = self
            .repetitions(seg, n)
            .first()
            .copied()
            .unwrap_or_default();
        self.unescape_repetition(rep)
    }

    /// One repetition with each component unescaped, joined with `^`.
    pub fn unescape_repetition(&self, repetition: &str) -> String {
        repetition
            .split(self.delimiters.component)
            .map(|c| self.unescape(c))
            .collect::<Vec<_>>()
            .join("^")
    }

    /// Decode escape sequences: `\F\ \S\ \T\ \R\ \E\` to the delimiters,
    /// `\.br\` to a newline, `\Xhh..\` to bytes, highlighting dropped. An
    /// unknown or unterminated sequence is kept as sent.
    pub fn unescape(&self, s: &str) -> String {
        let d = self.delimiters;
        let mut out = String::with_capacity(s.len());
        let mut rest = s;
        while let Some(start) = rest.find(d.escape) {
            out.push_str(&rest[..start]);
            let after = &rest[start + d.escape.len_utf8()..];
            let Some(end) = after.find(d.escape) else {
                out.push_str(&rest[start..]);
                return out;
            };
            match decode_escape(&after[..end], d) {
                Some(decoded) => out.push_str(&decoded),
                None => out.push_str(&rest[start..start + d.escape.len_utf8() * 2 + end]),
            }
            rest = &after[end + d.escape.len_utf8()..];
        }
        out.push_str(rest);
        out
    }
}

fn decode_escape(code: &str, d: Delimiters) -> Option<String> {
    let one = |c: char| Some(c.to_string());
    match code {
        "F" => one(d.field),
        "S" => one(d.component),
        "T" => one(d.subcomponent),
        "R" => one(d.repetition),
        "E" => one(d.escape),
        ".br" | ".sp" => one('\n'),
        "H" | "N" => Some(String::new()),
        _ => {
            let hex = code.strip_prefix('X')?;
            if hex.is_empty() || hex.len() % 2 != 0 {
                return None;
            }
            let bytes = (0..hex.len())
                .step_by(2)
                .map(|i| u8::from_str_radix(&hex[i..i + 2], 16).ok())
                .collect::<Option<Vec<u8>>>()?;
            Some(String::from_utf8_lossy(&bytes).into_owned())
        }
    }
}

/// Generate an HL7 ACK for a received message.
pub fn generate_ack(message_id: &str, ack_code: &str) -> String {
    let now = chrono::Utc::now().format("%Y%m%d%H%M%S").to_string();
    format!(
        "MSH|^~\\&|MEDBRAINS|MEDBRAINS|DEVICE|DEVICE|{now}||ACK|{message_id}|P|2.5\r\
         MSA|{ack_code}|{message_id}\r"
    )
}

/// MLLP framing: `0x0B` message `0x1C 0x0D`.
pub fn mllp_wrap(message: &str) -> Vec<u8> {
    let mut buf = Vec::with_capacity(message.len() + 3);
    buf.push(0x0B);
    buf.extend_from_slice(message.as_bytes());
    buf.push(0x1C);
    buf.push(0x0D);
    buf
}

/// The message inside an MLLP frame. Bytes before the start block (line
/// noise, a newline between frames) are skipped; text that is not UTF-8
/// (Latin-1 names from older analysers) is decoded lossily rather than
/// refused, since results themselves are ASCII.
pub fn mllp_unwrap(data: &[u8]) -> Option<String> {
    let start = data.iter().position(|&b| b == 0x0B)? + 1;
    let end = start + data.get(start..)?.iter().position(|&b| b == 0x1C)?;
    Some(String::from_utf8_lossy(&data[start..end]).into_owned())
}
