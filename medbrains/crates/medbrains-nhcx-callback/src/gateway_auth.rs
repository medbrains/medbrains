//! Is this delivery really from the NHCX gateway? The source address (when
//! the hospital keeps an allow-list), then the gateway's RS256 JWT: a valid
//! signature against the key saved in Settings → NHCX, within `exp`, with
//! `iss` and `sub` present and equal, an `iat`, and a `jti` never seen
//! before (HCX protocol, API Security; NHA's package, "Receiving a Callback").
//!
//! A hospital with no gateway key saved refuses every callback, on purpose:
//! no published source gives the key, and accepting patient data from an
//! unauthenticated address is worse than not reading it. Settings → NHCX
//! says what is missing.

use axum::http::{HeaderMap, header::AUTHORIZATION};
use serde_json::{Map, Value};
use uuid::Uuid;

use medbrains_outbox::handlers::nhcx::config::StoredSettings;

use crate::apply::Tx;

/// Seconds a token's `iat` may run ahead of our clock.
const IAT_LEEWAY_SECONDS: i64 = 300;
/// NHA's package names this header for the session token on calls to the
/// gateway; accept the gateway's own token in it too.
const BEARER_AUTH_HEADER: &str = "bearer_auth";

/// Why a delivery was refused — stored on the callback log as
/// `verification_status`, and answered in the receipt's `error`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Refusal {
    AddressNotAllowed,
    NoGatewayKey,
    NoToken,
    BadToken,
    ReplayedToken,
    Undecryptable,
    WrongRecipient,
    NoCorrelation,
}

impl Refusal {
    pub(crate) const fn status(self) -> &'static str {
        match self {
            Self::AddressNotAllowed => "refused_address",
            Self::NoGatewayKey => "refused_no_gateway_key",
            Self::NoToken | Self::BadToken => "refused_token",
            Self::ReplayedToken => "refused_replay",
            Self::Undecryptable => "refused_decrypt",
            Self::WrongRecipient => "refused_recipient",
            Self::NoCorrelation => "refused_no_correlation",
        }
    }

    pub(crate) const fn code(self) -> &'static str {
        match self {
            Self::AddressNotAllowed | Self::NoToken | Self::BadToken | Self::ReplayedToken => {
                "ERR_INVALID_SIGNATURE"
            }
            Self::NoGatewayKey => "ERR_SERVICE_UNAVAILABLE",
            Self::Undecryptable => "ERR_INVALID_ENCRYPTION",
            Self::WrongRecipient => "ERR_INVALID_RECIPIENT",
            Self::NoCorrelation => "ERR_INVALID_CORRELATION_ID",
        }
    }

    pub(crate) const fn message(self) -> &'static str {
        match self {
            Self::AddressNotAllowed => "the callback came from an address not on the allow-list",
            Self::NoGatewayKey => "the hospital has not saved the NHCX gateway public key",
            Self::NoToken => "the callback carried no gateway token",
            Self::BadToken => "the gateway token did not verify",
            Self::ReplayedToken => "the gateway token was used before",
            Self::Undecryptable => "the message could not be decrypted with our key",
            Self::WrongRecipient => "the message names another recipient",
            Self::NoCorrelation => "x-hcx-correlation_id is missing",
        }
    }

    /// Whether the sender is known to be the gateway, so its body may be kept.
    pub(crate) const fn is_authenticated(self) -> bool {
        matches!(
            self,
            Self::Undecryptable | Self::WrongRecipient | Self::NoCorrelation
        )
    }
}

/// The source address, when the hospital keeps an allow-list. No known
/// address with a list set is a refusal, never a pass.
pub(crate) fn check_address(
    stored: &StoredSettings,
    client_ip: Option<std::net::IpAddr>,
) -> Result<(), Refusal> {
    let list = stored.callback_ip_allowlist.as_deref().unwrap_or_default();
    if list.is_empty() {
        return Ok(());
    }
    let allowed = client_ip.is_some_and(|ip| {
        list.iter()
            .any(|a| a.parse::<std::net::IpAddr>().is_ok_and(|a| a == ip))
    });
    if allowed {
        Ok(())
    } else {
        Err(Refusal::AddressNotAllowed)
    }
}

fn bearer(headers: &HeaderMap) -> Option<&str> {
    [AUTHORIZATION.as_str(), BEARER_AUTH_HEADER]
        .iter()
        .filter_map(|h| headers.get(*h)?.to_str().ok())
        .find_map(|v| v.strip_prefix("Bearer "))
}

/// The claims a gateway token must carry beyond `exp`: `iss` and `sub`
/// present and equal, `iat` not in the future, and a `jti`.
pub(crate) fn check_claims(claims: &Map<String, Value>, now: i64) -> Result<String, Refusal> {
    let text = |k: &str| {
        claims
            .get(k)
            .and_then(Value::as_str)
            .filter(|s| !s.is_empty())
    };
    let (Some(iss), Some(sub), Some(jti)) = (text("iss"), text("sub"), text("jti")) else {
        return Err(Refusal::BadToken);
    };
    let iat = claims.get("iat").and_then(Value::as_i64);
    if iss != sub || iat.is_none_or(|t| t > now + IAT_LEEWAY_SECONDS) {
        return Err(Refusal::BadToken);
    }
    Ok(jti.to_owned())
}

/// Verify the gateway's token; the `jti` it carries, never seen before.
pub(crate) async fn verify(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    headers: &HeaderMap,
    stored: &StoredSettings,
) -> Result<Result<String, Refusal>, sqlx::Error> {
    let Some(key) = stored.gateway_jwt_public_key_pem.as_deref() else {
        tracing::warn!(%tenant_id, "nhcx callback refused: no gateway key saved");
        return Ok(Err(Refusal::NoGatewayKey));
    };
    let Some(token) = bearer(headers) else {
        return Ok(Err(Refusal::NoToken));
    };
    let jti = match medbrains_crypto::jws::verify_rs256(token, key.as_bytes()) {
        Ok(claims) => check_claims(&claims, chrono::Utc::now().timestamp()),
        Err(_) => Err(Refusal::BadToken),
    };
    let Ok(jti) = jti else {
        tracing::warn!(%tenant_id, "nhcx callback refused: gateway JWT did not verify");
        return Ok(jti);
    };
    let seen: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM nhcx_callback_log WHERE tenant_id = $1 AND gateway_jti = $2)",
    )
    .bind(tenant_id)
    .bind(&jti)
    .fetch_one(&mut **tx)
    .await?;
    Ok(if seen {
        Err(Refusal::ReplayedToken)
    } else {
        Ok(jti)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn claims(v: Value) -> Map<String, Value> {
        v.as_object().cloned().unwrap_or_default()
    }

    #[test]
    fn a_token_needs_matching_iss_and_sub_a_jti_and_a_past_iat() {
        let now = 1_000_000;
        let good = claims(json!({ "iss": "nhcx", "sub": "nhcx", "jti": "j1", "iat": now }));
        assert_eq!(check_claims(&good, now), Ok("j1".to_owned()));
        let other_sub = claims(json!({ "iss": "nhcx", "sub": "x", "jti": "j1", "iat": now }));
        assert_eq!(check_claims(&other_sub, now), Err(Refusal::BadToken));
        let no_jti = claims(json!({ "iss": "nhcx", "sub": "nhcx", "iat": now }));
        assert_eq!(check_claims(&no_jti, now), Err(Refusal::BadToken));
        let future = claims(json!({ "iss": "n", "sub": "n", "jti": "j", "iat": now + 3600 }));
        assert_eq!(check_claims(&future, now), Err(Refusal::BadToken));
    }

    #[test]
    fn an_allow_list_refuses_other_and_unknown_addresses() {
        let mut stored = StoredSettings::default();
        assert_eq!(check_address(&stored, None), Ok(()));
        stored.callback_ip_allowlist = Some(vec!["3.109.99.210".to_owned()]);
        let ip = |s: &str| s.parse().ok();
        assert_eq!(check_address(&stored, ip("3.109.99.210")), Ok(()));
        assert_eq!(
            check_address(&stored, ip("10.0.0.1")),
            Err(Refusal::AddressNotAllowed)
        );
        assert_eq!(
            check_address(&stored, None),
            Err(Refusal::AddressNotAllowed)
        );
    }
}
