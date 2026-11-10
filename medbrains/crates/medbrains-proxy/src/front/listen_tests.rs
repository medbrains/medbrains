//! The accept loop's own rules: canned answers, who a LAN port takes, and what Pingora may parse.

use super::{BAD_REQUEST, NOT_ALLOWED, TIMED_OUT, TOO_LARGE, admits_peer, next_settings};
use bytes::BytesMut;
use pingora_core::apps::HttpPersistentSettings;
use pingora_core::protocols::http::ServerSession;
use std::net::IpAddr;

/// The Content-Length written by hand above must match its body, or a client hangs.
#[test]
fn every_canned_response_states_its_own_length() {
    for response in [BAD_REQUEST, NOT_ALLOWED, TIMED_OUT, TOO_LARGE] {
        let text = std::str::from_utf8(response).unwrap_or_default();
        let (head, body) = text.split_once("\r\n\r\n").unwrap_or_default();
        let declared = head
            .lines()
            .find_map(|line| line.strip_prefix("Content-Length: "))
            .and_then(|value| value.parse::<usize>().ok());
        assert_eq!(declared, Some(body.len()), "{head}");
    }
}

/// A local program picking 127.x.y.z must not pass as a node on the LAN port.
#[test]
fn a_lan_port_takes_loopback_only_from_the_machine_itself() -> anyhow::Result<()> {
    let ip = |text: &str| text.parse::<IpAddr>();
    for machine in ["127.0.0.1", "::1"] {
        assert!(admits_peer(true, ip(machine)?), "{machine}");
    }
    for forged in ["127.0.0.2", "127.5.6.7", "127.255.255.254"] {
        assert!(!admits_peer(true, ip(forged)?), "{forged} on the LAN port");
        assert!(
            admits_peer(false, ip(forged)?),
            "{forged} on the loopback port"
        );
    }
    for lan in ["192.168.1.20", "10.0.0.9", "fd00::9", "fe80::1"] {
        assert!(admits_peer(true, ip(lan)?), "{lan}");
    }
    Ok(())
}

/// Whatever Pingora read ahead never reaches its parser: only the head `check_head` passed does.
#[tokio::test]
async fn a_prefix_from_pingora_is_replaced_by_the_checked_head() -> anyhow::Result<()> {
    let (_client, server) = tokio::io::duplex(1024);
    let mut session = ServerSession::new_http1(Box::new(server));
    let mut reused = HttpPersistentSettings::for_session(&session);
    let smuggled = "GET /smuggled HTTP/1.1\r\nHost: a\r\nTransfer-Encoding: chunked\r\n\r\n";
    reused.set_pipelined_prefix(BytesMut::from(smuggled));
    let checked = BytesMut::from("GET /checked HTTP/1.1\r\nHost: medbrains.local\r\n\r\n");
    next_settings(Some(reused), &session, checked).apply_to_session(&mut session);
    anyhow::ensure!(session.read_request().await?, "no request");
    assert_eq!(session.req_header().uri.path(), "/checked");
    Ok(())
}
