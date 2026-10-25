use std::collections::HashMap;
use std::time::{Duration, Instant};

use super::{AccessToken, AuthError, FederationConfig, TokenCache, parse_token_response, scrub};

const TOKEN: &str = "sk-ant-oat01-SECRETSECRET";
const JWT: &str = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ4In0.c2ln";

fn lookup(pairs: &[(&str, &str)]) -> impl Fn(&str) -> Option<String> {
    let map: HashMap<String, String> = pairs
        .iter()
        .map(|(k, v)| ((*k).to_owned(), (*v).to_owned()))
        .collect();
    move |k| map.get(k).cloned()
}

fn full() -> Vec<(&'static str, &'static str)> {
    vec![
        ("ANTHROPIC_FEDERATION_RULE_ID", "fdrl_1"),
        ("ANTHROPIC_ORGANIZATION_ID", "org-1"),
        ("ANTHROPIC_SERVICE_ACCOUNT_ID", "svac_1"),
        ("ANTHROPIC_WORKSPACE_ID", "wrkspc_1"),
    ]
}

#[test]
fn missing_ids_are_all_named() {
    let err = FederationConfig::from_lookup(lookup(&[
        ("ANTHROPIC_FEDERATION_RULE_ID", "fdrl_1"),
        ("ANTHROPIC_WORKSPACE_ID", "  "),
    ]));
    assert_eq!(
        err,
        Err(AuthError::Missing(
            "ANTHROPIC_ORGANIZATION_ID, ANTHROPIC_SERVICE_ACCOUNT_ID, ANTHROPIC_WORKSPACE_ID"
                .to_owned()
        ))
    );
}

#[test]
fn region_defaults_to_mumbai_and_profile_is_optional() {
    let cfg = FederationConfig::from_lookup(lookup(&full()));
    assert!(
        cfg.as_ref()
            .is_ok_and(|c| c.aws_region == "ap-south-1" && c.aws_profile.is_none())
    );
    let mut pairs = full();
    pairs.push(("ANTHROPIC_AWS_PROFILE", "medbrains-claude"));
    pairs.push(("ANTHROPIC_AWS_REGION", "ap-south-2"));
    let cfg = FederationConfig::from_lookup(lookup(&pairs));
    assert!(
        cfg.is_ok_and(|c| c.aws_region == "ap-south-2"
            && c.aws_profile.as_deref() == Some("medbrains-claude"))
    );
}

#[test]
fn token_request_is_the_jwt_bearer_grant_and_nothing_else() {
    let cfg = FederationConfig::from_lookup(lookup(&full()));
    let body = cfg.map(|c| c.token_request(JWT)).unwrap_or_default();
    assert_eq!(
        body["grant_type"],
        "urn:ietf:params:oauth:grant-type:jwt-bearer"
    );
    assert_eq!(body["assertion"], JWT);
    assert_eq!(body["federation_rule_id"], "fdrl_1");
    assert_eq!(body["organization_id"], "org-1");
    assert_eq!(body["service_account_id"], "svac_1");
    assert_eq!(body["workspace_id"], "wrkspc_1");
    // Six fields: no prompt, no patient data can ride along.
    assert_eq!(body.as_object().map(serde_json::Map::len), Some(6));
}

#[test]
fn a_good_response_gives_token_and_lifetime() {
    let body = format!(r#"{{"access_token":"{TOKEN}","expires_in":600,"token_type":"Bearer"}}"#);
    let got = parse_token_response(200, &body);
    assert_eq!(
        got,
        Ok((AccessToken(TOKEN.to_owned()), Duration::from_secs(600)))
    );
}

#[test]
fn errors_never_carry_a_token() {
    let cases = [
        (200, format!(r#"{{"access_token":"{TOKEN}"}}"#)),
        (
            200,
            format!(r#"{{"access_token":"{TOKEN}","expires_in":"soon"}}"#),
        ),
        (200, format!("not json {TOKEN}")),
        (
            401,
            format!(r#"{{"error":{{"type":"invalid_grant","message":"bad {JWT} / {TOKEN}"}}}}"#),
        ),
        (
            400,
            format!(r#"{{"error":"invalid_request","error_description":"jwt {JWT}"}}"#),
        ),
    ];
    for (status, body) in cases {
        let got = parse_token_response(status, &body);
        assert!(got.is_err(), "HTTP {status} should fail");
        let text = got.err().map(|e| e.to_string()).unwrap_or_default();
        assert!(
            !text.contains("SECRET") && !text.contains("eyJ"),
            "leaked: {text}"
        );
    }
    let refused = parse_token_response(
        401,
        r#"{"error":{"type":"invalid_grant","message":"rule mismatch"}}"#,
    );
    assert_eq!(
        refused.map_err(|e| e.to_string()),
        Err("Anthropic token exchange failed: HTTP 401: invalid_grant rule mismatch".to_owned())
    );
}

#[test]
fn scrub_blanks_credentials_and_keeps_the_rest() {
    assert_eq!(
        scrub(&format!("token \"{TOKEN}\" and {JWT}.")),
        "token \"[redacted]\" and [redacted]."
    );
    assert_eq!(
        scrub("AccessDenied: not authorized"),
        "AccessDenied: not authorized"
    );
}

#[test]
fn debug_hides_the_token() {
    assert_eq!(
        format!("{:?}", AccessToken(TOKEN.to_owned())),
        "AccessToken(…)"
    );
}

#[test]
fn cache_serves_until_two_minutes_before_expiry() {
    let cache = TokenCache::new();
    let t0 = Instant::now();
    assert_eq!(cache.get(t0), None);
    cache.put(AccessToken(TOKEN.to_owned()), Duration::from_secs(600), t0);
    assert!(cache.get(t0 + Duration::from_secs(479)).is_some());
    assert_eq!(cache.get(t0 + Duration::from_secs(480)), None);
    // A token shorter-lived than the margin is never served.
    cache.put(AccessToken(TOKEN.to_owned()), Duration::from_secs(60), t0);
    assert_eq!(cache.get(t0), None);
}
