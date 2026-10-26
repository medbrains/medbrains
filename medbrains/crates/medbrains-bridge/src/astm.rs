//! ASTM analyzers (Sysmex-class): E1381 framing over TCP and E1394 records.
//!
//! The analyzer opens with ENQ, sends checksummed frames, each acknowledged,
//! and closes with EOT. The frames' text joins into records — H header, P
//! patient, O order (the sample), R result, L terminator — and every R
//! belongs to the O before it. Each O with its results is delivered to
//! MedBrains as one lab message, matched to its order by the sample barcode.

use anyhow::Result;
use std::time::Instant;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tracing::{error, info, warn};

use crate::buffer::MessageBuffer;
use crate::config::BridgeConfig;
use crate::ingest;

const ENQ: u8 = 0x05;
const ACK: u8 = 0x06;
const NAK: u8 = 0x15;
const EOT: u8 = 0x04;
const STX: u8 = 0x02;
const ETX: u8 = 0x03;
const ETB: u8 = 0x17;
const LF: u8 = 0x0A;
/// A frame is at most 247 bytes; anything longer without an LF is noise.
const MAX_PENDING: usize = 64 * 1024;
/// One transmission's text; a full CBC run is a few kilobytes.
const MAX_TEXT: usize = 1024 * 1024;

/// What the link layer does with bytes from the analyzer.
#[derive(Debug, PartialEq, Eq)]
pub enum Event {
    /// Write this byte back (ACK or NAK).
    Reply(u8),
    /// A whole transmission arrived (at EOT): its record text.
    Message(String),
}

/// One connection's E1381 state.
#[derive(Default)]
pub struct Session {
    pending: Vec<u8>,
    text: String,
}

impl Session {
    pub fn feed(&mut self, bytes: &[u8]) -> Vec<Event> {
        self.pending.extend_from_slice(bytes);
        let mut events = Vec::new();
        while let Some(&first) = self.pending.first() {
            match first {
                ENQ => {
                    self.pending.remove(0);
                    self.text.clear();
                    events.push(Event::Reply(ACK));
                }
                EOT => {
                    self.pending.remove(0);
                    if !self.text.is_empty() {
                        events.push(Event::Message(std::mem::take(&mut self.text)));
                    }
                }
                STX => {
                    let Some(end) = self.pending.iter().position(|&b| b == LF) else {
                        if self.pending.len() > MAX_PENDING {
                            self.pending.clear();
                        }
                        break;
                    };
                    let frame: Vec<u8> = self.pending.drain(..=end).collect();
                    match frame_text(&frame) {
                        Some(text) if self.text.len() + text.len() <= MAX_TEXT => {
                            self.text.push_str(&text);
                            events.push(Event::Reply(ACK));
                        }
                        _ => events.push(Event::Reply(NAK)),
                    }
                }
                _ => {
                    self.pending.remove(0);
                }
            }
        }
        events
    }
}

/// The text of one `STX FN text ETX|ETB C1 C2 CR LF` frame, if its checksum holds.
fn frame_text(frame: &[u8]) -> Option<String> {
    let n = frame.len();
    if n < 7 || !matches!(frame[n - 5], ETX | ETB) {
        return None;
    }
    let sum = frame[1..=n - 5]
        .iter()
        .fold(0u8, |acc, &b| acc.wrapping_add(b));
    let sent = std::str::from_utf8(&frame[n - 4..n - 2]).ok()?;
    if !sent.eq_ignore_ascii_case(&format!("{sum:02X}")) {
        return None;
    }
    Some(String::from_utf8_lossy(&frame[2..n - 5]).into_owned())
}

/// One sample's results.
#[derive(Debug, Default, PartialEq, Eq)]
pub struct SampleResults {
    pub sample_barcode: String,
    pub patient_id: Option<String>,
    pub results: Vec<serde_json::Value>,
}

/// Field `n` (1-based, the record type is field 1) of a record.
fn field<'a>(parts: &[&'a str], n: usize) -> &'a str {
    parts.get(n - 1).copied().unwrap_or_default().trim()
}

/// Group a transmission's records into samples and their results.
pub fn parse_records(text: &str) -> Vec<SampleResults> {
    let mut samples: Vec<SampleResults> = Vec::new();
    let mut patient: Option<String> = None;
    for line in text.split(['\r', '\n']).filter(|l| !l.is_empty()) {
        let parts: Vec<&str> = line.split('|').collect();
        // A frame number may precede the record type when frames are joined.
        let kind = parts[0].trim_start_matches(|c: char| c.is_ascii_digit());
        match kind {
            "P" => {
                patient = [3, 4, 5]
                    .into_iter()
                    .map(|n| field(&parts, n))
                    .find(|p| !p.is_empty())
                    .map(str::to_owned);
            }
            "O" => {
                // Host specimen id, else the instrument's: Sysmex sends
                // `rack^position^sample^attribute`.
                let id = [field(&parts, 3), field(&parts, 4)]
                    .into_iter()
                    .find(|f| !f.is_empty())
                    .unwrap_or_default();
                // ponytail: the longest component is the sample number; a
                // per-model mapping belongs in the adapter if one breaks this.
                let barcode = id
                    .split('^')
                    .map(str::trim)
                    .max_by_key(|c| c.len())
                    .unwrap_or_default();
                samples.push(SampleResults {
                    sample_barcode: barcode.to_owned(),
                    patient_id: patient.clone(),
                    results: Vec::new(),
                });
            }
            "R" => {
                // A result before any order record still goes to the server,
                // which holds an unidentified sample for review.
                if samples.is_empty() {
                    samples.push(SampleResults {
                        patient_id: patient.clone(),
                        ..Default::default()
                    });
                }
                let Some(sample) = samples.last_mut() else {
                    continue;
                };
                let code = field(&parts, 3)
                    .split('^')
                    .map(str::trim)
                    .find(|c| !c.is_empty())
                    .unwrap_or_default();
                if code.is_empty() {
                    continue;
                }
                let opt = |n| Some(field(&parts, n)).filter(|v| !v.is_empty());
                sample.results.push(serde_json::json!({
                    "test_code": code,
                    "value": field(&parts, 4),
                    "unit": opt(5),
                    "reference_range": opt(6),
                    "abnormal_flag": opt(7),
                }));
            }
            _ => {}
        }
    }
    // An order record with no results reports nothing. One with results but
    // no barcode is kept: the server holds it for review rather than this
    // bridge dropping a patient's results unseen.
    samples.retain(|s| !s.results.is_empty());
    samples
}

/// Accept ASTM analyzers on `addr`.
pub async fn listen(
    addr: &str,
    buffer: MessageBuffer,
    client: &reqwest::Client,
    cfg: &BridgeConfig,
) -> Result<()> {
    let listener = TcpListener::bind(addr).await?;
    info!(addr = %addr, "ASTM listener started");
    loop {
        let (mut socket, peer) = listener.accept().await?;
        info!(peer = %peer, "ASTM analyzer connected");
        let (buf, cli, config) = (buffer.clone(), client.clone(), cfg.clone());
        tokio::spawn(async move {
            let mut session = Session::default();
            let mut read = [0u8; 4096];
            loop {
                let n = match socket.read(&mut read).await {
                    Ok(0) => break,
                    Ok(n) => n,
                    Err(e) => {
                        error!(peer = %peer, error = %e, "ASTM read error");
                        break;
                    }
                };
                for event in session.feed(&read[..n]) {
                    match event {
                        Event::Reply(byte) => {
                            if let Err(e) = socket.write_all(&[byte]).await {
                                error!(error = %e, "ASTM reply failed");
                            }
                        }
                        Event::Message(text) => deliver(&text, &buf, &cli, &config).await,
                    }
                }
            }
            info!(peer = %peer, "ASTM analyzer disconnected");
        });
    }
}

async fn deliver(text: &str, buffer: &MessageBuffer, client: &reqwest::Client, cfg: &BridgeConfig) {
    let start = Instant::now();
    let device_id = cfg.device_instance_id.as_deref().unwrap_or("unknown");
    for sample in parse_records(text) {
        let parsed = serde_json::json!({ "message_type": "ASTM", "records": text });
        let mapped = serde_json::json!({
            "identifiers": {
                "sample_barcode": Some(&sample.sample_barcode).filter(|b| !b.is_empty()),
                "patient_id": sample.patient_id,
            },
            "results": sample.results,
        });
        let ms = i32::try_from(start.elapsed().as_millis()).unwrap_or(i32::MAX);
        if let Err(e) =
            ingest::deliver(client, cfg, device_id, "lab", "astm", &parsed, &mapped, ms).await
        {
            warn!(error = %e, barcode = %sample.sample_barcode, "ASTM delivery failed — buffering");
            if let Err(e) = buffer.enqueue(device_id, "lab", "astm", &parsed, &mapped, Some(ms)) {
                error!(error = %e, "ASTM buffer write failed");
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Frame `text` the way an analyzer does.
    fn frame(fn_digit: u8, text: &str, last: bool) -> Vec<u8> {
        let mut body = vec![fn_digit];
        body.extend_from_slice(text.as_bytes());
        body.push(if last { ETX } else { ETB });
        let sum = body.iter().fold(0u8, |a, &b| a.wrapping_add(b));
        let mut out = vec![STX];
        out.extend(body);
        out.extend(format!("{sum:02X}\r\n").bytes());
        out
    }

    const XN_RUN: &str = "H|\\^&|||XN-550^00-22^11001^^^^12345678||||||||E1394-97\r\
        P|1|||UH-1001|^Devi^Lakshmi||19800309|F\r\
        O|1||^^                 SB240001^B|^^^^WBC\\^^^^RBC|||||||N||||||||||||||F\r\
        R|1|^^^^WBC^1|12.4|10*3/uL||H||||||20261017101500\r\
        R|2|^^^^RBC^1|4.52|10*6/uL||N\r\
        R|3|^^^^HGB^1|13.1|g/dL|12.0-15.5|\r\
        L|1|N\r";

    #[test]
    fn a_sysmex_run_becomes_one_sample_with_its_results() {
        let samples = parse_records(XN_RUN);
        assert_eq!(samples.len(), 1);
        let s = &samples[0];
        assert_eq!(s.sample_barcode, "SB240001");
        assert_eq!(s.patient_id.as_deref(), Some("UH-1001"));
        assert_eq!(s.results.len(), 3);
        assert_eq!(s.results[0]["test_code"], "WBC");
        assert_eq!(s.results[0]["value"], "12.4");
        assert_eq!(s.results[0]["abnormal_flag"], "H");
        assert_eq!(s.results[2]["reference_range"], "12.0-15.5");
        assert!(s.results[2]["abnormal_flag"].is_null());
    }

    #[test]
    fn the_link_layer_acks_good_frames_naks_bad_ones_and_hands_over_at_eot() {
        let mut session = Session::default();
        assert_eq!(session.feed(&[ENQ]), vec![Event::Reply(ACK)]);
        // Records split across an intermediate (ETB) and a final frame,
        // arriving in pieces.
        let (head, tail) = XN_RUN.split_at(100);
        let first = frame(b'1', head, false);
        let (a, b) = first.split_at(30);
        assert!(session.feed(a).is_empty());
        assert_eq!(session.feed(b), vec![Event::Reply(ACK)]);
        let mut bad = frame(b'2', "R|9|^^^^PLT^1|250\r", true);
        let at = bad.len() - 4;
        bad[at] = b'0';
        bad[at + 1] = b'0';
        assert_eq!(session.feed(&bad), vec![Event::Reply(NAK)]);
        assert_eq!(
            session.feed(&frame(b'2', tail, true)),
            vec![Event::Reply(ACK)]
        );
        let events = session.feed(&[EOT]);
        let [Event::Message(text)] = events.as_slice() else {
            panic!("expected one message, got {events:?}");
        };
        assert_eq!(text, XN_RUN, "the NAK'd frame is not kept");
        assert_eq!(parse_records(text)[0].results.len(), 3);
    }

    #[test]
    fn results_without_a_barcode_are_kept_for_review_and_empty_orders_are_not() {
        // Dropping these lost a patient's results without a trace; the server
        // now holds them for a technologist to match.
        let orphan = parse_records("H|\\^&\rP|1||UH-9\rR|1|^^^WBC|5\rL|1\r");
        assert_eq!(orphan.len(), 1);
        assert_eq!(orphan[0].sample_barcode, "");
        assert_eq!(orphan[0].patient_id.as_deref(), Some("UH-9"));
        assert_eq!(orphan[0].results.len(), 1);
        let blank = parse_records("H|\\^&\rO|1||\rR|1|^^^HGB|13\rL|1\r");
        assert_eq!(blank[0].sample_barcode, "");
        assert!(parse_records("H|\\^&\rO|1|SB1\rL|1\r").is_empty());
    }
}
