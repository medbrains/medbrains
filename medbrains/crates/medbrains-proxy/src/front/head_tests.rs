//! The gate's rules, each as the attack it stops, then properties over generated heads.

use super::{Refusal, Scan, check_head, scan_head};
use crate::test_rng::Rng;

const OK_POST: &str = "POST /api/x HTTP/1.1\r\nHost: medbrains.local\r\nContent-Length: 5\r\n\r\n";

#[test]
fn an_ordinary_request_passes() {
    assert_eq!(check_head(OK_POST.as_bytes()), Ok(()));
    let get = "GET / HTTP/1.1\r\nHost: 10.0.0.5:443\r\nAccept: */*\r\nCookie: a=b; c=d\r\n\r\n";
    assert_eq!(check_head(get.as_bytes()), Ok(()));
    let old = "GET / HTTP/1.0\r\nHost: medbrains.local\r\n\r\n";
    assert_eq!(check_head(old.as_bytes()), Ok(()));
    let ws = "GET /api/ws/notifications HTTP/1.1\r\nHost: a\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n";
    assert_eq!(check_head(ws.as_bytes()), Ok(()));
}

#[test]
fn every_smuggling_framing_is_refused() {
    let cases: [(&str, &str); 19] = [
        (
            "CL.TE",
            "Host: a\r\nContent-Length: 4\r\nTransfer-Encoding: chunked",
        ),
        (
            "TE.CL",
            "Host: a\r\nTransfer-Encoding: chunked\r\nContent-Length: 4",
        ),
        (
            "TE.CL lower",
            "host: a\r\ntransfer-encoding: chunked\r\ncontent-length: 4",
        ),
        (
            "duplicate CL same",
            "Host: a\r\nContent-Length: 4\r\nContent-Length: 4",
        ),
        (
            "duplicate CL differ",
            "Host: a\r\nContent-Length: 4\r\nContent-Length: 40",
        ),
        ("CL list", "Host: a\r\nContent-Length: 4, 4"),
        ("CL plus sign", "Host: a\r\nContent-Length: +4"),
        ("CL hex", "Host: a\r\nContent-Length: 0x4"),
        ("CL empty", "Host: a\r\nContent-Length:"),
        ("CL negative", "Host: a\r\nContent-Length: -1"),
        ("TE obfuscated", "Host: a\r\nTransfer-Encoding: xchunked"),
        ("TE list", "Host: a\r\nTransfer-Encoding: chunked, identity"),
        (
            "TE twice",
            "Host: a\r\nTransfer-Encoding: chunked\r\nTransfer-Encoding: chunked",
        ),
        (
            "TE space before colon",
            "Host: a\r\nTransfer-Encoding : chunked",
        ),
        ("TE tab in name", "Host: a\r\nTransfer-Encoding\t: chunked"),
        (
            "TE vertical tab",
            "Host: a\r\nTransfer-Encoding: \x0bchunked",
        ),
        (
            "folded TE",
            "Host: a\r\nX: y\r\n Transfer-Encoding: chunked",
        ),
        ("folded value", "Host: a\r\nTransfer-Encoding:\r\n chunked"),
        ("bare CR", "Host: a\r\nX: y\rTransfer-Encoding: chunked"),
    ];
    for (name, headers) in cases {
        let head = format!("POST / HTTP/1.1\r\n{headers}\r\n\r\n");
        assert_eq!(
            check_head(head.as_bytes()),
            Err(Refusal::Malformed),
            "{name}"
        );
    }
}

#[test]
fn host_must_be_single_and_clean() {
    for headers in [
        "Accept: x",
        "Host: a\r\nHost: b",
        "Host: a/b",
        "Host: a@b",
        "Host: a b",
        "Host: a:99999",
        "Host: a:+80",
        "Host: [::1",
        "Host: ",
    ] {
        let head = format!("GET / HTTP/1.1\r\n{headers}\r\n\r\n");
        assert_eq!(
            check_head(head.as_bytes()),
            Err(Refusal::Malformed),
            "{headers}"
        );
    }
}

#[test]
fn a_request_line_is_read_only_one_way() {
    for line in [
        "GET http://evil.example/ HTTP/1.1",
        "GET  / HTTP/1.1",
        "GET /\tHTTP/1.1",
        "GET / HTTP/1.1 ",
        "GET / HTTP/2.0",
        "GET / HTTP/0.9",
        "GET /a b HTTP/1.1",
        "G3T / HTTP/1.1",
        "GET evil.example HTTP/1.1",
        "/ HTTP/1.1",
    ] {
        let head = format!("{line}\r\nHost: a\r\n\r\n");
        assert_eq!(
            check_head(head.as_bytes()),
            Err(Refusal::Malformed),
            "{line}"
        );
    }
    for method in ["TRACE", "CONNECT", "trace"] {
        let head = format!("{method} / HTTP/1.1\r\nHost: a\r\n\r\n");
        assert_eq!(
            check_head(head.as_bytes()),
            Err(Refusal::Method),
            "{method}"
        );
    }
}

#[test]
fn old_http_may_not_use_chunked_and_h2c_may_not_upgrade() {
    let old = "POST / HTTP/1.0\r\nHost: a\r\nTransfer-Encoding: chunked\r\n\r\n";
    assert_eq!(check_head(old.as_bytes()), Err(Refusal::Malformed));
    let h2c =
        "GET / HTTP/1.1\r\nHost: a\r\nConnection: Upgrade, HTTP2-Settings\r\nUpgrade: h2c\r\n\r\n";
    assert_eq!(check_head(h2c.as_bytes()), Err(Refusal::Malformed));
}

#[test]
fn only_a_websocket_open_may_upgrade() {
    let upgrade = "Host: a\r\nConnection: Upgrade\r\nUpgrade: websocket";
    for head in [
        format!("POST /api/auth/login HTTP/1.1\r\n{upgrade}\r\nContent-Length: 100\r\n\r\n"),
        format!("POST /api/auth/login HTTP/1.1\r\n{upgrade}\r\n\r\n"),
        format!("PUT /x HTTP/1.1\r\n{upgrade}\r\n\r\n"),
        format!("get /x HTTP/1.1\r\n{upgrade}\r\n\r\n"),
        format!("GET /x HTTP/1.1\r\n{upgrade}\r\nContent-Length: 1\r\n\r\n"),
        format!("GET /x HTTP/1.1\r\n{upgrade}\r\nTransfer-Encoding: chunked\r\n\r\n"),
        format!("GET /x HTTP/1.1\r\n{upgrade}\r\nUpgrade: websocket\r\n\r\n"),
        format!("GET /x HTTP/1.0\r\n{upgrade}\r\n\r\n"),
    ] {
        assert_eq!(
            check_head(head.as_bytes()),
            Err(Refusal::Malformed),
            "{head}"
        );
    }
    let open = format!("GET /x HTTP/1.1\r\n{upgrade}\r\n\r\n");
    assert_eq!(check_head(open.as_bytes()), Ok(()));
}

#[test]
fn too_many_headers_are_refused() {
    let many = "X: y\r\n".repeat(129);
    let head = format!("GET / HTTP/1.1\r\nHost: a\r\n{many}\r\n");
    assert_eq!(check_head(head.as_bytes()), Err(Refusal::Malformed));
}

#[test]
fn a_bare_line_feed_is_caught_as_soon_as_it_arrives() {
    assert_eq!(scan_head(b"GET / HTTP/1.1\n", 0), Scan::BareLineFeed);
    assert_eq!(scan_head(b"\n", 0), Scan::BareLineFeed);
    assert_eq!(
        scan_head(b"GET / HTTP/1.1\r\nHost: a\n\n", 0),
        Scan::BareLineFeed
    );
}

#[test]
fn property_scanning_in_pieces_finds_the_same_end_as_scanning_at_once() {
    let bytes = format!("{OK_POST}hello");
    let bytes = bytes.as_bytes();
    assert_eq!(scan_head(bytes, 0), Scan::Complete(OK_POST.len()));
    let mut rng = Rng(0x9E37_79B9_7F4A_7C15);
    for _ in 0..500 {
        let (mut seen, mut from, mut found) = (0, 0, None);
        while seen < bytes.len() && found.is_none() {
            let step = 1 + usize::try_from(rng.next() % 9).unwrap_or(0);
            seen = (seen + step).min(bytes.len());
            match scan_head(bytes.get(..seen).unwrap_or_default(), from) {
                Scan::Partial(at) => from = at,
                done => found = Some(done),
            }
        }
        assert_eq!(found, Some(Scan::Complete(OK_POST.len())));
    }
}

/// Any mix of framing headers passes only if exactly one Host and at most one framing header
/// exist, and each is in its one clean form. This is the invariant that stops smuggling.
#[test]
fn property_a_head_passes_only_with_unambiguous_framing() {
    let names = [
        "Content-Length",
        "content-LENGTH",
        "Transfer-Encoding",
        "TRANSFER-encoding",
        "Host",
        "X-A",
    ];
    let values = [
        "5", "chunked", "CHUNKED", "a", "5, 5", "+5", " chunked", "chunked ", "xchunked", "", "\t5",
    ];
    let mut rng = Rng(0xDEAD_BEEF_CAFE_F00D);
    for _ in 0..200_000 {
        let mut head = String::from("POST / HTTP/1.1\r\n");
        let (mut hosts, mut lengths, mut encodings, mut clean) = (0, 0, 0, true);
        for _ in 0..rng.next() % 5 {
            let (name, value) = (rng.pick(&names), rng.pick(&values));
            head += &[name, ": ", value, "\r\n"].concat();
            let trimmed = value.trim();
            match name.to_ascii_lowercase().as_str() {
                "host" => {
                    hosts += 1;
                    clean &= crate::names::parse_host(trimmed).is_some();
                }
                "content-length" => {
                    lengths += 1;
                    clean &= trimmed == "5";
                }
                "transfer-encoding" => {
                    encodings += 1;
                    clean &= trimmed.eq_ignore_ascii_case("chunked");
                }
                _ => {}
            }
        }
        head.push_str("\r\n");
        let expected = hosts == 1 && lengths + encodings <= 1 && clean;
        assert_eq!(check_head(head.as_bytes()).is_ok(), expected, "{head:?}");
    }
}

/// Random bytes never panic the gate, and nothing without a proper end ever passes.
#[test]
fn property_arbitrary_bytes_never_panic() {
    let mut rng = Rng(0x0123_4567_89AB_CDEF);
    let alphabet = b"\r\n :/GETPOSHtcl\t\0\x7f\xff";
    for _ in 0..100_000 {
        let length = usize::try_from(rng.next() % 64).unwrap_or(0);
        let bytes: Vec<u8> = (0..length)
            .map(|_| {
                let index = usize::try_from(rng.next() % alphabet.len() as u64).unwrap_or(0);
                alphabet.get(index).copied().unwrap_or(b' ')
            })
            .collect();
        let scan = scan_head(&bytes, 0);
        assert!(!matches!(scan, Scan::Complete(end) if end > bytes.len()));
        assert!(check_head(&bytes).is_err() || bytes.ends_with(b"\r\n\r\n"));
    }
}
