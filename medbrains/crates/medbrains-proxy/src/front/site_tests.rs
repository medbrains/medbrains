//! The forwarding headers against the server's own rule, and the per-site rules.

use super::{Refused, Site, body_too_slow, set_forwarding};
use crate::config::Config;
use crate::names::Names;
use crate::test_rng::Rng;
use pingora_http::RequestHeader;
use std::net::IpAddr;
use std::time::{Duration, Instant};

const CLIENT: &str = "192.168.1.20";
const PROXY: &str = "127.0.0.1";
/// Forged forwarding headers, in every spelling a client might try.
const FORGED_HEADERS: [&str; 7] = [
    "X-Forwarded-For",
    "x-forwarded-for",
    "X-FORWARDED-FOR",
    "X-Real-IP",
    "Forwarded",
    "X-Forwarded-Host",
    "X-Forwarded-Proto",
];

/// A request as the client sent it.
fn request(path: &str, headers: &[(&str, &str)]) -> anyhow::Result<RequestHeader> {
    let mut req = RequestHeader::build("GET", path.as_bytes(), None)?;
    for (name, value) in headers {
        req.append_header((*name).to_owned(), *value)?;
    }
    Ok(req)
}

/// The names the tests use.
fn names() -> anyhow::Result<Names> {
    Names::parse("medbrains.local\n10.0.0.5\n").ok_or_else(|| anyhow::anyhow!("no names"))
}

/// The server's own rule: this is its source file, compiled here.
#[path = "../../../medbrains-server-core/src/middleware/client_resolve.rs"]
mod client_resolve;

/// The value of a header, which must appear exactly once.
fn single<'a>(req: &'a RequestHeader, name: &str) -> anyhow::Result<&'a str> {
    let mut values = req.headers.get_all(name).iter();
    let value = values.next().ok_or_else(|| anyhow::anyhow!("no {name}"))?;
    anyhow::ensure!(values.next().is_none(), "{name} appears twice");
    Ok(value.to_str()?)
}

#[test]
fn a_forged_forwarding_header_never_reaches_the_server() -> anyhow::Result<()> {
    let mut req = request(
        "/",
        &[
            ("Host", "medbrains.local"),
            ("X-Forwarded-For", "6.6.6.6, 7.7.7.7"),
            ("x-forwarded-for", "8.8.8.8"),
            ("X-Real-IP", "6.6.6.6"),
            ("Forwarded", "for=6.6.6.6"),
            ("X-Forwarded-Host", "evil.example"),
            ("X-Forwarded-Proto", "http"),
            ("Proxy", "http://evil.example"),
        ],
    )?;
    set_forwarding(&mut req, CLIENT.parse()?, "medbrains.local")?;
    assert_eq!(single(&req, "x-forwarded-for")?, CLIENT);
    assert_eq!(single(&req, "x-real-ip")?, CLIENT);
    assert_eq!(single(&req, "x-forwarded-proto")?, "https");
    assert_eq!(single(&req, "x-forwarded-host")?, "medbrains.local");
    assert!(req.headers.get("forwarded").is_none());
    assert!(req.headers.get("proxy").is_none());
    Ok(())
}

#[test]
fn a_forged_host_does_not_reach_the_server_either() -> anyhow::Result<()> {
    let site = open_site()?;
    let forged = request("/", &[("Host", "evil.example")])?;
    assert_eq!(site.upstream_host(&forged, false), "medbrains.local");
    let ours = request("/", &[("Host", "10.0.0.5:443")])?;
    assert_eq!(site.upstream_host(&ours, false), "10.0.0.5:443");
    let mut req = request("/", &[("Host", "evil.example")])?;
    set_forwarding(
        &mut req,
        CLIENT.parse()?,
        &site.upstream_host(&forged, false),
    )?;
    assert_eq!(single(&req, "host")?, "medbrains.local");
    assert_eq!(single(&req, "x-forwarded-host")?, "medbrains.local");
    Ok(())
}

#[test]
fn a_site_with_its_own_name_keeps_it() -> anyhow::Result<()> {
    let site = identity_site()?;
    let req = request("/", &[("Host", "idm.medbrains.local:9443")])?;
    assert_eq!(site.upstream_host(&req, false), "idm.medbrains.local:9443");
    Ok(())
}

/// The screen's own address must not end up in a link mailed to someone at another machine.
#[test]
fn the_loopback_port_forwards_the_machines_name() -> anyhow::Result<()> {
    let site = open_site()?;
    let screen = request("/", &[("Host", "127.0.0.1:8443")])?;
    assert_eq!(site.upstream_host(&screen, true), "medbrains.local");
    assert_eq!(site.upstream_host(&screen, false), "medbrains.local");
    let lan = request("/", &[("Host", "10.0.0.5")])?;
    assert_eq!(site.upstream_host(&lan, true), "medbrains.local");
    assert_eq!(site.upstream_host(&lan, false), "10.0.0.5");
    let identity = identity_site()?;
    let own = request("/", &[("Host", "idm.medbrains.local")])?;
    assert_eq!(identity.upstream_host(&own, true), "idm.medbrains.local");
    Ok(())
}

/// A Wi-Fi roam stalls a reader for a second or two. With the front's own limits a small response
/// must survive that, which needs the vendored Pingora patch: upstream gave a small write 1 s.
#[tokio::test]
async fn a_two_second_stall_does_not_cut_a_small_response_off() -> anyhow::Result<()> {
    use pingora_core::protocols::http::ServerSession;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    const STALL: Duration = Duration::from_secs(2);
    const BODY: usize = 1000;
    // A pipe smaller than the response, so every write waits for the reader.
    let (mut client, server) = tokio::io::duplex(64);
    let mut session = ServerSession::new_http1(Box::new(server));
    client
        .write_all(b"GET / HTTP/1.1\r\nHost: medbrains.local\r\n\r\n")
        .await?;
    anyhow::ensure!(session.read_request().await?, "no request");
    session.set_write_timeout(Some(super::CLIENT_WRITE));
    session.set_min_send_rate(Some(super::CLIENT_MIN_BYTES_PER_SEC));
    let reader = tokio::spawn(async move {
        tokio::time::sleep(STALL).await;
        let mut seen = Vec::new();
        client.read_to_end(&mut seen).await.map(|_| seen)
    });
    let mut resp = pingora_http::ResponseHeader::build(200, None)?;
    resp.set_content_length(BODY)?;
    session.write_response_header(Box::new(resp)).await?;
    session
        .write_response_body(bytes::Bytes::from(vec![b'x'; BODY]), true)
        .await?;
    session.finish_body().await?;
    drop(session);
    let seen = reader.await??;
    assert!(
        seen.ends_with(&[b'x'; BODY]),
        "the whole body arrives after the stall"
    );
    Ok(())
}

/// Whatever a client forges, the server's own right-to-left rule arrives at the true address.
#[test]
fn property_the_server_always_resolves_the_true_client() -> anyhow::Result<()> {
    let proxy: IpAddr = PROXY.parse()?;
    let trusted: [ipnet::IpNet; 2] = ["127.0.0.1/32".parse()?, "::1/128".parse()?];
    let values = [
        "6.6.6.6",
        "127.0.0.1",
        "::1",
        "not-an-ip",
        "6.6.6.6, 127.0.0.1",
        ",",
        "1.1.1.1:80",
    ];
    let clients = [
        "192.168.1.20",
        "10.0.0.9",
        "fd00::9",
        "127.0.0.1",
        "127.3.2.1",
    ];
    let mut rng = Rng(0xFACE_FEED_0BAD_F00D);
    for _ in 0..20_000 {
        let client: IpAddr = rng.pick(&clients).parse()?;
        let mut pairs = vec![("Host", "medbrains.local")];
        for _ in 0..rng.next() % 5 {
            pairs.push((rng.pick(&FORGED_HEADERS), rng.pick(&values)));
        }
        let mut req = request("/", &pairs)?;
        set_forwarding(&mut req, client, "medbrains.local")?;
        let chain = single(&req, "x-forwarded-for")?;
        let real_ip = single(&req, "x-real-ip")?;
        let resolved = client_resolve::resolve_client(proxy, Some(chain), Some(real_ip), &trusted);
        assert_eq!(resolved, client, "{pairs:?}");
    }
    Ok(())
}

/// A site with no rules beyond the machine's names.
fn open_site() -> anyhow::Result<Site> {
    let text = r#"
        names_file = "/n"
        redirect_listen = []
        [[sites]]
        name = "app"
        upstream = "127.0.0.1:3000"
        error_page = "Not answering."
        [[sites.listen]]
        addr = "0.0.0.0:443"
        cert = "/c"
        key = "/k"
    "#;
    let config = Config::parse(text)?;
    let site = config
        .sites
        .first()
        .ok_or_else(|| anyhow::anyhow!("site"))?;
    Site::new(site, names()?)
}

/// A site with one blocked path, one limited path and one allowed name.
fn identity_site() -> anyhow::Result<Site> {
    let text = r#"
        names_file = "/n"
        redirect_listen = []
        [[sites]]
        name = "identity"
        upstream = "127.0.0.1:8444"
        error_page = "Sign-in is not answering."
        only_hosts = ["idm.medbrains.local"]
        block_paths = ["/scim/", "/docs", "/ui/login/oauth2_landing"]
        max_body_bytes = 100
        [[sites.listen]]
        addr = "0.0.0.0:9443"
        cert = "/c"
        key = "/k"
        [[sites.limits]]
        path = "/v1/auth"
        burst = 2
        per_minute = 60
    "#;
    let config = Config::parse(text)?;
    let site = config
        .sites
        .first()
        .ok_or_else(|| anyhow::anyhow!("site"))?;
    Site::new(site, names()?)
}

/// What the identity site does with a request, from the one test client.
fn verdict(site: &Site, path: &str, headers: &[(&str, &str)]) -> anyhow::Result<Option<Refused>> {
    let req = request(path, headers)?;
    Ok(site.refusal(&req, CLIENT.parse()?, Instant::now()))
}

#[test]
fn a_blocked_path_is_not_found_however_it_is_spelled() -> anyhow::Result<()> {
    let site = identity_site()?;
    let host = [("Host", "idm.medbrains.local:9443")];
    for path in [
        "/scim/v1/x",
        "//scim/v1",
        "/%73cim/v1",
        "/a/../scim/v1",
        "/SCIM/v1",
        "/docs",
        "/docs/x",
    ] {
        let refused = verdict(&site, path, &host)?;
        assert_eq!(refused.map(|r| r.status), Some(404), "{path}");
    }
    assert_eq!(verdict(&site, "/ui/login", &host)?, None);
    assert_eq!(
        verdict(&site, "/scimx", &host)?,
        None,
        "only the prefix is blocked"
    );
    Ok(())
}

#[test]
fn only_its_own_name_may_use_the_identity_site() -> anyhow::Result<()> {
    let site = identity_site()?;
    let refused = verdict(&site, "/ui/login", &[("Host", "medbrains.local")])?;
    assert_eq!(refused.map(|r| r.status), Some(421));
    assert_eq!(
        verdict(&site, "/ui/login", &[("Host", "IDM.medbrains.local")])?,
        None
    );
    Ok(())
}

#[test]
fn a_declared_body_over_the_limit_is_refused_before_it_is_read() -> anyhow::Result<()> {
    let site = identity_site()?;
    let headers = [("Host", "idm.medbrains.local"), ("Content-Length", "101")];
    assert_eq!(verdict(&site, "/x", &headers)?.map(|r| r.status), Some(413));
    let headers = [("Host", "idm.medbrains.local"), ("Content-Length", "100")];
    assert_eq!(verdict(&site, "/x", &headers)?, None);
    Ok(())
}

#[test]
fn sign_ins_are_limited_per_address_with_a_retry_time() -> anyhow::Result<()> {
    let site = identity_site()?;
    let host = [("Host", "idm.medbrains.local")];
    assert_eq!(verdict(&site, "/v1/auth", &host)?, None);
    assert_eq!(verdict(&site, "/v1/auth", &host)?, None);
    let refused = verdict(&site, "/v1/auth", &host)?;
    assert_eq!(
        refused.map(|r| (r.status, r.retry_after)),
        Some((429, Some(1)))
    );
    assert_eq!(
        verdict(&site, "/ui/login", &host)?,
        None,
        "other paths are untouched"
    );
    let other = request("/v1/auth", &host)?;
    assert_eq!(
        site.refusal(&other, "192.168.1.21".parse()?, Instant::now()),
        None
    );
    Ok(())
}

#[test]
fn a_slow_body_is_judged_only_after_its_grace() {
    assert!(!body_too_slow(0, Duration::from_secs(20)), "still in grace");
    assert!(body_too_slow(1, Duration::from_secs(21)), "a trickle");
    assert!(
        !body_too_slow(1024 * 1024, Duration::from_secs(60)),
        "a slow but real upload"
    );
    assert!(body_too_slow(1024, Duration::from_secs(60)));
}

/// With `lan_paths`, the LAN reaches only those prefixes; the machine itself reaches the rest.
#[test]
fn the_lan_reaches_only_its_paths_and_the_machine_reaches_all() -> anyhow::Result<()> {
    let text = r#"
        names_file = "/n"
        redirect_listen = []
        [[sites]]
        name = "identity"
        upstream = "127.0.0.1:8444"
        error_page = "Sign-in is not answering."
        lan_paths = ["/ui", "/v1/auth"]
        [[sites.listen]]
        addr = "0.0.0.0:9443"
        cert = "/c"
        key = "/k"
        reserved_for_machine = 1
    "#;
    let config = Config::parse(text)?;
    let site = Site::new(
        config
            .sites
            .first()
            .ok_or_else(|| anyhow::anyhow!("site"))?,
        names()?,
    )?;
    let host = [("Host", "idm.medbrains.local:9443")];
    let ask = |path: &str, client: &str| -> anyhow::Result<Option<u16>> {
        let req = request(path, &host)?;
        Ok(site
            .refusal(&req, client.parse()?, Instant::now())
            .map(|r| r.status))
    };
    assert_eq!(ask("/ui/login", CLIENT)?, None);
    assert_eq!(ask("/v1/auth", CLIENT)?, None);
    for path in ["/v1/raw/search", "/v1/person", "/%761/raw", "/scim/v1"] {
        assert_eq!(ask(path, CLIENT)?, Some(404), "{path} from the LAN");
    }
    assert_eq!(
        ask("/v1/raw/search", "127.0.0.1")?,
        None,
        "the machine itself"
    );
    assert_eq!(
        ask("/v1/raw/search", "::1")?,
        None,
        "the machine itself over IPv6"
    );
    Ok(())
}
