#![allow(clippy::unwrap_used, clippy::expect_used)]

use super::*;

const KEY: &[u8] = b"0123456789abcdef0123456789abcdef";

fn ip(s: &str) -> IpAddr {
    s.parse().unwrap()
}

#[test]
fn only_hospital_network_addresses_pass_unapproved() {
    for allowed in [
        "10.1.2.3",
        "172.16.0.9",
        "192.168.1.20",
        "100.100.1.1",
        "fd00::5",
    ] {
        assert!(is_hospital_network(ip(allowed), true), "{allowed}");
    }
    for refused in [
        "8.8.8.8",
        "172.32.0.1",
        "100.128.0.1",
        "2001:4860::8888",
        "169.254.169.254",
    ] {
        assert!(!is_hospital_network(ip(refused), true), "{refused}");
    }
    // Loopback is the server itself: development only.
    assert!(is_hospital_network(ip("127.0.0.1"), false));
    assert!(!is_hospital_network(ip("127.0.0.1"), true));
    assert!(!is_hospital_network(ip("::ffff:127.0.0.1"), true));
}

#[test]
fn metadata_and_loopback_are_reserved_even_for_approved_hosts() {
    assert!(is_reserved(ip("169.254.169.254"), false));
    assert!(is_reserved(ip("0.0.0.0"), false));
    assert!(is_reserved(ip("127.0.0.1"), true));
    assert!(!is_reserved(ip("127.0.0.1"), false));
    assert!(!is_reserved(ip("203.0.113.7"), true));
}

#[tokio::test]
async fn public_and_malformed_addresses_are_refused_before_any_connection() {
    let policy = Policy {
        production: true,
        approved_hosts: vec![],
    };
    for raw in [
        "http://8.8.8.8:8042",
        "https://169.254.169.254/latest/meta-data",
        "ftp://10.0.0.5",
        "http://medbrains:secret@10.0.0.5:8042",
        "http://127.0.0.1:8042",
        "not a url",
    ] {
        assert!(
            matches!(vet(raw, &policy).await, Err(PacsError::NotAllowed(_))),
            "{raw}"
        );
    }
    assert!(vet("http://10.0.0.5:8042/", &policy).await.is_ok());
}

#[tokio::test]
async fn an_approved_outside_host_must_use_https() {
    let policy = Policy {
        production: true,
        approved_hosts: vec!["8.8.8.8".to_owned()],
    };
    assert!(matches!(
        vet("http://8.8.8.8", &policy).await,
        Err(PacsError::NotAllowed(_))
    ));
    assert!(vet("https://8.8.8.8", &policy).await.is_ok());
}

#[test]
fn the_password_opens_only_for_its_own_tenant_address_and_username() {
    let (tenant, other) = (Uuid::new_v4(), Uuid::new_v4());
    let url = "http://10.0.0.5:8042";
    let sealed = seal(KEY, tenant, url, "medbrains", "s3cret").unwrap();
    assert!(!sealed.contains("s3cret"));
    assert_eq!(
        unseal(KEY, tenant, "http://10.0.0.5:8042/", "medbrains", &sealed).unwrap(),
        "s3cret"
    );
    assert!(unseal(KEY, tenant, "http://10.0.0.6:8042", "medbrains", &sealed).is_err());
    assert!(unseal(KEY, tenant, url, "admin", &sealed).is_err());
    assert!(unseal(KEY, other, url, "medbrains", &sealed).is_err());
}

#[tokio::test]
async fn a_moved_address_keeps_the_old_password_locked() {
    let tenant = Uuid::new_v4();
    let secrets = medbrains_core::secrets::EnvSecretResolver::new();
    let key = sealing_key(&secrets).await.unwrap();
    let sealed = seal(&key, tenant, "http://10.0.0.5:8042", "medbrains", "s3cret").unwrap();
    let config = |url: &str| {
        serde_json::json!({
            "orthanc_url": url,
            "orthanc_username": "medbrains",
            SEALED_PASSWORD_KEY: sealed,
        })
    };
    let policy = Policy::default();
    let saved = target_from_config(tenant, &config("http://10.0.0.5:8042"), &secrets, &policy)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(
        saved.auth,
        Some(("medbrains".to_owned(), "s3cret".to_owned()))
    );
    // Someone rewrites the row to a new address but keeps the sealed blob.
    let moved =
        target_from_config(tenant, &config("http://10.9.9.9:8042"), &secrets, &policy).await;
    assert!(matches!(moved, Err(PacsError::NotSetUp(_))), "{moved:?}");
}

#[tokio::test]
async fn the_password_goes_to_an_allowed_pacs_only_and_never_follows_a_redirect() {
    use base64::Engine;
    use wiremock::matchers::{any, path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    let pacs = MockServer::start().await;
    let elsewhere = MockServer::start().await;
    Mock::given(path("/moved"))
        .respond_with(
            ResponseTemplate::new(302).insert_header("location", format!("{}/x", elsewhere.uri())),
        )
        .mount(&pacs)
        .await;
    Mock::given(any())
        .respond_with(ResponseTemplate::new(200))
        .mount(&pacs)
        .await;
    Mock::given(any())
        .respond_with(ResponseTemplate::new(200))
        .mount(&elsewhere)
        .await;

    let tenant = Uuid::new_v4();
    let secrets = medbrains_core::secrets::EnvSecretResolver::new();
    let key = sealing_key(&secrets).await.unwrap();
    let config = serde_json::json!({
        "orthanc_url": pacs.uri(),
        "orthanc_username": "medbrains",
        SEALED_PASSWORD_KEY: seal(&key, tenant, &pacs.uri(), "medbrains", "s3cret").unwrap(),
    });

    // Production: the server's own loopback is not a PACS, and an approved
    // host still needs https. Refused before any connection is made.
    for policy in [
        Policy {
            production: true,
            approved_hosts: vec![],
        },
        Policy {
            production: true,
            approved_hosts: vec!["127.0.0.1".to_owned()],
        },
    ] {
        let refused = target_from_config(tenant, &config, &secrets, &policy).await;
        assert!(
            matches!(refused, Err(PacsError::NotAllowed(_))),
            "{refused:?}"
        );
    }
    assert!(pacs.received_requests().await.unwrap().is_empty());

    // Development allows loopback: the password arrives, as basic auth.
    let target = target_from_config(tenant, &config, &secrets, &Policy::default())
        .await
        .unwrap()
        .unwrap();
    target.get("/system").send().await.unwrap();
    let moved = target.get("/moved").send().await.unwrap();
    assert_eq!(moved.status(), 302, "the redirect is not followed");
    let expected = format!(
        "Basic {}",
        base64::engine::general_purpose::STANDARD.encode("medbrains:s3cret")
    );
    let seen = pacs.received_requests().await.unwrap();
    assert_eq!(seen.len(), 2);
    assert_eq!(
        seen[0]
            .headers
            .get("authorization")
            .unwrap()
            .to_str()
            .unwrap(),
        expected
    );
    assert!(elsewhere.received_requests().await.unwrap().is_empty());
}
