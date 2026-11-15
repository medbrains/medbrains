//! The NHCX participant service (the registry).
//!
//! It says who the payers and TPAs are
//! (`/fetch/participants/list`), a recipient's encryption certificate
//! (`/fetch/certs`), and which policies are linked to a patient
//! (`/participant/get/policies`). Plain JSON calls, no JWE, with the gateway
//! session token in `bearer_auth` (docs.abdm.gov.in, "Finding participants and
//! policies", "Fetching a recipient certificate").
//!
//! Every field of a registry answer is optional and the list arrives under
//! `participantdetails`, `participants`, `policies` or bare, so the readers
//! below take any of those and match keys without regard to case or `_`.

use chrono::{DateTime, Utc};
use medbrains_core::secrets::SecretResolver;
use serde_json::{Value, json};
use sqlx::PgConnection;
use uuid::Uuid;

use super::config::{self, ConfigError};
use super::session::{self, Endpoints, SessionError};
use super::{HandlerCtx, HandlerError, tenant_tx, transient};

/// A registry certificate is fetched again after a day (the handbook's cache).
const CERT_MAX_AGE_HOURS: i64 = 24;
/// The earliest registration date asked for when listing participants.
const LIST_FROM: &str = "01/01/2020";
/// Bound on what one registry answer may carry.
const MAX_ROWS: usize = 5000;

#[derive(Debug, thiserror::Error)]
pub enum RegistryError {
    /// Something the hospital must set up first; the message says what.
    #[error("{0}")]
    NotSetUp(String),
    /// The registry answered and said no, in its own words.
    #[error("the NHCX registry refused the request: {0}")]
    Refused(String),
    /// The registry could not be reached or failed.
    #[error("the NHCX registry is not responding: {0}")]
    Unavailable(String),
}

impl From<ConfigError> for RegistryError {
    /// Missing setup reads as such; a store or database fault is an outage.
    fn from(e: ConfigError) -> Self {
        match e {
            ConfigError::NotSetUp(m) => Self::NotSetUp(m),
            other => Self::Unavailable(other.to_string()),
        }
    }
}

/// A signed-in registry client.
pub struct Registry<'a> {
    http: &'a reqwest::Client,
    base: String,
    token: String,
}

// Hand-written so the session token can never reach a log line.
impl std::fmt::Debug for Registry<'_> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Registry")
            .field("base", &self.base)
            .finish_non_exhaustive()
    }
}

/// One payer or TPA from `/fetch/participants/list`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ListedParticipant {
    pub code: String,
    pub name: String,
}

/// One policy from `/participant/get/policies`.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct LinkedPolicy {
    pub payer_id: Option<String>,
    /// Who processes claims for it: the envelope's recipient.
    pub processing_id: String,
    pub member_id: Option<String>,
    pub product_id: Option<String>,
    pub product_name: Option<String>,
}

impl<'a> Registry<'a> {
    /// A client for a gateway token already in hand.
    #[must_use]
    pub const fn new(http: &'a reqwest::Client, base: String, token: String) -> Self {
        Self { http, base, token }
    }

    /// Sign in with the hospital's saved NHCX credentials.
    ///
    /// # Errors
    /// [`RegistryError::NotSetUp`] without credentials; otherwise as the
    /// gateway sign-in.
    pub async fn connect(
        http: &'a reqwest::Client,
        conn: &mut PgConnection,
        tenant_id: Uuid,
        resolver: &dyn SecretResolver,
    ) -> Result<Self, RegistryError> {
        let stored = config::stored(conn, tenant_id).await?;
        let creds = config::credentials(&stored, resolver).await?;
        let base = config::base_url_override(resolver).await;
        let endpoints = Endpoints::new(creds.environment, base.as_deref());
        let token = session::token(http, tenant_id, &creds, &endpoints)
            .await
            .map_err(|e| match e {
                SessionError::Refused(m) => RegistryError::Refused(m),
                SessionError::Unavailable(m) => RegistryError::Unavailable(m),
            })?;
        Ok(Self::new(http, endpoints.registry, token))
    }

    /// POST a JSON body to a registry path; the answer's text on 2xx.
    async fn post(&self, path: &str, body: &Value) -> Result<String, RegistryError> {
        let resp = self
            .http
            .post(format!("{}{path}", self.base))
            .header("bearer_auth", format!("Bearer {}", self.token))
            .header(reqwest::header::ACCEPT, "application/json")
            .json(body)
            .send()
            .await
            .map_err(|e| RegistryError::Unavailable(e.to_string()))?;
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        if status.is_success() {
            return Ok(text);
        }
        let said: String = text.chars().take(300).collect();
        Err(if status.is_client_error() {
            RegistryError::Refused(format!("{status}: {said}"))
        } else {
            RegistryError::Unavailable(format!("{status}: {said}"))
        })
    }

    /// The participants holding `role` (`PAYER`, `TPA`) on the `entity_type`
    /// list (`Gov`, `Pvt`) — the registry answers one list per type.
    ///
    /// # Errors
    /// As the registry call.
    pub async fn participants(
        &self,
        role: &str,
        entity_type: &str,
        today: DateTime<Utc>,
    ) -> Result<Vec<ListedParticipant>, RegistryError> {
        let body = json!({
            "role": role,
            "fromdate": LIST_FROM,
            "todate": today.format("%d/%m/%Y").to_string(),
            "entitytype": entity_type,
        });
        let text = self.post("/fetch/participants/list", &body).await?;
        Ok(listed_participants(&parse(&text)))
    }

    /// A participant's encryption certificate (PEM certificate or key).
    ///
    /// # Errors
    /// As the registry call; [`RegistryError::Refused`] when the answer holds
    /// no PEM.
    pub async fn certificate(&self, participant: &str) -> Result<String, RegistryError> {
        let text = self
            .post("/fetch/certs", &json!({ "participantid": participant }))
            .await?;
        pem_in(&text).ok_or_else(|| {
            RegistryError::Refused(format!("no certificate for {participant} in the answer"))
        })
    }

    /// The policies linked to a patient by `identifier_type` (`AbhaNumber`
    /// without hyphens, or `MemberId`). A policy without a `processingid`
    /// cannot be addressed and is left out.
    ///
    /// # Errors
    /// As the registry call.
    pub async fn policies(
        &self,
        identifier_type: &str,
        value: &str,
    ) -> Result<Vec<LinkedPolicy>, RegistryError> {
        let body = json!({ "identifiertype": identifier_type, "identifiervalue": value });
        let text = self.post("/participant/get/policies", &body).await?;
        Ok(linked_policies(&parse(&text)))
    }
}

/// The answer as JSON, or as a JSON string when it is not JSON at all.
fn parse(text: &str) -> Value {
    serde_json::from_str(text).unwrap_or_else(|_| Value::String(text.to_owned()))
}

/// A key compared without case or `_`: `processingID`, `processing_id`.
fn same_key(key: &str, want: &str) -> bool {
    key.chars()
        .filter(|c| *c != '_')
        .map(|c| c.to_ascii_lowercase())
        .eq(want.chars())
}

/// The first non-blank string under any of `keys`.
fn field(item: &Value, keys: &[&str]) -> Option<String> {
    let obj = item.as_object()?;
    keys.iter().find_map(|want| {
        obj.iter()
            .find(|(k, _)| same_key(k, want))
            .and_then(|(_, v)| v.as_str())
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_owned)
    })
}

/// The rows of an answer: the array under one of `keys`, or the answer itself.
fn rows<'v>(body: &'v Value, keys: &[&str]) -> &'v [Value] {
    let found = body.as_object().and_then(|obj| {
        keys.iter()
            .find_map(|want| obj.iter().find(|(k, _)| same_key(k, want)).map(|(_, v)| v))
    });
    let rows = found
        .unwrap_or(body)
        .as_array()
        .map_or(&[][..], Vec::as_slice);
    &rows[..rows.len().min(MAX_ROWS)]
}

/// Read `/fetch/participants/list`; a row without a code is skipped.
#[must_use]
pub fn listed_participants(body: &Value) -> Vec<ListedParticipant> {
    rows(body, &["participantdetails", "participants"])
        .iter()
        .filter_map(|r| {
            let code = field(r, &["participantcode", "code"])?;
            let name = field(r, &["participantname", "name"]).unwrap_or_else(|| code.clone());
            Some(ListedParticipant { code, name })
        })
        .collect()
}

/// Read `/participant/get/policies`.
#[must_use]
pub fn linked_policies(body: &Value) -> Vec<LinkedPolicy> {
    rows(body, &["policies", "participantdetails", "participants"])
        .iter()
        .filter_map(|r| {
            Some(LinkedPolicy {
                processing_id: field(r, &["processingid"])?,
                payer_id: field(r, &["payerid"]),
                member_id: field(r, &["memberid"]),
                product_id: field(r, &["productid"]),
                product_name: field(r, &["productname"]),
            })
        })
        .collect()
}

/// The PEM block in an answer — raw text, a JSON string, or a string anywhere
/// inside a JSON object.
#[must_use]
pub fn pem_in(text: &str) -> Option<String> {
    match parse(text) {
        Value::String(s) => pem_block(&s),
        other => find_pem(&other, 0),
    }
}

/// Depth-bounded search for a string holding a PEM block.
fn find_pem(v: &Value, depth: u8) -> Option<String> {
    if depth > 4 {
        return None;
    }
    match v {
        Value::String(s) => pem_block(s),
        Value::Array(a) => a.iter().find_map(|x| find_pem(x, depth + 1)),
        Value::Object(o) => o.values().find_map(|x| find_pem(x, depth + 1)),
        _ => None,
    }
}

/// From `-----BEGIN` to the end of its `-----END …-----` line.
fn pem_block(s: &str) -> Option<String> {
    let start = s.find("-----BEGIN ")?;
    let rest = &s[start..];
    let end = rest.find("-----END ")?;
    let close = rest[end + 9..].find("-----")? + end + 9 + 5;
    Some(rest[..close].to_owned())
}

/// The recipient's encryption certificate for this send.
///
/// A registry certificate under a day old is used as stored; otherwise it is
/// fetched from `/fetch/certs` and stored. `force` (the payer could not
/// decrypt the last one) always fetches. When the registry cannot answer, the
/// stored certificate — one typed in by hand — is the fallback.
///
/// # Errors
/// [`HandlerError::Permanent`] when neither the registry nor the directory
/// has one; a database fault is transient.
pub(super) async fn recipient_cert(
    ctx: &HandlerCtx,
    registry: &Registry<'_>,
    recipient: &str,
    force: bool,
) -> Result<String, HandlerError> {
    let mut tx = tenant_tx(ctx).await?;
    let stored: Option<(Option<String>, Option<DateTime<Utc>>)> = sqlx::query_as(
        "SELECT encryption_cert, cert_fetched_at FROM nhcx_participants \
         WHERE tenant_id = $1 AND participant_code = $2 AND is_active",
    )
    .bind(ctx.tenant_id)
    .bind(recipient)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| transient(&e))?;
    tx.commit().await.map_err(|e| transient(&e))?;
    let (cert, fetched_at) = stored.unwrap_or_default();
    let cert = cert.filter(|c| !c.trim().is_empty());
    let fresh =
        fetched_at.is_some_and(|t| Utc::now() - t < chrono::Duration::hours(CERT_MAX_AGE_HOURS));
    if let (Some(cert), true, false) = (&cert, fresh, force) {
        return Ok(cert.clone());
    }
    let fetched = registry.certificate(recipient).await.and_then(|pem| {
        if usable(&pem) {
            Ok(pem)
        } else {
            Err(RegistryError::Refused(format!(
                "the certificate for {recipient} is not usable"
            )))
        }
    });
    match (fetched, cert) {
        (Ok(pem), _) => {
            let mut tx = tenant_tx(ctx).await?;
            store_cert(&mut tx, ctx.tenant_id, recipient, &pem).await?;
            tx.commit().await.map_err(|e| transient(&e))?;
            Ok(pem)
        }
        (Err(e), Some(cert)) => {
            tracing::warn!(tenant_id = %ctx.tenant_id, %recipient, error = %e,
                "nhcx: certificate not fetched; using the directory's");
            Ok(cert)
        }
        (Err(e @ RegistryError::Unavailable(_)), None) => Err(HandlerError::Transient(format!(
            "no certificate for {recipient} yet: {e}"
        ))),
        (Err(e), None) => Err(HandlerError::Permanent(format!(
            "no encryption certificate for {recipient}: not in the NHCX payer directory, and \
             the registry did not give one ({e})"
        ))),
    }
}

/// Whether a PEM can be encrypted to — a registry answer is checked before it
/// replaces the certificate on file.
fn usable(pem: &str) -> bool {
    medbrains_crypto::jwe::encrypt_hcx(&json!({}), &serde_json::Map::new(), pem.as_bytes()).is_ok()
}

/// Keep a fetched certificate; a recipient not yet in the directory (a TPA
/// named as a policy's processor) is added as a registry row.
async fn store_cert(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    recipient: &str,
    pem: &str,
) -> Result<(), HandlerError> {
    sqlx::query(
        "INSERT INTO nhcx_participants \
             (tenant_id, participant_code, participant_name, source, encryption_cert, \
              cert_fetched_at) \
         VALUES ($1, $2, $2, 'registry', $3, now()) \
         ON CONFLICT (tenant_id, participant_code) DO UPDATE SET \
             encryption_cert = EXCLUDED.encryption_cert, cert_fetched_at = now(), \
             updated_at = now()",
    )
    .bind(tenant_id)
    .bind(recipient)
    .bind(pem)
    .execute(&mut **tx)
    .await
    .map_err(|e| transient(&e))?;
    Ok(())
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    #[test]
    fn participants_are_read_under_any_published_key() {
        let a = json!({ "participantdetails": [
            { "participantcode": "1000003538@hcx", "participantname": "Dummy Payer" },
            { "participantname": "no code" }
        ]});
        let b = json!([{ "participant_code": "1518@hcx" }]);
        assert_eq!(
            listed_participants(&a),
            vec![ListedParticipant {
                code: "1000003538@hcx".into(),
                name: "Dummy Payer".into()
            }]
        );
        assert_eq!(listed_participants(&b)[0].name, "1518@hcx");
        assert!(listed_participants(&json!({ "error": "x" })).is_empty());
    }

    #[test]
    fn a_policy_is_addressed_to_its_processor_and_one_without_is_dropped() {
        let body = json!({ "policies": [
            { "payerid": "1518@hcx", "processingID": "1000000109@hcx",
              "memberid": "MD5SLS4X5", "productid": "PMJAY/HP/S/G",
              "productname": "PMJAY Himachal Pradesh" },
            { "payerid": "2000@hcx" }
        ]});
        let got = linked_policies(&body);
        assert_eq!(got.len(), 1);
        assert_eq!(got[0].processing_id, "1000000109@hcx");
        assert_eq!(got[0].payer_id.as_deref(), Some("1518@hcx"));
        assert_eq!(got[0].member_id.as_deref(), Some("MD5SLS4X5"));
    }

    #[test]
    fn the_pem_is_found_raw_quoted_or_inside_an_object() {
        let pem = "-----BEGIN CERTIFICATE-----\nMIID0z\n-----END CERTIFICATE-----";
        assert_eq!(pem_in(&format!("{pem}\n")).as_deref(), Some(pem));
        assert_eq!(
            pem_in(&serde_json::to_string(pem).unwrap()).as_deref(),
            Some(pem)
        );
        let wrapped = json!({ "data": { "encryption_cert": pem } }).to_string();
        assert_eq!(pem_in(&wrapped).as_deref(), Some(pem));
        assert_eq!(pem_in("{\"error\":\"not found\"}"), None);
        assert_eq!(pem_in("-----BEGIN PUBLIC KEY-----\nabc"), None);
    }
}
