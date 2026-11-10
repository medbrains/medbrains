//! Host parsing, redirects and path normalisation, as attacks and as properties.

use super::{Names, canonical_ip, normalize_path, parse_host};
use crate::test_rng::Rng;
use std::net::{IpAddr, Ipv4Addr};

const LOCAL: IpAddr = IpAddr::V4(Ipv4Addr::new(10, 0, 0, 5));
const NAMES: &str = "medbrains.local\n# not a name\n10.0.0.5\n[::1]\nhims.hospital.example\n";

/// The names most tests use.
fn names() -> anyhow::Result<Names> {
    Names::parse(NAMES).ok_or_else(|| anyhow::anyhow!("no names"))
}

/// The host part of an `https://` URL, read the way a browser reads it: up to the first `/`, `?`,
/// `#` or `\`, then after any `@`.
fn authority(location: &str) -> &str {
    let rest = location.strip_prefix("https://").unwrap_or("");
    let end = rest.find(['/', '?', '#', '\\']).unwrap_or(rest.len());
    let authority = rest.get(..end).unwrap_or("");
    authority.rsplit('@').next().unwrap_or("")
}

#[test]
fn host_forms_parse() {
    assert_eq!(parse_host("medbrains.local"), Some("medbrains.local"));
    assert_eq!(parse_host("medbrains.local:443"), Some("medbrains.local"));
    assert_eq!(parse_host("10.0.0.5:8443"), Some("10.0.0.5"));
    assert_eq!(parse_host("[::1]:443"), Some("::1"));
    assert_eq!(parse_host("[::1]"), Some("::1"));
    for bad in [
        "", "a/b", "a b", "a@b", "a:b", "a:", "a:99999", "[::1", "[zz]", "[::1]x", "-a", "a..b",
        "a\\b",
    ] {
        assert_eq!(parse_host(bad), None, "{bad}");
    }
}

#[test]
fn a_file_with_no_valid_name_is_refused() {
    assert!(Names::parse("# nothing\n\n").is_none());
}

#[test]
fn a_redirect_keeps_a_name_of_ours_and_the_path() -> anyhow::Result<()> {
    let names = names()?;
    let to = |host, target| names.redirect_location(Some(host), Some(LOCAL), target);
    assert_eq!(
        to("medbrains.local", "/login?a=1"),
        "https://medbrains.local/login?a=1"
    );
    assert_eq!(to("MEDBRAINS.LOCAL:80", "/"), "https://MEDBRAINS.LOCAL/");
    assert_eq!(to("[::1]:80", "/x"), "https://[::1]/x");
    assert_eq!(to("10.0.0.5", "*"), "https://10.0.0.5/");
    Ok(())
}

#[test]
fn a_forged_host_cannot_aim_a_redirect_elsewhere() -> anyhow::Result<()> {
    let names = names()?;
    for forged in [
        "evil.example",
        "evil.example:443",
        "medbrains.local.evil.example",
        "medbrains.local@evil.example",
    ] {
        let location = names.redirect_location(Some(forged), Some(LOCAL), "/login");
        assert_eq!(location, "https://10.0.0.5/login", "{forged}");
    }
    let nothing_known = names.redirect_location(None, None, "/");
    assert_eq!(nothing_known, "https://medbrains.local/");
    Ok(())
}

/// Whatever the client sends as Host or target, the redirect's real destination is ours.
#[test]
fn property_a_redirect_never_leaves_this_machine() -> anyhow::Result<()> {
    let names = names()?;
    let pieces = [
        "medbrains.local",
        "evil.example",
        "@",
        ":",
        "/",
        "\\",
        "?",
        "#",
        "%2f",
        ".",
        "[",
        "]",
        "10.0.0.5",
        "::1",
        ":443",
        "//",
    ];
    let allowed = [
        "medbrains.local",
        "10.0.0.5",
        "[::1]",
        "hims.hospital.example",
    ];
    let mut rng = Rng(0xA5A5_1234_DEAD_BEEF);
    for _ in 0..200_000 {
        let mut text = [String::new(), String::from("/")];
        for part in &mut text {
            for _ in 0..rng.next() % 5 {
                part.push_str(rng.pick(&pieces));
            }
        }
        let [host, target] = &text;
        let location = names.redirect_location(Some(host), Some(LOCAL), target);
        let found = authority(&location).to_ascii_lowercase();
        assert!(
            allowed.contains(&found.as_str()),
            "{host:?} {target:?} -> {location:?}"
        );
    }
    Ok(())
}

#[test]
fn the_server_only_believes_a_host_of_ours() -> anyhow::Result<()> {
    let names = names()?;
    assert_eq!(
        names.trusted_host(Some("medbrains.local:443")),
        "medbrains.local:443"
    );
    assert_eq!(names.trusted_host(Some("10.0.0.5")), "10.0.0.5");
    assert_eq!(names.trusted_host(Some("evil.example")), "medbrains.local");
    assert_eq!(names.trusted_host(Some("a/b")), "medbrains.local");
    assert_eq!(names.trusted_host(None), "medbrains.local");
    Ok(())
}

#[test]
fn every_spelling_of_a_blocked_path_normalises_to_it() {
    for path in [
        "/scim/v1",
        "//scim/v1",
        "/./scim/v1",
        "/a/../scim/v1",
        "/%73cim/v1",
        "/%2573cim/v1",
        "/SCIM/v1",
        "/%53cim/v1",
        "/scim%2fv1",
        "/x/%2e%2e/scim/v1",
        "\\scim\\v1",
        "/x/%2E%2E%2Fscim/v1",
    ] {
        assert_eq!(normalize_path(path).as_deref(), Some("/scim/v1"), "{path}");
    }
    assert_eq!(normalize_path("/scim/").as_deref(), Some("/scim/"));
    assert_eq!(normalize_path("/").as_deref(), Some("/"));
    assert_eq!(normalize_path("/../..").as_deref(), Some("/"));
}

#[test]
fn a_path_hiding_under_too_many_encodings_is_refused() {
    assert_eq!(normalize_path("/%25252573cim"), None);
    assert_eq!(normalize_path("/a%00b"), None);
}

/// Normalising is stable, always absolute, and never leaves a `..` behind.
#[test]
fn property_normalised_paths_are_stable_and_absolute() {
    let pieces = [
        "/", "..", ".", "%2e", "%2f", "%5c", "\\", "a", "scim", "%25", "%", "%zz", "//",
    ];
    let mut rng = Rng(0x1357_9BDF_0246_8ACE);
    for _ in 0..200_000 {
        let mut path = String::from("/");
        for _ in 0..rng.next() % 8 {
            path.push_str(rng.pick(&pieces));
        }
        let Some(normal) = normalize_path(&path) else {
            continue;
        };
        assert!(normal.starts_with('/'), "{path:?} -> {normal:?}");
        assert!(
            !normal.split('/').any(|segment| segment == ".."),
            "{path:?} -> {normal:?}"
        );
        assert_eq!(
            normalize_path(&normal).as_deref(),
            Some(normal.as_str()),
            "{path:?}"
        );
    }
}

#[test]
fn an_ipv4_client_on_a_dual_stack_socket_stays_one_address() -> anyhow::Result<()> {
    let mapped: IpAddr = "::ffff:10.0.0.9".parse()?;
    assert_eq!(canonical_ip(mapped), IpAddr::V4(Ipv4Addr::new(10, 0, 0, 9)));
    let plain: IpAddr = "fd00::9".parse()?;
    assert_eq!(canonical_ip(plain), plain);
    Ok(())
}
