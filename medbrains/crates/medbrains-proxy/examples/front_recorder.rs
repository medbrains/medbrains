//! A stand-in for the server, for `os/tests/front-attacks.py`: records exactly what the front sends
//! it, so a test can prove what a smuggled or forged request did and did not reach.
//!
//!     front_recorder 127.0.0.1:3000
//!
//! `GET /__seen` lists every request so far as text, `/__reset` forgets them, `/__stream` sends three
//! chunks a second apart, and `/__ws` answers an upgrade and echoes bytes. It parses strictly: a
//! request it cannot frame is recorded as GARBAGE, which a test treats as a failure. A body cut off
//! by the connection ending is recorded as CUT: the front stopped it, and a server would drop it.
#![allow(clippy::unwrap_used, clippy::expect_used)]

use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{Arc, Mutex};
use std::thread::{sleep, spawn};
use std::time::Duration;

const MAX_BODY_RECORDED: usize = 4096;

type Seen = Arc<Mutex<Vec<String>>>;

/// One request head as its lines, or `None` when the connection has ended.
fn read_head(reader: &mut BufReader<TcpStream>) -> Option<Vec<String>> {
    let mut lines = Vec::new();
    loop {
        let mut line = String::new();
        if reader.read_line(&mut line).ok()? == 0 {
            return None;
        }
        let line = line.trim_end_matches(['\r', '\n']).to_owned();
        if line.is_empty() {
            return Some(lines);
        }
        lines.push(line);
    }
}

/// The value of a header, ignoring case.
fn header<'a>(lines: &'a [String], name: &str) -> Option<&'a str> {
    lines.iter().skip(1).find_map(|line| {
        let (key, value) = line.split_once(':')?;
        key.eq_ignore_ascii_case(name).then(|| value.trim())
    })
}

/// How a body ended, if not with all of it.
enum BodyError {
    Cut,
    Garbage,
}

/// Reads a chunked body, keeping only its start.
fn read_chunked(reader: &mut BufReader<TcpStream>) -> Result<(Vec<u8>, usize), BodyError> {
    let (mut kept, mut total) = (Vec::new(), 0);
    loop {
        let mut size = String::new();
        if reader.read_line(&mut size).unwrap_or(0) == 0 {
            return Err(BodyError::Cut);
        }
        let digits = size.trim_end().split(';').next().unwrap_or("");
        let size = usize::from_str_radix(digits, 16).map_err(|_| BodyError::Garbage)?;
        let mut chunk = vec![0; size + 2];
        reader.read_exact(&mut chunk).map_err(|_| BodyError::Cut)?;
        if !chunk.ends_with(b"\r\n") {
            return Err(BodyError::Garbage);
        }
        chunk.truncate(size);
        total += size;
        if kept.len() < MAX_BODY_RECORDED {
            kept.extend_from_slice(&chunk);
        }
        if size == 0 {
            return Ok((kept, total));
        }
    }
}

/// Reads a body of known length, keeping only its start.
fn read_sized(
    reader: &mut BufReader<TcpStream>,
    length: usize,
) -> Result<(Vec<u8>, usize), BodyError> {
    let mut kept = vec![0; length.min(MAX_BODY_RECORDED)];
    reader.read_exact(&mut kept).map_err(|_| BodyError::Cut)?;
    let wanted = (length - kept.len()) as u64;
    let mut rest = reader.take(wanted);
    let copied = std::io::copy(&mut rest, &mut std::io::sink()).map_err(|_| BodyError::Cut)?;
    if copied == wanted {
        Ok((kept, length))
    } else {
        Err(BodyError::Cut)
    }
}

/// Echoes bytes on an upgraded connection until the client leaves.
fn echo(mut reader: BufReader<TcpStream>, mut writer: TcpStream) {
    let mut buffer = [0; 1024];
    while let Ok(count) = reader.read(&mut buffer) {
        if count == 0 || writer.write_all(&buffer[..count]).is_err() {
            return;
        }
    }
}

/// Three chunks, a second apart, to show the proxy does not hold a response back.
fn stream_chunks(writer: &mut TcpStream) -> std::io::Result<()> {
    writer.write_all(b"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n")?;
    for chunk in ["one\n", "two\n", "tri\n"] {
        write!(writer, "{:x}\r\n{chunk}\r\n", chunk.len())?;
        writer.flush()?;
        sleep(Duration::from_secs(1));
    }
    writer.write_all(b"0\r\n\r\n")
}

/// Answers one recorded request with a short body.
fn answer(writer: &mut TcpStream, body: &str) -> std::io::Result<()> {
    write!(
        writer,
        "HTTP/1.1 200 OK\r\nContent-Length: {}\r\n\r\n{body}",
        body.len()
    )
}

/// Serves one connection until it ends.
fn serve(stream: TcpStream, seen: &Seen) -> Option<()> {
    let mut writer = stream.try_clone().ok()?;
    let mut reader = BufReader::new(stream);
    loop {
        let lines = read_head(&mut reader)?;
        let target = lines.first()?.split(' ').nth(1).unwrap_or("").to_owned();
        match target.as_str() {
            "/__seen" => {
                let text = seen.lock().unwrap().join("\n=====\n");
                answer(&mut writer, &text).ok()?;
                continue;
            }
            "/__reset" => {
                seen.lock().unwrap().clear();
                answer(&mut writer, "reset").ok()?;
                continue;
            }
            _ => {}
        }
        let is_chunked = header(&lines, "transfer-encoding").is_some();
        let length = header(&lines, "content-length").map(|value| value.parse::<usize>());
        let body = match (is_chunked, length) {
            (true, None) => read_chunked(&mut reader),
            (false, Some(Ok(length))) => read_sized(&mut reader, length),
            (false, None) => Ok((Vec::new(), 0)),
            _ => Err(BodyError::Garbage),
        };
        let (kept, total) = match body {
            Ok(body) => body,
            Err(error) => {
                let label = if matches!(error, BodyError::Cut) {
                    "CUT"
                } else {
                    "GARBAGE"
                };
                seen.lock()
                    .unwrap()
                    .push(format!("{label}\n{}", lines.join("\n")));
                return None;
            }
        };
        let text = String::from_utf8_lossy(&kept);
        seen.lock()
            .unwrap()
            .push(format!("{}\n\n[{total} bytes] {text}", lines.join("\n")));
        match target.as_str() {
            "/__ws" => {
                writer.write_all(b"HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n").ok()?;
                echo(reader, writer);
                return None;
            }
            "/__stream" => {
                stream_chunks(&mut writer).ok()?;
            }
            _ => answer(&mut writer, "ok").ok()?,
        }
    }
}

fn main() {
    let address = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "127.0.0.1:3000".to_owned());
    let listener = TcpListener::bind(address).unwrap();
    let seen: Seen = Arc::default();
    for stream in listener.incoming().flatten() {
        let seen = Arc::clone(&seen);
        spawn(move || serve(stream, &seen));
    }
}
